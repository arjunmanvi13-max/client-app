/**
 * Navigation config integrity checks.
 * Run: npm run test:nav
 */
import {
  NAVIGATION_GROUPS,
  filterNavigationGroups,
  flattenLeafItems,
  initialExpandedState,
  verifyNavigationIntegrity,
} from "./navigationConfig";
import type { User } from "./auth";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function mockUser(overrides: Partial<User> & Pick<User, "role" | "organization">): User {
  return {
    id: "test",
    email: "test@prarambhika.com",
    name: "Test User",
    permissions: {},
    ...overrides,
  } as User;
}

function allLeafIds(groups: ReturnType<typeof filterNavigationGroups>) {
  return flattenLeafItems(groups).map((i) => i.id);
}

function run() {
  const errors = verifyNavigationIntegrity();
  assert(errors.length === 0, `Integrity errors: ${errors.join("; ")}`);

  assert(NAVIGATION_GROUPS.length === 6, "Expected six navigation groups");
  assert(
    NAVIGATION_GROUPS.map((g) => g.id).join(",") === "management,directory,financials,operations,academics,system",
    "Groups must appear in specified order",
  );

  const superAdmin = mockUser({ role: "super_admin", organization: "BOTH" });
  const superGroups = filterNavigationGroups({ user: superAdmin });
  assert(superGroups.length === 6, "Super Admin should see all six groups");

  const systemGroup = superGroups.find((g) => g.id === "system");
  const accessControl = systemGroup?.children.find((c) => c.id === "access-control");
  assert(!!accessControl, "System group includes Access Control submenu");
  assert(accessControl?.children?.some((c) => c.id === "permissions"), "Access Control includes Permissions");
  assert(accessControl?.children?.some((c) => c.id === "manage-users"), "Access Control includes Manage Users & Rosters");

  const hrefs = flattenLeafItems(superGroups).map((i) => i.href).filter(Boolean) as string[];
  assert(new Set(hrefs).size === hrefs.length, "No duplicate hrefs in Super Admin nav tree");

  const marksPaths = flattenLeafItems(superGroups).filter((i) => i.label === "Marks Entry");
  assert(marksPaths.length === 1, "Marks Entry appears exactly once");

  const reportPaths = flattenLeafItems(superGroups).filter((i) => i.label === "Report Cards");
  assert(reportPaths.length === 1, "Report Cards appears exactly once");

  const directoryGroup = NAVIGATION_GROUPS.find((g) => g.id === "directory");
  assert(!!directoryGroup, "Directory group exists");
  assert(
    directoryGroup?.children.map((c) => c.id).join(",") === "directory-master,staff,coaches,teachers,students,players",
    "Directory items are flat without nested wrappers",
  );
  assert(!directoryGroup?.children.some((c) => c.children?.length), "Directory has no nested dropdown items");

  const attendanceParent = NAVIGATION_GROUPS.find((g) => g.id === "operations")?.children.find((c) => c.id === "attendance");
  assert(attendanceParent?.children?.some((c) => c.id === "attendance-take"), "Attendance expands to Take Attendance");
  assert(attendanceParent?.children?.some((c) => c.id === "attendance-reports"), "Attendance expands to Attendance Reports");

  const assessmentsParent = NAVIGATION_GROUPS.find((g) => g.id === "academics")?.children.find((c) => c.id === "assessments");
  assert(assessmentsParent?.children?.some((c) => c.id === "player-assessments"), "Assessments includes Player Assessments");
  assert(assessmentsParent?.children?.some((c) => c.id === "coach-assessments"), "Assessments includes Coach Assessments");

  const pwsAccounts = mockUser({ role: "pws_accounts", organization: "PWS" });
  const pwsLeaves = flattenLeafItems(filterNavigationGroups({ user: pwsAccounts }));
  assert(pwsLeaves.some((i) => i.id === "collect-fees"), "PWS Accounts sees Collect Fees");
  assert(pwsLeaves.some((i) => i.id === "invoice-engine"), "PWS Accounts sees PWS Invoice Engine");
  assert(!pwsLeaves.some((i) => i.id === "players"), "PWS Accounts should not see ALPHA Players roster");

  const alphaAccounts = mockUser({ role: "alpha_accounts", organization: "ALPHA" });
  const alphaLeaves = flattenLeafItems(filterNavigationGroups({ user: alphaAccounts }));
  assert(alphaLeaves.some((i) => i.id === "collect-fees"), "ALPHA Accounts sees Collect Fees");
  assert(!alphaLeaves.some((i) => i.id === "invoice-engine"), "ALPHA Accounts should not see PWS Invoice Engine");

  const teacher = mockUser({ role: "teacher", organization: "PWS" });
  const teacherLeaves = flattenLeafItems(filterNavigationGroups({ user: teacher }));
  assert(!teacherLeaves.some((i) => i.href?.startsWith("/fees")), "PWS Teacher should not see Financials");
  assert(!teacherLeaves.some((i) => i.id === "players"), "PWS Teacher should not see ALPHA Players");
  assert(teacherLeaves.some((i) => i.id === "marks-entry"), "PWS Teacher should see Marks Entry");

  const coach = mockUser({ role: "coach", organization: "ALPHA" });
  const coachGroups = filterNavigationGroups({ user: coach });
  assert(!coachGroups.find((g) => g.id === "financials"), "Coach should not see Financials");
  assert(!coachGroups.find((g) => g.id === "system"), "Coach should not see System & Settings");
  const coachLeaves = flattenLeafItems(coachGroups);
  assert(coachLeaves.some((i) => i.id === "attendance-take"), "Coach should see Take Attendance");
  assert(coachLeaves.some((i) => i.id === "player-assessments"), "Coach should see Player Assessments");
  assert(!coachLeaves.some((i) => i.id === "coach-assessments"), "Coach should not see Coach Assessments admin");
  assert(!coachLeaves.some((i) => i.id === "directory-master"), "Coach should not see master Directory");

  const active = initialExpandedState(superGroups, "/coach/assessments/abc");
  assert(active.groups.academics === true, "Academics group expands for assessment detail");
  assert(active.items.assessments === true, "Assessments parent expands for active child");

  const accessActive = initialExpandedState(superGroups, "/manage/pws_admin");
  assert(accessActive.items["access-control"] === true, "Access Control expands for manage user list");
  assert(accessActive.groups.system === true, "System group expands for manage user list");

  const pwsTeacherActive = initialExpandedState(superGroups, "/manage/pws_teacher/new");
  assert(pwsTeacherActive.groups.system === true, "System group expands for new PWS teacher");
  assert(pwsTeacherActive.items["access-control"] === true, "Access Control expands for new PWS teacher");
  const directoryTeachers = NAVIGATION_GROUPS.find((g) => g.id === "directory")?.children.find((c) => c.id === "teachers");
  assert(!!directoryTeachers?.match("/manage/teacher"), "Directory Teachers matches legacy teacher roster");
  assert(!directoryTeachers?.match("/manage/pws_teacher/new"), "PWS teacher login routes are not under Directory Teachers");

  const permActive = initialExpandedState(superGroups, "/admin/permissions");
  assert(permActive.items["access-control"] === true, "Access Control expands for permissions page");

  const academicActive = initialExpandedState(superGroups, "/admin/academic");
  assert(academicActive.groups.system === true, "System group expands for academic structure");
  assert(academicActive.items["academic-structure"] !== false, "Academic Structure is under System & Settings");

  const academicLeaves = allLeafIds(superGroups);
  assert(academicLeaves.includes("academic-structure"), "Super Admin sees Academic Structure under System & Settings");
  const academicsGroup = superGroups.find((g) => g.id === "academics");
  assert(!academicsGroup?.children.some((c) => c.id === "academic-structure"), "Academic Structure removed from Academics group");

  const playersItem = NAVIGATION_GROUPS.flatMap((g) => g.children)
    .flatMap(function walk(i): typeof NAVIGATION_GROUPS[0]["children"] {
      return i.children ? [i, ...i.children.flatMap(walk)] : [i];
    })
    .find((i) => i.id === "players");
  assert(!!playersItem?.match("/manage/player/abc-123"), "Player detail activates Players nav");

  const feeCollectionItem = NAVIGATION_GROUPS.flatMap((g) => g.children)
    .flatMap(function walk(i): typeof NAVIGATION_GROUPS[0]["children"] {
      return i.children ? [i, ...i.children.flatMap(walk)] : [i];
    })
    .find((i) => i.id === "collect-fees");
  assert(!!feeCollectionItem?.match("/fees/pws-student/1"), "Fee student drawer activates Collect Fees");

  const attReports = attendanceParent?.children?.find((c) => c.id === "attendance-reports");
  assert(!!attReports?.match("/admin/attendance/summary"), "Attendance report detail activates Attendance Reports");

  const reportCardItem = NAVIGATION_GROUPS.find((g) => g.id === "academics")?.children.find((c) => c.id === "report-cards");
  assert(!!reportCardItem?.match("/report-cards/xyz"), "Report card detail activates Report Cards");

  const pwsAdmin = mockUser({ role: "pws_admin", organization: "PWS" });
  const pwsAdminLeaves = allLeafIds(filterNavigationGroups({ user: pwsAdmin }));
  assert(!pwsAdminLeaves.includes("players"), "PWS Admin should not see Players without ALPHA scope");
  assert(!pwsAdminLeaves.includes("permissions"), "PWS Admin should not see Permissions nav item");

  const principal = mockUser({ role: "principal", organization: "PWS", permissions_rbac: { MANAGE_USERS_ROSTERS: true } as any });
  const principalLeaves = allLeafIds(filterNavigationGroups({ user: principal }));
  assert(!principalLeaves.includes("permissions"), "Principal should not see Permissions nav item");
  assert(principalLeaves.includes("manage-users"), "Principal with manage-users should still see Manage Users & Rosters");

  const alphaAdmin = mockUser({ role: "alpha_admin", organization: "ALPHA" });
  const alphaAdminLeaves = allLeafIds(filterNavigationGroups({ user: alphaAdmin }));
  assert(!alphaAdminLeaves.includes("students"), "ALPHA Admin should not see Students");
  assert(!alphaAdminLeaves.includes("marks-entry"), "ALPHA Admin should not see PWS Marks Entry");

  // Empty groups hidden
  const staffUser = mockUser({ role: "staff", organization: "PWS" });
  const staffGroups = filterNavigationGroups({ user: staffUser });
  staffGroups.forEach((g) => assert(g.children.length > 0, `Group ${g.id} must not be empty when visible`));

  console.log("navigationConfig.verify.ts: all checks passed");
}

run();
