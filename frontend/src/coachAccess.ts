import type { User } from "./auth";

/** True when the logged-in account is an ALPHA coach (legacy `coach` role included). */
export function isCoachUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const role = (user.role || "").toLowerCase();
  return role === "coach" || role === "alpha_coach";
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

export type CoachScopeMeta = {
  entity?: string;
  assigned_sport?: { id: string; name: string; code: string } | null;
  assigned_centres?: string[];
  sport_locked?: boolean;
  sport_assignment_status?: "ok" | "required" | "ambiguous" | null;
};

export type CoachDataScope = {
  isCoach: boolean;
  assignedSport: string | null;
  assignedCentres: string[];
  sportLocked: boolean;
  requiresSportAssignment: boolean;
  sportAssignmentStatus: string | null;
};

/** Assigned sports for a coach — mirrors backend `coach_assignment_lists`. */
export function coachAssignedSports(user: User | null | undefined): string[] {
  if (!user) return [];
  const sports = [...(user.assigned_sports || [])];
  if (!sports.length && user.assigned_sport) sports.push(user.assigned_sport);
  return sports;
}

/** Resolve coach scope from server-provided `/auth/me` payload (display-only). */
export function resolveCoachDataScope(user: User | null | undefined): CoachDataScope {
  if (!isCoachUser(user)) {
    return {
      isCoach: false,
      assignedSport: null,
      assignedCentres: [],
      sportLocked: false,
      requiresSportAssignment: false,
      sportAssignmentStatus: null,
    };
  }
  const serverScope = (user as any)?.coach_scope;
  if (serverScope) {
    return {
      isCoach: true,
      assignedSport: serverScope.assigned_sport?.name || user?.assigned_sport || null,
      assignedCentres: serverScope.assigned_centres || user?.assigned_centres || [],
      sportLocked: !!serverScope.sport_locked,
      requiresSportAssignment: !!serverScope.requires_sport_assignment,
      sportAssignmentStatus: serverScope.sport_assignment_status || null,
    };
  }
  const sports = coachAssignedSports(user);
  const status = (user as any)?.sport_assignment_status || (sports.length === 1 ? "ok" : sports.length > 1 ? "ambiguous" : "required");
  return {
    isCoach: true,
    assignedSport: sports.length === 1 ? sports[0] : user?.assigned_sport || null,
    assignedCentres: user?.assigned_centres || [],
    sportLocked: sports.length === 1,
    requiresSportAssignment: status === "required" || status === "ambiguous",
    sportAssignmentStatus: status,
  };
}

export function coachSportAssignmentMessage(scope: CoachDataScope): string {
  if (!scope.requiresSportAssignment) return "";
  if (scope.sportAssignmentStatus === "ambiguous") {
    return "Your coach account has multiple sport assignments. Please contact the Sports Admin.";
  }
  return "Your account must be assigned to Cricket or Football before player data can be shown.";
}

/** Unwrap coach player list API response `{ data, scope }` or plain array. */
export function unwrapCoachPlayerList<T>(payload: T[] | { data?: T[]; scope?: CoachScopeMeta }): T[] {
  if (Array.isArray(payload)) return payload;
  return payload?.data || [];
}
