import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const BIN_DIR = path.join(ROOT, "bin");
const UI_DIR = path.join(ROOT, "ui");

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

async function buildUiHtml({ entryJs, cssPath, title, outHtml }) {
  const css = fs.readFileSync(cssPath, "utf-8");
  const result = await esbuild.build({
    entryPoints: [entryJs],
    bundle: true,
    platform: "browser",
    target: ["es2020"],
    format: "iife",
    minify: true,
    write: false,
    logLevel: "warning"
  });

  const jsCode = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<script>
${jsCode}
</script>
</body>
</html>
`;

  // Audit single-file CSP & isolation invariants
  if (/<script[^>]+src=/i.test(html) || /<link[^>]+rel=["']stylesheet/i.test(html) || /https:\/\/cdn/i.test(html)) {
    throw new Error(`External script/stylesheet detected in ${outHtml}`);
  }
  if (/pluginMessage|figma\./i.test(html)) {
    throw new Error(`Unexpected Figma coupling string found in ${outHtml}`);
  }
  if (path.basename(outHtml) === "inline.html" && /\b(?:min-|max-)?height:\s*100[dv]?h/i.test(css)) {
    throw new Error(`inline.css must not use 100vh/100dvh height`);
  }

  const sizeBytes = Buffer.byteLength(html, "utf-8");
  if (sizeBytes >= 10 * 1024 * 1024) {
    throw new Error(`${outHtml} exceeds 10 MiB MCP App limit (${sizeBytes} bytes)`);
  }

  fs.mkdirSync(path.dirname(outHtml), { recursive: true });
  fs.writeFileSync(outHtml, html, "utf-8");
  return sizeBytes;
}

async function main() {
  cleanDir(BIN_DIR);
  cleanDir(UI_DIR);

  // 1. Bundle Node.js stdio MCP server into standalone CJS binary (zero node_modules needed at runtime)
  const serverOut = path.join(BIN_DIR, "server.cjs");
  await esbuild.build({
    entryPoints: [path.join(ROOT, "src", "server", "index.mjs")],
    bundle: true,
    platform: "node",
    target: ["node20"],
    format: "cjs",
    outfile: serverOut,
    define: {
      "import.meta.url": "undefined"
    },
    minify: false,
    logLevel: "warning"
  });
  const serverSize = fs.statSync(serverOut).size;

  // 2. Build single-file MCP App HTML views
  const inlineSize = await buildUiHtml({
    entryJs: path.join(ROOT, "src", "ui", "inline.js"),
    cssPath: path.join(ROOT, "src", "ui", "inline.css"),
    title: "ISCV Inline Chart Card",
    outHtml: path.join(UI_DIR, "inline.html")
  });

  const studioSize = await buildUiHtml({
    entryJs: path.join(ROOT, "src", "ui", "studio.js"),
    cssPath: path.join(ROOT, "src", "ui", "studio.css"),
    title: "ISCV Chart Studio",
    outHtml: path.join(UI_DIR, "studio.html")
  });

  console.log("Built Antigravity plugin bundle at repo root:");
  console.log(`  bin/server.cjs : ${(serverSize / 1024).toFixed(2)} KiB`);
  console.log(`  ui/inline.html : ${(inlineSize / 1024).toFixed(2)} KiB (${((inlineSize / (10 * 1024 * 1024)) * 100).toFixed(2)}% of 10 MiB cap)`);
  console.log(`  ui/studio.html : ${(studioSize / 1024).toFixed(2)} KiB (${((studioSize / (10 * 1024 * 1024)) * 100).toFixed(2)}% of 10 MiB cap)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
