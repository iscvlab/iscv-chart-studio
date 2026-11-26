// ============================================================================
// ISCV Chart Studio | Commercial-Safe Color Palette Catalogue
// Brand: ISCV | Isocurve Research Lab (@iscvlab)
// Licenses: 100% First-Party IP (@iscvlab), Public Domain, MIT, Apache-2.0, CC0
// Zero Pantone / PMS proprietary or trademarked swatches.
// ============================================================================

const ISCV_PALETTES = [
  // --------------------------------------------------------------------------
  // Category 1: ISCV Signature Series (100% First-Party IP - @iscvlab)
  // --------------------------------------------------------------------------
  {
    id: "iscv_swiss_signal",
    name: "ISCV Swiss Signal (Default)",
    category: "ISCV Signature",
    license: "First-Party (@iscvlab)",
    lightColors: ["#1D4ED8", "#D97706", "#059669", "#0284C7", "#E11D48", "#7C3AED", "#0D9488", "#475569"],
    darkColors:  ["#60A5FA", "#FBBF24", "#34D399", "#38BDF8", "#FB7185", "#A78BFA", "#2DD4BF", "#94A3B8"]
  },
  {
    id: "iscv_concept_6b",
    name: "ISCV Concept 6B Archival",
    category: "ISCV Signature",
    license: "First-Party (@iscvlab)",
    lightColors: ["#121417", "#D97706", "#2D3138", "#0284C7", "#525866", "#B45309", "#0F766E", "#7C8494"],
    darkColors:  ["#F6F5F0", "#F59E0B", "#D0D4DC", "#38BDF8", "#94A3B8", "#FBBF24", "#2DD4BF", "#64748B"]
  },
  {
    id: "iscv_oklch_pastels",
    name: "ISCV Architectural Pastels (OKLCH)",
    category: "ISCV Signature",
    license: "First-Party (@iscvlab)",
    lightColors: ["#6384E8", "#E89363", "#57B894", "#C978B5", "#56A8C9", "#D9B24C", "#8C7AE6", "#E07A7A"],
    darkColors:  ["#93B4FF", "#FFB48A", "#7EE2B8", "#F0A3DC", "#82D4F5", "#F5D076", "#B5A6FF", "#FFA3A3"]
  },
  {
    id: "iscv_cyber_telemetry",
    name: "ISCV Cyber Telemetry",
    category: "ISCV Signature",
    license: "First-Party (@iscvlab)",
    lightColors: ["#0284C7", "#06B6D4", "#6366F1", "#EC4899", "#10B981", "#F59E0B", "#8B5CF6", "#14B8A6"],
    darkColors:  ["#38BDF8", "#22D3EE", "#818CF8", "#F472B6", "#34D399", "#FBBF24", "#A78BFA", "#2DD4BF"]
  },

  // --------------------------------------------------------------------------
  // Category 2: Accessibility & Colorblind-Safe (Public Domain / MIT)
  // --------------------------------------------------------------------------
  {
    id: "okabe_ito_universal",
    name: "Okabe-Ito Colorblind Safe (8-Color)",
    category: "Colorblind-Safe",
    license: "Public Domain (Okabe & Ito 2008)",
    lightColors: ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#56B4E9", "#D55E00", "#F0E442", "#333333"],
    darkColors:  ["#56B4E9", "#E69F00", "#00C49A", "#E295C0", "#7CE0FF", "#FF7B29", "#F0E442", "#E2E8F0"]
  },
  {
    id: "crameri_batlow",
    name: "Crameri Batlow (Scientific Rainbow)",
    category: "Colorblind-Safe",
    license: "MIT (Fabio Crameri)",
    lightColors: ["#011959", "#103F60", "#1B5962", "#3C6D56", "#687B3E", "#9D892B", "#D29843", "#F9A672"],
    darkColors:  ["#4E79C7", "#3896B5", "#43B29E", "#6CC682", "#A4D36A", "#DCE063", "#F9C770", "#FDB893"]
  },
  {
    id: "crameri_vik_diverging",
    name: "Crameri Vik (Blue-Bronze Diverging)",
    category: "Colorblind-Safe",
    license: "MIT (Fabio Crameri)",
    lightColors: ["#001260", "#064585", "#2E7BA6", "#7FB9CE", "#D1C7B7", "#BD8652", "#8C4209", "#590007"],
    darkColors:  ["#3B63C4", "#5491D6", "#79BCE8", "#B3DDF2", "#EADBC8", "#E0A46C", "#C46B27", "#9E2A2B"]
  },

  // --------------------------------------------------------------------------
  // Category 3: Cartographic & Statistical Standards (Apache-2.0 / CC0)
  // --------------------------------------------------------------------------
  {
    id: "brewer_ylgnbu",
    name: "Brewer YlGnBu (Sequential)",
    category: "Cartographic & Statistical",
    license: "Apache-2.0 (ColorBrewer)",
    lightColors: ["#0C2C84", "#225EA8", "#1D91C0", "#41B6C4", "#7FCDBB", "#C7E9B4", "#EDF8B1", "#64748B"],
    darkColors:  ["#38BDF8", "#22D3EE", "#2DD4BF", "#4ADE80", "#A3E635", "#FACC15", "#FEF08A", "#94A3B8"]
  },
  {
    id: "brewer_rdylbu",
    name: "Brewer RdYlBu (Thermal Diverging)",
    category: "Cartographic & Statistical",
    license: "Apache-2.0 (ColorBrewer)",
    lightColors: ["#D73027", "#F46D43", "#FDAE61", "#FEE090", "#E0F3F8", "#ABD9E9", "#74ADD1", "#4575B4"],
    darkColors:  ["#F87171", "#FB923C", "#FBBF24", "#FDE047", "#BAE6FD", "#7DD3FC", "#38BDF8", "#60A5FA"]
  },
  {
    id: "brewer_set2_muted",
    name: "Brewer Set2 (Editorial Qualitative)",
    category: "Cartographic & Statistical",
    license: "Apache-2.0 (ColorBrewer)",
    lightColors: ["#66C2A5", "#FC8D62", "#8DA0CB", "#E78AC3", "#A6D854", "#FFD92F", "#E5C494", "#B3B3B3"],
    darkColors:  ["#6EE7B7", "#FDBA74", "#93C5FD", "#F9A8D4", "#BEF264", "#FDE047", "#FDE68A", "#CBD5E1"]
  },
  {
    id: "viridis_perceptual",
    name: "Viridis (Perceptual Uniform)",
    category: "Cartographic & Statistical",
    license: "CC0 / ISC (Smith & van der Walt)",
    lightColors: ["#440154", "#46327E", "#365C8D", "#277F8E", "#1FA187", "#4AC16D", "#A0DA39", "#FDE725"],
    darkColors:  ["#A78BFA", "#818CF8", "#60A5FA", "#38BDF8", "#2DD4BF", "#4ADE80", "#A3E635", "#FDE047"]
  },
  {
    id: "plasma_thermal",
    name: "Plasma (High-Contrast Thermal)",
    category: "Cartographic & Statistical",
    license: "CC0 / ISC (Smith & van der Walt)",
    lightColors: ["#0D0887", "#5302A3", "#8B0AA5", "#B83289", "#DB5C68", "#F48849", "#FEBC2A", "#F0F921"],
    darkColors:  ["#818CF8", "#A855F7", "#D946EF", "#EC4899", "#F43F5E", "#FB923C", "#FBBF24", "#FEF08A"]
  },

  // --------------------------------------------------------------------------
  // Category 4: Bivariate 3x3 Spatial Matrices (Public Domain / @iscvlab)
  // Ordered row-by-row: [LowX-LowY, MedX-LowY, HighX-LowY, LowX-MedY, ..., HighX-HighY]
  // --------------------------------------------------------------------------
  {
    id: "bivariate_stevens_bluepink",
    name: "Bivariate 3x3: Stevens Blue-Pink",
    category: "Bivariate 3x3 Matrix",
    license: "Public Domain (Joshua Stevens)",
    lightColors: ["#E8E8E8", "#ACE4E4", "#5AC8C8", "#DFB0D6", "#A5ADD3", "#5698B9", "#BE64AC", "#8C62AA", "#3B4994"],
    darkColors:  ["#334155", "#67E8F9", "#06B6D4", "#F0ABFC", "#A5B4FC", "#38BDF8", "#D946EF", "#818CF8", "#3B82F6"]
  },
  {
    id: "bivariate_iscv_tealamber",
    name: "Bivariate 3x3: ISCV Teal-Amber",
    category: "Bivariate 3x3 Matrix",
    license: "First-Party (@iscvlab)",
    lightColors: ["#F1F5F9", "#99F6E4", "#0D9488", "#FDE68A", "#A7F3D0", "#059669", "#D97706", "#B45309", "#1E293B"],
    darkColors:  ["#1E293B", "#5EEAD4", "#14B8A6", "#FDE047", "#6EE7B7", "#10B981", "#F59E0B", "#EA580C", "#F8FAFC"]
  }
];

function getPaletteById(paletteId, isDarkCanvas) {
  const found = ISCV_PALETTES.find(p => p.id === paletteId) || ISCV_PALETTES[0];
  return {
    ...found,
    activeColors: isDarkCanvas ? found.darkColors : found.lightColors
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ISCV_PALETTES, getPaletteById };
}
