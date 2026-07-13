/**
 * Collect Fees — player/student list with KPIs, filters, inline drawer collection.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  RefreshControl, Modal, Pressable, Platform, Linking, Share, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, useAuth } from "../../src/auth";
import { colors } from "../../src/theme";
import { formatDate, formatDateTime, formatMonth } from "../../src/dateFormat";
import { FeeSummaryBar } from "../../src/components/fees/FeeSummaryBar";
import { StatusFilterChips } from "../../src/components/fees/StatusFilterChips";
import { PlayerFeeRow, PlayerListSkeleton } from "../../src/components/fees/PlayerFeeRow";
import { CollectionDrawer } from "../../src/components/fees/CollectionDrawer";
import { BulkReminderBar } from "../../src/components/fees/BulkReminderBar";
import type {
  CollectionPlayer, CollectionSummary, FeeSort, FeeStatusFilter, Institution,
} from "../../src/feesCollectionTypes";

const CENTRES = ["Balua", "Harding Park"] as const;
const SPORTS = ["Cricket", "Football"] as const;

function inr(n: number) {
  if (n == null) return "—";
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function FeesCollection() {
  const { user } = useAuth();
  const router = useRouter();
  const defaultInstitution: Institution =
    user?.role === "principal" || user?.role === "vice_principal" ? "PWS" : "ALPHA";

  const [institution, setInstitution] = useState<Institution>(defaultInstitution);
  const [centre, setCentre] = useState<string | null>(null);
  const [sport, setSport] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FeeStatusFilter>("all");
  const [sort, setSort] = useState<FeeSort>("amount_due");
  const [summary, setSummary] = useState<CollectionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<string[]>([]);

  const [drawerPlayer, setDrawerPlayer] = useState<CollectionPlayer | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [receipt, setReceipt] = useState<any | null>(null);

  const loadSections = useCallback(async () => {
    if (institution !== "PWS") return;
    try {
      const { data } = await api.get("/people", { params: { kind: "student", institution: "PWS" } });
      const groups = Array.from(new Set((data || []).map((p: any) => p.group).filter(Boolean))) as string[];
      setSections(groups.slice(0, 12));
    } catch {
      setSections([]);
    }
  }, [institution]);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        institution,
        status: statusFilter,
        sort,
      };
      if (institution === "ALPHA") {
        if (centre) params.centre = centre;
        if (sport) params.sport = sport;
      } else if (centre) {
        params.group = centre;
      }
      if (search.trim()) params.search = search.trim();
      const { data } = await api.get("/fees/summary", { params });
      setSummary(data);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [institution, centre, sport, search, statusFilter, sort]);

  useEffect(() => { loadSections(); }, [loadSections]);
  useEffect(() => {
    setSelectedIds(new Set());
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    setCentre(null);
    setSport(null);
    setStatusFilter("all");
  }, [institution]);

  const players = summary?.players || [];
  const totalPlayers = summary?.kpis.total_players || 0;
  const totalDue = summary?.total_due || 0;

  const selectedOverdueIds = useMemo(() => {
    const overdue = new Set(players.filter((p) => p.fee_status === "overdue").map((p) => p.id));
    return Array.from(selectedIds).filter((id) => overdue.has(id));
  }, [selectedIds, players]);

  const allSelectedOverdue = selectedIds.size > 0 && selectedOverdueIds.length === selectedIds.size;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const receiptPdfUrl = () => `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/fees/receipt/${receipt?.batch_id}/pdf`;

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.flex}>
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadSummary} />}
        >
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => router.back()} testID="back-btn" style={s.backBtn}>
              <Feather name="chevron-left" size={20} color={colors.muted} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={s.overline}>FEES COLLECTION</Text>
              <Text style={s.h1}>
                {institution === "PWS" ? "Collect Student Fees" : "Collect Player Fees"}
              </Text>
            </View>
            <Pressable
              onPress={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
              style={[s.selectToggle, selectMode && s.selectToggleActive]}
              testID="select-mode-toggle"
            >
              <Feather name="check-square" size={14} color={selectMode ? "#fff" : colors.muted} />
              <Text style={[s.selectToggleTxt, selectMode && { color: "#fff" }]}>Select</Text>
            </Pressable>
          </View>

          <FeeSummaryBar kpis={summary?.kpis} loading={loading && !summary} />

          <View style={s.filterCard}>
            <Text style={s.filterLabel}>INSTITUTION</Text>
            <View style={s.pillRow}>
              {(["PWS", "ALPHA"] as const).map((inst) => {
                const active = institution === inst;
                const locked =
                  (user?.role === "admin" && inst === "PWS") ||
                  ((user?.role === "principal" || user?.role === "vice_principal") && inst === "ALPHA");
                if (locked) return null;
                return (
                  <Pressable
                    key={inst}
                    testID={`inst-${inst}`}
                    onPress={() => setInstitution(inst)}
                    style={[s.pill, active && s.pillActive]}
                  >
                    <Text style={[s.pillTxt, active && s.pillTxtActive]}>
                      {inst === "PWS" ? "PWS School" : "ALPHA Sports"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[s.filterLabel, { marginTop: 12 }]}>SEARCH</Text>
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
                      <Pressable
                        key={String(c)}
                        testID={`centre-${c ?? "all"}`}
                        onPress={() => setCentre(c)}
                        style={[s.pill, active && s.pillActive]}
                      >
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
                      <Pressable
                        key={String(sp)}
                        testID={`sport-${sp ?? "all"}`}
                        onPress={() => setSport(sp)}
                        style={[s.pill, active && s.pillActive]}
                      >
                        <Text style={[s.pillTxt, active && s.pillTxtActive]}>{sp ?? "All"}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <View style={s.pillRow}>
                <Text style={s.pillRowLabel}>SECTION</Text>
                {[null, ...sections].map((g) => {
                  const active = (g ?? "all") === (centre ?? "all");
                  return (
                    <Pressable
                      key={String(g)}
                      testID={`section-${g ?? "all"}`}
                      onPress={() => setCentre(g)}
                      style={[s.pill, active && s.pillActive]}
                    >
                      <Text style={[s.pillTxt, active && s.pillTxtActive]}>{g ?? "All"}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <StatusFilterChips
              status={statusFilter}
              sort={sort}
              onStatus={setStatusFilter}
              onSort={setSort}
            />
          </View>

          <Text style={s.sectionLabel}>
            {institution === "PWS" ? "Students" : "Players"} ({players.length})
          </Text>

          {loading && !summary ? (
            <PlayerListSkeleton />
          ) : players.length === 0 ? (
            <Text style={s.empty}>No {institution === "PWS" ? "students" : "players"} match filters.</Text>
          ) : (
            players.map((p) => (
              <PlayerFeeRow
                key={p.id}
                player={p}
                institution={institution}
                selectMode={selectMode}
                selected={selectedIds.has(p.id)}
                onToggleSelect={() => toggleSelect(p.id)}
                onCollect={() => setDrawerPlayer(p)}
              />
            ))
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={s.stickyFooter} testID="collection-footer">
          <Text style={s.footerTxt}>
            Showing {players.length} of {totalPlayers} {institution === "PWS" ? "students" : "players"}
            {" · "}{inr(totalDue)} total due
          </Text>
        </View>
      </View>

      <CollectionDrawer
        player={drawerPlayer}
        institution={institution}
        visible={!!drawerPlayer}
        onClose={() => setDrawerPlayer(null)}
        onCollected={(data) => {
          setReceipt(data);
          loadSummary();
        }}
      />

      {selectMode && allSelectedOverdue && (
        <BulkReminderBar
          count={selectedOverdueIds.length}
          playerIds={selectedOverdueIds}
          onClear={() => setSelectedIds(new Set())}
          onDone={() => { setSelectedIds(new Set()); setSelectMode(false); }}
        />
      )}

      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </SafeAreaView>
  );
}

function ReceiptModal({ receipt, onClose }: { receipt: any; onClose: () => void }) {
  if (!receipt) return null;
  const download = () => {
    const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/fees/receipt/${receipt.batch_id}/pdf`;
    if (Platform.OS === "web") window.open(url, "_blank");
    else Linking.openURL(url);
  };
  const share = async () => {
    const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/fees/receipt/${receipt.batch_id}/pdf`;
    if (Platform.OS === "web") {
      try {
        await navigator.clipboard.writeText(url);
        window.alert("Receipt link copied.");
      } catch {
        window.prompt("Copy link:", url);
      }
    } else {
      await Share.share({ message: `Receipt — ${receipt?.player?.name}\n${url}` });
    }
  };
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.modalBg}>
        <View style={s.modalCard}>
          <View style={s.receiptHeader}>
            <View style={s.tickCircle}><Feather name="check" size={22} color="#fff" /></View>
            <Text style={s.receiptTitle}>Payment Successful</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <ReceiptRow label="Name" value={receipt?.player?.name} />
            <ReceiptRow label="Total" value={inr(receipt?.total_amount || 0)} />
            <ReceiptRow label="Mode" value={receipt?.payment_mode} />
            <ReceiptRow label="Collected by" value={receipt?.collected_by?.name} />
            {(receipt?.fees || []).map((f: any) => (
              <View key={f.id} style={s.recFeeRow}>
                <Text>{f.fee_type} · {formatMonth(f.period_month)}</Text>
                <Text>{inr(f.amount_due)}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={s.receiptFooter}>
            <TouchableOpacity onPress={download} style={s.outlineBtnSm}>
              <Feather name="download" size={14} color={colors.primary} />
              <Text style={s.outlineBtnTxt}>Download PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={share} style={s.outlineBtnSm}>
              <Feather name="share-2" size={14} color={colors.primary} />
              <Text style={s.outlineBtnTxt}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={s.primaryBtnSm}>
              <Text style={s.primaryBtnTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
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
  flex: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 80 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 12 },
  backBtn: { padding: 8 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.8, color: colors.hint },
  h1: { fontSize: 24, fontWeight: "800", color: colors.ink, marginTop: 2 },
  selectToggle: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff",
  },
  selectToggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectToggleTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  filterCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border, marginBottom: 16,
  },
  filterLabel: { fontSize: 10, fontWeight: "800", color: colors.hint, letterSpacing: 1.4, marginBottom: 8 },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 4,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, outlineStyle: "none" as any },
  pillRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 },
  pillRowLabel: { fontSize: 11, fontWeight: "800", color: colors.muted },
  pill: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  pillTxtActive: { color: "#fff" },
  sectionLabel: { fontSize: 13, fontWeight: "800", color: colors.ink, marginBottom: 10 },
  empty: { color: colors.muted, padding: 24, textAlign: "center" },
  stickyFooter: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: colors.border,
  },
  footerTxt: { fontSize: 13, fontWeight: "700", color: colors.ink, textAlign: "center" },
  modalBg: { flex: 1, backgroundColor: "rgba(15,23,42,0.55)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#fff", borderRadius: 18, maxHeight: "85%", overflow: "hidden" },
  receiptHeader: { padding: 22, alignItems: "center", backgroundColor: colors.primary },
  tickCircle: {
    width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center", marginBottom: 10,
  },
  receiptTitle: { color: "#fff", fontWeight: "800", fontSize: 18 },
  recRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  recRowLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  recRowValue: { fontSize: 13, color: colors.ink, fontWeight: "700" },
  recFeeRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  receiptFooter: { padding: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  outlineBtnSm: {
    flexDirection: "row", gap: 6, justifyContent: "center", alignItems: "center",
    paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: colors.primary,
  },
  outlineBtnTxt: { color: colors.primary, fontWeight: "700" },
  primaryBtnSm: { backgroundColor: colors.primary, padding: 13, borderRadius: 10, alignItems: "center" },
  primaryBtnTxt: { color: "#fff", fontWeight: "700" },
});
