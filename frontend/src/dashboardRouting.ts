import type { DashboardEntity } from "./dashboardApi";
import { UserRole, normalizeRole } from "./rbac";

export type DashboardView =
  | { kind: "super_admin" }
  | { kind: "org_bento"; lockedEntity: Exclude<DashboardEntity, "both"> }
  | { kind: "teacher" }
  | { kind: "coach" }
  | { kind: "generic" };

/** Map login role to the dashboard shell the user should see. */
export function resolveDashboardView(role: string | undefined): DashboardView {
  if (!role) return { kind: "generic" };
  const canonical = normalizeRole(role);

  switch (canonical) {
    case UserRole.SUPER_ADMIN:
      return { kind: "super_admin" };
    case UserRole.PWS_ADMIN:
    case UserRole.PWS_ACCOUNTS:
      return { kind: "org_bento", lockedEntity: "pws" };
    case UserRole.ALPHA_ADMIN:
    case UserRole.ALPHA_ACCOUNTS:
      return { kind: "org_bento", lockedEntity: "alpha" };
    case UserRole.PWS_TEACHER:
      return { kind: "teacher" };
    case UserRole.ALPHA_COACH:
      return { kind: "coach" };
    default:
      return { kind: "generic" };
  }
}

export function orgDashboardSubtitle(role: string | undefined, lockedEntity: "pws" | "alpha"): string {
  const canonical = normalizeRole(role || "");
  if (lockedEntity === "pws") {
    if (canonical === UserRole.PWS_ACCOUNTS) return "PWS Accounts · fees & operations";
    if (role === "principal") return "Principal · Prarambhika World School";
    if (role === "vice_principal") return "Vice Principal · Prarambhika World School";
    return "Prarambhika World School operations";
  }
  if (canonical === UserRole.ALPHA_ACCOUNTS) return "ALPHA Accounts · fees & operations";
  return "ALPHA Sports Academy operations";
}

export function isAccountsDashboardRole(role: string | undefined): boolean {
  const canonical = normalizeRole(role || "");
  return canonical === UserRole.PWS_ACCOUNTS || canonical === UserRole.ALPHA_ACCOUNTS;
}
