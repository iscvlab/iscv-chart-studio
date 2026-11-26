import {
  ISCV_PACKS,
  ISCV_CHART_CATALOG,
  getChartPresetById,
  normalizeChartSpec,
  renderChartSvg,
  initMcpApp,
  exportChartArtifact,
  openFileInAuxPane,
  copySvgToClipboard,
  populateChartAndPaletteSelects,
  bindSvgTooltips
} from "./shared_bridge.js";
import { getChartMiniIconSvg } from "./chart_icons.js";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const appRoot = document.getElementById("app");
appRoot.innerHTML = `
  <div class="inline-shell">
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="brand-pill"><span class="brand-dot"></span>ISCV</span>
        <button id="btnChartPicker" class="chart-picker-btn" type="button" aria-haspopup="true" aria-expanded="false" title="Choose Chart Type (45 Families)">
          <span id="pickerIcon" class="picker-icon"></span>
          <span id="pickerLabel" class="picker-label">Grouped Column Bar</span>
          <span class="picker-caret" aria-hidden="true">&#9662;</span>
        </button>
        <select id="selPalette" aria-label="Color Palette"></select>
      </div>
      <div class="toolbar-right">
        <button id="btnDark" class="icon-chip" type="button" title="Toggle Light/Dark Chart Card">Light Card</button>
        <button id="btnGrid" class="icon-chip active" type="button">Grid</button>
        <button id="btnLabels" class="icon-chip active" type="button">Labels</button>
        <button id="btnLegend" class="icon-chip active" type="button">Legend</button>
      </div>
    </div>

    <div id="stageWrap" class="stage-wrap">
      <div id="svgHost" style="width:100%"></div>
      <div id="chartPopover" class="chart-popover" hidden>
        <div class="popover-head">
          <div id="inlinePackPills" class="popover-packs"></div>
          <button id="btnClosePopover" type="button" class="icon-chip" aria-label="Close chart picker">✕</button>
        </div>
        <div id="inlineChartGrid" class="inline-chart-grid"></div>
      </div>
      <div id="tooltip" class="tooltip-pill" hidden></div>
    </div>

    <div id="toast" class="toast" hidden>
      <span id="toastText"></span>
      <button id="btnToastOpen" class="toast-link" type="button" hidden>Open File</button>
    </div>

    <div class="footer-bar">
      <span id="metaBadge" class="meta-badge">Loading...</span>
      <div class="actions-row">
        <button id="btnSaveSvg" type="button">Save SVG</button>
        <button id="btnSavePng" type="button">Save PNG</button>
        <button id="btnCopySvg" type="button">Copy SVG</button>
        <button id="btnAttach" type="button" hidden>Attach Spec</button>
        <button id="btnOpenStudio" class="primary" type="button" hidden>Open Studio</button>
      </div>
    </div>
  </div>
`;

const btnChartPicker = document.getElementById("btnChartPicker");
const pickerIcon = document.getElementById("pickerIcon");
const pickerLabel = document.getElementById("pickerLabel");
const chartPopover = document.getElementById("chartPopover");
const inlinePackPills = document.getElementById("inlinePackPills");
const inlineChartGrid = document.getElementById("inlineChartGrid");
const btnClosePopover = document.getElementById("btnClosePopover");
const selPalette = document.getElementById("selPalette");
const btnDark = document.getElementById("btnDark");
const btnGrid = document.getElementById("btnGrid");
const btnLabels = document.getElementById("btnLabels");
const btnLegend = document.getElementById("btnLegend");
const stageWrap = document.getElementById("stageWrap");
const svgHost = document.getElementById("svgHost");
const tooltip = document.getElementById("tooltip");
const metaBadge = document.getElementById("metaBadge");
const toastEl = document.getElementById("toast");
const toastText = document.getElementById("toastText");
const btnToastOpen = document.getElementById("btnToastOpen");
const btnSaveSvg = document.getElementById("btnSaveSvg");
const btnSavePng = document.getElementById("btnSavePng");
const btnCopySvg = document.getElementById("btnCopySvg");
const btnAttach = document.getElementById("btnAttach");
const btnOpenStudio = document.getElementById("btnOpenStudio");

populateChartAndPaletteSelects(null, selPalette);
bindSvgTooltips(stageWrap, tooltip);

let state = normalizeChartSpec({});
let usingPresetSample = true;
let activePopoverPack = "all";
let lastSvg = "";
let mcpBridge = { app: null, caps: {} };
let toastTimer = null;

function showToast(msg, kind = "success", fileUri = null) {
  toastText.textContent = msg;
  toastEl.setAttribute("data-kind", kind);
  toastEl.hidden = false;
  if (fileUri) {
    btnToastOpen.hidden = false;
    btnToastOpen.onclick = () => openFileInAuxPane(mcpBridge.app, fileUri);
  } else {
    btnToastOpen.hidden = true;
    btnToastOpen.onclick = null;
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 5500);
}

function renderPopoverPackPills() {
  inlinePackPills.innerHTML = "";
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = `popover-pack-pill ${activePopoverPack === "all" ? "active" : ""}`;
  allBtn.textContent = "All (45)";
  allBtn.onclick = () => {
    activePopoverPack = "all";
    renderPopoverPackPills();
    renderInlineChartGrid();
  };
  inlinePackPills.appendChild(allBtn);

  for (const pack of ISCV_PACKS) {
    const count = ISCV_CHART_CATALOG.filter(c => c.packId === pack.id).length;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `popover-pack-pill ${activePopoverPack === pack.id ? "active" : ""}`;
    btn.textContent = `${pack.shortLabel} (${count})`;
    btn.onclick = () => {
      activePopoverPack = pack.id;
      renderPopoverPackPills();
      renderInlineChartGrid();
    };
    inlinePackPills.appendChild(btn);
  }
}

function selectInlineChart(nextId) {
  if (usingPresetSample) {
    const preset = getChartPresetById(nextId);
    state = normalizeChartSpec({
      ...state,
      chartId: preset.id,
      title: preset.title,
      subtitle: preset.subtitle,
      source: preset.source,
      headers: preset.headers,
      rows: preset.rows
    });
  } else {
    state = normalizeChartSpec({ ...state, chartId: nextId });
  }
  closePopover();
  render();
}

function renderInlineChartGrid() {
  const list =
    activePopoverPack === "all"
      ? ISCV_CHART_CATALOG
      : ISCV_CHART_CATALOG.filter(c => c.packId === activePopoverPack);
  inlineChartGrid.innerHTML = "";
  for (const ch of list) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.chartId = ch.id;
    btn.className = `inline-chart-tile ${state.chartId === ch.id ? "active" : ""}`;
    btn.title = `${ch.name} (${ch.id})`;
    btn.innerHTML = `
      <span class="inline-tile-icon">${getChartMiniIconSvg(ch.id)}</span>
      <span class="inline-tile-title">${escapeHtml(ch.name)}</span>
    `;
    btn.onclick = () => selectInlineChart(ch.id);
    inlineChartGrid.appendChild(btn);
  }
}

function openPopover() {
  renderPopoverPackPills();
  renderInlineChartGrid();
  chartPopover.hidden = false;
  btnChartPicker.classList.add("active");
  btnChartPicker.setAttribute("aria-expanded", "true");
}

function closePopover() {
  if (chartPopover.hidden) return;
  chartPopover.hidden = true;
  btnChartPicker.classList.remove("active");
  btnChartPicker.setAttribute("aria-expanded", "false");
}

btnChartPicker.addEventListener("click", (ev) => {
  ev.stopPropagation();
  if (chartPopover.hidden) {
    openPopover();
  } else {
    closePopover();
  }
});

btnClosePopover.addEventListener("click", (ev) => {
  ev.stopPropagation();
  closePopover();
});

document.addEventListener("click", (ev) => {
  if (chartPopover.hidden) return;
  const target = ev.target;
  if (target instanceof Node && !chartPopover.contains(target) && !btnChartPicker.contains(target)) {
    closePopover();
  }
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") closePopover();
});

function syncUiFromState() {
  const preset = getChartPresetById(state.chartId);
  pickerIcon.innerHTML = getChartMiniIconSvg(state.chartId);
  pickerLabel.textContent = preset.name;
  selPalette.value = state.paletteId;
  btnDark.classList.toggle("active", Boolean(state.isDark));
  btnDark.textContent = state.isDark ? "Dark Card" : "Light Card";
  btnGrid.classList.toggle("active", Boolean(state.showGrid));
  btnLabels.classList.toggle("active", Boolean(state.showLabels));
  btnLegend.classList.toggle("active", Boolean(state.showLegend));
  metaBadge.textContent = `${state.chartId} | ${state.rows.length}x${state.headers.length} | ${state.cardWidth}x${state.cardHeight}`;
  for (const tile of inlineChartGrid.querySelectorAll(".inline-chart-tile")) {
    tile.classList.toggle("active", tile.dataset.chartId === state.chartId);
  }
}

function render() {
  const rendered = renderChartSvg(state);
  state = rendered.spec;
  lastSvg = rendered.svg;
  svgHost.innerHTML = lastSvg;
  syncUiFromState();
}

selPalette.addEventListener("change", () => {
  state = normalizeChartSpec({ ...state, paletteId: selPalette.value });
  render();
});

btnDark.addEventListener("click", () => {
  state = normalizeChartSpec({ ...state, isDark: !state.isDark });
  render();
});

btnGrid.addEventListener("click", () => {
  state = normalizeChartSpec({ ...state, showGrid: !state.showGrid });
  render();
});

btnLabels.addEventListener("click", () => {
  state = normalizeChartSpec({ ...state, showLabels: !state.showLabels });
  render();
});

btnLegend.addEventListener("click", () => {
  state = normalizeChartSpec({ ...state, showLegend: !state.showLegend });
  render();
});

btnSaveSvg.addEventListener("click", () => {
  exportChartArtifact({
    app: mcpBridge.app,
    caps: mcpBridge.caps,
    format: "svg",
    spec: state,
    svgText: lastSvg,
    onToast: showToast
  });
});

btnSavePng.addEventListener("click", () => {
  exportChartArtifact({
    app: mcpBridge.app,
    caps: mcpBridge.caps,
    format: "png",
    spec: state,
    svgText: lastSvg,
    onToast: showToast
  });
});

btnCopySvg.addEventListener("click", () => {
  copySvgToClipboard(lastSvg, showToast);
});

btnAttach.addEventListener("click", async () => {
  if (!mcpBridge.app || !mcpBridge.caps?.updateModelContext) return;
  try {
    await mcpBridge.app.updateModelContext({
      content: [
        {
          type: "text",
          text: `ISCV Chart Spec (${state.chartId}, ${state.paletteId}):\n${JSON.stringify(state)}`
        }
      ],
      structuredContent: { spec: state }
    });
    showToast("Attached chart spec to your next prompt", "success");
  } catch (err) {
    showToast(`Attach failed: ${err?.message || String(err)}`, "error");
  }
});

btnOpenStudio.addEventListener("click", async () => {
  if (!mcpBridge.app || !mcpBridge.caps?.message) return;
  try {
    const studioArgs = {
      chartId: state.chartId,
      paletteId: state.paletteId,
      isDark: Boolean(state.isDark),
      title: state.title,
      subtitle: state.subtitle,
      source: state.source,
      cardWidth: state.cardWidth,
      cardHeight: state.cardHeight,
      showHeader: Boolean(state.showHeader),
      showLegend: Boolean(state.showLegend),
      showGrid: Boolean(state.showGrid),
      showLabels: Boolean(state.showLabels),
      diagonalLabels: Boolean(state.diagonalLabels),
      showFooter: Boolean(state.showFooter),
      headers: state.headers,
      rows: state.rows
    };
    await mcpBridge.app.sendMessage({
      role: "user",
      content: [
        {
          type: "text",
          text: `Open this chart in ISCV Chart Studio (call iscv_open_studio with exact arguments):\n${JSON.stringify(studioArgs)}`
        }
      ]
    });
    showToast("Requested Studio side panel", "success");
  } catch (err) {
    showToast(`Open Studio failed: ${err?.message || String(err)}`, "error");
  }
});

// Initial optimistic render before connect settles
render();

async function boot() {
  mcpBridge = await initMcpApp({
    name: "ISCV Inline Chart Card",
    version: "1.0.0",
    autoResize: true,
    onToolInput: (args) => {
      if (args && Object.keys(args).length > 0) {
        if (args.headers || args.rows || args.rawData || args.title) {
          usingPresetSample = false;
        }
        state = normalizeChartSpec(args);
        render();
      }
    },
    onToolResult: (_result, sc) => {
      if (sc?.spec) {
        const def = getChartPresetById(sc.spec.chartId);
        const sameAsDefault =
          JSON.stringify(sc.spec.rows) === JSON.stringify(def.rows) &&
          JSON.stringify(sc.spec.headers) === JSON.stringify(def.headers) &&
          sc.spec.title === def.title;
        usingPresetSample = sameAsDefault;
        state = normalizeChartSpec(sc.spec);
        render();
      }
      if (sc?.savedPath) {
        showToast(`Saved SVG → ${sc.savedPath}`, "success", sc.savedUri || null);
      }
    },
    onToolCancelled: (params) => {
      showToast(`Cancelled: ${params?.reason || "tool aborted"}`, "warn");
    }
  });

  if (mcpBridge.caps?.updateModelContext) {
    btnAttach.hidden = false;
  }
  if (mcpBridge.caps?.message) {
    btnOpenStudio.hidden = false;
  }
}

boot();
