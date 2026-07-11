import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { api, ROLE_COLORS, useAuth } from "../../../src/auth";

const META: Record<string, { label: string; tint: string; isUser: boolean; subtitle: (x: any) => string }> = {
  admin: { label: "Sports Admins", tint: "#7C3AED", isUser: true, subtitle: (u) => `${u.email || u.mobile || ""} · ${u.organization || "ALPHA"}` },
  coach: { label: "Coaches", tint: "#EA580C", isUser: true, subtitle: (u) => `${u.email} · ${u.department || u.organization}` },
  teacher: { label: "Teachers", tint: "#1E40AF", isUser: true, subtitle: (u) => `${u.email} · ${u.department || u.organization}` },
  player: { label: "Players", tint: "#16A34A", isUser: false, subtitle: (p) => `${p.group || ""}${p.sport ? " · " + p.sport : ""}${p.centre ? " · " + p.centre : ""}` },
  student: { label: "Students", tint: "#2563EB", isUser: false, subtitle: (p) => `${p.group || ""} · ${p.organization}` },
  staff: { label: "Staff", tint: "#0EA5E9", isUser: false, subtitle: (p) => `${p.group || "Staff"} · ${p.organization}${p.centre ? " · " + p.centre : ""}` },
};

export default function ManageList() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const BOARDING_TYPES = ["Daily", "Day Boarding", "Hostel", "Boarding"];
  const meta = META[kind || ""];
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isPlayer = kind === "player";
  const canAdd = (() => {
    if (isAdmin) return true;
    if (!meta || meta.isUser) return (user?.can_manage || []).includes(kind || "");
    if (kind === "student") return !!user?.permissions?.add_students;
    if (kind === "player") return !!user?.permissions?.add_players;
    return (user?.can_manage || []).includes(kind || "");
  })();

  const load = useCallback(async () => {
    if (!meta) return;
    setLoading(true);
    try {
      if (meta.isUser) {
        const { data } = await api.get("/users", { params: { role: kind } });
        setItems(data);
      } else {
        const params: any = { kind };
        if (isPlayer && showDeactivated) params.include_deactivated = true;
        const { data } = await api.get("/people", { params });
        setItems(data);
      }
    } finally { setLoading(false); }
  }, [kind, meta, isPlayer, showDeactivated]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!meta) return null;

  const visibleItems = isPlayer && typeFilter
    ? items.filter((it) => typeFilter === "Hostel"
        ? (it.player_type === "Hostel" || it.player_type === "Hostel Only")
        : it.player_type === typeFilter)
    : items;

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

      {isPlayer && isAdmin && (
        <View style={s.toggleRow}>
          <TouchableOpacity testID="toggle-active" style={[s.togglePill, !showDeactivated && s.togglePillActive]} onPress={() => setShowDeactivated(false)}>
            <Text style={[s.toggleTxt, !showDeactivated && s.toggleTxtActive]}>Active</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="toggle-deactivated" style={[s.togglePill, showDeactivated && s.togglePillActive]} onPress={() => setShowDeactivated(true)}>
            <Text style={[s.toggleTxt, showDeactivated && s.toggleTxtActive]}>All (incl. deactivated)</Text>
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
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={s.scroll}>
        {loading ? <ActivityIndicator color={meta.tint} style={{ marginTop: 24 }} /> :
         visibleItems.length === 0 ? (
           <View style={s.empty}>
             <Feather name="users" size={36} color="#94A3B8" />
             <Text style={s.emptyText}>
               {isPlayer && typeFilter
                 ? `No ${typeFilter} players${!showDeactivated ? " (active)" : ""}.`
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
                {isDeact && <View style={s.deactPill}><Text style={s.deactPillTxt}>Deactivated</Text></View>}
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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 16, paddingBottom: 4, gap: 8 },
  backBtn: { padding: 8 },
  h1: { fontSize: 24, fontWeight: "700", color: "#0F172A", letterSpacing: -0.5 },
  sub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  addText: { color: "#fff", fontWeight: "700" },
  scroll: { padding: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  name: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  metaTxt: { fontSize: 12, color: "#64748B", marginTop: 2 },
  permRow: { flexDirection: "row", gap: 4, marginTop: 6, flexWrap: "wrap" },
  permPill: { backgroundColor: "#DBEAFE", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  permTxt: { color: "#1E40AF", fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyText: { color: "#64748B", textAlign: "center" },
  toggleRow: { flexDirection: "row", paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8, gap: 8 },
  typeScroll: { flexGrow: 0 },
  typeRow: { flexDirection: "row", paddingHorizontal: 20, paddingBottom: 8, gap: 8 },
  togglePill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  togglePillActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  toggleTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  toggleTxtActive: { color: "#fff" },
  rowDeact: { opacity: 0.65, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  deactPill: { backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  deactPillTxt: { color: "#64748B", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
});
