import { userHasPermission, type User } from "./auth";
import {
  BusinessEntity,
  Permission,
  UserRole,
  isSuperAdminUser,
  normalizeRole,
} from "./rbac";
import type { AttendanceKind } from "./attendanceCalendar";

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
  if (role === UserRole.ALPHA_COACH && options.some((o) => o.key === "player")) {
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
