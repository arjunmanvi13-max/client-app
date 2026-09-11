/**
 * Canonical login user types — mirrors backend user_classification.py.
 * Access Control > Manage Users & Rosters shows ONLY these seven categories.
 */
import { UserRole } from "./rbac";

export type LoginUserType = UserRole.SUPER_ADMIN | UserRole.PWS_ADMIN | UserRole.ALPHA_ADMIN
  | UserRole.PWS_ACCOUNTS | UserRole.ALPHA_ACCOUNTS | UserRole.PWS_TEACHER | UserRole.ALPHA_COACH;

export const APPROVED_LOGIN_USER_TYPES: LoginUserType[] = [
  UserRole.SUPER_ADMIN,
  UserRole.PWS_ADMIN,
  UserRole.ALPHA_ADMIN,
  UserRole.PWS_ACCOUNTS,
  UserRole.ALPHA_ACCOUNTS,
  UserRole.PWS_TEACHER,
  UserRole.ALPHA_COACH,
];

export type PwsAdminDesignation =
  | "PRINCIPAL"
  | "VICE_PRINCIPAL"
  | "ACADEMIC_HEAD"
  | "EVENT_COORDINATOR";

export const PWS_ADMIN_DESIGNATIONS: PwsAdminDesignation[] = [
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "ACADEMIC_HEAD",
  "EVENT_COORDINATOR",
];

export type UserTypeCatalogItem = {
  code: LoginUserType;
  displayName: string;
  entityScope: "PWS" | "ALPHA" | "BOTH";
  category: string;
  description: string;
  manageDescription: string;
  allowedDesignations: PwsAdminDesignation[];
  requiresAssignedSport: boolean;
  requiresAssignedVenue: boolean;
  icon: string;
  tint: string;
};

/** Static catalog — prefer GET /users/classification when online. */
export const USER_TYPE_CATALOG: UserTypeCatalogItem[] = [
  {
    code: UserRole.SUPER_ADMIN,
    displayName: "Super Admin",
    entityScope: "BOTH",
    category: "Administration",
    description: "Full system control across PWS and ALPHA",
    manageDescription: "Full system control across PWS and ALPHA",
    allowedDesignations: [],
    requiresAssignedSport: false,
    requiresAssignedVenue: false,
    icon: "shield",
    tint: "#0F172A",
  },
  {
    code: UserRole.PWS_ADMIN,
    displayName: "PWS Admin",
    entityScope: "PWS",
    category: "Administration",
    description: "PWS administration — Principal, Vice Principal, Academic Head, Event Coordinator",
    manageDescription: "PWS administration — Principal, Vice Principal, Academic Head, Event Coordinator",
    allowedDesignations: [...PWS_ADMIN_DESIGNATIONS],
    requiresAssignedSport: false,
    requiresAssignedVenue: false,
    icon: "book",
    tint: "#2563EB",
  },
  {
    code: UserRole.ALPHA_ADMIN,
    displayName: "ALPHA Admin",
    entityScope: "ALPHA",
    category: "Administration",
    description: "ALPHA operations — players, coaches and attendance",
    manageDescription: "ALPHA operations — players, coaches and attendance",
    allowedDesignations: [],
    requiresAssignedSport: false,
    requiresAssignedVenue: false,
    icon: "shield",
    tint: "#7C3AED",
  },
  {
    code: UserRole.PWS_ACCOUNTS,
    displayName: "PWS Accounts",
    entityScope: "PWS",
    category: "Accounts",
    description: "PWS student fees, tasks and reports",
    manageDescription: "PWS student fees, tasks and reports",
    allowedDesignations: [],
    requiresAssignedSport: false,
    requiresAssignedVenue: false,
    icon: "dollar-sign",
    tint: "#0891B2",
  },
  {
    code: UserRole.ALPHA_ACCOUNTS,
    displayName: "ALPHA Accounts",
    entityScope: "ALPHA",
    category: "Accounts",
    description: "ALPHA player fees, tasks and reports",
    manageDescription: "ALPHA player fees, tasks and reports",
    allowedDesignations: [],
    requiresAssignedSport: false,
    requiresAssignedVenue: false,
    icon: "dollar-sign",
    tint: "#16A34A",
  },
  {
    code: UserRole.PWS_TEACHER,
    displayName: "PWS Teachers",
    entityScope: "PWS",
    category: "Teaching",
    description: "PWS student attendance and marks",
    manageDescription: "Manage teacher login accounts — add new teachers from Directory → Teachers",
    allowedDesignations: [],
    requiresAssignedSport: false,
    requiresAssignedVenue: false,
    icon: "book-open",
    tint: "#1E40AF",
  },
  {
    code: UserRole.ALPHA_COACH,
    displayName: "ALPHA Coaches",
    entityScope: "ALPHA",
    category: "Coaching",
    description: "ALPHA player attendance and assessments",
    manageDescription: "ALPHA player attendance and assessments",
    allowedDesignations: [],
    requiresAssignedSport: true,
    requiresAssignedVenue: true,
    icon: "award",
    tint: "#EA580C",
  },
];

export const CATALOG_BY_CODE = Object.fromEntries(
  USER_TYPE_CATALOG.map((item) => [item.code, item]),
) as Record<LoginUserType, UserTypeCatalogItem>;

export function isApprovedLoginUserType(kind: string): kind is LoginUserType {
  return (APPROVED_LOGIN_USER_TYPES as string[]).includes(kind);
}

/** Normalize expo-router params that may be string | string[]. */
export function resolveRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

/** Legacy role stored on user docs — mirrors backend user_classification.py. */
export function legacyRoleForUserType(
  userType: LoginUserType,
  designation?: PwsAdminDesignation | null,
): string {
  switch (userType) {
    case UserRole.SUPER_ADMIN: return "super_admin";
    case UserRole.PWS_ADMIN:
      if (designation === "VICE_PRINCIPAL") return "vice_principal";
      if (designation === "PRINCIPAL") return "principal";
      return "pws_admin";
    case UserRole.ALPHA_ADMIN: return "admin";
    case UserRole.PWS_ACCOUNTS: return "pws_accounts";
    case UserRole.ALPHA_ACCOUNTS: return "alpha_accounts";
    case UserRole.PWS_TEACHER: return "teacher";
    case UserRole.ALPHA_COACH: return "coach";
    default: return userType;
  }
}

/** Legacy role values that map to each canonical user type (pre-migration fallback). */
export const LEGACY_ROLES_BY_USER_TYPE: Record<LoginUserType, string[]> = {
  [UserRole.SUPER_ADMIN]: ["super_admin"],
  [UserRole.PWS_ADMIN]: ["principal", "vice_principal", "pws_admin"],
  [UserRole.ALPHA_ADMIN]: ["admin", "alpha_admin"],
  [UserRole.PWS_ACCOUNTS]: ["pws_accounts"],
  [UserRole.ALPHA_ACCOUNTS]: ["alpha_accounts"],
  [UserRole.PWS_TEACHER]: ["teacher", "pws_teacher"],
  [UserRole.ALPHA_COACH]: ["coach", "alpha_coach"],
};

export function matchesUserType(user: { user_type?: string; role?: string }, userType: LoginUserType): boolean {
  if (user.user_type === userType) return true;
  const legacy = LEGACY_ROLES_BY_USER_TYPE[userType];
  return legacy.includes(user.role || "");
}

export function filterUsersByType(users: any[], userType: LoginUserType): any[] {
  return users.filter((u) => matchesUserType(u, userType));
}

export function entityScopeLabel(scope: string): string {
  if (scope === "BOTH") return "Both PWS & ALPHA";
  return scope;
}

export function designationLabel(d?: string | null): string {
  if (!d) return "";
  return d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function pwsAdminDesignationLabel(d: PwsAdminDesignation): string {
  return designationLabel(d);
}

export function isPwsAdminDesignation(value: string | null | undefined): value is PwsAdminDesignation {
  return !!value && (PWS_ADMIN_DESIGNATIONS as string[]).includes(value);
}

export function userDisplayLabel(user: {
  name?: string;
  user_type?: string;
  user_type_display?: string;
  designation?: string;
  role?: string;
  role_display?: string;
}): string {
  const typeLabel = user.user_type_display
    || CATALOG_BY_CODE[user.user_type as LoginUserType]?.displayName
    || user.role_display
    || user.role
    || "";
  const des = designationLabel(user.designation);
  if (des && user.user_type === UserRole.PWS_ADMIN) {
    return `${user.name || ""} — ${typeLabel} · ${des}`.trim();
  }
  return `${user.name || ""}${typeLabel ? ` — ${typeLabel}` : ""}`.trim();
}

export type LoginTier = "super_admin" | "admin" | "staff";
export type LoginTierKind = "super_admin" | "login_admin" | "login_staff";
export type EntityScope = "PWS" | "ALPHA" | "BOTH";

export type StaffDesignation =
  | PwsAdminDesignation
  | "PWS_OFFICE_STAFF"
  | "PWS_ACCOUNTS"
  | "HOD"
  | "TEACHER"
  | "WARDEN"
  | "COACH"
  | "ALPHA_ACCOUNTS"
  | "ALPHA_OFFICE_STAFF";

export const PWS_DESIGNATIONS: StaffDesignation[] = [
  "PRINCIPAL", "VICE_PRINCIPAL", "ACADEMIC_HEAD", "EVENT_COORDINATOR",
  "PWS_OFFICE_STAFF", "PWS_ACCOUNTS", "HOD", "TEACHER",
];
export const ALPHA_DESIGNATIONS: StaffDesignation[] = [
  "WARDEN", "COACH", "ALPHA_ACCOUNTS", "ALPHA_OFFICE_STAFF",
];

export const DESIGNATION_LABELS: Record<StaffDesignation, string> = {
  PRINCIPAL: "Principal",
  VICE_PRINCIPAL: "Vice Principal",
  ACADEMIC_HEAD: "Academic Head",
  EVENT_COORDINATOR: "Event Co-ordinator",
  PWS_OFFICE_STAFF: "PWS Office Staff",
  PWS_ACCOUNTS: "PWS Accounts",
  HOD: "HOD",
  TEACHER: "Teacher",
  WARDEN: "Warden",
  COACH: "Coaches",
  ALPHA_ACCOUNTS: "ALPHA Accounts",
  ALPHA_OFFICE_STAFF: "ALPHA Office Staff",
};

export type LoginTierCatalogItem = {
  code: LoginTierKind;
  tier: LoginTier;
  displayName: string;
  manageDescription: string;
  icon: string;
  tint: string;
};

export const LOGIN_TIER_CATALOG: LoginTierCatalogItem[] = [
  {
    code: "super_admin",
    tier: "super_admin",
    displayName: "Super Admin",
    manageDescription: "Platform owner — all modules across PWS and ALPHA",
    icon: "shield",
    tint: "#0F172A",
  },
  {
    code: "login_admin",
    tier: "admin",
    displayName: "Admin",
    manageDescription: "Assign entity, designation, and module access",
    icon: "briefcase",
    tint: "#1B3B6F",
  },
  {
    code: "login_staff",
    tier: "staff",
    displayName: "Staff",
    manageDescription: "Assign entity, designation, and module access",
    icon: "users",
    tint: "#00A8E8",
  },
];

export function isLoginTierKind(kind: string): kind is LoginTierKind {
  return kind === "super_admin" || kind === "login_admin" || kind === "login_staff";
}

export function designationsForEntity(entity: EntityScope): StaffDesignation[] {
  if (entity === "PWS") return [...PWS_DESIGNATIONS];
  if (entity === "ALPHA") return [...ALPHA_DESIGNATIONS];
  return [...PWS_DESIGNATIONS, ...ALPHA_DESIGNATIONS];
}
