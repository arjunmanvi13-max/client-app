import type { User } from "./auth";
import { UserRole, normalizeRole, type RBACUser } from "./rbac";
import { assignedEntityScope } from "./entityScopeUtils";

/** True for PWS classroom teachers (legacy `teacher` role included). */
export function isTeacherUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const role = (user.role || "").trim().toLowerCase();
  if (role === "teacher" || role === "pws_teacher") return true;
  return normalizeRole(user.role) === UserRole.PWS_TEACHER;
}

/** Teachers scoped to PWS — excludes ALPHA coaches/admins mis-tagged as teacher. */
export function isPwsTeacherUser(user: User | null | undefined): boolean {
  if (!isTeacherUser(user)) return false;
  const scope = assignedEntityScope(user as RBACUser);
  return scope === "pws" || scope === "both";
}

/** Routes teachers must not access (sidebar hidden + direct URL blocked). */
export const TEACHER_BLOCKED_PATH_PREFIXES = [
  "/directory",
  "/manage",
  "/fees",
  "/reports",
  "/admin/financials",
  "/admin/fee-catalog",
  "/admin/attendance",
  "/admin/marks",
  "/admin/approvals",
  "/admin/permissions",
  "/admin/settings",
  "/admin/academic",
  "/staff-attendance",
  "/coach-attendance",
] as const;

export function isTeacherBlockedPath(pathname: string): boolean {
  const p = pathname || "";
  if (p.startsWith("/manage/")) return true;
  return TEACHER_BLOCKED_PATH_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`),
  );
}

export type TeacherDataScope = {
  isTeacher: boolean;
  entity: "pws";
  organization: "PWS";
};

/** Resolve teacher entity scope from session — PWS student operations only. */
export function resolveTeacherDataScope(user: User | null | undefined): TeacherDataScope {
  if (!isPwsTeacherUser(user)) {
    return { isTeacher: false, entity: "pws", organization: "PWS" };
  }
  return { isTeacher: true, entity: "pws", organization: "PWS" };
}

/** Institution param for PWS-scoped API calls. */
export function teacherInstitutionParam(): "PWS" {
  return "PWS";
}
