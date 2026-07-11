import { useState, useCallback, useEffect, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, useAuth } from "../../../src/auth";
import { formatDateTime } from "../../../src/dateFormat";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  role_category?: string;
  organization?: string;
  coach_type?: string | null;
  department?: string | null;
  status?: string;
  mobile?: string | null;
};

type AuditEntry = {
  id: string;
  at: string;
  actor_name: string;
  target_name: string;
  template_applied?: string | null;
  changes: any;
};

export default function PermissionsList() {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"users" | "audit">("users");
  const [filter, setFilter] = useState<"all" | "PWS" | "ALPHA" | "BOTH">("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "deactivated">("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, a] = await Promise.all([
        api.get("/users"),
        api.get("/permissions/audit", { params: { limit: 10 } }),
      ]);
      setUsers(u.data);
      setAudit(a.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const roles = useMemo(
    () => Array.from(new Set(users.filter((u) => u.role !== "super_admin").map((u) => u.role))).sort(),
    [users]
  );

  if (!user) return null;
  if (user.role !== "super_admin") {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}><Text style={s.h1}>Permissions</Text></View>
        <View style={s.empty}>
          <Feather name="lock" size={40} color="#94A3B8" />
          <Text style={s.emptyTitle}>Super Admin only</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filtered = users.filter((u) => {
    if (u.role === "super_admin") return false; // hide self
    if (filter !== "all") {
      if (filter === "BOTH") { if (u.organization !== "BOTH") return false; }
      else if (u.organization !== filter && u.organization !== "BOTH") return false;
    }
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (statusFilter !== "all" && (u.status || "active") !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = [u.name, u.email, u.id, u.department, u.role, u.organization, u.mobile]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="perm-back">
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>SUPER ADMIN · ACCESS CONTROL</Text>
          <Text style={s.h1}>Permissions</Text>
        </View>
      </View>

      <View style={s.tabRow}>
        <TouchableOpacity testID="tab-users" style={[s.tab, tab === "users" && s.tabActive]} onPress={() => setTab("users")}>
          <Text style={[s.tabTxt, tab === "users" && s.tabTxtActive]}>Users</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="tab-audit" style={[s.tab, tab === "audit" && s.tabActive]} onPress={() => setTab("audit")}>
          <Text style={[s.tabTxt, tab === "audit" && s.tabTxtActive]}>Audit log</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F766E" />}>
        {tab === "users" && (
          <>
            <View style={s.searchWrap}>
              <Feather name="search" size={16} color="#94A3B8" />
              <TextInput
                testID="perm-search"
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, email, ID, designation, organization…"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                style={s.searchInput}
              />
              {search.length > 0 && (
                <TouchableOpacity testID="perm-search-clear" onPress={() => setSearch("")} hitSlop={10}>
                  <Feather name="x" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            <View style={s.filterRow}>
              {(["all", "PWS", "ALPHA", "BOTH"] as const).map((f) => (
                <TouchableOpacity key={f} testID={`filter-${f}`} style={[s.filterChip, filter === f && s.filterChipActive]} onPress={() => setFilter(f)}>
                  <Text style={[s.filterTxt, filter === f && s.filterTxtActive]}>{f === "all" ? "All orgs" : f}</Text>
                </TouchableOpacity>
              ))}
              {(["all", "active", "deactivated"] as const).map((st) => (
                <TouchableOpacity key={st} testID={`status-${st}`} style={[s.filterChip, statusFilter === st && { backgroundColor: st === "deactivated" ? "#DC2626" : "#047857", borderColor: st === "deactivated" ? "#DC2626" : "#047857" }]} onPress={() => setStatusFilter(st)}>
                  <Text style={[s.filterTxt, statusFilter === st && s.filterTxtActive]}>{st === "all" ? "Any status" : st === "active" ? "Active" : "Inactive"}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={s.roleRow}>
              <TouchableOpacity testID="role-all" style={[s.filterChip, roleFilter === "all" && s.filterChipActive]} onPress={() => setRoleFilter("all")}>
                <Text style={[s.filterTxt, roleFilter === "all" && s.filterTxtActive]}>All roles</Text>
              </TouchableOpacity>
              {roles.map((r) => (
                <TouchableOpacity key={r} testID={`role-${r}`} style={[s.filterChip, roleFilter === r && s.filterChipActive]} onPress={() => setRoleFilter(roleFilter === r ? "all" : r)}>
                  <Text style={[s.filterTxt, roleFilter === r && s.filterTxtActive]}>{r.replace("_", " ")}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={s.resultCount} testID="perm-result-count">{filtered.length} user{filtered.length !== 1 ? "s" : ""}</Text>
            {loading ? <ActivityIndicator color="#0F766E" style={{ marginTop: 32 }} /> :
             filtered.length === 0 ? <Text style={s.emptyText}>No users.</Text> :
             filtered.map((u) => (
               <TouchableOpacity
                 key={u.id}
                 testID={`perm-user-${u.id}`}
                 style={s.userRow}
                 onPress={() => router.push(`/admin/permissions/${u.id}`)}
               >
                 <View style={[s.avatar, { backgroundColor: u.role_category === "Admin" ? "#0F766E" : "#0EA5E9" }]}>
                   <Feather name={u.role_category === "Admin" ? "shield" : "user"} size={16} color="#fff" />
                 </View>
                 <View style={{ flex: 1 }}>
                   <Text style={s.userName}>{u.name}</Text>
                   <Text style={s.userMeta}>{u.email}{u.department ? ` · ${u.department}` : ""}</Text>
                   <View style={s.metaPills}>
                     <View style={s.pill}><Text style={s.pillTxt}>{u.role.replace("_", " ")}</Text></View>
                     <View style={s.pill}><Text style={s.pillTxt}>{u.organization}</Text></View>
                     {(u.status || "active") === "deactivated" && (
                       <View style={[s.pill, { backgroundColor: "#FEE2E2" }]}><Text style={[s.pillTxt, { color: "#DC2626" }]}>Inactive</Text></View>
                     )}
                     <View style={[s.pill, { backgroundColor: u.role_category === "Admin" ? "#0F766E1A" : "#0EA5E91A" }]}>
                       <Text style={[s.pillTxt, { color: u.role_category === "Admin" ? "#0F766E" : "#0EA5E9" }]}>{u.role_category}</Text>
                     </View>
                   </View>
                 </View>
                 <Feather name="chevron-right" size={18} color="#94A3B8" />
               </TouchableOpacity>
             ))
            }
          </>
        )}
        {tab === "audit" && (
          loading ? <ActivityIndicator color="#0F766E" style={{ marginTop: 32 }} /> :
          audit.length === 0 ? <Text style={s.emptyText}>No audit entries yet.</Text> :
          audit.map((a) => (
            <View key={a.id} style={s.auditRow}>
              <Feather name="clock" size={14} color="#64748B" />
              <View style={{ flex: 1 }}>
                <Text style={s.auditTitle}>
                  {a.actor_name} → {a.target_name}
                  {a.template_applied ? `  ·  template: ${a.template_applied}` : ""}
                </Text>
                <Text style={s.auditTime}>{formatDateTime(a.at)}</Text>
                {a.changes?.permissions && (
                  <View style={s.changeWrap}>
                    {Object.keys(a.changes.permissions).slice(0, 6).map((k) => (
                      <Text key={k} style={s.changeTxt}>
                        • {k}: {a.changes.permissions[k].from ? "ON" : "off"} → {a.changes.permissions[k].to ? "ON" : "off"}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  backBtn: { padding: 8 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#94A3B8" },
  h1: { fontSize: 22, fontWeight: "700", color: "#0F172A", marginTop: 2, letterSpacing: -0.5 },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  tabActive: { backgroundColor: "#0F766E", borderColor: "#0F766E" },
  tabTxt: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  tabTxtActive: { color: "#fff" },
  scroll: { padding: 20, paddingTop: 12 },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  roleRow: { flexDirection: "row", gap: 8, paddingBottom: 8 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A", padding: 0 },
  resultCount: { fontSize: 11, fontWeight: "700", color: "#94A3B8", marginBottom: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  filterChipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  filterTxt: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  filterTxtActive: { color: "#fff" },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  userName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  userMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  metaPills: { flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" },
  pill: { backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pillTxt: { fontSize: 10, fontWeight: "700", color: "#475569", textTransform: "capitalize" },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginTop: 8 },
  emptyText: { textAlign: "center", color: "#64748B", marginTop: 24 },
  auditRow: { flexDirection: "row", gap: 10, padding: 14, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  auditTitle: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  auditTime: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  changeWrap: { marginTop: 6, gap: 2 },
  changeTxt: { fontSize: 11, color: "#475569" },
});
