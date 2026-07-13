import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Modal, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, useAuth, userHasPermission } from "../../src/auth";
import { BusinessEntity, Permission } from "../../src/rbac";
import { formatDate, formatMonth, DATE_PLACEHOLDER, toISODate, parseToISO, isValidDisplayDate } from "../../src/dateFormat";

type Fee = {
  id: string; player_id: string; player_name: string;
  centre: string; sport: string; category: string;
  fee_type: "Registration" | "Monthly" | "Transport" | "Uniform" | "Kit" | "Tournament" | "Books" | "Event" | "Other";
  amount: number; amount_due: number;
  period_month: string; due_date: string;
  status: "due" | "paid";
  payment_mode?: string; reference_id?: string; paid_at?: string;
};

const ADHOC_TYPES = ["Uniform", "Kit", "Tournament", "Books", "Event", "Other"] as const;
type AdhocType = typeof ADHOC_TYPES[number];

type PlayerLite = { id: string; name: string; centre?: string; sport?: string; player_type?: string };

const TABS = ["Main", "Upcoming", "Past Due", "History", "Installments"] as const;
type Tab = typeof TABS[number];

function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function inr(n?: number) { return `₹${(n ?? 0).toLocaleString("en-IN")}`; }

export default function FeesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [fees, setFees] = useState<Fee[]>([]);
  const [dash, setDash] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("Main");
  const [centre, setCentre] = useState<"all" | "Balua" | "Harding Park">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collectFee, setCollectFee] = useState<Fee | null>(null);
  const [editFee, setEditFee] = useState<Fee | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const allowed = userHasPermission(user, Permission.COLLECT_PWS_FEES, BusinessEntity.PWS)
    || userHasPermission(user, Permission.COLLECT_ALPHA_FEES, BusinessEntity.ALPHA);

  const load = useCallback(async () => {
    if (!allowed) { setLoading(false); return; }
    setLoading(true);
    try {
      const [f, d] = await Promise.all([
        api.get("/fees"),
        api.get("/fees/dashboard"),
      ]);
      setFees(f.data); setDash(d.data);
    } catch {} finally { setLoading(false); }
  }, [allowed]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (!user) return null;
  if (!allowed) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}><Text style={s.h1}>Fees</Text></View>
        <View style={s.empty}><Feather name="lock" size={40} color="#94A3B8" /><Text style={s.emptyTitle}>view_fees permission required</Text></View>
      </SafeAreaView>
    );
  }

  const thisMonth = monthKey(new Date());
  const filtered = fees.filter((f) => {
    if (centre !== "all" && f.centre !== centre) return false;
    if (tab === "Main")    return f.status === "due" && f.period_month === thisMonth;
    if (tab === "Upcoming")return f.status === "due" && f.period_month > thisMonth;
    if (tab === "Past Due")return f.status === "due" && f.period_month < thisMonth;
    if (tab === "History") return f.status === "paid";
    return false;
  });

  const canDiscount = userHasPermission(user, Permission.MANAGE_ACCESS);
  const canCollect = userHasPermission(user, Permission.COLLECT_PWS_FEES, BusinessEntity.PWS)
    || userHasPermission(user, Permission.COLLECT_ALPHA_FEES, BusinessEntity.ALPHA);
  const canCreateAdhoc = userHasPermission(user, Permission.MANAGE_ACCESS);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="fees-back"><Feather name="chevron-left" size={22} color="#0F172A" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>FEES · ALPHA</Text>
          <Text style={s.h1}>Collection</Text>
        </View>
        {canCreateAdhoc && (
          <TouchableOpacity testID="fees-add-adhoc" onPress={() => setShowAdd(true)} style={s.addBtn} activeOpacity={0.85}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={s.addBtnTxt}>Add Fee</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Centre filter */}
      <View style={s.centreRow}>
        {(["all", "Balua", "Harding Park"] as const).map((c) => (
          <TouchableOpacity key={c} testID={`fee-centre-${c}`} onPress={() => setCentre(c)} style={[s.cFilter, centre === c && s.cFilterActive]}>
            <Text style={[s.cFilterTxt, centre === c && { color: "#fff" }]}>{c === "all" ? "All centres" : c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Branch dashboard cards */}
      {dash && (
        <View style={s.dashRow}>
          {(centre === "all" ? ["Balua", "Harding Park"] : [centre]).map((c) => {
            const d = dash.by_centre?.[c] || {};
            return (
              <View key={c} style={s.dashCard}>
                <Text style={s.dashTitle}>{c}</Text>
                <Text style={s.dashLine}>Today: <Text style={{ color: "#16A34A" }}>{inr(d.collected_today)}</Text></Text>
                <Text style={s.dashLine}>Due (this month): <Text style={{ color: "#D97706" }}>{inr(d.due_current_month)}</Text></Text>
                <Text style={s.dashLine}>Past due: <Text style={{ color: "#EF4444" }}>{inr(d.due_past)}</Text></Text>
                <Text style={s.dashSub}>{d.players_with_dues || 0} players with dues</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Tabs */}
      <View style={s.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} testID={`fee-tab-${t}`} onPress={() => setTab(t)} style={[s.tab, tab === t && s.tabActive]}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {tab === "Installments" ? (
          <View style={s.empty}><Feather name="clock" size={36} color="#94A3B8" /><Text style={s.emptyTitle}>Coming soon</Text><Text style={s.emptyText}>Installment tracking will be added in a future update.</Text></View>
        ) : loading ? <ActivityIndicator color="#1E40AF" style={{ marginTop: 32 }} /> :
         filtered.length === 0 ? <Text style={s.emptyTextRow}>No fees in this view.</Text> :
         filtered.map((f) => (
           <View key={f.id} testID={`fee-row-${f.id}`} style={s.feeRow}>
             <View style={[s.feeDot, { backgroundColor: f.status === "paid" ? "#16A34A" : (f.fee_type === "Registration" ? "#1E40AF" : "#EA580C") }]}>
               <Feather name={f.status === "paid" ? "check" : (f.fee_type === "Registration" ? "award" : "calendar")} size={14} color="#fff" />
             </View>
             <View style={{ flex: 1 }}>
               <Text style={s.feeName}>{f.player_name}</Text>
               <Text style={s.feeMeta}>{f.fee_type} · {f.centre} · {f.sport} · {f.category}</Text>
               <Text style={s.feePeriod}>Period: {formatMonth(f.period_month)}{f.paid_at ? ` · paid ${formatDate(f.paid_at)}` : ""}</Text>
               {(f as any).discount_applied > 0 && (
                 <View style={s.discountChip} testID={`fee-discount-chip-${f.id}`}>
                   <Feather name="percent" size={10} color="#0F766E" />
                   <Text style={s.discountChipTxt}>
                     {`-${inr((f as any).discount_applied)}`}
                     {(f as any).discounted_by_name ? ` · by ${(f as any).discounted_by_name}` : ""}
                   </Text>
                 </View>
               )}
             </View>
             <View style={{ alignItems: "flex-end" }}>
               <Text style={s.feeAmt}>{inr(f.amount_due)}</Text>
               {f.status === "due" ? (
                 <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                   {canDiscount && <TouchableOpacity testID={`fee-discount-${f.id}`} style={s.feeEdit} onPress={() => setEditFee(f)}><Feather name="percent" size={12} color="#0F766E" /></TouchableOpacity>}
                   {canCollect && <TouchableOpacity testID={`fee-collect-${f.id}`} style={s.feeCollect} onPress={() => setCollectFee(f)}><Text style={s.feeCollectTxt}>Mark Paid</Text></TouchableOpacity>}
                 </View>
               ) : (
                 <View style={s.paidBadge}><Text style={s.paidBadgeTxt}>{f.payment_mode || "PAID"}</Text></View>
               )}
             </View>
           </View>
         ))}
         <View style={{ height: 60 }} />
      </ScrollView>

      <CollectModal fee={collectFee} onClose={() => setCollectFee(null)} onDone={async () => { setCollectFee(null); await load(); }} />
      <EditModal fee={editFee} onClose={() => setEditFee(null)} onDone={async () => { setEditFee(null); await load(); }} />
      <AddAdHocFeeModal visible={showAdd} onClose={() => setShowAdd(false)} onDone={async () => { setShowAdd(false); await load(); }} />
    </SafeAreaView>
  );
}

function CollectModal({ fee, onClose, onDone }: { fee: Fee | null; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"Cash" | "Online">("Cash");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  if (!fee) return null;
  const submit = async () => {
    if (mode === "Online" && !ref.trim()) { Alert.alert("Reference required", "Please enter the online payment reference id."); return; }
    setBusy(true);
    try { await api.post(`/fees/${fee.id}/collect`, { payment_mode: mode, reference_id: ref || undefined }); onDone(); }
    catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <Modal transparent animationType="slide" visible>
      <View style={s.modalBg}>
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>Collect fee</Text>
          <Text style={s.modalSub}>{fee.player_name} · {fee.fee_type}</Text>
          <Text style={s.modalAmt}>{inr(fee.amount_due)}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <TouchableOpacity testID="mode-cash" onPress={() => setMode("Cash")} style={[s.modeBtn, mode === "Cash" && s.modeBtnActive]}><Text style={[s.modeRupee, { color: mode === "Cash" ? "#fff" : "#475569" }]}>₹</Text><Text style={[s.modeBtnTxt, mode === "Cash" && { color: "#fff" }]}>Cash</Text></TouchableOpacity>
            <TouchableOpacity testID="mode-online" onPress={() => setMode("Online")} style={[s.modeBtn, mode === "Online" && s.modeBtnActive]}><Feather name="credit-card" size={16} color={mode === "Online" ? "#fff" : "#475569"} /><Text style={[s.modeBtnTxt, mode === "Online" && { color: "#fff" }]}>Online</Text></TouchableOpacity>
          </View>
          {mode === "Online" && (
            <TextInput testID="collect-ref" placeholder="Reference / Txn ID" placeholderTextColor="#94A3B8" value={ref} onChangeText={setRef} style={s.input} />
          )}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <TouchableOpacity testID="collect-cancel" style={s.cancelBtn} onPress={onClose}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity testID="collect-confirm" style={[s.saveBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>Confirm payment</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EditModal({ fee, onClose, onDone }: { fee: Fee | null; onClose: () => void; onDone: () => void }) {
  const [discount, setDiscount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!fee) return null;
  const amt = parseInt(discount || "0", 10);
  const newDue = Math.max(0, (fee.amount_due || 0) - amt);
  const submit = async () => {
    if (amt <= 0) { Alert.alert("Discount", "Enter a positive discount amount."); return; }
    if (amt > (fee.amount_due || 0)) { Alert.alert("Discount", "Discount cannot exceed the outstanding amount."); return; }
    if (!reason.trim()) { Alert.alert("Reason required", "Please provide a reason for this discount (audit log)."); return; }
    setBusy(true);
    try {
      await api.patch(`/fees/${fee.id}/discount`, { discount_amount: amt, reason: reason.trim() });
      Alert.alert("Discount applied", `New due: ${inr(newDue)}`);
      onDone();
    }
    catch (e: any) { Alert.alert("Error", e?.response?.data?.detail || "Failed"); }
    finally { setBusy(false); }
  };
  return (
    <Modal transparent animationType="slide" visible>
      <View style={s.modalBg}>
        <View style={s.modalCard}>
          <View style={s.discountHeader}>
            <View style={s.discountIcon}><Feather name="percent" size={18} color="#fff" /></View>
            <View>
              <Text style={s.modalTitle}>Apply discount</Text>
              <Text style={s.modalSub}>Super Admin only · audit-logged</Text>
            </View>
          </View>
          <Text style={s.discountInfo}>{fee.player_name} · {fee.fee_type} · {formatMonth(fee.period_month)}</Text>
          <View style={s.discountAmtRow}>
            <View style={s.discountAmtCol}>
              <Text style={s.discountAmtLabel}>Current due</Text>
              <Text style={s.discountAmtCurrent}>{inr(fee.amount_due)}</Text>
            </View>
            <Feather name="arrow-right" size={16} color="#94A3B8" />
            <View style={s.discountAmtCol}>
              <Text style={s.discountAmtLabel}>New due</Text>
              <Text style={[s.discountAmtNew, { color: amt > 0 ? "#16A34A" : "#0F172A" }]}>{inr(newDue)}</Text>
            </View>
          </View>
          <Text style={s.discountLabel}>Discount amount (₹) *</Text>
          <TextInput testID="discount-amount" keyboardType="numeric" placeholder="0" placeholderTextColor="#94A3B8" value={discount} onChangeText={(v) => setDiscount(v.replace(/[^0-9]/g, ""))} style={s.input} />
          <Text style={s.discountLabel}>Reason for discount *</Text>
          <TextInput testID="discount-reason" placeholder="e.g. Sibling concession, hardship case, scholarship…" placeholderTextColor="#94A3B8" value={reason} onChangeText={setReason} style={[s.input, { minHeight: 64 }]} multiline />
          <Text style={s.discountFootnote}>
            This action will be logged with your name, role, timestamp, and reason. Visible in the audit trail and fee history.
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <TouchableOpacity testID="discount-cancel" style={s.cancelBtn} onPress={onClose}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity testID="discount-confirm" style={[s.saveBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>Apply discount</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AddAdHocFeeModal({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PlayerLite | null>(null);
  const [feeType, setFeeType] = useState<AdhocType>("Uniform");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(() => formatDate(toISODate()));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    // Reset state on open
    setSearch(""); setSelected(null); setFeeType("Uniform"); setAmount(""); setNotes("");
    setDueDate(formatDate(toISODate()));
    setLoadingPlayers(true);
    api.get("/people", { params: { kind: "player" } })
      .then((r) => setPlayers((r.data || []).filter((p: any) => p.organization === "ALPHA" && p.status !== "deactivated")))
      .catch(() => setPlayers([]))
      .finally(() => setLoadingPlayers(false));
  }, [visible]);

  if (!visible) return null;

  const filteredPlayers = players.filter((p) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (p.name || "").toLowerCase().includes(q) || (p.centre || "").toLowerCase().includes(q) || (p.sport || "").toLowerCase().includes(q);
  }).slice(0, 50);

  const amt = parseInt(amount || "0", 10);

  const submit = async () => {
    if (!selected) { Alert.alert("Player required", "Please select a player for the ad-hoc fee."); return; }
    if (amt <= 0) { Alert.alert("Amount", "Enter a valid amount greater than 0."); return; }
    if (!isValidDisplayDate(dueDate)) { Alert.alert("Due date", `Use ${DATE_PLACEHOLDER} format for due date.`); return; }
    setBusy(true);
    try {
      await api.post(`/fees`, {
        player_id: selected.id,
        fee_type: feeType,
        amount: amt,
        due_date: parseToISO(dueDate) || dueDate,
        notes: notes.trim() || undefined,
      });
      Alert.alert("Fee created", `${feeType} fee of ${inr(amt)} added for ${selected.name}.`);
      onDone();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to create fee");
    } finally { setBusy(false); }
  };

  return (
    <Modal transparent animationType="slide" visible>
      <View style={s.modalBg}>
        <View style={[s.modalCard, { maxHeight: "92%" }]}>
          <View style={s.discountHeader}>
            <View style={[s.discountIcon, { backgroundColor: "#1E40AF" }]}><Feather name="plus-circle" size={18} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>Add ad-hoc fee</Text>
              <Text style={s.modalSub}>Super Admin only · one-off charge (Uniform, Kit, Tournament…)</Text>
            </View>
            <TouchableOpacity onPress={onClose} testID="adhoc-close" style={s.adhocCloseBtn}><Feather name="x" size={18} color="#475569" /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Player selector */}
            <Text style={s.discountLabel}>Player *</Text>
            {selected ? (
              <View style={s.selectedPlayer}>
                <View style={s.selectedPlayerDot}><Feather name="user" size={14} color="#fff" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.selectedPlayerName}>{selected.name}</Text>
                  <Text style={s.selectedPlayerMeta}>{[selected.centre, selected.sport, selected.player_type].filter(Boolean).join(" · ")}</Text>
                </View>
                <TouchableOpacity testID="adhoc-clear-player" onPress={() => setSelected(null)} style={s.adhocClearBtn}><Feather name="x" size={14} color="#EF4444" /></TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  testID="adhoc-player-search"
                  placeholder="Search player by name, centre, sport…"
                  placeholderTextColor="#94A3B8"
                  value={search}
                  onChangeText={setSearch}
                  style={s.input}
                  autoCapitalize="none"
                />
                <View style={s.playerList}>
                  {loadingPlayers ? (
                    <ActivityIndicator color="#1E40AF" style={{ marginVertical: 12 }} />
                  ) : filteredPlayers.length === 0 ? (
                    <Text style={s.emptyTextRow}>No players found.</Text>
                  ) : filteredPlayers.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      testID={`adhoc-player-${p.id}`}
                      onPress={() => { setSelected(p); setSearch(""); }}
                      style={s.playerItem}
                      activeOpacity={0.7}
                    >
                      <View style={s.playerItemDot}><Text style={s.playerItemDotTxt}>{(p.name || "?").charAt(0).toUpperCase()}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.playerItemName}>{p.name}</Text>
                        <Text style={s.playerItemMeta}>{[p.centre, p.sport, p.player_type].filter(Boolean).join(" · ") || "—"}</Text>
                      </View>
                      <Feather name="chevron-right" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Fee type chips */}
            <Text style={s.discountLabel}>Fee type *</Text>
            <View style={s.chipRow}>
              {ADHOC_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  testID={`adhoc-type-${t}`}
                  onPress={() => setFeeType(t)}
                  style={[s.chip, feeType === t && s.chipActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[s.chipTxt, feeType === t && s.chipTxtActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Amount */}
            <Text style={s.discountLabel}>Amount (₹) *</Text>
            <TextInput
              testID="adhoc-amount"
              keyboardType="numeric"
              placeholder="e.g. 1500"
              placeholderTextColor="#94A3B8"
              value={amount}
              onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ""))}
              style={s.input}
            />

            {/* Due date */}
            <Text style={s.discountLabel}>Due date ({DATE_PLACEHOLDER}) *</Text>
            <TextInput
              testID="adhoc-due-date"
              placeholder="2026-06-15"
              placeholderTextColor="#94A3B8"
              value={dueDate}
              onChangeText={setDueDate}
              style={s.input}
              autoCapitalize="none"
            />

            {/* Notes */}
            <Text style={s.discountLabel}>Notes (optional)</Text>
            <TextInput
              testID="adhoc-notes"
              placeholder="e.g. Sept tournament kit, included spikes"
              placeholderTextColor="#94A3B8"
              value={notes}
              onChangeText={setNotes}
              style={[s.input, { minHeight: 60 }]}
              multiline
            />

            <Text style={s.discountFootnote}>
              This invoice will appear in the player's dues and be available for collection. Logged with your name, role, and timestamp.
            </Text>

            <View style={{ flexDirection: "row", gap: 8, marginTop: 16, marginBottom: 6 }}>
              <TouchableOpacity testID="adhoc-cancel" style={s.cancelBtn} onPress={onClose}><Text style={s.cancelTxt}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity testID="adhoc-confirm" style={[s.saveBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>Create fee</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  backBtn: { padding: 8 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#94A3B8" },
  h1: { fontSize: 22, fontWeight: "700", color: "#0F172A", marginTop: 2 },
  centreRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 12 },
  cFilter: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  cFilterActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  cFilterTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  dashRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 12, flexWrap: "wrap" },
  dashCard: { flex: 1, minWidth: 150, padding: 12, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0" },
  dashTitle: { fontSize: 12, fontWeight: "800", color: "#0F172A", letterSpacing: 0.5, marginBottom: 6 },
  dashLine: { fontSize: 12, color: "#475569", marginTop: 2 },
  dashSub: { fontSize: 11, color: "#94A3B8", marginTop: 6 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 20, marginTop: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  tabActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  tabTxt: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  tabTxtActive: { color: "#fff" },
  scroll: { padding: 20, paddingTop: 8 },
  feeRow: { flexDirection: "row", gap: 10, alignItems: "center", padding: 12, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  feeDot: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  feeName: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  feeMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  feePeriod: { fontSize: 10, color: "#94A3B8", marginTop: 1 },
  feeAmt: { fontSize: 14, fontWeight: "800", color: "#0F172A" },
  feeCollect: { backgroundColor: "#1E40AF", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  feeCollectTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  feeEdit: { backgroundColor: "#0F766E1A", padding: 6, borderRadius: 8 },
  paidBadge: { backgroundColor: "#DCFCE7", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 6 },
  paidBadgeTxt: { color: "#16A34A", fontSize: 10, fontWeight: "800" },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginTop: 8 },
  emptyText: { color: "#64748B", textAlign: "center" },
  emptyTextRow: { textAlign: "center", color: "#94A3B8", marginTop: 24 },
  modalBg: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  modalCard: { padding: 20, paddingBottom: 28, backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  modalTitle: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  modalSub: { fontSize: 12, color: "#64748B", marginTop: 4 },
  modalAmt: { fontSize: 26, fontWeight: "800", color: "#1E40AF", marginTop: 12 },
  modeBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, paddingVertical: 12, borderRadius: 10, backgroundColor: "#F1F5F9" },
  modeBtnActive: { backgroundColor: "#1E40AF" },
  modeBtnTxt: { fontSize: 13, fontWeight: "700", color: "#475569" },
  modeRupee: { fontSize: 16, fontWeight: "900", lineHeight: 18 },
  input: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, padding: 12, marginTop: 12, fontSize: 14 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center" },
  cancelTxt: { fontSize: 14, fontWeight: "700", color: "#475569" },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: "#1E40AF", alignItems: "center" },
  saveTxt: { fontSize: 14, fontWeight: "700", color: "#fff" },
  discountChip: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#CCFBF1", borderRadius: 999, alignSelf: "flex-start" },
  discountChipTxt: { fontSize: 10, fontWeight: "800", color: "#0F766E", letterSpacing: 0.3 },
  discountHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  discountIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#0F766E", alignItems: "center", justifyContent: "center" },
  discountInfo: { fontSize: 12, color: "#64748B", marginTop: 6, marginBottom: 12 },
  discountAmtRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: "#F8FAFC", borderRadius: 12, marginBottom: 14 },
  discountAmtCol: { flex: 1, alignItems: "center" },
  discountAmtLabel: { fontSize: 10, fontWeight: "800", color: "#94A3B8", letterSpacing: 0.5, textTransform: "uppercase" },
  discountAmtCurrent: { fontSize: 18, fontWeight: "800", color: "#0F172A", marginTop: 2 },
  discountAmtNew: { fontSize: 18, fontWeight: "800", marginTop: 2 },
  discountLabel: { fontSize: 13, fontWeight: "600", color: "#475569", marginTop: 6, marginBottom: 4 },
  discountFootnote: { fontSize: 11, color: "#94A3B8", marginTop: 10, lineHeight: 16, fontStyle: "italic" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: "#1E40AF" },
  addBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
  adhocCloseBtn: { padding: 6, borderRadius: 8, backgroundColor: "#F1F5F9" },
  selectedPlayer: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: "#EFF6FF", borderRadius: 12, marginTop: 4 },
  selectedPlayerDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#1E40AF", alignItems: "center", justifyContent: "center" },
  selectedPlayerName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  selectedPlayerMeta: { fontSize: 11, color: "#64748B", marginTop: 1 },
  adhocClearBtn: { padding: 6, borderRadius: 8, backgroundColor: "#FEE2E2" },
  playerList: { maxHeight: 220, marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden" },
  playerItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  playerItemDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#E0E7FF", alignItems: "center", justifyContent: "center" },
  playerItemDotTxt: { color: "#1E40AF", fontWeight: "800", fontSize: 12 },
  playerItemName: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  playerItemMeta: { fontSize: 11, color: "#64748B", marginTop: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  chipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  chipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  chipTxtActive: { color: "#fff" },
});
