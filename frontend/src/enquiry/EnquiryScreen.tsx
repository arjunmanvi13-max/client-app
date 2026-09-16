import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform, RefreshControl, Linking, TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../auth";
import { isSuperAdminUser } from "../rbac";
import { LoadingState, EmptyState, ErrorState, getApiError } from "../ScreenStates";
import { useBreakpoint } from "../useBreakpoint";
import { colors, radii, spacing } from "../theme";
import { formatDate } from "../dateFormat";
import { EnquiryFormModal } from "./EnquiryFormModal";
import {
  assignEnquiry, completeEnquiryAssignment, convertEnquiry, createEnquiry,
  fetchEnquiries, fetchEnquiryOptions, markEnquiryFollowUp, requestEnquiryClose, updateEnquiry,
} from "./api";
import { ENQUIRY_SOURCES, ENQUIRY_STATUSES, statusTone, type Enquiry, type EnquiryPayload, type EnquiryStaff } from "./types";

function canAccess(user: { role?: string } | null | undefined) {
  if (!user) return false;
  if (isSuperAdminUser(user)) return true;
  const role = (user.role || "").toLowerCase();
  return ["admin", "alpha_admin", "alpha_accounts", "pws_admin", "pws_accounts", "principal", "vice_principal", "staff"].includes(role);
}

function waLink(phone: string) {
  const d = phone.replace(/\D/g, "");
  const n = d.length === 10 ? `91${d}` : d;
  return `https://wa.me/${n}`;
}

export function EnquiryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { isDesktop, horizontalPadding } = useBreakpoint();
  const allowed = canAccess(user);
  const [rows, setRows] = useState<Enquiry[]>([]);
  const [staff, setStaff] = useState<EnquiryStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [institution, setInstitution] = useState("");
  const [status, setStatus] = useState("");
  const [source, setSource] = useState("");
  const [assigned, setAssigned] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Enquiry | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionFor, setActionFor] = useState<Enquiry | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [mode, setMode] = useState<"assign" | "complete" | "close" | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const [list, opts] = await Promise.all([
        fetchEnquiries({
          q: q.trim() || undefined,
          institution: institution || undefined,
          status: status || undefined,
          source: source || undefined,
          assigned_to_id: assigned || undefined,
        }),
        fetchEnquiryOptions().catch(() => ({ staff: [] })),
      ]);
      setRows(list);
      setStaff(opts.staff || []);
    } catch (e) {
      setError(getApiError(e, "Could not load enquiries."));
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [q, institution, status, source, assigned]);

  useFocusEffect(useCallback(() => {
    if (!allowed) return;
    setLoading(true);
    load();
  }, [allowed, load]));

  const submit = async (payload: EnquiryPayload) => {
    setSaving(true);
    try {
      if (editing) await updateEnquiry(editing.id, payload);
      else await createEnquiry(payload);
      setModal(false);
      setEditing(null);
      await load();
    } catch (e) {
      Alert.alert("Could not save", getApiError(e, "Failed to save enquiry."));
    } finally {
      setSaving(false);
    }
  };

  const runAssign = async () => {
    if (!actionFor) return;
    if (!assigneeId) return Alert.alert("Select a person", "Choose who should take the next step.");
    if (actionNote.trim().length < 3) return Alert.alert("Action note required", "Add what they should do, e.g. call the parent.");
    try {
      await assignEnquiry(actionFor.id, assigneeId, actionNote.trim());
      setMode(null); setActionFor(null); setActionNote("");
      await load();
    } catch (e) {
      Alert.alert("Could not assign", getApiError(e));
    }
  };

  const runComplete = async () => {
    if (!actionFor) return;
    if (actionNote.trim().length < 3) return Alert.alert("Remarks required", "Describe what was done before returning this to the office.");
    try {
      await completeEnquiryAssignment(actionFor.id, actionNote.trim());
      setMode(null); setActionFor(null); setActionNote("");
      await load();
    } catch (e) {
      Alert.alert("Could not complete", getApiError(e));
    }
  };

  const runClose = async () => {
    if (!actionFor) return;
    if (closeReason.trim().length < 3) return Alert.alert("Reason required", "Closing a lead needs Principal or Super Admin approval.");
    try {
      await requestEnquiryClose(actionFor.id, closeReason.trim());
      setMode(null); setActionFor(null); setCloseReason("");
      Alert.alert("Sent for approval", "Principal or Super Admin must approve closing this lead.");
      await load();
    } catch (e) {
      Alert.alert("Could not request close", getApiError(e));
    }
  };

  const runConvert = (row: Enquiry) => {
    Alert.alert("Convert to admission?", "This will create a directory record so remaining fees can be added.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Convert",
        onPress: async () => {
          try {
            const res = await convertEnquiry(row.id);
            await load();
            router.push(`/manage/${res.directory_kind}/${res.person.id}`);
          } catch (e) {
            Alert.alert("Could not convert", getApiError(e));
          }
        },
      },
    ]);
  };

  if (!allowed) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.denied}>
          <Feather name="lock" size={28} color={colors.muted2} />
          <Text style={s.deniedTitle}>Enquiry is for the admissions team</Text>
          <Text style={s.deniedTxt}>Office, Admin, Accounts, Principal, and Super Admin can record and track enquiries.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingHorizontal: horizontalPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={s.head}>
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>OPERATIONS & LOGISTICS</Text>
            <Text style={s.h1}>Enquiry</Text>
            <Text style={s.sub}>Track PWS and ALPHA admission leads from first call through follow-up.</Text>
          </View>
          <TouchableOpacity testID="add-enquiry" style={s.addBtn} onPress={() => { setEditing(null); setModal(true); }}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={s.addTxt}>Add Enquiry</Text>
          </TouchableOpacity>
        </View>

        <View style={s.filters}>
          <TextInput style={s.search} placeholder="Search name, mobile, ID…" value={q} onChangeText={setQ} onSubmitEditing={load} />
          <FilterChip label={institution || "Institution"} onPress={() => setInstitution(institution === "PWS" ? "ALPHA" : institution === "ALPHA" ? "" : "PWS")} />
          <FilterChip label={status || "Status"} onPress={() => {
            const i = ENQUIRY_STATUSES.indexOf(status as never);
            setStatus(i < 0 ? ENQUIRY_STATUSES[0] : (ENQUIRY_STATUSES[i + 1] || ""));
          }} />
          <FilterChip label={source || "Source"} onPress={() => {
            const i = ENQUIRY_SOURCES.indexOf(source as never);
            setSource(i < 0 ? ENQUIRY_SOURCES[0] : (ENQUIRY_SOURCES[i + 1] || ""));
          }} />
          <TouchableOpacity style={s.apply} onPress={load}><Text style={s.applyTxt}>Apply</Text></TouchableOpacity>
        </View>

        {loading && !refreshing ? <LoadingState message="Loading enquiries…" /> : error ? <ErrorState message={error} onRetry={load} /> : rows.length === 0 ? (
          <EmptyState title="No enquiries yet" message="Add an enquiry from a phone call, walk-in, WhatsApp, website, or referral." />
        ) : (
          <View style={s.table}>
            {isDesktop ? (
              <View style={s.thead}>
                {["ID", "Date", "Inst.", "Student", "Parent", "Mobile", "Applying for", "Source", "Status", "Assigned", "Follow-up", ""].map((h) => (
                  <Text key={h || "a"} style={s.th}>{h}</Text>
                ))}
              </View>
            ) : null}
            {rows.map((row) => {
              const tone = statusTone(row.status);
              return (
                <View key={row.id} style={[s.trow, row.follow_up_overdue && s.overdue]} testID={`enquiry-row-${row.enquiry_code}`}>
                  <Text style={s.tdStrong}>{row.enquiry_code}</Text>
                  <Text style={s.td}>{formatDate((row.enquiry_at || "").slice(0, 10))}</Text>
                  <Text style={s.td}>{row.institution}</Text>
                  <Text style={s.tdStrong}>{row.student_name}</Text>
                  <Text style={s.td}>{row.parent_name}</Text>
                  <Text style={s.td}>{row.mobile}</Text>
                  <Text style={s.td}>{row.applying_for}</Text>
                  <Text style={s.td}>{row.source}</Text>
                  <View style={[s.badge, { backgroundColor: tone.bg }]}><Text style={[s.badgeTxt, { color: tone.fg }]}>{row.status}</Text></View>
                  <Text style={s.td}>{row.assigned_to_name || "Office"}</Text>
                  <Text style={[s.td, row.follow_up_overdue && { color: "#B91C1C", fontWeight: "800" }]}>
                    {row.next_follow_up_at ? formatDate(row.next_follow_up_at.slice(0, 10)) : "—"}
                  </Text>
                  <View style={s.actions}>
                    <IconBtn icon="phone" onPress={() => Linking.openURL(`tel:${row.mobile}`)} />
                    <IconBtn icon="message-circle" onPress={() => Linking.openURL(waLink(row.mobile))} />
                    <IconBtn icon="edit-2" onPress={() => { setEditing(row); setModal(true); }} />
                    <IconBtn icon="check" onPress={async () => {
                      try { await markEnquiryFollowUp(row.id, {}); await load(); }
                      catch (e) { Alert.alert("Could not update", getApiError(e)); }
                    }} />
                    <IconBtn icon="user-plus" onPress={() => { setActionFor(row); setAssigneeId(row.assigned_to_id || ""); setActionNote(""); setMode("assign"); }} />
                    {user?.id === row.assigned_to_id ? (
                      <IconBtn icon="corner-up-left" onPress={() => { setActionFor(row); setActionNote(""); setMode("complete"); }} />
                    ) : null}
                    {row.status !== "Admitted" && row.status !== "Lost" ? (
                      <IconBtn icon="user-check" onPress={() => runConvert(row)} />
                    ) : null}
                    {row.status !== "Admitted" && row.status !== "Lost" && row.status !== "Pending Close" ? (
                      <IconBtn icon="x-circle" onPress={() => { setActionFor(row); setCloseReason(""); setMode("close"); }} />
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <EnquiryFormModal visible={modal} saving={saving} enquiry={editing} staff={staff} onClose={() => setModal(false)} onSubmit={submit} />

      {mode ? (
        <View style={s.sheetMask}>
          <View style={s.mini}>
            <Text style={s.miniTitle}>
              {mode === "assign" ? "Refer next step" : mode === "complete" ? "Return to office" : "Request close"}
            </Text>
            <Text style={s.miniSub}>{actionFor?.enquiry_code} · {actionFor?.student_name}</Text>
            {mode === "assign" ? (
              <>
                <Text style={s.miniLbl}>Assign to</Text>
                <ScrollView style={{ maxHeight: 140 }}>
                  {staff.map((u) => (
                    <TouchableOpacity key={u.id} onPress={() => setAssigneeId(u.id)} style={[s.staffHit, assigneeId === u.id && s.staffHitOn]}>
                      <Text style={s.staffName}>{u.name}</Text>
                      <Text style={s.staffMeta}>{u.role}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TextInput style={s.note} placeholder="Action point (mandatory) e.g. Call the parent about fees" value={actionNote} onChangeText={setActionNote} multiline />
              </>
            ) : null}
            {mode === "complete" ? (
              <TextInput style={s.note} placeholder="What was done? (mandatory)" value={actionNote} onChangeText={setActionNote} multiline />
            ) : null}
            {mode === "close" ? (
              <TextInput style={s.note} placeholder="Why should this lead be closed?" value={closeReason} onChangeText={setCloseReason} multiline />
            ) : null}
            <View style={s.miniBtns}>
              <TouchableOpacity onPress={() => setMode(null)} style={s.ghost}><Text style={s.ghostTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={mode === "assign" ? runAssign : mode === "complete" ? runComplete : runClose} style={s.addBtn}>
                <Text style={s.addTxt}>{mode === "close" ? "Send for approval" : "Save"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function FilterChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={s.chip}>
      <Text style={s.chipTxt}>{label}</Text>
    </TouchableOpacity>
  );
}

function IconBtn({ icon, onPress }: { icon: keyof typeof Feather.glyphMap; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={s.iconBtn}>
      <Feather name={icon} size={14} color={colors.primary} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingVertical: spacing.lg, paddingBottom: 48 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: spacing.lg },
  kicker: { fontSize: 10, fontWeight: "800", color: colors.accent, letterSpacing: 1 },
  h1: { fontSize: 28, fontWeight: "800", color: colors.ink, marginTop: 2 },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4, maxWidth: 520 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.lg },
  addTxt: { color: "#fff", fontWeight: "800" },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md, alignItems: "center" },
  search: { minWidth: 200, flexGrow: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 8 },
  chipTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  apply: { backgroundColor: colors.primary, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 8 },
  applyTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
  table: { backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  thead: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12, backgroundColor: colors.surface2, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  th: { width: 90, fontSize: 10, fontWeight: "800", color: colors.muted2, textTransform: "uppercase" },
  trow: { padding: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSoft, gap: 6, ...Platform.select({ web: { display: "grid", gridTemplateColumns: "repeat(12, minmax(72px, 1fr))" } as object, default: {} }) },
  overdue: { backgroundColor: "#FEF2F2" },
  td: { fontSize: 12, color: colors.muted, marginRight: 8 },
  tdStrong: { fontSize: 12, fontWeight: "800", color: colors.ink, marginRight: 8 },
  badge: { alignSelf: "flex-start", borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 11, fontWeight: "800" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  iconBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  denied: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8 },
  deniedTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  deniedTxt: { fontSize: 13, color: colors.muted, textAlign: "center" },
  sheetMask: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "center", padding: 20 },
  mini: { backgroundColor: colors.surface, borderRadius: radii.xl, padding: 16, maxWidth: 480, width: "100%", alignSelf: "center" },
  miniTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  miniSub: { fontSize: 12, color: colors.muted, marginBottom: 12 },
  miniLbl: { fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 6 },
  staffHit: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  staffHitOn: { backgroundColor: colors.accentSoft },
  staffName: { fontSize: 13, fontWeight: "700", color: colors.ink },
  staffMeta: { fontSize: 11, color: colors.muted2 },
  note: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, minHeight: 72, padding: 10, marginTop: 10, textAlignVertical: "top" },
  miniBtns: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 12 },
  ghost: { paddingHorizontal: 12, paddingVertical: 10 },
  ghostTxt: { fontWeight: "700", color: colors.muted },
});
