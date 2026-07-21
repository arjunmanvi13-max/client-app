/**
 * Centralised theme tokens for PWS & ALPHA Tracker.
 * PWS deep blue (#1B3B6F) + ALPHA electric cyan (#00A8E8) on a slate canvas.
 */
export const brand = {
  /** PWS — sidebar, headings, structural chrome */
  primary: "#1B3B6F",
  /** ALPHA — buttons, active nav, filters, tabs */
  secondary: "#00A8E8",
  success: "#00C49F",
  alert: "#FF6B6B",
} as const;

export const colors = {
  // Brand
  primary: brand.primary,
  primaryHover: "#15325E",
  primarySoft: "#D9E4F2",
  primarySofter: "#EEF3F9",
  primaryDeeper: "#142D52",
  accent: brand.secondary,
  accentHover: "#0096D1",
  accentSoft: "#E0F7FC",
  brandGradient: [brand.secondary, brand.primary, "#142D52"] as const,

  // Neutrals (slate canvas)
  ink: "#0F172A",
  ink2: "#1E293B",
  muted: "#475569",
  muted2: "#64748B",
  hint: "#94A3B8",
  border: "#E2E8F0",
  borderSoft: "#F1F5F9",
  bg: "#F8FAFC",
  surface: "#FFFFFF",
  surface2: "#F8FAFC",

  // Status
  success: brand.success,
  successSoft: "#E0FBF6",
  warning: brand.alert,
  warningSoft: "#FFE8E8",
  danger: brand.alert,
  dangerSoft: "#FFE8E8",
  info: brand.secondary,
  infoSoft: "#E0F7FC",

  /** Text on PWS sidebar surfaces */
  sidebarText: "#E2E8F0",
  sidebarTextMuted: "#94A3B8",
  sidebarBorder: "rgba(255,255,255,0.12)",
  sidebarHover: "rgba(255,255,255,0.08)",
  sidebarActive: "rgba(0,168,232,0.18)",
} as const;

export const radii = { sm: 8, md: 12, lg: 14, xl: 16, xxl: 20, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Form surfaces — action buttons use ALPHA secondary accent. */
export const formColors = {
  primary: brand.secondary,
  primaryHover: "#0096D1",
  primarySoft: "#E0F7FC",
  pageBg: colors.bg,
  danger: brand.alert,
  dangerSoft: "#FFE8E8",
} as const;

export const shadow = {
  sm: { shadowColor: "#0F172A", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  md: { shadowColor: "#0F172A", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
};

/** Breakpoints — mobile (<768), tablet (768-1023), desktop (>=1024). */
export const BREAKPOINTS = { tablet: 768, desktop: 1024 } as const;
