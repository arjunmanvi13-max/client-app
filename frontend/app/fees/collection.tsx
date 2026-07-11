/**
 * Dedicated Fees Collection screen — ALPHA Sports Academy.
 * Spec ref: Emergent prompt v1 (Fees Module upgrade).
 *
 * Flow:
 *   1. Search/filter for a player
 *   2. View detailed dues (current / past / FY total)
 *   3. Select one or more FULL months (no partial)
 *   4. Pick mode (Cash / Online) + required fields
 *   5. Submit → in-page receipt modal with "Collected by: …"
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Modal, Pressable, RefreshControl, Alert, Platform, Linking, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, useAuth } from "../../src/auth";
import { colors } from "../../src/theme";

const CENTRES = ["Balua", "Harding Park"] as const;
const SPORTS = ["Cricket", "Football"] as const;

type PersonRow = {
  id: string; name: string; centre?: string; sport?: string; player_type?: string; group?: string;
  mobile?: string; status?: string; date_of_admission?: string; is_resident?: boolean;
};
type Fee = {
  id: string; fee_type: string; amount: number; amount_due: number;
  period_month: string; status: string; due_date?: string;
  paid_at?: string; payment_mode?: string; reference_id?: string;
  collected_by_name?: string; transaction_date?: string;
  discount_applied?: number; discount_reason?: string;
};
type DuesResp = {
  player: PersonRow;
  summary: { current_month_due: number; previous_pending_due: number; total_outstanding: number; financial_year_total: number; paid_total: number };
  unpaid: Fee[]; paid: Fee[]; current_month: string;
};

function inr(n: number) {
  if (n == null) return "—";
  return `₹${n.toLocaleString()}`;
}

function fmtMonth(p: string) {
  if (!p || p.length < 7) return p;
  const d = new Date(p + "-01");
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export default function FeesCollection() {
  const { user } = useAuth();
  const router = useRouter();
  const defaultInstitution = (user?.role === "principal" || user?.role === "vice_principal") ? "PWS" : "ALPHA";
  const [institution, setInstitution] = useState<"ALPHA" | "PWS">(defaultInstitution);
  const [centre, setCentre] = useState<string | null>(null);
  const [sport, setSport] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<PersonRow[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PersonRow | null>(null);
  const [dues, setDues] = useState<DuesResp | null>(null);
  const [loadingDues, setLoadingDues] = useState(false);
  const [selectedFeeIds, setSelectedFeeIds] = useState<Set<string>>(new Set());
  const [selectedAdvance, setSelectedAdvance] = useState<Set<string>>(new Set());
  const [showAdvance, setShowAdvance] = useState(false);
  const [mode, setMode] = useState<"Cash" | "Online">("Cash");
  const [referenceId, setReferenceId] = useState("");
  const [txnDate, setTxnDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<any | null>(null);

  const receiptPdfUrl = () => `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/fees/receipt/${receipt?.batch_id}/pdf`;

  const downloadReceiptPdf = () => {
    if (!receipt?.batch_id) return;
    const url = receiptPdfUrl();
    if (Platform.OS === "web") window.open(url, "_blank");
    else Linking.openURL(url);
  };

  const shareReceipt = async () => {
    if (!receipt?.batch_id) return;
    const url = receiptPdfUrl();
    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(url);
        window.alert("Receipt link copied to clipboard — share it on WhatsApp/SMS.");
      } catch {
        window.prompt("Copy receipt link:", url);
      }
    } else {
      await Share.share({ message: `Payment receipt for ${receipt?.player?.name} — ₹${(receipt?.total_amount || 0).toLocaleString()}\n${url}` });
    }
  };

  // Load people (ALPHA players or PWS students)
  const loadPlayers = useCallback(async () => {
    setLoadingPlayers(true);
    try {
      const params: any = institution === "PWS"
        ? { kind: "student", organization: "PWS" }
        : { kind: "player", organization: "ALPHA" };
      if (institution === "ALPHA") {
        if (centre) params.centre = centre;
        if (sport) params.sport = sport;
      } else if (centre) {
        params.group = centre;
      }
      const { data } = await api.get("/people", { params });
      setPlayers(data || []);
    } catch (e) { setPlayers([]); }
    finally { setLoadingPlayers(false); }
  }, [centre, sport, institution]);
  useEffect(() => { setSelectedPlayer(null); loadPlayers(); }, [loadPlayers]);

  // Client-side text search (name / mobile)
  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) =>
      (p.name || "").toLowerCase().includes(q) ||
      (p.mobile || "").includes(q) ||
      (p.id || "").toLowerCase().includes(q)
    );
  }, [players, search]);

  // Load dues when player selected
  const loadDues = useCallback(async (id: string) => {
    setLoadingDues(true);
    try {
      const { data } = await api.get(`/fees/player-dues/${id}`);
      setDues(data);
      setSelectedFeeIds(new Set());
      setSelectedAdvance(new Set());
    } catch (e) { setDues(null); }
    finally { setLoadingDues(false); }
  }, []);

  useEffect(() => {
    if (selectedPlayer) loadDues(selectedPlayer.id);
    else { setDues(null); setSelectedFeeIds(new Set()); setSelectedAdvance(new Set()); }
  }, [selectedPlayer, loadDues]);

  const advKey = (f: any) => `${f.fee_type}|${f.period_month}`;

  const totalSelected = useMemo(() => {
    if (!dues) return 0;
    const dueSum = dues.unpaid.filter((f: any) => selectedFeeIds.has(f.id)).reduce((a: number, b: any) => a + (b.amount_due || 0), 0);
    const advSum = (dues.advance || []).filter((f: any) => selectedAdvance.has(advKey(f))).reduce((a: number, b: any) => a + (b.amount || 0), 0);
    return dueSum + advSum;
  }, [dues, selectedFeeIds, selectedAdvance]);

  const toggleFee = (id: string) => {
    const next = new Set(selectedFeeIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedFeeIds(next);
  };

  const toggleAdvance = (f: any) => {
    const k = advKey(f);
    const next = new Set(selectedAdvance);
    if (next.has(k)) next.delete(k); else next.add(k);
    setSelectedAdvance(next);
  };

  const selectAllOutstanding = () => {
    if (!dues) return;
    setSelectedFeeIds(new Set(dues.unpaid.map((f) => f.id)));
  };

  const submit = async () => {
    if (selectedFeeIds.size === 0 && selectedAdvance.size === 0) { Alert.alert("Select at least one fee"); return; }
    if (mode === "Online" && !referenceId.trim()) { Alert.alert("Reference ID is required for Online payments"); return; }
    setSubmitting(true);
    try {
      const advance = (dues?.advance || [])
        .filter((f: any) => selectedAdvance.has(advKey(f)))
        .map((f: any) => ({ period_month: f.period_month, fee_type: f.fee_type }));
      const { data } = await api.post("/fees/collect-multi", {
        fee_ids: Array.from(selectedFeeIds),
        advance,
        player_id: selectedPlayer?.id || null,
        payment_mode: mode,
        reference_id: referenceId || null,
        transaction_date: txnDate,
        notes: notes || null,
      });
      setReceipt(data);
      // refresh dues
      if (selectedPlayer) await loadDues(selectedPlayer.id);
      setReferenceId(""); setNotes("");
    } catch (e: any) {
      Alert.alert("Collection failed", e?.response?.data?.detail || "Try again.");
    } finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={loadingPlayers} onRefresh={loadPlayers} />}>

        {/* Header */}
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} testID="back-btn" style={s.backBtn}>
            <Feather name="chevron-left" size={20} color={colors.muted} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>FEES COLLECTION</Text>
            <Text style={s.h1}>{institution === "PWS" ? "Collect Student Fees" : "Collect Player Fees"}</Text>
            <Text style={s.sub}>Search a {institution === "PWS" ? "student" : "player"} → choose months → record payment</Text>
          </View>
        </View>

        {/* Filters */}
        <View style={s.filterCard}>
          <Text style={s.filterLabel}>INSTITUTION</Text>
          <View style={s.pillRow}>
            {(["PWS", "ALPHA"] as const).map((inst) => {
              const active = institution === inst;
              const locked = user?.role === "admin" && inst === "PWS" || (user?.role === "principal" || user?.role === "vice_principal") && inst === "ALPHA";
              if (locked) return null;
              return (
                <Pressable key={inst} testID={`inst-${inst}`} onPress={() => { setInstitution(inst); setCentre(null); setSport(null); }} style={[s.pill, active && s.pillActive]}>
                  <Text style={[s.pillTxt, active && s.pillTxtActive]}>{inst === "PWS" ? "PWS School" : "ALPHA Sports"}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={s.filterLabel}>SEARCH & FILTER</Text>
          <View style={s.searchWrap}>
            <Feather name="search" size={16} color={colors.hint} />
            <TextInput
              testID="search-input"
              value={search}
              onChangeText={setSearch}
              placeholder="Search by name, mobile…"
              placeholderTextColor={colors.hint}
              style={s.searchInput}
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Feather name="x" size={16} color={colors.hint} />
              </Pressable>
            )}
          </View>
          {institution === "ALPHA" ? (
            <>
              <View style={s.pillRow}>
                <Text style={s.pillRowLabel}>CENTRE</Text>
                {[null, ...CENTRES].map((c) => {
                  const active = (c ?? "all") === (centre ?? "all");
                  return (
                    <Pressable key={String(c)} testID={`centre-${c ?? "all"}`} onPress={() => setCentre(c)} style={[s.pill, active && s.pillActive]}>
                      <Text style={[s.pillTxt, active && s.pillTxtActive]}>{c ?? "All"}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={s.pillRow}>
                <Text style={s.pillRowLabel}>SPORT</Text>
                {[null, ...SPORTS].map((sp) => {
                  const active = (sp ?? "all") === (sport ?? "all");
                  return (
                    <Pressable key={String(sp)} testID={`sport-${sp ?? "all"}`} onPress={() => setSport(sp)} style={[s.pill, active && s.pillActive]}>
                      <Text style={[s.pillTxt, active && s.pillTxtActive]}>{sp ?? "All"}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={s.pillRow}>
              <Text style={s.pillRowLabel}>SECTION</Text>
              {[null, ...Array.from(new Set(players.map((p) => p.group).filter(Boolean)))].slice(0, 8).map((g) => {
                const active = (g ?? "all") === (centre ?? "all");
                return (
                  <Pressable key={String(g)} testID={`section-${g ?? "all"}`} onPress={() => setCentre(g)} style={[s.pill, active && s.pillActive]}>
                    <Text style={[s.pillTxt, active && s.pillTxtActive]}>{g ?? "All"}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Player list */}
        {!selectedPlayer && (
          <>
            <Text style={s.sectionLabel}>{institution === "PWS" ? "Students" : "Players"} ({filteredPlayers.length})</Text>
            {loadingPlayers ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
            ) : filteredPlayers.length === 0 ? (
              <Text style={s.empty}>No {institution === "PWS" ? "students" : "players"} match the current filters.</Text>
            ) : filteredPlayers.slice(0, 50).map((p) => (
              <TouchableOpacity
                key={p.id}
                testID={`player-${p.id}`}
                onPress={() => setSelectedPlayer(p)}
                style={s.playerRow}
                activeOpacity={0.85}
              >
                <View style={s.avatar}><Text style={s.avatarTxt}>{p.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.playerName}>{p.name}</Text>
                  <Text style={s.playerMeta}>
                    {institution === "PWS"
                      ? `${p.group || "—"} · ${p.is_resident ? "Hostel" : "Day Scholar"}${p.mobile ? ` · ${p.mobile}` : ""}`
                      : `${p.centre} · ${p.sport} · ${p.player_type}${p.mobile ? ` · ${p.mobile}` : ""}`}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.hint} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Dues panel */}
        {selectedPlayer && (
          <>
            <View style={s.duesHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.sectionLabel}>Selected {institution === "PWS" ? "Student" : "Player"}</Text>
                <Text style={s.playerName}>{selectedPlayer.name}</Text>
                <Text style={s.playerMeta}>{selectedPlayer.centre} · {selectedPlayer.sport} · {selectedPlayer.player_type}</Text>
              </View>
              <Pressable onPress={() => setSelectedPlayer(null)} testID="change-player" style={s.changeBtn}>
                <Feather name="repeat" size={14} color={colors.muted} />
                <Text style={s.changeBtnTxt}>Change</Text>
              </Pressable>
            </View>

            {loadingDues || !dues ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
            ) : (
              <>
                {/* Summary cubes */}
                <View style={s.cubeGrid}>
                  <SummaryCube testID="sum-current" label="Current month due" value={inr(dues.summary.current_month_due)} tint="#F59E0B" />
                  <SummaryCube testID="sum-past" label="Previous pending" value={inr(dues.summary.previous_pending_due)} tint="#EF4444" />
                  <SummaryCube testID="sum-outstanding" label="Total outstanding" value={inr(dues.summary.total_outstanding)} tint="#DC2626" highlight />
                  <SummaryCube testID="sum-fy" label="FY total" value={inr(dues.summary.financial_year_total)} tint="#1E40AF" />
                </View>

                {/* Unpaid fees with checkboxes — grouped by period */}
                <View style={s.unpaidHeader}>
                  <Text style={s.sectionLabel}>Outstanding fees</Text>
                  {dues.unpaid.length > 0 && (
                    <Pressable onPress={selectAllOutstanding} testID="select-all" style={s.selectAllBtn}>
                      <Feather name="check-square" size={14} color={colors.primary} />
                      <Text style={s.selectAllTxt}>Select all</Text>
                    </Pressable>
                  )}
                </View>
                {dues.unpaid.length > 0 && (
                  <Text style={s.noPartialNote}>Select any combination of months — full amounts only, partial payments are not allowed.</Text>
                )}
                {dues.unpaid.length === 0 ? (
                  <View style={s.allClear}>
                    <Feather name="check-circle" size={28} color={colors.success} />
                    <Text style={s.allClearTxt}>All dues are paid up to date 🎉</Text>
                  </View>
                ) : (
                  <>
                    {[
                      { title: "PREVIOUS DUES", tint: "#DC2626", items: dues.unpaid.filter((f) => (f.period_month || "") < dues.current_month) },
                      { title: "CURRENT MONTH", tint: "#B45309", items: dues.unpaid.filter((f) => (f.period_month || "") >= dues.current_month) },
                    ].map((grp) => grp.items.length === 0 ? null : (
                      <View key={grp.title}>
                        <Text style={[s.periodGroupLabel, { color: grp.tint }]} testID={`group-${grp.title.toLowerCase().replace(/\s+/g, "-")}`}>{grp.title} · {grp.items.length}</Text>
                        {grp.items.map((f) => {
                          const checked = selectedFeeIds.has(f.id);
                          return (
                            <Pressable
                              key={f.id}
                              testID={`fee-${f.id}`}
                              onPress={() => toggleFee(f.id)}
                              style={[s.feeRow, checked && s.feeRowChecked]}
                            >
                              <View style={[s.checkbox, checked && s.checkboxChecked]}>
                                {checked && <Feather name="check" size={14} color="#fff" />}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={s.feeType}>{f.fee_type} · {fmtMonth(f.period_month)}</Text>
                                <Text style={s.feeMeta}>Due {f.due_date}{f.is_first_month ? " · First-month rate" : ""}</Text>
                              </View>
                              <Text style={s.feeAmt}>{inr(f.amount_due)}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </>
                )}

                {/* Advance — pay future months up to FY end */}
                {(dues.advance || []).length > 0 && (
                  <View style={s.advanceBox}>
                    <Pressable testID="toggle-advance" onPress={() => setShowAdvance(!showAdvance)} style={s.advanceHead}>
                      <Feather name="fast-forward" size={14} color="#0F766E" />
                      <Text style={s.advanceTitle}>Pay in advance · up to {fmtMonth(dues.financial_year_end)}</Text>
                      <Feather name={showAdvance ? "chevron-up" : "chevron-down"} size={16} color="#0F766E" />
                    </Pressable>
                    {showAdvance && (
                      <>
                        <Text style={s.noPartialNote}>Optionally collect future months now — they will not appear as dues later.</Text>
                        {(dues.advance || []).map((f: any) => {
                          const k = advKey(f);
                          const checked = selectedAdvance.has(k);
                          return (
                            <Pressable
                              key={k}
                              testID={`adv-${f.fee_type.toLowerCase()}-${f.period_month}`}
                              onPress={() => toggleAdvance(f)}
                              style={[s.feeRow, checked && s.feeRowChecked]}
                            >
                              <View style={[s.checkbox, checked && s.checkboxChecked]}>
                                {checked && <Feather name="check" size={14} color="#fff" />}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={s.feeType}>{f.fee_type} · {fmtMonth(f.period_month)}</Text>
                                <Text style={s.feeMeta}>Advance payment</Text>
                              </View>
                              <Text style={s.feeAmt}>{inr(f.amount)}</Text>
                            </Pressable>
                          );
                        })}
                      </>
                    )}
                  </View>
                )}

                {/* Selected total */}
                {(dues.unpaid.length > 0 || (dues.advance || []).length > 0) && (
                  <View style={s.selectedBar}>
                    <View>
                      <Text style={s.selectedLabel}>SELECTED TOTAL</Text>
                      <Text style={s.selectedAmt}>{inr(totalSelected)}</Text>
                    </View>
                    <Text style={s.selectedCount}>{selectedFeeIds.size + selectedAdvance.size} fee(s)</Text>
                  </View>
                )}

                {/* Mode + form */}
                {dues.unpaid.length > 0 && (
                  <>
                    <Text style={s.sectionLabel}>Payment mode</Text>
                    <View style={s.modeRow}>
                      {(["Cash", "Online"] as const).map((m) => (
                        <Pressable key={m} testID={`mode-${m.toLowerCase()}`} onPress={() => setMode(m)} style={[s.modeBtn, mode === m && s.modeBtnActive]}>
                          {m === "Cash"
                            ? <Text style={[s.modeRupee, { color: mode === m ? "#fff" : colors.muted }]}>₹</Text>
                            : <Feather name="credit-card" size={16} color={mode === m ? "#fff" : colors.muted} />
                          }
                          <Text style={[s.modeBtnTxt, mode === m && { color: "#fff" }]}>{m}</Text>
                        </Pressable>
                      ))}
                    </View>

                    {mode === "Online" && (
                      <>
                        <Text style={s.label}>Reference / Transaction ID *</Text>
                        <TextInput testID="ref-input" value={referenceId} onChangeText={setReferenceId} placeholder="UTR / Txn ID" placeholderTextColor={colors.hint} style={s.input} />
                      </>
                    )}
                    <Text style={s.label}>Transaction date</Text>
                    <TextInput testID="txn-date" value={txnDate} onChangeText={setTxnDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.hint} style={s.input} />
                    <Text style={s.label}>Notes (optional)</Text>
                    <TextInput testID="notes-input" value={notes} onChangeText={setNotes} placeholder="Any remarks…" placeholderTextColor={colors.hint} style={[s.input, { minHeight: 60 }]} multiline />

                    <TouchableOpacity testID="submit-collection" disabled={submitting || (selectedFeeIds.size === 0 && selectedAdvance.size === 0)} onPress={submit} style={[s.primaryBtn, (submitting || (selectedFeeIds.size === 0 && selectedAdvance.size === 0)) && { opacity: 0.6 }]}>
                      {submitting ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnTxt}>Collect {inr(totalSelected)}</Text>}
                    </TouchableOpacity>
                  </>
                )}

                {/* Payment history */}
                {dues.paid.length > 0 && (
                  <>
                    <Text style={[s.sectionLabel, { marginTop: 24 }]}>Payment history</Text>
                    {dues.paid.slice(0, 10).map((f) => (
                      <View key={f.id} style={s.historyRow}>
                        <Feather name="check-circle" size={16} color={colors.success} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.historyType}>{f.fee_type} · {fmtMonth(f.period_month)}</Text>
                          <Text style={s.historyMeta}>
                            Paid {f.transaction_date || (f.paid_at || "").slice(0, 10)} · {f.payment_mode || "—"}{f.reference_id ? ` · ${f.reference_id}` : ""}
                          </Text>
                          {f.collected_by_name && <Text style={s.historyMeta}>Collected by: {f.collected_by_name}</Text>}
                        </View>
                        <Text style={s.historyAmt}>{inr(f.amount_due)}</Text>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Receipt modal */}
      <Modal visible={!!receipt} animationType="slide" transparent onRequestClose={() => setReceipt(null)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <View style={s.receiptHeader}>
              <View style={s.tickCircle}><Feather name="check" size={22} color="#fff" /></View>
              <Text style={s.receiptTitle}>Payment Successful</Text>
              <Text style={s.receiptSub}>Receipt · Batch {receipt?.batch_id?.slice(0, 8)}</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              <ReceiptRow label="Player" value={receipt?.player?.name} />
              <ReceiptRow label="Centre / Sport" value={`${receipt?.player?.centre || "—"} · ${receipt?.player?.sport || "—"}`} />
              <ReceiptRow label="Category" value={receipt?.player?.category} />
              <View style={s.recDivider} />
              <Text style={s.recBlockTitle}>Fees Paid</Text>
              {(receipt?.fees || []).map((f: Fee) => (
                <View key={f.id} style={s.recFeeRow}>
                  <Text style={s.recFeeLabel}>{f.fee_type} · {fmtMonth(f.period_month)}</Text>
                  <Text style={s.recFeeAmt}>{inr(f.amount_due)}</Text>
                </View>
              ))}
              <View style={s.recTotalRow}>
                <Text style={s.recTotalLabel}>Total paid</Text>
                <Text style={s.recTotalAmt}>{inr(receipt?.total_amount || 0)}</Text>
              </View>
              <View style={s.recDivider} />
              <ReceiptRow label="Payment mode" value={receipt?.payment_mode} />
              {receipt?.reference_id && <ReceiptRow label="Reference / Txn ID" value={receipt.reference_id} />}
              <ReceiptRow label="Transaction date" value={receipt?.transaction_date} />
              <ReceiptRow label="Collected by" value={`${receipt?.collected_by?.name} (${receipt?.collected_by?.role.replace("_", " ")})`} />
              <ReceiptRow label="Timestamp" value={new Date(receipt?.paid_at).toLocaleString()} />
            </ScrollView>
            <View style={s.receiptFooter}>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                <TouchableOpacity testID="receipt-download-pdf" onPress={downloadReceiptPdf} style={s.outlineBtnSm}>
                  <Feather name="download" size={14} color={colors.primary} />
                  <Text style={s.outlineBtnTxt}>Download PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity testID="receipt-share" onPress={shareReceipt} style={s.outlineBtnSm}>
                  <Feather name="share-2" size={14} color={colors.primary} />
                  <Text style={s.outlineBtnTxt}>Share Link</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity testID="receipt-close" onPress={() => setReceipt(null)} style={s.primaryBtnSm}>
                <Text style={s.primaryBtnTxt}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryCube({ testID, label, value, tint, highlight }: any) {
  return (
    <View testID={testID} style={[s.sumCube, highlight && { borderColor: tint, borderWidth: 2 }]}>
      <Text style={s.sumLabel}>{label}</Text>
      <Text style={[s.sumValue, { color: tint }]}>{value}</Text>
    </View>
  );
}

function ReceiptRow({ label, value }: { label: string; value: any }) {
  return (
    <View style={s.recRow}>
      <Text style={s.recRowLabel}>{label}</Text>
      <Text style={s.recRowValue}>{value || "—"}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 60 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 16 },
  backBtn: { padding: 8 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.8, color: colors.hint },
  h1: { fontSize: 24, fontWeight: "800", color: colors.ink, marginTop: 2, letterSpacing: -0.5 },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4 },
  filterCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 16 },
  filterLabel: { fontSize: 10, fontWeight: "800", color: colors.hint, letterSpacing: 1.4, marginBottom: 10 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, outlineStyle: "none" as any },
  pillRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 12 },
  pillRowLabel: { fontSize: 11, fontWeight: "800", color: colors.muted },
  pill: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  pillTxtActive: { color: "#fff" },
  sectionLabel: { fontSize: 13, fontWeight: "800", color: colors.ink, marginBottom: 10, marginTop: 8 },
  empty: { color: colors.muted, padding: 24, textAlign: "center" },
  playerRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  playerName: { fontSize: 14, fontWeight: "700", color: colors.ink },
  playerMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  duesHeader: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 12 },
  changeBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surface2, borderRadius: 8 },
  changeBtnTxt: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  cubeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  sumCube: { flex: 1, minWidth: 140, padding: 12, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  sumLabel: { fontSize: 10, color: colors.muted, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  sumValue: { fontSize: 20, fontWeight: "800", marginTop: 4 },
  unpaidHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selectAllBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  selectAllTxt: { color: colors.primary, fontSize: 12, fontWeight: "700" },
  noPartialNote: { fontSize: 11, color: colors.hint, marginBottom: 8, fontStyle: "italic" },
  periodGroupLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, marginTop: 8, marginBottom: 6 },
  advanceBox: { marginTop: 12, backgroundColor: "#F0FDFA", borderWidth: 1, borderColor: "#99F6E4", borderRadius: 12, padding: 12 },
  advanceHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  advanceTitle: { flex: 1, fontSize: 12, fontWeight: "800", color: "#0F766E" },
  feeRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  feeRowChecked: { borderColor: colors.primary, backgroundColor: colors.primarySofter },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  feeType: { fontSize: 13, fontWeight: "700", color: colors.ink },
  feeMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  feeAmt: { fontSize: 14, fontWeight: "800", color: colors.ink },
  allClear: { padding: 22, alignItems: "center", backgroundColor: "#F0FDF4", borderRadius: 12, gap: 6 },
  allClearTxt: { fontSize: 13, color: "#15803D", fontWeight: "700" },
  selectedBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, backgroundColor: colors.primarySofter, borderRadius: 12, marginTop: 12, marginBottom: 16 },
  selectedLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4, color: colors.muted },
  selectedAmt: { fontSize: 22, fontWeight: "800", color: colors.primary },
  selectedCount: { fontSize: 12, fontWeight: "700", color: colors.muted },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  modeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border },
  modeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeBtnTxt: { fontSize: 13, fontWeight: "700", color: colors.muted },
  modeRupee: { fontSize: 16, fontWeight: "900", lineHeight: 18 },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted, marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.ink, outlineStyle: "none" as any },
  primaryBtn: { backgroundColor: colors.primary, padding: 16, borderRadius: 14, alignItems: "center", marginTop: 16 },
  primaryBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: "#fff", borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 6 },
  historyType: { fontSize: 13, fontWeight: "700", color: colors.ink },
  historyMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  historyAmt: { fontSize: 13, fontWeight: "800", color: colors.success },

  // modal
  modalBg: { flex: 1, backgroundColor: "rgba(15,23,42,0.55)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalCard: { backgroundColor: "#fff", borderRadius: 18, width: "100%", maxWidth: 480, maxHeight: "85%", overflow: "hidden" },
  receiptHeader: { padding: 22, alignItems: "center", backgroundColor: colors.primary },
  tickCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  receiptTitle: { color: "#fff", fontWeight: "800", fontSize: 18 },
  receiptSub: { color: "rgba(255,255,255,0.78)", fontSize: 12, marginTop: 4 },
  recRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  recRowLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  recRowValue: { fontSize: 13, color: colors.ink, fontWeight: "700" },
  recDivider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  recBlockTitle: { fontSize: 12, fontWeight: "800", color: colors.muted, marginBottom: 6, letterSpacing: 0.8 },
  recFeeRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  recFeeLabel: { fontSize: 13, color: colors.ink, fontWeight: "600" },
  recFeeAmt: { fontSize: 13, color: colors.ink, fontWeight: "700" },
  recTotalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  recTotalLabel: { fontSize: 14, fontWeight: "800", color: colors.ink },
  recTotalAmt: { fontSize: 16, fontWeight: "800", color: colors.primary },
  receiptFooter: { padding: 14, borderTopWidth: 1, borderTopColor: colors.border },
  primaryBtnSm: { backgroundColor: colors.primary, padding: 13, borderRadius: 10, alignItems: "center" },
  outlineBtnSm: { flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", alignItems: "center", paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: colors.primary, backgroundColor: "#fff" },
  outlineBtnTxt: { color: colors.primary, fontWeight: "700", fontSize: 13 },
});
