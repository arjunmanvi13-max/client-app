/** Task assignee role filter chips and list filtering. */
import { isActiveUser } from "./userStatus";
import { userHasPermission } from "./auth";
import { BusinessEntity, Permission } from "./rbac";

export type AssigneeRoleFilter =
  | "all"
  | "teachers"
  | "staff"
  | "coaches"
  | "administration";

export const ASSIGNEE_ROLE_FILTERS: { key: AssigneeRoleFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "teachers", label: "Teachers" },
  { key: "staff", label: "Staff" },
  { key: "coaches", label: "Coaches" },
  { key: "administration", label: "Administration" },
];

export type AssigneeUser = {
  id: string;
  name?: string;
  role?: string;
  organization?: string;
  department?: string;
  status?: string;
  is_active?: boolean;
};

function normalizeRole(role?: string): string {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "_");
}

export function assigneeSearchText(user: AssigneeUser): string {
  const role = (user.role || "").replace(/_/g, " ");
  return [user.name, role, user.organization, user.department]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchesAssigneeRoleFilter(user: AssigneeUser, filter: AssigneeRoleFilter): boolean {
  if (filter === "all") return true;
  const role = normalizeRole(user.role);
  switch (filter) {
    case "teachers":
      return role === "teacher" || role === "pws_teacher";
    case "staff":
      return role === "staff" || role === "warden" || role === "librarian";
    case "coaches":
      return role === "coach" || role === "alpha_coach";
    case "administration":
      return [
        "principal",
        "vice_principal",
        "admin",
        "super_admin",
        "pws_admin",
        "alpha_admin",
        "sports_admin",
      ].includes(role);
    default:
      return true;
  }
}

export function filterAssigneeUsers(
  users: AssigneeUser[],
  query: string,
  roleFilter: AssigneeRoleFilter,
): AssigneeUser[] {
  const q = query.trim().toLowerCase();
  return users.filter((user) => {
    if (!isActiveUser(user)) return false;
    if (!matchesAssigneeRoleFilter(user, roleFilter)) return false;
    if (!q) return true;
    return assigneeSearchText(user).includes(q);
  });
}

const NON_ASSIGNABLE_ROLES = new Set(["student", "player", "parent"]);

const PWS_DELEGATE_ROLES = new Set([
  "teacher",
  "pws_teacher",
  "staff",
  "warden",
  "librarian",
  "pws_accounts",
]);

const ALPHA_DELEGATE_ROLES = new Set([
  "coach",
  "alpha_coach",
  "alpha_accounts",
]);

const ADMIN_DELEGATE_ROLES = new Set([
  ...PWS_DELEGATE_ROLES,
  ...ALPHA_DELEGATE_ROLES,
  "principal",
  "vice_principal",
  "pws_admin",
  "alpha_admin",
  "admin",
  "sports_admin",
]);

/** Filter directory users the current user may delegate tasks to. */
export function filterAssignableUsersForCreator(
  currentUser: { id?: string; role?: string; permissions?: string[] } | null | undefined,
  users: AssigneeUser[],
): AssigneeUser[] {
  if (!currentUser?.id) return [];
  const allowedRoles = new Set<string>();

  if (
    userHasPermission(currentUser, Permission.MANAGE_ACCESS)
    || normalizeRole(currentUser.role) === "super_admin"
  ) {
    return users.filter((user) => {
      if (user.id === currentUser.id) return false;
      return !NON_ASSIGNABLE_ROLES.has(normalizeRole(user.role));
    });
  }

  if (userHasPermission(currentUser, Permission.CREATE_TEACHER_TASKS, BusinessEntity.PWS)) {
    PWS_DELEGATE_ROLES.forEach((role) => allowedRoles.add(role));
  }
  if (userHasPermission(currentUser, Permission.CREATE_COACH_TASKS, BusinessEntity.ALPHA)) {
    ALPHA_DELEGATE_ROLES.forEach((role) => allowedRoles.add(role));
  }
  if (userHasPermission(currentUser, Permission.MANAGE_PWS_TASKS, BusinessEntity.PWS)) {
    PWS_DELEGATE_ROLES.forEach((role) => allowedRoles.add(role));
  }
  if (userHasPermission(currentUser, Permission.MANAGE_ALPHA_TASKS, BusinessEntity.ALPHA)) {
    ALPHA_DELEGATE_ROLES.forEach((role) => allowedRoles.add(role));
  }

  const creatorRole = normalizeRole(currentUser.role);
  if (allowedRoles.size === 0) {
    if (["principal", "vice_principal", "pws_admin"].includes(creatorRole)) {
      PWS_DELEGATE_ROLES.forEach((role) => allowedRoles.add(role));
    } else if (["alpha_admin", "admin", "sports_admin"].includes(creatorRole)) {
      ALPHA_DELEGATE_ROLES.forEach((role) => allowedRoles.add(role));
    } else if (ADMIN_DELEGATE_ROLES.has(creatorRole)) {
      ADMIN_DELEGATE_ROLES.forEach((role) => allowedRoles.add(role));
    }
  }

  if (allowedRoles.size === 0) return [];

  return users.filter((user) => {
    if (user.id === currentUser.id) return false;
    if (!isActiveUser(user)) return false;
    return allowedRoles.has(normalizeRole(user.role));
  });
}
