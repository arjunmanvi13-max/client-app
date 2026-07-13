import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { api, ROLE_COLORS, useAuth, userHasPermission } from "../../../src/auth";
import { BusinessEntity, Permission, UserRole, normalizeRole } from "../../../src/rbac";

const META: Record<string, { label: string; tint: string; isUser: boolean; subtitle: (x: any) => string }> = {
  admin: { label: "Sports Admins", tint: "#7C3AED", isUser: true, subtitle: (u) => `${u.email || u.mobile || ""} · ${u.organization || "ALPHA"}` },
  coach: { label: "Coaches", tint: "#EA580C", isUser: true, subtitle: (u) => `${u.email} · ${u.department || u.organization}` },
  teacher: { label: "Teachers", tint: "#1E40AF", isUser: true, subtitle: (u) => `${u.email} · ${u.department || u.organization}` },
  parent: { label: "Parents / Guardians", tint: "#0891B2", isUser: true, subtitle: (u) => `${u.email || u.mobile || ""} · ${u.organization || "PWS"}` },
  player: { label: "Players", tint: "#16A34A", isUser: false, subtitle: (p) => `${p.player_id || ""}${p.player_id ? " · " : ""}${p.group || ""}${p.sport ? " · " + p.sport : ""}${p.centre ? " · " + p.centre : ""}` },
  student: { label: "Students", tint: "#2563EB", isUser: false, subtitle: (p) => `${p.admission_number || ""}${p.admission_number ? " · " : ""}${p.group || ""}${p.roll_number ? " · Roll " + p.roll_number : ""}` },
  staff: { label: "Staff", tint: "#0EA5E9", isUser: false, subtitle: (p) => `${p.employee_id || ""}${p.employee_id ? " · " : ""}${p.group || p.department || "Staff"} · ${p.organization}${p.centre ? " · " + p.centre : ""}` },
};

export default function ManageList() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<string | null>(null);
  const [centreFilter, setCentreFilter] = useState<string | null>(null);
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);
  const BOARDING_TYPES = ["Daily", "Day Boarding", "Hostel", "Boarding"];
  const meta = META[kind || ""];
  const role = normalizeRole(user?.role || "");
  const isAdmin = userHasPermission(user, Permission.MANAGE_PLAYERS, BusinessEntity.ALPHA)
    || userHasPermission(user, Permission.ADD_PWS_STUDENTS, BusinessEntity.PWS)
    || userHasPermission(user, Permission.MANAGE_ACCESS);
  const isPlayer = kind === "player";
  const isStudent = kind === "student";
  const isTeacher = role === UserRole.PWS_TEACHER;
  const canAdd = (() => {
    if (isTeacher && kind === "student") return false;
    if (isAdmin) return true;
    if (!meta || meta.isUser) return (user?.can_manage || []).includes(kind || "");
    if (kind === "student") return userHasPermission(user, Permission.ADD_PWS_STUDENTS, BusinessEntity.PWS);
    if (kind === "player") return userHasPermission(user, Permission.MANAGE_PLAYERS, BusinessEntity.ALPHA);
    return (user?.can_manage || []).includes(kind || "");
  })();

  useEffect(() => {
    if (isStudent) {
      api.get("/academic/sections").then((r) => setSections(r.data || [])).catch(() => setSections([]));
    }
  }, [isStudent]);

  const load = useCallback(async () => {
    if (!meta) return;
    setLoading(true);
    try {
      if (meta.isUser) {
        const { data } = await api.get("/users", { params: { role: kind } });
        let rows = data;
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          rows = rows.filter((u: any) =>
            (u.name || "").toLowerCase().includes(q)
            || (u.email || "").toLowerCase().includes(q)
            || (u.mobile || "").includes(q)
          );
        }
        setItems(rows);
      } else {
        const params: any = { kind };
        if (search.trim()) params.q = search.trim();
        if (isPlayer && showDeactivated) params.include_deactivated = true;
        if (isPlayer && typeFilter) params.player_type = typeFilter === "Hostel" ? "Hostel Only" : typeFilter;
        if (isPlayer && centreFilter) params.centre = centreFilter;
        if (isStudent && sectionFilter) params.section_id = sectionFilter;
        const { data } = await api.get("/people", { params });
        setItems(data);
      }
    } finally { setLoading(false); }
  }, [kind, meta, isPlayer, isStudent, showDeactivated, search, typeFilter, sectionFilter, centreFilter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!meta) return null;

  const visibleItems = items;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="list-back">
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>{meta.label}</Text>
          <Text style={s.sub}>{visibleItems.length} record{visibleItems.length !== 1 ? "s" : ""}</Text>
        </View>
        <TouchableOpacity testID={`add-${kind}`} style={[s.addBtn, { backgroundColor: meta.tint }, !canAdd && { opacity: 0.45 }]} disabled={!canAdd} onPress={() => router.push(`/manage/${kind}/new`)}>
          <Feather name="plus" size={18} color="#fff" />
          <Text style={s.addText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchRow}>
        <Feather name="search" size={16} color="#94A3B8" />
        <TextInput
          testID="people-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, ID, phone…"
          placeholderTextColor="#94A3B8"
          style={s.searchInput}
          onSubmitEditing={load}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(""); }}>
            <Feather name="x" size={16} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {isPlayer && isAdmin && (
        <View style={s.toggleRow}>
          <TouchableOpacity testID="toggle-active" style={[s.togglePill, !showDeactivated && s.togglePillActive]} onPress={() => setShowDeactivated(false)}>
            <Text style={[s.toggleTxt, !showDeactivated && s.toggleTxtActive]}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="toggle-deactivated" style={[s.togglePill, showDeactivated && s.togglePillActive]} onPress={() => setShowDeactivated(true)}>
            <Text style={[s.toggleTxt, showDeactivated && s.toggleTxtActive]}>All (incl. inactive)</Text>
          </TouchableOpacity>
        </View>
      )}

      {isPlayer && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeScroll} contentContainerStyle={s.typeRow}>
          <TouchableOpacity testID="ptype-all" style={[s.togglePill, !typeFilter && s.togglePillActive]} onPress={() => setTypeFilter(null)}>
            <Text style={[s.toggleTxt, !typeFilter && s.toggleTxtActive]}>All Types</Text>
          </TouchableOpacity>
          {BOARDING_TYPES.map((t) => (
            <TouchableOpacity key={t} testID={`ptype-${t.toLowerCase().replace(/\s+/g, "-")}`} style={[s.togglePill, typeFilter === t && s.togglePillActive]} onPress={() => setTypeFilter(typeFilter === t ? null : t)}>
              <Text style={[s.toggleTxt, typeFilter === t && s.toggleTxtActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
          {["Balua", "Harding Park"].map((c) => (
            <TouchableOpacity key={c} testID={`centre-${c}`} style={[s.togglePill, centreFilter === c && s.togglePillActive]} onPress={() => setCentreFilter(centreFilter === c ? null : c)}>
              <Text style={[s.toggleTxt, centreFilter === c && s.toggleTxtActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {isStudent && sections.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.typeScroll} contentContainerStyle={s.typeRow}>
          <TouchableOpacity style={[s.togglePill, !sectionFilter && s.togglePillActive]} onPress={() => setSectionFilter(null)}>
            <Text style={[s.toggleTxt, !sectionFilter && s.toggleTxtActive]}>All Sections</Text>
          </TouchableOpacity>
          {sections.map((sec) => (
            <TouchableOpacity key={sec.id} style={[s.togglePill, sectionFilter === sec.id && s.togglePillActive]} onPress={() => setSectionFilter(sectionFilter === sec.id ? null : sec.id)}>
              <Text style={[s.toggleTxt, sectionFilter === sec.id && s.toggleTxtActive]}>{sec.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={s.scroll}>
        {loading ? <ActivityIndicator color={meta.tint} style={{ marginTop: 24 }} /> :
         visibleItems.length === 0 ? (
           <View style={s.empty}>
             <Feather name="users" size={36} color="#94A3B8" />
             <Text style={s.emptyText}>
               {search.trim()
                 ? `No matches for "${search.trim()}".`
                 : `No ${meta.label.toLowerCase()} yet. Tap Add to create one.`}
             </Text>
           </View>
         ) : visibleItems.map((it) => {
          const isDeact = it.status === "deactivated";
          return (
          <TouchableOpacity
            key={it.id}
            testID={`row-${it.id}`}
            style={[s.row, isDeact && s.rowDeact]}
            onPress={() => router.push(`/manage/${kind}/${it.id}`)}
          >
            <View style={[s.avatar, { backgroundColor: isDeact ? "#94A3B8" : (ROLE_COLORS[kind || ""] || meta.tint) }]}>
              <Text style={s.avatarTxt}>{it.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={s.name}>{it.name}</Text>
                {isDeact && <View style={s.deactPill}><Text style={s.deactPillTxt}>Inactive</Text></View>}
              </View>
              <Text style={s.metaTxt}>{meta.subtitle(it)}</Text>
              {meta.isUser && it.can_manage?.length > 0 && (
                <View style={s.permRow}>
                  {it.can_manage.map((p: string) => (
                    <View key={p} style={s.permPill}><Text style={s.permTxt}>{p}</Text></View>
                  ))}
                </View>
              )}
            </View>
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
  permRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  permPill: { backgroundColor: "#EEF2FF", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  permTxt: { fontSize: 10, fontWeight: "700", color: "#1E40AF" },
  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyText: { color: "#64748B", textAlign: "center", fontSize: 13 },
});
