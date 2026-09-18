import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import { api, useAuth, userHasPermission } from "./auth";
import { Permission, UserRole, isSuperAdminUser } from "./rbac";
import {
  ADMIN_DESIGNATION_LABELS,
  canonicalizeDesignation,
  isCoachDirectoryRecord,
  matchesAdminDesignationFilter,
  permissionSetForDesignation,
  type AdminDesignation,
} from "./directoryWorkflow";
import { PERMISSION_SET_BY_CODE } from "./directoryWorkflow";
import { designationLabel, entityScopeLabel } from "./userClassification";

function isTeacherAccount(u: any): boolean {
  const ut = (u.user_type || "").toLowerCase();
  const role = (u.role || "").toLowerCase();
  return ut === UserRole.PWS_TEACHER || role === "teacher" || role === "pws_teacher";
}

function editHref(row: any): string {
  if (row._source === "staff") return `/manage/staff/${row.id}`;
  const ut = row.user_type || row.role;
  if (ut === UserRole.ALPHA_COACH || row.role === "coach") return `/manage/coach/${row.id}`;
  if (ut && ut !== "staff") return `/manage/${ut}/${row.id}`;
  return `/manage/login_admin/${row.id}`;
}

export function AdminDirectoryList() {
  const router = useRouter();
  const { designation: designationParam } = useLocalSearchParams<{ designation?: string | string[] }>();
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const initialChip = canonicalizeDesignation(Array.isArray(designationParam) ? designationParam[0] : designationParam);
  const [designation, setDesignation] = useState(
    initialChip && initialChip in ADMIN_DESIGNATION_LABELS ? initialChip : "",
  );
  const canManage = isSuperAdminUser(user) || userHasPermission(user, Permission.MANAGE_USERS_ROSTERS) || userHasPermission(user, Permission.CREATE_USERS);

  const load = useCallback(async () => {
    if (authLoading || !canManage) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [usersRes, staffRes] = await Promise.all([
        api.get("/users", { params: { include_deactivated: true } }),
        api.get("/people", { params: { kind: "staff" } }),
      ]);
      const users = (Array.isArray(usersRes.data) ? usersRes.data : [])
        .filter((u: any) => !isTeacherAccount(u))
        .map((u: any) => ({ ...u, _source: "user" }));
      const staffPayload = staffRes.data;
      const staffRows = Array.isArray(staffPayload) ? staffPayload : staffPayload?.people || staffPayload?.items || [];
      const staff = staffRows.map((p: any) => ({ ...p, _source: "staff", user_type: p.user_type || "staff" }));
      let rows = [...users, ...staff];
      if (designation) {
        rows = rows.filter((u: any) => matchesAdminDesignationFilter(u, designation));
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        rows = rows.filter((u: any) =>
          (u.name || "").toLowerCase().includes(q)
          || (u.email || "").toLowerCase().includes(q)
          || (u.mobile || "").includes(q)
          || (u.employee_id || "").toLowerCase().includes(q)
        );
      }
      rows.sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || "")));
      setItems(rows);
    } catch (e: any) {
      setItems([]);
      setLoadError(e?.response?.data?.detail || "Failed to load admins");
    } finally {
      setLoading(false);
    }
  }, [authLoading, canManage, search, designation]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (authLoading) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <ActivityIndicator color="#1B3B6F" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!canManage) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="list-back">
            <Feather name="chevron-left" size={22} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.h1}>Admins</Text>
            <Text style={s.sub}>Access restricted</Text>
          </View>
        </View>
        <View style={s.blockedBox}>
          <Feather name="shield-off" size={36} color="#991B1B" />
          <Text style={s.blockedTitle}>Permission required</Text>
          <Text style={s.blockedText}>Only Super Admins can create Admins and assign permission sets from Directory.</Text>
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
          <Text style={s.h1}>Admins</Text>
          <Text style={s.sub}>{items.length} record{items.length !== 1 ? "s" : ""} · Directory</Text>
        </View>
        {isSuperAdminUser(user) && (
          <TouchableOpacity testID="add-admin" style={s.addBtn} onPress={() => router.push("/manage/login_admin/new")}>
            <Feather name="plus" size={18} color="#fff" />
            <Text style={s.addText}>Add person</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.searchRow}>
        <Feather name="search" size={16} color="#94A3B8" />
        <TextInput
          testID="admins-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, mobile, email, or employee ID…"
          placeholderTextColor="#94A3B8"
          style={s.searchInput}
          onSubmitEditing={load}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeScroll} contentContainerStyle={s.typeRow}>
        <TouchableOpacity style={[s.togglePill, !designation && s.togglePillActive]} onPress={() => setDesignation("")}>
          <Text style={[s.toggleTxt, !designation && s.toggleTxtActive]}>All designations</Text>
        </TouchableOpacity>
        {(Object.keys(ADMIN_DESIGNATION_LABELS) as AdminDesignation[]).map((code) => (
          <TouchableOpacity key={code} style={[s.togglePill, designation === code && s.togglePillActive]} onPress={() => setDesignation(code)}>
            <Text style={[s.toggleTxt, designation === code && s.toggleTxtActive]}>{ADMIN_DESIGNATION_LABELS[code]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={s.scroll}>
        {loadError ? (
          <View style={s.empty}>
            <Feather name="alert-circle" size={36} color="#EF4444" />
            <Text style={s.emptyText}>{loadError}</Text>
          </View>
        ) : loading ? <ActivityIndicator color="#1B3B6F" style={{ marginTop: 24 }} /> :
         items.length === 0 ? (
           <View style={s.empty}>
             <Feather name="users" size={36} color="#94A3B8" />
             <Text style={s.emptyText}>{search.trim() ? `No matches for "${search.trim()}".` : "No admins yet."}</Text>
           </View>
         ) : items.map((it) => {
           const des = isCoachDirectoryRecord(it) ? "COACH" : canonicalizeDesignation(it.designation);
           const setCode = it.permission_set || permissionSetForDesignation(des);
           const setMeta = setCode ? PERMISSION_SET_BY_CODE[setCode as keyof typeof PERMISSION_SET_BY_CODE] : null;
           const inactive = it.status === "deactivated" || it.is_active === false;
           return (
             <TouchableOpacity key={`${it._source}-${it.id}`} testID={`admin-row-${it.id}`} style={[s.row, inactive && s.rowDeact]} onPress={() => router.push(editHref(it) as any)}>
               <View style={[s.avatar, { backgroundColor: setMeta?.tint || "#1B3B6F" }]}>
                 <Text style={s.avatarTxt}>{(it.name || "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</Text>
               </View>
               <View style={{ flex: 1 }}>
                 <Text style={s.name}>{it.name}</Text>
                 <Text style={s.metaTxt}>
                   {it.email || it.mobile || it.employee_id || ""}
                   {des ? ` · ${designationLabel(des)}` : ""}
                   {it.organization ? ` · ${entityScopeLabel(it.organization)}` : ""}
                 </Text>
                 {setMeta ? <Text style={s.setTxt}>{setMeta.name} permission set</Text> : null}
               </View>
               {inactive ? <View style={s.deactPill}><Text style={s.deactPillTxt}>Inactive</Text></View> : null}
               <Feather name="chevron-right" size={18} color="#94A3B8" />
             </TouchableOpacity>
           );
         })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  backBtn: { padding: 8 },
  h1: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  sub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#1B3B6F" },
  addText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A", padding: 0 },
  typeScroll: { maxHeight: 44, marginTop: 8 },
  typeRow: { paddingHorizontal: 20, gap: 8, alignItems: "center" },
  togglePill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  togglePillActive: { backgroundColor: "#1B3B6F", borderColor: "#1B3B6F" },
  toggleTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  toggleTxtActive: { color: "#fff" },
  scroll: { padding: 20, paddingBottom: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  rowDeact: { opacity: 0.65 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  name: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  metaTxt: { fontSize: 12, color: "#64748B", marginTop: 2 },
  setTxt: { fontSize: 11, color: "#1B3B6F", fontWeight: "700", marginTop: 4 },
  deactPill: { backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  deactPillTxt: { fontSize: 10, fontWeight: "800", color: "#64748B" },
  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyText: { color: "#64748B", textAlign: "center", fontSize: 13 },
  blockedBox: { marginHorizontal: 20, marginTop: 16, padding: 20, backgroundColor: "#FEF2F2", borderRadius: 14, borderWidth: 1, borderColor: "#FECACA", alignItems: "center", gap: 8 },
  blockedTitle: { fontSize: 16, fontWeight: "800", color: "#991B1B" },
  blockedText: { textAlign: "center", color: "#7F1D1D", lineHeight: 20 },
});
