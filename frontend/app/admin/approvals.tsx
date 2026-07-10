import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Alert, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, useAuth } from "../../src/auth";

type Req = {
  id: string; player_id: string; player_name: string;
  centre?: string; sport?: string; category?: string;
  reason?: string; status: "pending" | "approved" | "rejected";
  requested_by_name: string; requested_at: string;
  decided_by_name?: string; decided_at?: string; decision_note?: string;
};

export default function Approvals() {
  const router = useRouter();
  const { user } = useAuth();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [decision, setDecision] = useState<{ req: Req; action: "approve" | "reject" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const allowed = user && (user.permissions?.approve_deactivation || user.role === "super_admin" || user.role === "admin");

  const load = useCallback(async () => {
    if (!allowed) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await api.get("/deactivation-requests");
      setReqs(data);
    } catch {} finally { setLoading(false); }
  }, [allowed]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!user) return null;
  if (!allowed) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}><Text style={s.h1}>Approvals</Text></View>
        <View style={s.empty}><Feather name="lock" size={40} color="#94A3B8" /><Text style={s.emptyTitle}>Not allowed</Text></View>
      </SafeAreaView>
    );
  }

  const filtered = reqs.filter((r) => r.status === tab);
  const canDecide = !!user.permissions?.approve_deactivation || user.role === "super_admin";

  const submitDecision = async () => {
    if (!decision) return;
    setBusy(true);
    try {
      await api.post(`/deactivation-requests/${decision.req.id}/${decision.action}`, { note: note || undefined });
      setDecision(null); setNote("");
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="appr-back"><Feather name="chevron-left" size={22} color="#0F172A" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>APPROVALS</Text>
          <Text style={s.h1}>Deactivation Requests</Text>
        </View>
      </View>

      <View style={s.tabRow}>
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <TouchableOpacity key={t} testID={`appr-tab-${t}`} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? <ActivityIndicator color="#1E40AF" style={{ marginTop: 32 }} /> :
         filtered.length === 0 ? <Text style={s.emptyTextRow}>No {tab} requests.</Text> :
         filtered.map((r) => (
           <View key={r.id} testID={`appr-${r.id}`} style={s.row}>
             <View style={[s.dot, { backgroundColor: r.status === "pending" ? "#D97706" : r.status === "approved" ? "#16A34A" : "#EF4444" }]}>
               <Feather name={r.status === "pending" ? "clock" : r.status === "approved" ? "check" : "x"} size={14} color="#fff" />
             </View>
             <View style={{ flex: 1 }}>
               <Text style={s.name}>{r.player_name}</Text>
               <Text style={s.meta}>{r.centre || "—"} · {r.sport || "—"} · {r.category || "—"}</Text>
               <Text style={s.who}>Requested by {r.requested_by_name} · {new Date(r.requested_at).toLocaleString()}</Text>
               {r.reason && <Text style={s.reason}>Reason: {r.reason}</Text>}
               {r.decided_by_name && <Text style={s.who}>{r.status === "approved" ? "Approved" : "Rejected"} by {r.decided_by_name}{r.decided_at ? ` · ${new Date(r.decided_at).toLocaleString()}` : ""}{r.decision_note ? ` · “${r.decision_note}”` : ""}</Text>}
             </View>
             {tab === "pending" && canDecide && (
               <View style={{ gap: 6 }}>
                 <TouchableOpacity testID={`appr-approve-${r.id}`} style={s.approve} onPress={() => { setDecision({ req: r, action: "approve" }); setNote(""); }}><Text style={s.approveTxt}>Approve</Text></TouchableOpacity>
                 <TouchableOpacity testID={`appr-reject-${r.id}`} style={s.reject} onPress={() => { setDecision({ req: r, action: "reject" }); setNote(""); }}><Text style={s.rejectTxt}>Reject</Text></TouchableOpacity>
               </View>
             )}
           </View>
         ))}
      </ScrollView>

      <Modal transparent animationType="slide" visible={!!decision} onRequestClose={() => setDecision(null)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{decision?.action === "approve" ? "Approve deactivation" : "Reject deactivation"}</Text>
            <Text style={s.modalSub}>{decision?.req.player_name}</Text>
            <TextInput placeholder="Optional note" placeholderTextColor="#94A3B8" value={note} onChangeText={setNote} style={s.input} testID="appr-note" multiline />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setDecision(null)} testID="appr-modal-cancel"><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, busy && { opacity: 0.6 }, decision?.action === "reject" && { backgroundColor: "#EF4444" }]} disabled={busy} onPress={submitDecision} testID="appr-modal-confirm">
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>Confirm {decision?.action}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  backBtn: { padding: 8 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#94A3B8" },
  h1: { fontSize: 22, fontWeight: "700", color: "#0F172A", marginTop: 2 },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  tabActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  tabTxt: { fontSize: 12, fontWeight: "700", color: "#64748B", textTransform: "capitalize" },
  tabTxtActive: { color: "#fff" },
  scroll: { padding: 20, paddingTop: 12 },
  row: { flexDirection: "row", gap: 10, padding: 14, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  dot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  meta: { fontSize: 12, color: "#475569", marginTop: 2 },
  who: { fontSize: 11, color: "#94A3B8", marginTop: 4 },
  reason: { fontSize: 12, color: "#0F172A", marginTop: 4, fontStyle: "italic" },
  approve: { backgroundColor: "#16A34A", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  approveTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  reject: { backgroundColor: "#FEE2E2", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  rejectTxt: { color: "#EF4444", fontSize: 11, fontWeight: "800" },
  emptyTextRow: { textAlign: "center", color: "#94A3B8", marginTop: 24 },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginTop: 8 },
  modalBg: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  modalCard: { padding: 20, paddingBottom: 28, backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  modalSub: { fontSize: 12, color: "#64748B", marginTop: 4 },
  input: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 12, marginTop: 12, fontSize: 14, minHeight: 60 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  cancelTxt: { fontSize: 14, fontWeight: "700", color: "#475569" },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#16A34A", alignItems: "center" },
  saveTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
