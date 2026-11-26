import {
  ISCV_PACKS,
  ISCV_CHART_CATALOG,
  getChartPresetById,
  ISCV_PALETTES,
  parseTabularInput,
  normalizeChartSpec,
  renderChartSvg,
  computeDataSummary,
  initMcpApp,
  exportChartArtifact,
  openFileInAuxPane,
  copySvgToClipboard,
  bindSvgTooltips
} from "./shared_bridge.js";
import { getChartMiniIconSvg } from "./chart_icons.js";

const appRoot = document.getElementById("app");
appRoot.innerHTML = `
  <div class="studio-root">
    <header class="topbar">
      <div class="topbar-left">
        <div class="brand">
          <span class="brand-mark">IS</span>
          <span>ISCV Chart Studio</span>
        </div>
        <span id="topMeta" class="topbar-meta">45 Families • 14 Palettes</span>
      </div>
      <div class="topbar-controls">
        <div class="zoom-group" role="group" aria-label="Stage Zoom">
          <button id="btnZoomOut" class="zoom-pill" type="button" title="Zoom Out">−</button>
          <button id="btnZoomFit" class="zoom-pill active" type="button" title="Fit Chart to Stage">Fit</button>
          <button id="btnZoom100" class="zoom-pill" type="button" title="Actual Size 100%">100%</button>
          <button id="btnZoomIn" class="zoom-pill" type="button" title="Zoom In">+</button>
        </div>
        <button id="btnTopCardTheme" class="top-chip" type="button" title="Toggle Light/Dark Chart Card">Light Card</button>
        <button id="btnTogglePanel" class="top-chip" type="button" aria-expanded="true">Hide Panel</button>
      </div>
    </header>

    <div id="workspaceGrid" class="workspace-grid">
      <aside class="left-pane">
        <div class="tabs-bar">
          <button id="tabBtnCharts" class="tab-btn active" type="button">Charts (45)</button>
          <button id="tabBtnData" class="tab-btn" type="button">Data (A1)</button>
          <button id="tabBtnStyle" class="tab-btn" type="button">Style</button>
        </div>

        <div class="tab-body">
          <!-- TAB 1: CHARTS -->
          <section id="tabCharts" class="stack">
            <div class="row-between">
              <input id="chartSearch" type="text" placeholder="Search 45 chart families..." />
              <button id="btnLoadSample" type="button" title="Replace data table with this chart's sample dataset">Sample</button>
            </div>
            <div id="packPills" class="pack-pills"></div>
            <div id="chartList" class="chart-list"></div>
          </section>

          <!-- TAB 2: DATA MATRIX -->
          <section id="tabData" class="stack" hidden>
            <div class="table-toolbar">
              <button id="btnAddRow" type="button">+Row</button>
              <button id="btnDelRow" type="button">-Row</button>
              <button id="btnAddCol" type="button">+Col</button>
              <button id="btnDelCol" type="button">-Col</button>
              <button id="btnTranspose" type="button">Transpose</button>
              <button id="btnSortAsc" type="button">Sort ↑</button>
              <button id="btnSortDesc" type="button">Sort ↓</button>
              <button id="btnResetData" type="button">Reset</button>
            </div>

            <div class="matrix-scroll">
              <table id="dataMatrix" class="matrix"></table>
            </div>

            <div class="field-group">
              <div class="row-between">
                <span class="field-label">Paste CSV / TSV / JSON</span>
                <input id="a1Range" type="text" placeholder="Optional A1 e.g. A1:D8" style="width:130px" />
              </div>
              <textarea id="pasteBox" rows="3" placeholder="Paste Excel/Sheets cells directly in table or paste CSV/TSV/JSON here..."></textarea>
              <button id="btnApplyPaste" type="button">Apply Pasted Data</button>
            </div>
          </section>

          <!-- TAB 3: STYLE -->
          <section id="tabStyle" class="stack" hidden>
            <div class="field-group">
              <span class="field-label">Chart Title</span>
              <input id="inpTitle" type="text" />
            </div>
            <div class="field-group">
              <span class="field-label">Subtitle / Units</span>
              <input id="inpSubtitle" type="text" />
            </div>
            <div class="field-group">
              <span class="field-label">Footer Source</span>
              <input id="inpSource" type="text" />
            </div>

            <div class="field-group">
              <div class="row-between">
                <span class="field-label">Canvas Size &amp; Theme</span>
                <button id="btnCardTheme" type="button">Light Card</button>
              </div>
              <div class="grid-2">
                <input id="inpWidth" type="number" min="320" max="2400" step="10" />
                <input id="inpHeight" type="number" min="220" max="1600" step="10" />
              </div>
              <div class="pack-pills">
                <button class="size-preset" data-w="600" data-h="380" type="button">600×380</button>
                <button class="size-preset" data-w="720" data-h="440" type="button">720×440</button>
                <button class="size-preset" data-w="960" data-h="540" type="button">960×540</button>
                <button class="size-preset" data-w="600" data-h="600" type="button">600×600</button>
              </div>
            </div>

            <div class="field-group">
              <span class="field-label">Display Elements</span>
              <div class="toggles-grid">
                <button id="togHeader" type="button" class="active">Header</button>
                <button id="togLegend" type="button" class="active">Legend</button>
                <button id="togGrid" type="button" class="active">Grid</button>
                <button id="togLabels" type="button" class="active">Labels</button>
                <button id="togDiag" type="button">Diagonal X</button>
                <button id="togFooter" type="button" class="active">Footer</button>
              </div>
            </div>

            <div class="field-group">
              <span class="field-label">Color Palettes (14 Scientific Palettes)</span>
              <div id="paletteList" class="palette-grid"></div>
            </div>
          </section>
        </div>
      </aside>

      <div id="splitter" class="splitter" role="separator" aria-orientation="vertical" aria-label="Resize inspector panel"></div>

      <main class="right-pane">
        <div id="stageViewport" class="stage-viewport">
          <div id="stageFrame" class="stage-frame">
            <div id="svgHost"></div>
          </div>
          <div id="tooltip" class="tooltip-pill" hidden></div>
        </div>

        <footer class="stage-footer">
          <div id="toast" class="toast" hidden>
            <span id="toastText"></span>
            <button id="btnToastOpen" type="button" hidden>Open File</button>
          </div>
          <div id="statsStrip" class="stats-strip"></div>
          <div class="export-bar">
            <div class="btn-group">
              <button id="btnSaveSvg" class="primary" type="button">Save SVG</button>
              <button id="btnSavePng" type="button">Save PNG (2×)</button>
              <button id="btnSaveCsv" type="button">Save CSV</button>
              <button id="btnSaveJson" type="button">Save JSON</button>
              <button id="btnCopySvg" type="button">Copy SVG</button>
            </div>
            <div class="btn-group">
              <button id="btnAttach" type="button" hidden>Attach to Prompt</button>
              <button id="btnAskAgent" type="button" hidden>Ask Agent</button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  </div>
`;

const els = {
  topMeta: document.getElementById("topMeta"),
  btnZoomOut: document.getElementById("btnZoomOut"),
  btnZoomFit: document.getElementById("btnZoomFit"),
  btnZoom100: document.getElementById("btnZoom100"),
  btnZoomIn: document.getElementById("btnZoomIn"),
  btnTopCardTheme: document.getElementById("btnTopCardTheme"),
  btnTogglePanel: document.getElementById("btnTogglePanel"),
  workspaceGrid: document.getElementById("workspaceGrid"),
  splitter: document.getElementById("splitter"),
  tabBtns: {
    charts: document.getElementById("tabBtnCharts"),
    data: document.getElementById("tabBtnData"),
    style: document.getElementById("tabBtnStyle")
  },
  tabs: {
    charts: document.getElementById("tabCharts"),
    data: document.getElementById("tabData"),
    style: document.getElementById("tabStyle")
  },
  chartSearch: document.getElementById("chartSearch"),
  btnLoadSample: document.getElementById("btnLoadSample"),
  packPills: document.getElementById("packPills"),
  chartList: document.getElementById("chartList"),
  dataMatrix: document.getElementById("dataMatrix"),
  pasteBox: document.getElementById("pasteBox"),
  a1Range: document.getElementById("a1Range"),
  btnApplyPaste: document.getElementById("btnApplyPaste"),
  inpTitle: document.getElementById("inpTitle"),
  inpSubtitle: document.getElementById("inpSubtitle"),
  inpSource: document.getElementById("inpSource"),
  btnCardTheme: document.getElementById("btnCardTheme"),
  inpWidth: document.getElementById("inpWidth"),
  inpHeight: document.getElementById("inpHeight"),
  togHeader: document.getElementById("togHeader"),
  togLegend: document.getElementById("togLegend"),
  togGrid: document.getElementById("togGrid"),
  togLabels: document.getElementById("togLabels"),
  togDiag: document.getElementById("togDiag"),
  togFooter: document.getElementById("togFooter"),
  paletteList: document.getElementById("paletteList"),
  stageViewport: document.getElementById("stageViewport"),
  stageFrame: document.getElementById("stageFrame"),
  svgHost: document.getElementById("svgHost"),
  tooltip: document.getElementById("tooltip"),
  statsStrip: document.getElementById("statsStrip"),
  toast: document.getElementById("toast"),
  toastText: document.getElementById("toastText"),
  btnToastOpen: document.getElementById("btnToastOpen"),
  btnSaveSvg: document.getElementById("btnSaveSvg"),
  btnSavePng: document.getElementById("btnSavePng"),
  btnSaveCsv: document.getElementById("btnSaveCsv"),
  btnSaveJson: document.getElementById("btnSaveJson"),
  btnCopySvg: document.getElementById("btnCopySvg"),
  btnAttach: document.getElementById("btnAttach"),
  btnAskAgent: document.getElementById("btnAskAgent")
};

bindSvgTooltips(els.stageViewport, els.tooltip);

let state = normalizeChartSpec({});
let usingPresetSample = true;
let activePackFilter = "all";
let lastSvg = "";
let mcpBridge = { app: null, caps: {} };
let toastTimer = null;
let zoomMode = "fit";
let zoomFactor = 1.0;
let currentFitScale = 1.0;
let inspectorCollapsed = false;
let chartRafId = 0;

function showToast(msg, kind = "success", fileUri = null) {
  els.toastText.textContent = msg;
  els.toast.setAttribute("data-kind", kind);
  els.toast.hidden = false;
  if (fileUri) {
    els.btnToastOpen.hidden = false;
    els.btnToastOpen.onclick = () => openFileInAuxPane(mcpBridge.app, fileUri);
  } else {
    els.btnToastOpen.hidden = true;
    els.btnToastOpen.onclick = null;
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 5500);
}

function syncZoomControls() {
  els.btnZoomFit.classList.toggle("active", zoomMode === "fit");
  els.btnZoom100.classList.toggle("active", zoomMode === "manual" && Math.abs(zoomFactor - 1.0) < 0.01);
  const pct = Math.round((zoomMode === "fit" ? currentFitScale : zoomFactor) * 100);
  els.btnZoomFit.title = `Fit Chart to Stage (${pct}%)`;
}

function fitStage() {
  const vp = els.stageViewport;
  const frame = els.stageFrame;
  if (!vp || !frame) return;

  const cardW = Math.max(120, Number(state.cardWidth) || 680);
  const cardH = Math.max(90, Number(state.cardHeight) || 440);
  const availW = Math.max(120, vp.clientWidth - 20);
  const availH = Math.max(90, vp.clientHeight - 20);
  const fitScale = Math.min(availW / cardW, availH / cardH);
  currentFitScale = fitScale;

  let targetW;
  let targetH;
  if (zoomMode === "fit") {
    vp.style.overflow = "hidden";
    vp.classList.remove("is-manual-zoom");
    targetW = Math.max(120, Math.floor(cardW * fitScale));
    targetH = Math.max(90, Math.floor(cardH * fitScale));
  } else {
    vp.style.overflow = "auto";
    vp.classList.add("is-manual-zoom");
    targetW = Math.max(120, Math.round(cardW * zoomFactor));
    targetH = Math.max(90, Math.round(cardH * zoomFactor));
  }

  const wStr = `${targetW}px`;
  const hStr = `${targetH}px`;
  if (frame.style.width !== wStr) frame.style.width = wStr;
  if (frame.style.height !== hStr) frame.style.height = hStr;

  const svgEl = els.svgHost.querySelector("svg");
  if (svgEl) {
    svgEl.style.width = "100%";
    svgEl.style.height = "100%";
    svgEl.style.display = "block";
  }
  syncZoomControls();
}

function switchTab(name) {
  for (const key of ["charts", "data", "style"]) {
    els.tabBtns[key].classList.toggle("active", key === name);
    els.tabs[key].hidden = key !== name;
  }
}

els.tabBtns.charts.addEventListener("click", () => switchTab("charts"));
els.tabBtns.data.addEventListener("click", () => switchTab("data"));
els.tabBtns.style.addEventListener("click", () => switchTab("style"));

// Topbar Zoom, Card Theme & Panel Collapse
els.btnZoomFit.addEventListener("click", () => {
  zoomMode = "fit";
  fitStage();
});

els.btnZoom100.addEventListener("click", () => {
  zoomMode = "manual";
  zoomFactor = 1.0;
  fitStage();
});

els.btnZoomOut.addEventListener("click", () => {
  const base = zoomMode === "fit" ? currentFitScale : zoomFactor;
  zoomMode = "manual";
  zoomFactor = Math.max(0.25, Math.round((base - 0.15) * 100) / 100);
  fitStage();
});

els.btnZoomIn.addEventListener("click", () => {
  const base = zoomMode === "fit" ? currentFitScale : zoomFactor;
  zoomMode = "manual";
  zoomFactor = Math.min(3.0, Math.round((base + 0.15) * 100) / 100);
  fitStage();
});

els.btnTopCardTheme.addEventListener("click", () => {
  state = normalizeChartSpec({ ...state, isDark: !state.isDark });
  renderChartAndStyle();
});

els.btnTogglePanel.addEventListener("click", () => {
  inspectorCollapsed = !inspectorCollapsed;
  els.workspaceGrid.classList.toggle("inspector-collapsed", inspectorCollapsed);
  els.btnTogglePanel.textContent = inspectorCollapsed ? "Show Panel" : "Hide Panel";
  els.btnTogglePanel.classList.toggle("active", inspectorCollapsed);
  els.btnTogglePanel.setAttribute("aria-expanded", String(!inspectorCollapsed));
  requestAnimationFrame(fitStage);
});

// Draggable Wide-Mode Splitter
(function initSplitter() {
  let activePointerId = null;

  els.splitter.addEventListener("pointerdown", (ev) => {
    if (window.innerWidth <= 820 || inspectorCollapsed) return;
    activePointerId = ev.pointerId;
    els.splitter.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    try {
      els.splitter.setPointerCapture(ev.pointerId);
    } catch (_) {
      // Ignore capture errors in synthetic test environments
    }
    ev.preventDefault();
  });

  els.splitter.addEventListener("pointermove", (ev) => {
    if (activePointerId !== ev.pointerId) return;
    const gridRect = els.workspaceGrid.getBoundingClientRect();
    const gridW = gridRect.width;
    const maxW = Math.max(260, Math.min(440, gridW - 360));
    const rawW = ev.clientX - gridRect.left;
    const clampedW = Math.round(Math.max(260, Math.min(maxW, rawW)));
    els.workspaceGrid.style.setProperty("--inspector-w", `${clampedW}px`);
    fitStage();
  });

  function stopDrag(ev) {
    if (activePointerId !== ev.pointerId) return;
    activePointerId = null;
    els.splitter.classList.remove("dragging");
    document.body.style.cursor = "";
    try {
      if (els.splitter.hasPointerCapture(ev.pointerId)) {
        els.splitter.releasePointerCapture(ev.pointerId);
      }
    } catch (_) {
      // Ignore release errors
    }
  }

  els.splitter.addEventListener("pointerup", stopDrag);
  els.splitter.addEventListener("pointercancel", stopDrag);
})();

function syncActiveSelectionClasses() {
  for (const btn of els.chartList.querySelectorAll(".chart-card")) {
    btn.classList.toggle("active", btn.dataset.chartId === state.chartId);
  }
  for (const btn of els.paletteList.querySelectorAll(".palette-btn")) {
    btn.classList.toggle("active", btn.dataset.paletteId === state.paletteId);
  }
}

function updatePaletteSwatches() {
  for (const btn of els.paletteList.querySelectorAll(".palette-btn")) {
    const pal = ISCV_PALETTES.find(p => p.id === btn.dataset.paletteId);
    if (!pal) continue;
    const colors = state.isDark ? pal.darkColors : pal.lightColors;
    const dots = btn.querySelectorAll(".swatch-dot");
    dots.forEach((dot, i) => {
      if (colors[i]) dot.style.background = colors[i];
    });
  }
}

function renderPackPills() {
  els.packPills.innerHTML = "";
  const allBtn = document.createElement("button");
  allBtn.type = "button";
  allBtn.className = `pack-pill ${activePackFilter === "all" ? "active" : ""}`;
  allBtn.textContent = "All (45)";
  allBtn.onclick = () => {
    activePackFilter = "all";
    renderPackPills();
    renderChartList();
  };
  els.packPills.appendChild(allBtn);

  for (const pack of ISCV_PACKS) {
    const count = ISCV_CHART_CATALOG.filter(c => c.packId === pack.id).length;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `pack-pill ${activePackFilter === pack.id ? "active" : ""}`;
    btn.textContent = `${pack.shortLabel} (${count})`;
    btn.onclick = () => {
      activePackFilter = pack.id;
      renderPackPills();
      renderChartList();
    };
    els.packPills.appendChild(btn);
  }
}

function renderChartList() {
  const q = els.chartSearch.value.trim().toLowerCase();
  const filtered = ISCV_CHART_CATALOG.filter(c => {
    if (activePackFilter !== "all" && c.packId !== activePackFilter) return false;
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      (c.badge && c.badge.toLowerCase().includes(q)) ||
      (c.subtitle && c.subtitle.toLowerCase().includes(q))
    );
  });

  els.chartList.innerHTML = "";
  for (const ch of filtered) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.chartId = ch.id;
    btn.title = `${ch.name} (${ch.id} • ${ch.headers.length} cols)`;
    btn.className = `chart-card ${state.chartId === ch.id ? "active" : ""}`;
    btn.innerHTML = `
      <div class="chart-card-icon">${getChartMiniIconSvg(ch.id)}</div>
      <div class="chart-card-title">${escapeHtml(ch.name)}</div>
    `;
    btn.onclick = () => {
      if (usingPresetSample) {
        const preset = getChartPresetById(ch.id);
        usingPresetSample = true;
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
        state = normalizeChartSpec({ ...state, chartId: ch.id });
      }
      renderDataMatrix();
      renderStyleInputs();
      renderChartOnly();
      syncActiveSelectionClasses();
    };
    els.chartList.appendChild(btn);
  }
}

function loadPresetIntoState(chartId) {
  const preset = getChartPresetById(chartId);
  usingPresetSample = true;
  state = normalizeChartSpec({
    ...state,
    chartId: preset.id,
    title: preset.title,
    subtitle: preset.subtitle,
    source: preset.source,
    headers: preset.headers,
    rows: preset.rows
  });
  renderDataMatrix();
  renderStyleInputs();
  renderChartOnly();
  syncActiveSelectionClasses();
}

function renderDataMatrix() {
  const hdrs = state.headers;
  const rws = state.rows;
  let html = "<thead><tr><th class='row-idx'>#</th>";
  for (let c = 0; c < hdrs.length; c++) {
    html += `<th><input data-hdr="${c}" value="${escapeHtml(String(hdrs[c] ?? ""))}" /></th>`;
  }
  html += "</tr></thead><tbody>";

  for (let r = 0; r < rws.length; r++) {
    html += `<tr><td class="row-idx">${r + 1}</td>`;
    for (let c = 0; c < hdrs.length; c++) {
      const val = rws[r] && rws[r][c] !== undefined ? rws[r][c] : "";
      html += `<td><input data-r="${r}" data-c="${c}" value="${escapeHtml(String(val))}" /></td>`;
    }
    html += "</tr>";
  }
  html += "</tbody>";
  els.dataMatrix.innerHTML = html;
}

function renderPaletteList() {
  els.paletteList.innerHTML = "";
  for (const pal of ISCV_PALETTES) {
    const colors = state.isDark ? pal.darkColors : pal.lightColors;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.paletteId = pal.id;
    btn.className = `palette-btn ${state.paletteId === pal.id ? "active" : ""}`;
    const dots = colors
      .slice(0, 6)
      .map(hex => `<span class="swatch-dot" style="background:${hex}"></span>`)
      .join("");
    btn.innerHTML = `
      <div>
        <div style="font-weight:600">${escapeHtml(pal.name)}</div>
        <div style="font-size:10px;color:var(--fg-muted)">${escapeHtml(pal.category)}</div>
      </div>
      <span class="swatches">${dots}</span>
    `;
    btn.onclick = () => {
      state = normalizeChartSpec({ ...state, paletteId: pal.id });
      renderChartOnly();
      renderStyleInputs();
      syncActiveSelectionClasses();
    };
    els.paletteList.appendChild(btn);
  }
}

function renderStyleInputs() {
  els.inpTitle.value = state.title;
  els.inpSubtitle.value = state.subtitle;
  els.inpSource.value = state.source;
  els.inpWidth.value = state.cardWidth;
  els.inpHeight.value = state.cardHeight;
  const themeLabel = state.isDark ? "Dark Card" : "Light Card";
  els.btnCardTheme.textContent = themeLabel;
  els.btnCardTheme.classList.toggle("active", Boolean(state.isDark));
  els.btnTopCardTheme.textContent = themeLabel;
  els.btnTopCardTheme.classList.toggle("active", Boolean(state.isDark));
  els.togHeader.classList.toggle("active", Boolean(state.showHeader));
  els.togLegend.classList.toggle("active", Boolean(state.showLegend));
  els.togGrid.classList.toggle("active", Boolean(state.showGrid));
  els.togLabels.classList.toggle("active", Boolean(state.showLabels));
  els.togDiag.classList.toggle("active", Boolean(state.diagonalLabels));
  els.togFooter.classList.toggle("active", Boolean(state.showFooter));
}

function renderStatsStrip() {
  const sum = computeDataSummary(state.headers, state.rows);
  const cols = sum.numericColumns
    .slice(0, 3)
    .map(c => `${c.header}: Σ ${c.sum} | μ ${c.mean} | [${c.min}..${c.max}]`)
    .join("   •   ");
  els.statsStrip.textContent = `${sum.rowCount}×${sum.colCount} matrix${cols ? "   •   " + cols : ""}`;
}

function renderChartOnly() {
  const rendered = renderChartSvg(state);
  state = rendered.spec;
  lastSvg = rendered.svg;
  els.svgHost.innerHTML = lastSvg;
  fitStage();
  els.topMeta.textContent = `${state.chartName} (${state.chartId}) • ${state.cardWidth}×${state.cardHeight}`;
  renderStatsStrip();
}

function scheduleRenderChartOnly() {
  if (chartRafId) return;
  chartRafId = requestAnimationFrame(() => {
    chartRafId = 0;
    renderChartOnly();
  });
}

function renderChartAndStyle() {
  renderChartOnly();
  renderStyleInputs();
  updatePaletteSwatches();
  syncActiveSelectionClasses();
}

function renderAll() {
  renderPackPills();
  renderChartList();
  renderDataMatrix();
  renderPaletteList();
  renderStyleInputs();
  renderChartOnly();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Search & Load Sample
els.chartSearch.addEventListener("input", renderChartList);
els.btnLoadSample.addEventListener("click", () => loadPresetIntoState(state.chartId));

// Data Matrix Input & Paste
els.dataMatrix.addEventListener("input", (ev) => {
  const inp = ev.target;
  if (!(inp instanceof HTMLInputElement)) return;
  usingPresetSample = false;
  if (inp.dataset.hdr !== undefined) {
    const c = Number(inp.dataset.hdr);
    const nextHdrs = [...state.headers];
    nextHdrs[c] = inp.value;
    state = normalizeChartSpec({ ...state, headers: nextHdrs });
    scheduleRenderChartOnly();
    return;
  }
  if (inp.dataset.r !== undefined && inp.dataset.c !== undefined) {
    const r = Number(inp.dataset.r);
    const c = Number(inp.dataset.c);
    const nextRows = state.rows.map(row => [...row]);
    if (nextRows[r]) {
      nextRows[r][c] = inp.value;
      state = normalizeChartSpec({ ...state, rows: nextRows });
      scheduleRenderChartOnly();
    }
  }
});

els.dataMatrix.addEventListener("paste", (ev) => {
  const txt = ev.clipboardData?.getData("text/plain");
  if (!txt || (!txt.includes("\t") && !txt.includes("\n"))) return;
  ev.preventDefault();
  const parsed = parseTabularInput(txt, els.a1Range.value);
  if (parsed?.headers?.length && parsed?.rows?.length) {
    usingPresetSample = false;
    state = normalizeChartSpec({ ...state, headers: parsed.headers, rows: parsed.rows });
    renderDataMatrix();
    renderChartOnly();
    showToast(`Pasted ${parsed.rows.length}×${parsed.headers.length} table`, "success");
  }
});

els.btnApplyPaste.addEventListener("click", () => {
  const raw = els.pasteBox.value.trim();
  if (!raw) return;
  const parsed = parseTabularInput(raw, els.a1Range.value);
  if (parsed?.headers?.length && parsed?.rows?.length) {
    usingPresetSample = false;
    state = normalizeChartSpec({ ...state, headers: parsed.headers, rows: parsed.rows });
    renderDataMatrix();
    renderChartOnly();
    showToast(`Applied ${parsed.rows.length}×${parsed.headers.length} dataset`, "success");
  } else {
    showToast("Could not parse CSV/TSV/JSON table", "warn");
  }
});

document.getElementById("btnAddRow").addEventListener("click", () => {
  usingPresetSample = false;
  const nextRows = state.rows.map(r => [...r]);
  const newRow = state.headers.map((_, idx) => (idx === 0 ? `Item ${nextRows.length + 1}` : 0));
  nextRows.push(newRow);
  state = normalizeChartSpec({ ...state, rows: nextRows });
  renderDataMatrix();
  renderChartOnly();
});

document.getElementById("btnDelRow").addEventListener("click", () => {
  if (state.rows.length <= 1) return;
  usingPresetSample = false;
  state = normalizeChartSpec({ ...state, rows: state.rows.slice(0, -1) });
  renderDataMatrix();
  renderChartOnly();
});

document.getElementById("btnAddCol").addEventListener("click", () => {
  usingPresetSample = false;
  const nextHdrs = [...state.headers, `Series ${state.headers.length}`];
  const nextRows = state.rows.map(r => [...r, 10]);
  state = normalizeChartSpec({ ...state, headers: nextHdrs, rows: nextRows });
  renderDataMatrix();
  renderChartOnly();
});

document.getElementById("btnDelCol").addEventListener("click", () => {
  if (state.headers.length <= 2) return;
  usingPresetSample = false;
  state = normalizeChartSpec({
    ...state,
    headers: state.headers.slice(0, -1),
    rows: state.rows.map(r => r.slice(0, -1))
  });
  renderDataMatrix();
  renderChartOnly();
});

document.getElementById("btnTranspose").addEventListener("click", () => {
  usingPresetSample = false;
  const matrix = [state.headers, ...state.rows];
  const colCount = Math.max(...matrix.map(r => r.length));
  const trans = [];
  for (let c = 0; c < colCount; c++) {
    trans.push(matrix.map(r => (r[c] !== undefined ? r[c] : "")));
  }
  if (trans.length >= 2) {
    state = normalizeChartSpec({ ...state, headers: trans[0].map(String), rows: trans.slice(1) });
    renderDataMatrix();
    renderChartOnly();
  }
});

function sortRows(dir) {
  usingPresetSample = false;
  const colIdx = state.headers.length > 1 ? 1 : 0;
  const nextRows = [...state.rows].sort((a, b) => {
    const va = Number(a[colIdx]);
    const vb = Number(b[colIdx]);
    if (Number.isFinite(va) && Number.isFinite(vb)) return dir * (va - vb);
    return dir * String(a[colIdx] ?? "").localeCompare(String(b[colIdx] ?? ""));
  });
  state = normalizeChartSpec({ ...state, rows: nextRows });
  renderDataMatrix();
  renderChartOnly();
}

document.getElementById("btnSortAsc").addEventListener("click", () => sortRows(1));
document.getElementById("btnSortDesc").addEventListener("click", () => sortRows(-1));
document.getElementById("btnResetData").addEventListener("click", () => {
  loadPresetIntoState(state.chartId);
  showToast("Reset to preset sample data", "success");
});

// Style Events (coalesced text input via requestAnimationFrame)
els.inpTitle.addEventListener("input", () => {
  state = normalizeChartSpec({ ...state, title: els.inpTitle.value });
  scheduleRenderChartOnly();
});
els.inpSubtitle.addEventListener("input", () => {
  state = normalizeChartSpec({ ...state, subtitle: els.inpSubtitle.value });
  scheduleRenderChartOnly();
});
els.inpSource.addEventListener("input", () => {
  state = normalizeChartSpec({ ...state, source: els.inpSource.value });
  scheduleRenderChartOnly();
});
els.btnCardTheme.addEventListener("click", () => {
  state = normalizeChartSpec({ ...state, isDark: !state.isDark });
  renderChartAndStyle();
});
els.inpWidth.addEventListener("change", () => {
  state = normalizeChartSpec({ ...state, cardWidth: Number(els.inpWidth.value) });
  renderChartAndStyle();
});
els.inpHeight.addEventListener("change", () => {
  state = normalizeChartSpec({ ...state, cardHeight: Number(els.inpHeight.value) });
  renderChartAndStyle();
});

document.querySelectorAll(".size-preset").forEach((btn) => {
  btn.addEventListener("click", () => {
    state = normalizeChartSpec({
      ...state,
      cardWidth: Number(btn.dataset.w),
      cardHeight: Number(btn.dataset.h)
    });
    renderChartAndStyle();
  });
});

const toggleMap = [
  [els.togHeader, "showHeader"],
  [els.togLegend, "showLegend"],
  [els.togGrid, "showGrid"],
  [els.togLabels, "showLabels"],
  [els.togDiag, "diagonalLabels"],
  [els.togFooter, "showFooter"]
];
for (const [el, prop] of toggleMap) {
  el.addEventListener("click", () => {
    state = normalizeChartSpec({ ...state, [prop]: !state[prop] });
    renderChartAndStyle();
  });
}

// Export & Agent Bridge Events
els.btnSaveSvg.addEventListener("click", () => {
  exportChartArtifact({ app: mcpBridge.app, caps: mcpBridge.caps, format: "svg", spec: state, svgText: lastSvg, onToast: showToast });
});
els.btnSavePng.addEventListener("click", () => {
  exportChartArtifact({ app: mcpBridge.app, caps: mcpBridge.caps, format: "png", spec: state, svgText: lastSvg, onToast: showToast });
});
els.btnSaveCsv.addEventListener("click", () => {
  exportChartArtifact({ app: mcpBridge.app, caps: mcpBridge.caps, format: "csv", spec: state, svgText: lastSvg, onToast: showToast });
});
els.btnSaveJson.addEventListener("click", () => {
  exportChartArtifact({ app: mcpBridge.app, caps: mcpBridge.caps, format: "json", spec: state, svgText: lastSvg, onToast: showToast });
});
els.btnCopySvg.addEventListener("click", () => {
  copySvgToClipboard(lastSvg, showToast);
});

els.btnAttach.addEventListener("click", async () => {
  if (!mcpBridge.app || !mcpBridge.caps?.updateModelContext) return;
  try {
    await mcpBridge.app.updateModelContext({
      content: [
        {
          type: "text",
          text: `ISCV Chart Studio Spec (${state.chartId}, ${state.paletteId}):\n${JSON.stringify(state)}`
        }
      ],
      structuredContent: { spec: state }
    });
    showToast("Attached current chart spec to prompt", "success");
  } catch (err) {
    showToast(`Attach failed: ${err?.message || String(err)}`, "error");
  }
});

els.btnAskAgent.addEventListener("click", async () => {
  if (!mcpBridge.app || !mcpBridge.caps?.message) return;
  try {
    await mcpBridge.app.sendMessage({
      role: "user",
      content: [
        {
          type: "text",
          text: `Analyze this ${state.chartName} (${state.chartId}) dataset (${state.rows.length} rows, columns: ${state.headers.join(", ")}):\n${JSON.stringify({ title: state.title, headers: state.headers, rows: state.rows })}`
        }
      ]
    });
    showToast("Sent chart data to agent", "success");
  } catch (err) {
    showToast(`Send failed: ${err?.message || String(err)}`, "error");
  }
});

// Responsive stage resize observer + fallback window listener
if (typeof ResizeObserver !== "undefined") {
  const stageRo = new ResizeObserver(() => {
    fitStage();
  });
  stageRo.observe(els.stageViewport);
}
window.addEventListener("resize", fitStage);

// Initial render
renderAll();

async function boot() {
  mcpBridge = await initMcpApp({
    name: "ISCV Chart Studio",
    version: "1.0.0",
    autoResize: false,
    onToolInput: (args) => {
      if (args && Object.keys(args).length > 0) {
        if (args.headers || args.rows || args.rawData || args.title) {
          usingPresetSample = false;
        }
        state = normalizeChartSpec(args);
        renderAll();
      }
    },
    onToolResult: (_result, sc) => {
      if (sc?.spec) {
        const def = getChartPresetById(sc.spec.chartId);
        usingPresetSample =
          JSON.stringify(sc.spec.rows) === JSON.stringify(def.rows) &&
          JSON.stringify(sc.spec.headers) === JSON.stringify(def.headers) &&
          sc.spec.title === def.title;
        state = normalizeChartSpec(sc.spec);
        renderAll();
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
    els.btnAttach.hidden = false;
  }
  if (mcpBridge.caps?.message) {
    els.btnAskAgent.hidden = false;
  }
}

boot();
