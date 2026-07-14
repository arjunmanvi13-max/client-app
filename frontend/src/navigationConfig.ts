/**
 * Central sidebar navigation configuration — single source of truth.
 * Filter with `filterNavigationGroups()`; never duplicate role checks in Sidebar.tsx.
 */
import type { User } from "./auth";
import { isCoachUser } from "./coachAccess";
import { BusinessEntity, Permission, hasPermission } from "./rbac";
import { APPROVED_LOGIN_USER_TYPES } from "./userClassification";

function matchManageLoginUsers(pathname: string): boolean {
  if (pathname === "/manage") return true;
  const seg = pathname.match(/^\/manage\/([^/?]+)/)?.[1];
  return !!seg && (APPROVED_LOGIN_USER_TYPES as string[]).includes(seg);
}

export type FeatherIcon = keyof typeof import("@expo/vector-icons").Feather.glyphMap;

export type NavigationContext = {
  user: User;
};

export type NavigationItem = {
  id: string;
  label: string;
  icon: FeatherIcon;
  href?: string;
  /** Returns true when pathname should highlight this item (and parent groups). */
  match: (pathname: string) => boolean;
  children?: NavigationItem[];
  permissions?: Permission[];
  permissionEntity?: BusinessEntity;
  excludeRoles?: string[];
  pwsOnly?: boolean;
  alphaOnly?: boolean;
  roles?: string[];
  isVisible?: (ctx: NavigationContext) => boolean;
};

export type NavigationGroup = {
  id: string;
  label: string;
  icon: FeatherIcon;
  children: NavigationItem[];
};

const matchPrefix = (prefixes: string[]) => (p: string) =>
  prefixes.some((prefix) => p === prefix || p.startsWith(`${prefix}/`) || p.startsWith(prefix));

export const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    id: "management",
    label: "Management & Insights",
    icon: "pie-chart",
    children: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: "home",
        href: "/(tabs)/dashboard",
        match: (p) => p.startsWith("/(tabs)/dashboard") || p === "/" || p === "/dashboard",
      },
      {
        id: "reports",
        label: "Reports",
        icon: "bar-chart-2",
        href: "/reports",
        match: matchPrefix(["/reports"]),
        permissions: [Permission.RUN_PWS_REPORTS, Permission.RUN_ALPHA_REPORTS],
      },
      {
        id: "approvals",
        label: "Approvals",
        icon: "clipboard",
        href: "/admin/approvals",
        match: matchPrefix(["/admin/approvals"]),
        permissions: [Permission.APPROVE_REQUESTS],
      },
      {
        id: "tasks",
        label: "Task Tracker",
        icon: "check-square",
        href: "/(tabs)/tasks",
        match: (p) => p.startsWith("/(tabs)/tasks") || p.startsWith("/task") || p === "/tasks",
      },
    ],
  },
  {
    id: "directory",
    label: "Directory",
    icon: "users",
    children: [
      {
        id: "directory-master",
        label: "Directory",
        icon: "book",
        href: "/directory",
        match: matchPrefix(["/directory"]),
        excludeRoles: ["teacher", "coach"],
        isVisible: (ctx) => !isCoachUser(ctx.user),
      },
      {
        id: "staff-coaches",
        label: "Staff & Coaches",
        icon: "briefcase",
        match: (p) => p.startsWith("/manage/staff") || p.startsWith("/manage/coach"),
        excludeRoles: ["teacher", "coach"],
        children: [
          {
            id: "staff",
            label: "Staff",
            icon: "briefcase",
            href: "/manage/staff",
            match: matchPrefix(["/manage/staff"]),
            excludeRoles: ["teacher", "coach"],
          },
          {
            id: "coaches",
            label: "Coaches",
            icon: "award",
            href: "/manage/coach",
            match: matchPrefix(["/manage/coach"]),
            permissions: [Permission.MANAGE_COACHES, Permission.CREATE_USERS],
            excludeRoles: ["teacher"],
          },
        ],
      },
      {
        id: "teachers",
        label: "Teachers",
        icon: "book-open",
        href: "/manage/teacher",
        match: matchPrefix(["/manage/teacher", "/manage/pws_teacher"]),
        permissions: [Permission.MANAGE_TEACHERS_MAP_SUBJECTS, Permission.CREATE_USERS],
        pwsOnly: true,
        excludeRoles: ["teacher"],
      },
      {
        id: "students-players",
        label: "Students & Players",
        icon: "users",
        match: (p) => p.startsWith("/manage/student") || p.startsWith("/manage/player"),
        excludeRoles: ["teacher"],
        children: [
          {
            id: "students",
            label: "Students",
            icon: "user",
            href: "/manage/student",
            match: matchPrefix(["/manage/student"]),
            permissions: [Permission.ADD_PWS_STUDENTS],
            pwsOnly: true,
            excludeRoles: ["teacher"],
          },
          {
            id: "players",
            label: "Players",
            icon: "user",
            href: "/manage/player",
            match: matchPrefix(["/manage/player"]),
            permissions: [Permission.MANAGE_PLAYERS, Permission.ADD_ALPHA_PLAYERS],
            excludeRoles: ["teacher"],
          },
        ],
      },
    ],
  },
  {
    id: "financials",
    label: "Financials",
    icon: "credit-card",
    children: [
      {
        id: "fee-catalog",
        label: "Fee Catalogue",
        icon: "layers",
        href: "/admin/fee-catalog",
        match: matchPrefix(["/admin/fee-catalog"]),
        permissions: [Permission.MANAGE_FEES_HEADS],
      },
      {
        id: "collect-fees",
        label: "Collect Fees",
        icon: "inbox",
        href: "/fees/collection",
        match: (p) => p.startsWith("/fees/collection") || p.startsWith("/fees/pws-student"),
        permissions: [Permission.COLLECT_PWS_FEES, Permission.COLLECT_ALPHA_FEES],
      },
      {
        id: "defaulters",
        label: "Defaulters",
        icon: "alert-triangle",
        href: "/fees?tab=past-due",
        match: (p) =>
          p === "/fees"
          || (p.startsWith("/fees") && (p.includes("past-due") || p.includes("overdue"))),
        permissions: [Permission.COLLECT_PWS_FEES, Permission.COLLECT_ALPHA_FEES],
      },
      {
        id: "invoice-engine",
        label: "Invoice Engine",
        icon: "file-text",
        href: "/admin/invoices",
        match: matchPrefix(["/admin/invoices"]),
        permissions: [Permission.COLLECT_PWS_FEES],
        pwsOnly: true,
      },
    ],
  },
  {
    id: "operations",
    label: "Operations & Logistics",
    icon: "activity",
    children: [
      {
        id: "attendance",
        label: "Attendance",
        icon: "calendar",
        match: (p) =>
          p.startsWith("/(tabs)/attendance")
          || p === "/attendance"
          || p.startsWith("/staff-attendance")
          || p.startsWith("/coach-attendance")
          || p.startsWith("/admin/attendance"),
        children: [
          {
            id: "attendance-take",
            label: "Take Attendance",
            icon: "user-check",
            href: "/(tabs)/attendance",
            match: (p) =>
              p.startsWith("/(tabs)/attendance")
              || p === "/attendance"
              || p.startsWith("/staff-attendance")
              || p.startsWith("/coach-attendance"),
          },
          {
            id: "attendance-reports",
            label: "Attendance Reports",
            icon: "bar-chart",
            href: "/admin/attendance",
            match: matchPrefix(["/admin/attendance"]),
            permissions: [Permission.VIEW_ATTENDANCE, Permission.RUN_PWS_REPORTS, Permission.RUN_ALPHA_REPORTS],
          },
        ],
      },
      {
        id: "hostel",
        label: "Hostel",
        icon: "moon",
        href: "/(tabs)/hostel",
        match: (p) => p.startsWith("/(tabs)/hostel") || p === "/hostel",
        permissions: [Permission.MARK_HOSTEL_ATTENDANCE],
      },
      {
        id: "bulk-upload",
        label: "Bulk Upload",
        icon: "upload-cloud",
        href: "/admin/bulk-upload",
        match: matchPrefix(["/admin/bulk-upload"]),
        permissions: [Permission.BULK_UPLOAD_USERS],
      },
    ],
  },
  {
    id: "academics",
    label: "Academics & Assessments",
    icon: "book",
    children: [
      {
        id: "academic-structure",
        label: "Academic Structure",
        icon: "book-open",
        href: "/admin/academic",
        match: matchPrefix(["/admin/academic"]),
        permissions: [Permission.MANAGE_TEACHERS_MAP_SUBJECTS, Permission.MANAGE_TEACHERS_MAP_SECTIONS],
        pwsOnly: true,
      },
      {
        id: "marks-entry",
        label: "Marks Entry",
        icon: "edit-3",
        href: "/academic/marks",
        match: (p) => p.startsWith("/academic/marks"),
        permissions: [Permission.MANAGE_MARKS_ASSESSMENT, Permission.MANAGE_TEACHERS_MAP_SUBJECTS],
        pwsOnly: true,
      },
      {
        id: "marks-setup",
        label: "Marks Setup",
        icon: "sliders",
        href: "/admin/marks",
        match: matchPrefix(["/admin/marks"]),
        permissions: [Permission.MANAGE_TEACHERS_MAP_SUBJECTS],
        pwsOnly: true,
      },
      {
        id: "assessments",
        label: "Assessments",
        icon: "clipboard",
        match: (p) => p.startsWith("/coach/assessments") || p.startsWith("/admin/coach-assessments"),
        children: [
          {
            id: "player-assessments",
            label: "Player Assessments",
            icon: "clipboard",
            href: "/coach/assessments",
            match: matchPrefix(["/coach/assessments"]),
            permissions: [Permission.MANAGE_PLAYER_ASSESSMENT, Permission.MANAGE_COACH_ASSESSMENTS_ADMIN],
          },
          {
            id: "coach-assessments",
            label: "Coach Assessments",
            icon: "clipboard",
            href: "/admin/coach-assessments",
            match: matchPrefix(["/admin/coach-assessments"]),
            permissions: [Permission.MANAGE_COACH_ASSESSMENTS_ADMIN],
          },
        ],
      },
      {
        id: "report-cards",
        label: "Report Cards",
        icon: "file-text",
        href: "/admin/report-cards",
        match: (p) => p.startsWith("/admin/report-cards") || p.startsWith("/report-cards"),
        permissions: [Permission.MANAGE_MARKS_ASSESSMENT, Permission.MANAGE_TEACHERS_MAP_SUBJECTS],
        pwsOnly: true,
      },
    ],
  },
  {
    id: "system",
    label: "System & Settings",
    icon: "settings",
    children: [
      {
        id: "access-control",
        label: "Access Control",
        icon: "shield",
        match: (p) => p.startsWith("/admin/permissions") || matchManageLoginUsers(p),
        permissions: [Permission.MANAGE_ACCESS],
        children: [
          {
            id: "permissions",
            label: "Permissions",
            icon: "key",
            href: "/admin/permissions",
            match: matchPrefix(["/admin/permissions"]),
            permissions: [Permission.MANAGE_ACCESS],
          },
          {
            id: "manage-users",
            label: "Manage Users & Rosters",
            icon: "users",
            href: "/manage",
            match: matchManageLoginUsers,
            permissions: [Permission.MANAGE_ACCESS],
          },
        ],
      },
      {
        id: "settings",
        label: "Settings",
        icon: "settings",
        href: "/(tabs)/profile",
        match: (p) => p === "/settings" || p.startsWith("/(tabs)/profile"),
        excludeRoles: ["coach"],
        isVisible: (ctx) => !isCoachUser(ctx.user),
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: "bell",
        href: "/notifications",
        match: matchPrefix(["/notifications"]),
        excludeRoles: ["coach"],
        isVisible: (ctx) => !isCoachUser(ctx.user),
      },
    ],
  },
];

export function isNavigationItemAllowed(item: NavigationItem, ctx: NavigationContext): boolean {
  const { user } = ctx;
  if (item.isVisible && !item.isVisible(ctx)) return false;
  if (item.excludeRoles?.includes(user.role)) return false;
  if (item.pwsOnly && user.organization === "ALPHA") return false;
  if (item.alphaOnly && user.organization === "PWS") return false;
  if (item.permissions?.length) {
    return item.permissions.some((p) => hasPermission(user, p, item.permissionEntity));
  }
  if (item.roles?.length && !item.roles.includes(user.role)) return false;
  return true;
}

export function filterNavigationItem(item: NavigationItem, ctx: NavigationContext): NavigationItem | null {
  const filteredChildren = (item.children || [])
    .map((child) => filterNavigationItem(child, ctx))
    .filter((c): c is NavigationItem => c !== null);

  const selfAllowed = isNavigationItemAllowed(item, ctx);
  if (!selfAllowed && filteredChildren.length === 0) return null;

  if (filteredChildren.length === 0) {
    if (!selfAllowed || !item.href) return null;
    return { ...item, children: undefined };
  }

  return { ...item, children: filteredChildren };
}

export function filterNavigationGroups(ctx: NavigationContext): NavigationGroup[] {
  return NAVIGATION_GROUPS.map((group) => {
    const children = group.children
      .map((item) => filterNavigationItem(item, ctx))
      .filter((c): c is NavigationItem => c !== null);
    if (children.length === 0) return null;
    return { ...group, children };
  }).filter((g): g is NavigationGroup => g !== null);
}

export function itemMatchesPath(item: NavigationItem, pathname: string): boolean {
  if (item.match(pathname)) return true;
  return (item.children || []).some((child) => itemMatchesPath(child, pathname));
}

export function groupMatchesPath(group: NavigationGroup, pathname: string): boolean {
  return group.children.some((item) => itemMatchesPath(item, pathname));
}

/** Collect leaf hrefs for duplicate detection and collapsed icon rail. */
export function flattenLeafItems(groups: NavigationGroup[]): NavigationItem[] {
  const out: NavigationItem[] = [];
  const walk = (item: NavigationItem) => {
    if (item.children?.length) {
      item.children.forEach(walk);
      return;
    }
    if (item.href) out.push(item);
  };
  groups.forEach((g) => g.children.forEach(walk));
  return out;
}

/** Groups/items that should start expanded for the active pathname. */
export function initialExpandedState(groups: NavigationGroup[], pathname: string): {
  groups: Record<string, boolean>;
  items: Record<string, boolean>;
} {
  const groupsOpen: Record<string, boolean> = {};
  const itemsOpen: Record<string, boolean> = {};

  groups.forEach((group) => {
    const groupActive = groupMatchesPath(group, pathname);
    groupsOpen[group.id] = groupActive;
    const walk = (item: NavigationItem) => {
      const active = itemMatchesPath(item, pathname);
      if (item.children?.length) {
        itemsOpen[item.id] = active;
        item.children.forEach(walk);
      }
    };
    group.children.forEach(walk);
  });

  return { groups: groupsOpen, items: itemsOpen };
}

/** Dev/test integrity checks — returns error messages. */
export function verifyNavigationIntegrity(): string[] {
  const errors: string[] = [];
  const expectedOrder = [
    "management",
    "directory",
    "financials",
    "operations",
    "academics",
    "system",
  ];
  const ids = NAVIGATION_GROUPS.map((g) => g.id);
  if (ids.join(",") !== expectedOrder.join(",")) {
    errors.push(`Group order mismatch: expected ${expectedOrder.join(", ")}, got ${ids.join(", ")}`);
  }

  const hrefs: string[] = [];
  const labels: string[] = [];
  const walk = (item: NavigationItem, path: string) => {
    const key = `${path} > ${item.label}`;
    if (labels.includes(item.label)) {
      // allow same label in different branches (e.g. Directory group vs Directory item)
    }
    labels.push(item.label);
    if (item.href) {
      if (hrefs.includes(item.href)) errors.push(`Duplicate href: ${item.href}`);
      hrefs.push(item.href);
    }
    item.children?.forEach((c) => walk(c, key));
  };
  NAVIGATION_GROUPS.forEach((g) => g.children.forEach((c) => walk(c, g.label)));

  const marksEntry = hrefs.filter((h) => h === "/academic/marks");
  if (marksEntry.length > 1) errors.push("Marks Entry appears more than once in navigation tree");

  const reportCards = hrefs.filter((h) => h.includes("/admin/report-cards") || h.startsWith("/report-cards"));
  if (reportCards.length > 1) errors.push("Report Cards appears more than once in navigation tree");

  return errors;
}
