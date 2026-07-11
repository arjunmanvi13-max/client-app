import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "../../src/auth";
import { LoadingState, EmptyState, ErrorState, getApiError } from "../../src/ScreenStates";
import { useBreakpoint } from "../../src/useBreakpoint";

const SEV_TINT: Record<string, { bg: string; text: string; icon: any }> = {
  high: { bg: "#FEE2E2", text: "#B91C1C", icon: "alert-octagon" },
  medium: { bg: "#FEF3C7", text: "#B45309", icon: "alert-triangle" },
  low: { bg: "#E0F2FE", text: "#075985", icon: "info" },
};

export default function ParentNotifications() {
  const router = useRouter();
  const { horizontalPadding, contentMaxWidth } = useBreakpoint();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [stored, setStored] = useState<any[]>([]);
  const [computed, setComputed] = useState<any[]>([]);

  const load = useCallback(async () => {
    setError("");
    try {
      const { data } = await api.get("/parent/notifications");
      setStored(data.stored || []);
      setComputed(data.computed || []);
    } catch (e: any) {
      setError(getApiError(e, "Could not load notifications."));
      setStored([]);
      setComputed([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  const onRefresh = () => { setRefreshing(true); load(); };

  const markRead = async (id: string) => {
    try {
      await api.patch(`/parent/notifications/${id}/read`);
      await load();
    } catch { /* ignore */ }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.h1}>Notifications</Text>
      </View>
      {loading && !refreshing ? (
        <LoadingState message="Loading notifications…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <ScrollView contentContainerStyle={[s.scroll, { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: contentMaxWidth ? "center" : undefined, width: contentMaxWidth ? "100%" : undefined }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {computed.length === 0 && stored.length === 0 ? (
            <EmptyState icon="check-circle" title="No notifications" message="You're all caught up — no alerts right now." />
          ) : (
            <>
              {computed.map((a) => {
                const tint = SEV_TINT[a.severity] || SEV_TINT.low;
                return (
                  <View key={a.id} style={[s.card, { backgroundColor: tint.bg }]}>
                    <Feather name={tint.icon} size={18} color={tint.text} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[s.title, { color: tint.text }]}>{a.title}</Text>
                      <Text style={s.msg}>{a.message}</Text>
                    </View>
                  </View>
                );
              })}
              {stored.map((n) => (
                <TouchableOpacity key={n.id} style={[s.card, { backgroundColor: n.read ? "#F8FAFC" : "#fff" }]} onPress={() => !n.read && markRead(n.id)}>
                  <Feather name="bell" size={18} color="#475569" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={s.title}>{n.title}</Text>
                    <Text style={s.msg}>{n.message || n.body}</Text>
                    {!n.read ? <Text style={s.unread}>Tap to mark read</Text> : null}
                  </View>
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", padding: 16, gap: 8 },
  backBtn: { padding: 4 },
  h1: { fontSize: 20, fontWeight: "800", color: "#0F172A" },
  scroll: { padding: 16, paddingBottom: 40 },
  card: { flexDirection: "row", alignItems: "flex-start", padding: 14, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  title: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  msg: { fontSize: 12, color: "#475569", marginTop: 2 },
  unread: { fontSize: 10, color: "#0891B2", marginTop: 4, fontWeight: "600" },
  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyTxt: { color: "#64748B", fontWeight: "600" },
});
