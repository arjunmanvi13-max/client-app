/**
 * Collect Fees — compact register layout with table-first desktop view.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, useAuth } from "../../src/auth";
import { colors, radii, spacing } from "../../src/theme";
import { useBreakpoint } from "../../src/useBreakpoint";
import { FeeSummaryBar } from "../../src/components/fees/FeeSummaryBar";
import { CompactFilterBar } from "../../src/components/fees/CompactFilterBar";
import { PlayerFeeRow, PlayerListSkeleton } from "../../src/components/fees/PlayerFeeRow";
import { PlayerFeeTable, TableSkeleton } from "../../src/components/fees/PlayerFeeTable";
import { CollectionDrawer } from "../../src/components/fees/CollectionDrawer";
import { PaymentReceiptModal } from "../../src/components/fees/PaymentReceiptModal";
import { BulkReminderBar } from "../../src/components/fees/BulkReminderBar";
import { inr } from "../../src/components/fees/feesUi";
import type {
  CollectionPlayer, CollectionSummary, FeeSort, FeeStatusFilter, Institution, PaymentReceipt,
} from "../../src/feesCollectionTypes";

export default function FeesCollection() {
  const { user } = useAuth();
  const router = useRouter();
  const { isDesktop, horizontalPadding, contentMaxWidth } = useBreakpoint();
  const defaultInstitution: Institution =
    user?.role === "principal" || user?.role === "vice_principal" ? "PWS" : "ALPHA";

  const [institution, setInstitution] = useState<Institution>(defaultInstitution);
  const [centre, setCentre] = useState<string | null>(null);
  const [sport, setSport] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FeeStatusFilter>("all");
  const [sort, setSort] = useState<FeeSort>("amount_due");
  const [summary, setSummary] = useState<CollectionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState<string[]>([]);

  const [drawerPlayer, setDrawerPlayer] = useState<CollectionPlayer | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);

  const canSwitchInstitution =
    user?.role !== "admin" &&
    user?.role !== "principal" &&
    user?.role !== "vice_principal";

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

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
      if (search) params.search = search;
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
  const overdueCount = useMemo(
    () => players.filter((p) => p.fee_status === "overdue").length,
    [players],
  );

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

  const title = institution === "PWS" ? "Collect Student Fees" : "Collect Player Fees";

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.flex}>
        <ScrollView
          contentContainerStyle={[
            s.scroll,
            { paddingHorizontal: horizontalPadding },
            contentMaxWidth ? { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" } : null,
          ]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadSummary} />}
        >
          <View style={s.headerRow}>
            <TouchableOpacity onPress={() => router.back()} testID="back-btn" style={s.backBtn}>
              <Feather name="chevron-left" size={18} color={colors.muted} />
            </TouchableOpacity>
            <View style={s.headerMain}>
              <Text style={s.overline}>FEES COLLECTION</Text>
              <View style={s.titleRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.h1}>{title}</Text>
                  <Text style={s.sub}>Search a player, select months, and record payment.</Text>
                </View>
                <Pressable
                  onPress={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                  style={[s.selectToggle, selectMode && s.selectToggleActive]}
                  testID="select-mode-toggle"
                >
                  <Feather name="check-square" size={13} color={selectMode ? "#fff" : colors.muted} />
                  <Text style={[s.selectToggleTxt, selectMode && { color: "#fff" }]}>Select</Text>
                </Pressable>
              </View>
            </View>
          </View>

          <FeeSummaryBar
            visibleCount={players.length}
            outstanding={totalDue}
            overdueCount={overdueCount}
            kpis={summary?.kpis}
            loading={loading && !summary}
          />

          <CompactFilterBar
            institution={institution}
            onInstitution={setInstitution}
            showInstitutionSwitch={canSwitchInstitution}
            search={searchInput}
            onSearch={setSearchInput}
            status={statusFilter}
            onStatus={setStatusFilter}
            sort={sort}
            onSort={setSort}
            centre={centre}
            onCentre={setCentre}
            sport={sport}
            onSport={setSport}
            sections={sections}
          />

          {loading && !summary ? (
            isDesktop ? <TableSkeleton /> : <PlayerListSkeleton />
          ) : players.length === 0 ? (
            <View style={s.emptyBox} testID="empty-state">
              <Feather name="inbox" size={28} color={colors.hint} />
              <Text style={s.emptyTitle}>No {institution === "PWS" ? "students" : "players"} match filters</Text>
              <Text style={s.emptySub}>Adjust search or filters to see the fee register.</Text>
            </View>
          ) : isDesktop ? (
            <PlayerFeeTable
              players={players}
              institution={institution}
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onCollect={setDrawerPlayer}
            />
          ) : (
            <View style={s.mobileList}>
              {players.map((p) => (
                <PlayerFeeRow
                  key={p.id}
                  player={p}
                  institution={institution}
                  selectMode={selectMode}
                  selected={selectedIds.has(p.id)}
                  onToggleSelect={() => toggleSelect(p.id)}
                  onCollect={() => setDrawerPlayer(p)}
                />
              ))}
            </View>
          )}

          <View style={{ height: 72 }} />
        </ScrollView>

        <View style={s.stickyFooter} testID="collection-footer">
          <Text style={s.footerTxt}>
            Showing {players.length} of {totalPlayers} · {inr(totalDue)} outstanding
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

      <PaymentReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { paddingTop: spacing.sm, paddingBottom: 64 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginBottom: spacing.sm },
  backBtn: { padding: 6, marginTop: 2 },
  headerMain: { flex: 1 },
  overline: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, color: colors.hint },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 2 },
  h1: { fontSize: 20, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  selectToggle: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.sm,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    marginTop: 2,
  },
  selectToggleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectToggleTxt: { fontSize: 11, fontWeight: "700", color: colors.muted },
  mobileList: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: colors.ink },
  emptySub: { fontSize: 12, color: colors.muted, textAlign: "center" },
  stickyFooter: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  footerTxt: { fontSize: 12, fontWeight: "600", color: colors.muted, textAlign: "center" },
});
