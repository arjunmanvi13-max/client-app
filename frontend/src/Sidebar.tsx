import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, Pressable } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "./auth";
import { colors } from "./theme";
import { BusinessEntity, Permission, hasPermission } from "./rbac";
import type { User } from "./auth";

type NavItem = {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  href: string;
  match: (p: string) => boolean;
  roles?: string[];
  permissions?: Permission[];
  permissionEntity?: BusinessEntity;
  excludeRoles?: string[];
  needsManage?: boolean;
  needsCoachAttendance?: boolean;
  pwsOnly?: boolean;
  alphaOnly?: boolean;
};

type NavGroup = {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  items: NavItem[];
};

// Section 1: Management & Insights
const GRP_MANAGEMENT: NavGroup = {
  key: "management",
  label: "Management & Insights",
  icon: "pie-chart",
  items: [
    { key: "dashboard", label: "Dashboard", icon: "home", href: "/(tabs)/dashboard", match: (p) => p.startsWith("/(tabs)/dashboard") || p === "/" || p === "/dashboard" },
    { key: "reports", label: "Reports", icon: "bar-chart-2", href: "/reports", match: (p) => p.startsWith("/reports"), permissions: [Permission.RUN_PWS_REPORTS, Permission.RUN_ALPHA_REPORTS] },
    { key: "tasks", label: "Task Tracker", icon: "check-square", href: "/(tabs)/tasks", match: (p) => p.startsWith("/(tabs)/tasks") || p.startsWith("/task") || p === "/tasks" },
    { key: "approvals", label: "Approvals", icon: "shield", href: "/admin/approvals", match: (p) => p.startsWith("/admin/approvals"), permissions: [Permission.APPROVE_REQUESTS] },
  ],
};

// Section 2: People & Directory
const GRP_PEOPLE: NavGroup = {
  key: "people",
  label: "People & Directory",
  icon: "users",
  items: [
    { key: "coaches", label: "Coaches", icon: "award", href: "/manage/coach", match: (p) => p.startsWith("/manage/coach"), permissions: [Permission.MANAGE_COACHES, Permission.CREATE_USERS], excludeRoles: ["teacher"] },
    { key: "players", label: "Players", icon: "user", href: "/manage/player", match: (p) => p.startsWith("/manage/player"), permissions: [Permission.MANAGE_PLAYERS, Permission.ADD_ALPHA_PLAYERS], excludeRoles: ["teacher"] },
    { key: "teachers", label: "Teachers", icon: "book-open", href: "/manage/teacher", match: (p) => p.startsWith("/manage/teacher"), permissions: [Permission.MANAGE_TEACHERS_MAP_SUBJECTS, Permission.CREATE_USERS], pwsOnly: true, excludeRoles: ["teacher"] },
    { key: "students", label: "Students", icon: "user", href: "/manage/student", match: (p) => p.startsWith("/manage/student"), permissions: [Permission.ADD_PWS_STUDENTS], pwsOnly: true, excludeRoles: ["teacher"] },
    { key: "staff", label: "Staff", icon: "briefcase", href: "/manage/staff", match: (p) => p.startsWith("/manage/staff"), excludeRoles: ["teacher", "coach"] },
    { key: "directory", label: "Directory", icon: "book", href: "/directory", match: (p) => p.startsWith("/directory"), excludeRoles: ["teacher", "coach"] },
  ],
};

// Section 3: Financials
const GRP_FINANCE: NavGroup = {
  key: "finance",
  label: "Financials",
  icon: "credit-card",
  items: [
    { key: "fees", label: "Fees", icon: "credit-card", href: "/fees", match: (p) => p.startsWith("/fees") && !p.startsWith("/fees/collection") && !p.includes("overdue"), permissions: [Permission.COLLECT_PWS_FEES, Permission.COLLECT_ALPHA_FEES] },
    { key: "collect", label: "Collect Fees", icon: "inbox", href: "/fees/collection", match: (p) => p.startsWith("/fees/collection"), permissions: [Permission.COLLECT_PWS_FEES, Permission.COLLECT_ALPHA_FEES] },
    { key: "defaulters", label: "Defaulters", icon: "alert-triangle", href: "/fees?tab=overdue", match: (p) => p.startsWith("/fees") && p.includes("overdue"), permissions: [Permission.COLLECT_PWS_FEES, Permission.COLLECT_ALPHA_FEES] },
  ],
};

// Section 4: Operations & Logistics
const GRP_OPERATIONS: NavGroup = {
  key: "operations",
  label: "Operations & Logistics",
  icon: "layers",
  items: [
    { key: "attendance", label: "Attendance", icon: "user-check", href: "/(tabs)/attendance", match: (p) => p.startsWith("/(tabs)/attendance") || p === "/attendance" || p === "/staff-attendance" || p === "/coach-attendance" },
    { key: "coach-assessments", label: "Player Assessments", icon: "clipboard", href: "/coach/assessments", match: (p) => p.startsWith("/coach/assessments"), permissions: [Permission.MANAGE_PLAYER_ASSESSMENT, Permission.MANAGE_COACH_ASSESSMENTS_ADMIN] },
    { key: "attendance-reports", label: "Attendance Reports", icon: "bar-chart", href: "/admin/attendance", match: (p) => p.startsWith("/admin/attendance"), permissions: [Permission.VIEW_ATTENDANCE, Permission.RUN_PWS_REPORTS] },
    { key: "marks", label: "Enter Marks", icon: "edit-3", href: "/academic/marks", match: (p) => p.startsWith("/academic/marks"), permissions: [Permission.MANAGE_MARKS_ASSESSMENT], pwsOnly: true },
    { key: "report-cards", label: "Report Cards", icon: "file-text", href: "/admin/report-cards", match: (p) => p.startsWith("/admin/report-cards") || p.startsWith("/report-cards"), permissions: [Permission.MANAGE_MARKS_ASSESSMENT], pwsOnly: true },
    { key: "hostel", label: "Hostel", icon: "moon", href: "/(tabs)/hostel", match: (p) => p.startsWith("/(tabs)/hostel") || p === "/hostel", permissions: [Permission.MARK_HOSTEL_ATTENDANCE] },
    { key: "bulk", label: "Bulk Upload", icon: "upload-cloud", href: "/admin/bulk-upload", match: (p) => p.startsWith("/admin/bulk-upload"), permissions: [Permission.BULK_UPLOAD_USERS] },
  ],
};

// Section 5: System & Administration
const GRP_SYSTEM: NavGroup = {
  key: "system",
  label: "System & Administration",
  icon: "settings",
  items: [
    { key: "perms", label: "Permissions", icon: "key", href: "/admin/permissions", match: (p) => p.startsWith("/admin/permissions"), permissions: [Permission.MANAGE_ACCESS] },
    { key: "academic", label: "Academic Structure", icon: "book-open", href: "/admin/academic", match: (p) => p.startsWith("/admin/academic"), permissions: [Permission.MANAGE_TEACHERS_MAP_SUBJECTS, Permission.MANAGE_TEACHERS_MAP_SECTIONS], pwsOnly: true },
    { key: "marks-admin", label: "Marks & Assessment", icon: "edit-3", href: "/admin/marks", match: (p) => p.startsWith("/admin/marks"), permissions: [Permission.MANAGE_TEACHERS_MAP_SUBJECTS], pwsOnly: true },
    { key: "report-cards-admin", label: "Report Cards", icon: "file-text", href: "/admin/report-cards", match: (p) => p.startsWith("/admin/report-cards"), permissions: [Permission.MANAGE_TEACHERS_MAP_SUBJECTS], pwsOnly: true },
    { key: "coach-asm-admin", label: "Coach Assessments", icon: "clipboard", href: "/admin/coach-assessments", match: (p) => p.startsWith("/admin/coach-assessments"), permissions: [Permission.MANAGE_COACH_ASSESSMENTS_ADMIN] },
    { key: "invoices", label: "Invoice Engine", icon: "file-text", href: "/admin/invoices", match: (p) => p.startsWith("/admin/invoices"), permissions: [Permission.COLLECT_PWS_FEES], pwsOnly: true },
    { key: "fee-catalog", label: "Fee Catalogue", icon: "layers", href: "/admin/fee-catalog", match: (p) => p.startsWith("/admin/fee-catalog"), permissions: [Permission.MANAGE_FEES_HEADS] },
    { key: "settings", label: "Settings", icon: "settings", href: "/(tabs)/profile", match: (p) => p === "/settings" || p.startsWith("/(tabs)/profile") },
    { key: "notifications", label: "Notifications", icon: "bell", href: "/notifications", match: (p) => p.startsWith("/notifications"), excludeRoles: ["coach"] },
  ],
};

const NAV_GROUPS: NavGroup[] = [
  GRP_MANAGEMENT,
  GRP_PEOPLE,
  GRP_FINANCE,
  GRP_OPERATIONS,
  GRP_SYSTEM,
];

const isItemAllowed = (n: NavItem, user: User) => {
  if (n.excludeRoles?.includes(user.role)) return false;
  if (n.pwsOnly && user.organization === "ALPHA") return false;
  if (n.alphaOnly && user.organization === "PWS") return false;
  if (n.permissions?.length) {
    return n.permissions.some((p) => hasPermission(user, p, n.permissionEntity));
  }
  if (n.roles && !n.roles.includes(user.role)) return false;
  return true;
};

export function Sidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    management: true,
    people: true,
    finance: true,
    operations: true,
    system: true,
  });

  if (!user) return null;

  const W = collapsed ? 76 : 256;

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((n) => isItemAllowed(n, user)),
  })).filter((g) => g.items.length > 0);

  const toggleGroup = (k: string) => setOpenGroups((prev) => ({ ...prev, [k]: !prev[k] }));

  return (
    <View style={[styles.sidebar, { width: W }]} testID="desktop-sidebar">
      <View style={styles.brand}>
        <Image source={require("../assets/alpha-sports-logo.png")} style={styles.logoImg} resizeMode="contain" />
        {!collapsed && (
          <View style={{ flex: 1 }}>
            <Text style={styles.brandTitle}>PWS & ALPHA</Text>
            <Text style={styles.brandSub}>Tracker</Text>
          </View>
        )}
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTxt}>{(user.name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("")}</Text>
        </View>
        {!collapsed && (
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.profileName}>{user.name}</Text>
            <Text numberOfLines={1} style={styles.profileRole}>{user.role.replace("_", " ")} · {user.organization}</Text>
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 4 }} showsVerticalScrollIndicator={false}>
        {collapsed ? (
          // Icon-only view — flat list of items (no group headers) for tight sidebar
          visibleGroups.flatMap((g) => g.items).map((n) => {
            const active = n.match(pathname || "");
            return (
              <Pressable
                key={n.key}
                testID={`nav-${n.key}`}
                onPress={() => router.push(n.href as any)}
                style={({ hovered }: any) => [
                  styles.item,
                  hovered && styles.itemHover,
                  active && styles.itemActive,
                  { justifyContent: "center" },
                ]}
              >
                <View style={[styles.itemIcon, active && styles.itemIconActive]}>
                  <Feather name={n.icon} size={18} color={active ? "#fff" : colors.muted} />
                </View>
              </Pressable>
            );
          })
        ) : (
          // Grouped/expanded view
          visibleGroups.map((g) => {
            const isOpen = !!openGroups[g.key];
            const groupHasActive = g.items.some((it) => it.match(pathname || ""));
            return (
              <View key={g.key} style={styles.group}>
                <Pressable
                  testID={`group-${g.key}`}
                  onPress={() => toggleGroup(g.key)}
                  style={({ hovered }: any) => [styles.groupHeader, hovered && styles.groupHeaderHover]}
                >
                  <View style={[styles.groupIcon, groupHasActive && styles.groupIconActive]}>
                    <Feather name={g.icon} size={14} color={groupHasActive ? colors.primary : colors.muted} />
                  </View>
                  <Text style={[styles.groupLabel, groupHasActive && { color: colors.primary }]} numberOfLines={1}>{g.label}</Text>
                  <Feather name={isOpen ? "chevron-down" : "chevron-right"} size={14} color={colors.muted} />
                </Pressable>
                {isOpen && (
                  <View style={styles.groupBody}>
                    {g.items.map((n) => {
                      const active = n.match(pathname || "");
                      return (
                        <Pressable
                          key={n.key}
                          testID={`nav-${n.key}`}
                          onPress={() => router.push(n.href as any)}
                          style={({ hovered }: any) => [
                            styles.item,
                            styles.itemNested,
                            hovered && styles.itemHover,
                            active && styles.itemActive,
                          ]}
                        >
                          <View style={[styles.itemIcon, active && styles.itemIconActive]}>
                            <Feather name={n.icon} size={16} color={active ? "#fff" : colors.muted} />
                          </View>
                          <Text style={[styles.itemTxt, active && styles.itemTxtActive]} numberOfLines={1}>{n.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          testID="sidebar-toggle"
          style={styles.footerBtn}
          onPress={() => setCollapsed((c) => !c)}
        >
          <Feather name={collapsed ? "chevrons-right" : "chevrons-left"} size={16} color={colors.muted} />
          {!collapsed && <Text style={styles.footerTxt}>Collapse</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          testID="sidebar-logout"
          style={[styles.footerBtn, { backgroundColor: colors.dangerSoft }]}
          onPress={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          <Feather name="log-out" size={16} color={colors.danger} />
          {!collapsed && <Text style={[styles.footerTxt, { color: colors.danger }]}>Sign out</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    height: "100%",
    paddingTop: 16,
    paddingBottom: 16,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  logoImg: { width: 44, height: 44, borderRadius: 10 },
  brandTitle: { color: colors.ink, fontWeight: "800", fontSize: 14, letterSpacing: -0.2 },
  brandSub: { color: colors.muted, fontSize: 11, marginTop: 1 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 12,
    padding: 10,
    backgroundColor: colors.primarySofter,
    borderRadius: 12,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  profileName: { fontWeight: "700", color: colors.ink, fontSize: 13 },
  profileRole: { color: colors.muted, fontSize: 11, marginTop: 2, textTransform: "capitalize" },
  group: { marginBottom: 4 },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 6,
    marginTop: 4,
    borderRadius: 8,
  },
  groupHeaderHover: { backgroundColor: colors.borderSoft },
  groupIcon: {
    width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 6, backgroundColor: colors.borderSoft,
  },
  groupIconActive: { backgroundColor: colors.primarySoft },
  groupLabel: { flex: 1, color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
  groupBody: { paddingLeft: 6, marginTop: 2 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 8,
    marginVertical: 1,
    borderRadius: 8,
  },
  itemNested: {
    marginLeft: 14,
  },
  itemHover: { backgroundColor: colors.primarySofter },
  itemActive: { backgroundColor: colors.primarySoft },
  itemIcon: { width: 26, height: 26, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  itemIconActive: { backgroundColor: colors.primary },
  itemTxt: { color: colors.ink2, fontWeight: "600", fontSize: 13, flex: 1 },
  itemTxtActive: { color: colors.primary, fontWeight: "800" },
  footer: {
    paddingHorizontal: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: 6,
  },
  footerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.borderSoft,
  },
  footerTxt: { color: colors.muted, fontSize: 12, fontWeight: "700" },
});
