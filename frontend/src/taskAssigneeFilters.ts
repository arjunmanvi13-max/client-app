/** Task assignee role filter chips and list filtering. */
import { isActiveUser } from "./userStatus";

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
