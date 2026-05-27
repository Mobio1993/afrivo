export const DEFAULT_THEME = "teal";
export const THEME_STORAGE_KEY = "afrivo_theme";

export const THEMES = {
  teal: {
    id: "teal",
    name: "AFRIVO Teal",
    description: "Theme original - Teal sombre",
    previewColors: {
      sidebar: "#0c1f2c",
      accent: "#5DCAA5",
      content: "#F0F4F8",
    },
    vars: {
      "--theme-sidebar-bg": "#0c1f2c",
      "--theme-sidebar-bg-deep": "#071318",
      "--theme-topbar-bg": "#0c1f2c",
      "--theme-nav-active-bg": "rgba(15,110,86,0.25)",
      "--theme-nav-active-color": "#5DCAA5",
      "--theme-nav-text": "rgba(255,255,255,0.45)",
      "--theme-hotel-badge-bg": "rgba(15,110,86,0.15)",
      "--theme-hotel-badge-bg-hover": "rgba(15,110,86,0.2)",
      "--theme-hotel-badge-border": "rgba(15,110,86,0.25)",
      "--theme-hotel-dot": "#5DCAA5",
      "--theme-primary": "#085041",
      "--theme-primary-hover": "#0F6E56",
      "--theme-primary-light": "#E1F5EE",
      "--theme-primary-border": "#9FE1CB",
      "--theme-accent": "#5DCAA5",
      "--theme-success-bg": "#EAF3DE",
      "--theme-success-color": "#3B6D11",
      "--theme-warning-bg": "#FAEEDA",
      "--theme-warning-color": "#854F0B",
      "--theme-danger-bg": "#FCEBEB",
      "--theme-danger-color": "#A32D2D",
      "--theme-btn-primary-bg": "#085041",
      "--theme-btn-primary-color": "#E1F5EE",
      "--theme-btn-primary-hover": "#0F6E56",
      "--theme-link-color": "#085041",
      "--theme-ref-color": "#085041",
      "--theme-accent-rgb": "93, 202, 165",
      "--theme-primary-rgb": "8, 80, 65",
    },
  },
  navy: {
    id: "navy",
    name: "Midnight Navy",
    description: "Theme bleu nuit - Elegant et moderne",
    previewColors: {
      sidebar: "#0D1220",
      accent: "#60A5FA",
      content: "#F8FAFC",
    },
    vars: {
      "--theme-sidebar-bg": "#0D1220",
      "--theme-sidebar-bg-deep": "#0A0E1A",
      "--theme-topbar-bg": "#0A0E1A",
      "--theme-nav-active-bg": "rgba(37,99,235,0.2)",
      "--theme-nav-active-color": "#60A5FA",
      "--theme-nav-text": "rgba(255,255,255,0.45)",
      "--theme-hotel-badge-bg": "rgba(37,99,235,0.12)",
      "--theme-hotel-badge-bg-hover": "rgba(37,99,235,0.18)",
      "--theme-hotel-badge-border": "rgba(37,99,235,0.2)",
      "--theme-hotel-dot": "#60A5FA",
      "--theme-primary": "#2563EB",
      "--theme-primary-hover": "#1D4ED8",
      "--theme-primary-light": "#EFF6FF",
      "--theme-primary-border": "#93C5FD",
      "--theme-accent": "#60A5FA",
      "--theme-success-bg": "#DCFCE7",
      "--theme-success-color": "#166534",
      "--theme-warning-bg": "#FEF3C7",
      "--theme-warning-color": "#92400E",
      "--theme-danger-bg": "#FEE2E2",
      "--theme-danger-color": "#991B1B",
      "--theme-btn-primary-bg": "#2563EB",
      "--theme-btn-primary-color": "#ffffff",
      "--theme-btn-primary-hover": "#1D4ED8",
      "--theme-link-color": "#2563EB",
      "--theme-ref-color": "#2563EB",
      "--theme-accent-rgb": "96, 165, 250",
      "--theme-primary-rgb": "37, 99, 235",
    },
  },
};

export function getTheme(themeId) {
  return THEMES[themeId] || THEMES[DEFAULT_THEME];
}

export function applyThemeVariables(themeId) {
  const theme = getTheme(themeId);
  const root = document.documentElement;

  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  document.body?.setAttribute("data-theme", theme.id);
  return theme.id;
}
