import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, Modal, Pressable, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, StyleSheet, Platform, Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, useAuth, userHasPermission } from "../../auth";
import { Permission } from "../../rbac";
import { colors } from "../../theme";
import { formatDate, formatMonth, DATE_PLACEHOLDER, toISODate, parseToISO } from "../../dateFormat";
import type { CollectionPlayer, Institution, PaymentMode, PaymentReceipt, PlayerDues } from "../../feesCollectionTypes";

function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function initials(name: string) {
  return (name || "?").split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export function CollectionDrawer({
  player,
  institution,
  visible,
  onClose,
  onCollected,
}: {
  player: CollectionPlayer | null;
  institution: Institution;
  visible: boolean;
  onClose: () => void;
  onCollected: (receipt: PaymentReceipt) => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const canDiscount = userHasPermission(user, Permission.MANAGE_ACCESS);
  const [dues, setDues] = useState<PlayerDues | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFeeIds, setSelectedFeeIds] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<PaymentMode>("Cash");
  const [referenceId, setReferenceId] = useState("");
  const [txnDate, setTxnDate] = useState(formatDate(toISODate()));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!player?.id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/fees/player-dues/${player.id}`);
      setDues(data);
      setSelectedFeeIds(new Set());
    } catch {
      setDues(null);
    } finally {
      setLoading(false);
    }
  }, [player?.id]);

  useEffect(() => {
    if (visible && player) load();
    else {
      setDues(null);
      setSelectedFeeIds(new Set());
      setReferenceId("");
      setNotes("");
      setMode("Cash");
    }
  }, [visible, player, load]);

  const totalSelected = useMemo(() => {
    if (!dues) return 0;
    return dues.unpaid.filter((f) => selectedFeeIds.has(f.id)).reduce((a, f) => a + (f.amount_due || 0), 0);
  }, [dues, selectedFeeIds]);

  const toggleFee = (id: string) => {
    setSelectedFeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (!dues) return;
    setSelectedFeeIds(new Set(dues.unpaid.map((f) => f.id)));
  };

  const submit = async () => {
    if (!player || selectedFeeIds.size === 0) {
      Alert.alert("Select fees", "Choose at least one outstanding month.");
      return;
    }
    if ((mode === "Online" || mode === "UPI") && !referenceId.trim()) {
      Alert.alert("Reference required", "Enter UPI / transaction reference for non-cash payments.");
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post("/fees/payments", {
        fee_ids: Array.from(selectedFeeIds),
        advance: [],
        player_id: player.id,
        payment_mode: mode,
        reference_id: referenceId || null,
        transaction_date: parseToISO(txnDate) || txnDate,
        notes: notes || null,
      });
      onCollected(data);
      onClose();
    } catch (e: any) {
      Alert.alert("Collection failed", e?.response?.data?.detail || "Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible || !player) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={onClose} />
        <View style={s.drawer} testID="collection-drawer">
          <View style={s.drawerHeader}>
            <View style={s.drawerAvatar}><Text style={s.drawerAvatarTxt}>{initials(player.name)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.drawerName}>{player.name}</Text>
              <Text style={s.drawerMeta}>{player.mobile || "—"}</Text>
            </View>
            <Pressable onPress={onClose} testID="drawer-close" hitSlop={12}>
              <Feather name="x" size={22} color={colors.muted} />
            </Pressable>
          </View>

          {institution === "PWS" && (
            <TouchableOpacity
              style={s.roadmapLink}
              onPress={() => { onClose(); router.push(`/fees/pws-student/${player.id}` as any); }}
            >
              <Feather name="calendar" size={14} color={colors.primary} />
              <Text style={s.roadmapLinkTxt}>Yearly roadmap</Text>
            </TouchableOpacity>
          )}

          <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: 24 }}>
            {loading || !dues ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
            ) : dues.unpaid.length === 0 ? (
              <View style={s.allClear}>
                <Feather name="check-circle" size={28} color={colors.success} />
                <Text style={s.allClearTxt}>All dues paid up to date</Text>
              </View>
            ) : (
              <>
                <View style={s.listHead}>
                  <Text style={s.sectionLabel}>Outstanding months</Text>
                  <Pressable onPress={selectAll} testID="drawer-select-all">
                    <Text style={s.selectAll}>Select all</Text>
                  </Pressable>
                </View>
                <Text style={s.hint}>Full months only — no partial payments.</Text>
                {dues.unpaid.map((f) => {
                  const checked = selectedFeeIds.has(f.id);
                  return (
                    <Pressable
                      key={f.id}
                      testID={`drawer-fee-${f.id}`}
                      onPress={() => toggleFee(f.id)}
                      style={[s.feeRow, checked && s.feeRowChecked]}
                    >
                      <View style={[s.checkbox, checked && s.checkboxOn]}>
                        {checked && <Feather name="check" size={12} color="#fff" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.feeType}>{f.fee_type} · {formatMonth(f.period_month)}</Text>
                        <Text style={s.feeMeta}>Due {formatDate(f.due_date)}</Text>
                        {(f.discount_applied || 0) > 0 && (
                          <Text style={s.discountNote}>Includes ₹{f.discount_applied} discount</Text>
                        )}
                      </View>
                      <Text style={s.feeAmt}>{inr(f.amount_due)}</Text>
                    </Pressable>
                  );
                })}
              </>
            )}

            {dues && dues.unpaid.length > 0 && (
              <>
                <View style={s.totalBar}>
                  <Text style={s.totalLabel}>Selected total</Text>
                  <Text style={s.totalAmt}>{inr(totalSelected)}</Text>
                </View>

                <Text style={s.sectionLabel}>Payment mode</Text>
                <View style={s.modeRow}>
                  {(["Cash", "UPI", "Online"] as PaymentMode[]).map((m) => (
                    <Pressable
                      key={m}
                      testID={`drawer-mode-${m.toLowerCase()}`}
                      onPress={() => setMode(m)}
                      style={[s.modeBtn, mode === m && s.modeBtnActive]}
                    >
                      <Text style={[s.modeTxt, mode === m && s.modeTxtActive]}>{m}</Text>
                    </Pressable>
                  ))}
                </View>

                {(mode === "UPI" || mode === "Online") && (
                  <>
                    <Text style={s.inputLabel}>Reference / UTR *</Text>
                    <TextInput
                      testID="drawer-ref"
                      value={referenceId}
                      onChangeText={setReferenceId}
                      placeholder="Transaction reference"
                      placeholderTextColor={colors.hint}
                      style={s.input}
                    />
                  </>
                )}

                <Text style={s.inputLabel}>Transaction date</Text>
                <TextInput
                  testID="drawer-txn-date"
                  value={txnDate}
                  onChangeText={setTxnDate}
                  placeholder={DATE_PLACEHOLDER}
                  placeholderTextColor={colors.hint}
                  style={s.input}
                />

                <Text style={s.inputLabel}>Notes (optional)</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Remarks…"
                  placeholderTextColor={colors.hint}
                  style={[s.input, { minHeight: 56 }]}
                  multiline
                />

                {!canDiscount && (
                  <Text style={s.hint}>Discounts can only be applied by Super Admin from the fee record.</Text>
                )}
              </>
            )}
          </ScrollView>

          {dues && dues.unpaid.length > 0 && (
            <View style={s.footer}>
              <TouchableOpacity
                testID="drawer-save-receipt"
                disabled={submitting || selectedFeeIds.size === 0}
                onPress={submit}
                style={[s.saveBtn, (submitting || selectedFeeIds.size === 0) && { opacity: 0.5 }]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.saveTxt}>Save & Generate Receipt · {inr(totalSelected)}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, flexDirection: "row", justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.45)" },
  drawer: {
    width: Platform.OS === "web" ? 420 : "92%",
    maxWidth: "100%",
    backgroundColor: "#fff",
    height: "100%",
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  drawerHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  drawerAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  drawerAvatarTxt: { color: colors.primary, fontWeight: "800", fontSize: 14 },
  drawerName: { fontSize: 16, fontWeight: "800", color: colors.ink },
  drawerMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  roadmapLink: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
  roadmapLinkTxt: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  scroll: { flex: 1, paddingHorizontal: 16 },
  listHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  sectionLabel: { fontSize: 13, fontWeight: "800", color: colors.ink },
  selectAll: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  hint: { fontSize: 11, color: colors.hint, fontStyle: "italic", marginBottom: 8, marginTop: 4 },
  feeRow: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 12,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 6,
  },
  feeRowChecked: { borderColor: colors.primary, backgroundColor: colors.primarySofter },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5,
    borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  feeType: { fontSize: 13, fontWeight: "700", color: colors.ink },
  feeMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  discountNote: { fontSize: 10, color: "#0F766E", marginTop: 2, fontWeight: "600" },
  feeAmt: { fontSize: 14, fontWeight: "800", color: colors.ink },
  totalBar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 12, backgroundColor: colors.primarySofter, borderRadius: 10, marginVertical: 12,
  },
  totalLabel: { fontSize: 12, fontWeight: "700", color: colors.muted },
  totalAmt: { fontSize: 20, fontWeight: "800", color: colors.primary },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  modeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2,
  },
  modeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  modeTxtActive: { color: "#fff" },
  inputLabel: { fontSize: 12, fontWeight: "600", color: colors.muted, marginTop: 8, marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.ink,
    backgroundColor: colors.surface2, outlineStyle: "none" as any,
  },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  saveBtn: { backgroundColor: colors.primary, padding: 14, borderRadius: 12, alignItems: "center" },
  saveTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  allClear: { padding: 24, alignItems: "center", gap: 8 },
  allClearTxt: { color: colors.success, fontWeight: "700" },
});
