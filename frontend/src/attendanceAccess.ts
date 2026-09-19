import type { User } from "./auth";
import {
  BusinessEntity,
  Permission,
  UserRole,
  hasPermission as userHasPermission,
  isAcademicLeadershipUser,
  isSuperAdminUser,
  isWardenUser,
  normalizeRole,
} from "./rbac";
import type { AttendanceKind } from "./attendanceCalendar";
import { isCoachUser, resolveCoachDataScope } from "./coachAccess";
import { isPwsTeacherUser } from "./teacherAccess";

export const PLAYER_VENUES = ["Balua", "Harding Park", "Defense Colony"] as const;
export const PLAYER_SPORTS = ["Cricket", "Football"] as const;
export const PLAYER_CATEGORIES = ["Daily", "Day Boarding", "Boarding", "Hostel"] as const;

export type PlayerVenue = (typeof PLAYER_VENUES)[number];
export type PlayerSport = (typeof PLAYER_SPORTS)[number];
export type PlayerCategory = (typeof PLAYER_CATEGORIES)[number];
export type AttendanceEntityFilter = "PWS" | "ALPHA" | "BOTH";

export type AttendanceRoleView =
  | "teacher"
  | "coach"
  | "warden"
  | "academic_leadership"
  | "admin"
  | "none";

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

const KIND_ENTITY: Record<AttendanceKind, AttendanceEntityFilter> = {
  student: "PWS",
  teacher: "PWS",
  player: "ALPHA",
  coach: "ALPHA",
  staff: "BOTH",
  hostel: "BOTH",
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


export type AttendanceKindOption = {
  key: AttendanceKind;
  label: string;
  icon: "book" | "activity" | "users" | "user-check" | "award" | "home";
  color: string;
};

const KIND_META: Record<AttendanceKind, Omit<AttendanceKindOption, "key">> = {
  student: { label: "Students", icon: "book", color: "#1E40AF" },
  player: { label: "Players", icon: "activity", color: "#16A34A" },
  staff: { label: "Staff", icon: "users", color: "#EA580C" },
  teacher: { label: "Teachers", icon: "user-check", color: "#6366F1" },
  coach: { label: "Coaches", icon: "award", color: "#0EA5E9" },
  hostel: { label: "Hostel", icon: "home", color: "#7C3AED" },
};

export function attendanceRoleView(user: User | null | undefined): AttendanceRoleView {
  if (!user) return "none";
  if (isPwsTeacherUser(user)) return "teacher";
  if (isCoachUser(user) || normalizeRole(user.role) === UserRole.ALPHA_COACH) return "coach";
  if (isWardenUser(user)) return "warden";
  if (isAcademicLeadershipUser(user)) return "academic_leadership";
  const role = normalizeRole(user.role);
  if (
    isSuperAdminUser(user)
    || role === UserRole.PWS_ADMIN
    || role === UserRole.ALPHA_ADMIN
    || user.role === "admin"
  ) {
    return "admin";
  }
  if (userHasPermission(user, Permission.MARK_HOSTEL_ATTENDANCE)) return "warden";
  return "none";
}

function kindMatchesEntity(kind: AttendanceKind, entity: AttendanceEntityFilter): boolean {
  const mapped = KIND_ENTITY[kind];
  if (entity === "BOTH" || mapped === "BOTH") return true;
  return mapped === entity;
}

/** Tabs visible for the current user on Take Attendance (entity-scoped). */
export function getAttendanceKindOptions(
  user: User | null | undefined,
  entity: AttendanceEntityFilter = "BOTH",
): AttendanceKindOption[] {
  if (!user) return [];
  const view = attendanceRoleView(user);
  const keys: AttendanceKind[] = [];

  if (view === "teacher") {
    keys.push("student");
  } else if (view === "coach") {
    keys.push("player");
    if (user.coach_type === "head") keys.push("staff", "coach");
  } else if (view === "warden") {
    keys.push("hostel");
  } else if (view === "academic_leadership") {
    keys.push("teacher", "staff");
    if (
      userHasPermission(user, Permission.MARK_STUDENT_ATTENDANCE)
      || userHasPermission(user, Permission.MARK_PWS_ATTENDANCE, BusinessEntity.PWS)
    ) {
      keys.push("student");
    }
  } else if (view === "admin") {
    keys.push("student", "player", "staff", "teacher", "coach", "hostel");
  } else {
    if (userHasPermission(user, Permission.MARK_STUDENT_ATTENDANCE) || isPwsTeacherUser(user)) {
      keys.push("student");
    }
    if (userHasPermission(user, Permission.MARK_PLAYER_ATTENDANCE) || isCoachUser(user)) {
      keys.push("player");
    }
    if (
      userHasPermission(user, Permission.MARK_PWS_ATTENDANCE, BusinessEntity.PWS)
      || userHasPermission(user, Permission.MARK_ALPHA_ATTENDANCE, BusinessEntity.ALPHA)
    ) {
      keys.push("staff");
    }
    if (userHasPermission(user, Permission.MARK_TEACHER_ATTENDANCE)) keys.push("teacher");
    if (userHasPermission(user, Permission.MARK_ALPHA_ATTENDANCE, BusinessEntity.ALPHA)) {
      keys.push("coach");
    }
    if (userHasPermission(user, Permission.MARK_HOSTEL_ATTENDANCE) || isWardenUser(user)) {
      keys.push("hostel");
    }
  }

  return keys
    .filter((k) => kindMatchesEntity(k, entity))
    .map((key) => ({ key, ...KIND_META[key] }));
}

export function defaultAttendanceKind(
  user: User | null | undefined,
  options: AttendanceKindOption[],
): AttendanceKind | null {
  if (!options.length) return null;
  const view = attendanceRoleView(user);
  const preferred: Record<AttendanceRoleView, AttendanceKind | null> = {
    teacher: "student",
    coach: "player",
    warden: "hostel",
    academic_leadership: "teacher",
    admin: "student",
    none: options[0].key,
  };
  const want = preferred[view];
  if (want && options.some((o) => o.key === want)) return want;
  return options[0].key;
}

export function canAccessTakeAttendance(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "coach") return true;
  return getAttendanceKindOptions(user).length > 0;
}

export function staffOrgSelectable(user: User | null | undefined) {
  return attendanceRoleView(user) === "admin" && (
    isSuperAdminUser(user)
    || (
      userHasPermission(user, Permission.MARK_PWS_ATTENDANCE, BusinessEntity.PWS)
      && userHasPermission(user, Permission.MARK_ALPHA_ATTENDANCE, BusinessEntity.ALPHA)
    )
  );
}

export function entityFilterSelectable(user: User | null | undefined) {
  return attendanceRoleView(user) === "admin";
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

export function roleViewSubtitle(view: AttendanceRoleView, kind: AttendanceKind): string {
  if (view === "teacher") {
    return "PWS class roster · includes ALPHA Boarding / Day Boarding players in your class";
  }
  if (view === "coach") {
    return "Players mapped to your sport, campus, and training batch";
  }
  if (view === "warden") {
    return "Hostel and Boarding residents across ALPHA / PWS";
  }
  if (view === "academic_leadership") {
    return "Teachers, office staff, and academic staff";
  }
  if (kind === "player") return "ALPHA players";
  if (kind === "hostel") return "Hostel & Boarding roll";
  return "Linked to academic calendar";
}
