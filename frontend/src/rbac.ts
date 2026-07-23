/**
 * Canonical RBAC types — mirrors backend `rbac/` module.
 * Use with auth User object for permission checks in the frontend.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum BusinessEntity {
  PWS = "PWS",
  ALPHA = "ALPHA",
  BOTH = "BOTH",
}

export enum UserRole {
  SUPER_ADMIN = "super_admin",
  PWS_ADMIN = "pws_admin",
  ALPHA_ADMIN = "alpha_admin",
  PWS_ACCOUNTS = "pws_accounts",
  ALPHA_ACCOUNTS = "alpha_accounts",
  PWS_TEACHER = "pws_teacher",
  ALPHA_COACH = "alpha_coach",
  WARDEN = "warden",
  STAFF = "staff",
  STUDENT = "student",
  PLAYER = "player",
  PARENT = "parent",
}

export enum Permission {
  // Super Admin
  CREATE_USERS = "CREATE_USERS",
  MANAGE_FEES_HEADS = "MANAGE_FEES_HEADS",
  MANAGE_ACCESS = "MANAGE_ACCESS",
  BULK_UPLOAD_USERS = "BULK_UPLOAD_USERS",
  TOGGLE_USER_STATUS = "TOGGLE_USER_STATUS",
  ADD_COACHES = "ADD_COACHES",
  ADD_NEW_TEACHER = "ADD_NEW_TEACHER",
  MANAGE_USERS_ROSTERS = "MANAGE_USERS_ROSTERS",

  // PWS Admin
  MARK_PWS_ATTENDANCE = "MARK_PWS_ATTENDANCE",
  MANAGE_TEACHERS_MAP_SUBJECTS = "MANAGE_TEACHERS_MAP_SUBJECTS",
  CREATE_TEACHER_TASKS = "CREATE_TEACHER_TASKS",
  MANAGE_TEACHERS_MAP_SECTIONS = "MANAGE_TEACHERS_MAP_SECTIONS",

  // ALPHA Admin
  MARK_ALPHA_ATTENDANCE = "MARK_ALPHA_ATTENDANCE",
  MANAGE_COACHES = "MANAGE_COACHES",
  CREATE_COACH_TASKS = "CREATE_COACH_TASKS",
  MANAGE_PLAYERS = "MANAGE_PLAYERS",

  // PWS Accounts
  COLLECT_PWS_FEES = "COLLECT_PWS_FEES",
  MANAGE_PWS_TASKS = "MANAGE_PWS_TASKS",
  ADD_PWS_STUDENTS = "ADD_PWS_STUDENTS",
  RUN_PWS_REPORTS = "RUN_PWS_REPORTS",

  // ALPHA Accounts
  COLLECT_ALPHA_FEES = "COLLECT_ALPHA_FEES",
  MANAGE_ALPHA_TASKS = "MANAGE_ALPHA_TASKS",
  ADD_ALPHA_PLAYERS = "ADD_ALPHA_PLAYERS",
  RUN_ALPHA_REPORTS = "RUN_ALPHA_REPORTS",

  // PWS Teachers
  MARK_STUDENT_ATTENDANCE = "MARK_STUDENT_ATTENDANCE",
  MARK_TEACHER_ATTENDANCE = "MARK_TEACHER_ATTENDANCE",
  MANAGE_MARKS_ASSESSMENT = "MANAGE_MARKS_ASSESSMENT",
  MANAGE_TEACHER_TASKS = "MANAGE_TEACHER_TASKS",

  // ALPHA Coaches
  MARK_PLAYER_ATTENDANCE = "MARK_PLAYER_ATTENDANCE",
  MANAGE_PLAYER_ASSESSMENT = "MANAGE_PLAYER_ASSESSMENT",
  MANAGE_COACH_TASKS = "MANAGE_COACH_TASKS",

  CORRECT_ATTENDANCE = "CORRECT_ATTENDANCE",
  MARK_HOSTEL_ATTENDANCE = "MARK_HOSTEL_ATTENDANCE",
  MANAGE_COACH_ASSESSMENTS_ADMIN = "MANAGE_COACH_ASSESSMENTS_ADMIN",
  APPROVE_REQUESTS = "APPROVE_REQUESTS",
  VIEW_ATTENDANCE = "VIEW_ATTENDANCE",

  DASHBOARD_ACCESS = "DASHBOARD_ACCESS",
}

// ---------------------------------------------------------------------------
// Legacy role normalization
// ---------------------------------------------------------------------------

export const LEGACY_ROLE_ALIASES: Record<string, UserRole> = {
  super_admin: UserRole.SUPER_ADMIN,
  admin: UserRole.ALPHA_ADMIN,
  principal: UserRole.PWS_ADMIN,
  vice_principal: UserRole.PWS_ADMIN,
  teacher: UserRole.PWS_TEACHER,
  coach: UserRole.ALPHA_COACH,
  warden: UserRole.WARDEN,
  staff: UserRole.STAFF,
  student: UserRole.STUDENT,
  player: UserRole.PLAYER,
  parent: UserRole.PARENT,
  pws_admin: UserRole.PWS_ADMIN,
  alpha_admin: UserRole.ALPHA_ADMIN,
  pws_accounts: UserRole.PWS_ACCOUNTS,
  alpha_accounts: UserRole.ALPHA_ACCOUNTS,
  pws_teacher: UserRole.PWS_TEACHER,
  alpha_coach: UserRole.ALPHA_COACH,
};

export function normalizeRole(raw: string): UserRole {
  const key = (raw || "").trim().toLowerCase();
  return LEGACY_ROLE_ALIASES[key] ?? UserRole.STAFF;
}

/** True only for the Super Admin login account — not PWS/ALPHA Admin principals. */
export function isSuperAdminUser(user: RBACUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === UserRole.SUPER_ADMIN || user.role_canonical === UserRole.SUPER_ADMIN) return true;
  const userType = (user as RBACUser & { user_type?: string }).user_type;
  if (userType === UserRole.SUPER_ADMIN) return true;
  return false;
}

/** PWS Principal — excludes Vice Principal and other PWS Admin designations. */
export function isPrincipalUser(user: RBACUser | null | undefined): boolean {
  if (!user) return false;
  if (user.role === "principal") return true;
  if (user.designation === "PRINCIPAL") return true;
  return false;
}

export function canAddDirectoryTeacher(user: RBACUser | null | undefined): boolean {
  return isSuperAdminUser(user) || isPrincipalUser(user);
}

// ---------------------------------------------------------------------------
// Role → permission matrix
// ---------------------------------------------------------------------------

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    Permission.CREATE_USERS,
    Permission.MANAGE_FEES_HEADS,
    Permission.MANAGE_ACCESS,
    Permission.BULK_UPLOAD_USERS,
    Permission.TOGGLE_USER_STATUS,
    Permission.ADD_COACHES,
    Permission.ADD_NEW_TEACHER,
    Permission.MANAGE_USERS_ROSTERS,
    Permission.DASHBOARD_ACCESS,
  ],
  [UserRole.PWS_ADMIN]: [
    Permission.MARK_PWS_ATTENDANCE,
    Permission.MANAGE_TEACHERS_MAP_SUBJECTS,
    Permission.CREATE_TEACHER_TASKS,
    Permission.MANAGE_TEACHERS_MAP_SECTIONS,
    Permission.DASHBOARD_ACCESS,
  ],
  [UserRole.ALPHA_ADMIN]: [
    Permission.MARK_ALPHA_ATTENDANCE,
    Permission.MANAGE_COACHES,
    Permission.CREATE_COACH_TASKS,
    Permission.MANAGE_PLAYERS,
    Permission.DASHBOARD_ACCESS,
  ],
  [UserRole.PWS_ACCOUNTS]: [
    Permission.COLLECT_PWS_FEES,
    Permission.MANAGE_PWS_TASKS,
    Permission.ADD_PWS_STUDENTS,
    Permission.RUN_PWS_REPORTS,
    Permission.DASHBOARD_ACCESS,
  ],
  [UserRole.ALPHA_ACCOUNTS]: [
    Permission.COLLECT_ALPHA_FEES,
    Permission.MANAGE_ALPHA_TASKS,
    Permission.ADD_ALPHA_PLAYERS,
    Permission.RUN_ALPHA_REPORTS,
    Permission.DASHBOARD_ACCESS,
  ],
  [UserRole.PWS_TEACHER]: [
    Permission.MARK_STUDENT_ATTENDANCE,
    Permission.MANAGE_MARKS_ASSESSMENT,
    Permission.MANAGE_TEACHER_TASKS,
    Permission.DASHBOARD_ACCESS,
  ],
  [UserRole.ALPHA_COACH]: [
    Permission.MARK_PLAYER_ATTENDANCE,
    Permission.MANAGE_PLAYER_ASSESSMENT,
    Permission.MANAGE_COACH_TASKS,
    Permission.DASHBOARD_ACCESS,
  ],
  [UserRole.WARDEN]: [Permission.DASHBOARD_ACCESS],
  [UserRole.STAFF]: [Permission.DASHBOARD_ACCESS],
  [UserRole.STUDENT]: [Permission.DASHBOARD_ACCESS],
  [UserRole.PLAYER]: [Permission.DASHBOARD_ACCESS],
  [UserRole.PARENT]: [Permission.DASHBOARD_ACCESS],
};

// ---------------------------------------------------------------------------
// User & mapping interfaces
// ---------------------------------------------------------------------------

export type ManageKind = "student" | "player" | "teacher" | "coach" | "staff";

export interface RBACUser {
  id: string;
  name: string;
  email?: string;
  role: string;
  role_canonical?: string;
  organization?: BusinessEntity | "PWS" | "ALPHA" | "BOTH";
  department?: string;
  is_active?: boolean;
  status?: "active" | "deactivated";
  permissions?: Record<string, boolean>;
  permissions_rbac?: Partial<Record<Permission, boolean>>;
  effective_permissions?: (Permission | string)[];
  can_manage?: ManageKind[];
  coach_permissions?: ("view_players" | "add_players" | "edit_players")[];
  assigned_centres?: ("Balua" | "Harding Park")[];
  assigned_sports?: ("Cricket" | "Football")[];
  coach_type?: "head" | "assistant";
}

export interface TeacherSubjectAssignment {
  id: string;
  teacher_user_id: string;
  academic_year_id: string;
  grade_id: string;
  section_id: string;
  subject_id: string;
}

export interface TeacherSectionAssignment {
  id: string;
  teacher_user_id: string;
  academic_year_id: string;
  section_id: string;
}

export interface CoachSportAssignment {
  id: string;
  coach_user_id: string;
  sport: "Cricket" | "Football";
  centre: "Balua" | "Harding Park";
  coach_type?: "head" | "assistant";
  is_active?: boolean;
}

export interface StudentEnrollment {
  id: string;
  student_person_id: string;
  academic_year_id: string;
  grade_id: string;
  section_id: string;
  is_active?: boolean;
}

export interface PlayerEnrollment {
  id: string;
  player_person_id: string;
  centre: "Balua" | "Harding Park";
  sport: "Cricket" | "Football";
  player_type: "Daily" | "Day Boarding" | "Hostel" | "Hostel Only" | "Boarding";
  slot?: "Morning" | "Evening" | "Both";
  is_active?: boolean;
}

export interface PersonRecord {
  id: string;
  kind: "student" | "player" | "teacher" | "coach" | "staff";
  name: string;
  organization?: BusinessEntity;
  is_active?: boolean;
  status?: "active" | "deactivated";
  section_id?: string;
  group?: string;
  centre?: "Balua" | "Harding Park";
  sport?: "Cricket" | "Football";
  player_type?: string;
  date_of_admission?: string;
}

// ---------------------------------------------------------------------------
// Authorization
// ---------------------------------------------------------------------------

export function resolveUserEntity(user: RBACUser): BusinessEntity {
  const org = (user.organization || "PWS").toString().toUpperCase();
  if (org === "BOTH") return BusinessEntity.BOTH;
  if (org === "ALPHA") return BusinessEntity.ALPHA;
  return BusinessEntity.PWS;
}

function entityAllows(userEntity: BusinessEntity, required?: BusinessEntity): boolean {
  if (!required) return true;
  if (userEntity === BusinessEntity.BOTH) return true;
  return userEntity === required;
}

export function hasPermission(
  user: RBACUser | null | undefined,
  permission: Permission,
  entity?: BusinessEntity,
): boolean {
  if (!user) return false;
  if (user.status === "deactivated" || user.is_active === false) return false;

  if (user.effective_permissions?.includes(permission)) {
    if (!entity) return true;
    return entityAllows(resolveUserEntity(user), entity);
  }

  const role = normalizeRole(user.role);
  if (role === UserRole.SUPER_ADMIN) {
    return entityAllows(resolveUserEntity(user), entity);
  }
  if (entity && !entityAllows(resolveUserEntity(user), entity)) return false;

  const override = user.permissions_rbac?.[permission];
  if (override !== undefined) return override;

  if ((ROLE_PERMISSIONS[role] ?? []).includes(permission)) return true;

  // Legacy permission bridge
  const legacyBridge: Partial<Record<Permission, string[]>> = {
    [Permission.MANAGE_PLAYER_ASSESSMENT]: ["enter_coach_assessments", "view_coach_assessments"],
    [Permission.MANAGE_MARKS_ASSESSMENT]: ["enter_academic_marks", "view_academic_marks"],
    [Permission.MANAGE_TEACHERS_MAP_SUBJECTS]: ["manage_academic_structure"],
    [Permission.MANAGE_TEACHERS_MAP_SECTIONS]: ["manage_academic_structure"],
    [Permission.COLLECT_PWS_FEES]: ["collect_fees", "view_fees"],
    [Permission.COLLECT_ALPHA_FEES]: ["collect_fees", "view_fees"],
    [Permission.MANAGE_FEES_HEADS]: ["manage_fee_catalog", "edit_fees"],
    [Permission.BULK_UPLOAD_USERS]: ["bulk_upload"],
    [Permission.RUN_PWS_REPORTS]: ["access_reports"],
    [Permission.RUN_ALPHA_REPORTS]: ["access_reports"],
    [Permission.MARK_STUDENT_ATTENDANCE]: ["mark_student_attendance"],
    [Permission.MARK_TEACHER_ATTENDANCE]: ["mark_teacher_attendance"],
    [Permission.MARK_PLAYER_ATTENDANCE]: ["mark_player_attendance"],
    [Permission.MARK_PWS_ATTENDANCE]: ["mark_student_attendance", "mark_staff_attendance", "mark_teacher_attendance"],
    [Permission.MARK_ALPHA_ATTENDANCE]: ["mark_player_attendance", "mark_coach_attendance"],
    [Permission.MANAGE_PLAYERS]: ["add_players", "edit_players", "view_players"],
    [Permission.ADD_PWS_STUDENTS]: ["add_students", "edit_students"],
    [Permission.CREATE_TEACHER_TASKS]: ["supervise_tasks"],
    [Permission.CREATE_COACH_TASKS]: ["supervise_tasks"],
    [Permission.MANAGE_COACH_ASSESSMENTS_ADMIN]: ["manage_coach_assessments"],
    [Permission.APPROVE_REQUESTS]: ["approve_requests", "approve_deactivation"],
    [Permission.TOGGLE_USER_STATUS]: ["toggle_player_status", "approve_deactivation"],
    [Permission.CORRECT_ATTENDANCE]: ["correct_attendance"],
    [Permission.MARK_HOSTEL_ATTENDANCE]: ["mark_hostel_attendance"],
    [Permission.VIEW_ATTENDANCE]: ["view_attendance"],
    [Permission.DASHBOARD_ACCESS]: ["dashboard_access"],
    [Permission.ADD_NEW_TEACHER]: ["manage_users"],
    [Permission.MANAGE_USERS_ROSTERS]: ["manage_users_rosters", "manage_users"],
  };
  const keys = legacyBridge[permission] || [];
  if (keys.some((k) => user.permissions?.[k])) return true;

  return false;
}

export function listEffectivePermissions(user: RBACUser): Permission[] {
  return (Object.values(Permission) as Permission[]).filter((p) => hasPermission(user, p));
}

/** Human-readable labels for permission UI */
export const PERMISSION_LABELS: Record<Permission, string> = {
  [Permission.CREATE_USERS]: "Create users",
  [Permission.MANAGE_FEES_HEADS]: "Manage fee heads & defaults",
  [Permission.MANAGE_ACCESS]: "Manage module access",
  [Permission.BULK_UPLOAD_USERS]: "Bulk upload users",
  [Permission.TOGGLE_USER_STATUS]: "Activate / deactivate users",
  [Permission.ADD_COACHES]: "Add coaches",
  [Permission.ADD_NEW_TEACHER]: "Add new teacher",
  [Permission.MANAGE_USERS_ROSTERS]: "Manage users & rosters",
  [Permission.MARK_PWS_ATTENDANCE]: "Mark PWS attendance",
  [Permission.MANAGE_TEACHERS_MAP_SUBJECTS]: "Map teachers to subjects",
  [Permission.CREATE_TEACHER_TASKS]: "Create teacher tasks",
  [Permission.MANAGE_TEACHERS_MAP_SECTIONS]: "Map teachers to sections",
  [Permission.MARK_ALPHA_ATTENDANCE]: "Mark ALPHA attendance",
  [Permission.MANAGE_COACHES]: "Manage coaches",
  [Permission.CREATE_COACH_TASKS]: "Create coach tasks",
  [Permission.MANAGE_PLAYERS]: "Manage players",
  [Permission.COLLECT_PWS_FEES]: "Collect PWS fees",
  [Permission.MANAGE_PWS_TASKS]: "Manage PWS tasks",
  [Permission.ADD_PWS_STUDENTS]: "Add PWS students",
  [Permission.RUN_PWS_REPORTS]: "Run PWS reports",
  [Permission.COLLECT_ALPHA_FEES]: "Collect ALPHA fees",
  [Permission.MANAGE_ALPHA_TASKS]: "Manage ALPHA tasks",
  [Permission.ADD_ALPHA_PLAYERS]: "Add ALPHA players",
  [Permission.RUN_ALPHA_REPORTS]: "Run ALPHA reports",
  [Permission.MARK_STUDENT_ATTENDANCE]: "Mark student attendance",
  [Permission.MARK_TEACHER_ATTENDANCE]: "Mark teacher attendance",
  [Permission.MANAGE_MARKS_ASSESSMENT]: "Marks & assessment",
  [Permission.MANAGE_TEACHER_TASKS]: "Manage teacher tasks",
  [Permission.MARK_PLAYER_ATTENDANCE]: "Mark player attendance",
  [Permission.MANAGE_PLAYER_ASSESSMENT]: "Player assessments",
  [Permission.MANAGE_COACH_TASKS]: "Manage coach tasks",
  [Permission.DASHBOARD_ACCESS]: "Dashboard access",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.SUPER_ADMIN]: "Super Admin",
  [UserRole.PWS_ADMIN]: "PWS Admin (Principal / VP)",
  [UserRole.ALPHA_ADMIN]: "ALPHA Admin",
  [UserRole.PWS_ACCOUNTS]: "PWS Accounts",
  [UserRole.ALPHA_ACCOUNTS]: "ALPHA Accounts",
  [UserRole.PWS_TEACHER]: "PWS Teacher",
  [UserRole.ALPHA_COACH]: "ALPHA Coach",
  [UserRole.WARDEN]: "Warden",
  [UserRole.STAFF]: "Staff",
  [UserRole.STUDENT]: "Student",
  [UserRole.PLAYER]: "Player",
  [UserRole.PARENT]: "Parent",
};
