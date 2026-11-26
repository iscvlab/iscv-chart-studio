import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool
} from "@modelcontextprotocol/ext-apps/server";
import renderer from "../core/svg_renderer.js";

const {
  ISCV_PACKS,
  ISCV_CHART_CATALOG,
  ISCV_PALETTES,
  normalizeChartSpec,
  renderChartSvg,
  computeDataSummary
} = renderer;

const INLINE_URI = "ui://iscv-chart-studio/inline.html";
const STUDIO_URI = "ui://iscv-chart-studio/studio.html";
const MAX_TRAJECTORY_BYTES = 800_000;
const MAX_EXPORT_BYTES = 10 * 1024 * 1024;

function resolveServerDir() {
  if (typeof __dirname !== "undefined") return __dirname;
  return import.meta.url ? path.dirname(fileURLToPath(import.meta.url)) : process.cwd();
}

function parseDataDirArg(argv) {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--data-dir" && argv[i + 1]) {
      return path.resolve(argv[i + 1]);
    }
    if (arg.startsWith("--data-dir=")) {
      return path.resolve(arg.slice("--data-dir=".length));
    }
  }
  if (process.env.PLUGIN_DATA) {
    return path.resolve(process.env.PLUGIN_DATA);
  }
  return path.join(os.tmpdir(), "iscv-chart-studio-data");
}

const SERVER_DIR = resolveServerDir();
const UI_DIR = process.env.ISCV_CHART_UI_DIR
  ? path.resolve(process.env.ISCV_CHART_UI_DIR)
  : path.resolve(SERVER_DIR, "../ui");
const DATA_DIR = parseDataDirArg(process.argv.slice(2));
const EXPORTS_DIR = path.join(DATA_DIR, "exports");
const CACHE_DIR = path.join(DATA_DIR, "cache");

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFileAtomic(targetPath, data) {
  ensureDir(path.dirname(targetPath));
  const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, data);
  fs.renameSync(tmpPath, targetPath);
}

function sanitizeFilename(name, fallback = "iscv_chart") {
  const base = String(name || fallback)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return (base || fallback).slice(0, 80);
}

function readUiHtml(filename) {
  const fullPath = path.join(UI_DIR, filename);
  return fs.readFileSync(fullPath, "utf-8");
}

function formatSummaryText(spec, summary, savedPath, datasetToken) {
  const colStats = summary.numericColumns
    .slice(0, 4)
    .map(c => `${c.header}: min=${c.min}, max=${c.max}, mean=${c.mean}`)
    .join(" | ");
  const lines = [
    `Rendered ${spec.chartName} (${spec.chartId}) using palette "${spec.paletteName}" (${spec.isDark ? "dark" : "light"} card, ${spec.cardWidth}x${spec.cardHeight}).`,
    `Data: ${summary.rowCount} rows x ${summary.colCount} cols (${summary.headers.join(", ")}).`
  ];
  if (colStats) lines.push(`Stats: ${colStats}`);
  if (savedPath) lines.push(`Saved SVG: ${savedPath}`);
  if (datasetToken) {
    lines.push(`Large dataset staged off-trajectory under token "${datasetToken}" (loaded dynamically by the UI).`);
  }
  return lines.join("\n");
}

function buildChartPayload(args = {}) {
  const { spec } = renderChartSvg(args);
  const summary = computeDataSummary(spec.headers, spec.rows);

  let savedPath = null;
  let savedUri = null;
  if (typeof args.saveSvgPath === "string" && args.saveSvgPath.trim()) {
    const rawTarget = args.saveSvgPath.trim();
    const resolved = path.isAbsolute(rawTarget)
      ? path.resolve(rawTarget)
      : path.resolve(EXPORTS_DIR, rawTarget);
    const finalPath = resolved.toLowerCase().endsWith(".svg") ? resolved : `${resolved}.svg`;
    const { svg } = renderChartSvg(spec);
    writeFileAtomic(finalPath, Buffer.from(svg, "utf-8"));
    savedPath = finalPath;
    savedUri = pathToFileURL(finalPath).href;
  }

  let datasetToken = null;
  let finalSpec = spec;
  const candidate = { spec, summary, savedPath, savedUri };
  if (Buffer.byteLength(JSON.stringify(candidate), "utf-8") > MAX_TRAJECTORY_BYTES) {
    datasetToken = `ds_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    ensureDir(CACHE_DIR);
    writeFileAtomic(
      path.join(CACHE_DIR, `${datasetToken}.json`),
      Buffer.from(JSON.stringify({ headers: spec.headers, rows: spec.rows }), "utf-8")
    );
    finalSpec = {
      ...spec,
      rows: spec.rows.slice(0, 60)
    };
  }

  const structuredContent = {
    spec: finalSpec,
    summary,
    savedPath,
    savedUri,
    datasetToken
  };

  return {
    content: [
      {
        type: "text",
        text: formatSummaryText(spec, summary, savedPath, datasetToken)
      }
    ],
    structuredContent
  };
}

const chartInputSchema = {
  chartId: z
    .string()
    .optional()
    .describe("One of the 45 ISCV chart IDs (e.g. 'bar_grouped', 'raincloud_plot', 'sankey_flow', 'correlation_matrix')."),
  headers: z
    .array(z.string())
    .optional()
    .describe("Column headers. First column is usually category/X/source; remaining columns are numeric series or targets."),
  rows: z
    .array(z.array(z.union([z.string(), z.number()])))
    .optional()
    .describe("2D data rows matching headers."),
  rawData: z
    .string()
    .optional()
    .describe("Raw CSV, TSV, or JSON string parsed automatically into headers and rows (alternative to headers/rows)."),
  range: z
    .string()
    .optional()
    .describe("Optional spreadsheet A1 range slice (e.g. 'A1:D10') when rawData is provided."),
  title: z.string().optional().describe("Chart title."),
  subtitle: z.string().optional().describe("Chart subtitle or units description."),
  source: z.string().optional().describe("Footer source caption."),
  paletteId: z
    .string()
    .optional()
    .describe("One of the 14 palette IDs (default 'iscv_swiss_signal', or 'okabe_ito_universal', 'crameri_batlow', etc.)."),
  isDark: z.boolean().optional().describe("Render chart card with dark background (#0B0F19) when true (defaults to false for Light Card)."),
  cardWidth: z.number().optional().describe("Chart SVG width in px (320..2400, default 680)."),
  cardHeight: z.number().optional().describe("Chart SVG height in px (220..1600, default 440)."),
  showHeader: z.boolean().optional().describe("Show title and subtitle header."),
  showLegend: z.boolean().optional().describe("Show legend strip."),
  showGrid: z.boolean().optional().describe("Show plot gridlines."),
  showLabels: z.boolean().optional().describe("Show data labels and ticks."),
  diagonalLabels: z.boolean().optional().describe("Tilt X-axis category labels -35 degrees."),
  showFooter: z.boolean().optional().describe("Show footer source text."),
  saveSvgPath: z
    .string()
    .optional()
    .describe("Optional file path (absolute or relative to plugin export dir) to also write a standalone .svg file.")
};

const RESOURCE_CSP = {
  connectDomains: [],
  resourceDomains: [],
  frameDomains: [],
  baseUriDomains: []
};

export function createIscvChartServer() {
  const server = new McpServer({
    name: "iscv-chart-studio",
    version: "1.0.0"
  });

  // 1. UI Resource: Inline Chat Card
  registerAppResource(
    server,
    "ISCV Inline Chart Card",
    INLINE_URI,
    {
      description: "Compact interactive 45-family SVG chart card rendered inline inside Antigravity chat.",
      _meta: {
        ui: {
          prefersBorder: false,
          csp: RESOURCE_CSP
        }
      }
    },
    async () => ({
      contents: [
        {
          uri: INLINE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: readUiHtml("inline.html"),
          _meta: {
            ui: {
              prefersBorder: false,
              csp: RESOURCE_CSP
            }
          }
        }
      ]
    })
  );

  // 2. UI Resource: Side Panel & Full-Page Studio
  registerAppResource(
    server,
    "ISCV Chart Studio Workstation",
    STUDIO_URI,
    {
      description: "Full interactive 45-family chart workbench with A1 spreadsheet matrix editor and 14 scientific palettes.",
      _meta: {
        ui: {
          prefersBorder: false,
          csp: RESOURCE_CSP
        }
      }
    },
    async () => ({
      contents: [
        {
          uri: STUDIO_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: readUiHtml("studio.html"),
          _meta: {
            ui: {
              prefersBorder: false,
              csp: RESOURCE_CSP
            }
          }
        }
      ]
    })
  );

  // Tool 1: Inline Chart Card (no entrypoints -> renders inline in chat)
  registerAppTool(
    server,
    "iscv_plot_inline",
    {
      title: "Plot Chart Inline (ISCV)",
      description:
        "Render an interactive ISCV scientific chart card inline directly in the conversation across 45 chart families and 14 palettes. Ideal for quick data visualization from CSV/JSON/analysis results.",
      inputSchema: chartInputSchema,
      _meta: {
        ui: {
          resourceUri: INLINE_URI
        }
      }
    },
    async (args = {}) => buildChartPayload(args)
  );

  // Tool 2: Side Panel + Full-Page Studio (aux_pane + global entrypoints)
  registerAppTool(
    server,
    "iscv_open_studio",
    {
      title: "ISCV Chart Studio",
      description:
        "Open or update the full interactive ISCV Chart Studio (45 chart families, editable A1 spreadsheet matrix, 14 scientific palettes, SVG/PNG/JSON/CSV export) in Antigravity's side panel or full-page view.",
      inputSchema: chartInputSchema,
      _meta: {
        ui: {
          resourceUri: STUDIO_URI
        },
        "com.google.antigravity/ui": {
          entrypoints: [
            { type: "aux_pane", title: "ISCV Chart Studio" },
            { type: "global", title: "ISCV Chart Studio" }
          ]
        }
      }
    },
    async (args = {}) => buildChartPayload(args)
  );

  // Tool 3: Catalog Discovery (available to model & app)
  server.registerTool(
    "iscv_chart_catalog",
    {
      title: "ISCV Chart & Palette Catalog",
      description:
        "List all 45 ISCV chart families across 5 packs (Core, Compare, Flow, Stats, Spatial) and all 14 color palettes, with expected column headers and sample row counts.",
      inputSchema: {
        packId: z
          .enum(["pack0", "pack1", "pack2", "pack3", "pack4"])
          .optional()
          .describe("Optional pack filter (pack0=Core, pack1=Compare, pack2=Flow, pack3=Stats, pack4=Spatial)."),
        query: z.string().optional().describe("Optional case-insensitive keyword filter on chart ID, name, or badge.")
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async (args = {}) => {
      const q = typeof args.query === "string" ? args.query.trim().toLowerCase() : "";
      let charts = ISCV_CHART_CATALOG;
      if (args.packId) {
        charts = charts.filter(c => c.packId === args.packId);
      }
      if (q) {
        charts = charts.filter(
          c =>
            c.id.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            (c.badge && c.badge.toLowerCase().includes(q)) ||
            (c.subtitle && c.subtitle.toLowerCase().includes(q))
        );
      }

      const compactCharts = charts.map(c => ({
        id: c.id,
        packId: c.packId,
        name: c.name,
        badge: c.badge,
        headers: c.headers,
        sampleRowCount: c.rows.length
      }));
      const compactPalettes = ISCV_PALETTES.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category
      }));

      const lines = [
        `ISCV Chart Catalog: ${compactCharts.length} chart families, ${compactPalettes.length} palettes.`,
        ...compactCharts.map(c => `- ${c.id} [${c.packId}] (${c.name}): headers=[${c.headers.join(", ")}]`),
        `Palettes: ${compactPalettes.map(p => p.id).join(", ")}`
      ];

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        structuredContent: {
          packs: ISCV_PACKS,
          charts: compactCharts,
          palettes: compactPalettes
        }
      };
    }
  );

  // Tool 4: Export / Save Chart to Disk (app-only in UI, safe fallback if called by CLI model)
  server.registerTool(
    "iscv_save_export",
    {
      title: "Save Chart Export",
      description:
        "Save an ISCV chart export (.svg, .png, .json spec, or .csv data) atomically to disk. Used by the Chart Studio UI export buttons.",
      inputSchema: {
        format: z.enum(["svg", "png", "json", "csv"]).optional().describe("Export format: svg, png, json, or csv."),
        filename: z.string().optional().describe("Output filename without extension."),
        outputDir: z.string().optional().describe("Optional absolute directory path; defaults to plugin data exports folder."),
        spec: z.record(z.string(), z.unknown()).optional().describe("Chart specification object."),
        pngBase64: z.string().optional().describe("Base64 PNG data (required when format is png).")
      },
      _meta: {
        ui: {
          visibility: ["app"]
        }
      }
    },
    async (args = {}) => {
      const format = args.format || "svg";
      const targetDir =
        typeof args.outputDir === "string" && args.outputDir.trim() && path.isAbsolute(args.outputDir.trim())
          ? path.resolve(args.outputDir.trim())
          : EXPORTS_DIR;

      const normalizedSpec = args.spec ? normalizeChartSpec(args.spec) : null;
      const baseName = sanitizeFilename(args.filename || (normalizedSpec ? normalizedSpec.chartId : "iscv_chart"));
      const finalPath = path.join(targetDir, `${baseName}.${format}`);

      let payloadBuf;
      if (format === "svg") {
        if (!args.spec) {
          return {
            isError: true,
            content: [{ type: "text", text: "Missing required `spec` object for SVG export." }]
          };
        }
        const { svg } = renderChartSvg(normalizedSpec);
        payloadBuf = Buffer.from(svg, "utf-8");
      } else if (format === "json") {
        if (!args.spec) {
          return {
            isError: true,
            content: [{ type: "text", text: "Missing required `spec` object for JSON export." }]
          };
        }
        payloadBuf = Buffer.from(JSON.stringify(normalizedSpec, null, 2), "utf-8");
      } else if (format === "csv") {
        if (!args.spec) {
          return {
            isError: true,
            content: [{ type: "text", text: "Missing required `spec` object for CSV export." }]
          };
        }
        const csv = renderer.toCsvString(normalizedSpec.headers, normalizedSpec.rows);
        payloadBuf = Buffer.from(csv, "utf-8");
      } else if (format === "png") {
        const rawB64 = typeof args.pngBase64 === "string" ? args.pngBase64.trim() : "";
        if (!rawB64) {
          return {
            isError: true,
            content: [{ type: "text", text: "Missing required `pngBase64` data for PNG export." }]
          };
        }
        const stripped = rawB64.replace(/^data:image\/png;base64,/i, "");
        payloadBuf = Buffer.from(stripped, "base64");
        if (payloadBuf.length === 0 || payloadBuf.length > MAX_EXPORT_BYTES) {
          return {
            isError: true,
            content: [{ type: "text", text: `Invalid or oversized PNG payload (${payloadBuf.length} bytes).` }]
          };
        }
      } else {
        return {
          isError: true,
          content: [{ type: "text", text: `Unsupported export format: ${String(format)}` }]
        };
      }

      writeFileAtomic(finalPath, payloadBuf);
      const fileUri = pathToFileURL(finalPath).href;

      return {
        content: [{ type: "text", text: `Exported ${format.toUpperCase()} (${payloadBuf.length} bytes) to ${finalPath}` }],
        structuredContent: {
          ok: true,
          format,
          path: finalPath,
          fileUri,
          bytes: payloadBuf.length
        }
      };
    }
  );

  // Tool 5: Load staged large dataset (>800 KB off-trajectory cache) for the UI
  server.registerTool(
    "iscv_load_dataset",
    {
      title: "Load Staged Dataset",
      description: "Load a large staged chart dataset by token when dataset size exceeded the 1 MiB trajectory cap.",
      inputSchema: {
        datasetToken: z.string().optional().describe("Staged dataset token returned by iscv_plot_inline or iscv_open_studio.")
      },
      _meta: {
        ui: {
          visibility: ["app"]
        }
      },
      annotations: {
        readOnlyHint: true
      }
    },
    async (args = {}) => {
      const token = typeof args.datasetToken === "string" ? args.datasetToken.trim() : "";
      if (!token || !/^ds_[a-zA-Z0-9_]+$/.test(token)) {
        return {
          isError: true,
          content: [{ type: "text", text: "Invalid or missing datasetToken." }]
        };
      }
      const cacheFile = path.join(CACHE_DIR, `${token}.json`);
      if (!fs.existsSync(cacheFile)) {
        return {
          isError: true,
          content: [{ type: "text", text: `Dataset token "${token}" not found.` }]
        };
      }
      const parsed = JSON.parse(fs.readFileSync(cacheFile, "utf-8"));
      return {
        content: [{ type: "text", text: `Loaded staged dataset ${token} (${parsed.rows?.length || 0} rows).` }],
        structuredContent: parsed
      };
    }
  );

  return server;
}

async function startStdioServer() {
  const server = createIscvChartServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isCjsMain = typeof require === "function" && typeof module !== "undefined" && require.main === module;
const isEsmMain =
  typeof require === "undefined" &&
  Boolean(import.meta.url) &&
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if ((isCjsMain || isEsmMain) && !process.env.ISCV_NO_AUTOSTART) {
  startStdioServer().catch((err) => {
    console.error("[iscv-chart-studio] fatal server error:", err);
    process.exit(1);
  });
}
