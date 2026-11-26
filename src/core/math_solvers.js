// ============================================================================
// ISCV Chart Studio | Pure First-Party Mathematical & Geometry Solver Engine
// Brand: ISCV | Isocurve Research Lab (@iscvlab)
// Zero third-party runtime dependencies. 100% Commercial-Safe IP.
// Emits Universal Native Primitives: Rects, Ellipses (ArcData), VectorNetworks, Texts.
// ============================================================================

function safeNum(val, fallback) {
  if (fallback === undefined) fallback = 0;
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : fallback;
  }
  if (typeof val === "string") {
    const s = String(val).replace(/,/g, "").trim();
    if (/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(s)) {
      const parsed = parseFloat(s);
      return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
  }
  return fallback;
}

function clampNum(val, minV, maxV) {
  const n = safeNum(val, minV);
  return Math.max(minV, Math.min(maxV, n));
}

function formatCompact(val) {
  const n = safeNum(val, 0);
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e4) return (n / 1e3).toFixed(1) + "k";
  if (Math.abs(n - Math.round(n)) < 1e-4) return String(Math.round(n));
  return n.toFixed(1);
}

// ----------------------------------------------------------------------------
// 1. Scale & Statistical Solvers (Nice Scale, BoxStats, KDE, Beeswarm, Ternary)
// ----------------------------------------------------------------------------

function computeNiceScale(minVal, maxVal, tickCount) {
  tickCount = tickCount || 5;
  let lo = safeNum(minVal, 0);
  let hi = safeNum(maxVal, 100);
  if (lo > hi) { const t = lo; lo = hi; hi = t; }
  if (Math.abs(hi - lo) < 1e-9) {
    lo = lo >= 0 ? 0 : lo - 10;
    hi = hi + 10;
  }
  const range = hi - lo;
  const roughStep = range / Math.max(1, tickCount - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1e-9, roughStep))));
  const norm = roughStep / mag;
  let step;
  if (norm <= 1.5) step = 1 * mag;
  else if (norm <= 3) step = 2 * mag;
  else if (norm <= 7) step = 5 * mag;
  else step = 10 * mag;

  const niceMin = Math.floor(lo / step) * step;
  const niceMax = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = niceMin; v <= niceMax + step * 0.001; v += step) {
    ticks.push(Number(v.toFixed(6)));
    if (ticks.length > 20) break;
  }
  return { min: niceMin, max: Math.max(niceMin + step, niceMax), step, ticks };
}

function computeQuantile(sorted, q) {
  if (!sorted || sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function computeBoxStats(rawValues) {
  const clean = (rawValues || []).map(v => safeNum(v, NaN)).filter(v => Number.isFinite(v));
  if (clean.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0, iqr: 0, mean: 0, std: 1, values: [0] };
  }
  const sorted = clean.slice().sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const q1 = computeQuantile(sorted, 0.25);
  const median = computeQuantile(sorted, 0.50);
  const q3 = computeQuantile(sorted, 0.75);
  const iqr = q3 - q1;
  const mean = sorted.reduce((acc, v) => acc + v, 0) / sorted.length;
  const variance = sorted.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / Math.max(1, sorted.length);
  const std = Math.max(1e-6, Math.sqrt(variance));
  return { min, q1, median, q3, max, iqr, mean, std, values: sorted };
}

function computeKDE(rawValues, domainMin, domainMax, steps) {
  steps = steps || 24;
  const stats = computeBoxStats(rawValues);
  const vals = stats.values;
  const n = Math.max(1, vals.length);
  const bandwidth = Math.max((domainMax - domainMin) * 0.06, 1.06 * stats.std * Math.pow(n, -0.2));
  const points = [];
  let maxDensity = 1e-9;
  for (let i = 0; i <= steps; i++) {
    const x = domainMin + (i / steps) * (domainMax - domainMin);
    let sum = 0;
    for (let j = 0; j < vals.length; j++) {
      const u = (x - vals[j]) / bandwidth;
      sum += Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
    }
    const density = sum / (n * bandwidth);
    if (density > maxDensity) maxDensity = density;
    points.push({ x, density });
  }
  return points.map(p => ({ x: p.x, normDensity: p.density / maxDensity }));
}

function computeBeeswarmOffsets(pixelPositions, dotRadius) {
  dotRadius = dotRadius || 4;
  const minDist = dotRadius * 2.1;
  const placed = [];
  const offsets = [];
  for (let i = 0; i < pixelPositions.length; i++) {
    const px = safeNum(pixelPositions[i], 0);
    let candidateOffset = 0;
    let step = 1;
    while (step < 15) {
      let collision = false;
      for (let j = 0; j < placed.length; j++) {
        const dx = px - placed[j].px;
        const dy = candidateOffset - placed[j].offset;
        if (dx * dx + dy * dy < minDist * minDist) {
          collision = true;
          break;
        }
      }
      if (!collision) break;
      const sign = step % 2 === 1 ? 1 : -1;
      candidateOffset = sign * Math.ceil(step / 2) * (dotRadius * 1.6);
      step++;
    }
    placed.push({ px, offset: candidateOffset });
    offsets.push(candidateOffset);
  }
  return offsets;
}

function relaxVerticalLabels(items, minGap, minY, maxY) {
  const cloned = items.map((it, idx) => ({ ...it, origIdx: idx, y: clampNum(it.y, minY, maxY) }));
  cloned.sort((a, b) => a.y - b.y);
  for (let pass = 0; pass < 8; pass++) {
    for (let i = 1; i < cloned.length; i++) {
      const overlap = (cloned[i - 1].y + minGap) - cloned[i].y;
      if (overlap > 0) {
        cloned[i - 1].y = Math.max(minY, cloned[i - 1].y - overlap * 0.5);
        cloned[i].y = Math.min(maxY, cloned[i].y + overlap * 0.5);
      }
    }
  }
  cloned.sort((a, b) => a.origIdx - b.origIdx);
  return cloned.map(c => c.y);
}

function computeBarycentricTernary(aRaw, bRaw, cRaw) {
  const a = Math.max(0, safeNum(aRaw, 0));
  const b = Math.max(0, safeNum(bRaw, 0));
  const c = Math.max(0, safeNum(cRaw, 0));
  const sum = a + b + c;
  if (sum <= 1e-9) {
    return { u: 0.5, v: Math.sqrt(3) / 6, aNorm: 1 / 3, bNorm: 1 / 3, cNorm: 1 / 3 };
  }
  const aN = a / sum;
  const bN = b / sum;
  const cN = c / sum;
  const u = 0.5 * (2 * bN + cN);
  const v = (Math.sqrt(3) / 2) * cN;
  return { u, v, aNorm: aN, bNorm: bN, cNorm: cN };
}

function computeLinearRegression(pts) {
  const clean = (pts || []).map((p, idx) => {
    if (Array.isArray(p)) return { x: safeNum(p[0], idx + 1), y: safeNum(p[1], 0) };
    return { x: safeNum(p && p.x, idx + 1), y: safeNum(p && p.y, 0) };
  }).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

  if (clean.length === 0) {
    return { slope: 0, intercept: 0, r2: 0, se: 0 };
  }
  if (clean.length === 1) {
    return { slope: 0, intercept: clean[0].y, r2: 0, se: 0 };
  }
  const n = clean.length;
  let sumX = 0, sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += clean[i].x;
    sumY += clean[i].y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  let ssXX = 0, ssYY = 0, ssXY = 0;
  for (let i = 0; i < n; i++) {
    const dx = clean[i].x - meanX;
    const dy = clean[i].y - meanY;
    ssXX += dx * dx;
    ssYY += dy * dy;
    ssXY += dx * dy;
  }
  if (ssXX <= 1e-9) {
    return { slope: 0, intercept: meanY, r2: 0, se: 0 };
  }
  const slope = ssXY / ssXX;
  const intercept = meanY - slope * meanX;
  const r2 = ssYY <= 1e-9 ? 1 : clampNum((ssXY * ssXY) / (ssXX * ssYY), 0, 1);
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = slope * clean[i].x + intercept;
    const err = clean[i].y - pred;
    ssRes += err * err;
  }
  const se = Math.sqrt(ssRes / Math.max(1, n - 2));
  return {
    slope: safeNum(slope, 0),
    intercept: safeNum(intercept, 0),
    r2: safeNum(r2, 0),
    se: safeNum(se, 0)
  };
}

function subdivideCatmullRom(pts, subdivisions) {
  const clean = (pts || []).filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (clean.length < 2) return clean;
  const steps = Math.max(2, subdivisions || 6);
  const out = [];
  for (let i = 0; i < clean.length - 1; i++) {
    const p0 = clean[Math.max(0, i - 1)];
    const p1 = clean[i];
    const p2 = clean[i + 1];
    const p3 = clean[Math.min(clean.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      );
      const y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      );
      out.push({ x: safeNum(x, p1.x), y: safeNum(y, p1.y) });
    }
  }
  const last = clean[clean.length - 1];
  out.push({ x: last.x, y: last.y });
  return out;
}

// ----------------------------------------------------------------------------
// 2. Data Ingestion, A1 Range Slicer & Zero-Login Google Sheets URL Normalizer
// ----------------------------------------------------------------------------

function colLettersToIndex(letters) {
  const clean = String(letters || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!clean) return null;
  let idx = 0;
  for (let i = 0; i < clean.length; i++) {
    idx = idx * 26 + (clean.charCodeAt(i) - 64);
  }
  return idx - 1;
}

function parseA1RangeString(rangeStr) {
  const raw = String(rangeStr || "").trim();
  if (!raw) return null;
  const parts = raw.split(":");
  const p1 = parts[0].trim();
  const p2 = (parts[1] || parts[0]).trim();
  const m1 = p1.match(/^([A-Za-z]+)?([0-9]+)?$/);
  const m2 = p2.match(/^([A-Za-z]+)?([0-9]+)?$/);
  if (!m1 || !m2) return null;

  const c1 = m1[1] ? colLettersToIndex(m1[1]) : 0;
  const r1 = m1[2] ? Math.max(0, parseInt(m1[2], 10) - 1) : 0;
  const c2 = m2[1] ? colLettersToIndex(m2[1]) : 999;
  const r2 = m2[2] ? Math.max(0, parseInt(m2[2], 10) - 1) : 99999;

  return {
    colStart: Math.min(c1, c2),
    colEnd: Math.max(c1, c2),
    rowStart: Math.min(r1, r2),
    rowEnd: Math.max(r1, r2)
  };
}

function normalizeGoogleSheetCsvUrl(inputUrl, rangeStr, sheetName) {
  const trimmed = String(inputUrl || "").trim();
  if (!trimmed) return "";
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return trimmed;
  const spreadsheetId = idMatch[1];
  const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : "0";

  const cleanRange = String(rangeStr || "").trim();
  const cleanSheet = String(sheetName || "").trim();
  if (cleanRange || cleanSheet) {
    let gvizUrl = "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/gviz/tq?tqx=out:csv";
    if (cleanSheet) {
      gvizUrl += "&sheet=" + encodeURIComponent(cleanSheet);
    } else if (gid) {
      gvizUrl += "&gid=" + gid;
    }
    if (cleanRange) {
      gvizUrl += "&range=" + encodeURIComponent(cleanRange);
    }
    return gvizUrl;
  }
  return "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/export?format=csv&gid=" + gid;
}

function parseTabularInput(rawText, rangeStr) {
  const text = String(rawText || "").trim();
  if (!text) return null;
  if (text.startsWith("[") || text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : (parsed.rows || parsed.data || []);
      if (arr.length > 0 && typeof arr[0] === "object" && !Array.isArray(arr[0])) {
        const headers = Object.keys(arr[0]);
        const rows = arr.map(obj => headers.map(k => obj[k]));
        return { headers, rows };
      }
    } catch (_) {}
  }
  const rawLines = text.split(/\r?\n/);
  const nonEmptyLines = rawLines.filter(l => l.trim().length > 0);
  if (nonEmptyLines.length < 1) return null;
  const isTsv = nonEmptyLines[0].includes("\t") || (nonEmptyLines[1] && nonEmptyLines[1].includes("\t"));
  const splitLine = (line) => {
    if (isTsv) return line.split("\t").map(c => c.trim());
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === "," && !inQuotes) { out.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  let grid = rawLines.filter(l => l.trim().length > 0).map(splitLine);

  // Optional A1 Range Slicing (if full sheet was returned or pasted)
  const bounds = parseA1RangeString(rangeStr);
  if (bounds && grid.length > bounds.rowStart + 1) {
    const slicedRows = grid.slice(bounds.rowStart, bounds.rowEnd + 1);
    if (slicedRows.length >= 2) {
      grid = slicedRows.map(r => r.slice(bounds.colStart, bounds.colEnd + 1));
    }
  }

  if (grid.length < 2) return null;
  const headers = grid[0].map((h, i) => h || ("Col " + (i + 1)));
  const rows = grid.slice(1).map(cells => {
    return headers.map((_, idx) => {
      const cell = cells[idx] !== undefined ? String(cells[idx]).trim() : "";
      if (idx === 0) return cell;
      if (cell === "-" || cell === "--") return 0;
      const num = Number(cell.replace(/,/g, ""));
      return Number.isFinite(num) && cell !== "" ? num : cell;
    });
  });
  return { headers, rows };
}

// ----------------------------------------------------------------------------
// 3. VectorNetwork Helper Primitives (Polylines, Closed Polygons, Ribbons)
// ----------------------------------------------------------------------------

function makePolylineVector(points, strokeHex, strokeWeight, name, colorIndex) {
  const cleanPts = (points || []).map(p => ({ x: safeNum(p.x, 0), y: safeNum(p.y, 0) }));
  if (cleanPts.length < 2) return null;
  const vertices = cleanPts.map(p => ({ x: p.x, y: p.y }));
  const segments = [];
  for (let i = 0; i < vertices.length - 1; i++) {
    segments.push({ start: i, end: i + 1 });
  }
  return {
    name: name || "Line Vector",
    vertices,
    segments,
    regions: [],
    fillHex: null,
    strokeHex: strokeHex || "#1D4ED8",
    strokeWeight: strokeWeight || 2,
    opacity: 1,
    colorIndex: colorIndex || 0
  };
}

function makeClosedPolygonVector(points, fillHex, strokeHex, strokeWeight, opacity, name, colorIndex) {
  const cleanPts = (points || []).map(p => ({ x: safeNum(p.x, 0), y: safeNum(p.y, 0) }));
  if (cleanPts.length < 3) return null;
  const vertices = cleanPts.map(p => ({ x: p.x, y: p.y }));
  const segments = [];
  const loopIndices = [];
  for (let i = 0; i < vertices.length; i++) {
    segments.push({ start: i, end: (i + 1) % vertices.length });
    loopIndices.push(i);
  }
  return {
    name: name || "Polygon Region",
    vertices,
    segments,
    regions: [{ windingRule: "NONZERO", loops: [loopIndices] }],
    fillHex: fillHex || "#1D4ED8",
    strokeHex: strokeHex || null,
    strokeWeight: strokeWeight || 1,
    opacity: opacity !== undefined ? opacity : 0.85,
    colorIndex: colorIndex || 0
  };
}

function makeCubicRibbonVector(x0, y0Top, y0Bot, x1, y1Top, y1Bot, fillHex, opacity, name, colorIndex) {
  const steps = 14;
  const topPts = [];
  const botPts = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const ease = t * t * (3 - 2 * t);
    const x = x0 + (x1 - x0) * t;
    topPts.push({ x, y: y0Top + (y1Top - y0Top) * ease });
    botPts.push({ x, y: y0Bot + (y1Bot - y0Bot) * ease });
  }
  const poly = topPts.concat(botPts.reverse());
  return makeClosedPolygonVector(poly, fillHex, null, 0, opacity !== undefined ? opacity : 0.48, name, colorIndex);
}

// ----------------------------------------------------------------------------
// 4. Master Universal Geometry Compiler (All 45 Chart Families Across 5 Packs)
// ----------------------------------------------------------------------------

function computeCardLayoutMetrics(cardW, cardH, showHeader, showLegend, showFooter) {
  const w = Math.max(240, safeNum(cardW, 640));
  const h = Math.max(180, safeNum(cardH, 420));
  const padX = 20;
  const padTop = 14;
  const headerH = showHeader !== false ? 42 : 0;
  const legendH = showLegend !== false ? 22 : 0;
  const footerH = showFooter !== false ? 22 : 6;
  const offsetY = padTop + headerH + legendH;
  const plotW = Math.max(160, w - padX * 2);
  const plotH = Math.max(100, h - offsetY - footerH - 8);
  const footerY = h - 10;
  return { cardW: w, cardH: h, padX, padTop, headerH, legendH, footerH, offsetY, plotW, plotH, footerY };
}

function resolveChartLegendEntries(chartId, headers, rows, colors) {
  const palette = (Array.isArray(colors) && colors.length > 0)
    ? colors
    : ["#1D4ED8", "#D97706", "#059669", "#0284C7", "#E11D48", "#7C3AED", "#0D9488", "#475569"];
  const pickColor = (idx) => palette[Math.abs(idx) % palette.length];
  const hdrs = Array.isArray(headers) ? headers : [];
  const rws = Array.isArray(rows) ? rows : [];

  const rowColoredCharts = [
    "pie_donut", "sunburst_pack", "waffle_parliament", "parliament_arc",
    "voronoi_treemap", "lollipop_rank", "slopegraph_tufte", "raincloud_plot",
    "violin_boxplot", "ridgeline_joyplot", "ternary_simplex", "scatter_bubble",
    "funnel_conversion", "radial_bar", "horizon_band", "chord_ribbon", "dendrogram_tree"
  ];

  if (rowColoredCharts.includes(chartId)) {
    return rws.slice(0, 6).map((r, idx) => ({
      label: String((r && r[0]) || "Item"),
      colorIndex: idx,
      colorHex: pickColor(idx)
    }));
  }

  if (chartId === "waterfall_bridge") {
    return [
      { label: "Increase (+)", colorIndex: 1, colorHex: pickColor(1) },
      { label: "Decrease (-)", colorIndex: 2, colorHex: pickColor(2) },
      { label: "Net Total", colorIndex: 0, colorHex: pickColor(0) }
    ];
  }
  if (chartId === "candlestick_ohlc") {
    return [
      { label: "Bullish (Close >= Open)", colorIndex: 2, colorHex: pickColor(2) },
      { label: "Bearish (Close < Open)", colorIndex: 4, colorHex: pickColor(4) },
      { label: "Volume", colorIndex: 2, colorHex: pickColor(2) }
    ];
  }
  if (chartId === "diverging_bar") {
    return [
      { label: String(hdrs[1] || "Negative (-)"), colorIndex: 4, colorHex: pickColor(4) },
      { label: String(hdrs[2] || "Positive (+)"), colorIndex: 2, colorHex: pickColor(2) }
    ];
  }
  if (chartId === "bullet_target") {
    return [
      { label: String(hdrs[1] || "Actual"), colorIndex: 0, colorHex: pickColor(0) },
      { label: String(hdrs[2] || "Target"), colorIndex: 4, colorHex: pickColor(4) },
      { label: "Capacity Band", colorIndex: 7, colorHex: pickColor(7) }
    ];
  }
  if (chartId === "spc_control") {
    return [
      { label: String(hdrs[1] || "Process Metric"), colorIndex: 0, colorHex: pickColor(0) },
      { label: "Mean (CL)", colorIndex: 2, colorHex: pickColor(2) },
      { label: "UCL / LCL (+/-3SD)", colorIndex: 4, colorHex: pickColor(4) }
    ];
  }
  if (chartId === "regression_ci") {
    return [
      { label: "Observed Data", colorIndex: 0, colorHex: pickColor(0) },
      { label: "OLS Fit Line (y=mx+b)", colorIndex: 4, colorHex: pickColor(4) },
      { label: "95% CI Band", colorIndex: 1, colorHex: pickColor(1) }
    ];
  }
  if (chartId === "upset_matrix") {
    return [
      { label: "Intersection Size", colorIndex: 0, colorHex: pickColor(0) },
      { label: "Active Set Member", colorIndex: 1, colorHex: pickColor(1) }
    ];
  }
  if (chartId === "alluvial_multistage" || chartId === "sankey_flow") {
    const seen = [];
    rws.forEach(r => {
      const k = String((r && r[0]) || "Source");
      if (!seen.includes(k)) seen.push(k);
    });
    return seen.slice(0, 6).map((k, idx) => ({
      label: k,
      colorIndex: idx,
      colorHex: pickColor(idx)
    }));
  }

  const seriesHeaders = hdrs.slice(1, 7);
  if (seriesHeaders.length > 0) {
    return seriesHeaders.map((h, idx) => ({
      label: String(h || "Series"),
      colorIndex: idx,
      colorHex: pickColor(idx)
    }));
  }
  return rws.slice(0, 6).map((r, idx) => ({
    label: String((r && r[0]) || "Item"),
    colorIndex: idx,
    colorHex: pickColor(idx)
  }));
}

function resolveChartLegendItems(chartId, headers, rows) {
  return resolveChartLegendEntries(chartId, headers, rows).map(e => e.label);
}

function buildChartGeometryPrimitives(spec) {
  const chartId = (spec && spec.chartId) || "bar_grouped";
  const headers = (spec && Array.isArray(spec.headers) && spec.headers.length > 0) ? spec.headers : ["Category", "Series A", "Series B"];
  const rows = (spec && Array.isArray(spec.rows) && spec.rows.length > 0) ? spec.rows : [["A", 20, 30], ["B", 45, 35]];
  const plotW = Math.max(160, safeNum(spec && spec.plotWidth, 560));
  const plotH = Math.max(120, safeNum(spec && spec.plotHeight, 260));
  const colors = (spec && Array.isArray(spec.colors) && spec.colors.length > 0)
    ? spec.colors
    : ["#1D4ED8", "#D97706", "#059669", "#0284C7", "#E11D48", "#7C3AED", "#0D9488", "#475569"];
  const isDark = Boolean(spec && spec.isDark);
  const showGrid = spec && spec.showGrid !== undefined ? Boolean(spec.showGrid) : true;
  const showLabels = spec && spec.showLabels !== undefined ? Boolean(spec.showLabels) : true;
  const diagonalLabels = Boolean(spec && spec.diagonalLabels);

  const gridHex = isDark ? "#263042" : "#E2E8F0";
  const axisTextHex = isDark ? "#94A3B8" : "#64748B";
  const primaryTextHex = isDark ? "#F8FAFC" : "#0F172A";

  const rects = [];
  const ellipses = [];
  const vectors = [];
  const texts = [];

  const padL = 44;
  const padR = 20;
  const padT = 14;
  const padB = diagonalLabels ? 50 : 28;
  const innerW = Math.max(80, plotW - padL - padR);
  const innerH = Math.max(60, plotH - padT - padB);

  const pickColor = (idx) => colors[Math.abs(idx) % colors.length];
  const seriesNames = headers.slice(1);
  const numSeries = Math.max(1, seriesNames.length);

  // Helper to draw standard Cartesian Y-gridlines & X-axis labels
  const drawCartesianGridAndYAxis = (minVal, maxVal, formatFn) => {
    const scale = computeNiceScale(minVal, maxVal, 5);
    for (let i = 0; i < scale.ticks.length; i++) {
      const tv = scale.ticks[i];
      const norm = (tv - scale.min) / Math.max(1e-9, scale.max - scale.min);
      const y = padT + innerH * (1 - norm);
      if (showGrid) {
        rects.push({
          x: padL, y: y - 0.5, w: innerW, h: 1,
          fillHex: gridHex, opacity: 0.9, isGrid: true, name: "Gridline Y"
        });
      }
      texts.push({
        x: padL - 6, y: y - 5,
        text: formatFn ? formatFn(tv) : formatCompact(tv),
        fontSize: 9, fontWeight: "Regular", fillHex: axisTextHex,
        align: "RIGHT", isMuted: true, name: "Y Tick"
      });
    }
    return scale;
  };

  // ==========================================================================
  // DISPATCH BY CHART FAMILY (45 FAMILIES)
  // ==========================================================================

  if (chartId === "bar_grouped" || chartId === "Sparkline") {
    let maxV = 0;
    let minV = 0;
    rows.forEach(r => {
      for (let s = 1; s <= numSeries; s++) {
        const v = safeNum(r[s], 0);
        if (v > maxV) maxV = v;
        if (v < minV) minV = v;
      }
    });
    const scale = drawCartesianGridAndYAxis(Math.min(0, minV), maxV);
    const zeroY = padT + innerH * (1 - (0 - scale.min) / (scale.max - scale.min));
    const groupSlotW = innerW / Math.max(1, rows.length);
    const groupPad = groupSlotW * 0.22;
    const barW = Math.max(4, (groupSlotW - groupPad) / numSeries - 2);

    rows.forEach((r, rIdx) => {
      const gx = padL + rIdx * groupSlotW + groupPad * 0.5;
      for (let s = 0; s < numSeries; s++) {
        const v = safeNum(r[s + 1], 0);
        const yVal = padT + innerH * (1 - (v - scale.min) / (scale.max - scale.min));
        const topY = Math.min(zeroY, yVal);
        const h = Math.max(2, Math.abs(zeroY - yVal));
        const bx = gx + s * (barW + 2);
        rects.push({
          x: bx, y: topY, w: barW, h,
          fillHex: pickColor(s), radius: 3, opacity: 1, colorIndex: s,
          name: (headers[s + 1] || "Series") + " - " + r[0]
        });
        if (showLabels && rows.length <= 6 && numSeries <= 3) {
          texts.push({
            x: bx + barW * 0.5, y: topY - 12,
            text: formatCompact(v), fontSize: 8, fontWeight: "Bold",
            fillHex: primaryTextHex, align: "CENTER", name: "Value Label"
          });
        }
      }
      texts.push({
        x: padL + (rIdx + 0.5) * groupSlotW, y: padT + innerH + 8,
        text: String(r[0]), fontSize: 9, fontWeight: "Regular",
        fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "X Label"
      });
    });
  }

  else if (chartId === "bar_stacked") {
    const totals = rows.map(r => {
      let sum = 0;
      for (let s = 1; s <= numSeries; s++) sum += Math.max(0, safeNum(r[s], 0));
      return sum;
    });
    const maxTot = Math.max(10, ...totals);
    const scale = drawCartesianGridAndYAxis(0, maxTot);
    const slotW = innerW / Math.max(1, rows.length);
    const barW = Math.max(8, slotW * 0.56);

    rows.forEach((r, rIdx) => {
      let running = 0;
      const bx = padL + (rIdx + 0.5) * slotW - barW * 0.5;
      for (let s = 0; s < numSeries; s++) {
        const v = Math.max(0, safeNum(r[s + 1], 0));
        const y0 = padT + innerH * (1 - running / scale.max);
        running += v;
        const y1 = padT + innerH * (1 - running / scale.max);
        const h = Math.max(1, y0 - y1);
        rects.push({
          x: bx, y: y1, w: barW, h,
          fillHex: pickColor(s), radius: s === numSeries - 1 ? 3 : 0,
          opacity: 1, colorIndex: s, name: (headers[s + 1] || "Stack") + " - " + r[0]
        });
      }
      if (showLabels) {
        const topY = padT + innerH * (1 - running / scale.max);
        texts.push({
          x: bx + barW * 0.5, y: topY - 12,
          text: formatCompact(running), fontSize: 8, fontWeight: "Bold",
          fillHex: primaryTextHex, align: "CENTER", name: "Total Label"
        });
      }
      texts.push({
        x: bx + barW * 0.5, y: padT + innerH + 8,
        text: String(r[0]), fontSize: 9, fontWeight: "Regular",
        fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "X Label"
      });
    });
  }

  else if (chartId === "bar_horizontal") {
    let maxV = 10;
    rows.forEach(r => {
      for (let s = 1; s <= numSeries; s++) {
        const v = Math.max(0, safeNum(r[s], 0));
        if (v > maxV) maxV = v;
      }
    });
    const xScale = computeNiceScale(0, maxV, 5);
    const maxLabelChars = Math.max(8, ...rows.map(r => String((r && r[0]) || "").length));
    const leftW = Math.min(120, Math.max(84, maxLabelChars * 5.6));
    const trackX0 = leftW;
    const trackW = Math.max(80, plotW - trackX0 - padR - 12);
    const rowSlotH = innerH / Math.max(1, rows.length);
    const groupPad = rowSlotH * 0.22;
    const barH = Math.max(4, (rowSlotH - groupPad) / numSeries - 2);

    xScale.ticks.forEach(xt => {
      const x = trackX0 + ((xt - xScale.min) / Math.max(1e-9, xScale.max - xScale.min)) * trackW;
      if (showGrid) {
        rects.push({ x, y: padT, w: 1, h: innerH, fillHex: gridHex, opacity: 0.85, isGrid: true, name: "Gridline X" });
      }
      texts.push({
        x, y: padT + innerH + 8, text: formatCompact(xt),
        fontSize: 9, fontWeight: "Regular", fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "X Tick"
      });
    });

    rows.forEach((r, rIdx) => {
      const gy = padT + rIdx * rowSlotH + groupPad * 0.5;
      texts.push({
        x: trackX0 - 8, y: padT + (rIdx + 0.5) * rowSlotH - 5,
        text: String(r[0] || "Category"), fontSize: 9, fontWeight: "Bold",
        fillHex: primaryTextHex, align: "RIGHT", name: "Row Label"
      });
      for (let s = 0; s < numSeries; s++) {
        const v = Math.max(0, safeNum(r[s + 1], 0));
        const bw = Math.max(2, ((v - xScale.min) / Math.max(1e-9, xScale.max - xScale.min)) * trackW);
        const by = gy + s * (barH + 2);
        rects.push({
          x: trackX0, y: by, w: bw, h: barH,
          fillHex: pickColor(s), radius: 3, opacity: 1, colorIndex: s,
          name: (headers[s + 1] || "Series") + " - " + r[0]
        });
        if (showLabels && numSeries <= 2) {
          texts.push({
            x: trackX0 + bw + 5, y: by + barH * 0.5 - 5,
            text: formatCompact(v), fontSize: 8, fontWeight: "Bold",
            fillHex: primaryTextHex, align: "LEFT", name: "Value Label"
          });
        }
      }
    });
  }

  else if (chartId === "bar_stacked_100") {
    drawCartesianGridAndYAxis(0, 100, v => Math.round(v) + "%");
    const slotW = innerW / Math.max(1, rows.length);
    const barW = Math.max(10, slotW * 0.56);

    rows.forEach((r, rIdx) => {
      let rowSum = 0;
      for (let s = 1; s <= numSeries; s++) rowSum += Math.max(0, safeNum(r[s], 0));
      rowSum = Math.max(1e-6, rowSum);

      let runningPct = 0;
      const bx = padL + (rIdx + 0.5) * slotW - barW * 0.5;
      for (let s = 0; s < numSeries; s++) {
        const v = Math.max(0, safeNum(r[s + 1], 0));
        const pct = (v / rowSum) * 100;
        const y0 = padT + innerH * (1 - runningPct / 100);
        runningPct += pct;
        const y1 = padT + innerH * (1 - runningPct / 100);
        const h = Math.max(1, y0 - y1);
        rects.push({
          x: bx, y: y1, w: barW, h,
          fillHex: pickColor(s), radius: s === numSeries - 1 ? 3 : 0,
          opacity: 1, colorIndex: s, name: (headers[s + 1] || "Segment") + " - " + r[0]
        });
        if (showLabels && h >= 16) {
          texts.push({
            x: bx + barW * 0.5, y: y1 + h * 0.5 - 5,
            text: Math.round(pct) + "%", fontSize: 8, fontWeight: "Bold",
            fillHex: "#FFFFFF", align: "CENTER", name: "Segment Pct"
          });
        }
      }
      texts.push({
        x: bx + barW * 0.5, y: padT + innerH + 8,
        text: String(r[0]), fontSize: 9, fontWeight: "Regular",
        fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "X Label"
      });
    });
  }

  else if (chartId === "line_smooth" || chartId === "area_stacked" || chartId === "line_step") {
    const isStackedArea = chartId === "area_stacked";
    const isStepLine = chartId === "line_step";
    let maxV = 0;
    let minV = 0;
    rows.forEach(r => {
      let rowSum = 0;
      for (let s = 1; s <= numSeries; s++) {
        const v = safeNum(r[s], 0);
        rowSum += Math.max(0, v);
        if (!isStackedArea && v > maxV) maxV = v;
        if (!isStackedArea && v < minV) minV = v;
      }
      if (isStackedArea && rowSum > maxV) maxV = rowSum;
    });
    const scale = drawCartesianGridAndYAxis(minV, maxV);
    const stepX = innerW / Math.max(1, rows.length - 1);
    const cumulativeY = rows.map(() => 0);

    for (let s = 0; s < numSeries; s++) {
      const col = pickColor(s);
      const ptsTop = [];
      const ptsBot = [];
      rows.forEach((r, rIdx) => {
        const x = padL + (rows.length === 1 ? innerW * 0.5 : rIdx * stepX);
        const rawV = safeNum(r[s + 1], 0);
        const yBotVal = isStackedArea ? cumulativeY[rIdx] : scale.min;
        const yTopVal = isStackedArea ? (cumulativeY[rIdx] + Math.max(0, rawV)) : rawV;
        if (isStackedArea) cumulativeY[rIdx] = yTopVal;
        const yTop = padT + innerH * (1 - (yTopVal - scale.min) / (scale.max - scale.min));
        const yBot = padT + innerH * (1 - (yBotVal - scale.min) / (scale.max - scale.min));
        ptsTop.push({ x, y: yTop, val: rawV });
        ptsBot.push({ x, y: yBot });
      });

      if (isStackedArea && ptsTop.length >= 2) {
        const smoothTop = subdivideCatmullRom(ptsTop, 5);
        const smoothBot = subdivideCatmullRom(ptsBot, 5);
        const areaPoly = smoothTop.concat(smoothBot.slice().reverse());
        const polyVec = makeClosedPolygonVector(areaPoly, col, col, 1.5, 0.55, (headers[s + 1] || "Series") + " Area", s);
        if (polyVec) vectors.push(polyVec);
      }

      let curvePts = ptsTop;
      if (isStepLine && ptsTop.length >= 2) {
        curvePts = [];
        for (let i = 0; i < ptsTop.length; i++) {
          if (i > 0) {
            curvePts.push({ x: ptsTop[i].x, y: ptsTop[i - 1].y });
          }
          curvePts.push({ x: ptsTop[i].x, y: ptsTop[i].y });
        }
      } else if (chartId === "line_smooth" && ptsTop.length >= 2) {
        curvePts = subdivideCatmullRom(ptsTop, 6);
      }

      const lineVec = makePolylineVector(curvePts, col, 2.2, (headers[s + 1] || "Series") + " Line", s);
      if (lineVec) vectors.push(lineVec);

      ptsTop.forEach((pt, rIdx) => {
        ellipses.push({
          cx: pt.x, cy: pt.y, rx: 3.5, ry: 3.5,
          fillHex: col, strokeHex: isDark ? "#0F172A" : "#FFFFFF", strokeWeight: 1.5,
          opacity: 1, colorIndex: s, name: "Point " + rows[rIdx][0]
        });
        if (showLabels && s === numSeries - 1) {
          texts.push({
            x: pt.x, y: pt.y - 13,
            text: formatCompact(pt.val), fontSize: 8, fontWeight: "Bold",
            fillHex: primaryTextHex, align: "CENTER", name: "Point Label"
          });
        }
      });
    }
    rows.forEach((r, rIdx) => {
      const x = padL + (rows.length === 1 ? innerW * 0.5 : rIdx * stepX);
      texts.push({
        x, y: padT + innerH + 8,
        text: String(r[0]), fontSize: 9, fontWeight: "Regular",
        fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "X Tick"
      });
    });
  }

  else if (chartId === "gauge_kpi") {
    const nGauges = Math.min(3, Math.max(1, rows.length));
    const slotW = innerW / nGauges;
    rows.slice(0, nGauges).forEach((r, idx) => {
      const label = String(r[0] || "KPI");
      const val = Math.max(0, safeNum(r[1], 75));
      const target = Math.max(0, safeNum(r[2], 85));
      const maxScale = Math.max(1, safeNum(r[3], 100), val, target);
      const frac = clampNum(val / maxScale, 0, 1);
      const targetFrac = clampNum(target / maxScale, 0, 1);

      const cx = padL + (idx + 0.5) * slotW;
      const outerR = Math.min(slotW * 0.43, innerH * 0.58);
      const cy = padT + innerH * 0.68;
      const col = pickColor(idx);

      // Background semicircle track
      ellipses.push({
        cx, cy, rx: outerR, ry: outerR,
        fillHex: gridHex,
        arcData: { startingAngle: Math.PI, endingAngle: Math.PI * 2, innerRadius: 0.64 },
        opacity: 0.85, isGrid: true, name: "Gauge Track - " + label
      });

      // Active value arc
      ellipses.push({
        cx, cy, rx: outerR, ry: outerR,
        fillHex: col,
        arcData: { startingAngle: Math.PI, endingAngle: Math.PI + Math.max(0.02, frac) * Math.PI, innerRadius: 0.64 },
        opacity: 1, colorIndex: idx, name: "Gauge Value Arc - " + label
      });

      // Target threshold needle / tick polygon
      const tAng = Math.PI + targetFrac * Math.PI;
      const rIn = outerR * 0.58;
      const rOut = outerR * 1.06;
      const perp = tAng + Math.PI * 0.5;
      const needlePts = [
        { x: cx + Math.cos(tAng) * rIn + Math.cos(perp) * 1.5, y: cy + Math.sin(tAng) * rIn + Math.sin(perp) * 1.5 },
        { x: cx + Math.cos(tAng) * rOut + Math.cos(perp) * 1.5, y: cy + Math.sin(tAng) * rOut + Math.sin(perp) * 1.5 },
        { x: cx + Math.cos(tAng) * rOut - Math.cos(perp) * 1.5, y: cy + Math.sin(tAng) * rOut - Math.sin(perp) * 1.5 },
        { x: cx + Math.cos(tAng) * rIn - Math.cos(perp) * 1.5, y: cy + Math.sin(tAng) * rIn - Math.sin(perp) * 1.5 }
      ];
      const needleVec = makeClosedPolygonVector(needlePts, primaryTextHex, null, 0, 0.95, "Target Marker - " + label, idx);
      if (needleVec) vectors.push(needleVec);

      texts.push({
        x: cx, y: cy - 22,
        text: formatCompact(val) + (maxScale === 100 ? "%" : ""),
        fontSize: 13, fontWeight: "Bold", fillHex: primaryTextHex, align: "CENTER", name: "Gauge Value"
      });
      if (showLabels) {
        texts.push({
          x: cx, y: cy - 7,
          text: "Target: " + formatCompact(target),
          fontSize: 8, fontWeight: "Regular", fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "Gauge Target"
        });
      }
      texts.push({
        x: cx, y: cy + 8,
        text: label,
        fontSize: 9, fontWeight: "Bold", fillHex: col, align: "CENTER", name: "Gauge Title"
      });
    });
  }

  else if (chartId === "pie_donut" || chartId === "sunburst_pack") {
    const isSunburst = chartId === "sunburst_pack";
    const cx = plotW * 0.5;
    const cy = plotH * 0.5;
    const outerR = Math.min(plotW, plotH) * 0.40;
    const vals = rows.map(r => Math.max(0.001, safeNum(r[isSunburst ? 2 : 1], 1)));
    const total = vals.reduce((a, b) => a + b, 0);
    let curAngle = -Math.PI * 0.5;

    rows.forEach((r, idx) => {
      const frac = vals[idx] / total;
      const sweep = frac * Math.PI * 2;
      const startA = curAngle;
      const endA = curAngle + sweep;
      curAngle = endA;

      ellipses.push({
        cx, cy, rx: outerR, ry: outerR,
        fillHex: pickColor(idx),
        arcData: { startingAngle: startA, endingAngle: endA, innerRadius: isSunburst ? 0.55 : 0.58 },
        opacity: 1, colorIndex: idx,
        name: "Arc Sector - " + r[0]
      });

      if (isSunburst) {
        ellipses.push({
          cx, cy, rx: outerR * 0.52, ry: outerR * 0.52,
          fillHex: pickColor(Math.floor(idx / 2)),
          arcData: { startingAngle: startA, endingAngle: endA, innerRadius: 0.42 },
          opacity: 0.82, colorIndex: Math.floor(idx / 2),
          name: "Inner Ring - " + r[0]
        });
      }

      if (showLabels && frac >= 0.05) {
        const midA = (startA + endA) * 0.5;
        const labelR = outerR + 16;
        const lx = cx + Math.cos(midA) * labelR;
        const ly = cy + Math.sin(midA) * labelR - 5;
        texts.push({
          x: lx, y: ly,
          text: String(r[isSunburst ? 1 : 0]) + " (" + Math.round(frac * 100) + "%)",
          fontSize: 9, fontWeight: "Bold", fillHex: primaryTextHex,
          align: Math.cos(midA) >= 0 ? "LEFT" : "RIGHT", name: "Sector Label"
        });
      }
    });

    texts.push({
      x: cx, y: cy - 6,
      text: formatCompact(total),
      fontSize: 13, fontWeight: "Bold", fillHex: primaryTextHex,
      align: "CENTER", name: "Center Total"
    });
  }

  else if (chartId === "scatter_bubble") {
    const xs = rows.map(r => safeNum(r[1], 0));
    const ys = rows.map(r => safeNum(r[2], 0));
    const ss = rows.map(r => Math.max(1, safeNum(r[3], 10)));
    const xScale = computeNiceScale(Math.min(...xs), Math.max(...xs), 5);
    const yScale = drawCartesianGridAndYAxis(Math.min(...ys), Math.max(...ys));
    const maxS = Math.max(1, ...ss);

    rows.forEach((r, idx) => {
      const xv = safeNum(r[1], 0);
      const yv = safeNum(r[2], 0);
      const sv = Math.max(1, safeNum(r[3], 10));
      const cx = padL + ((xv - xScale.min) / Math.max(1e-9, xScale.max - xScale.min)) * innerW;
      const cy = padT + innerH * (1 - (yv - yScale.min) / Math.max(1e-9, yScale.max - yScale.min));
      const rad = 5 + Math.sqrt(sv / maxS) * 14;
      const col = pickColor(idx);

      ellipses.push({
        cx, cy, rx: rad, ry: rad,
        fillHex: col, strokeHex: col, strokeWeight: 1.5,
        opacity: 0.65, colorIndex: idx, name: "Bubble - " + r[0]
      });
      if (showLabels) {
        texts.push({
          x: cx, y: cy - rad - 11,
          text: String(r[0]), fontSize: 8, fontWeight: "Bold",
          fillHex: primaryTextHex, align: "CENTER", name: "Bubble Label"
        });
      }
    });

    xScale.ticks.forEach(xt => {
      const x = padL + ((xt - xScale.min) / Math.max(1e-9, xScale.max - xScale.min)) * innerW;
      texts.push({
        x, y: padT + innerH + 8,
        text: formatCompact(xt), fontSize: 9, fontWeight: "Regular",
        fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "X Tick"
      });
    });
  }

  else if (chartId === "combo_dual" || chartId === "upset_pareto_spc") {
    const barVals = rows.map(r => Math.max(0, safeNum(r[1], 0)));
    const isPareto = chartId === "upset_pareto_spc";
    const totalSum = Math.max(1e-9, barVals.reduce((a, b) => a + b, 0));
    let runningSum = 0;
    const lineVals = rows.map((r, idx) => {
      if (isPareto) {
        runningSum += barVals[idx];
        return (runningSum / totalSum) * 100;
      }
      return safeNum(r[2], 0);
    });

    const barScale = drawCartesianGridAndYAxis(0, Math.max(10, ...barVals));
    const lineMax = isPareto ? 100 : Math.max(10, ...lineVals);
    const slotW = innerW / Math.max(1, rows.length);
    const barW = Math.max(10, slotW * 0.48);
    const linePts = [];

    rows.forEach((r, idx) => {
      const bv = barVals[idx];
      const lv = lineVals[idx];
      const cx = padL + (idx + 0.5) * slotW;
      const bx = cx - barW * 0.5;
      const by = padT + innerH * (1 - bv / barScale.max);
      const bh = Math.max(2, padT + innerH - by);

      rects.push({
        x: bx, y: by, w: barW, h: bh,
        fillHex: pickColor(0), radius: 3, opacity: 0.9, colorIndex: 0,
        name: "Bar - " + r[0]
      });

      const ly = padT + innerH * (1 - lv / Math.max(1e-9, lineMax));
      linePts.push({ x: cx, y: ly, val: lv });

      texts.push({
        x: cx, y: padT + innerH + 8,
        text: String(r[0]), fontSize: 9, fontWeight: "Regular",
        fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "X Label"
      });
    });

    const lineVec = makePolylineVector(linePts, pickColor(1), 2.5, "Secondary Axis Curve", 1);
    if (lineVec) vectors.push(lineVec);
    linePts.forEach((pt, idx) => {
      ellipses.push({
        cx: pt.x, cy: pt.y, rx: 4, ry: 4,
        fillHex: pickColor(1), strokeHex: isDark ? "#0F172A" : "#FFFFFF", strokeWeight: 1.5,
        opacity: 1, colorIndex: 1, name: "Curve Node " + idx
      });
      if (showLabels) {
        texts.push({
          x: pt.x, y: pt.y - 13,
          text: isPareto ? Math.round(pt.val) + "%" : formatCompact(pt.val),
          fontSize: 8, fontWeight: "Bold", fillHex: pickColor(1),
          align: "CENTER", name: "Line Value"
        });
      }
    });
  }

  else if (chartId === "radar_polygon") {
    const cx = plotW * 0.5;
    const cy = plotH * 0.52;
    const radius = Math.min(plotW, plotH) * 0.36;
    const nAxes = Math.max(3, rows.length);
    let maxVal = 100;
    rows.forEach(r => {
      for (let s = 1; s <= numSeries; s++) {
        const v = safeNum(r[s], 0);
        if (v > maxVal) maxVal = v;
      }
    });

    // Concentric web rings & radial spokes
    if (showGrid) {
      [0.33, 0.66, 1.0].forEach(level => {
        const ringPts = [];
        for (let i = 0; i < nAxes; i++) {
          const ang = -Math.PI * 0.5 + (i / nAxes) * Math.PI * 2;
          ringPts.push({
            x: cx + Math.cos(ang) * radius * level,
            y: cy + Math.sin(ang) * radius * level
          });
        }
        const ringVec = makeClosedPolygonVector(ringPts, null, gridHex, 1, 0, "Radar Grid Ring", 0);
        if (ringVec) {
          ringVec.regions = [];
          vectors.push(ringVec);
        }
      });
    }

    for (let s = 0; s < numSeries; s++) {
      const polyPts = [];
      for (let i = 0; i < nAxes; i++) {
        const ang = -Math.PI * 0.5 + (i / nAxes) * Math.PI * 2;
        const rowObj = rows[i % Math.max(1, rows.length)] || [];
        const v = clampNum(rowObj[s + 1], 0, maxVal);
        const rNorm = (v / Math.max(1e-9, maxVal)) * radius;
        const px = cx + Math.cos(ang) * rNorm;
        const py = cy + Math.sin(ang) * rNorm;
        polyPts.push({ x: px, y: py });
        ellipses.push({
          cx: px, cy: py, rx: 3, ry: 3,
          fillHex: pickColor(s), opacity: 1, colorIndex: s, name: "Radar Vertex"
        });
      }
      const radarVec = makeClosedPolygonVector(polyPts, pickColor(s), pickColor(s), 2, 0.28, headers[s + 1] || "Radar Series", s);
      if (radarVec) vectors.push(radarVec);
    }

    rows.forEach((r, i) => {
      const ang = -Math.PI * 0.5 + (i / nAxes) * Math.PI * 2;
      const lx = cx + Math.cos(ang) * (radius + 16);
      const ly = cy + Math.sin(ang) * (radius + 16) - 5;
      texts.push({
        x: lx, y: ly, text: String(r[0]),
        fontSize: 9, fontWeight: "Bold", fillHex: primaryTextHex,
        align: Math.abs(Math.cos(ang)) < 0.2 ? "CENTER" : (Math.cos(ang) > 0 ? "LEFT" : "RIGHT"),
        name: "Axis Label"
      });
    });
  }

  else if (chartId === "candlestick_ohlc") {
    const highs = rows.map(r => safeNum(r[2], 70));
    const lows = rows.map(r => safeNum(r[3], 60));
    const vols = rows.map(r => Math.max(0, safeNum(r[5], 1000)));
    const priceH = innerH * 0.68;
    const volH = innerH * 0.24;
    const volTop = padT + innerH - volH;
    const pScale = computeNiceScale(Math.min(...lows), Math.max(...highs), 4);
    const maxVol = Math.max(1, ...vols);
    const slotW = innerW / Math.max(1, rows.length);
    const candleW = Math.max(8, slotW * 0.46);

    pScale.ticks.forEach(tv => {
      const y = padT + priceH * (1 - (tv - pScale.min) / (pScale.max - pScale.min));
      if (showGrid) {
        rects.push({ x: padL, y, w: innerW, h: 1, fillHex: gridHex, opacity: 0.8, isGrid: true, name: "Price Grid" });
      }
      texts.push({
        x: padL - 6, y: y - 5, text: formatCompact(tv),
        fontSize: 9, fontWeight: "Regular", fillHex: axisTextHex, align: "RIGHT", isMuted: true, name: "Price Tick"
      });
    });

    rows.forEach((r, idx) => {
      const open = safeNum(r[1], 65);
      const high = safeNum(r[2], 70);
      const low = safeNum(r[3], 60);
      const close = safeNum(r[4], 68);
      const vol = vols[idx];
      const isBull = close >= open;
      const col = isBull ? pickColor(2) : pickColor(4);
      const cx = padL + (idx + 0.5) * slotW;

      const yHigh = padT + priceH * (1 - (high - pScale.min) / (pScale.max - pScale.min));
      const yLow = padT + priceH * (1 - (low - pScale.min) / (pScale.max - pScale.min));
      const yOpen = padT + priceH * (1 - (open - pScale.min) / (pScale.max - pScale.min));
      const yClose = padT + priceH * (1 - (close - pScale.min) / (pScale.max - pScale.min));

      // Wick
      rects.push({
        x: cx - 1, y: Math.min(yHigh, yLow), w: 2, h: Math.max(2, Math.abs(yLow - yHigh)),
        fillHex: col, opacity: 1, colorIndex: isBull ? 2 : 4, name: "Wick - " + r[0]
      });
      // Body
      rects.push({
        x: cx - candleW * 0.5, y: Math.min(yOpen, yClose),
        w: candleW, h: Math.max(3, Math.abs(yClose - yOpen)),
        fillHex: col, radius: 2, opacity: 1, colorIndex: isBull ? 2 : 4, name: "OHLC Body - " + r[0]
      });
      // Volume sub-bar
      const vh = Math.max(2, (vol / maxVol) * volH);
      rects.push({
        x: cx - candleW * 0.5, y: volTop + (volH - vh),
        w: candleW, h: vh,
        fillHex: col, radius: 1, opacity: 0.45, colorIndex: isBull ? 2 : 4, name: "Volume - " + r[0]
      });
      texts.push({
        x: cx, y: padT + innerH + 8, text: String(r[0]),
        fontSize: 9, fontWeight: "Regular", fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "Session Label"
      });
    });
  }

  else if (chartId === "dumbbell_range" || chartId === "lollipop_rank") {
    const isDumbbell = chartId === "dumbbell_range";
    const allVals = [];
    rows.forEach(r => {
      allVals.push(safeNum(r[1], 0));
      if (isDumbbell) allVals.push(safeNum(r[2], 0));
    });
    const xScale = computeNiceScale(Math.min(0, ...allVals), Math.max(10, ...allVals), 5);
    const leftLabelW = 92;
    const trackX0 = leftLabelW;
    const trackW = Math.max(80, plotW - trackX0 - padR);
    const rowSlotH = innerH / Math.max(1, rows.length);

    xScale.ticks.forEach(xt => {
      const x = trackX0 + ((xt - xScale.min) / (xScale.max - xScale.min)) * trackW;
      if (showGrid) {
        rects.push({ x, y: padT, w: 1, h: innerH, fillHex: gridHex, opacity: 0.8, isGrid: true, name: "Vertical Grid" });
      }
      texts.push({
        x, y: padT + innerH + 8, text: formatCompact(xt),
        fontSize: 9, fontWeight: "Regular", fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "X Tick"
      });
    });

    rows.forEach((r, idx) => {
      const cy = padT + (idx + 0.5) * rowSlotH;
      const v1 = safeNum(r[1], 0);
      const v2 = isDumbbell ? safeNum(r[2], v1) : 0;
      const x1 = trackX0 + ((v1 - xScale.min) / (xScale.max - xScale.min)) * trackW;
      const x2 = trackX0 + ((v2 - xScale.min) / (xScale.max - xScale.min)) * trackW;

      texts.push({
        x: trackX0 - 8, y: cy - 5, text: String(r[0]),
        fontSize: 9, fontWeight: "Bold", fillHex: primaryTextHex, align: "RIGHT", name: "Row Label"
      });

      rects.push({
        x: Math.min(x1, x2), y: cy - 1.5,
        w: Math.max(2, Math.abs(x2 - x1)), h: 3,
        fillHex: isDumbbell ? pickColor(0) : pickColor(idx),
        radius: 1.5, opacity: isDumbbell ? 0.45 : 0.85, colorIndex: isDumbbell ? 0 : idx,
        name: "Connector Stem - " + r[0]
      });

      if (isDumbbell) {
        ellipses.push({
          cx: x1, cy, rx: 5, ry: 5, fillHex: pickColor(0), opacity: 1, colorIndex: 0, name: "Start Pin - " + r[0]
        });
        ellipses.push({
          cx: x2, cy, rx: 5.5, ry: 5.5, fillHex: pickColor(1), opacity: 1, colorIndex: 1, name: "End Pin - " + r[0]
        });
        if (showLabels) {
          const delta = v2 - v1;
          texts.push({
            x: Math.max(x1, x2) + 8, y: cy - 5,
            text: (delta >= 0 ? "+" : "") + formatCompact(delta),
            fontSize: 8, fontWeight: "Bold", fillHex: pickColor(1), align: "LEFT", name: "Delta Badge"
          });
        }
      } else {
        ellipses.push({
          cx: x1, cy, rx: 6, ry: 6, fillHex: pickColor(idx), opacity: 1, colorIndex: idx, name: "Lollipop Head - " + r[0]
        });
        if (showLabels) {
          texts.push({
            x: x1 + 9, y: cy - 5, text: formatCompact(v1),
            fontSize: 8, fontWeight: "Bold", fillHex: primaryTextHex, align: "LEFT", name: "Value Label"
          });
        }
      }
    });
  }

  else if (chartId === "slopegraph_tufte") {
    const colX0 = padL + 80;
    const colX1 = plotW - padR - 80;
    const allVals = [];
    rows.forEach(r => { allVals.push(safeNum(r[1], 0), safeNum(r[2], 0)); });
    const yScale = computeNiceScale(Math.min(...allVals), Math.max(...allVals), 5);

    if (showGrid) {
      rects.push({ x: colX0, y: padT, w: 1.5, h: innerH, fillHex: gridHex, opacity: 1, isGrid: true, name: "Left Axis" });
      rects.push({ x: colX1, y: padT, w: 1.5, h: innerH, fillHex: gridHex, opacity: 1, isGrid: true, name: "Right Axis" });
    }

    texts.push({ x: colX0, y: 2, text: String(headers[1] || "T0"), fontSize: 10, fontWeight: "Bold", fillHex: primaryTextHex, align: "CENTER", name: "Left Header" });
    texts.push({ x: colX1, y: 2, text: String(headers[2] || "T1"), fontSize: 10, fontWeight: "Bold", fillHex: primaryTextHex, align: "CENTER", name: "Right Header" });

    const leftRaw = [];
    const rightRaw = [];
    rows.forEach(r => {
      const v0 = safeNum(r[1], 0);
      const v1 = safeNum(r[2], 0);
      leftRaw.push({ y: padT + innerH * (1 - (v0 - yScale.min) / (yScale.max - yScale.min)), v: v0 });
      rightRaw.push({ y: padT + innerH * (1 - (v1 - yScale.min) / (yScale.max - yScale.min)), v: v1 });
    });

    const leftRelaxedY = relaxVerticalLabels(leftRaw, 13, padT, padT + innerH - 8);
    const rightRelaxedY = relaxVerticalLabels(rightRaw, 13, padT, padT + innerH - 8);

    rows.forEach((r, idx) => {
      const col = pickColor(idx);
      const y0 = leftRaw[idx].y;
      const y1 = rightRaw[idx].y;
      const vec = makePolylineVector([{ x: colX0, y: y0 }, { x: colX1, y: y1 }], col, 2.4, "Slope - " + r[0], idx);
      if (vec) vectors.push(vec);
      ellipses.push({ cx: colX0, cy: y0, rx: 4, ry: 4, fillHex: col, opacity: 1, colorIndex: idx, name: "Node Left" });
      ellipses.push({ cx: colX1, cy: y1, rx: 4, ry: 4, fillHex: col, opacity: 1, colorIndex: idx, name: "Node Right" });

      texts.push({
        x: colX0 - 8, y: leftRelaxedY[idx] - 5,
        text: String(r[0]) + (showLabels ? " (" + formatCompact(leftRaw[idx].v) + ")" : ""),
        fontSize: 8.5, fontWeight: "Bold", fillHex: col, align: "RIGHT", name: "Left Slope Label"
      });
      texts.push({
        x: colX1 + 8, y: rightRelaxedY[idx] - 5,
        text: (showLabels ? formatCompact(rightRaw[idx].v) + " " : "") + String(r[0]),
        fontSize: 8.5, fontWeight: "Bold", fillHex: col, align: "LEFT", name: "Right Slope Label"
      });
    });
  }

  else if (chartId === "marimekko_bars") {
    const rowTotals = rows.map(r => {
      let s = 0;
      for (let k = 1; k <= numSeries; k++) s += Math.max(0, safeNum(r[k], 0));
      return Math.max(1e-6, s);
    });
    const grandTotal = rowTotals.reduce((a, b) => a + b, 0);
    drawCartesianGridAndYAxis(0, 100, v => Math.round(v) + "%");
    let curX = padL;
    const gapX = 3;
    const availW = innerW - gapX * Math.max(0, rows.length - 1);

    rows.forEach((r, rIdx) => {
      const colW = Math.max(12, (rowTotals[rIdx] / grandTotal) * availW);
      let runningPct = 0;
      for (let s = 0; s < numSeries; s++) {
        const val = Math.max(0, safeNum(r[s + 1], 0));
        const pct = (val / rowTotals[rIdx]) * 100;
        const y0 = padT + innerH * (1 - runningPct / 100);
        runningPct += pct;
        const y1 = padT + innerH * (1 - runningPct / 100);
        const h = Math.max(1, y0 - y1);
        rects.push({
          x: curX, y: y1, w: colW, h,
          fillHex: pickColor(s), radius: 2, opacity: 0.92, colorIndex: s,
          name: r[0] + " - " + (headers[s + 1] || "Segment")
        });
        if (showLabels && colW >= 34 && h >= 16) {
          texts.push({
            x: curX + colW * 0.5, y: y1 + h * 0.5 - 5,
            text: Math.round(pct) + "%", fontSize: 7.5, fontWeight: "Bold",
            fillHex: "#FFFFFF", align: "CENTER", name: "Mekko Pct"
          });
        }
      }
      texts.push({
        x: curX + colW * 0.5, y: padT + innerH + 8,
        text: String(r[0]), fontSize: 8.5, fontWeight: "Bold",
        fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "Mekko X Label"
      });
      curX += colW + gapX;
    });
  }

  else if (chartId === "waffle_parliament") {
    const vals = rows.map(r => Math.max(0, safeNum(r[1], 0)));
    const tot = Math.max(1e-9, vals.reduce((a, b) => a + b, 0));
    const cellAssignments = [];
    rows.forEach((r, idx) => {
      const count = Math.round((vals[idx] / tot) * 100);
      for (let c = 0; c < count && cellAssignments.length < 100; c++) {
        cellAssignments.push(idx);
      }
    });
    while (cellAssignments.length < 100) cellAssignments.push(0);

    const gridSide = Math.min(innerW * 0.54, innerH);
    const cellGap = 3;
    const cellSize = (gridSide - cellGap * 9) / 10;
    const startX = padL + 8;
    const startY = padT + (innerH - gridSide) * 0.5;

    for (let i = 0; i < 100; i++) {
      const rIdx = Math.floor(i / 10);
      const cIdx = i % 10;
      const catIdx = cellAssignments[i];
      rects.push({
        x: startX + cIdx * (cellSize + cellGap),
        y: startY + (9 - rIdx) * (cellSize + cellGap),
        w: cellSize, h: cellSize,
        fillHex: pickColor(catIdx), radius: 2.5, opacity: 1, colorIndex: catIdx,
        name: "Waffle Cell " + (i + 1)
      });
    }

    // Right-side proportional summary callout cards
    const summaryX = startX + gridSide + 24;
    const summaryW = Math.max(80, plotW - summaryX - padR);
    const cardSlotH = Math.min(40, gridSide / Math.max(1, rows.length));
    rows.slice(0, 6).forEach((r, idx) => {
      const pct = Math.round((vals[idx] / tot) * 100);
      const cy = startY + idx * cardSlotH;
      const col = pickColor(idx);
      rects.push({
        x: summaryX, y: cy, w: 6, h: Math.max(14, cardSlotH - 6),
        fillHex: col, radius: 3, opacity: 1, colorIndex: idx, name: "Waffle Swatch - " + r[0]
      });
      texts.push({
        x: summaryX + 12, y: cy + 1,
        text: String(r[0]), fontSize: 9, fontWeight: "Bold",
        fillHex: primaryTextHex, align: "LEFT", name: "Waffle Category"
      });
      if (showLabels) {
        texts.push({
          x: summaryX + 12, y: cy + 13,
          text: pct + "% (" + formatCompact(vals[idx]) + " units)",
          fontSize: 8, fontWeight: "Regular", fillHex: axisTextHex, align: "LEFT", isMuted: true, name: "Waffle Share"
        });
      }
      if (summaryW > 95) {
        const barMaxW = summaryW - 16;
        rects.push({
          x: summaryX + 12, y: cy + cardSlotH - 7, w: Math.max(3, (pct / 100) * barMaxW), h: 3,
          fillHex: col, radius: 1.5, opacity: 0.45, colorIndex: idx, name: "Waffle Mini Bar"
        });
      }
    });
  }

  else if (chartId === "parliament_arc") {
    const vals = rows.map(r => Math.max(0, safeNum(r[1], 0)));
    const totalSeats = Math.max(1, Math.round(vals.reduce((a, b) => a + b, 0)));
    const seatAssignments = [];
    const ringCounts = [24, 34, 42]; // 100 seats across 3 concentric hemicycle rings
    rows.forEach((r, idx) => {
      const n = Math.round((vals[idx] / Math.max(1e-9, totalSeats)) * 100);
      for (let k = 0; k < n && seatAssignments.length < 100; k++) {
        seatAssignments.push(idx);
      }
    });
    while (seatAssignments.length < 100) seatAssignments.push(0);

    // Order seats by angle across all rings so party blocs stay contiguous
    const allSeats = [];
    ringCounts.forEach((nSeats, ringIdx) => {
      for (let s = 0; s < nSeats; s++) {
        const ang = Math.PI + (s / Math.max(1, nSeats - 1)) * Math.PI;
        allSeats.push({ ringIdx, ang });
      }
    });
    allSeats.sort((a, b) => a.ang - b.ang || a.ringIdx - b.ringIdx);

    const arcCx = plotW * 0.5;
    const arcCy = padT + innerH * 0.80;
    const maxR = Math.min(innerW * 0.44, innerH * 0.72);
    const dotR = Math.max(3.2, Math.min(5.2, maxR * 0.042));

    allSeats.forEach((st, idx) => {
      const catIdx = seatAssignments[idx] || 0;
      const rr = maxR * (0.50 + st.ringIdx * 0.23);
      ellipses.push({
        cx: arcCx + Math.cos(st.ang) * rr,
        cy: arcCy + Math.sin(st.ang) * rr,
        rx: dotR, ry: dotR,
        fillHex: pickColor(catIdx), opacity: 1, colorIndex: catIdx,
        name: "Parliament Seat " + (idx + 1)
      });
    });

    texts.push({
      x: arcCx, y: arcCy - 24,
      text: String(totalSeats), fontSize: 15, fontWeight: "Bold",
      fillHex: primaryTextHex, align: "CENTER", name: "Total Seats"
    });
    if (showLabels) {
      texts.push({
        x: arcCx, y: arcCy - 9,
        text: "Majority: " + (Math.floor(totalSeats / 2) + 1) + " Seats",
        fontSize: 8.5, fontWeight: "Regular", fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "Majority Label"
      });
    }

    // Bottom coalition proportion bar
    const barW = Math.min(innerW * 0.78, maxR * 1.9);
    let curX = arcCx - barW * 0.5;
    const barY = arcCy + 10;
    rows.forEach((r, idx) => {
      const w = Math.max(2, (vals[idx] / Math.max(1e-9, totalSeats)) * barW);
      rects.push({
        x: curX, y: barY, w, h: 6,
        fillHex: pickColor(idx), radius: 2, opacity: 0.9, colorIndex: idx,
        name: "Coalition Bar - " + r[0]
      });
      curX += w;
    });
  }

  else if (chartId === "bullet_target") {
    let maxCap = 100;
    rows.forEach(r => {
      const m = Math.max(safeNum(r[1], 0), safeNum(r[2], 0), safeNum(r[3], 100));
      if (m > maxCap) maxCap = m;
    });
    const xScale = computeNiceScale(0, maxCap, 5);
    const maxLabelChars = Math.max(8, ...rows.map(r => String((r && r[0]) || "").length));
    const leftW = Math.min(120, Math.max(84, maxLabelChars * 5.6));
    const trackX0 = leftW;
    const trackW = Math.max(80, plotW - trackX0 - padR - 12);
    const rowSlotH = innerH / Math.max(1, rows.length);

    xScale.ticks.forEach(xt => {
      const x = trackX0 + ((xt - xScale.min) / Math.max(1e-9, xScale.max - xScale.min)) * trackW;
      if (showGrid) {
        rects.push({ x, y: padT, w: 1, h: innerH, fillHex: gridHex, opacity: 0.8, isGrid: true, name: "Bullet Grid" });
      }
      texts.push({
        x, y: padT + innerH + 8, text: formatCompact(xt),
        fontSize: 9, fontWeight: "Regular", fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "X Tick"
      });
    });

    rows.forEach((r, idx) => {
      const cy = padT + (idx + 0.5) * rowSlotH;
      const actual = Math.max(0, safeNum(r[1], 0));
      const target = Math.max(0, safeNum(r[2], actual));
      const cap = Math.max(actual, target, safeNum(r[3], xScale.max));
      const outerH = Math.min(22, rowSlotH * 0.58);
      const innerBarH = Math.max(6, outerH * 0.48);

      const wCap = Math.max(4, (cap / xScale.max) * trackW);
      const wMid = wCap * 0.75;
      const wAct = Math.max(2, (actual / xScale.max) * trackW);
      const xTarget = trackX0 + (target / xScale.max) * trackW;

      texts.push({
        x: trackX0 - 8, y: cy - 5, text: String(r[0]),
        fontSize: 9, fontWeight: "Bold", fillHex: primaryTextHex, align: "RIGHT", name: "Bullet Label"
      });

      // Background capacity band
      rects.push({
        x: trackX0, y: cy - outerH * 0.5, w: wCap, h: outerH,
        fillHex: pickColor(7), radius: 3, opacity: 0.18, colorIndex: 7, name: "Max Band - " + r[0]
      });
      // Mid qualitative band
      rects.push({
        x: trackX0, y: cy - outerH * 0.5, w: wMid, h: outerH,
        fillHex: pickColor(7), radius: 3, opacity: 0.32, colorIndex: 7, name: "Satisfactory Band - " + r[0]
      });
      // Actual measure bar
      rects.push({
        x: trackX0, y: cy - innerBarH * 0.5, w: wAct, h: innerBarH,
        fillHex: pickColor(0), radius: 2, opacity: 1, colorIndex: 0, name: "Actual Bar - " + r[0]
      });
      // Target marker bar
      rects.push({
        x: xTarget - 1.5, y: cy - outerH * 0.62, w: 3, h: outerH * 1.24,
        fillHex: pickColor(4), radius: 1, opacity: 1, colorIndex: 4, name: "Target Marker - " + r[0]
      });

      if (showLabels) {
        texts.push({
          x: Math.max(trackX0 + wAct, xTarget) + 7, y: cy - 5,
          text: formatCompact(actual) + " / " + formatCompact(target),
          fontSize: 8, fontWeight: "Bold", fillHex: primaryTextHex, align: "LEFT", name: "Bullet Value"
        });
      }
    });
  }

  else if (chartId === "bump_ranking") {
    const nPeriods = Math.max(2, headers.length - 1);
    const maxRank = Math.max(rows.length, ...rows.map(r => {
      let mr = 1;
      for (let c = 1; c <= nPeriods; c++) mr = Math.max(mr, safeNum(r[c], 1));
      return mr;
    }));
    const leftW = 86;
    const rightW = 36;
    const trackX0 = leftW;
    const trackW = Math.max(80, plotW - leftW - rightW);
    const stepX = trackW / Math.max(1, nPeriods - 1);
    const rankStepY = innerH / Math.max(1, maxRank);

    for (let c = 0; c < nPeriods; c++) {
      const x = trackX0 + c * stepX;
      if (showGrid) {
        rects.push({ x, y: padT, w: 1, h: innerH, fillHex: gridHex, opacity: 0.85, isGrid: true, name: "Period Grid" });
      }
      texts.push({
        x, y: padT + innerH + 8, text: String(headers[c + 1] || ("T" + (c + 1))),
        fontSize: 9, fontWeight: "Bold", fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "X Tick"
      });
    }

    rows.forEach((r, rIdx) => {
      const col = pickColor(rIdx);
      const pts = [];
      for (let c = 0; c < nPeriods; c++) {
        const rk = clampNum(safeNum(r[c + 1], rIdx + 1), 1, maxRank);
        const x = trackX0 + c * stepX;
        const y = padT + (rk - 0.5) * rankStepY;
        pts.push({ x, y, rk });
      }

      const smoothPts = subdivideCatmullRom(pts, 6);
      const lineVec = makePolylineVector(smoothPts, col, 2.6, "Rank Trajectory - " + r[0], rIdx);
      if (lineVec) vectors.push(lineVec);

      texts.push({
        x: trackX0 - 10, y: pts[0].y - 5,
        text: String(r[0]), fontSize: 8.5, fontWeight: "Bold",
        fillHex: col, align: "RIGHT", name: "Row Label"
      });

      pts.forEach((pt, cIdx) => {
        ellipses.push({
          cx: pt.x, cy: pt.y, rx: 7, ry: 7,
          fillHex: col, strokeHex: isDark ? "#0F172A" : "#FFFFFF", strokeWeight: 1.5,
          opacity: 1, colorIndex: rIdx, name: "Rank Node " + r[0] + " #" + pt.rk
        });
        if (showLabels) {
          texts.push({
            x: pt.x, y: pt.y - 4.5,
            text: "#" + Math.round(pt.rk), fontSize: 7.5, fontWeight: "Bold",
            fillHex: "#FFFFFF", align: "CENTER", name: "Rank Badge"
          });
        }
      });
    });
  }

  else if (chartId === "diverging_bar") {
    let maxAbs = 50;
    rows.forEach(r => {
      const vNeg = Math.abs(safeNum(r[1], 0));
      const vPos = Math.abs(safeNum(r[2], 0));
      if (vNeg > maxAbs) maxAbs = vNeg;
      if (vPos > maxAbs) maxAbs = vPos;
    });
    const scale = computeNiceScale(-maxAbs, maxAbs, 5);
    const maxExtent = Math.max(Math.abs(scale.min), Math.abs(scale.max), 10);
    const maxLabelChars = Math.max(8, ...rows.map(r => String((r && r[0]) || "").length));
    const leftW = Math.min(125, Math.max(88, maxLabelChars * 5.6));
    const trackX0 = leftW;
    const trackW = Math.max(80, plotW - trackX0 - padR - 14);
    const zeroX = trackX0 + trackW * 0.5;
    const halfW = trackW * 0.5;
    const rowSlotH = innerH / Math.max(1, rows.length);
    const barH = Math.min(18, rowSlotH * 0.54);

    [-maxExtent, -maxExtent * 0.5, 0, maxExtent * 0.5, maxExtent].forEach(tv => {
      const x = zeroX + (tv / maxExtent) * halfW;
      if (showGrid) {
        rects.push({
          x, y: padT, w: tv === 0 ? 1.5 : 1, h: innerH,
          fillHex: tv === 0 ? primaryTextHex : gridHex, opacity: tv === 0 ? 0.65 : 0.8,
          isGrid: true, name: "Diverging Grid"
        });
      }
      texts.push({
        x, y: padT + innerH + 8, text: (tv > 0 ? "+" : "") + formatCompact(tv),
        fontSize: 9, fontWeight: "Regular", fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "X Tick"
      });
    });

    rows.forEach((r, idx) => {
      const cy = padT + (idx + 0.5) * rowSlotH;
      const rawNeg = safeNum(r[1], 0);
      const rawPos = safeNum(r[2], 0);
      const negMag = Math.abs(rawNeg);
      const posMag = Math.abs(rawPos);
      const wNeg = Math.max(2, (negMag / maxExtent) * halfW);
      const wPos = Math.max(2, (posMag / maxExtent) * halfW);

      texts.push({
        x: trackX0 - 8, y: cy - 5, text: String(r[0]),
        fontSize: 9, fontWeight: "Bold", fillHex: primaryTextHex, align: "RIGHT", name: "Row Label"
      });

      // Left negative bar
      rects.push({
        x: zeroX - wNeg, y: cy - barH * 0.5, w: wNeg, h: barH,
        fillHex: pickColor(4), radius: 2.5, opacity: 0.92, colorIndex: 4,
        name: (headers[1] || "Negative") + " - " + r[0]
      });
      // Right positive bar
      rects.push({
        x: zeroX, y: cy - barH * 0.5, w: wPos, h: barH,
        fillHex: pickColor(2), radius: 2.5, opacity: 0.92, colorIndex: 2,
        name: (headers[2] || "Positive") + " - " + r[0]
      });

      if (showLabels) {
        texts.push({
          x: zeroX - wNeg - 4, y: cy - 5,
          text: "-" + formatCompact(negMag), fontSize: 8, fontWeight: "Bold",
          fillHex: pickColor(4), align: "RIGHT", name: "Neg Value"
        });
        texts.push({
          x: zeroX + wPos + 4, y: cy - 5,
          text: "+" + formatCompact(posMag), fontSize: 8, fontWeight: "Bold",
          fillHex: pickColor(2), align: "LEFT", name: "Pos Value"
        });
      }
    });
  }

  else if (chartId === "alluvial_multistage" || chartId === "sankey_flow") {
    // Support K >= 2 stage columns (cols 0 .. K-1 are stage labels, last col K is numeric flow weight)
    const numCols = Math.max(3, headers.length);
    const valColIdx = numCols - 1;
    const numStages = (chartId === "alluvial_multistage" && numCols >= 4) ? (numCols - 1) : 2;
    const stageNodes = [];
    for (let s = 0; s < numStages; s++) stageNodes.push({});

    const rowFlows = rows.map((r, idx) => {
      const w = Math.max(1, safeNum(r[valColIdx], safeNum(r[2], 10)));
      const stages = [];
      for (let s = 0; s < numStages; s++) {
        const key = String(r[s] || ("Stage " + (s + 1)));
        stages.push(key);
        stageNodes[s][key] = (stageNodes[s][key] || 0) + w;
      }
      return { stages, w, idx };
    });

    const totalFlow = Math.max(1, rowFlows.reduce((a, b) => a + b.w, 0));
    const maxStageKeys = Math.max(1, ...stageNodes.map(sn => Object.keys(sn).length));
    const nodeW = 13;
    const xStart = padL + 60;
    const xEnd = plotW - padR - 74;
    const stageStepX = numStages > 1 ? (xEnd - xStart) / (numStages - 1) : 0;
    const usableH = Math.max(40, innerH - maxStageKeys * 8);

    const stageLayouts = [];
    let colorCounter = 0;
    for (let s = 0; s < numStages; s++) {
      const keys = Object.keys(stageNodes[s]);
      const layout = {};
      let curY = padT;
      const xPos = xStart + s * stageStepX;
      keys.forEach((k, idx) => {
        const h = Math.max(10, (stageNodes[s][k] / totalFlow) * usableH);
        const cIdx = s === 0 ? idx : (colorCounter % colors.length);
        colorCounter++;
        layout[k] = { x: xPos, y: curY, h, inOffset: 0, outOffset: 0, colorIdx: cIdx, total: stageNodes[s][k] };
        rects.push({
          x: xPos, y: curY, w: nodeW, h,
          fillHex: pickColor(cIdx), radius: 3, opacity: 1, colorIndex: cIdx,
          name: "Stage " + (s + 1) + " Node - " + k
        });
        const isLast = s === numStages - 1;
        const isFirst = s === 0;
        texts.push({
          x: isFirst ? (xPos - 6) : (isLast ? (xPos + nodeW + 6) : (xPos + nodeW * 0.5)),
          y: isFirst || isLast ? (curY + h * 0.5 - 5) : (curY - 11),
          text: k, fontSize: 8.5, fontWeight: "Bold", fillHex: primaryTextHex,
          align: isFirst ? "RIGHT" : (isLast ? "LEFT" : "CENTER"),
          name: "Stage Label"
        });
        curY += h + 9;
      });
      stageLayouts.push(layout);
    }

    for (let s = 0; s < numStages - 1; s++) {
      rowFlows.forEach(rf => {
        const srcKey = rf.stages[s];
        const tgtKey = rf.stages[s + 1];
        const sNode = stageLayouts[s][srcKey];
        const tNode = stageLayouts[s + 1][tgtKey];
        if (!sNode || !tNode) return;
        const origColorIdx = stageLayouts[0][rf.stages[0]] ? stageLayouts[0][rf.stages[0]].colorIdx : sNode.colorIdx;
        const hSrc = (rf.w / Math.max(1e-9, sNode.total)) * sNode.h;
        const hTgt = (rf.w / Math.max(1e-9, tNode.total)) * tNode.h;
        const y0Top = sNode.y + sNode.outOffset;
        const y0Bot = y0Top + hSrc;
        const y1Top = tNode.y + tNode.inOffset;
        const y1Bot = y1Top + hTgt;
        sNode.outOffset += hSrc;
        tNode.inOffset += hTgt;

        const rib = makeCubicRibbonVector(
          sNode.x + nodeW, y0Top, y0Bot,
          tNode.x, y1Top, y1Bot,
          pickColor(origColorIdx), 0.42,
          "Flow Ribbon: " + srcKey + " -> " + tgtKey,
          origColorIdx
        );
        if (rib) vectors.push(rib);
      });
    }
  }

  else if (chartId === "chord_ribbon") {
    const cx = plotW * 0.5;
    const cy = plotH * 0.5;
    const outerR = Math.min(plotW, plotH) * 0.39;
    const innerR = outerR * 0.86;
    const nodeWeights = {};
    rows.forEach(r => {
      const u = String(r[0] || "A");
      const v = String(r[1] || "B");
      const w = Math.max(1, safeNum(r[2], 10));
      nodeWeights[u] = (nodeWeights[u] || 0) + w;
      nodeWeights[v] = (nodeWeights[v] || 0) + w;
    });
    const keys = Object.keys(nodeWeights);
    const totalW = Math.max(1, Object.values(nodeWeights).reduce((a, b) => a + b, 0));
    const gapRad = 0.06;
    const availRad = Math.PI * 2 - gapRad * keys.length;
    const arcMap = {};
    let curA = -Math.PI * 0.5;

    keys.forEach((k, idx) => {
      const span = (nodeWeights[k] / totalW) * availRad;
      arcMap[k] = { start: curA, end: curA + span, mid: curA + span * 0.5, cur: curA, span, total: nodeWeights[k], idx };
      ellipses.push({
        cx, cy, rx: outerR, ry: outerR,
        fillHex: pickColor(idx),
        arcData: { startingAngle: curA, endingAngle: curA + span, innerRadius: 0.86 },
        opacity: 1, colorIndex: idx, name: "Chord Perimeter - " + k
      });
      const lx = cx + Math.cos(curA + span * 0.5) * (outerR + 14);
      const ly = cy + Math.sin(curA + span * 0.5) * (outerR + 14) - 5;
      texts.push({
        x: lx, y: ly, text: k, fontSize: 8.5, fontWeight: "Bold",
        fillHex: primaryTextHex, align: Math.cos(curA + span * 0.5) >= 0 ? "LEFT" : "RIGHT", name: "Chord Label"
      });
      curA += span + gapRad;
    });

    rows.forEach((r, idx) => {
      const u = String(r[0] || "A");
      const v = String(r[1] || "B");
      const w = Math.max(1, safeNum(r[2], 10));
      const aU = arcMap[u];
      const aV = arcMap[v];
      if (!aU || !aV) return;
      const dU = (w / aU.total) * aU.span;
      const dV = (w / aV.total) * aV.span;
      const u0 = aU.cur; const u1 = u0 + dU; aU.cur = u1;
      const v0 = aV.cur; const v1 = v0 + dV; aV.cur = v1;

      const pts = [];
      const addCurve = (angA, angB) => {
        const p0 = { x: cx + Math.cos(angA) * innerR, y: cy + Math.sin(angA) * innerR };
        const p2 = { x: cx + Math.cos(angB) * innerR, y: cy + Math.sin(angB) * innerR };
        for (let s = 0; s <= 10; s++) {
          const t = s / 10;
          const omt = 1 - t;
          pts.push({
            x: omt * omt * p0.x + 2 * omt * t * cx + t * t * p2.x,
            y: omt * omt * p0.y + 2 * omt * t * cy + t * t * p2.y
          });
        }
      };
      addCurve(u0, v1);
      addCurve(v0, u1);
      const chordVec = makeClosedPolygonVector(pts, pickColor(aU.idx), null, 0, 0.38, "Chord: " + u + " <-> " + v, aU.idx);
      if (chordVec) vectors.push(chordVec);
    });
  }

  else if (chartId === "voronoi_treemap") {
    const items = rows.map((r, idx) => ({
      label: String(r[0]),
      val: Math.max(1, safeNum(r[1], 10)),
      idx
    })).sort((a, b) => b.val - a.val);
    const total = items.reduce((a, b) => a + b.val, 0);

    // Recursive slice-and-dice with organic chamfered Voronoi-style polygon cells
    const subdivide = (list, x, y, w, h, horizontal) => {
      if (list.length === 0) return;
      if (list.length === 1) {
        const it = list[0];
        const cham = Math.min(w, h) * 0.08;
        const poly = [
          { x: x + cham, y: y + 1 },
          { x: x + w - 1, y: y + 1 },
          { x: x + w - 1, y: y + h - cham },
          { x: x + w - cham, y: y + h - 1 },
          { x: x + 1, y: y + h - 1 },
          { x: x + 1, y: y + cham }
        ];
        const vec = makeClosedPolygonVector(poly, pickColor(it.idx), isDark ? "#0F172A" : "#FFFFFF", 2, 0.88, "Voronoi Cell - " + it.label, it.idx);
        if (vec) vectors.push(vec);
        if (w > 42 && h > 24) {
          const maxLineChars = Math.max(6, Math.floor((w - 10) / 5.4));
          const words = String(it.label).split(/\s+/);
          if (it.label.length > maxLineChars && words.length >= 2 && h > 46) {
            const line1 = words[0];
            const line2 = words.slice(1).join(" ");
            texts.push({
              x: x + w * 0.5, y: y + h * 0.5 - 15,
              text: line1, fontSize: 8.5, fontWeight: "Bold",
              fillHex: "#FFFFFF", align: "CENTER", name: "Cell Title"
            });
            texts.push({
              x: x + w * 0.5, y: y + h * 0.5 - 4,
              text: line2.length > maxLineChars ? line2.slice(0, maxLineChars - 1) + "." : line2,
              fontSize: 8.5, fontWeight: "Bold",
              fillHex: "#FFFFFF", align: "CENTER", name: "Cell Title 2"
            });
            texts.push({
              x: x + w * 0.5, y: y + h * 0.5 + 8,
              text: formatCompact(it.val) + " (" + Math.round((it.val / total) * 100) + "%)",
              fontSize: 8, fontWeight: "Regular",
              fillHex: "#FFFFFF", align: "CENTER", name: "Cell Value"
            });
          } else {
            const fitTitle = it.label.length > maxLineChars ? it.label.slice(0, maxLineChars - 1) + "." : it.label;
            texts.push({
              x: x + w * 0.5, y: y + h * 0.5 - 8,
              text: fitTitle, fontSize: 9, fontWeight: "Bold",
              fillHex: "#FFFFFF", align: "CENTER", name: "Cell Title"
            });
            texts.push({
              x: x + w * 0.5, y: y + h * 0.5 + 4,
              text: formatCompact(it.val) + " (" + Math.round((it.val / total) * 100) + "%)",
              fontSize: 8, fontWeight: "Regular",
              fillHex: "#FFFFFF", align: "CENTER", name: "Cell Value"
            });
          }
        }
        return;
      }
      const mid = Math.ceil(list.length / 2);
      const left = list.slice(0, mid);
      const right = list.slice(mid);
      const sumL = left.reduce((a, b) => a + b.val, 0);
      const sumR = right.reduce((a, b) => a + b.val, 0);
      const ratio = sumL / Math.max(1e-9, sumL + sumR);
      if (horizontal) {
        const wL = w * ratio;
        subdivide(left, x, y, wL, h, !horizontal);
        subdivide(right, x + wL, y, w - wL, h, !horizontal);
      } else {
        const hT = h * ratio;
        subdivide(left, x, y, w, hT, !horizontal);
        subdivide(right, x, y + hT, w, h - hT, !horizontal);
      }
    };
    subdivide(items, padL * 0.5, padT, plotW - padL, innerH, true);
  }

  else if (chartId === "waterfall_bridge") {
    let running = 0;
    const steps = rows.map((r, idx) => {
      const delta = safeNum(r[1], 0);
      const start = running;
      running += delta;
      return { label: String(r[0]), delta, start, end: running, isNet: false, idx };
    });
    steps.push({ label: "Net Total", delta: running, start: 0, end: running, isNet: true, idx: steps.length });

    const allBounds = [0];
    steps.forEach(s => { allBounds.push(s.start, s.end); });
    const yScale = drawCartesianGridAndYAxis(Math.min(...allBounds), Math.max(...allBounds));
    const slotW = innerW / steps.length;
    const barW = Math.max(10, slotW * 0.52);

    steps.forEach((st, idx) => {
      const cx = padL + (idx + 0.5) * slotW;
      const bx = cx - barW * 0.5;
      const yStart = padT + innerH * (1 - (st.start - yScale.min) / (yScale.max - yScale.min));
      const yEnd = padT + innerH * (1 - (st.end - yScale.min) / (yScale.max - yScale.min));
      const topY = Math.min(yStart, yEnd);
      const h = Math.max(3, Math.abs(yEnd - yStart));
      const col = st.isNet ? pickColor(0) : (st.delta >= 0 ? pickColor(1) : pickColor(2));

      rects.push({
        x: bx, y: topY, w: barW, h,
        fillHex: col, radius: 3, opacity: 1,
        colorIndex: st.isNet ? 0 : (st.delta >= 0 ? 1 : 2),
        name: "Waterfall Step - " + st.label
      });

      if (idx < steps.length - 1) {
        const nextBx = padL + (idx + 1.5) * slotW - barW * 0.5;
        rects.push({
          x: bx + barW, y: yEnd, w: Math.max(2, nextBx - (bx + barW)), h: 1,
          fillHex: axisTextHex, opacity: 0.6, isGrid: true, name: "Bridge Connector"
        });
      }

      if (showLabels) {
        texts.push({
          x: cx, y: topY - 12,
          text: (st.delta > 0 && !st.isNet ? "+" : "") + formatCompact(st.isNet ? st.end : st.delta),
          fontSize: 8, fontWeight: "Bold", fillHex: primaryTextHex, align: "CENTER", name: "Step Delta"
        });
      }
      texts.push({
        x: cx, y: padT + innerH + 8, text: st.label,
        fontSize: 8.5, fontWeight: "Regular", fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "Step Label"
      });
    });
  }

  else if (chartId === "funnel_conversion") {
    const vals = rows.map(r => Math.max(1, safeNum(r[1], 10)));
    const maxV = Math.max(1, ...vals);
    const firstV = Math.max(1, vals[0] || maxV);
    const nStages = Math.max(1, rows.length);
    const stageGap = 4;
    const stageH = Math.max(14, (innerH - stageGap * (nStages - 1)) / nStages);
    const cx = padL + innerW * 0.44;
    const maxFunnelW = innerW * 0.68;

    rows.forEach((r, idx) => {
      const vTop = vals[idx];
      const vBot = idx < nStages - 1 ? vals[idx + 1] : vTop * 0.78;
      const wTop = Math.max(24, (vTop / maxV) * maxFunnelW);
      const wBot = Math.max(20, (vBot / maxV) * maxFunnelW);
      const yTop = padT + idx * (stageH + stageGap);
      const yBot = yTop + stageH;
      const col = pickColor(idx);

      const trapPts = [
        { x: cx - wTop * 0.5, y: yTop },
        { x: cx + wTop * 0.5, y: yTop },
        { x: cx + wBot * 0.5, y: yBot },
        { x: cx - wBot * 0.5, y: yBot }
      ];
      const trapVec = makeClosedPolygonVector(trapPts, col, isDark ? "#0F172A" : "#FFFFFF", 1.5, 0.9, "Funnel Stage - " + r[0], idx);
      if (trapVec) vectors.push(trapVec);

      texts.push({
        x: cx, y: yTop + stageH * 0.5 - 5,
        text: String(r[0]), fontSize: 8.5, fontWeight: "Bold",
        fillHex: "#FFFFFF", align: "CENTER", name: "Funnel Stage Label"
      });

      if (showLabels) {
        const convPct = Math.round((vTop / firstV) * 100);
        const rightEdge = cx + Math.max(wTop, wBot) * 0.5;
        texts.push({
          x: rightEdge + 10, y: yTop + stageH * 0.5 - 5,
          text: formatCompact(vTop) + " (" + convPct + "%)",
          fontSize: 8, fontWeight: "Bold", fillHex: primaryTextHex, align: "LEFT", name: "Funnel Conversion"
        });
      }
    });
  }

  else if (chartId === "dendrogram_tree") {
    const rootX = padL + 28;
    const branchX = padL + innerW * 0.38;
    const leafX = padL + innerW * 0.74;
    const rootY = padT + innerH * 0.5;

    const branchGroups = {};
    rows.forEach((r, idx) => {
      const leaf = String(r[0] || ("Leaf " + (idx + 1)));
      const branch = String(r[1] || "Clade A");
      const score = safeNum(r[2], 85);
      if (!branchGroups[branch]) branchGroups[branch] = [];
      branchGroups[branch].push({ leaf, branch, score, idx });
    });

    const branchKeys = Object.keys(branchGroups);
    const nLeaves = Math.max(1, rows.length);
    const leafStepY = innerH / nLeaves;
    let leafCursor = 0;

    // Root node
    ellipses.push({
      cx: rootX, cy: rootY, rx: 5.5, ry: 5.5,
      fillHex: primaryTextHex, opacity: 1, colorIndex: 0, name: "Root Node"
    });
    texts.push({
      x: rootX - 8, y: rootY - 5, text: "Root",
      fontSize: 8.5, fontWeight: "Bold", fillHex: primaryTextHex, align: "RIGHT", name: "Root Label"
    });

    branchKeys.forEach((bKey, bIdx) => {
      const children = branchGroups[bKey];
      const childYs = children.map(() => {
        const y = padT + (leafCursor + 0.5) * leafStepY;
        leafCursor++;
        return y;
      });
      const bY = childYs.reduce((a, b) => a + b, 0) / Math.max(1, childYs.length);
      const bCol = pickColor(bIdx);

      // Orthogonal elbow from Root to Branch
      const midRootBranchX = (rootX + branchX) * 0.5;
      const rootElbow = makePolylineVector([
        { x: rootX, y: rootY },
        { x: midRootBranchX, y: rootY },
        { x: midRootBranchX, y: bY },
        { x: branchX, y: bY }
      ], gridHex, 1.8, "Root Branch Connector - " + bKey, bIdx);
      if (rootElbow) vectors.push(rootElbow);

      ellipses.push({
        cx: branchX, cy: bY, rx: 4.5, ry: 4.5,
        fillHex: bCol, opacity: 1, colorIndex: bIdx, name: "Branch Node - " + bKey
      });
      texts.push({
        x: branchX, y: bY - 13, text: bKey,
        fontSize: 8, fontWeight: "Bold", fillHex: bCol, align: "CENTER", name: "Branch Label"
      });

      const midBranchLeafX = (branchX + leafX) * 0.5;
      children.forEach((ch, cIdx) => {
        const ly = childYs[cIdx];
        const lCol = pickColor(ch.idx);
        const leafElbow = makePolylineVector([
          { x: branchX, y: bY },
          { x: midBranchLeafX, y: bY },
          { x: midBranchLeafX, y: ly },
          { x: leafX, y: ly }
        ], lCol, 1.8, "Clade Connector - " + ch.leaf, ch.idx);
        if (leafElbow) vectors.push(leafElbow);

        ellipses.push({
          cx: leafX, cy: ly, rx: 4.5, ry: 4.5,
          fillHex: lCol, opacity: 1, colorIndex: ch.idx, name: "Leaf Node - " + ch.leaf
        });
        texts.push({
          x: leafX + 8, y: ly - 5,
          text: ch.leaf + (showLabels ? " (" + formatCompact(ch.score) + "%)" : ""),
          fontSize: 8.5, fontWeight: "Bold", fillHex: primaryTextHex, align: "LEFT", name: "Leaf Label"
        });
      });
    });
  }

  else if (chartId === "raincloud_plot" || chartId === "violin_boxplot" || chartId === "ridgeline_joyplot") {
    const isRaincloud = chartId === "raincloud_plot";
    const isRidgeline = chartId === "ridgeline_joyplot";
    const groupStats = rows.map(r => computeBoxStats(r.slice(1)));
    const globalMin = Math.min(...groupStats.map(g => g.min));
    const globalMax = Math.max(...groupStats.map(g => g.max));
    const span = Math.max(1e-3, globalMax - globalMin);
    const xScale = computeNiceScale(globalMin - span * 0.1, globalMax + span * 0.1, 5);
    const maxLabelChars = Math.max(8, ...rows.map(r => String((r && r[0]) || "").length));
    const leftW = Math.min(115, Math.max(76, maxLabelChars * 5.6));
    const plotX0 = leftW;
    const availW = Math.max(80, plotW - plotX0 - padR);
    const bandH = innerH / Math.max(1, rows.length);

    xScale.ticks.forEach(xt => {
      const x = plotX0 + ((xt - xScale.min) / (xScale.max - xScale.min)) * availW;
      if (showGrid) {
        rects.push({ x, y: padT, w: 1, h: innerH, fillHex: gridHex, opacity: 0.8, isGrid: true, name: "Stat Grid" });
      }
      texts.push({
        x, y: padT + innerH + 8, text: formatCompact(xt),
        fontSize: 9, fontWeight: "Regular", fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "X Tick"
      });
    });

    rows.forEach((r, idx) => {
      const st = groupStats[idx];
      const kde = computeKDE(st.values, xScale.min, xScale.max, 24);
      const baseCy = padT + (idx + 0.58) * bandH;
      const maxAmp = isRidgeline ? bandH * 0.78 : bandH * 0.36;
      const col = pickColor(idx);

      texts.push({
        x: plotX0 - 8, y: baseCy - 6, text: String(r[0]),
        fontSize: 9, fontWeight: "Bold", fillHex: primaryTextHex, align: "RIGHT", name: "Group Label"
      });

      const topPts = kde.map(pt => ({
        x: plotX0 + ((pt.x - xScale.min) / (xScale.max - xScale.min)) * availW,
        y: baseCy - pt.normDensity * maxAmp
      }));
      const botPts = kde.slice().reverse().map(pt => ({
        x: plotX0 + ((pt.x - xScale.min) / (xScale.max - xScale.min)) * availW,
        y: (isRaincloud || isRidgeline) ? baseCy : (baseCy + pt.normDensity * maxAmp)
      }));

      const kdePoly = makeClosedPolygonVector(topPts.concat(botPts), col, col, 1.5, isRidgeline ? 0.65 : 0.45, "KDE Envelope - " + r[0], idx);
      if (kdePoly) vectors.push(kdePoly);

      const xMed = plotX0 + ((st.median - xScale.min) / (xScale.max - xScale.min)) * availW;

      if (!isRidgeline) {
        const xMin = plotX0 + ((st.min - xScale.min) / (xScale.max - xScale.min)) * availW;
        const xQ1 = plotX0 + ((st.q1 - xScale.min) / (xScale.max - xScale.min)) * availW;
        const xQ3 = plotX0 + ((st.q3 - xScale.min) / (xScale.max - xScale.min)) * availW;
        const xMax = plotX0 + ((st.max - xScale.min) / (xScale.max - xScale.min)) * availW;

        // Whisker line
        rects.push({ x: xMin, y: baseCy - 0.75, w: Math.max(2, xMax - xMin), h: 1.5, fillHex: primaryTextHex, opacity: 0.85, colorIndex: idx, name: "Whisker - " + r[0] });
        // IQR Box
        rects.push({ x: xQ1, y: baseCy - 4, w: Math.max(4, xQ3 - xQ1), h: 8, fillHex: col, strokeHex: primaryTextHex, strokeWeight: 1, radius: 2, opacity: 0.95, colorIndex: idx, name: "IQR Box - " + r[0] });
        // Median line
        rects.push({ x: xMed - 1, y: baseCy - 4, w: 2, h: 8, fillHex: "#FFFFFF", opacity: 1, colorIndex: idx, name: "Median - " + r[0] });
      }

      if (showLabels) {
        texts.push({
          x: xMed, y: baseCy - maxAmp - 10,
          text: "M=" + formatCompact(st.median),
          fontSize: 7.5, fontWeight: "Bold", fillHex: col, align: "CENTER", name: "Median Badge"
        });
      }

      if (isRaincloud) {
        const pxs = st.values.map(v => plotX0 + ((v - xScale.min) / (xScale.max - xScale.min)) * availW);
        const offsets = computeBeeswarmOffsets(pxs, 2.5);
        pxs.forEach((px, pIdx) => {
          ellipses.push({
            cx: px, cy: baseCy + 8 + Math.abs(offsets[pIdx]) * 0.45,
            rx: 2.5, ry: 2.5, fillHex: col, opacity: 0.9, colorIndex: idx,
            name: "Raindrop Observation"
          });
        });
      }
    });
  }

  else if (chartId === "beeswarm_kde") {
    const barVals = rows.map(r => Math.max(0, safeNum(r[1], 0)));
    const kdeVals = rows.map(r => Math.max(0, safeNum(r[2], 0)));
    const yScale = drawCartesianGridAndYAxis(0, Math.max(10, ...barVals));
    const maxKde = Math.max(1, ...kdeVals);
    const slotW = innerW / Math.max(1, rows.length);
    const barW = Math.max(12, slotW * 0.72);
    const kdePts = [];

    rows.forEach((r, idx) => {
      const cx = padL + (idx + 0.5) * slotW;
      const bv = barVals[idx];
      const by = padT + innerH * (1 - bv / yScale.max);
      rects.push({
        x: cx - barW * 0.5, y: by, w: barW, h: Math.max(2, padT + innerH - by),
        fillHex: pickColor(0), radius: 2, opacity: 0.65, colorIndex: 0,
        name: "Histogram Bin - " + r[0]
      });
      if (showLabels) {
        texts.push({
          x: cx, y: by - 11, text: formatCompact(bv),
          fontSize: 8, fontWeight: "Bold", fillHex: primaryTextHex, align: "CENTER", name: "Bin Count"
        });
      }
      const ky = padT + innerH * (1 - (kdeVals[idx] / maxKde) * 0.88);
      kdePts.push({ x: cx, y: ky });
      texts.push({
        x: cx, y: padT + innerH + 8, text: String(r[0]),
        fontSize: 8.5, fontWeight: "Regular", fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "Bin Label"
      });
    });

    const smoothKde = subdivideCatmullRom(kdePts, 6);
    const kdeVec = makePolylineVector(smoothKde, pickColor(1), 2.6, "KDE Overlay Spline", 1);
    if (kdeVec) vectors.push(kdeVec);
  }

  else if (chartId === "upset_matrix") {
    const counts = rows.map(r => Math.max(0, safeNum(r[1], 0)));
    const maxCount = Math.max(10, ...counts);
    const setNames = headers.slice(2).length > 0 ? headers.slice(2) : ["Set A", "Set B", "Set C"];
    const nSets = setNames.length;

    const topPaneH = innerH * 0.52;
    const botPaneTop = padT + innerH * 0.58;
    const botPaneH = innerH * 0.40;
    const leftSetLabelW = 68;
    const matX0 = padL + leftSetLabelW;
    const matW = Math.max(80, plotW - matX0 - padR);
    const colSlotW = matW / Math.max(1, rows.length);
    const barW = Math.max(10, colSlotW * 0.46);
    const setRowH = botPaneH / Math.max(1, nSets);

    // Upper cardinality grid
    const cScale = computeNiceScale(0, maxCount, 3);
    cScale.ticks.forEach(tv => {
      const y = padT + topPaneH * (1 - tv / cScale.max);
      if (showGrid) {
        rects.push({ x: matX0, y, w: matW, h: 1, fillHex: gridHex, opacity: 0.8, isGrid: true, name: "UpSet Bar Grid" });
      }
      texts.push({
        x: matX0 - 6, y: y - 5, text: formatCompact(tv),
        fontSize: 8, fontWeight: "Regular", fillHex: axisTextHex, align: "RIGHT", isMuted: true, name: "Y Tick"
      });
    });

    // Set row labels & horizontal guide stripes
    setNames.forEach((sName, sIdx) => {
      const sy = botPaneTop + (sIdx + 0.5) * setRowH;
      if (showGrid && sIdx % 2 === 0) {
        rects.push({
          x: matX0, y: sy - setRowH * 0.42, w: matW, h: setRowH * 0.84,
          fillHex: gridHex, opacity: 0.35, radius: 3, isGrid: true, name: "Set Row Stripe"
        });
      }
      texts.push({
        x: matX0 - 8, y: sy - 5, text: String(sName),
        fontSize: 8.5, fontWeight: "Bold", fillHex: primaryTextHex, align: "RIGHT", name: "Set Label"
      });
    });

    rows.forEach((r, rIdx) => {
      const cx = matX0 + (rIdx + 0.5) * colSlotW;
      const cv = counts[rIdx];
      const by = padT + topPaneH * (1 - cv / cScale.max);
      const bh = Math.max(2, padT + topPaneH - by);

      rects.push({
        x: cx - barW * 0.5, y: by, w: barW, h: bh,
        fillHex: pickColor(0), radius: 3, opacity: 0.92, colorIndex: 0,
        name: "Intersection Bar - " + r[0]
      });
      if (showLabels) {
        texts.push({
          x: cx, y: by - 11, text: formatCompact(cv),
          fontSize: 8, fontWeight: "Bold", fillHex: primaryTextHex, align: "CENTER", name: "Intersection Count"
        });
      }

      const activeYs = [];
      setNames.forEach((sName, sIdx) => {
        const sy = botPaneTop + (sIdx + 0.5) * setRowH;
        const isActive = safeNum(r[sIdx + 2], 0) > 0;
        if (isActive) activeYs.push(sy);
        ellipses.push({
          cx, cy: sy, rx: isActive ? 4.5 : 3.2, ry: isActive ? 4.5 : 3.2,
          fillHex: isActive ? pickColor(1) : gridHex,
          opacity: isActive ? 1 : 0.65,
          colorIndex: isActive ? 1 : 7,
          name: (isActive ? "Active Set Dot - " : "Inactive Dot - ") + sName
        });
      });

      if (activeYs.length >= 2) {
        const minY = Math.min(...activeYs);
        const maxY = Math.max(...activeYs);
        rects.push({
          x: cx - 1.2, y: minY, w: 2.4, h: maxY - minY,
          fillHex: pickColor(1), opacity: 0.95, colorIndex: 1, name: "Intersection Connector - " + r[0]
        });
      }
    });
  }

  else if (chartId === "spc_control") {
    const vals = rows.map(r => safeNum(r[1], 0));
    const stats = computeBoxStats(vals);
    const cl = stats.mean;
    const sd = Math.max(1e-3, stats.std);
    const ucl = cl + 3 * sd;
    const lcl = cl - 3 * sd;
    const scale = drawCartesianGridAndYAxis(Math.min(lcl - sd * 0.5, ...vals), Math.max(ucl + sd * 0.5, ...vals));

    const toY = (v) => padT + innerH * (1 - (v - scale.min) / Math.max(1e-9, scale.max - scale.min));
    const yUCL = clampNum(toY(ucl), padT, padT + innerH);
    const yCL = clampNum(toY(cl), padT, padT + innerH);
    const yLCL = clampNum(toY(lcl), padT, padT + innerH);

    // Control zone band between LCL and UCL
    rects.push({
      x: padL, y: yUCL, w: innerW, h: Math.max(2, yLCL - yUCL),
      fillHex: pickColor(2), opacity: 0.10, colorIndex: 2, name: "SPC +/-3SD Safe Zone"
    });

    // UCL, CL, LCL reference lines
    rects.push({ x: padL, y: yUCL, w: innerW, h: 1.5, fillHex: pickColor(4), opacity: 0.85, colorIndex: 4, name: "UCL (+3SD)" });
    rects.push({ x: padL, y: yCL, w: innerW, h: 1.5, fillHex: pickColor(2), opacity: 0.9, colorIndex: 2, name: "Mean (CL)" });
    rects.push({ x: padL, y: yLCL, w: innerW, h: 1.5, fillHex: pickColor(4), opacity: 0.85, colorIndex: 4, name: "LCL (-3SD)" });

    if (showLabels) {
      texts.push({ x: padL + innerW - 4, y: yUCL - 10, text: "UCL " + formatCompact(ucl), fontSize: 7.5, fontWeight: "Bold", fillHex: pickColor(4), align: "RIGHT", name: "UCL Label" });
      texts.push({ x: padL + innerW - 4, y: yCL - 10, text: "CL " + formatCompact(cl), fontSize: 7.5, fontWeight: "Bold", fillHex: pickColor(2), align: "RIGHT", name: "CL Label" });
      texts.push({ x: padL + innerW - 4, y: yLCL + 2, text: "LCL " + formatCompact(lcl), fontSize: 7.5, fontWeight: "Bold", fillHex: pickColor(4), align: "RIGHT", name: "LCL Label" });
    }

    const stepX = innerW / Math.max(1, rows.length - 1);
    const pts = [];
    rows.forEach((r, idx) => {
      const x = padL + (rows.length === 1 ? innerW * 0.5 : idx * stepX);
      const v = vals[idx];
      const y = toY(v);
      const isOutlier = Math.abs(v - cl) > 2 * sd;
      pts.push({ x, y, v, isOutlier });
      texts.push({
        x, y: padT + innerH + 8, text: String(r[0]),
        fontSize: 8.5, fontWeight: "Regular", fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "X Tick"
      });
    });

    const lineVec = makePolylineVector(pts, pickColor(0), 2.2, "SPC Process Trajectory", 0);
    if (lineVec) vectors.push(lineVec);

    pts.forEach((pt, idx) => {
      const cIdx = pt.isOutlier ? 4 : 0;
      ellipses.push({
        cx: pt.x, cy: pt.y, rx: pt.isOutlier ? 5 : 3.8, ry: pt.isOutlier ? 5 : 3.8,
        fillHex: pickColor(cIdx), strokeHex: isDark ? "#0F172A" : "#FFFFFF", strokeWeight: 1.5,
        opacity: 1, colorIndex: cIdx, name: (pt.isOutlier ? "Out-of-Control Node " : "Sample Node ") + rows[idx][0]
      });
      if (showLabels && (pt.isOutlier || rows.length <= 8)) {
        texts.push({
          x: pt.x, y: pt.y - 12, text: formatCompact(pt.v),
          fontSize: 8, fontWeight: "Bold", fillHex: pickColor(cIdx), align: "CENTER", name: "SPC Value"
        });
      }
    });
  }

  else if (chartId === "regression_ci") {
    const rawPts = rows.map((r, idx) => {
      const xParsed = parseFloat(String(r[0] || "").replace(/[^0-9.+\-]/g, ""));
      const x = Number.isFinite(xParsed) ? xParsed : (idx + 1) * 10;
      const y = safeNum(r[1], 0);
      const err = Math.max(0.1, safeNum(r[2], Math.abs(y) * 0.12 + 0.25));
      return { label: String(r[0]), x, y, err, idx };
    });

    const reg = computeLinearRegression(rawPts);
    const xs = rawPts.map(p => p.x);
    const ysWithErr = [];
    rawPts.forEach(p => { ysWithErr.push(p.y - p.err, p.y + p.err); });

    const xScale = computeNiceScale(Math.min(...xs), Math.max(...xs), 5);
    const yScale = drawCartesianGridAndYAxis(Math.min(...ysWithErr), Math.max(...ysWithErr));

    const toX = (xv) => padL + ((xv - xScale.min) / Math.max(1e-9, xScale.max - xScale.min)) * innerW;
    const toY = (yv) => padT + innerH * (1 - (yv - yScale.min) / Math.max(1e-9, yScale.max - yScale.min));

    // 95% Confidence Interval band polygon across X domain
    const ciSteps = 12;
    const ciTop = [];
    const ciBot = [];
    const meanX = xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    const maxDx = Math.max(1, xScale.max - xScale.min);
    const avgErr = rawPts.reduce((a, b) => a + b.err, 0) / Math.max(1, rawPts.length);
    const baseBand = Math.max(reg.se * 1.4, avgErr * 0.85);

    for (let s = 0; s <= ciSteps; s++) {
      const xv = xScale.min + (s / ciSteps) * (xScale.max - xScale.min);
      const yFit = reg.slope * xv + reg.intercept;
      const curvature = 1 + 0.65 * Math.pow((xv - meanX) / (maxDx * 0.5), 2);
      const ciHalf = baseBand * curvature;
      ciTop.push({ x: toX(xv), y: clampNum(toY(yFit + ciHalf), padT, padT + innerH) });
      ciBot.push({ x: toX(xv), y: clampNum(toY(yFit - ciHalf), padT, padT + innerH) });
    }
    const ciPoly = makeClosedPolygonVector(ciTop.concat(ciBot.reverse()), pickColor(1), null, 0, 0.22, "95% CI Envelope", 1);
    if (ciPoly) vectors.push(ciPoly);

    // OLS Fit Line
    const fitLine = makePolylineVector([
      { x: toX(xScale.min), y: clampNum(toY(reg.slope * xScale.min + reg.intercept), padT, padT + innerH) },
      { x: toX(xScale.max), y: clampNum(toY(reg.slope * xScale.max + reg.intercept), padT, padT + innerH) }
    ], pickColor(4), 2.2, "OLS Regression Line", 4);
    if (fitLine) vectors.push(fitLine);

    // Observed scatter points + vertical error bars
    rawPts.forEach(p => {
      const px = toX(p.x);
      const py = toY(p.y);
      const pyTop = clampNum(toY(p.y + p.err), padT, padT + innerH);
      const pyBot = clampNum(toY(p.y - p.err), padT, padT + innerH);

      // Error whisker stem + caps
      rects.push({ x: px - 0.75, y: pyTop, w: 1.5, h: Math.max(2, pyBot - pyTop), fillHex: pickColor(0), opacity: 0.7, colorIndex: 0, name: "Error Stem - " + p.label });
      rects.push({ x: px - 3.5, y: pyTop, w: 7, h: 1.5, fillHex: pickColor(0), opacity: 0.7, colorIndex: 0, name: "Error Cap Top" });
      rects.push({ x: px - 3.5, y: pyBot, w: 7, h: 1.5, fillHex: pickColor(0), opacity: 0.7, colorIndex: 0, name: "Error Cap Bot" });

      ellipses.push({
        cx: px, cy: py, rx: 4.5, ry: 4.5,
        fillHex: pickColor(0), strokeHex: isDark ? "#0F172A" : "#FFFFFF", strokeWeight: 1.5,
        opacity: 1, colorIndex: 0, name: "Observed Point - " + p.label
      });
    });

    if (showLabels) {
      texts.push({
        x: padL + 10, y: padT + 4,
        text: "R2 = " + reg.r2.toFixed(3) + " | y = " + reg.slope.toFixed(2) + "x + " + reg.intercept.toFixed(2),
        fontSize: 8.5, fontWeight: "Bold", fillHex: pickColor(4), align: "LEFT", name: "Regression Equation"
      });
    }

    xScale.ticks.forEach(xt => {
      texts.push({
        x: toX(xt), y: padT + innerH + 8, text: formatCompact(xt),
        fontSize: 9, fontWeight: "Regular", fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "X Tick"
      });
    });
  }

  else if (chartId === "windrose_coxcomb") {
    const cx = plotW * 0.5;
    const cy = plotH * 0.52;
    const maxR = Math.min(plotW, plotH) * 0.38;
    const nDirs = Math.max(4, rows.length);
    const dirTotals = rows.map(r => {
      let s = 0;
      for (let k = 1; k <= numSeries; k++) s += Math.max(0, safeNum(r[k], 0));
      return s;
    });
    const maxTot = Math.max(1, ...dirTotals);

    if (showGrid) {
      [0.5, 1.0].forEach(lvl => {
        ellipses.push({
          cx, cy, rx: maxR * lvl, ry: maxR * lvl,
          fillHex: null, strokeHex: gridHex, strokeWeight: 1,
          opacity: 0.8, isGrid: true, name: "Polar Grid Ring"
        });
      });
    }

    const sectorSpan = (Math.PI * 2) / nDirs;
    rows.forEach((r, dIdx) => {
      const midA = -Math.PI * 0.5 + dIdx * sectorSpan;
      const startA = midA - sectorSpan * 0.42;
      const endA = midA + sectorSpan * 0.42;
      let cumVal = 0;

      for (let s = 0; s < numSeries; s++) {
        const v = Math.max(0, safeNum(r[s + 1], 0));
        const rInnerRatio = Math.sqrt(cumVal / maxTot);
        cumVal += v;
        const rOuter = Math.max(4, Math.sqrt(cumVal / maxTot) * maxR);
        const innerNorm = clampNum((rInnerRatio * maxR) / rOuter, 0, 0.95);

        ellipses.push({
          cx, cy, rx: rOuter, ry: rOuter,
          fillHex: pickColor(s),
          arcData: { startingAngle: startA, endingAngle: endA, innerRadius: innerNorm },
          opacity: 0.9, colorIndex: s,
          name: "Wind Sector " + r[0] + " - " + (headers[s + 1] || "")
        });
      }

      const lx = cx + Math.cos(midA) * (maxR + 14);
      const ly = cy + Math.sin(midA) * (maxR + 14) - 5;
      texts.push({
        x: lx, y: ly, text: String(r[0]),
        fontSize: 9, fontWeight: "Bold", fillHex: primaryTextHex,
        align: "CENTER", name: "Compass Label"
      });
    });
  }

  else if (chartId === "ternary_simplex") {
    const triSide = Math.min(innerW * 0.75, innerH / (Math.sqrt(3) / 2));
    const triH = triSide * (Math.sqrt(3) / 2);
    const x0 = (plotW - triSide) * 0.5;
    const y0 = padT + (innerH + triH) * 0.5;

    const toPixel = (u, v) => ({
      x: x0 + u * triSide,
      y: y0 - v * triSide
    });

    const vA = toPixel(0, 0);
    const vB = toPixel(1, 0);
    const vC = toPixel(0.5, Math.sqrt(3) / 2);

    // Outer simplex triangle + inner 25%, 50%, 75% 3-axis gridlines
    if (showGrid) {
      [0.25, 0.5, 0.75].forEach(f => {
        // Constant A gridline: (f, 1-f, 0) -> (f, 0, 1-f)
        const a1 = computeBarycentricTernary(f, 1 - f, 0);
        const a2 = computeBarycentricTernary(f, 0, 1 - f);
        const gA = makePolylineVector([toPixel(a1.u, a1.v), toPixel(a2.u, a2.v)], gridHex, 1, "Ternary Grid A", 0);
        if (gA) vectors.push(gA);

        // Constant B gridline: (1-f, f, 0) -> (0, f, 1-f)
        const b1 = computeBarycentricTernary(1 - f, f, 0);
        const b2 = computeBarycentricTernary(0, f, 1 - f);
        const gB = makePolylineVector([toPixel(b1.u, b1.v), toPixel(b2.u, b2.v)], gridHex, 1, "Ternary Grid B", 0);
        if (gB) vectors.push(gB);

        // Constant C gridline: (1-f, 0, f) -> (0, 1-f, f)
        const c1 = computeBarycentricTernary(1 - f, 0, f);
        const c2 = computeBarycentricTernary(0, 1 - f, f);
        const gC = makePolylineVector([toPixel(c1.u, c1.v), toPixel(c2.u, c2.v)], gridHex, 1, "Ternary Grid C", 0);
        if (gC) vectors.push(gC);
      });
    }

    const outerTri = makeClosedPolygonVector([vA, vB, vC], null, primaryTextHex, 1.8, 0, "Ternary Boundary", 0);
    if (outerTri) {
      outerTri.regions = [];
      vectors.push(outerTri);
    }

    texts.push({ x: vA.x - 10, y: vA.y + 4, text: String(headers[1] || "A (100%)"), fontSize: 9, fontWeight: "Bold", fillHex: pickColor(0), align: "RIGHT", name: "Apex A" });
    texts.push({ x: vB.x + 10, y: vB.y + 4, text: String(headers[2] || "B (100%)"), fontSize: 9, fontWeight: "Bold", fillHex: pickColor(1), align: "LEFT", name: "Apex B" });
    texts.push({ x: vC.x, y: vC.y - 14, text: String(headers[3] || "C (100%)"), fontSize: 9, fontWeight: "Bold", fillHex: pickColor(2), align: "CENTER", name: "Apex C" });

    const placedPts = rows.map((r, idx) => {
      const bary = computeBarycentricTernary(r[1], r[2], r[3]);
      const pt = toPixel(bary.u, bary.v);
      return { r, idx, bary, pt };
    });

    placedPts.forEach(item => {
      const { r, idx, bary, pt } = item;
      const col = pickColor(idx);
      ellipses.push({
        cx: pt.x, cy: pt.y, rx: 5.5, ry: 5.5,
        fillHex: col, strokeHex: isDark ? "#0F172A" : "#FFFFFF", strokeWeight: 1.5,
        opacity: 0.9, colorIndex: idx, name: "Ternary Sample - " + r[0]
      });
      if (showLabels) {
        // Place label on LEFT of point if near the right triangle boundary (aNorm < 0.28)
        // or if another point sits to its right within vertical proximity
        const hasRightNeighbor = placedPts.some(
          other => other.idx !== idx && Math.abs(other.pt.y - pt.y) < 13 && other.pt.x > pt.x && (other.pt.x - pt.x) < 95
        );
        const placeLeft = bary.aNorm < 0.28 || hasRightNeighbor;
        texts.push({
          x: placeLeft ? (pt.x - 8) : (pt.x + 8),
          y: pt.y - 5,
          text: String(r[0]),
          fontSize: 8,
          fontWeight: "Bold",
          fillHex: primaryTextHex,
          align: placeLeft ? "RIGHT" : "LEFT",
          name: "Sample Label"
        });
      }
    });
  }

  else if (chartId === "horizon_band") {
    const nCols = Math.max(2, headers.length - 1);
    let maxVal = 10;
    rows.forEach(r => {
      for (let c = 1; c <= nCols; c++) {
        const v = Math.max(0, safeNum(r[c], 0));
        if (v > maxVal) maxVal = v;
      }
    });
    const maxLabelChars = Math.max(8, ...rows.map(r => String((r && r[0]) || "").length));
    const leftW = Math.min(115, Math.max(82, maxLabelChars * 5.6));
    const plotX0 = leftW;
    const availW = Math.max(80, plotW - plotX0 - padR);
    const stepX = availW / Math.max(1, nCols - 1);
    const bandGap = 6;
    const nRows = Math.max(1, rows.length);
    const stripH = Math.max(18, (innerH - bandGap * (nRows - 1)) / nRows);

    for (let c = 0; c < nCols; c++) {
      const x = plotX0 + c * stepX;
      texts.push({
        x, y: padT + innerH + 8, text: String(headers[c + 1] || ("T" + c)),
        fontSize: 8.5, fontWeight: "Regular", fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "X Tick"
      });
    }

    rows.forEach((r, rIdx) => {
      const yTop = padT + rIdx * (stripH + bandGap);
      const yBase = yTop + stripH;
      const col = pickColor(rIdx);

      rects.push({
        x: plotX0, y: yTop, w: availW, h: stripH,
        fillHex: gridHex, radius: 3, opacity: 0.25, isGrid: true, name: "Horizon Track - " + r[0]
      });
      texts.push({
        x: plotX0 - 8, y: yTop + stripH * 0.5 - 5,
        text: String(r[0]), fontSize: 8.5, fontWeight: "Bold",
        fillHex: primaryTextHex, align: "RIGHT", name: "Station Label"
      });

      const rawVals = [];
      for (let c = 0; c < nCols; c++) rawVals.push(Math.max(0, safeNum(r[c + 1], 0)));

      // 3 folded horizon bands (0..33%, 33..66%, 66..100% of maxVal)
      const bandMax = maxVal / 3;
      const opacities = [0.34, 0.56, 0.85];
      for (let b = 0; b < 3; b++) {
        const bFloor = b * bandMax;
        const pts = rawVals.map((v, cIdx) => {
          const folded = clampNum((v - bFloor) / Math.max(1e-9, bandMax), 0, 1);
          return {
            x: plotX0 + cIdx * stepX,
            y: yBase - folded * (stripH - 2)
          };
        });
        const smoothTop = subdivideCatmullRom(pts, 4);
        const polyPts = [{ x: plotX0, y: yBase }].concat(smoothTop).concat([{ x: plotX0 + availW, y: yBase }]);
        const bandVec = makeClosedPolygonVector(polyPts, col, b === 2 ? col : null, b === 2 ? 1.2 : 0, opacities[b], "Horizon Band " + (b + 1) + " - " + r[0], rIdx);
        if (bandVec) vectors.push(bandVec);
      }

      if (showLabels) {
        const peakV = Math.max(...rawVals);
        texts.push({
          x: plotX0 + availW - 6, y: yTop + 3,
          text: "Peak " + formatCompact(peakV), fontSize: 7.5, fontWeight: "Bold",
          fillHex: primaryTextHex, align: "RIGHT", name: "Horizon Peak"
        });
      }
    });
  }

  else if (chartId === "calendar_heatmap") {
    const dayHeaders = headers.slice(1).length > 0 ? headers.slice(1) : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const nCols = dayHeaders.length;
    const nRows = Math.max(1, rows.length);
    let minV = Infinity, maxV = -Infinity;
    rows.forEach(r => {
      for (let c = 1; c <= nCols; c++) {
        const v = safeNum(r[c], 0);
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
    });
    if (!Number.isFinite(minV)) minV = 0;
    if (!Number.isFinite(maxV) || maxV <= minV) maxV = minV + 100;

    const leftW = 68;
    const topHdrH = 18;
    const gridX0 = padL + leftW - 24;
    const gridY0 = padT + topHdrH;
    const availW = Math.max(80, plotW - gridX0 - padR);
    const availH = Math.max(60, innerH - topHdrH);
    const gap = 4;
    const cellW = Math.max(12, (availW - gap * (nCols - 1)) / nCols);
    const cellH = Math.max(12, (availH - gap * (nRows - 1)) / nRows);

    dayHeaders.forEach((dh, cIdx) => {
      texts.push({
        x: gridX0 + cIdx * (cellW + gap) + cellW * 0.5,
        y: padT + 2,
        text: String(dh), fontSize: 8.5, fontWeight: "Bold",
        fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "Day Header"
      });
    });

    rows.forEach((r, rIdx) => {
      const cy = gridY0 + rIdx * (cellH + gap);
      texts.push({
        x: gridX0 - 8, y: cy + cellH * 0.5 - 5,
        text: String(r[0]), fontSize: 8.5, fontWeight: "Bold",
        fillHex: primaryTextHex, align: "RIGHT", name: "Week Label"
      });

      for (let cIdx = 0; cIdx < nCols; cIdx++) {
        const cx = gridX0 + cIdx * (cellW + gap);
        const v = safeNum(r[cIdx + 1], 0);
        const norm = clampNum((v - minV) / Math.max(1e-9, maxV - minV), 0, 1);
        const cStop = norm < 0.25 ? 7 : (norm < 0.5 ? 3 : (norm < 0.78 ? 0 : 2));
        const alpha = 0.30 + norm * 0.70;

        rects.push({
          x: cx, y: cy, w: cellW, h: cellH,
          fillHex: pickColor(cStop), radius: 3.5, opacity: alpha, colorIndex: cStop,
          name: "Calendar Cell " + r[0] + " " + dayHeaders[cIdx]
        });
        if (showLabels && cellW >= 24 && cellH >= 16) {
          texts.push({
            x: cx + cellW * 0.5, y: cy + cellH * 0.5 - 5,
            text: formatCompact(v), fontSize: 7.5, fontWeight: "Bold",
            fillHex: norm > 0.45 ? "#FFFFFF" : primaryTextHex, align: "CENTER", name: "Cell Value"
          });
        }
      }
    });
  }

  else if (chartId === "radial_bar") {
    const cx = plotW * 0.54;
    const cy = plotH * 0.52;
    const maxR = Math.min(plotW * 0.42, plotH * 0.44);
    const nRings = Math.min(6, Math.max(1, rows.length));
    const minR = maxR * 0.30;
    const ringStep = (maxR - minR) / Math.max(1, nRings);
    const startA = -Math.PI * 0.5;
    const maxSweep = Math.PI * 1.65; // 297 deg sweep leaving top-left label channel

    rows.slice(0, nRings).forEach((r, idx) => {
      const rOuter = maxR - idx * ringStep;
      const thickness = Math.max(5, ringStep * 0.72);
      const innerRatio = clampNum((rOuter - thickness) / Math.max(1, rOuter), 0.2, 0.92);
      const val = Math.max(0, safeNum(r[1], 75));
      const maxVal = Math.max(100, safeNum(r[2], 100), val);
      const frac = clampNum(val / maxVal, 0.02, 1);
      const endA = startA + frac * maxSweep;
      const col = pickColor(idx);

      if (showGrid) {
        ellipses.push({
          cx, cy, rx: rOuter, ry: rOuter,
          fillHex: gridHex,
          arcData: { startingAngle: startA, endingAngle: startA + maxSweep, innerRadius: innerRatio },
          opacity: 0.45, isGrid: true, name: "Radial Track - " + r[0]
        });
      }

      ellipses.push({
        cx, cy, rx: rOuter, ry: rOuter,
        fillHex: col,
        arcData: { startingAngle: startA, endingAngle: endA, innerRadius: innerRatio },
        opacity: 0.95, colorIndex: idx, name: "Radial Ring - " + r[0]
      });

      const labelY = cy - rOuter + thickness * 0.5 - 5;
      texts.push({
        x: cx - 8, y: labelY,
        text: String(r[0]) + (showLabels ? " (" + Math.round((val / maxVal) * 100) + "%)" : ""),
        fontSize: 8, fontWeight: "Bold", fillHex: col, align: "RIGHT", name: "Radial Label"
      });
    });
  }

  else if (chartId === "correlation_matrix") {
    const colVars = headers.slice(1).length > 0 ? headers.slice(1) : rows.map(r => String(r[0]));
    const nCols = colVars.length;
    const nRows = Math.max(1, rows.length);
    const leftW = 72;
    const topH = 18;
    const side = Math.min(plotW - padL - leftW - padR + 20, innerH - topH);
    const gridX0 = padL + leftW - 10 + (plotW - padL - leftW - padR - side) * 0.5;
    const gridY0 = padT + topH;
    const gap = 3;
    const cellW = Math.max(16, (side - gap * (nCols - 1)) / nCols);
    const cellH = Math.max(16, (side - gap * (nRows - 1)) / nRows);

    colVars.forEach((cv, cIdx) => {
      texts.push({
        x: gridX0 + cIdx * (cellW + gap) + cellW * 0.5,
        y: padT + 2,
        text: String(cv), fontSize: 8.5, fontWeight: "Bold",
        fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "Matrix Col Header"
      });
    });

    rows.forEach((r, rIdx) => {
      const cy = gridY0 + rIdx * (cellH + gap);
      texts.push({
        x: gridX0 - 8, y: cy + cellH * 0.5 - 5,
        text: String(r[0]), fontSize: 8.5, fontWeight: "Bold",
        fillHex: primaryTextHex, align: "RIGHT", name: "Matrix Row Label"
      });

      for (let cIdx = 0; cIdx < nCols; cIdx++) {
        const cx = gridX0 + cIdx * (cellW + gap);
        const corr = clampNum(safeNum(r[cIdx + 1], rIdx === cIdx ? 1 : 0), -1, 1);
        const mag = Math.abs(corr);
        const cIndex = corr >= 0 ? (corr > 0.85 ? 2 : 0) : (corr < -0.5 ? 4 : 1);
        const alpha = 0.25 + mag * 0.72;

        rects.push({
          x: cx, y: cy, w: cellW, h: cellH,
          fillHex: pickColor(cIndex), radius: 3, opacity: alpha, colorIndex: cIndex,
          name: "Correlation Cell " + r[0] + " x " + colVars[cIdx]
        });

        if (showLabels && cellW >= 22 && cellH >= 15) {
          texts.push({
            x: cx + cellW * 0.5, y: cy + cellH * 0.5 - 5,
            text: corr.toFixed(2), fontSize: 7.5, fontWeight: "Bold",
            fillHex: mag > 0.45 ? "#FFFFFF" : primaryTextHex, align: "CENTER", name: "Corr Value"
          });
        }
      }
    });
  }

  else {
    // horizon_bivariate_calendar / Matrix Heatmap (3x3 Bivariate Grid + Legend)
    const nRows = Math.max(1, Math.ceil(Math.sqrt(rows.length)));
    const nCols = Math.max(1, Math.ceil(rows.length / nRows));
    const gridW = innerW * 0.66;
    const cellGap = 4;
    const cellW = (gridW - cellGap * (nCols - 1)) / nCols;
    const cellH = (innerH - cellGap * (nRows - 1)) / nRows;

    rows.forEach((r, idx) => {
      const rr = Math.floor(idx / nCols);
      const cc = idx % nCols;
      const vx = clampNum(r[1], 0, 100);
      const vy = clampNum(r[2], 0, 100);
      const tierX = vx < 34 ? 0 : (vx < 67 ? 1 : 2);
      const tierY = vy < 34 ? 0 : (vy < 67 ? 1 : 2);
      const bivIdx = tierY * 3 + tierX;
      const cx = padL + cc * (cellW + cellGap);
      const cy = padT + rr * (cellH + cellGap);

      rects.push({
        x: cx, y: cy, w: cellW, h: cellH,
        fillHex: pickColor(bivIdx), radius: 4, opacity: 0.95, colorIndex: bivIdx,
        name: "Bivariate Cell - " + r[0]
      });
      if (showLabels) {
        texts.push({
          x: cx + cellW * 0.5, y: cy + cellH * 0.5 - 6,
          text: String(r[0]) + " (" + Math.round(vx) + "," + Math.round(vy) + ")",
          fontSize: 8.5, fontWeight: "Bold", fillHex: "#FFFFFF", align: "CENTER", name: "Cell Label"
        });
      }
    });

    // 3x3 Bivariate Key Legend on right
    const legSide = Math.min(84, innerW * 0.24);
    const legX0 = padL + gridW + 24;
    const legY0 = padT + (innerH - legSide) * 0.5;
    const sw = (legSide - 6) / 3;
    for (let ty = 0; ty < 3; ty++) {
      for (let tx = 0; tx < 3; tx++) {
        const bIdx = ty * 3 + tx;
        rects.push({
          x: legX0 + tx * (sw + 3),
          y: legY0 + (2 - ty) * (sw + 3),
          w: sw, h: sw,
          fillHex: pickColor(bIdx), radius: 2, opacity: 1, colorIndex: bIdx,
          name: "Legend 3x3 [" + (tx + 1) + "," + (ty + 1) + "]"
        });
      }
    }
    texts.push({
      x: legX0 + legSide * 0.5, y: legY0 + legSide + 8,
      text: "3x3 Bivariate Key", fontSize: 8, fontWeight: "Bold",
      fillHex: axisTextHex, align: "CENTER", isMuted: true, name: "Legend Title"
    });
  }

  // Post-Process X-Axis Category Labels: Anti-Overlap Truncation & Optional Diagonal Tilt (/)
  const xSlotWidth = innerW / Math.max(1, rows.length);
  const maxHorizChars = Math.max(6, Math.floor(xSlotWidth / 5.8));
  const xAxisNames = new Set([
    "X Label", "X Tick", "Candle X", "Step Label",
    "Session Label", "Mekko X Label", "Bin Label"
  ]);

  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (xAxisNames.has(t.name) || t.isXAxis === true) {
      const rawStr = String(t.text || "");
      if (diagonalLabels) {
        t.text = rawStr.length > 22 ? (rawStr.slice(0, 21) + "...") : rawStr;
        t.rotation = -35;
        t.align = "RIGHT";
        t.y = safeNum(t.y, padT + innerH + 8) - 2;
      } else if (rawStr.length > maxHorizChars) {
        t.text = rawStr.slice(0, Math.max(5, maxHorizChars - 1)) + "...";
      }
    }
  }

  return { plotW, plotH, rects, ellipses, vectors, texts };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    safeNum,
    clampNum,
    formatCompact,
    computeNiceScale,
    computeBoxStats,
    computeKDE,
    computeBeeswarmOffsets,
    relaxVerticalLabels,
    computeBarycentricTernary,
    computeLinearRegression,
    normalizeGoogleSheetCsvUrl,
    parseTabularInput,
    computeCardLayoutMetrics,
    resolveChartLegendEntries,
    resolveChartLegendItems,
    buildChartGeometryPrimitives
  };
}
