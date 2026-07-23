import { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { api, useAuth } from "../../../src/auth";
import { isSuperAdminUser } from "../../../src/rbac";
import { getApiError } from "../../../src/ScreenStates";
import { APPROVED_LOGIN_USER_TYPES, CATALOG_BY_CODE, isApprovedLoginUserType, resolveRouteParam, type LoginUserType } from "../../../src/userClassification";
import {
  allLeafIds,
  applyGroupToggle,
  applyNodeToggle,
  countEnabledLeaves,
  groupNodeState,
  moduleNodeState,
  type ToggleState,
} from "../../../src/categoryPermissionsUtil";
import { colors, radii, shadow } from "../../../src/theme";
import { useBreakpoint } from "../../../src/useBreakpoint";

type CategorySummary = {
  user_type: LoginUserType;
  display_name: string;
  entity_scope: string;
  locked: boolean;
  enabled_count: number;
  total_count: number;
  active_user_count: number;
};

type ModuleNode = {
  id: string;
  label: string;
  permission_keys?: string[];
  rbac_permissions?: string[];
  children?: ModuleNode[];
};

type CategoryDetail = {
  user_type: LoginUserType;
  display_name: string;
  entity_scope: string;
  locked: boolean;
  catalog: Array<{ id: string; label: string; modules: ModuleNode[] }>;
  modules: Record<string, boolean>;
  updated_at?: string | null;
  updated_by_name?: string | null;
};

function permissionsApiError(e: any, fallback: string): string {
  const status = e?.response?.status;
  if (status === 404) {
    return "Category permissions API is unavailable. Ensure the backend is deployed with the latest release, then click Retry.";
  }
  return getApiError(e, fallback);
}

export default function CategoryPermissionsScreen() {
  const router = useRouter();
  const { category: categoryParam } = useLocalSearchParams<{ category?: string | string[] }>();
  const { user, loading: authLoading } = useAuth();
  const { isWide, horizontalPadding } = useBreakpoint();
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [selected, setSelected] = useState<LoginUserType>(APPROVED_LOGIN_USER_TYPES[1]);
  const [detail, setDetail] = useState<CategoryDetail | null>(null);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [savedSnapshot, setSavedSnapshot] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [error, setError] = useState("");

  const loadCategories = useCallback(async () => {
    setError("");
    try {
      const { data } = await api.get("/permissions/categories");
      const fromApi: CategorySummary[] = data.categories || [];
      // Ensure all seven canonical types appear even if API omits any
      const merged: CategorySummary[] = APPROVED_LOGIN_USER_TYPES.map((userType) => {
        const hit = fromApi.find((c) => c.user_type === userType);
        const meta = CATALOG_BY_CODE[userType];
        if (hit) return { ...hit, active_user_count: hit.active_user_count ?? 0 };
        return {
          user_type: userType,
          display_name: meta.displayName,
          entity_scope: meta.entityScope,
          locked: userType === "super_admin",
          enabled_count: 0,
          total_count: 0,
          active_user_count: 0,
        };
      });
      setCategories(merged);
      if (!merged.find((c) => c.user_type === selected)) {
        setSelected(merged.find((c) => !c.locked)?.user_type || merged[0].user_type);
      }
    } catch (e: any) {
      setError(permissionsApiError(e, "Failed to load categories"));
    } finally {
      setLoading(false);
    }
  }, [selected]);

  useEffect(() => {
    const raw = resolveRouteParam(categoryParam);
    if (raw && isApprovedLoginUserType(raw)) setSelected(raw);
  }, [categoryParam]);

  const loadDetail = useCallback(async (userType: LoginUserType) => {
    setLoadingDetail(true);
    setSaveMsg("");
    try {
      const { data } = await api.get(`/permissions/categories/${userType}`);
      setDetail(data);
      setDraft({ ...data.modules });
      setSavedSnapshot({ ...data.modules });
    } catch (e: any) {
      setError(permissionsApiError(e, "Failed to load category"));
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadCategories();
  }, [loadCategories]));

  useEffect(() => {
    if (selected) loadDetail(selected);
  }, [selected, loadDetail]);

  const dirty = useMemo(() => {
    if (!detail) return false;
    return Object.keys(draft).some((k) => !!draft[k] !== !!savedSnapshot[k]);
  }, [draft, savedSnapshot, detail]);

  const selectedCounts = useMemo(() => {
    if (!detail) return null;
    return countEnabledLeaves(detail.catalog, draft);
  }, [detail, draft]);

  const toggleNode = (node: ModuleNode, enabled: boolean) => {
    if (detail?.locked) return;
    setDraft((prev) => applyNodeToggle(prev, node, enabled));
    setSaveMsg("");
  };

  const toggleGroup = (groupModules: ModuleNode[], enabled: boolean) => {
    if (detail?.locked) return;
    setDraft((prev) => applyGroupToggle(prev, groupModules, enabled));
    setSaveMsg("");
  };

  const selectAll = () => {
    if (!detail || detail.locked) return;
    const ids = allLeafIds(detail.catalog);
    setDraft((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = true; });
      return next;
    });
  };

  const clearAll = () => {
    if (!detail || detail.locked) return;
    const ids = allLeafIds(detail.catalog);
    setDraft((prev) => {
      const next = { ...prev };
      ids.forEach((id) => { next[id] = false; });
      return next;
    });
  };

  const save = async () => {
    if (!detail || detail.locked || !dirty) return;
    setSaving(true);
    setSaveMsg("");
    try {
      const { data } = await api.put(`/permissions/categories/${detail.user_type}`, { modules: draft });
      setDetail(data);
      setDraft({ ...data.modules });
      setSavedSnapshot({ ...data.modules });
      const count = data.users_updated ?? 0;
      setSaveMsg(`Saved — ${count} account${count === 1 ? "" : "s"} updated.`);
      loadCategories();
    } catch (e: any) {
      setSaveMsg("");
      setError(permissionsApiError(e, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (authLoading || !user || isSuperAdminUser(user)) return;
    router.replace("/(tabs)/dashboard");
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <SafeAreaView style={s.safe}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!isSuperAdminUser(user)) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.denied}>
          <Feather name="lock" size={40} color={colors.hint} />
          <Text style={s.deniedTitle}>Access denied</Text>
          <Text style={s.deniedSub}>You do not have permission to view this page.</Text>
          <TouchableOpacity style={s.deniedBtn} onPress={() => router.replace("/(tabs)/dashboard")}>
            <Text style={s.deniedBtnTxt}>Go to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={s.safe} edges={["top"]} testID="category-permissions">
      <View style={[s.header, { paddingHorizontal: horizontalPadding }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="perm-back">
          <Feather name="chevron-left" size={22} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>SUPER ADMIN · ACCESS CONTROL</Text>
          <Text style={s.h1}>User Category Permissions</Text>
          <Text style={s.sub}>Configure module access by login user type — not individual accounts.</Text>
        </View>
      </View>

      {error ? (
        <View style={[s.banner, s.bannerError, { marginHorizontal: horizontalPadding }]}>
          <Text style={s.bannerErrorTxt}>{error}</Text>
          <TouchableOpacity onPress={() => { setError(""); loadCategories(); loadDetail(selected); }}>
            <Text style={s.link}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {saveMsg ? (
        <View style={[s.banner, s.bannerOk, { marginHorizontal: horizontalPadding }]} testID="perm-save-success">
          <Feather name="check-circle" size={16} color={colors.success} />
          <Text style={s.bannerOkTxt}>{saveMsg}</Text>
        </View>
      ) : null}

      {dirty && !detail?.locked ? (
        <View style={[s.banner, s.bannerWarn, { marginHorizontal: horizontalPadding }]} testID="perm-unsaved">
          <Feather name="alert-circle" size={16} color={colors.warning} />
          <Text style={s.bannerWarnTxt}>Unsaved changes</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color="#0F766E" style={{ marginTop: 40 }} />
      ) : (
        <View style={[s.body, isWide && s.bodyWide, { paddingHorizontal: horizontalPadding, flex: 1 }]}>
          {/* Category list — all seven login user types */}
          <View style={isWide ? s.catColWide : undefined}>
            <Text style={s.catColLabel}>User categories ({categories.length || 7})</Text>
            <ScrollView
              style={isWide ? s.catListWide : s.catListMobile}
              contentContainerStyle={s.catListContent}
              showsVerticalScrollIndicator
            >
            {categories.map((cat) => {
              const meta = CATALOG_BY_CODE[cat.user_type];
              const active = selected === cat.user_type;
              const counts = active && selectedCounts
                ? selectedCounts
                : { enabled: cat.enabled_count, total: cat.total_count };
              return (
                <TouchableOpacity
                  key={cat.user_type}
                  testID={`cat-${cat.user_type}`}
                  style={[s.catItem, active && s.catItemActive]}
                  onPress={() => setSelected(cat.user_type)}
                >
                  <View style={[s.catIcon, { backgroundColor: (meta?.tint || colors.primary) + "22" }]}>
                    <Feather name={(meta?.icon as any) || "user"} size={16} color={meta?.tint || colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.catName, active && s.catNameActive]}>{cat.display_name}</Text>
                    <View style={s.catMetaRow}>
                      <Text style={s.catMeta}>
                        {cat.entity_scope} · {counts.enabled}/{counts.total} modules
                        {cat.locked ? " · Locked" : ""}
                      </Text>
                      <TouchableOpacity
                        style={s.userBadge}
                        onPress={() => router.push(`/manage/${cat.user_type}`)}
                        testID={`cat-users-${cat.user_type}`}
                        accessibilityRole="link"
                        accessibilityLabel={`View ${cat.active_user_count} active ${cat.display_name} users`}
                      >
                        <Feather name="users" size={10} color="#0F766E" />
                        <Text style={s.userBadgeTxt}>
                          {cat.active_user_count} {cat.active_user_count === 1 ? "User" : "Users"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {active && <Feather name="chevron-right" size={16} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
            </ScrollView>
          </View>

          {/* Permissions panel */}
          <View style={[s.panel, isWide && s.panelWide]}>
            {loadingDetail || !detail ? (
              <ActivityIndicator color="#0F766E" style={{ marginTop: 32 }} />
            ) : (
              <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                <View style={s.panelHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.panelTitle}>{detail.display_name}</Text>
                    <Text style={s.panelSub}>
                      {detail.entity_scope} scope
                      {detail.updated_at ? ` · Updated ${detail.updated_at.slice(0, 10)}` : ""}
                      {detail.updated_by_name ? ` by ${detail.updated_by_name}` : ""}
                    </Text>
                  </View>
                  {detail.locked ? (
                    <View style={s.lockPill}>
                      <Feather name="lock" size={12} color={colors.muted} />
                      <Text style={s.lockTxt}>Full access</Text>
                    </View>
                  ) : (
                    <View style={s.bulkRow}>
                      <TouchableOpacity testID="perm-select-all" style={s.bulkBtn} onPress={selectAll}>
                        <Text style={s.bulkTxt}>Select all</Text>
                      </TouchableOpacity>
                      <TouchableOpacity testID="perm-clear-all" style={s.bulkBtn} onPress={clearAll}>
                        <Text style={s.bulkTxt}>Clear all</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {detail.catalog.map((group) => (
                  <View key={group.id} style={s.group}>
                    <View style={s.groupHead}>
                      <Text style={s.groupLabel}>{group.label}</Text>
                      {!detail.locked ? (
                        <HierarchySwitch
                          state={groupNodeState(group.modules, draft)}
                          disabled={false}
                          onToggle={(enabled) => toggleGroup(group.modules, enabled)}
                          testID={`toggle-group-${group.id}`}
                        />
                      ) : null}
                    </View>
                    {group.modules.map((mod) => (
                      <ModuleBlock
                        key={mod.id}
                        mod={mod}
                        draft={draft}
                        locked={!!detail.locked}
                        onToggleNode={toggleNode}
                      />
                    ))}
                  </View>
                ))}

                <TouchableOpacity
                  testID="perm-save"
                  style={[s.saveBtn, (!dirty || detail.locked || saving) && s.saveBtnDisabled]}
                  onPress={save}
                  disabled={!dirty || detail.locked || saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Feather name="save" size={16} color="#fff" />
                      <Text style={s.saveTxt}>Save changes</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function HierarchySwitch({
  state,
  disabled,
  onToggle,
  testID,
}: {
  state: ToggleState;
  disabled?: boolean;
  onToggle: (enabled: boolean) => void;
  testID?: string;
}) {
  const on = state === "on";
  return (
    <Switch
      value={on}
      onValueChange={onToggle}
      disabled={disabled}
      trackColor={{
        false: state === "partial" ? "#FDE68A" : colors.border,
        true: "#99F6E4",
      }}
      thumbColor={state === "partial" ? "#D97706" : on ? "#0F766E" : "#f4f3f4"}
      testID={testID}
    />
  );
}

function ModuleBlock({
  mod,
  draft,
  locked,
  onToggleNode,
  depth = 0,
}: {
  mod: ModuleNode;
  draft: Record<string, boolean>;
  locked: boolean;
  onToggleNode: (node: ModuleNode, enabled: boolean) => void;
  depth?: number;
}) {
  const state = moduleNodeState(mod, draft);
  const children = mod.children || [];

  return (
    <View style={[children.length > 0 && s.nestedGroup, depth > 0 && { marginLeft: 12 }]}>
      <View
        style={[s.moduleRow, depth > 0 && s.moduleRowNested, children.length > 0 && s.moduleRowParent]}
        testID={`mod-${mod.id}`}
      >
        <View style={{ flex: 1 }}>
          <Text style={[s.moduleLabel, children.length > 0 && s.moduleLabelParent]}>
            {mod.label}
          </Text>
        </View>
        <HierarchySwitch
          state={state}
          disabled={locked}
          onToggle={(enabled) => onToggleNode(mod, enabled)}
          testID={`toggle-${mod.id}`}
        />
      </View>
      {children.map((child) => (
        <ModuleBlock
          key={child.id}
          mod={child}
          draft={draft}
          locked={locked}
          onToggleNode={onToggleNode}
          depth={depth + 1}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "flex-start", paddingTop: 12, gap: 4, paddingBottom: 12 },
  backBtn: { padding: 8 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: colors.hint },
  h1: { fontSize: 22, fontWeight: "800", color: colors.ink, marginTop: 2 },
  sub: { fontSize: 12, color: colors.muted2, marginTop: 4, maxWidth: 520 },
  body: { flex: 1, gap: 12, minHeight: 0 },
  bodyWide: { flexDirection: "row", alignItems: "stretch" },
  catColWide: { width: 300, flexShrink: 0, alignSelf: "stretch" },
  catColLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.6, color: colors.muted2, textTransform: "uppercase", marginBottom: 8, paddingHorizontal: 2 },
  catListMobile: { maxHeight: 320 },
  catListWide: { flex: 1 },
  catListContent: { paddingBottom: 24 },
  catItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  catItemActive: { borderColor: "#0F766E", backgroundColor: "#F0FDFA" },
  catIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  catName: { fontSize: 14, fontWeight: "700", color: colors.ink2 },
  catNameActive: { color: "#0F766E" },
  catMetaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 2 },
  catMeta: { fontSize: 11, color: colors.muted2 },
  userBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#99F6E4",
  },
  userBadgeTxt: { fontSize: 10, fontWeight: "700", color: "#0F766E" },
  panel: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, padding: 16, ...shadow.sm, minHeight: 0 },
  panelWide: { minHeight: 400 },
  panelHead: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  panelTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  panelSub: { fontSize: 12, color: colors.muted2, marginTop: 4 },
  lockPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.borderSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill },
  lockTxt: { fontSize: 11, fontWeight: "700", color: colors.muted },
  bulkRow: { flexDirection: "row", gap: 8 },
  bulkBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: colors.borderSoft },
  bulkTxt: { fontSize: 11, fontWeight: "700", color: colors.primary },
  group: { marginBottom: 18 },
  groupHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 12 },
  groupLabel: { flex: 1, fontSize: 10, fontWeight: "800", letterSpacing: 0.6, color: colors.muted2, textTransform: "uppercase" },
  nestedGroup: { marginBottom: 8, paddingLeft: 4, borderLeftWidth: 2, borderLeftColor: colors.borderSoft },
  moduleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 8, borderRadius: radii.sm },
  moduleRowNested: { marginLeft: 8, backgroundColor: colors.surface2 },
  moduleRowParent: { marginBottom: 2 },
  moduleLabel: { fontSize: 13, fontWeight: "600", color: colors.ink2 },
  moduleLabelParent: { fontSize: 12, fontWeight: "700" },
  saveBtn: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#0F766E",
    paddingVertical: 14,
    borderRadius: radii.md,
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: radii.md, marginBottom: 8 },
  bannerOk: { backgroundColor: colors.successSoft },
  bannerOkTxt: { color: "#047857", fontWeight: "600", fontSize: 13, flex: 1 },
  bannerWarn: { backgroundColor: colors.warningSoft },
  bannerWarnTxt: { color: "#92400E", fontWeight: "600", fontSize: 13, flex: 1 },
  bannerError: { backgroundColor: colors.dangerSoft, justifyContent: "space-between" },
  bannerErrorTxt: { color: colors.danger, fontSize: 13, flex: 1 },
  link: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  denied: { padding: 40, alignItems: "center", gap: 8 },
  deniedTitle: { fontSize: 16, fontWeight: "700", color: colors.ink },
  deniedSub: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
  deniedBtn: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radii.md, backgroundColor: colors.primary },
  deniedBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
