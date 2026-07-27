import { userHasPermission, type User } from "./auth";
import {
  BusinessEntity,
  Permission,
  UserRole,
  isSuperAdminUser,
  normalizeRole,
} from "./rbac";
import type { AttendanceKind } from "./attendanceCalendar";
import { isCoachUser, resolveCoachDataScope } from "./coachAccess";

export const PLAYER_VENUES = ["Balua", "Harding Park"] as const;
export const PLAYER_SPORTS = ["Cricket", "Football"] as const;
export const PLAYER_CATEGORIES = ["Daily", "Day Boarding", "Boarding", "Hostel"] as const;

export type PlayerVenue = (typeof PLAYER_VENUES)[number];
export type PlayerSport = (typeof PLAYER_SPORTS)[number];
export type PlayerCategory = (typeof PLAYER_CATEGORIES)[number];

export type PlayerFilterScope = {
  fullAccess: boolean;
  venues: PlayerVenue[];
  sports: PlayerSport[];
  categories: PlayerCategory[];
  lockedVenues: boolean;
  lockedSports: boolean;
  requiresSportAssignment: boolean;
  defaultVenues: PlayerVenue[];
  defaultSports: PlayerSport[];
};

/** Venue/sport/category filter bounds for the Players tab (coaches scoped to assignments). */
export function resolvePlayerFilterScope(user: User | null | undefined): PlayerFilterScope {
  const allVenues = [...PLAYER_VENUES];
  const allSports = [...PLAYER_SPORTS];
  const allCategories = [...PLAYER_CATEGORIES];
  const superAdmin = isSuperAdminUser(user);
  const role = normalizeRole(user?.role || "");
  const canAlpha =
    superAdmin
    || userHasPermission(user, Permission.MARK_ALPHA_ATTENDANCE, BusinessEntity.ALPHA)
    || role === UserRole.ALPHA_ADMIN;

  if (canAlpha && !isCoachUser(user)) {
    return {
      fullAccess: true,
      venues: allVenues,
      sports: allSports,
      categories: allCategories,
      lockedVenues: false,
      lockedSports: false,
      requiresSportAssignment: false,
      defaultVenues: [],
      defaultSports: [],
    };
  }

  const coachScope = resolveCoachDataScope(user);
  if (isCoachUser(user) || role === UserRole.ALPHA_COACH) {
    const venues = (coachScope.assignedCentres.filter((c) =>
      allVenues.includes(c as PlayerVenue),
    ) as PlayerVenue[]) || [];
    const scopedVenues = venues.length ? venues : allVenues;
    const scopedSports = coachScope.assignedSport
      ? [coachScope.assignedSport as PlayerSport]
      : allSports;
    return {
      fullAccess: false,
      venues: scopedVenues,
      sports: scopedSports,
      categories: allCategories,
      lockedVenues: scopedVenues.length <= 1,
      lockedSports: coachScope.sportLocked,
      requiresSportAssignment: coachScope.requiresSportAssignment,
      defaultVenues: scopedVenues.length === 1 ? scopedVenues : [],
      defaultSports: scopedSports.length === 1 ? scopedSports : [],
    };
  }

  return {
    fullAccess: true,
    venues: allVenues,
    sports: allSports,
    categories: allCategories,
    lockedVenues: false,
    lockedSports: false,
    requiresSportAssignment: false,
    defaultVenues: [],
    defaultSports: [],
  };
}

export function toggleFilterValue<T extends string>(selected: T[], value: T): T[] {
  return selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
}

export function filterPlayersBySelection<
  T extends { centre?: string; sport?: string; player_type?: string },
>(
  roster: T[],
  venues: string[],
  sports: string[],
  categories: string[],
): T[] {
  return roster.filter((p) => {
    if (venues.length && !venues.includes(p.centre || "")) return false;
    if (sports.length && !sports.includes(p.sport || "")) return false;
    if (categories.length && !categories.includes(p.player_type || "")) return false;
    return true;
  });
}

export type AttendanceKindOption = {
  key: AttendanceKind;
  label: string;
  icon: "book" | "activity" | "users" | "user-check" | "award";
  color: string;
};

/** Tabs visible for the current user on Take Attendance (entity-scoped). */
export function getAttendanceKindOptions(user: User | null | undefined): AttendanceKindOption[] {
  if (!user) return [];

  const superAdmin = isSuperAdminUser(user);
  const role = normalizeRole(user?.role || "");

  const canPwsAttendance =
    superAdmin
    || userHasPermission(user, Permission.MARK_PWS_ATTENDANCE, BusinessEntity.PWS);

  const canAlphaAttendance =
    superAdmin
    || userHasPermission(user, Permission.MARK_ALPHA_ATTENDANCE, BusinessEntity.ALPHA);

  const options: AttendanceKindOption[] = [];

  if (
    canPwsAttendance
    || userHasPermission(user, Permission.MARK_STUDENT_ATTENDANCE)
    || role === UserRole.PWS_TEACHER
  ) {
    options.push({ key: "student", label: "Students", icon: "book", color: "#1E40AF" });
  }

  if (
    canAlphaAttendance
    || userHasPermission(user, Permission.MARK_PLAYER_ATTENDANCE)
    || role === UserRole.ALPHA_COACH
    || isCoachUser(user)
  ) {
    options.push({ key: "player", label: "Players", icon: "activity", color: "#16A34A" });
  }

  if (
    superAdmin
    || canPwsAttendance
    || canAlphaAttendance
    || role === UserRole.PWS_ADMIN
    || role === UserRole.ALPHA_ADMIN
  ) {
    options.push({ key: "staff", label: "Staff", icon: "users", color: "#EA580C" });
  }

  if (canPwsAttendance || userHasPermission(user, Permission.MARK_TEACHER_ATTENDANCE)) {
    options.push({ key: "teacher", label: "Teachers", icon: "user-check", color: "#6366F1" });
  }

  const isHeadCoach = role === UserRole.ALPHA_COACH && user?.coach_type === "head";
  if (canAlphaAttendance || isHeadCoach) {
    options.push({ key: "coach", label: "Coaches", icon: "award", color: "#0EA5E9" });
  }

  return options;
}

export function defaultAttendanceKind(
  user: User | null | undefined,
  options: AttendanceKindOption[],
): AttendanceKind | null {
  if (!options.length) return null;
  const role = normalizeRole(user?.role || "");
  if (role === UserRole.PWS_TEACHER && options.some((o) => o.key === "student")) {
    return "student";
  }
  if ((role === UserRole.ALPHA_COACH || isCoachUser(user)) && options.some((o) => o.key === "player")) {
    return "player";
  }
  return options[0].key;
}

export function canAccessTakeAttendance(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "coach") return true;
  return getAttendanceKindOptions(user).length > 0;
}

export function staffOrgSelectable(user: User | null | undefined) {
  return isSuperAdminUser(user)
    || (
      userHasPermission(user, Permission.MARK_PWS_ATTENDANCE, BusinessEntity.PWS)
      && userHasPermission(user, Permission.MARK_ALPHA_ATTENDANCE, BusinessEntity.ALPHA)
    );
}

export function resolveDefaultStaffOrg(user: User | null | undefined): "PWS" | "ALPHA" {
  if (isSuperAdminUser(user)) return "PWS";
  if (
    userHasPermission(user, Permission.MARK_ALPHA_ATTENDANCE, BusinessEntity.ALPHA)
    && !userHasPermission(user, Permission.MARK_PWS_ATTENDANCE, BusinessEntity.PWS)
  ) {
    return "ALPHA";
  }
  if (normalizeRole(user?.role || "") === UserRole.ALPHA_ADMIN) return "ALPHA";
  return "PWS";
}
