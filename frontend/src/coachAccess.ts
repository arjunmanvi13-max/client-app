import type { User } from "./auth";
import { UserRole, normalizeRole } from "./rbac";

/** True when the logged-in account is an ALPHA coach (legacy `coach` role included). */
export function isCoachUser(user: User | null | undefined): boolean {
  if (!user) return false;
  return normalizeRole(user.role) === UserRole.ALPHA_COACH;
}

/** Routes coaches must not access (sidebar hidden + direct URL blocked). */
export const COACH_BLOCKED_PATH_PREFIXES = [
  "/directory",
  "/notifications",
  "/manage/staff",
] as const;

export function isCoachBlockedPath(pathname: string): boolean {
  const p = pathname || "";
  return COACH_BLOCKED_PATH_PREFIXES.some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`),
  );
}

/** Assigned sports for a coach — mirrors backend `_coach_assignment_lists`. */
export function coachAssignedSports(user: User | null | undefined): string[] {
  if (!user) return [];
  const sports = [...(user.assigned_sports || [])];
  if (!sports.length && user.assigned_sport) sports.push(user.assigned_sport);
  return sports;
}
