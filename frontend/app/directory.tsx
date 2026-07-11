import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, ROLE_COLORS } from "../src/auth";
import { LoadingState, EmptyState, ErrorState, getApiError } from "../src/ScreenStates";
import { useBreakpoint } from "../src/useBreakpoint";

export default function Directory() {
  const router = useRouter();
  const { horizontalPadding, contentMaxWidth } = useBreakpoint();
  const [users, setUsers] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const { data } = await api.get("/users/directory");
      setUsers(data);
    } catch (e: any) {
      setError(getApiError(e, "Could not load directory."));
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const roles = useMemo(() => ["all", ...Array.from(new Set(users.map((u) => u.role)))], [users]);

  const filtered = useMemo(() => {
    let list = filter === "all" ? users : users.filter((u) => u.role === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((u) =>
        (u.name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.department || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [users, filter, search]);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityLabel="Go back">
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Directory</Text>
      </View>

      <View style={[s.searchWrap, { paddingHorizontal: horizontalPadding }]}>
        <Feather name="search" size={16} color="#94A3B8" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, email, department…"
          placeholderTextColor="#94A3B8"
          style={s.searchInput}
          testID="directory-search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={16} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.filterRow, { paddingHorizontal: horizontalPadding }]}>
        {roles.map((r) => (
          <TouchableOpacity key={r} style={[s.chip, filter === r && s.chipActive]} onPress={() => setFilter(r)}>
            <Text style={[s.chipText, filter === r && { color: "#fff" }]}>{r.replace("_", " ")}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: contentMaxWidth ? "center" : undefined, width: contentMaxWidth ? "100%" : undefined }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
      >
        {loading ? (
          <LoadingState message="Loading directory…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="users"
            title={search ? "No matches" : "No people found"}
            message={search ? "Try a different search term or clear filters." : "No users match the selected role filter."}
            actionLabel={search ? "Clear search" : undefined}
            onAction={search ? () => setSearch("") : undefined}
          />
        ) : (
          filtered.map((u) => (
            <View key={u.id} style={s.row}>
              <View style={[s.avatar, { backgroundColor: ROLE_COLORS[u.role] || "#94A3B8" }]}>
                <Text style={s.avatarTxt}>{u.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name} numberOfLines={1}>{u.name}</Text>
                <Text style={s.meta} numberOfLines={1}>{u.email}</Text>
                <Text style={s.meta} numberOfLines={1}>{u.role.replace("_", " ")} · {u.organization}{u.department ? ` · ${u.department}` : ""}</Text>
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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 8, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A", padding: 0 },
  filterRow: { paddingVertical: 8, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  chipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#475569", textTransform: "capitalize" },
  scroll: { paddingBottom: 40, paddingTop: 4 },
  row: { flexDirection: "row", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8, alignItems: "center" },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  name: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  meta: { fontSize: 12, color: "#64748B", marginTop: 2 },
});
