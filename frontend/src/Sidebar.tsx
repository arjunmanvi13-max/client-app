import { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Pressable, Platform } from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "./auth";
import { colors } from "./theme";
import { BrandLogoPair } from "./components/BrandLogoPair";
import {
  filterNavigationGroups,
  flattenLeafItems,
  groupMatchesPath,
  initialExpandedState,
  itemMatchesPath,
  type NavigationGroup,
  type NavigationItem,
} from "./navigationConfig";

const STORAGE_KEY = "pws_alpha_nav_expand_v1";

function loadSavedExpandState(): { groups: Record<string, boolean>; items: Record<string, boolean> } | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveExpandState(groups: Record<string, boolean>, items: Record<string, boolean>) {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ groups, items }));
  } catch {
    /* ignore */
  }
}

type NavRowProps = {
  item: NavigationItem;
  depth: number;
  pathname: string;
  collapsed: boolean;
  openItems: Record<string, boolean>;
  onToggleItem: (id: string) => void;
  onNavigate: (href: string) => void;
};

function NavRow({ item, depth, pathname, collapsed, openItems, onToggleItem, onNavigate }: NavRowProps) {
  const children = item.children || [];
  const hasChildren = children.length > 0;
  const active = itemMatchesPath(item, pathname);
  const isOpen = openItems[item.id] ?? active;

  if (collapsed) return null;

  if (hasChildren) {
    return (
      <View>
        <Pressable
          testID={`nav-parent-${item.id}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          onPress={() => onToggleItem(item.id)}
          style={({ hovered }: any) => [
            styles.item,
            depth > 0 && styles.itemNested,
            depth > 1 && styles.itemDeep,
            hovered && styles.itemHover,
            active && styles.itemParentActive,
          ]}
        >
          <View style={[styles.itemIcon, active && styles.itemIconActive]}>
            <Feather name={item.icon} size={16} color={active ? "#fff" : colors.sidebarTextMuted} />
          </View>
          <Text style={[styles.itemTxt, active && styles.itemTxtActive]} numberOfLines={1}>{item.label}</Text>
          <Feather name={isOpen ? "chevron-down" : "chevron-right"} size={14} color={colors.sidebarTextMuted} />
        </Pressable>
        {isOpen && children.map((child) => (
          <NavRow
            key={child.id}
            item={child}
            depth={depth + 1}
            pathname={pathname}
            collapsed={collapsed}
            openItems={openItems}
            onToggleItem={onToggleItem}
            onNavigate={onNavigate}
          />
        ))}
      </View>
    );
  }

  if (!item.href) return null;

  const leafActive = item.match(pathname);
  return (
    <Pressable
      testID={`nav-${item.id}`}
      accessibilityRole="link"
      onPress={() => onNavigate(item.href!)}
      style={({ hovered }: any) => [
        styles.item,
        depth > 0 && styles.itemNested,
        depth > 1 && styles.itemDeep,
        hovered && styles.itemHover,
        leafActive && styles.itemActive,
      ]}
    >
      <View style={[styles.itemIcon, leafActive && styles.itemIconActive]}>
        <Feather name={item.icon} size={16} color={leafActive ? "#fff" : colors.sidebarTextMuted} />
      </View>
      <Text style={[styles.itemTxt, leafActive && styles.itemTxtActive]} numberOfLines={1}>{item.label}</Text>
    </Pressable>
  );
}

export function Sidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname() || "";
  const [collapsed, setCollapsed] = useState(false);

  const visibleGroups = useMemo(
    () => (user ? filterNavigationGroups({ user }) : []),
    [user],
  );

  const activeDefaults = useMemo(
    () => initialExpandedState(visibleGroups, pathname),
    [visibleGroups, pathname],
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const saved = loadSavedExpandState();
    return saved?.groups || activeDefaults.groups;
  });
  const [openItems, setOpenItems] = useState<Record<string, boolean>>(() => {
    const saved = loadSavedExpandState();
    return saved?.items || activeDefaults.items;
  });

  useEffect(() => {
    const next = initialExpandedState(visibleGroups, pathname);
    setOpenGroups((prev) => {
      const merged = { ...prev };
      Object.entries(next.groups).forEach(([k, v]) => { if (v) merged[k] = true; });
      return merged;
    });
    setOpenItems((prev) => {
      const merged = { ...prev };
      Object.entries(next.items).forEach(([k, v]) => { if (v) merged[k] = true; });
      return merged;
    });
  }, [pathname, visibleGroups]);

  useEffect(() => {
    saveExpandState(openGroups, openItems);
  }, [openGroups, openItems]);

  if (!user) return null;

  const W = collapsed ? 76 : 256;
  const flatLeaves = flattenLeafItems(visibleGroups);

  const toggleGroup = (id: string) => setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleItem = (id: string) => setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
  const onNavigate = (href: string) => router.push(href as any);

  return (
    <View style={[styles.sidebar, { width: W }]} testID="desktop-sidebar">
      <View style={styles.brand}>
        <BrandLogoPair size={collapsed ? 28 : 40} gap={collapsed ? 4 : 6} wrapStyle={styles.brandLogos} />
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
          flatLeaves.map((n) => {
            const active = n.match(pathname);
            return (
              <Pressable
                key={n.id}
                testID={`nav-${n.id}`}
                onPress={() => onNavigate(n.href!)}
                style={({ hovered }: any) => [
                  styles.item,
                  hovered && styles.itemHover,
                  active && styles.itemActive,
                  { justifyContent: "center" },
                ]}
              >
                <View style={[styles.itemIcon, active && styles.itemIconActive]}>
                  <Feather name={n.icon} size={18} color={active ? "#fff" : colors.sidebarTextMuted} />
                </View>
              </Pressable>
            );
          })
        ) : (
          visibleGroups.map((g: NavigationGroup) => {
            const isOpen = !!openGroups[g.id];
            const groupActive = groupMatchesPath(g, pathname);
            return (
              <View key={g.id} style={styles.group}>
                <Pressable
                  testID={`group-${g.id}`}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  onPress={() => toggleGroup(g.id)}
                  style={({ hovered }: any) => [styles.groupHeader, hovered && styles.groupHeaderHover, groupActive && styles.groupHeaderActive]}
                >
                  <View style={[styles.groupIcon, groupActive && styles.groupIconActive]}>
                    <Feather name={g.icon} size={14} color={groupActive ? colors.accent : colors.sidebarTextMuted} />
                  </View>
                  <Text style={[styles.groupLabel, groupActive && styles.groupLabelActive]} numberOfLines={2}>{g.label}</Text>
                  <Feather name={isOpen ? "chevron-down" : "chevron-right"} size={14} color={colors.sidebarTextMuted} />
                </Pressable>
                {isOpen && (
                  <View style={styles.groupBody}>
                    {g.children.map((item) => (
                      <NavRow
                        key={item.id}
                        item={item}
                        depth={0}
                        pathname={pathname}
                        collapsed={collapsed}
                        openItems={openItems}
                        onToggleItem={toggleItem}
                        onNavigate={onNavigate}
                      />
                    ))}
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
          <Feather name={collapsed ? "chevrons-right" : "chevrons-left"} size={16} color={colors.sidebarTextMuted} />
          {!collapsed && <Text style={styles.footerTxt}>Collapse</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          testID="sidebar-logout"
          style={[styles.footerBtn, styles.footerBtnDanger]}
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
    backgroundColor: colors.primary,
    borderRightWidth: 1,
    borderRightColor: colors.sidebarBorder,
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
    borderBottomColor: colors.sidebarBorder,
  },
  brandLogos: { flexShrink: 0 },
  brandTitle: { color: "#FFFFFF", fontWeight: "800", fontSize: 14, letterSpacing: -0.2 },
  brandSub: { color: colors.sidebarTextMuted, fontSize: 11, marginTop: 1 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    margin: 12,
    padding: 10,
    backgroundColor: colors.sidebarHover,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.sidebarBorder,
  },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  profileName: { fontWeight: "700", color: colors.sidebarText, fontSize: 13 },
  profileRole: { color: colors.sidebarTextMuted, fontSize: 11, marginTop: 2, textTransform: "capitalize" },
  group: { marginBottom: 2 },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginHorizontal: 6,
    marginTop: 2,
    borderRadius: 8,
  },
  groupHeaderHover: { backgroundColor: colors.sidebarHover },
  groupHeaderActive: { backgroundColor: colors.sidebarActive },
  groupIcon: {
    width: 22, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 6,
    backgroundColor: colors.sidebarHover,
  },
  groupIconActive: { backgroundColor: "rgba(0,168,232,0.28)" },
  groupLabel: { flex: 1, color: colors.sidebarTextMuted, fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  groupLabelActive: { color: colors.accent },
  groupBody: { paddingLeft: 4, marginTop: 1, borderLeftWidth: 1, borderLeftColor: colors.sidebarBorder, marginLeft: 18 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginHorizontal: 6,
    marginVertical: 1,
    borderRadius: 8,
  },
  itemNested: { marginLeft: 8 },
  itemDeep: { marginLeft: 14 },
  itemHover: { backgroundColor: colors.sidebarHover },
  itemActive: { backgroundColor: colors.accent },
  itemParentActive: { backgroundColor: colors.sidebarActive },
  itemIcon: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 6 },
  itemIconActive: { backgroundColor: "rgba(255,255,255,0.16)" },
  itemTxt: { color: colors.sidebarText, fontWeight: "600", fontSize: 13, flex: 1 },
  itemTxtActive: { color: "#FFFFFF", fontWeight: "800" },
  footer: {
    paddingHorizontal: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.sidebarBorder,
    gap: 6,
  },
  footerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.sidebarHover,
  },
  footerBtnDanger: { backgroundColor: "rgba(255,107,107,0.12)" },
  footerTxt: { color: colors.sidebarTextMuted, fontSize: 12, fontWeight: "700" },
});
