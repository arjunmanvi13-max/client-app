/** Module access levels and designation presets — mirrors backend designation_access.py. */

export type ModuleAccessLevel = "none" | "view" | "edit" | "admin";

export const ACCESS_LEVELS: Array<{ code: ModuleAccessLevel; label: string }> = [
  { code: "none", label: "No Access" },
  { code: "view", label: "View Only" },
  { code: "edit", label: "Edit / Manage" },
  { code: "admin", label: "Full Admin" },
];

export type ModuleDef = {
  id: string;
  label: string;
  view: string[];
  edit: string[];
  admin: string[];
};

export const MODULE_MATRIX: ModuleDef[] = [
  { id: "directory", label: "Directory", view: ["view_students", "view_players", "view_staff"], edit: ["add_students", "edit_students", "add_players", "edit_players"], admin: ["toggle_player_status", "manage_users_rosters"] },
  { id: "fees", label: "Fees & Collections", view: ["view_fees"], edit: ["collect_fees"], admin: ["edit_fees", "manage_fee_catalog"] },
  { id: "attendance", label: "Attendance", view: ["view_attendance"], edit: ["mark_student_attendance", "mark_player_attendance", "mark_staff_attendance", "mark_coach_attendance", "mark_teacher_attendance"], admin: ["correct_attendance", "mark_hostel_attendance"] },
  { id: "schedules", label: "Schedules", view: ["timetable_view_own"], edit: ["timetable_view_all", "timetable_create", "timetable_edit", "timetable_substitute"], admin: ["timetable_delete", "timetable_publish", "timetable_export"] },
  { id: "tasks", label: "Task Trackers", view: ["dashboard_access"], edit: ["supervise_tasks"], admin: ["supervise_tasks"] },
  { id: "reports", label: "Reports", view: ["access_reports"], edit: ["access_reports"], admin: ["access_reports", "lifecycle_dashboard"] },
  { id: "approvals", label: "Approvals", view: ["dashboard_access"], edit: ["approve_requests"], admin: ["approve_requests", "approve_deactivation"] },
  { id: "expenses", label: "Expenses", view: ["capture_pws_expenses", "capture_alpha_expenses"], edit: ["capture_pws_expenses", "capture_alpha_expenses"], admin: ["manage_expense_structure"] },
  { id: "academics", label: "Academics", view: ["view_academic_marks"], edit: ["enter_academic_marks"], admin: ["manage_academic_structure"] },
];

export const DESIGNATION_PRESETS: Record<string, Record<string, ModuleAccessLevel>> = {
  PRINCIPAL: { directory: "admin", fees: "edit", attendance: "admin", schedules: "admin", tasks: "admin", reports: "admin", approvals: "admin", expenses: "edit", academics: "admin" },
  VICE_PRINCIPAL: { directory: "edit", fees: "view", attendance: "admin", schedules: "admin", tasks: "admin", reports: "admin", approvals: "edit", expenses: "view", academics: "admin" },
  ACADEMIC_HEAD: { directory: "edit", fees: "none", attendance: "edit", schedules: "admin", tasks: "edit", reports: "view", approvals: "none", expenses: "none", academics: "admin" },
  EVENT_COORDINATOR: { directory: "view", fees: "none", attendance: "view", schedules: "edit", tasks: "edit", reports: "view", approvals: "none", expenses: "edit", academics: "view" },
  PWS_OFFICE_STAFF: { directory: "view", fees: "view", attendance: "view", schedules: "view", tasks: "edit", reports: "view", approvals: "none", expenses: "none", academics: "view" },
  PWS_ACCOUNTS: { directory: "view", fees: "admin", attendance: "none", schedules: "none", tasks: "edit", reports: "admin", approvals: "edit", expenses: "admin", academics: "none" },
  HOD: { directory: "view", fees: "none", attendance: "edit", schedules: "edit", tasks: "edit", reports: "view", approvals: "none", expenses: "none", academics: "edit" },
  TEACHER: { directory: "view", fees: "none", attendance: "edit", schedules: "view", tasks: "view", reports: "none", approvals: "none", expenses: "none", academics: "edit" },
  WARDEN: { directory: "view", fees: "none", attendance: "admin", schedules: "view", tasks: "edit", reports: "view", approvals: "edit", expenses: "view", academics: "none" },
  COACH: { directory: "view", fees: "none", attendance: "edit", schedules: "view", tasks: "view", reports: "none", approvals: "none", expenses: "none", academics: "none" },
  ALPHA_ACCOUNTS: { directory: "view", fees: "admin", attendance: "none", schedules: "none", tasks: "edit", reports: "admin", approvals: "edit", expenses: "admin", academics: "none" },
  ALPHA_OFFICE_STAFF: { directory: "view", fees: "view", attendance: "view", schedules: "view", tasks: "edit", reports: "view", approvals: "none", expenses: "none", academics: "none" },
};

export function emptyModuleAccess(): Record<string, ModuleAccessLevel> {
  return Object.fromEntries(MODULE_MATRIX.map((m) => [m.id, "none"])) as Record<string, ModuleAccessLevel>;
}

export function presetForDesignation(designation?: string | null): Record<string, ModuleAccessLevel> {
  const key = (designation || "").toUpperCase();
  return { ...emptyModuleAccess(), ...(DESIGNATION_PRESETS[key] || {}) };
}

export function permissionsFromModuleAccess(access: Record<string, ModuleAccessLevel>): Record<string, boolean> {
  const perms: Record<string, boolean> = { dashboard_access: true };
  for (const mod of MODULE_MATRIX) {
    const level = access[mod.id] || "none";
    const keys = [
      ...(level === "none" ? [] : mod.view),
      ...((level === "edit" || level === "admin") ? mod.edit : []),
      ...(level === "admin" ? mod.admin : []),
    ];
    for (const key of keys) perms[key] = true;
  }
  return perms;
}
