// ============================================================================
// ISCV Chart Studio | Master 5-Pack Chart Registry & Preset Sample Datasets
// Brand: ISCV | Isocurve Research Lab (@iscvlab)
// Strictly uses hyphens (-) and pipes (|) only (zero em/en-dashes).
// ============================================================================

const ISCV_PACKS = [
  {
    id: "pack0",
    shortLabel: "Core",
    name: "Core Essentials",
    subtitle: "Generalist Dashboard Charts (Bar, Line, Area, Pie, Gauge, Scatter, Combo, Radar, OHLC)"
  },
  {
    id: "pack1",
    shortLabel: "Compare",
    name: "Compare & Unit Grids",
    subtitle: "Executive & Editorial Charts (Dumbbell, Lollipop, Slopegraph, Marimekko, Waffle, Parliament, Bullet, Bump, Diverging)"
  },
  {
    id: "pack2",
    shortLabel: "Flow",
    name: "Flow & Hierarchy",
    subtitle: "Relational & Tree Topologies (Alluvial, Sankey, Chord, Voronoi Treemap, Sunburst, Waterfall, Funnel, Dendrogram)"
  },
  {
    id: "pack3",
    shortLabel: "Stats",
    name: "Statistical Lab",
    subtitle: "Distributions & Process Control (Raincloud, Violin, Ridgeline, Histogram+KDE, Pareto, UpSet, SPC, Regression)"
  },
  {
    id: "pack4",
    shortLabel: "Spatial",
    name: "Polar, Spatial & Telemetry",
    subtitle: "Environmental & High-Density Grids (Wind Rose, Ternary, Bivariate 3x3, Horizon, Calendar, Radial Bar, Correlation)"
  }
];

const ISCV_CHART_CATALOG = [
  // ==========================================================================
  // PACK 0: CORE ESSENTIALS (13 Generalist Families)
  // ==========================================================================
  {
    id: "bar_grouped",
    packId: "pack0",
    name: "Grouped Column Bar",
    badge: "Core",
    title: "Quarterly Revenue by Product Line",
    subtitle: "Comparison across Cloud, Enterprise & Edge AI divisions (USD Millions)",
    unit: "USD M",
    source: "Source: ISCV Financial Benchmark FY2026 | ISCV Chart Studio",
    headers: ["Quarter", "Cloud Core", "Enterprise AI", "Edge Hardware"],
    rows: [
      ["Q1 26", 42.5, 28.0, 16.4],
      ["Q2 26", 48.2, 35.5, 19.8],
      ["Q3 26", 54.0, 44.2, 23.1],
      ["Q4 26", 63.8, 56.0, 29.5]
    ]
  },
  {
    id: "bar_stacked",
    packId: "pack0",
    name: "Stacked Column Bar",
    badge: "Core",
    title: "Regional Energy Mix Breakdown",
    subtitle: "Stacked generation share across Solar, Wind & Hydro sources (GWh)",
    unit: "GWh",
    source: "Source: Regional Grid Telemetry 2026 | ISCV Chart Studio",
    headers: ["Region", "Solar PV", "Offshore Wind", "Hydro Storage"],
    rows: [
      ["North Hub", 145, 110, 65],
      ["East Metro", 190, 85, 45],
      ["South Basin", 230, 60, 80],
      ["West Corridor", 160, 140, 95]
    ]
  },
  {
    id: "bar_horizontal",
    packId: "pack0",
    name: "Horizontal Ranked Bar",
    badge: "Core",
    title: "Urban Transit Corridor Ridership Ranking",
    subtitle: "Horizontal comparison of daily Peak vs. Off-Peak commuter flow (k Passengers/day)",
    unit: "k Pax/day",
    source: "Source: Metropolitan Transit Authority Telemetry | ISCV Chart Studio",
    headers: ["Transit Corridor", "Peak Ridership", "Off-Peak"],
    rows: [
      ["East-West Green Line", 142, 88],
      ["North Waterfront Rail", 118, 74],
      ["Prawet Eco Shuttle", 96, 62],
      ["Canal Express Boat", 78, 51],
      ["District Feeder Loop", 64, 43]
    ]
  },
  {
    id: "bar_stacked_100",
    packId: "pack0",
    name: "100% Proportional Bar",
    badge: "Core",
    title: "Surface Permeability Composition by District Zone",
    subtitle: "Normalized 100% proportional breakdown of canopy, pervious paving, and roof cover (%)",
    unit: "% Share",
    source: "Source: Urban Hydrological Land-Use Audit | ISCV Chart Studio",
    headers: ["District Zone", "Green Canopy", "Pervious Paving", "Impervious Roof"],
    rows: [
      ["Wetland Core", 62, 28, 10],
      ["Eco Innovation Hub", 45, 35, 20],
      ["Transit TOD Plaza", 28, 42, 30],
      ["Legacy Industrial", 14, 22, 64]
    ]
  },
  {
    id: "line_smooth",
    packId: "pack0",
    name: "Multi-Series Line & Spline",
    badge: "Core",
    title: "Monthly Active Users & Retention Trajectory",
    subtitle: "Smoothed cubic spline curves across 6 consecutive months (Thousands)",
    unit: "k Users",
    source: "Source: Product Telemetry Cohort Log | ISCV Chart Studio",
    headers: ["Month", "Desktop Pro", "Web Studio", "Mobile Companion"],
    rows: [
      ["Jan", 18.2, 24.5, 12.0],
      ["Feb", 21.5, 28.0, 15.4],
      ["Mar", 25.0, 31.2, 19.8],
      ["Apr", 29.8, 36.5, 22.5],
      ["May", 35.4, 41.0, 27.2],
      ["Jun", 42.1, 48.6, 33.0]
    ]
  },
  {
    id: "line_step",
    packId: "pack0",
    name: "Step Line Trajectory",
    badge: "Core",
    title: "Microgrid Dynamic Tariff Step Schedule",
    subtitle: "Discrete step-function rate transitions across 6 diurnal tariff epochs (THB/kWh)",
    unit: "THB/kWh",
    source: "Source: Smart Microgrid Dispatch Ledger | ISCV Chart Studio",
    headers: ["Tariff Epoch", "Grid Base Rate", "Peak Surge Rate"],
    rows: [
      ["T01", 3.2, 4.5],
      ["T02", 3.2, 5.2],
      ["T03", 4.1, 6.8],
      ["T04", 4.8, 7.5],
      ["T05", 3.9, 5.8],
      ["T06", 2.8, 4.0]
    ]
  },
  {
    id: "area_stacked",
    packId: "pack0",
    name: "Stacked Area Volume",
    badge: "Core",
    title: "Cumulative Compute Bandwidth Allocation",
    subtitle: "Stacked area volume across GPU training, inference & storage nodes (TB/s)",
    unit: "TB/s",
    source: "Source: Cluster Infrastructure Monitor | ISCV Chart Studio",
    headers: ["Epoch", "Training Cluster", "Live Inference", "Vector Index"],
    rows: [
      ["W01", 12, 18, 8],
      ["W02", 16, 22, 11],
      ["W03", 24, 25, 14],
      ["W04", 31, 29, 18],
      ["W05", 28, 36, 21],
      ["W06", 39, 42, 26]
    ]
  },
  {
    id: "pie_donut",
    packId: "pack0",
    name: "Donut & Pie Ring",
    badge: "Native Arc",
    title: "Operating Budget Allocation",
    subtitle: "Editable native Figma Ellipse ArcData sectors with inner ratio handles (%)",
    unit: "%",
    source: "Source: Annual R&D Allocation | ISCV Chart Studio",
    headers: ["Department", "Budget Share", "YoY Target"],
    rows: [
      ["R&D Engineering", 38, 40],
      ["Cloud Infrastructure", 24, 22],
      ["Design & UX Lab", 18, 20],
      ["Enterprise Growth", 12, 10],
      ["Operations & Legal", 8, 8]
    ]
  },
  {
    id: "gauge_kpi",
    packId: "pack0",
    name: "KPI Semicircle Gauge",
    badge: "Native Arc",
    title: "Executive Sustainability KPI Semicircle Dials",
    subtitle: "Semicircular 180-degree native ArcData meters with target threshold ticks (%)",
    unit: "% Score",
    source: "Source: Net-Zero Operations Dashboard | ISCV Chart Studio",
    headers: ["Metric", "Current Score", "Target Goal", "Max Scale"],
    rows: [
      ["Net Carbon Offset %", 78.5, 85.0, 100],
      ["Water Circularity %", 64.0, 75.0, 100]
    ]
  },
  {
    id: "scatter_bubble",
    packId: "pack0",
    name: "Scatter & Bubble Plot",
    badge: "Core",
    title: "Urban Park Cooling Efficiency vs. Canopy Density",
    subtitle: "X: Canopy Cover (%) | Y: Peak LST Reduction (deg C) | Bubble Size: Area (Rai)",
    unit: "deg C",
    source: "Source: Urban Microclimate Sensor Network | ISCV Chart Studio",
    headers: ["Site Node", "Canopy % (X)", "Cooling dT (Y)", "Area Rai (Size)"],
    rows: [
      ["Node A", 18, 1.2, 25],
      ["Node B", 32, 2.4, 48],
      ["Node C", 45, 3.1, 80],
      ["Node D", 61, 4.3, 120],
      ["Node E", 74, 5.2, 161],
      ["Node F", 28, 1.9, 35],
      ["Node G", 53, 3.8, 95]
    ]
  },
  {
    id: "combo_dual",
    packId: "pack0",
    name: "Combo Bar + Line (Dual)",
    badge: "Core",
    title: "Stormwater Runoff Volume vs. Peak Intensity",
    subtitle: "Bars: Retention Volume (1000 m3) | Line: Peak Flow Reduction (%)",
    unit: "1000 m3 / %",
    source: "Source: Hydrological Basin Model | ISCV Chart Studio",
    headers: ["Basin Zone", "Retention Vol (Bar)", "Peak Reduction % (Line)"],
    rows: [
      ["Zone 01", 45, 28],
      ["Zone 02", 62, 42],
      ["Zone 03", 78, 56],
      ["Zone 04", 94, 71],
      ["Zone 05", 112, 84]
    ]
  },
  {
    id: "radar_polygon",
    packId: "pack0",
    name: "Radar / Spider Polygon",
    badge: "Core",
    title: "Multi-Criteria Site Performance Index",
    subtitle: "6-Axis normalized comparison between Baseline condition and Masterplan (0-100)",
    unit: "Score",
    source: "Source: 9D MCDA Evaluation Matrix | ISCV Chart Studio",
    headers: ["Criterion Axis", "Baseline 2026", "Target Design 2027"],
    rows: [
      ["Thermal Comfort", 34, 86],
      ["Odor Mitigation", 22, 91],
      ["Acoustic Shield", 41, 82],
      ["Flood Retention", 38, 89],
      ["Walkability", 29, 88],
      ["Biodiversity", 25, 85]
    ]
  },
  {
    id: "candlestick_ohlc",
    packId: "pack0",
    name: "Candlestick OHLC + Vol",
    badge: "Dual-Pane",
    title: "Carbon Credit Futures & Daily Trading Volume",
    subtitle: "Synchronized upper OHLC candlestick wicks/bodies and lower volume sub-pane",
    unit: "USD / tCO2e",
    source: "Source: Environmental Commodities Exchange | ISCV Chart Studio",
    headers: ["Session", "Open", "High", "Low", "Close", "Volume"],
    rows: [
      ["Day 01", 64.0, 68.5, 62.2, 67.1, 1420],
      ["Day 02", 67.1, 71.0, 65.8, 66.0, 1680],
      ["Day 03", 66.0, 67.4, 61.5, 62.4, 1950],
      ["Day 04", 62.4, 69.2, 62.0, 68.8, 2100],
      ["Day 05", 68.8, 74.5, 68.1, 73.2, 2450],
      ["Day 06", 73.2, 76.0, 70.4, 71.5, 1540]
    ]
  },

  // ==========================================================================
  // PACK 1: COMPARE & UNIT GRIDS (9 White-Space Families)
  // ==========================================================================
  {
    id: "dumbbell_range",
    packId: "pack1",
    name: "Dumbbell Range Dot",
    badge: "Tier C1 White-Space",
    title: "Pre vs. Post Intervention Pedestrian Accessibility",
    subtitle: "Paired baseline (2026) to target (2027) score delta across 5 urban sub-districts",
    unit: "Index (0-100)",
    source: "Source: Network Walkability Audit | ISCV Chart Studio",
    headers: ["District", "Baseline 2026", "Target 2027"],
    rows: [
      ["Prawet Core", 38, 84],
      ["On Nut West", 44, 79],
      ["Dokmai North", 29, 76],
      ["Nong Bon", 51, 88],
      ["Suan Luang", 47, 82]
    ]
  },
  {
    id: "lollipop_rank",
    packId: "pack1",
    name: "Lollipop Ranking",
    badge: "Tier C1 White-Space",
    title: "Phytoremediation Species Heavy-Metal Uptake Rate",
    subtitle: "High data-to-ink stem + dot ranking across candidate wetland species (mg/kg)",
    unit: "mg/kg",
    source: "Source: Botanical Remediation SSOT | ISCV Chart Studio",
    headers: ["Species Name", "Uptake Rate", "Survival %"],
    rows: [
      ["Vetiveria zizanioides", 92.4, 98],
      ["Typha angustifolia", 84.1, 95],
      ["Phragmites karka", 77.6, 94],
      ["Cyperus involucratus", 68.2, 91],
      ["Canna indica", 59.5, 89],
      ["Heliconia psittacorum", 51.0, 87]
    ]
  },
  {
    id: "slopegraph_tufte",
    packId: "pack1",
    name: "Slopegraph (Auto-Relaxed)",
    badge: "Tier C1 White-Space",
    title: "Decadal Land Cover Shift (2016 vs. 2026)",
    subtitle: "Two-point trajectory with automatic vertical label collision relaxation (%)",
    unit: "% Share",
    source: "Source: Multi-Temporal Satellite Classification | ISCV Chart Studio",
    headers: ["Land Class", "Year 2016", "Year 2026"],
    rows: [
      ["Dense Canopy", 24.5, 46.2],
      ["Impervious Asphalt", 48.0, 21.5],
      ["Retention Water", 9.2, 18.8],
      ["Open Grassland", 18.3, 13.5]
    ]
  },
  {
    id: "marimekko_bars",
    packId: "pack1",
    name: "Marimekko Variable-Width",
    badge: "Tier C2 Native",
    title: "Waste Stream Composition by Facility Capacity",
    subtitle: "Column width proportional to total daily tonnage; height shows material split (%)",
    unit: "Tons / %",
    source: "Source: Municipal Solid Waste Ledger | ISCV Chart Studio",
    headers: ["Facility (Width = Sum)", "Organic Compost", "Recyclable", "RDF Energy"],
    rows: [
      ["Plant A (800t)", 440, 200, 160],
      ["Plant B (500t)", 220, 160, 120],
      ["Plant C (300t)", 110, 110, 80],
      ["Plant D (200t)", 60, 80, 60]
    ]
  },
  {
    id: "waffle_parliament",
    packId: "pack1",
    name: "Waffle 10x10 Unit Grid",
    badge: "Tier C1 Grid",
    title: "100-Cell Land Conversion Proportional Waffle Grid",
    subtitle: "10x10 100-cell unit grid where each cell represents 1% of total site area",
    unit: "% Cells",
    source: "Source: 161-Rai Park Program Breakdown | ISCV Chart Studio",
    headers: ["Program Category", "Percentage Share"],
    rows: [
      ["Ecological Forest", 42],
      ["Constructed Wetland", 26],
      ["Active Recreation", 19],
      ["Civic Pavilion & Plaza", 13]
    ]
  },
  {
    id: "parliament_arc",
    packId: "pack1",
    name: "Parliament Hemicycle Arc",
    badge: "Tier C1 Grid",
    title: "Watershed Governance Council Seat Allocation",
    subtitle: "Concentric semicircular hemicycle seat dots arranged by coalition bloc (100 Seats)",
    unit: "Seats",
    source: "Source: Metropolitan Basin Governance Charter | ISCV Chart Studio",
    headers: ["Coalition Party", "Allocated Seats"],
    rows: [
      ["Green Civic Alliance", 42],
      ["Urban Reform Bloc", 28],
      ["Transit Labor Union", 18],
      ["Independent Science", 12]
    ]
  },
  {
    id: "bullet_target",
    packId: "pack1",
    name: "Bullet KPI vs. Target",
    badge: "Tier C1 Executive",
    title: "Ecological Masterplan Performance vs. 2027 Benchmark",
    subtitle: "Stephen Few bullet bars with qualitative background bands, actual bar, and target marker",
    unit: "Score / %",
    source: "Source: ISCV Performance Audit | ISCV Chart Studio",
    headers: ["KPI Indicator", "Actual", "Target", "Max Capacity"],
    rows: [
      ["Canopy Coverage %", 74, 80, 100],
      ["Runoff Retention %", 88, 85, 100],
      ["Solar Self-Supply %", 62, 70, 100],
      ["Biodiversity Index", 79, 75, 100]
    ]
  },
  {
    id: "bump_ranking",
    packId: "pack1",
    name: "Bump Rank Trajectory",
    badge: "Tier C1 White-Space",
    title: "Multi-Year Commuter Mode Priority Rank Evolution",
    subtitle: "Ordinal rank trajectory curves with rank badges across 2023-2026 (Rank 1 = Highest)",
    unit: "Rank #",
    source: "Source: Annual Mobility Modal Split Survey | ISCV Chart Studio",
    headers: ["Mobility Mode", "2023 Rank", "2024 Rank", "2025 Rank", "2026 Rank"],
    rows: [
      ["Electric Rail", 3, 2, 1, 1],
      ["Protected Bike", 4, 3, 2, 2],
      ["EV Shuttle", 2, 4, 3, 3],
      ["Diesel Bus", 1, 1, 4, 4],
      ["Private Car", 5, 5, 5, 5]
    ]
  },
  {
    id: "diverging_bar",
    packId: "pack1",
    name: "Diverging Likert / Pyramid",
    badge: "Tier C1 White-Space",
    title: "Post-Occupancy Civic Satisfaction Diverging Balance",
    subtitle: "Opposing negative (-) vs. positive (+) sentiment percentages anchored on central zero spine",
    unit: "% Share",
    source: "Source: Community Post-Occupancy Survey (N=1,240) | ISCV Chart Studio",
    headers: ["Survey Dimension", "Negative % (-)", "Positive % (+)"],
    rows: [
      ["Thermal Shade Satisfaction", -18, 82],
      ["Odor Air Quality Rating", -24, 76],
      ["Night Lighting Safety", -14, 86],
      ["Wayfinding Signage Clarity", -31, 69],
      ["Universal Ramp Access", -12, 88]
    ]
  },

  // ==========================================================================
  // PACK 2: FLOW, NETWORK & HIERARCHY (8 Families)
  // ==========================================================================
  {
    id: "alluvial_multistage",
    packId: "pack2",
    name: "Multi-Stage Alluvial (3-Col)",
    badge: "Tier C1 White-Space",
    title: "Multi-Stage Material Recovery & Energy Conversion Flow",
    subtitle: "3-Stage cubic Bezier ribbons connecting Source Stream -> Process Stage -> End Utilization",
    unit: "Tons/day",
    source: "Source: Circular Resource Flow Audit | ISCV Chart Studio",
    headers: ["Source Stream", "Process Stage", "End Utilization", "Tons/day"],
    rows: [
      ["Municipal Organic", "Anaerobic Digester", "Biogas Grid", 280],
      ["Municipal Organic", "Aerobic Windrow", "Park Topsoil", 190],
      ["Mixed Dry Waste", "Optical Sorter", "Recycled Polymer", 240],
      ["Mixed Dry Waste", "RDF Pelletizer", "District Heat", 170],
      ["Green Prunings", "Biochar Kiln", "Carbon Sink Soil", 160],
      ["Green Prunings", "Aerobic Windrow", "Park Topsoil", 120]
    ]
  },
  {
    id: "sankey_flow",
    packId: "pack2",
    name: "Sankey Energy Balance",
    badge: "VectorNetwork",
    title: "District Microgrid Energy Generation to End-Use Load",
    subtitle: "Proportional node stacks and smooth cubic Bezier flow ribbons (MWh)",
    unit: "MWh",
    source: "Source: Microgrid Energy Simulation | ISCV Chart Studio",
    headers: ["From Node", "To Node", "Flow MWh"],
    rows: [
      ["Solar Canopy PV", "Battery Storage", 140],
      ["Solar Canopy PV", "Daytime HVAC", 210],
      ["Biogas CHP", "Daytime HVAC", 95],
      ["Biogas CHP", "Water Treatment", 165],
      ["Battery Storage", "Night Lighting", 125]
    ]
  },
  {
    id: "chord_ribbon",
    packId: "pack2",
    name: "Chord Ribbon Matrix",
    badge: "Tier C2 Native",
    title: "Inter-Zone Pedestrian Origin-Destination Matrix",
    subtitle: "Outer Ellipse ArcData perimeter rings + inner quadratic Bezier VectorNetwork chords",
    unit: "Trips/hr",
    source: "Source: Agent-Based Pedestrian Solver L5 | ISCV Chart Studio",
    headers: ["Origin Zone", "Destination Zone", "Trips"],
    rows: [
      ["Transit Gate", "Wetland Boardwalk", 420],
      ["Transit Gate", "Sky Mounds", 310],
      ["Wetland Boardwalk", "Eco Center", 280],
      ["Sky Mounds", "Eco Center", 240],
      ["Community Edge", "Wetland Boardwalk", 350]
    ]
  },
  {
    id: "voronoi_treemap",
    packId: "pack2",
    name: "Voronoi & Squarified Treemap",
    badge: "Tier C1 Polygon",
    title: "Hierarchical Ecological Guild Biomass Distribution",
    subtitle: "Area-weighted polygon cells generated as native Figma VectorNetwork regions",
    unit: "tCO2e",
    source: "Source: 21,850-Species Plant SSOT | ISCV Chart Studio",
    headers: ["Guild / Species Group", "Carbon Stock", "Canopy Layer"],
    rows: [
      ["Dipterocarp Emergent", 340, 1],
      ["Riparian Gallery", 260, 1],
      ["Phytoremediation Reed", 190, 2],
      ["Pollinator Shrubs", 145, 2],
      ["Bioswale Groundcover", 110, 3],
      ["Floating Macrophytes", 85, 3]
    ]
  },
  {
    id: "sunburst_pack",
    packId: "pack2",
    name: "Sunburst Multi-Ring",
    badge: "Native ArcData",
    title: "Concentric Multi-Ring Taxonomy Breakdown",
    subtitle: "Inner ring represents primary domain; outer ring represents sub-module weight",
    unit: "Weight",
    source: "Source: Spatial Asset Hierarchy | ISCV Chart Studio",
    headers: ["Primary Ring", "Sub-Module", "Value"],
    rows: [
      ["Hydrology", "Retention Pond", 180],
      ["Hydrology", "Bioswale Network", 120],
      ["Earthworks", "Acoustic Berm", 160],
      ["Earthworks", "Odor Baffle Mound", 140],
      ["Canopy", "Core Forest", 210],
      ["Canopy", "Edge Buffer", 110]
    ]
  },
  {
    id: "waterfall_bridge",
    packId: "pack2",
    name: "Waterfall & Carbon Bridge",
    badge: "Auto-Subtotal",
    title: "Net-Zero Carbon Sequestration Bridge (Baseline to Net Balance)",
    subtitle: "Positive emissions (+), mitigation reductions (-), and automatic cumulative net bar",
    unit: "tCO2e/yr",
    source: "Source: Lifecycle Carbon Audit | ISCV Chart Studio",
    headers: ["Phase Step", "Delta tCO2e"],
    rows: [
      ["Baseline Emissions", 850],
      ["Earthwork Embodied", 140],
      ["Solar PV Offset", -320],
      ["Canopy Sequestration", -410],
      ["Wetland Soil Sink", -190],
      ["Biochar Lock", -120]
    ]
  },
  {
    id: "funnel_conversion",
    packId: "pack2",
    name: "Funnel Conversion Pipeline",
    badge: "VectorNetwork",
    title: "Constructed Wetland Stormwater Treatment Cascade",
    subtitle: "Centered trapezoidal volume stages with stage-to-stage retention % conversion",
    unit: "m3/hr",
    source: "Source: Hydrological Treatment Train Telemetry | ISCV Chart Studio",
    headers: ["Pipeline Stage", "Active Volume", "Target Benchmark"],
    rows: [
      ["1. Total Stormwater Inflow", 1000, 1000],
      ["2. Primary Forebay Settling", 820, 850],
      ["3. Subsurface Gravel Reedbed", 680, 700],
      ["4. Polishing Macrophyte Basin", 560, 550],
      ["5. UV Potable Reuse Output", 460, 450]
    ]
  },
  {
    id: "dendrogram_tree",
    packId: "pack2",
    name: "Dendrogram Hierarchy Tree",
    badge: "Hierarchy",
    title: "Phytoremediation Botanical Guild Taxonomy Tree",
    subtitle: "Root-to-Branch-to-Leaf orthogonal elbow connectors with similarity score badges",
    unit: "Similarity %",
    source: "Source: 21,850-Species Botanical Taxonomy SSOT | ISCV Chart Studio",
    headers: ["Cluster Clade", "Parent Branch", "Similarity Score"],
    rows: [
      ["Dipterocarpus alatus", "Canopy Guild", 94],
      ["Hopea odorata", "Canopy Guild", 89],
      ["Millettia brandisiana", "Sub-Canopy", 82],
      ["Saraca indica", "Sub-Canopy", 78],
      ["Vetiveria zizanioides", "Riparian Reed", 91],
      ["Typha angustifolia", "Riparian Reed", 86]
    ]
  },

  // ==========================================================================
  // PACK 3: STATISTICAL & DISTRIBUTION LAB (8 Families)
  // ==========================================================================
  {
    id: "raincloud_plot",
    packId: "pack3",
    name: "Raincloud (Half-Violin + Swarm)",
    badge: "Tier C1 Monopoly",
    title: "Outdoor Thermal Comfort (UTCI) Distribution by Typology",
    subtitle: "Composite Half-Violin KDE curve + Quartile IQR Box + Jittered Beeswarm observations",
    unit: "UTCI (deg C)",
    source: "Source: Microclimate Simulation Ensemble | ISCV Chart Studio",
    headers: ["Zone Typology", "S1", "S2", "S3", "S4", "S5", "S6", "S7"],
    rows: [
      ["Exposed Asphalt", 38.2, 39.5, 40.1, 41.0, 39.8, 42.1, 40.4],
      ["Grass Lawn", 35.1, 36.0, 36.8, 34.9, 37.2, 35.8, 36.4],
      ["Wetland Edge", 32.0, 32.8, 33.5, 31.6, 33.1, 32.4, 34.0],
      ["Dense Forest", 29.4, 30.1, 30.8, 28.9, 31.2, 29.8, 30.4]
    ]
  },
  {
    id: "violin_boxplot",
    packId: "pack3",
    name: "Violin KDE & Boxplot",
    badge: "Tier C2 Native",
    title: "Acoustic Attenuation Performance Across Barrier Profiles",
    subtitle: "Symmetric Gaussian KDE density envelope with inner median and IQR quartile box",
    unit: "dBA",
    source: "Source: ISO 9613-2 Acoustic Solver | ISCV Chart Studio",
    headers: ["Barrier Profile", "Obs 1", "Obs 2", "Obs 3", "Obs 4", "Obs 5", "Obs 6"],
    rows: [
      ["No Barrier", 74, 76, 79, 75, 78, 81],
      ["Single Wall", 65, 67, 64, 68, 66, 70],
      ["Double Berm", 54, 56, 52, 57, 55, 58],
      ["Berm + Forest", 46, 48, 45, 49, 47, 51]
    ]
  },
  {
    id: "ridgeline_joyplot",
    packId: "pack3",
    name: "Ridgeline Plot (Joyplot KDE)",
    badge: "Tier C1 White-Space",
    title: "Diurnal Odor Plume Concentration Profile Across Seasons",
    subtitle: "Vertically staggered overlapping KDE density horizons with painter z-ordering",
    unit: "OU/m3",
    source: "Source: BME688 Gas Sensor Field Logs | ISCV Chart Studio",
    headers: ["Season Horizon", "04:00", "08:00", "12:00", "16:00", "20:00", "24:00"],
    rows: [
      ["Cool Dry (Dec)", 18, 24, 14, 16, 32, 26],
      ["Hot Summer (Apr)", 25, 38, 29, 31, 45, 34],
      ["Early Monsoon (Jul)", 34, 49, 36, 42, 64, 48],
      ["Late Monsoon (Oct)", 28, 41, 22, 29, 52, 39]
    ]
  },
  {
    id: "beeswarm_kde",
    packId: "pack3",
    name: "Histogram + KDE Spline",
    badge: "Tier C1 Collision",
    title: "PM2.5 Daily Concentration Frequency & Kernel Density Curve",
    subtitle: "Auto-binned frequency bars overlaid with continuous Gaussian KDE spline & WHO threshold",
    unit: "ug/m3",
    source: "Source: GISTDA 954-Day Atmospheric Ledger | ISCV Chart Studio",
    headers: ["Bin Range (ug/m3)", "Observed Days", "KDE Density"],
    rows: [
      ["0-15 (Safe)", 185, 22],
      ["15-25 (Moderate)", 310, 38],
      ["25-37.5 (Elevated)", 245, 31],
      ["37.5-50 (Unhealthy)", 134, 18],
      ["50-75 (Severe)", 62, 9],
      ["75+ (Hazardous)", 18, 3]
    ]
  },
  {
    id: "upset_pareto_spc",
    packId: "pack3",
    name: "Pareto 80/20 Cutoff Curve",
    badge: "Tier C1 Process",
    title: "Civic Complaint Root-Cause Pareto 80/20 Cutoff Analysis",
    subtitle: "Descending frequency columns paired with cumulative % curve and 80% cutoff threshold",
    unit: "Cases / %",
    source: "Source: Traffy Fondue Civic Ledger | ISCV Chart Studio",
    headers: ["Hazard Category", "Complaint Count", "Active Intersections"],
    rows: [
      ["Odor Plume", 480, 3],
      ["Surface Flooding", 290, 2],
      ["Illegal Dumping", 165, 2],
      ["Noise Disturbance", 95, 1],
      ["Broken Lighting", 55, 1],
      ["Sidewalk Obstruction", 35, 1]
    ]
  },
  {
    id: "upset_matrix",
    packId: "pack3",
    name: "UpSet Intersection Matrix",
    badge: "Tier C1 Set Logic",
    title: "Multi-Hazard Co-Occurrence UpSet Intersection Matrix",
    subtitle: "Upper intersection cardinality bars synchronized with lower connected membership dot grid",
    unit: "Cases",
    source: "Source: Multi-Hazard Civic Telemetry | ISCV Chart Studio",
    headers: ["Intersection Set", "Case Count", "Odor", "Flood", "Noise", "Heat"],
    rows: [
      ["Odor + Heat", 185, 1, 0, 0, 1],
      ["Flood + Odor", 142, 1, 1, 0, 0],
      ["Heat + Noise", 98, 0, 0, 1, 1],
      ["Odor + Flood + Heat", 76, 1, 1, 0, 1],
      ["Noise Only", 54, 0, 0, 1, 0],
      ["All 4 Hazards", 38, 1, 1, 1, 1]
    ]
  },
  {
    id: "spc_control",
    packId: "pack3",
    name: "SPC Control Chart (+/-3SD)",
    badge: "Tier C1 Process",
    title: "Effluent Dissolved Oxygen (DO) Statistical Process Control",
    subtitle: "Time-series batch trajectory with Mean, +/-2SD warning band, and +/-3SD UCL/LCL limits",
    unit: "mg/L DO",
    source: "Source: Automated Water Quality Telemetry | ISCV Chart Studio",
    headers: ["Sample Batch", "Measured DO (mg/L)", "Target Spec"],
    rows: [
      ["B01", 6.8, 7.0],
      ["B02", 7.1, 7.0],
      ["B03", 6.9, 7.0],
      ["B04", 7.4, 7.0],
      ["B05", 8.3, 7.0],
      ["B06", 7.0, 7.0],
      ["B07", 6.7, 7.0],
      ["B08", 7.2, 7.0]
    ]
  },
  {
    id: "regression_ci",
    packId: "pack3",
    name: "Linear Regression & Error CI",
    badge: "Tier C1 Stats",
    title: "Canopy Fraction vs. Surface Cooling OLS Regression & 95% CI",
    subtitle: "Ordinary Least Squares trendline, shaded confidence envelope, and +/-SD error whiskers",
    unit: "deg C Cooling",
    source: "Source: Urban Microclimate Regression Study | ISCV Chart Studio",
    headers: ["Canopy % (X)", "Cooling dT (Y)", "Error +/-SD"],
    rows: [
      ["15% Cover", 1.1, 0.35],
      ["28% Cover", 1.9, 0.40],
      ["42% Cover", 2.8, 0.38],
      ["55% Cover", 3.6, 0.42],
      ["68% Cover", 4.5, 0.36],
      ["82% Cover", 5.3, 0.45]
    ]
  },

  // ==========================================================================
  // PACK 4: POLAR, SPATIAL & TELEMETRY (7 Families)
  // ==========================================================================
  {
    id: "windrose_coxcomb",
    packId: "pack4",
    name: "Wind Rose & Coxcomb",
    badge: "Tier C1 Climate",
    title: "Seasonal Prevailing Wind Rose & Speed Frequency",
    subtitle: "Polar directional sectors scaled by square-root radius (R proportional to sqrt(Value))",
    unit: "m/s Frequency",
    source: "Source: Suvarnabhumi Meteorological Station EPW | ISCV Chart Studio",
    headers: ["Compass Sector", "Calm 1-3 m/s", "Breeze 3-6 m/s", "Gust 6+ m/s"],
    rows: [
      ["N", 12, 8, 3],
      ["NE", 24, 18, 7],
      ["E", 16, 11, 4],
      ["SE", 22, 15, 6],
      ["S", 38, 29, 14],
      ["SW", 44, 34, 18],
      ["W", 19, 12, 5],
      ["NW", 14, 9, 3]
    ]
  },
  {
    id: "ternary_simplex",
    packId: "pack4",
    name: "Ternary Simplex (3-Axis)",
    badge: "Tier C1 Barycentric",
    title: "Engineered Soil Substrate Ternary Composition (Sand + Silt + Clay = 100%)",
    subtitle: "60-degree equilateral barycentric coordinate grid with zone polygons and sample pins",
    unit: "% Ratio",
    source: "Source: Geotechnical Soil Remediation Lab | ISCV Chart Studio",
    headers: ["Sample ID", "Sand % (A)", "Silt % (B)", "Clay % (C)", "Permeability"],
    rows: [
      ["Bio-Swale S1", 65, 23, 12, 85],
      ["Wetland Core S2", 24, 31, 45, 30],
      ["Berm Fill S3", 44, 32, 24, 60],
      ["Forest Topsoil S4", 28, 56, 16, 75],
      ["Cap Liner S5", 18, 17, 65, 15],
      ["Filter Terrace S6", 58, 12, 30, 80]
    ]
  },
  {
    id: "horizon_bivariate_calendar",
    packId: "pack4",
    name: "Bivariate 3x3 Risk Matrix",
    badge: "Tier C1 Spatial",
    title: "Bivariate Spatial Risk & Vulnerability Cross-Classification",
    subtitle: "2D 3x3 cross-classified color matrix combining Exposure Intensity (X) and Vulnerability (Y)",
    unit: "Tier 1-3",
    source: "Source: Bivariate Spatial Injustice Audit | ISCV Chart Studio",
    headers: ["Sub-Zone Cell", "Hazard Exposure (X)", "Social Vulnerability (Y)", "Population"],
    rows: [
      ["Grid A1", 18, 22, 1200],
      ["Grid A2", 54, 28, 1850],
      ["Grid A3", 86, 31, 2400],
      ["Grid B1", 24, 58, 1600],
      ["Grid B2", 61, 64, 3100],
      ["Grid B3", 92, 69, 4200],
      ["Grid C1", 29, 88, 2100],
      ["Grid C2", 67, 91, 3800],
      ["Grid C3", 95, 96, 5400]
    ]
  },
  {
    id: "horizon_band",
    packId: "pack4",
    name: "Horizon Multi-Band Telemetry",
    badge: "Tier C1 Telemetry",
    title: "Diurnal VOC Plume Intensity Multi-Band Horizon Strips",
    subtitle: "Folded 3-band density horizon strips compressing high-amplitude sensor time-series",
    unit: "ppb VOC",
    source: "Source: Perimeter Fence-Line eNose Array | ISCV Chart Studio",
    headers: ["Sensor Station", "00h", "04h", "08h", "12h", "16h", "20h", "24h"],
    rows: [
      ["Station North-01", 12, 18, 45, 78, 62, 34, 19],
      ["Station East-02", 15, 22, 52, 88, 71, 41, 24],
      ["Station South-03", 10, 14, 31, 54, 48, 28, 16],
      ["Station West-04", 19, 29, 64, 94, 82, 51, 32]
    ]
  },
  {
    id: "calendar_heatmap",
    packId: "pack4",
    name: "Calendar Heatmap Matrix",
    badge: "Tier C1 Temporal",
    title: "Weekly Park Visitor & Environmental Load Calendar Grid",
    subtitle: "7-Day x 5-Week matrix cells color-coded by normalized daily intensity",
    unit: "Index (0-100)",
    source: "Source: Automated Gate Counter & Telemetry Log | ISCV Chart Studio",
    headers: ["Week Label", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    rows: [
      ["Week 1", 18, 24, 32, 45, 38, 14, 12],
      ["Week 2", 29, 41, 58, 72, 64, 22, 16],
      ["Week 3", 35, 62, 84, 91, 76, 31, 19],
      ["Week 4", 21, 33, 47, 53, 44, 18, 11],
      ["Week 5", 14, 25, 36, 42, 35, 15, 9]
    ]
  },
  {
    id: "radial_bar",
    packId: "pack4",
    name: "Radial Bar / Activity Rings",
    badge: "Native ArcData",
    title: "Circular Sustainability Targets Activity Rings",
    subtitle: "Concentric 270-degree native ArcData rings with background tracks and end-cap badges",
    unit: "% Target",
    source: "Source: Circular Ecological KPI Ledger | ISCV Chart Studio",
    headers: ["Sustainability Goal", "Achieved %", "Benchmark %"],
    rows: [
      ["Zero-Runoff Capture", 92, 100],
      ["Canopy Shade Target", 84, 100],
      ["Renewable Microgrid", 76, 100],
      ["Bio-Receptive Soil", 68, 100],
      ["Circular Material Use", 59, 100]
    ]
  },
  {
    id: "correlation_matrix",
    packId: "pack4",
    name: "2D Correlation Heatmap",
    badge: "Tier C1 Matrix",
    title: "Microclimate & Ecological Variable Pearson Correlation (r)",
    subtitle: "Symmetric NxN diverging heatmap (-1.00 to +1.00) with in-cell correlation coefficients",
    unit: "Pearson r",
    source: "Source: Multivariate Environmental Sensor Array | ISCV Chart Studio",
    headers: ["Variable", "Canopy", "Moisture", "Cooling", "Biodiv", "PM2.5"],
    rows: [
      ["Canopy", 1.00, 0.78, 0.92, 0.85, -0.74],
      ["Moisture", 0.78, 1.00, 0.81, 0.76, -0.62],
      ["Cooling", 0.92, 0.81, 1.00, 0.79, -0.83],
      ["Biodiv", 0.85, 0.76, 0.79, 1.00, -0.68],
      ["PM2.5", -0.74, -0.62, -0.83, -0.68, 1.00]
    ]
  }
];

function getChartPresetById(chartId) {
  return ISCV_CHART_CATALOG.find(c => c.id === chartId) || ISCV_CHART_CATALOG[0];
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ISCV_PACKS, ISCV_CHART_CATALOG, getChartPresetById };
}
