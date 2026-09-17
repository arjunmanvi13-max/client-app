/** Directory categories, Admin designations, and reusable permission sets. */
import { UserRole } from "./rbac";

export const DIRECTORY_CATEGORIES = ["admins", "teachers", "students", "players"] as const;
export type DirectoryCategory = (typeof DIRECTORY_CATEGORIES)[number];

export const ADMIN_DESIGNATIONS = [
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "ACADEMIC_HEAD",
  "EVENT_COORDINATOR",
  "OPERATIONS_ADMIN",
  "ACCOUNTS",
  "COACH",
  "WARDEN",
] as const;
export type AdminDesignation = (typeof ADMIN_DESIGNATIONS)[number];

export const ADMIN_DESIGNATION_LABELS: Record<AdminDesignation, string> = {
  PRINCIPAL: "Principal",
  VICE_PRINCIPAL: "Vice Principal",
  ACADEMIC_HEAD: "Academic Head",
  EVENT_COORDINATOR: "Event Co-ordinator",
  OPERATIONS_ADMIN: "Operations Admin",
  ACCOUNTS: "Accounts",
  COACH: "Coach",
  WARDEN: "Warden",
};

export const DESIGNATION_ALIASES: Record<string, AdminDesignation> = {
  PWS_OFFICE_STAFF: "OPERATIONS_ADMIN",
  ALPHA_OFFICE_STAFF: "OPERATIONS_ADMIN",
  PWS_ACCOUNTS: "ACCOUNTS",
  ALPHA_ACCOUNTS: "ACCOUNTS",
};

export const PERMISSION_SET_CODES = [
  "super_admin",
  "principal",
  "vice_principal",
  "academic_head",
  "event_coordinator",
  "operations_admin",
  "accounts",
  "coach",
  "warden",
  "teacher",
  "student",
  "player",
] as const;
export type PermissionSetCode = (typeof PERMISSION_SET_CODES)[number];

export type PermissionSetMeta = {
  code: PermissionSetCode;
  name: string;
  description: string;
  scope: "PWS" | "ALPHA" | "BOTH";
  categories: DirectoryCategory[];
  designations: string[];
  locked: boolean;
  icon: string;
  tint: string;
};

export const PERMISSION_SET_CATALOG: PermissionSetMeta[] = [
  { code: "super_admin", name: "Super Admin", description: "Full access across PWS and ALPHA", scope: "BOTH", categories: ["admins"], designations: [], locked: true, icon: "shield", tint: "#0F172A" },
  { code: "principal", name: "Principal", description: "School leadership across PWS and ALPHA", scope: "BOTH", categories: ["admins"], designations: ["PRINCIPAL"], locked: false, icon: "briefcase", tint: "#1B3B6F" },
  { code: "vice_principal", name: "Vice Principal", description: "PWS school leadership", scope: "PWS", categories: ["admins"], designations: ["VICE_PRINCIPAL"], locked: false, icon: "briefcase", tint: "#2563EB" },
  { code: "academic_head", name: "Academic Head", description: "PWS academics leadership", scope: "PWS", categories: ["admins"], designations: ["ACADEMIC_HEAD"], locked: false, icon: "book", tint: "#0F766E" },
  { code: "event_coordinator", name: "Event Co-ordinator", description: "PWS events and operations", scope: "PWS", categories: ["admins"], designations: ["EVENT_COORDINATOR"], locked: false, icon: "calendar", tint: "#7C3AED" },
  { code: "operations_admin", name: "Operations Admin", description: "Day-to-day PWS or ALPHA operations", scope: "BOTH", categories: ["admins"], designations: ["OPERATIONS_ADMIN"], locked: false, icon: "settings", tint: "#0369A1" },
  { code: "accounts", name: "Accounts", description: "Fees, invoices, and finance", scope: "BOTH", categories: ["admins"], designations: ["ACCOUNTS"], locked: false, icon: "dollar-sign", tint: "#0891B2" },
  { code: "coach", name: "Coach", description: "ALPHA coaching and player attendance", scope: "ALPHA", categories: ["admins"], designations: ["COACH"], locked: false, icon: "award", tint: "#EA580C" },
  { code: "warden", name: "Warden", description: "ALPHA hostel operations", scope: "ALPHA", categories: ["admins"], designations: ["WARDEN"], locked: false, icon: "home", tint: "#7C3AED" },
  { code: "teacher", name: "Teacher", description: "PWS classroom teaching", scope: "PWS", categories: ["teachers"], designations: ["TEACHER", "HOD"], locked: false, icon: "book-open", tint: "#1E40AF" },
  { code: "student", name: "Student", description: "Restricted student self-service", scope: "PWS", categories: ["students"], designations: [], locked: false, icon: "user", tint: "#2563EB" },
  { code: "player", name: "Player", description: "Restricted player self-service", scope: "ALPHA", categories: ["players"], designations: [], locked: false, icon: "user", tint: "#16A34A" },
];

export const PERMISSION_SET_BY_CODE = Object.fromEntries(
  PERMISSION_SET_CATALOG.map((item) => [item.code, item]),
) as Record<PermissionSetCode, PermissionSetMeta>;

export function canonicalizeDesignation(raw?: string | null): string {
  const key = (raw || "").trim().toUpperCase();
  return DESIGNATION_ALIASES[key] || key;
}

export function permissionSetForDesignation(designation?: string | null): PermissionSetCode | "" {
  const canon = canonicalizeDesignation(designation);
  const match = PERMISSION_SET_CATALOG.find((s) => s.designations.includes(canon));
  return (match?.code || "") as PermissionSetCode | "";
}

export function adminDesignationsForScope(scope: string): AdminDesignation[] {
  const s = (scope || "BOTH").toUpperCase();
  const pws: AdminDesignation[] = ["PRINCIPAL", "VICE_PRINCIPAL", "ACADEMIC_HEAD", "EVENT_COORDINATOR", "OPERATIONS_ADMIN", "ACCOUNTS"];
  const alpha: AdminDesignation[] = ["OPERATIONS_ADMIN", "ACCOUNTS", "COACH", "WARDEN"];
  if (s === "PWS") return pws;
  if (s === "ALPHA") return alpha;
  return [...ADMIN_DESIGNATIONS];
}

export const DIRECTORY_CATEGORY_META: Record<DirectoryCategory, { label: string; href: string; icon: string; tint: string; subtitle: string }> = {
  admins: { label: "Admins", href: "/manage/admin", icon: "briefcase", tint: "#1B3B6F", subtitle: "Leadership, accounts, coaches, and wardens" },
  teachers: { label: "Teachers", href: "/manage/teacher", icon: "book-open", tint: "#1E40AF", subtitle: "PWS teaching staff" },
  students: { label: "Students", href: "/manage/student", icon: "user", tint: "#2563EB", subtitle: "PWS student roster" },
  players: { label: "Players", href: "/manage/player", icon: "award", tint: "#16A34A", subtitle: "ALPHA sports roster" },
};

export const ADMIN_LIST_REDIRECT_KINDS = [
  "staff",
  "coach",
  "login_admin",
  "login_staff",
  "super_admin",
  "pws_admin",
  "alpha_admin",
  "pws_accounts",
  "alpha_accounts",
  "alpha_coach",
] as const;

export function isAdminDirectoryKind(kind: string): boolean {
  return kind === "admin" || (ADMIN_LIST_REDIRECT_KINDS as readonly string[]).includes(kind);
}

export function userTypeForAdmin(designation: string | null | undefined, organization: string | null | undefined): string {
  const canon = canonicalizeDesignation(designation);
  const org = (organization || "PWS").toUpperCase();
  if (["PRINCIPAL", "VICE_PRINCIPAL", "ACADEMIC_HEAD", "EVENT_COORDINATOR"].includes(canon)) return UserRole.PWS_ADMIN;
  if (canon === "OPERATIONS_ADMIN") return org === "ALPHA" ? UserRole.ALPHA_ADMIN : UserRole.PWS_ADMIN;
  if (canon === "ACCOUNTS") return org === "ALPHA" ? UserRole.ALPHA_ACCOUNTS : UserRole.PWS_ACCOUNTS;
  if (canon === "COACH") return UserRole.ALPHA_COACH;
  if (canon === "WARDEN") return UserRole.ALPHA_ADMIN;
  if (canon === "TEACHER" || canon === "HOD") return UserRole.PWS_TEACHER;
  return UserRole.PWS_ADMIN;
}
