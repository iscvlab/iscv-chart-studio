---
name: iscv-chart-studio
description: >-
  Plot interactive 45-family scientific data visualizations and statistical charts directly in Antigravity chat or the ISCV Chart Studio side panel. Use when the user asks to plot, graph, chart, or visualize CSV, TSV, JSON, or tabular data.
---

# ISCV Chart Studio (`iscv-chart-studio`)

Plot publication-grade, pure-SVG scientific charts directly inside Antigravity 2.0 using **45 chart families** across **5 packs** and **14 commercial-safe scientific palettes**.

## Choosing the Right Tool

| User Intent | MCP Tool (`iscv-chart-studio_charts`) | Surface Behavior |
| :--- | :--- | :--- |
| **Quick chart / plot data inline in chat** | `iscv_plot_inline` | Renders an interactive Light-default SVG card directly inside the conversation with chart/palette switchers, hover tooltips, and SVG/PNG export. |
| **Explore, edit A1 data, compare 45 chart types** | `iscv_open_studio` | Opens or updates the full **ISCV Chart Studio** workbench in the Antigravity side panel (`aux_pane`) or full-page sidebar view (`global`) with SVG, PNG, JSON, and CSV exports. |
| **Discover chart schemas & palettes** | `iscv_chart_catalog` | Lists all 45 chart families, required header layouts, and 14 palette IDs. |

## Authoring Rules (Light Mode Default & Metadata Discipline)

- **Light Mode Default (`isDark: false`)**: Keep `isDark` unset or `false` (Archival Light Card `#FFFFFF`) by default across inline and studio plots. Set `isDark: true` **only** when the user explicitly requests a dark card or dark background.
- **Always Pass Meaningful Metadata on Custom Plots**: Whenever supplying custom `headers` + `rows` or `rawData` (CSV, TSV, or JSON string, with optional A1 `range` such as `"A1:D10"`), **always** pass explicit, domain-accurate `title`, `subtitle` (units, timeframe, or sample scope), and `source` values. If omitted on custom plots, `subtitle` defaults cleanly to `""` and `source` defaults to `"ISCV Chart Studio"` (never leaking sample preset captions).

## 45 Chart Families (`chartId`)

- **`pack0` (Core Essentials — 13)**: `bar_grouped`, `bar_stacked`, `bar_horizontal`, `bar_stacked_100`, `line_smooth`, `line_step`, `area_stacked`, `pie_donut`, `gauge_kpi`, `scatter_bubble`, `combo_dual`, `radar_polygon`, `candlestick_ohlc`
- **`pack1` (Compare & Unit Grids — 9)**: `dumbbell_range`, `lollipop_rank`, `slopegraph_tufte`, `marimekko_bars`, `waffle_parliament`, `parliament_arc`, `bullet_target`, `bump_ranking`, `diverging_bar`
- **`pack2` (Flow & Hierarchy — 8)**: `alluvial_multistage`, `sankey_flow`, `chord_ribbon`, `voronoi_treemap`, `sunburst_pack`, `waterfall_bridge`, `funnel_conversion`, `dendrogram_tree`
- **`pack3` (Statistical Lab — 8)**: `raincloud_plot`, `violin_boxplot`, `ridgeline_joyplot`, `beeswarm_kde`, `upset_pareto_spc`, `upset_matrix`, `spc_control`, `regression_ci`
- **`pack4` (Polar, Spatial & Telemetry — 7)**: `windrose_coxcomb`, `ternary_simplex`, `horizon_bivariate_calendar`, `horizon_band`, `calendar_heatmap`, `radial_bar`, `correlation_matrix`

## 14 Scientific Palettes (`paletteId`)

- **ISCV Signature**: `iscv_swiss_signal` (default), `iscv_concept_6b`, `iscv_oklch_pastels`, `iscv_cyber_telemetry`
- **Colorblind-Safe**: `okabe_ito_universal`, `crameri_batlow`, `crameri_vik_diverging`
- **Sequential & Diverging**: `brewer_ylgnbu`, `brewer_rdylbu`, `brewer_set2_muted`, `viridis_perceptual`, `plasma_thermal`
- **Bivariate 3x3**: `bivariate_stevens_bluepink`, `bivariate_iscv_tealamber`
