// ============================================================================
// ISCV Chart Studio | Shared MCP App Bridge, Rasterizer & Interactive Helpers
// ============================================================================

import {
  App,
  applyDocumentTheme,
  applyHostStyleVariables
} from "@modelcontextprotocol/ext-apps";
import { z } from "zod";
import renderer from "../core/svg_renderer.js";

export const {
  ISCV_PACKS,
  ISCV_CHART_CATALOG,
  getChartPresetById,
  ISCV_PALETTES,
  getPaletteById,
  parseTabularInput,
  normalizeChartSpec,
  renderChartSvg,
  computeDataSummary
} = renderer;

function rfc4180Cell(val) {
  const s = val === null || val === undefined ? "" : String(val);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsvString(headers = [], rows = []) {
  if (typeof renderer.toCsvString === "function") {
    return renderer.toCsvString(headers, rows);
  }
  const lines = [];
  if (Array.isArray(headers) && headers.length > 0) {
    lines.push(headers.map(rfc4180Cell).join(","));
  }
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (Array.isArray(row)) {
        lines.push(row.map(rfc4180Cell).join(","));
      }
    }
  }
  return lines.join("\r\n");
}

const TOGGLE_PANE_RES_SCHEMA = z.object({ isError: z.boolean().optional() }).passthrough();

export function applyHostContext(ctx) {
  if (!ctx) return;
  if (ctx.theme) {
    applyDocumentTheme(ctx.theme);
  }
  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }
}

export async function initMcpApp({
  name,
  version = "1.0.0",
  autoResize = true,
  onToolInput,
  onToolResult,
  onToolCancelled,
  onHostContextChanged
}) {
  const app = new App({ name, version }, {}, { autoResize });

  app.ontoolinput = (params) => {
    if (onToolInput) onToolInput(params?.arguments || {});
  };
  app.ontoolresult = async (result) => {
    const sc = result?.structuredContent || null;
    if (sc?.datasetToken && sc?.spec) {
      try {
        const caps = app.getHostCapabilities();
        if (caps?.serverTools) {
          const loaded = await app.callServerTool({
            name: "iscv_load_dataset",
            arguments: { datasetToken: sc.datasetToken }
          });
          const fullData = loaded?.structuredContent;
          if (fullData?.headers && fullData?.rows) {
            sc.spec.headers = fullData.headers;
            sc.spec.rows = fullData.rows;
          }
        }
      } catch (err) {
        console.warn("[ISCV] dataset hydration failed:", err);
      }
    }
    if (onToolResult) onToolResult(result, sc);
  };
  app.ontoolcancelled = (params) => {
    if (onToolCancelled) onToolCancelled(params);
  };
  app.onhostcontextchanged = (ctx) => {
    applyHostContext(ctx);
    if (onHostContextChanged) onHostContextChanged(ctx);
  };

  let connected = false;
  if (window.parent && window.parent !== window) {
    try {
      await app.connect();
      connected = true;
      const ctx = app.getHostContext();
      applyHostContext(ctx);
      if (onHostContextChanged && ctx) onHostContextChanged(ctx);
    } catch (err) {
      console.warn("[ISCV] app.connect failed:", err);
    }
  }

  return {
    app,
    connected,
    caps: connected ? (app.getHostCapabilities() || {}) : {}
  };
}

export function rasterizeSvgToPngBase64(svgText, width, height, scale = 2) {
  return new Promise((resolve, reject) => {
    const w = Math.max(100, Math.round(width || 680));
    const h = Math.max(100, Math.round(height || 440));
    const img = new Image();
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgText);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = w * scale;
        canvas.height = h * scale;
        const ctx = canvas.getContext("2d");
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl.replace(/^data:image\/png;base64,/, ""));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("SVG rasterization failed"));
    img.src = url;
  });
}

export function triggerBlobDownload(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportChartArtifact({ app, caps, format, spec, svgText, onToast }) {
  const slug = (spec.chartId || "iscv_chart").replace(/[^a-zA-Z0-9_-]+/g, "_");
  try {
    if (format === "png") {
      const pngBase64 = await rasterizeSvgToPngBase64(svgText, spec.cardWidth, spec.cardHeight, 2);
      if (caps?.serverTools) {
        const res = await app.callServerTool({
          name: "iscv_save_export",
          arguments: { format: "png", filename: slug, pngBase64 }
        });
        const saved = res?.structuredContent;
        if (saved?.path) {
          onToast?.(`Saved PNG → ${saved.path}`, "success", saved.fileUri);
          return saved;
        }
      }
      const bin = Uint8Array.from(atob(pngBase64), c => c.charCodeAt(0));
      triggerBlobDownload(`${slug}.png`, bin, "image/png");
      onToast?.(`Downloaded ${slug}.png`, "success");
      return null;
    }

    if (caps?.serverTools) {
      const res = await app.callServerTool({
        name: "iscv_save_export",
        arguments: { format, filename: slug, spec }
      });
      const saved = res?.structuredContent;
      if (saved?.path) {
        onToast?.(`Saved ${format.toUpperCase()} → ${saved.path}`, "success", saved.fileUri);
        return saved;
      }
    }

    if (format === "svg") {
      triggerBlobDownload(`${slug}.svg`, svgText, "image/svg+xml;charset=utf-8");
      onToast?.(`Downloaded ${slug}.svg`, "success");
    } else if (format === "json") {
      triggerBlobDownload(`${slug}.json`, JSON.stringify(spec, null, 2), "application/json");
      onToast?.(`Downloaded ${slug}.json`, "success");
    } else if (format === "csv") {
      const csvText = toCsvString(spec.headers, spec.rows);
      triggerBlobDownload(`${slug}.csv`, csvText, "text/csv;charset=utf-8");
      onToast?.(`Downloaded ${slug}.csv`, "success");
    }
  } catch (err) {
    onToast?.(`Export failed: ${err?.message || String(err)}`, "error");
  }
  return null;
}

export async function openFileInAuxPane(app, fileUri) {
  if (!fileUri || !app) return false;
  try {
    const res = await app.request(
      {
        method: "com.google.antigravity/toggle-aux-pane",
        params: { tabType: "fileView", uri: fileUri }
      },
      TOGGLE_PANE_RES_SCHEMA
    );
    return !res?.isError;
  } catch (_) {
    return false;
  }
}

export async function copySvgToClipboard(svgText, onToast) {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(svgText);
      onToast?.("Copied SVG ✓", "success");
      return true;
    }
  } catch (_) {
    // Fallback below
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = svgText;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) {
      onToast?.("Copied SVG ✓", "success");
      return true;
    }
  } catch (_) {
    // Blocked in opaque iframe
  }
  onToast?.("Clipboard blocked in iframe — use Save SVG", "warn");
  return false;
}

export function populateChartAndPaletteSelects(chartSel, paletteSel) {
  if (chartSel) {
    chartSel.innerHTML = "";
    for (const pack of ISCV_PACKS) {
      const grp = document.createElement("optgroup");
      grp.label = `${pack.shortLabel} — ${pack.name}`;
      const charts = ISCV_CHART_CATALOG.filter(c => c.packId === pack.id);
      for (const ch of charts) {
        const opt = document.createElement("option");
        opt.value = ch.id;
        opt.textContent = ch.name;
        grp.appendChild(opt);
      }
      chartSel.appendChild(grp);
    }
  }
  if (paletteSel) {
    paletteSel.innerHTML = "";
    const categories = [...new Set(ISCV_PALETTES.map(p => p.category))];
    for (const cat of categories) {
      const grp = document.createElement("optgroup");
      grp.label = cat;
      for (const pal of ISCV_PALETTES.filter(p => p.category === cat)) {
        const opt = document.createElement("option");
        opt.value = pal.id;
        opt.textContent = pal.name;
        grp.appendChild(opt);
      }
      paletteSel.appendChild(grp);
    }
  }
}

export function bindSvgTooltips(stageEl, tooltipEl) {
  if (!stageEl || !tooltipEl) return;
  stageEl.addEventListener("mousemove", (ev) => {
    const target = ev.target && typeof ev.target.closest === "function"
      ? ev.target.closest(".iscv-datum[data-label]")
      : null;
    if (!target) {
      tooltipEl.hidden = true;
      return;
    }
    const label = target.getAttribute("data-label");
    if (!label) {
      tooltipEl.hidden = true;
      return;
    }
    const rect = stageEl.getBoundingClientRect();
    const scrollX = stageEl.scrollLeft || 0;
    const scrollY = stageEl.scrollTop || 0;
    const x = scrollX + Math.max(8, Math.min(rect.width - 140, ev.clientX - rect.left + 12));
    const y = scrollY + Math.max(8, Math.min(rect.height - 32, ev.clientY - rect.top - 28));
    tooltipEl.textContent = label;
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
    tooltipEl.hidden = false;
  });
  stageEl.addEventListener("mouseleave", () => {
    tooltipEl.hidden = true;
  });
}
