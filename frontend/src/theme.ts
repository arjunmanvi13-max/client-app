/**
 * Centralised theme tokens for PWS & ALPHA Tracker.
 * Blue/white palette aligned with the ALPHA Sports Academy logo.
 */
export const colors = {
  // Brand
  primary: "#1E40AF",        // deep royal blue
  primaryHover: "#1D4ED8",
  primarySoft: "#DBEAFE",    // surface tint
  primarySofter: "#EFF6FF",  // even lighter surface
  primaryDeeper: "#1E3A8A",  // for headers / drawers
  accent: "#0EA5E9",         // sky blue
  accentSoft: "#E0F2FE",
  brandGradient: ["#0891B2", "#1D4ED8", "#1E3A8A"] as const,

  // Greys
  ink: "#0F172A",
  ink2: "#1E293B",
  muted: "#475569",
  muted2: "#64748B",
  hint: "#94A3B8",
  border: "#E2E8F0",
  borderSoft: "#F1F5F9",
  bg: "#F4F5F7",
  surface: "#FFFFFF",
  surface2: "#F8FAFC",

  // Status
  success: "#10B981",
  successSoft: "#D1FAE5",
  warning: "#F59E0B",
  warningSoft: "#FEF3C7",
  danger: "#EF4444",
  dangerSoft: "#FEE2E2",
  info: "#0EA5E9",
  infoSoft: "#E0F2FE",
} as const;

export const radii = { sm: 8, md: 12, lg: 14, xl: 20, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const shadow = {
  sm: { shadowColor: "#0F172A", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  md: { shadowColor: "#0F172A", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
};

/** Breakpoints — mobile (<768), tablet (768-1023), desktop (>=1024). */
export const BREAKPOINTS = { tablet: 768, desktop: 1024 } as const;
