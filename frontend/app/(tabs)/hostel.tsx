import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { api, useAuth } from "../../src/auth";
import { LoadingState, EmptyState, ErrorState, FormLabel, InlineFieldError, getApiError, confirmAction } from "../../src/ScreenStates";
import { formatDateTime } from "../../src/dateFormat";
import { useBreakpoint } from "../../src/useBreakpoint";

export default function Hostel() {
  const { user } = useAuth();
  const { horizontalPadding, contentMaxWidth } = useBreakpoint();
  const [tab, setTab] = useState<"overview" | "passes" | "rollcall">("overview");
  const [stats, setStats] = useState<any>(null);
  const [passes, setPasses] = useState<any[]>([]);
  const [residents, setResidents] = useState<any[]>([]);
  const [rollMarks, setRollMarks] = useState<Record<string, boolean>>({});
  const [session, setSession] = useState<"morning" | "evening">("morning");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rollErr, setRollErr] = useState("");
  const [passErr, setPassErr] = useState("");
  const [passFieldErr, setPassFieldErr] = useState<{ resident?: string; reason?: string }>({});
  const [rollSaved, setRollSaved] = useState("");

  const [modal, setModal] = useState(false);
  const [reason, setReason] = useState("");
  const [destination, setDestination] = useState("");
  const [residentId, setResidentId] = useState<string | null>(null);

  const scrollPad = { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: contentMaxWidth ? "center" as const : undefined, width: contentMaxWidth ? "100%" as const : undefined };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, p, r] = await Promise.all([
        api.get("/hostel/dashboard"),
        api.get("/hostel/gate-pass"),
        api.get("/people", { params: { resident: true } }),
      ]);
      setStats(s.data);
      setPasses(p.data);
      setResidents(r.data);
    } catch (e: any) {
      setError(getApiError(e, "Could not load hostel data."));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const decide = (id: string, decision: "approved" | "rejected") => {
    const label = decision === "approved" ? "Approve" : "Reject";
    confirmAction(
      `${label} gate pass?`,
      `This will ${decision === "approved" ? "approve" : "reject"} the resident's gate pass request.`,
      async () => {
        try {
          await api.post(`/hostel/gate-pass/${id}/decision`, { decision });
          await load();
        } catch (e: any) { Alert.alert("Error", getApiError(e, "Could not update gate pass.")); }
      },
      { confirmLabel: label, destructive: decision === "rejected" },
    );
  };

  const submitRollCall = async () => {
    const entries = Object.entries(rollMarks).map(([resident_id, present]) => ({ resident_id, present }));
    if (!entries.length) { setRollErr("Mark at least one resident as present or absent."); return; }
    setRollErr("");
    try {
      const today = new Date().toISOString().slice(0, 10);
      await api.post("/hostel/roll-call", { date: today, session, entries });
      setRollSaved(`Roll call saved for ${entries.length} resident(s).`);
      setRollMarks({});
    } catch (e: any) { setRollErr(getApiError(e, "Could not save roll call.")); }
  };

  const createPass = async () => {
    const errs: { resident?: string; reason?: string } = {};
    if (!residentId) errs.resident = "Select a resident.";
    if (!reason.trim()) errs.reason = "Enter a reason for the gate pass.";
    setPassFieldErr(errs);
    if (Object.keys(errs).length) return;
    setPassErr("");
    try {
      const out = new Date();
      const ret = new Date(out.getTime() + 4 * 60 * 60 * 1000);
      await api.post("/hostel/gate-pass", { resident_id: residentId, reason: reason.trim(), out_time: out.toISOString(), expected_return: ret.toISOString(), destination: destination.trim() || undefined });
      setModal(false); setReason(""); setDestination(""); setResidentId(null); setPassFieldErr({});
      await load();
    } catch (e: any) { setPassErr(getApiError(e, "Could not create gate pass.")); }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.h1}>Hostel</Text>
        <Text style={s.sub}>Warden console · {user?.organization}</Text>
      </View>

      <View style={s.tabsRow}>
        {[{ k: "overview", l: "Overview" }, { k: "passes", l: "Gate passes" }, { k: "rollcall", l: "Roll call" }].map((t) => (
          <TouchableOpacity key={t.k} testID={`tab-${t.k}`} style={[s.tab, tab === t.k && s.tabActive]} onPress={() => setTab(t.k as any)}>
            <Text style={[s.tabText, tab === t.k && { color: "#fff" }]}>{t.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <LoadingState message="Loading hostel…" />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : tab === "overview" && stats ? (
        <ScrollView contentContainerStyle={[s.scroll, scrollPad]}>
          <View style={s.statsRow}>
            <Stat label="Residents" value={stats.residents_count} icon="users" tint="#1E40AF" />
            <Stat label="Pending" value={stats.pending_passes} icon="clock" tint="#F59E0B" />
          </View>
          <View style={s.statsRow}>
            <Stat label="Morning P" value={stats.morning_present} icon="sun" tint="#10B981" />
            <Stat label="Evening P" value={stats.night_present} icon="moon" tint="#7C3AED" />
          </View>

          <Text style={s.section}>Pending gate passes</Text>
          {passes.filter((p) => p.status === "pending").length === 0 ? (
            <EmptyState icon="check-circle" title="No pending requests" message="All gate pass requests are processed." />
          ) : passes.filter((p) => p.status === "pending").map((p) => (
            <PassCard key={p.id} p={p} onDecide={decide} residents={residents} />
          ))}
        </ScrollView>
      ) : tab === "passes" ? (
        <ScrollView contentContainerStyle={[s.scroll, scrollPad]}>
          <TouchableOpacity testID="new-pass" style={s.newPass} onPress={() => setModal(true)}>
            <Feather name="plus-circle" size={18} color="#fff" />
            <Text style={s.newPassText}>New gate pass request</Text>
          </TouchableOpacity>
          {passes.length === 0 && <EmptyState icon="log-out" title="No gate passes yet" message="Create a new gate pass request for a resident." />}
          {passes.map((p) => <PassCard key={p.id} p={p} onDecide={decide} residents={residents} />)}
        </ScrollView>
      ) : tab === "rollcall" ? (
        <View style={{ flex: 1 }}>
          <View style={s.sessionRow}>
            {(["morning", "evening"] as const).map((sx) => (
              <TouchableOpacity key={sx} testID={`session-${sx}`} style={[s.sessChip, session === sx && s.sessActive]} onPress={() => setSession(sx)}>
                <Feather name={sx === "morning" ? "sun" : "moon"} size={14} color={session === sx ? "#fff" : "#475569"} />
                <Text style={[s.sessText, session === sx && { color: "#fff" }]}>{sx === "morning" ? "Morning" : "Evening roll call"}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView contentContainerStyle={[s.scroll, scrollPad]}>
            {residents.length === 0 ? (
              <EmptyState icon="users" title="No residents" message="Residents will appear here once added to the hostel." />
            ) : residents.map((r) => (
              <View key={r.id} style={s.rcRow}>
                <Text style={s.rcName}>{r.name}</Text>
                <Text style={s.rcMeta}>{r.group}</Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity testID={`rc-${r.id}-p`} style={[s.rcBtn, rollMarks[r.id] === true && { backgroundColor: "#10B981", borderColor: "#10B981" }]} onPress={() => setRollMarks({ ...rollMarks, [r.id]: true })}>
                    <Text style={[s.rcBtnTxt, rollMarks[r.id] === true && { color: "#fff" }]}>P</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID={`rc-${r.id}-a`} style={[s.rcBtn, rollMarks[r.id] === false && { backgroundColor: "#EF4444", borderColor: "#EF4444" }]} onPress={() => setRollMarks({ ...rollMarks, [r.id]: false })}>
                    <Text style={[s.rcBtnTxt, rollMarks[r.id] === false && { color: "#fff" }]}>A</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <View style={{ height: 80 }} />
          </ScrollView>
          <View style={[s.bottomBar, { paddingHorizontal: horizontalPadding }]}>
            {rollSaved ? <Text style={s.successMsg}>{rollSaved}</Text> : null}
            {rollErr ? <Text style={s.formErr}>{rollErr}</Text> : null}
            <TouchableOpacity testID="save-rollcall" style={s.saveBtn} onPress={submitRollCall}>
              <Text style={s.saveTxt}>Save roll call ({Object.keys(rollMarks).length})</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <Modal transparent visible={modal} animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={s.modalBg}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>New gate pass</Text>
            {passErr ? <Text style={s.formErr}>{passErr}</Text> : null}
            <FormLabel required>Resident</FormLabel>
            <ScrollView style={{ maxHeight: 140 }}>
              {residents.map((r) => (
                <TouchableOpacity key={r.id} testID={`res-${r.id}`} style={[s.resOpt, residentId === r.id && { backgroundColor: "#DBEAFE", borderColor: "#1E40AF" }, passFieldErr.resident && !residentId && s.inputErr]} onPress={() => { setResidentId(r.id); setPassFieldErr((p) => ({ ...p, resident: undefined })); }}>
                  <Text style={[s.resText, residentId === r.id && { color: "#1E40AF", fontWeight: "700" }]}>{r.name} · {r.group}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <InlineFieldError message={passFieldErr.resident} />
            <FormLabel required>Reason</FormLabel>
            <TextInput testID="pass-reason" value={reason} onChangeText={(t) => { setReason(t); setPassFieldErr((p) => ({ ...p, reason: undefined })); }} placeholder="Doctor visit" placeholderTextColor="#94A3B8" style={[s.input, passFieldErr.reason && s.inputErr]} />
            <InlineFieldError message={passFieldErr.reason} />
            <Text style={s.label}>Destination</Text>
            <TextInput testID="pass-dest" value={destination} onChangeText={setDestination} placeholder="City hospital" placeholderTextColor="#94A3B8" style={s.input} />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: "#F1F5F9" }]} onPress={() => setModal(false)}>
                <Text style={{ color: "#0F172A", fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="pass-submit" style={[s.modalBtn, { backgroundColor: "#1E40AF" }]} onPress={createPass}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value, icon, tint }: any) {
  return (
    <View style={s.stat}>
      <View style={[s.statIcon, { backgroundColor: tint + "1A" }]}>
        <Feather name={icon} size={18} color={tint} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function PassCard({ p, onDecide, residents }: any) {
  const r = residents.find((x: any) => x.id === p.resident_id);
  const color = p.status === "approved" ? "#10B981" : p.status === "rejected" ? "#EF4444" : "#F59E0B";
  return (
    <View style={s.passCard} testID={`pass-${p.id}`}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={s.passName}>{r?.name || "Resident"}</Text>
        <View style={[s.statusPill, { backgroundColor: color + "1A" }]}>
          <Text style={[s.statusText, { color }]}>{p.status.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={s.passReason}>{p.reason}</Text>
      {p.destination && <Text style={s.passMeta}>To: {p.destination}</Text>}
      <Text style={s.passMeta}>Out: {formatDateTime(p.out_time)}</Text>
      {p.status === "pending" && (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <TouchableOpacity testID={`approve-${p.id}`} style={[s.actBtn, { backgroundColor: "#10B981" }]} onPress={() => onDecide(p.id, "approved")}>
            <Feather name="check" size={14} color="#fff" />
            <Text style={s.actTxt}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity testID={`reject-${p.id}`} style={[s.actBtn, { backgroundColor: "#EF4444" }]} onPress={() => onDecide(p.id, "rejected")}>
            <Feather name="x" size={14} color="#fff" />
            <Text style={s.actTxt}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  h1: { fontSize: 28, fontWeight: "700", color: "#0F172A", letterSpacing: -0.5 },
  sub: { fontSize: 13, color: "#64748B", marginTop: 4 },
  tabsRow: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 14, gap: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  tabActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  tabText: { fontSize: 13, fontWeight: "700", color: "#475569" },
  scroll: { padding: 20, paddingTop: 0, paddingBottom: 100 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: "#fff", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  statIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  statLabel: { fontSize: 11, color: "#64748B", marginTop: 2 },
  section: { fontSize: 15, fontWeight: "700", color: "#0F172A", marginTop: 24, marginBottom: 12 },
  empty: { color: "#64748B", textAlign: "center", padding: 16 },
  formErr: { fontSize: 13, color: "#B91C1C", fontWeight: "600", marginBottom: 8, textAlign: "center" },
  successMsg: { fontSize: 13, color: "#15803D", fontWeight: "600", marginBottom: 8, textAlign: "center" },
  inputErr: { borderColor: "#EF4444", backgroundColor: "#FEF2F2" },
  passCard: { backgroundColor: "#fff", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 10 },
  passName: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  passReason: { fontSize: 13, color: "#475569", marginTop: 2 },
  passMeta: { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 9, fontWeight: "800" },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10 },
  actTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  newPass: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#1E40AF", paddingVertical: 14, borderRadius: 14, marginBottom: 16 },
  newPassText: { color: "#fff", fontWeight: "700" },
  sessionRow: { flexDirection: "row", paddingHorizontal: 20, gap: 8, marginBottom: 8 },
  sessChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, padding: 10, borderRadius: 10, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  sessActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  sessText: { fontWeight: "700", color: "#475569", fontSize: 13 },
  rcRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  rcName: { flex: 1, fontSize: 14, fontWeight: "700", color: "#0F172A" },
  rcMeta: { fontSize: 12, color: "#64748B", marginRight: 8 },
  rcBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 8, borderWidth: 1.5, borderColor: "#E2E8F0" },
  rcBtnTxt: { fontWeight: "800", color: "#475569" },
  bottomBar: { position: "absolute", bottom: 78, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 8 },
  saveBtn: { backgroundColor: "#1E40AF", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  saveTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modal: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#0F172A", marginBottom: 16 },
  label: { fontSize: 12, fontWeight: "700", color: "#475569", marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 12, fontSize: 14, color: "#0F172A" },
  modalBtn: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 12 },
  resOpt: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 4 },
  resText: { color: "#475569", fontSize: 13 },
});
