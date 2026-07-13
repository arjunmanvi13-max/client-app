import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { api, useAuth, userHasPermission } from "../../../src/auth";
import { Permission } from "../../../src/rbac";
import {
  CATALOG_BY_CODE,
  designationLabel,
  entityScopeLabel,
  isApprovedLoginUserType,
} from "../../../src/userClassification";

export default function ManageList() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const catalog = kind && isApprovedLoginUserType(kind) ? CATALOG_BY_CODE[kind] : null;
  const isSuper = userHasPermission(user, Permission.MANAGE_ACCESS);

  useEffect(() => {
    if (!isSuper) router.replace("/manage");
  }, [isSuper, router]);

  const load = useCallback(async () => {
    if (!catalog || !isSuper) return;
    setLoading(true);
    try {
      const { data } = await api.get("/users", { params: { user_type: kind } });
      let rows = data;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        rows = rows.filter((u: any) =>
          (u.name || "").toLowerCase().includes(q)
          || (u.email || "").toLowerCase().includes(q)
          || (u.mobile || "").includes(q),
        );
      }
      setItems(rows);
    } finally { setLoading(false); }
  }, [catalog, kind, isSuper, search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!catalog) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.empty}>
          <Text style={s.emptyText}>Unknown user type.</Text>
          <TouchableOpacity onPress={() => router.replace("/manage")}>
            <Text style={{ color: "#1E40AF", fontWeight: "700" }}>Back to Manage</Text>
          </TouchableOpacity>
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
        {kind !== "super_admin" && (
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
        {loading ? <ActivityIndicator color={catalog.tint} style={{ marginTop: 24 }} /> :
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
              <Text style={s.avatarTxt}>{it.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</Text>
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
  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyText: { color: "#64748B", textAlign: "center", fontSize: 13 },
});
