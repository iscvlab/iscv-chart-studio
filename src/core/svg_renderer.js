// ============================================================================
// ISCV Chart Studio | Self-Contained SVG Renderer & Spec Normalizer
// Pure Node.js + Browser compatible (0 DOM, 0 Figma API, 0 network calls)
// ============================================================================

const { ISCV_PALETTES, getPaletteById } = require("./palettes.js");
const { ISCV_PACKS, ISCV_CHART_CATALOG, getChartPresetById } = require("./presets.js");
const {
  safeNum,
  clampNum,
  parseTabularInput,
  computeCardLayoutMetrics,
  resolveChartLegendEntries,
  buildChartGeometryPrimitives
} = require("./math_solvers.js");

const FONT_STACK = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function escapeXml(str) {
  return String(str === undefined || str === null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(n, decimals = 2) {
  const v = Number.isFinite(n) ? n : 0;
  return Number(v.toFixed(decimals)).toString();
}

function arcDataToSvgPath(cx, cy, rOuter, startAngle, endAngle, innerRatio) {
  const rOut = Math.max(0.5, safeNum(rOuter, 10));
  const rIn = Math.max(0, rOut * clampNum(safeNum(innerRatio, 0), 0, 0.99));
  const sa = safeNum(startAngle, 0);
  const ea = safeNum(endAngle, Math.PI * 2);
  const span = Math.abs(ea - sa);

  if (span >= Math.PI * 1.999) {
    if (rIn <= 0.5) {
      return (
        `M ${fmt(cx - rOut)} ${fmt(cy)} ` +
        `A ${fmt(rOut)} ${fmt(rOut)} 0 1 1 ${fmt(cx + rOut)} ${fmt(cy)} ` +
        `A ${fmt(rOut)} ${fmt(rOut)} 0 1 1 ${fmt(cx - rOut)} ${fmt(cy)} Z`
      );
    }
    return [
      `M ${fmt(cx - rOut)} ${fmt(cy)}`,
      `A ${fmt(rOut)} ${fmt(rOut)} 0 1 1 ${fmt(cx + rOut)} ${fmt(cy)}`,
      `A ${fmt(rOut)} ${fmt(rOut)} 0 1 1 ${fmt(cx - rOut)} ${fmt(cy)}`,
      `M ${fmt(cx - rIn)} ${fmt(cy)}`,
      `A ${fmt(rIn)} ${fmt(rIn)} 0 1 0 ${fmt(cx + rIn)} ${fmt(cy)}`,
      `A ${fmt(rIn)} ${fmt(rIn)} 0 1 0 ${fmt(cx - rIn)} ${fmt(cy)}`,
      "Z"
    ].join(" ");
  }

  const x1 = cx + rOut * Math.cos(sa);
  const y1 = cy + rOut * Math.sin(sa);
  const x2 = cx + rOut * Math.cos(ea);
  const y2 = cy + rOut * Math.sin(ea);
  const largeArc = span > Math.PI ? 1 : 0;
  const sweep = ea >= sa ? 1 : 0;

  if (rIn <= 0.5) {
    return `M ${fmt(cx)} ${fmt(cy)} L ${fmt(x1)} ${fmt(y1)} A ${fmt(rOut)} ${fmt(rOut)} 0 ${largeArc} ${sweep} ${fmt(x2)} ${fmt(y2)} Z`;
  }

  const ix2 = cx + rIn * Math.cos(ea);
  const iy2 = cy + rIn * Math.sin(ea);
  const ix1 = cx + rIn * Math.cos(sa);
  const iy1 = cy + rIn * Math.sin(sa);
  const innerSweep = sweep === 1 ? 0 : 1;

  return [
    `M ${fmt(x1)} ${fmt(y1)}`,
    `A ${fmt(rOut)} ${fmt(rOut)} 0 ${largeArc} ${sweep} ${fmt(x2)} ${fmt(y2)}`,
    `L ${fmt(ix2)} ${fmt(iy2)}`,
    `A ${fmt(rIn)} ${fmt(rIn)} 0 ${largeArc} ${innerSweep} ${fmt(ix1)} ${fmt(iy1)}`,
    "Z"
  ].join(" ");
}

function vectorNetworkToSvgPath(vn, offsetX = 0, offsetY = 0) {
  if (!vn || !Array.isArray(vn.vertices) || vn.vertices.length < 2) {
    return "";
  }
  const verts = vn.vertices;
  const segs = Array.isArray(vn.segments) ? vn.segments : [];
  const hasRegion = Array.isArray(vn.regions) && vn.regions.length > 0;

  if (hasRegion || segs.length === 0) {
    const pts = [];
    for (let i = 0; i < verts.length; i++) {
      const pt = verts[i];
      if (!pt) continue;
      const x = safeNum(pt.x, 0) + offsetX;
      const y = safeNum(pt.y, 0) + offsetY;
      pts.push(`${i === 0 ? "M" : "L"} ${fmt(x)} ${fmt(y)}`);
    }
    if (hasRegion && pts.length > 0) pts.push("Z");
    return pts.join(" ");
  }

  const parts = [];
  let currentEnd = -1;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (!s) continue;
    const vStart = verts[s.start];
    const vEnd = verts[s.end];
    if (!vStart || !vEnd) continue;

    const x0 = safeNum(vStart.x, 0) + offsetX;
    const y0 = safeNum(vStart.y, 0) + offsetY;
    const x1 = safeNum(vEnd.x, 0) + offsetX;
    const y1 = safeNum(vEnd.y, 0) + offsetY;

    if (s.start !== currentEnd) {
      parts.push(`M ${fmt(x0)} ${fmt(y0)}`);
    }

    const ts = s.tangentStart || { x: 0, y: 0 };
    const te = s.tangentEnd || { x: 0, y: 0 };
    if (
      Math.abs(safeNum(ts.x, 0)) > 0.01 ||
      Math.abs(safeNum(ts.y, 0)) > 0.01 ||
      Math.abs(safeNum(te.x, 0)) > 0.01 ||
      Math.abs(safeNum(te.y, 0)) > 0.01
    ) {
      const cx1 = x0 + safeNum(ts.x, 0);
      const cy1 = y0 + safeNum(ts.y, 0);
      const cx2 = x1 + safeNum(te.x, 0);
      const cy2 = y1 + safeNum(te.y, 0);
      parts.push(`C ${fmt(cx1)} ${fmt(cy1)}, ${fmt(cx2)} ${fmt(cy2)}, ${fmt(x1)} ${fmt(y1)}`);
    } else {
      parts.push(`L ${fmt(x1)} ${fmt(y1)}`);
    }
    currentEnd = s.end;
  }
  return parts.join(" ");
}

function sanitizeCell(val) {
  if (typeof val === "number") {
    return Number.isFinite(val) ? val : 0;
  }
  if (typeof val === "boolean") {
    return val ? 1 : 0;
  }
  if (val === null || val === undefined) {
    return "";
  }
  const s = String(val).trim();
  if (s === "-" || s === "--") return 0;
  const cleaned = s.replace(/,/g, "");
  if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return s;
}

function sanitizeTable(headers, rows, fallbackHeaders, fallbackRows) {
  const safeHeaders =
    Array.isArray(headers) && headers.length > 0
      ? headers.map((h, i) => {
          const s = String(h === undefined || h === null ? "" : h).trim();
          return s || `Col ${i + 1}`;
        })
      : [...fallbackHeaders];

  let safeRows = [];
  if (Array.isArray(rows) && rows.length > 0) {
    if (typeof rows[0] === "object" && rows[0] !== null && !Array.isArray(rows[0])) {
      // Array of objects support when callers pass [{ Quarter: "Q1", Rev: 42 }]
      const keys = Object.keys(rows[0]);
      const useHeaders = Array.isArray(headers) && headers.length > 0 ? safeHeaders : keys;
      safeRows = rows.map(obj => useHeaders.map(k => sanitizeCell(obj[k])));
      return { headers: useHeaders, rows: safeRows.length ? safeRows : fallbackRows.map(r => [...r]) };
    }
    safeRows = rows
      .filter(r => Array.isArray(r) && r.length > 0)
      .map(r => {
        const padded = [];
        for (let c = 0; c < safeHeaders.length; c++) {
          padded.push(sanitizeCell(r[c]));
        }
        return padded;
      });
  }

  if (safeRows.length === 0) {
    safeRows = fallbackRows.map(r => [...r]);
  }
  return { headers: safeHeaders, rows: safeRows };
}

function normalizeBool(val, defaultVal = false) {
  if (val === undefined || val === null) return defaultVal;
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no" || s === "") return false;
  }
  return Boolean(val);
}

function escapeCsvCell(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvString(headers, rows) {
  const lines = [];
  if (Array.isArray(headers) && headers.length > 0) {
    lines.push(headers.map(escapeCsvCell).join(","));
  }
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (Array.isArray(row)) {
        lines.push(row.map(escapeCsvCell).join(","));
      } else if (row && typeof row === "object" && Array.isArray(headers)) {
        lines.push(headers.map(h => escapeCsvCell(row[h])).join(","));
      }
    }
  }
  return lines.join("\n");
}

function normalizeChartSpec(input = {}) {
  const src = input && typeof input === "object" ? input : {};
  const preset = getChartPresetById(src.chartId || "bar_grouped");
  const isDark = normalizeBool(src.isDark, false);
  const palette = getPaletteById(src.paletteId || "iscv_swiss_signal", isDark);

  let parsed = null;
  if (typeof src.rawData === "string" && src.rawData.trim()) {
    try {
      const res = parseTabularInput(src.rawData, src.range || "");
      if (res && Array.isArray(res.headers) && res.headers.length > 0 && Array.isArray(res.rows) && res.rows.length > 0) {
        parsed = res;
      }
    } catch (_) {
      parsed = null;
    }
  }

  const hasCustomRawData = Boolean(parsed) || (typeof src.rawData === "string" && src.rawData.trim().length > 0);
  const hasCustomRows = Array.isArray(src.rows) && src.rows.length > 0;
  const hasCustomTitle =
    src.title !== undefined &&
    String(src.title).trim() !== "" &&
    String(src.title).trim() !== String(preset.title || "").trim();
  const hasCustomInput = hasCustomRawData || hasCustomRows || hasCustomTitle;

  const table = parsed
    ? sanitizeTable(parsed.headers, parsed.rows, preset.headers, preset.rows)
    : sanitizeTable(src.headers, src.rows, preset.headers, preset.rows);

  const cardWidth = Math.round(clampNum(safeNum(src.cardWidth, 680), 320, 2400));
  const cardHeight = Math.round(clampNum(safeNum(src.cardHeight, 440), 220, 1600));

  let resolvedTitle;
  if (src.title !== undefined && String(src.title).trim() !== "") {
    resolvedTitle = String(src.title);
  } else if (src.title === "") {
    resolvedTitle = "";
  } else if (hasCustomRawData || hasCustomRows) {
    resolvedTitle = preset.name;
  } else {
    resolvedTitle = preset.title;
  }

  const resolvedSubtitle =
    src.subtitle !== undefined
      ? String(src.subtitle)
      : (hasCustomInput ? "" : (preset.subtitle || ""));

  const resolvedSource =
    src.source !== undefined
      ? String(src.source)
      : (hasCustomInput ? "ISCV Chart Studio" : (preset.source || "ISCV Chart Studio"));

  return {
    chartId: preset.id,
    packId: preset.packId,
    chartName: preset.name,
    paletteId: palette.id,
    paletteName: palette.name,
    isDark,
    title: resolvedTitle,
    subtitle: resolvedSubtitle,
    source: resolvedSource,
    headers: table.headers,
    rows: table.rows,
    cardWidth,
    cardHeight,
    showHeader: src.showHeader !== undefined ? normalizeBool(src.showHeader, true) : true,
    showLegend: src.showLegend !== undefined ? normalizeBool(src.showLegend, true) : true,
    showGrid: src.showGrid !== undefined ? normalizeBool(src.showGrid, true) : true,
    showLabels: src.showLabels !== undefined ? normalizeBool(src.showLabels, true) : true,
    diagonalLabels: normalizeBool(src.diagonalLabels, false),
    showFooter: src.showFooter !== undefined ? normalizeBool(src.showFooter, true) : true
  };
}

function renderChartSvg(rawSpec = {}) {
  const spec = normalizeChartSpec(rawSpec);
  const palette = getPaletteById(spec.paletteId, spec.isDark);
  const colors = palette.activeColors || (spec.isDark ? palette.darkColors : palette.lightColors);

  const cardW = spec.cardWidth;
  const cardH = spec.cardHeight;
  const layout = computeCardLayoutMetrics(cardW, cardH, spec.showHeader, spec.showLegend, spec.showFooter);

  const geom = buildChartGeometryPrimitives({
    chartId: spec.chartId,
    headers: spec.headers,
    rows: spec.rows,
    plotWidth: layout.plotW,
    plotHeight: layout.plotH,
    colors,
    isDark: spec.isDark,
    showGrid: spec.showGrid,
    showLabels: spec.showLabels,
    diagonalLabels: spec.diagonalLabels
  });

  const cardBg = spec.isDark ? "#0B0F19" : "#FFFFFF";
  const cardBorder = spec.isDark ? "#1E293B" : "#CBD5E1";
  const titleCol = spec.isDark ? "#F8FAFC" : "#0F172A";
  const mutedCol = spec.isDark ? "#94A3B8" : "#64748B";

  const out = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${cardH}" viewBox="0 0 ${cardW} ${cardH}" font-family="${escapeXml(FONT_STACK)}">`
  );

  // Explicit card background rect so standalone SVG/PNG exports never render transparent
  out.push(
    `<rect x="0.5" y="0.5" width="${cardW - 1}" height="${cardH - 1}" rx="10" fill="${cardBg}" stroke="${cardBorder}" stroke-width="1" />`
  );

  // Header
  if (spec.showHeader) {
    out.push(
      `<text x="${fmt(layout.padX, 1)}" y="${fmt(layout.padTop + 13, 1)}" fill="${titleCol}" font-family="${escapeXml(FONT_STACK)}" font-size="14" font-weight="700">${escapeXml(spec.title)}</text>`
    );
    if (spec.subtitle) {
      out.push(
        `<text x="${fmt(layout.padX, 1)}" y="${fmt(layout.padTop + 29, 1)}" fill="${mutedCol}" font-family="${escapeXml(FONT_STACK)}" font-size="10.5" font-weight="400">${escapeXml(spec.subtitle)}</text>`
      );
    }
  }

  // Legend
  if (spec.showLegend) {
    const entries = resolveChartLegendEntries(spec.chartId, spec.headers, spec.rows, colors);
    let lx = layout.padX;
    const ly = layout.padTop + layout.headerH + 11;
    const availLegendW = Math.max(200, cardW - layout.padX * 2);
    const maxChars = entries.length >= 6 ? 15 : 18;
    const itemWidths = entries.map(entry => {
      const sName = String(entry && entry.label !== undefined ? entry.label : entry || "");
      const dispName = sName.length > maxChars ? `${sName.slice(0, maxChars - 1)}...` : sName;
      return { entry, dispName, w: Math.max(50, dispName.length * 5.6 + 22) };
    });
    const totalLegendW = itemWidths.reduce((acc, it) => acc + it.w, 0);
    const scaleStep = totalLegendW > availLegendW ? availLegendW / totalLegendW : 1.0;

    for (let idx = 0; idx < itemWidths.length; idx++) {
      const { entry, dispName, w } = itemWidths[idx];
      const cIdx = entry && typeof entry.colorIndex === "number" ? entry.colorIndex : idx;
      const cHex = entry && entry.colorHex ? entry.colorHex : colors[cIdx % colors.length];
      out.push(`<rect x="${fmt(lx, 1)}" y="${fmt(ly - 7, 1)}" width="8" height="8" rx="2" fill="${cHex}" />`);
      out.push(
        `<text x="${fmt(lx + 12, 1)}" y="${fmt(ly, 1)}" fill="${mutedCol}" font-family="${escapeXml(FONT_STACK)}" font-size="${scaleStep < 0.92 ? "8.8" : "9.5"}" font-weight="700">${escapeXml(dispName)}</text>`
      );
      lx += w * scaleStep;
    }
  }

  // Plot Canvas Area
  out.push(`<g transform="translate(${fmt(layout.padX, 1)}, ${fmt(layout.offsetY, 1)})">`);

  for (const r of geom.rects || []) {
    const x = safeNum(r.x, 0);
    const y = safeNum(r.y, 0);
    const w = Math.max(1, safeNum(r.w, 2));
    const h = Math.max(1, safeNum(r.h, 2));
    const rx = safeNum(r.radius || r.cornerRadius, 0);
    const fill = r.fillHex || "none";
    const op = r.opacity !== undefined ? clampNum(safeNum(r.opacity, 1), 0, 1) : 1;
    const stroke = r.strokeHex ? ` stroke="${r.strokeHex}" stroke-width="${fmt(safeNum(r.strokeWeight, 1))}"` : "";
    const label = r.name && !r.isGrid ? String(r.name) : "";
    const interactiveAttrs = label
      ? ` class="iscv-datum" data-label="${escapeXml(label)}"`
      : "";
    if (label) {
      out.push(
        `<rect${interactiveAttrs} x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(rx)}" fill="${fill}" fill-opacity="${fmt(op, 3)}"${stroke}><title>${escapeXml(label)}</title></rect>`
      );
    } else {
      out.push(
        `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(rx)}" fill="${fill}" fill-opacity="${fmt(op, 3)}"${stroke} />`
      );
    }
  }

  for (const v of geom.vectors || []) {
    const d = vectorNetworkToSvgPath(v, safeNum(v.x, 0), safeNum(v.y, 0));
    if (!d) continue;
    const fill = v.fillHex || "none";
    const fillOp =
      v.fillOpacity !== undefined
        ? clampNum(safeNum(v.fillOpacity, 1), 0, 1)
        : v.opacity !== undefined
          ? clampNum(safeNum(v.opacity, 1), 0, 1)
          : 1;
    const stroke = v.strokeHex || "none";
    const strokeOp =
      v.strokeOpacity !== undefined
        ? clampNum(safeNum(v.strokeOpacity, 1), 0, 1)
        : v.fillHex
          ? 1
          : v.opacity !== undefined
            ? clampNum(safeNum(v.opacity, 1), 0, 1)
            : 1;
    const sw = safeNum(v.strokeWeight, 1.5);
    const dashArr = v.dashPattern || v.dash;
    const dash = Array.isArray(dashArr) && dashArr.length ? ` stroke-dasharray="${dashArr.map(n => fmt(safeNum(n, 2), 1)).join(" ")}"` : "";
    const label = v.name && !v.isGrid ? String(v.name) : "";
    if (label) {
      out.push(
        `<path class="iscv-datum" data-label="${escapeXml(label)}" d="${d}" fill="${fill}" fill-opacity="${fmt(fillOp, 3)}" stroke="${stroke}" stroke-opacity="${fmt(strokeOp, 3)}" stroke-width="${fmt(sw)}" stroke-linecap="round" stroke-linejoin="round"${dash}><title>${escapeXml(label)}</title></path>`
      );
    } else {
      out.push(
        `<path d="${d}" fill="${fill}" fill-opacity="${fmt(fillOp, 3)}" stroke="${stroke}" stroke-opacity="${fmt(strokeOp, 3)}" stroke-width="${fmt(sw)}" stroke-linecap="round" stroke-linejoin="round"${dash} />`
      );
    }
  }

  for (const el of geom.ellipses || []) {
    const cx = el.cx !== undefined ? safeNum(el.cx, 0) : safeNum(el.x, 0) + safeNum(el.w, 8) * 0.5;
    const cy = el.cy !== undefined ? safeNum(el.cy, 0) : safeNum(el.y, 0) + safeNum(el.h, 8) * 0.5;
    const rx = Math.max(1, el.rx !== undefined ? safeNum(el.rx, 4) : safeNum(el.w, 8) * 0.5);
    const ry = Math.max(1, el.ry !== undefined ? safeNum(el.ry, 4) : safeNum(el.h, 8) * 0.5);
    const fill = el.fillHex || "none";
    const stroke = el.strokeHex || "none";
    const sw = safeNum(el.strokeWeight, 1);
    const op = el.opacity !== undefined ? clampNum(safeNum(el.opacity, 1), 0, 1) : 1;
    const label = el.name && !el.isGrid ? String(el.name) : "";
    const interactiveAttrs = label ? ` class="iscv-datum" data-label="${escapeXml(label)}"` : "";

    if (el.arcData) {
      const d = arcDataToSvgPath(
        cx,
        cy,
        Math.min(rx, ry),
        el.arcData.startingAngle,
        el.arcData.endingAngle,
        el.arcData.innerRadius
      );
      if (label) {
        out.push(
          `<path${interactiveAttrs} d="${d}" fill="${fill}" fill-opacity="${fmt(op, 3)}" stroke="${stroke}" stroke-width="${fmt(sw)}"><title>${escapeXml(label)}</title></path>`
        );
      } else {
        out.push(
          `<path d="${d}" fill="${fill}" fill-opacity="${fmt(op, 3)}" stroke="${stroke}" stroke-width="${fmt(sw)}" />`
        );
      }
    } else if (label) {
      out.push(
        `<ellipse${interactiveAttrs} cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(rx)}" ry="${fmt(ry)}" fill="${fill}" fill-opacity="${fmt(op, 3)}" stroke="${stroke}" stroke-width="${fmt(sw)}"><title>${escapeXml(label)}</title></ellipse>`
      );
    } else {
      out.push(
        `<ellipse cx="${fmt(cx)}" cy="${fmt(cy)}" rx="${fmt(rx)}" ry="${fmt(ry)}" fill="${fill}" fill-opacity="${fmt(op, 3)}" stroke="${stroke}" stroke-width="${fmt(sw)}" />`
      );
    }
  }

  for (const t of geom.texts || []) {
    const anchor = t.align === "CENTER" ? "middle" : t.align === "RIGHT" ? "end" : "start";
    const fw = t.fontWeight === "Bold" ? "700" : t.fontWeight === "Regular" ? "400" : String(t.fontWeight || "600");
    const fsVal = Math.max(7, safeNum(t.fontSize, 9.5));
    const tx = safeNum(t.x, 0);
    const ty = safeNum(t.y, 0) + 8;
    const rot = safeNum(t.rotation, 0);
    const rotAttr = rot !== 0 ? ` transform="rotate(${fmt(rot, 1)}, ${fmt(tx)}, ${fmt(ty)})"` : "";
    const fill = t.fillHex || mutedCol;
    out.push(
      `<text x="${fmt(tx)}" y="${fmt(ty)}" fill="${fill}" font-family="${escapeXml(FONT_STACK)}" font-size="${fmt(fsVal, 1)}" font-weight="${fw}" text-anchor="${anchor}"${rotAttr}>${escapeXml(t.text)}</text>`
    );
  }

  out.push("</g>");

  // Footer
  if (spec.showFooter && spec.source) {
    out.push(
      `<text x="${fmt(layout.padX, 1)}" y="${fmt(layout.footerY, 1)}" fill="${mutedCol}" font-family="${escapeXml(FONT_STACK)}" font-size="9.5" font-weight="400">${escapeXml(spec.source)}</text>`
    );
  }

  out.push("</svg>");
  return { svg: out.join("\n"), spec };
}

function computeDataSummary(headers, rows) {
  const hdrs = Array.isArray(headers) ? headers : [];
  const rws = Array.isArray(rows) ? rows : [];
  const numericColumns = [];

  for (let c = 0; c < hdrs.length; c++) {
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let count = 0;
    for (let r = 0; r < rws.length; r++) {
      const cell = rws[r] && rws[r][c];
      if (typeof cell === "number" && Number.isFinite(cell)) {
        if (cell < min) min = cell;
        if (cell > max) max = cell;
        sum += cell;
        count++;
      }
    }
    if (count > 0) {
      numericColumns.push({
        header: String(hdrs[c] || `Col ${c + 1}`),
        count,
        min: Number(min.toFixed(4)),
        max: Number(max.toFixed(4)),
        mean: Number((sum / count).toFixed(4)),
        sum: Number(sum.toFixed(4))
      });
    }
  }

  return {
    rowCount: rws.length,
    colCount: hdrs.length,
    headers: hdrs.map(h => String(h || "")),
    numericColumns
  };
}

module.exports = {
  FONT_STACK,
  ISCV_PACKS,
  ISCV_CHART_CATALOG,
  getChartPresetById,
  ISCV_PALETTES,
  getPaletteById,
  parseTabularInput,
  computeCardLayoutMetrics,
  resolveChartLegendEntries,
  buildChartGeometryPrimitives,
  escapeXml,
  escapeCsvCell,
  toCsvString,
  arcDataToSvgPath,
  vectorNetworkToSvgPath,
  normalizeChartSpec,
  renderChartSvg,
  computeDataSummary
};
