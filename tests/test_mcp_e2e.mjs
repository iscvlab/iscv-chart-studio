import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = ROOT;
const renderer = require(path.join(ROOT, "src", "core", "svg_renderer.js"));

async function run() {
  console.log("1. Unit & Core Matrix (45 chart families + XML escape + NaN guard)...");
  assert.equal(renderer.ISCV_CHART_CATALOG.length, 45, "Expected exactly 45 chart presets");
  assert.equal(renderer.ISCV_PALETTES.length, 14, "Expected exactly 14 palettes");
  assert.equal(typeof renderer.toCsvString, "function", "Expected toCsvString export from svg_renderer");

  const defaultRender = renderer.renderChartSvg({});
  assert.equal(defaultRender.spec.isDark, false, "Default spec.isDark must be false (Light Mode)");
  assert.ok(defaultRender.svg.includes('fill="#FFFFFF"'), "Default Light Mode SVG must include #FFFFFF card background");

  const customRawRender = renderer.renderChartSvg({
    chartId: "bar_grouped",
    rawData: "Quarter,Alpha,Beta\nQ1,12,18\nQ2,16,22"
  });
  assert.equal(customRawRender.spec.isDark, false, "Custom rawData without isDark must default to false");
  assert.equal(customRawRender.spec.subtitle, "", "Custom rawData without subtitle must not leak preset subtitle");
  assert.equal(customRawRender.spec.source, "ISCV Chart Studio", "Custom rawData without source must default to ISCV Chart Studio");
  assert.ok(!customRawRender.svg.includes("USD Millions"), "Custom rawData SVG must not leak preset 'USD Millions'");

  const rfcCsv = renderer.toCsvString(["Name", "Note"], [['Zone, 1', 'Said "OK"'], ["Line\nTwo", 42]]);
  assert.ok(rfcCsv.includes('"Zone, 1"'), "toCsvString must quote commas");
  assert.ok(rfcCsv.includes('"Said ""OK"""'), "toCsvString must escape double quotes");
  assert.ok(rfcCsv.includes('"Line\nTwo",42'), "toCsvString must quote newlines");

  for (const preset of renderer.ISCV_CHART_CATALOG) {
    const { svg } = renderer.renderChartSvg({
      chartId: preset.id,
      title: `Test <"A" & 'B'> ${preset.name}`,
      subtitle: "Unit: mg/m³ & °C",
      isDark: true
    });
    assert.ok(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'), `${preset.id} missing svg xmlns`);
    assert.ok(svg.includes('width="680"') && svg.includes('height="440"') && svg.includes('viewBox="0 0 680 440"'), `${preset.id} missing dimensions`);
    assert.ok(svg.includes('fill="#0B0F19"'), `${preset.id} missing explicit card background rect`);
    assert.ok(svg.includes('font-family="Inter,'), `${preset.id} missing explicit font-family`);
    assert.ok(!/\bNaN\b|\bInfinity\b/.test(svg), `${preset.id} emitted NaN or Infinity`);
    assert.ok(svg.includes("&lt;&quot;A&quot; &amp; &#39;B&#39;&gt;"), `${preset.id} failed XML entity escaping`);
  }
  console.log("   PASS: 45/45 chart families rendered clean self-contained SVG.");

  console.log("2. Single-File Bundle Audit...");
  const inlinePath = path.join(DIST, "ui", "inline.html");
  const studioPath = path.join(DIST, "ui", "studio.html");
  const serverPath = path.join(DIST, "bin", "server.cjs");
  for (const p of [inlinePath, studioPath, serverPath]) {
    assert.ok(fs.existsSync(p), `Missing build artifact: ${p}`);
  }
  const inlineHtml = fs.readFileSync(inlinePath, "utf-8");
  const studioHtml = fs.readFileSync(studioPath, "utf-8");
  for (const [label, html] of [["inline.html", inlineHtml], ["studio.html", studioHtml]]) {
    const bytes = Buffer.byteLength(html, "utf-8");
    assert.ok(bytes > 20_000 && bytes < 10 * 1024 * 1024, `${label} size out of range: ${bytes}`);
    assert.ok(!/<script[^>]+src=|<link[^>]+rel=["']stylesheet|https:\/\/cdn/i.test(html), `${label} has external asset`);
    assert.ok(!/pluginMessage|figma\./i.test(html), `${label} contains Figma coupling`);
  }
  const inlineStyle = inlineHtml.match(/<style>([\s\S]*?)<\/style>/)?.[1] || "";
  assert.ok(!/height:\s*100vh/i.test(inlineStyle), "inline.html CSS must not set height: 100vh");
  console.log(`   PASS: inline.html (${(Buffer.byteLength(inlineHtml) / 1024).toFixed(1)} KiB), studio.html (${(Buffer.byteLength(studioHtml) / 1024).toFixed(1)} KiB)`);

  console.log("3. Live MCP Stdio E2E Test...");
  const tempData = fs.mkdtempSync(path.join(os.tmpdir(), "iscv-chart-e2e-"));
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverPath, "--data-dir", tempData]
  });
  const client = new Client({ name: "e2e-test-client", version: "1.0.0" });

  try {
    await client.connect(transport);

    const { tools } = await client.listTools();
    const byName = Object.fromEntries(tools.map(t => [t.name, t]));
    assert.ok(byName.iscv_plot_inline, "Missing iscv_plot_inline");
    assert.ok(byName.iscv_open_studio, "Missing iscv_open_studio");
    assert.ok(byName.iscv_chart_catalog, "Missing iscv_chart_catalog");
    assert.ok(byName.iscv_save_export, "Missing iscv_save_export");
    assert.ok(byName.iscv_load_dataset, "Missing iscv_load_dataset");

    assert.equal(byName.iscv_plot_inline._meta?.ui?.resourceUri, "ui://iscv-chart-studio/inline.html");
    assert.equal(byName.iscv_plot_inline._meta?.["com.google.antigravity/ui"], undefined, "Inline tool must NOT declare entrypoints");
    assert.equal(byName.iscv_open_studio._meta?.ui?.resourceUri, "ui://iscv-chart-studio/studio.html");
    const entryTypes = (byName.iscv_open_studio._meta?.["com.google.antigravity/ui"]?.entrypoints || []).map(e => e.type);
    assert.deepEqual(entryTypes, ["aux_pane", "global"]);
    assert.deepEqual(byName.iscv_save_export._meta?.ui?.visibility, ["app"]);

    const { resources } = await client.listResources();
    const uris = resources.map(r => r.uri).sort();
    assert.deepEqual(uris, ["ui://iscv-chart-studio/inline.html", "ui://iscv-chart-studio/studio.html"]);

    for (const uri of uris) {
      const readRes = await client.readResource({ uri });
      assert.equal(readRes.contents[0].mimeType, "text/html;profile=mcp-app");
      assert.ok(readRes.contents[0].text.includes("<!DOCTYPE html>"));
    }

    const catRes = await client.callTool({ name: "iscv_chart_catalog", arguments: {} });
    assert.equal(catRes.structuredContent.charts.length, 45);
    assert.equal(catRes.structuredContent.palettes.length, 14);

    // Default empty input {} (for manual entrypoint launch compatibility)
    const defaultInline = await client.callTool({ name: "iscv_plot_inline", arguments: {} });
    assert.equal(defaultInline.structuredContent.spec.chartId, "bar_grouped");
    assert.equal(defaultInline.structuredContent.spec.isDark, false, "Default iscv_plot_inline {} must set isDark === false");
    assert.ok(defaultInline.content[0].text.includes("Grouped Column Bar"));

    // Custom rawData without subtitle/source/isDark must NOT leak preset "USD Millions"
    const customBarCsv = "District,Sensor X,Sensor Y\nNorth,44,51\nSouth,38,49";
    const customBarRes = await client.callTool({
      name: "iscv_plot_inline",
      arguments: {
        chartId: "bar_grouped",
        title: "District Sensor Telemetry",
        rawData: customBarCsv
      }
    });
    assert.equal(customBarRes.structuredContent.spec.isDark, false);
    assert.equal(customBarRes.structuredContent.spec.subtitle, "");
    assert.equal(customBarRes.structuredContent.spec.source, "ISCV Chart Studio");

    // Perturbed custom CSV input (ΔX -> ΔY != 0)
    const customCsv = "Site,Sensor A,Sensor B,Sensor C\nZone 1,12.4,18.2,24.1\nZone 2,15.8,21.0,27.5\nZone 3,9.5,14.7,19.8\nZone 4,22.1,26.4,31.0";
    const customRes = await client.callTool({
      name: "iscv_plot_inline",
      arguments: {
        chartId: "raincloud_plot",
        paletteId: "okabe_ito_universal",
        isDark: true,
        title: "Perturbed Sensor Raincloud",
        rawData: customCsv
      }
    });
    assert.equal(customRes.structuredContent.spec.chartId, "raincloud_plot");
    assert.equal(customRes.structuredContent.spec.paletteId, "okabe_ito_universal");
    assert.equal(customRes.structuredContent.spec.isDark, true);
    assert.equal(customRes.structuredContent.spec.subtitle, "");
    assert.equal(customRes.structuredContent.spec.source, "ISCV Chart Studio");
    assert.equal(customRes.structuredContent.summary.rowCount, 4);
    assert.notDeepEqual(customRes.structuredContent.spec.rows, defaultInline.structuredContent.spec.rows);
    assert.ok(Buffer.byteLength(JSON.stringify(customRes), "utf-8") < 1024 * 1024);

    const studioRes = await client.callTool({ name: "iscv_open_studio", arguments: {} });
    assert.equal(studioRes.structuredContent.spec.chartId, "bar_grouped");
    assert.equal(studioRes.structuredContent.spec.isDark, false, "Default iscv_open_studio {} must set isDark === false");

    // Export SVG, JSON & CSV
    const svgExp = await client.callTool({
      name: "iscv_save_export",
      arguments: {
        format: "svg",
        filename: "smoke_test",
        spec: customRes.structuredContent.spec
      }
    });
    assert.equal(svgExp.structuredContent.ok, true);
    assert.ok(fs.existsSync(svgExp.structuredContent.path));
    assert.ok(svgExp.structuredContent.fileUri.startsWith("file:///"));
    assert.ok(fs.readFileSync(svgExp.structuredContent.path, "utf-8").includes("Perturbed Sensor Raincloud"));

    const jsonExp = await client.callTool({
      name: "iscv_save_export",
      arguments: {
        format: "json",
        filename: "smoke_test",
        spec: customRes.structuredContent.spec
      }
    });
    assert.equal(jsonExp.structuredContent.ok, true);
    assert.ok(fs.existsSync(jsonExp.structuredContent.path));

    const csvExp = await client.callTool({
      name: "iscv_save_export",
      arguments: {
        format: "csv",
        filename: "smoke_test",
        spec: customRes.structuredContent.spec
      }
    });
    assert.equal(csvExp.structuredContent.ok, true);
    assert.ok(csvExp.structuredContent.path.endsWith(".csv"), "CSV export path must end with .csv");
    assert.ok(fs.existsSync(csvExp.structuredContent.path));
    const csvDisk = fs.readFileSync(csvExp.structuredContent.path, "utf-8");
    assert.ok(csvDisk.includes("Site,Sensor A,Sensor B,Sensor C"), "CSV export missing header line");
    assert.ok(csvDisk.includes("Zone 1,12.4,18.2,24.1"), "CSV export missing data row");

    // Safe error on missing args (CLI resilience check)
    const emptyExp = await client.callTool({ name: "iscv_save_export", arguments: {} });
    assert.equal(emptyExp.isError, true);

    // Off-trajectory large dataset (> 800 KB) staging check
    const bigRows = Array.from({ length: 12000 }, (_, i) => [`Row_${i}_LongLabel_Telemetry_Station`, i * 1.1, i * 2.2, i * 3.3, i * 4.4]);
    const bigRes = await client.callTool({
      name: "iscv_plot_inline",
      arguments: { chartId: "line_smooth", headers: ["Station", "S1", "S2", "S3", "S4"], rows: bigRows }
    });
    assert.equal(bigRes.structuredContent.spec.isDark, false);
    assert.equal(bigRes.structuredContent.spec.subtitle, "");
    assert.equal(bigRes.structuredContent.spec.source, "ISCV Chart Studio");
    assert.ok(bigRes.structuredContent.datasetToken, "Expected off-trajectory datasetToken for >800 KB payload");
    assert.ok(Buffer.byteLength(JSON.stringify(bigRes.structuredContent), "utf-8") < 1024 * 1024);
    const loadedBig = await client.callTool({
      name: "iscv_load_dataset",
      arguments: { datasetToken: bigRes.structuredContent.datasetToken }
    });
    assert.equal(loadedBig.structuredContent.rows.length, 12000);

    console.log("   PASS: Live MCP stdio protocol, entrypoints, exports, error guards & large-dataset offloading verified.");
  } finally {
    await client.close().catch(() => {});
    fs.rmSync(tempData, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error("E2E TEST FAILED:", err);
  process.exit(1);
});
