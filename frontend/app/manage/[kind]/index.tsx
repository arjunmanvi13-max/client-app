import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect, usePathname } from "expo-router";
import { api, useAuth, userHasPermission } from "../../../src/auth";
import { BusinessEntity, Permission, UserRole } from "../../../src/rbac";
import {
  CATALOG_BY_CODE,
  designationLabel,
  entityScopeLabel,
  filterUsersByType,
  isApprovedLoginUserType,
  resolveRouteParam,
  type LoginUserType,
} from "../../../src/userClassification";
import { getManageListMeta, resolveManageKind } from "../../../src/manageKinds";
import { RosterManageList } from "../../../src/RosterManageList";

/** Approved login user types — Super Admin hub only. */
function LoginUserManageList({ kind }: { kind: LoginUserType }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const catalog = CATALOG_BY_CODE[kind];
  const canManageUsersRosters = userHasPermission(user, Permission.MANAGE_USERS_ROSTERS);
  const canAddTeacher = userHasPermission(user, Permission.ADD_NEW_TEACHER, BusinessEntity.PWS);
  const canAccessList = canManageUsersRosters || (kind === UserRole.PWS_TEACHER && canAddTeacher);
  const canShowAdd = kind !== "super_admin" && (canManageUsersRosters || (kind === UserRole.PWS_TEACHER && canAddTeacher));

  const load = useCallback(async () => {
    if (authLoading || !canAccessList) return;
    setLoading(true);
    setLoadError(null);
    try {
      const { data } = await api.get("/users", { params: { user_type: kind } });
      let rows = filterUsersByType(Array.isArray(data) ? data : [], kind);
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        rows = rows.filter((u: any) =>
          (u.name || "").toLowerCase().includes(q)
          || (u.email || "").toLowerCase().includes(q)
          || (u.mobile || "").includes(q),
        );
      }
      setItems(rows);
    } catch (e: any) {
      setItems([]);
      setLoadError(e?.response?.data?.detail || "Failed to load accounts");
    } finally { setLoading(false); }
  }, [authLoading, kind, canAccessList, search]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (authLoading) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <ActivityIndicator color={catalog.tint} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!canAccessList) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="list-back">
            <Feather name="chevron-left" size={22} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.h1}>{catalog.displayName}</Text>
            <Text style={s.sub}>Access restricted</Text>
          </View>
        </View>
        <View style={s.blockedBox}>
          <Feather name="shield-off" size={36} color="#991B1B" />
          <Text style={s.blockedTitle}>Permission required</Text>
          <Text style={s.blockedText}>
            You need Manage Users &amp; Rosters or Add New Teacher enabled for your role. Ask a Super Admin to update Permissions under System &amp; Settings.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="list-back">
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>{catalog.displayName}</Text>
          <Text style={s.sub}>{items.length} account{items.length !== 1 ? "s" : ""} · {entityScopeLabel(catalog.entityScope)}</Text>
        </View>
        {canShowAdd && (
          <TouchableOpacity
            testID={`add-${kind}`}
            style={[s.addBtn, { backgroundColor: catalog.tint }]}
            onPress={() => router.push(`/manage/${kind}/new`)}
          >
            <Feather name="plus" size={18} color="#fff" />
            <Text style={s.addText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.searchRow}>
        <Feather name="search" size={16} color="#94A3B8" />
        <TextInput
          testID="users-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or email…"
          placeholderTextColor="#94A3B8"
          style={s.searchInput}
          onSubmitEditing={load}
        />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {loadError ? (
          <View style={s.empty}>
            <Feather name="alert-circle" size={36} color="#EF4444" />
            <Text style={s.emptyText}>{loadError}</Text>
          </View>
        ) : loading ? <ActivityIndicator color={catalog.tint} style={{ marginTop: 24 }} /> :
         items.length === 0 ? (
           <View style={s.empty}>
             <Feather name="users" size={36} color="#94A3B8" />
             <Text style={s.emptyText}>
               {search.trim() ? `No matches for "${search.trim()}".` : `No ${catalog.displayName.toLowerCase()} accounts yet.`}
             </Text>
           </View>
         ) : items.map((it) => {
          const isDeact = it.status === "deactivated";
          const needsReview = it.requires_user_type_review;
          return (
          <TouchableOpacity
            key={it.id}
            testID={`row-${it.id}`}
            style={[s.row, isDeact && s.rowDeact]}
            onPress={() => router.push(`/manage/${kind}/${it.id}`)}
          >
            <View style={[s.avatar, { backgroundColor: isDeact ? "#94A3B8" : catalog.tint }]}>
              <Text style={s.avatarTxt}>
                {(it.name || "?").split(" ").filter(Boolean).map((n: string) => n[0]).slice(0, 2).join("") || "?"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Text style={s.name}>{it.name}</Text>
                {isDeact && <View style={s.deactPill}><Text style={s.deactPillTxt}>Inactive</Text></View>}
                {needsReview && <View style={s.reviewPill}><Text style={s.reviewPillTxt}>Review</Text></View>}
              </View>
              <Text style={s.metaTxt}>
                {it.email || it.mobile || ""}
                {it.designation ? ` · ${designationLabel(it.designation)}` : ""}
                {it.assigned_sport ? ` · ${it.assigned_sport}` : ""}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function ManageList() {
  const { kind: kindRaw } = useLocalSearchParams<{ kind: string | string[] }>();
  const pathname = usePathname() || "";
  const kindParam = resolveManageKind(resolveRouteParam(kindRaw), pathname);
  const router = useRouter();

  if (!kindParam) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <ActivityIndicator color="#1E40AF" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (isApprovedLoginUserType(kindParam)) {
    return <LoginUserManageList kind={kindParam} />;
  }

  if (getManageListMeta(kindParam)) {
    return <RosterManageList kind={kindParam} />;
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.empty}>
        <Text style={s.emptyText}>Unknown record type.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#1E40AF", fontWeight: "700" }}>Go back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  backBtn: { padding: 8 },
  h1: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  sub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  addText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A", padding: 0 },
  toggleRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 10 },
  typeScroll: { maxHeight: 44, marginTop: 8 },
  typeRow: { paddingHorizontal: 20, gap: 8, alignItems: "center" },
  togglePill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  togglePillActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  toggleTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  toggleTxtActive: { color: "#fff" },
  scroll: { padding: 20, paddingBottom: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  rowDeact: { opacity: 0.65 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  name: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  metaTxt: { fontSize: 12, color: "#64748B", marginTop: 2 },
  deactPill: { backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  deactPillTxt: { fontSize: 10, fontWeight: "800", color: "#64748B" },
  reviewPill: { backgroundColor: "#FEF3C7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  reviewPillTxt: { fontSize: 10, fontWeight: "800", color: "#B45309" },
  permRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  permPill: { backgroundColor: "#EEF2FF", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  permTxt: { fontSize: 10, fontWeight: "700", color: "#1E40AF" },
  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyText: { color: "#64748B", textAlign: "center", fontSize: 13 },
  scopeBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, alignSelf: "flex-start", backgroundColor: "#EFF6FF", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  scopeText: { color: "#1E40AF", fontWeight: "700", fontSize: 11 },
  blockedBox: { marginHorizontal: 20, marginTop: 16, padding: 20, backgroundColor: "#FEF2F2", borderRadius: 14, borderWidth: 1, borderColor: "#FECACA", alignItems: "center", gap: 8 },
  blockedTitle: { fontSize: 16, fontWeight: "800", color: "#991B1B" },
  blockedText: { textAlign: "center", color: "#7F1D1D", lineHeight: 20 },
});
