import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../src/auth";
import { LoadingState, EmptyState, ErrorState, getApiError } from "../src/ScreenStates";
import { formatDateTime } from "../src/dateFormat";
import { useBreakpoint } from "../src/useBreakpoint";

const TYPE_ICONS: Record<string, string> = {
  attendance_marked: "check-circle",
  absence: "alert-circle",
  invoice_issued: "file-text",
  invoice_overdue: "alert-triangle",
  report_card_published: "book-open",
  task_assigned: "clipboard",
  approval_requested: "shield",
  approval_completed: "check-square",
};

export default function Notifications() {
  const router = useRouter();
  const { horizontalPadding } = useBreakpoint();
  const [items, setItems] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const { data } = await api.get("/notifications");
      const list = Array.isArray(data) ? data : (data.items || []);
      setItems(list);
      setUnreadCount(data.unread_count ?? list.filter((n: any) => !n.read).length);
    } catch (e: any) {
      setError(getApiError(e, "Could not load notifications."));
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const markRead = async (id: string) => {
    await api.post(`/notifications/${id}/read`);
    load();
  };

  const markAllRead = async () => {
    await api.post("/notifications/read-all");
    load();
  };

  const openLinked = (n: any) => {
    if (!n.read) markRead(n.id);
    const ref = n.ref_id;
    if (!ref) return;
    if (n.ref_type === "task" || n.type === "task_assigned") router.push(`/task/${ref}` as any);
    else if (n.ref_type === "invoice" || n.type?.startsWith("invoice")) router.push(`/admin/invoices/${ref}` as any);
    else if (n.ref_type === "report_card") router.push(`/report-cards/${ref}` as any);
    else if (n.ref_type === "approval") router.push("/admin/approvals" as any);
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityLabel="Go back">
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Notifications</Text>
          {unreadCount > 0 && <Text style={s.unreadBadge}>{unreadCount} unread</Text>}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} style={s.markAllBtn}>
            <Text style={s.markAllTxt}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingHorizontal: horizontalPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
      >
        {loading ? (
          <LoadingState message="Loading notifications…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState icon="bell-off" title="No notifications" message="You're all caught up. New alerts will appear here." />
        ) : (
          items.map((n) => (
            <TouchableOpacity key={n.id} style={[s.card, !n.read && s.unread]} onPress={() => openLinked(n)}>
              <View style={[s.iconBox, { backgroundColor: n.read ? "#F1F5F9" : "#DBEAFE" }]}>
                <Feather name={(TYPE_ICONS[n.type] || "bell") as any} size={18} color={n.read ? "#94A3B8" : "#1E40AF"} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.titleRow}>
                  <Text style={[s.title, !n.read && s.titleUnread]} numberOfLines={2}>{n.title}</Text>
                  {!n.read && <View style={s.dot} />}
                </View>
                <Text style={s.body} numberOfLines={3}>{n.message || n.body}</Text>
                <Text style={s.time}>{formatDateTime(n.created_at)}</Text>
              </View>
            </TouchableOpacity>
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
  unreadBadge: { fontSize: 12, color: "#1E40AF", fontWeight: "600", marginTop: 2 },
  markAllBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#EFF6FF", borderRadius: 8 },
  markAllTxt: { fontSize: 12, fontWeight: "700", color: "#1E40AF" },
  scroll: { paddingBottom: 40, paddingTop: 8 },
  card: { flexDirection: "row", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  unread: { borderColor: "#BFDBFE", backgroundColor: "#F8FAFF" },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  title: { flex: 1, fontSize: 14, fontWeight: "600", color: "#475569" },
  titleUnread: { fontWeight: "800", color: "#0F172A" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#1E40AF", marginTop: 4 },
  body: { fontSize: 13, color: "#64748B", marginTop: 4, lineHeight: 18 },
  time: { fontSize: 11, color: "#94A3B8", marginTop: 6 },
});
