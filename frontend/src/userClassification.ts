/**
 * Canonical login user types — mirrors backend user_classification.py.
 * Settings > Manage shows ONLY these seven categories.
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

export type PwsAdminDesignation = "PRINCIPAL" | "VICE_PRINCIPAL";

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
    description: "PWS administration — Principal and Vice Principal",
    manageDescription: "PWS administration — Principal and Vice Principal",
    allowedDesignations: ["PRINCIPAL", "VICE_PRINCIPAL"],
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
    manageDescription: "PWS student attendance and marks",
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

export function entityScopeLabel(scope: string): string {
  if (scope === "BOTH") return "Both PWS & ALPHA";
  return scope;
}

export function designationLabel(d?: string | null): string {
  if (!d) return "";
  return d.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
