import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { colors, formColors, radii, spacing } from "./theme";
import { useBreakpoint } from "./useBreakpoint";
import type { CoachDataScope } from "./coachAccess";
import { coachSportAssignmentMessage } from "./coachAccess";
import type { FormSelectOption } from "./components/forms/FormSelect";
import { FilterSelect, filterSelectSlotStyle, TOOLBAR_CONTROL_HEIGHT } from "./components/FilterSelect";

const BOARDING_TYPES = ["Daily", "Day Boarding", "Hostel", "Boarding"] as const;
const PLAYER_SPORTS = ["Cricket", "Football"] as const;
const CENTRES = ["Balua", "Harding Park"] as const;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const PLAYER_GREEN = "#10B981";

function sportAvatarStyle(sport?: string) {
  if (sport === "Cricket") return { bg: "#DBEAFE", text: "#1D4ED8" };
  if (sport === "Football") return { bg: "#DCFCE7", text: "#15803D" };
  return { bg: "#F1F5F9", text: "#475569" };
}

function sportBadgeStyle(sport?: string) {
  if (sport === "Cricket") return { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" };
  if (sport === "Football") return { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" };
  return { bg: "#F9FAFB", text: "#475569", border: "#E5E7EB" };
}

function typeBadgeStyle(type?: string) {
  const t = (type || "").toLowerCase();
  if (t.includes("hostel")) return { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" };
  if (t.includes("boarding")) return { bg: "#F3E8FF", text: "#7E22CE", border: "#E9D5FF" };
  if (t.includes("daily")) return { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0" };
  return { bg: "#F9FAFB", text: "#475569", border: "#E5E7EB" };
}

type PlayerRosterListViewProps = {
  items: any[];
  loading: boolean;
  search: string;
  debouncedSearch: string;
  setSearch: (v: string) => void;
  onSearchSubmit: () => void;
  onClearSearch: () => void;
  showDeactivated: boolean;
  setShowDeactivated: (v: boolean) => void;
  sportFilter: string | null;
  setSportFilter: (v: string | null) => void;
  typeFilter: string | null;
  setTypeFilter: (v: string | null) => void;
  centreFilter: string | null;
  setCentreFilter: (v: string | null) => void;
  canBrowseAllSports: boolean;
  isCoachPlayerView: boolean;
  coachScope: CoachDataScope;
  isAdmin: boolean;
  coachBlocked: boolean;
  canAdd: boolean;
  onAdd: () => void;
  onBack: () => void;
  onOpenPlayer: (id: string) => void;
};

export function PlayerRosterListView({
  items,
  loading,
  search,
  debouncedSearch,
  setSearch,
  onSearchSubmit,
  onClearSearch,
  showDeactivated,
  setShowDeactivated,
  sportFilter,
  setSportFilter,
  typeFilter,
  setTypeFilter,
  centreFilter,
  setCentreFilter,
  canBrowseAllSports,
  isCoachPlayerView,
  coachScope,
  isAdmin,
  coachBlocked,
  canAdd,
  onAdd,
  onBack,
  onOpenPlayer,
}: PlayerRosterListViewProps) {
  const { horizontalPadding, contentMaxWidth, isDesktop } = useBreakpoint();
  const [searchFocused, setSearchFocused] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const pageStyle = {
    paddingHorizontal: horizontalPadding,
    maxWidth: contentMaxWidth,
    alignSelf: contentMaxWidth ? ("center" as const) : undefined,
    width: contentMaxWidth ? ("100%" as const) : undefined,
  };

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(safePage * pageSize, total);
  const pageItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  const activeSearch = debouncedSearch.trim();
  const isSearching = activeSearch.length > 0;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, showDeactivated, sportFilter, typeFilter, centreFilter, total, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const statusOptions: FormSelectOption[] = [
    { value: "active", label: "Active" },
    { value: "all", label: "All status" },
  ];

  const sportOptions: FormSelectOption[] = canBrowseAllSports
    ? [{ value: "", label: "All sports" }, ...PLAYER_SPORTS.map((sp) => ({ value: sp, label: sp }))]
    : coachScope.assignedSport
      ? [{ value: coachScope.assignedSport, label: coachScope.assignedSport }]
      : [];

  const typeOptions: FormSelectOption[] = [
    { value: "", label: "All types" },
    ...BOARDING_TYPES.map((t) => ({ value: t, label: t })),
  ];

  const locationOptions: FormSelectOption[] = [
    { value: "", label: "All locations" },
    ...CENTRES.map((c) => ({ value: c, label: c })),
  ];

  const pageSizeOptions: FormSelectOption[] = PAGE_SIZE_OPTIONS.map((n) => ({
    value: String(n),
    label: `${n} / page`,
  }));

  const showSportFilter = canBrowseAllSports || (isCoachPlayerView && !!coachScope.assignedSport);

  const tableHeader = (
    <View style={[s.tableRow, s.tableHead]}>
      <Text style={[s.th, s.colPlayer]}>Player</Text>
      <Text style={[s.th, s.colId]}>Player ID</Text>
      <Text style={[s.th, s.colSport]}>Sport</Text>
      <Text style={[s.th, s.colLocation]}>Location</Text>
      <Text style={[s.th, s.colType]}>Type</Text>
      <View style={s.colActions} />
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={[s.shell, pageStyle]}>
        <View style={s.topBar}>
          <View style={s.topBarLeft}>
            <TouchableOpacity onPress={onBack} style={s.backBtn} testID="list-back">
              <Feather name="chevron-left" size={20} color={colors.ink} />
            </TouchableOpacity>
            <Text style={s.h1}>Players</Text>
            <View style={s.countBadge}>
              <Text style={s.countBadgeTxt}>
                {isSearching
                  ? `${total} matching`
                  : `${total} record${total !== 1 ? "s" : ""}`}
              </Text>
            </View>
            {isCoachPlayerView && coachScope.assignedSport && !coachScope.requiresSportAssignment && (
              <View style={s.scopeBadge}>
                <Feather name="lock" size={10} color="#1D4ED8" />
                <Text style={s.scopeText}>{coachScope.assignedSport}</Text>
              </View>
            )}
          </View>
          {!coachBlocked && (
            <TouchableOpacity
              testID="add-player"
              style={[s.addBtn, !canAdd && { opacity: 0.45 }]}
              disabled={!canAdd}
              onPress={onAdd}
            >
              <Feather name="plus" size={15} color="#fff" />
              <Text style={s.addText}>Add Player</Text>
            </TouchableOpacity>
          )}
        </View>

        {!coachBlocked && (
          <View style={s.toolbar}>
            <View style={[s.searchWrap, searchFocused && s.searchWrapFocused]}>
              <Feather name="search" size={14} color={searchFocused ? PLAYER_GREEN : colors.hint} />
              <TextInput
                testID="people-search"
                value={search}
                onChangeText={setSearch}
                placeholder="Search name, ID, sport, location…"
                placeholderTextColor={colors.hint}
                style={s.searchInput}
                onSubmitEditing={onSearchSubmit}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={onClearSearch} hitSlop={8} testID="clear-search">
                  <Feather name="x" size={14} color={colors.hint} />
                </TouchableOpacity>
              )}
            </View>

            {isAdmin && (
              <View style={filterSelectSlotStyle}>
                <FilterSelect
                  testID="toggle-status"
                  value={showDeactivated ? "all" : "active"}
                  options={statusOptions}
                  onChange={(v) => setShowDeactivated(v === "all")}
                />
              </View>
            )}

            {showSportFilter && sportOptions.length > 0 && (
              <View style={filterSelectSlotStyle}>
                <FilterSelect
                  testID="sport-filter"
                  value={sportFilter || ""}
                  options={sportOptions}
                  disabled={isCoachPlayerView}
                  onChange={(v) => setSportFilter(v || null)}
                />
              </View>
            )}

            <View style={filterSelectSlotStyle}>
              <FilterSelect
                testID="ptype-filter"
                value={typeFilter || ""}
                options={typeOptions}
                onChange={(v) => setTypeFilter(v || null)}
              />
            </View>

            <View style={filterSelectSlotStyle}>
              <FilterSelect
                testID="centre-filter"
                value={centreFilter || ""}
                options={locationOptions}
                onChange={(v) => setCentreFilter(v || null)}
              />
            </View>
          </View>
        )}

        {coachBlocked && (
          <View style={s.blockedBox}>
            <Feather name="alert-circle" size={24} color="#DC2626" />
            <Text style={s.blockedTitle}>Sport assignment required</Text>
            <Text style={s.blockedText}>{coachSportAssignmentMessage(coachScope)}</Text>
          </View>
        )}

        {!coachBlocked && (
          <View style={s.tableShell}>
            {loading ? (
              <ActivityIndicator color={PLAYER_GREEN} style={s.loader} />
            ) : total === 0 ? (
              <View style={s.empty}>
                <Feather name="users" size={32} color={colors.hint} />
                <Text style={s.emptyText}>
                  {isSearching ? "No matching players found." : "No players yet. Tap Add Player to create one."}
                </Text>
                {isSearching && (
                  <TouchableOpacity style={s.clearSearchBtn} onPress={onClearSearch} testID="empty-clear-search">
                    <Feather name="x-circle" size={14} color={PLAYER_GREEN} />
                    <Text style={s.clearSearchTxt}>Clear search</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={!isDesktop} style={s.tableHoriz}>
                <View style={[s.table, !isDesktop && s.tableWide]}>
                  {tableHeader}
                  <ScrollView style={s.tableBodyScroll} nestedScrollEnabled showsVerticalScrollIndicator={isDesktop}>
                    {pageItems.map((it) => {
                      const isDeact = it.status === "deactivated";
                      const isPendingFee = it.status === "pending_fee_approval";
                      const initials = it.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("");
                      const avatar = sportAvatarStyle(it.sport);
                      const sportBadge = sportBadgeStyle(it.sport);
                      const typeLabel = it.player_type === "Hostel Only" ? "Hostel" : it.player_type;
                      const typeBadge = typeBadgeStyle(typeLabel);

                      return (
                        <Pressable
                          key={it.id}
                          testID={`row-${it.id}`}
                          onPress={() => onOpenPlayer(it.id)}
                          style={({ hovered }: any) => [s.tableRow, s.tableBodyRow, hovered && s.tableRowHover]}
                        >
                          <View style={[s.colPlayer, s.playerCell]}>
                            <View style={[s.avatar, { backgroundColor: isDeact ? "#E2E8F0" : avatar.bg }]}>
                              <Text style={[s.avatarTxt, { color: isDeact ? "#64748B" : avatar.text }]}>
                                {initials}
                              </Text>
                            </View>
                            <View style={s.playerMeta}>
                              <View style={s.playerNameRow}>
                                <Text style={[s.playerName, isDeact && s.playerNameDeact]} numberOfLines={1}>
                                  {it.name}
                                </Text>
                                {isDeact && (
                                  <View style={s.inactivePill}>
                                    <Text style={s.inactivePillTxt}>Inactive</Text>
                                  </View>
                                )}
                                {isPendingFee && (
                                  <View style={s.pendingFeePill}>
                                    <Text style={s.pendingFeePillTxt}>Pending fee</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={s.playerSub} numberOfLines={1}>
                                {[it.player_id, it.sport, it.centre].filter(Boolean).join(" · ") || "—"}
                              </Text>
                            </View>
                          </View>

                          <Text style={[s.td, s.colId, s.idCell]} numberOfLines={1}>
                            {it.player_id || "—"}
                          </Text>

                          <View style={s.colSport}>
                            {it.sport ? (
                              <View style={[s.tagBadge, { backgroundColor: sportBadge.bg, borderColor: sportBadge.border }]}>
                                <Text style={[s.tagBadgeTxt, { color: sportBadge.text }]}>{it.sport}</Text>
                              </View>
                            ) : (
                              <Text style={s.dash}>—</Text>
                            )}
                          </View>

                          <Text style={[s.td, s.colLocation]} numberOfLines={1}>{it.centre || "—"}</Text>

                          <View style={s.colType}>
                            {typeLabel ? (
                              <View style={[s.tagBadge, { backgroundColor: typeBadge.bg, borderColor: typeBadge.border }]}>
                                <Text style={[s.tagBadgeTxt, { color: typeBadge.text }]}>{typeLabel}</Text>
                              </View>
                            ) : (
                              <Text style={s.dash}>—</Text>
                            )}
                          </View>

                          <View style={s.colActions}>
                            <Pressable
                              testID={`view-${it.id}`}
                              onPress={() => onOpenPlayer(it.id)}
                              style={({ hovered }: any) => [s.actionBtn, hovered && s.actionBtnHover]}
                            >
                              <Feather name="chevron-right" size={16} color={colors.hint} />
                            </Pressable>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </ScrollView>
            )}
          </View>
        )}

        {!coachBlocked && !loading && total > 0 && (
          <View style={s.footer}>
            <Text style={s.footerText}>
              {isSearching
                ? `Showing ${startIdx}–${endIdx} of ${total} matching players`
                : `Showing ${startIdx}–${endIdx} of ${total} players`}
            </Text>
            <View style={s.footerRight}>
              <View style={s.pageSizeSlot}>
                <FilterSelect
                  testID="page-size"
                  value={String(pageSize)}
                  options={pageSizeOptions}
                  onChange={(v) => setPageSize(Number(v) || 10)}
                />
              </View>
              <View style={s.pagination}>
                <TouchableOpacity
                  testID="page-prev"
                  style={[s.pageBtn, safePage <= 1 && s.pageBtnDisabled]}
                  disabled={safePage <= 1}
                  onPress={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <Feather name="chevron-left" size={15} color={safePage <= 1 ? colors.hint : colors.ink} />
                </TouchableOpacity>
                <Text style={s.pageIndicator}>{safePage} / {totalPages}</Text>
                <TouchableOpacity
                  testID="page-next"
                  style={[s.pageBtn, safePage >= totalPages && s.pageBtnDisabled]}
                  disabled={safePage >= totalPages}
                  onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <Feather name="chevron-right" size={15} color={safePage >= totalPages ? colors.hint : colors.ink} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: formColors.pageBg },
  shell: {
    flex: 1,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
    minHeight: 0,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  topBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
    flexWrap: "wrap",
  },
  backBtn: { padding: 4, marginLeft: -4 },
  h1: { fontSize: 22, fontWeight: "800", color: colors.ink, letterSpacing: -0.3 },
  countBadge: {
    backgroundColor: "#F1F5F9",
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countBadgeTxt: { fontSize: 11, fontWeight: "600", color: colors.muted2 },
  scopeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  scopeText: { color: "#1D4ED8", fontWeight: "700", fontSize: 10 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: PLAYER_GREEN,
    paddingHorizontal: 12,
    height: TOOLBAR_CONTROL_HEIGHT,
    borderRadius: radii.md,
    flexShrink: 0,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  addText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchWrap: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    height: TOOLBAR_CONTROL_HEIGHT,
    ...Platform.select({
      web: { transition: "border-color 0.15s ease, box-shadow 0.15s ease" } as object,
      default: {},
    }),
  },
  searchWrapFocused: {
    borderColor: PLAYER_GREEN,
    backgroundColor: colors.surface,
    ...Platform.select({
      web: { boxShadow: "0 0 0 3px rgba(16, 185, 129, 0.12)" } as object,
      default: {},
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
    padding: 0,
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
  tableShell: {
    flex: 1,
    minHeight: 200,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)" } as object,
      default: {},
    }),
  },
  tableHoriz: { flex: 1 },
  table: { flex: 1, minWidth: "100%" },
  tableWide: { minWidth: 820 },
  tableBodyScroll: { flex: 1, maxHeight: Platform.OS === "web" ? 520 : 480 },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  tableHead: {
    height: 36,
    backgroundColor: "#FAFBFC",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    ...Platform.select({
      web: { position: "sticky", top: 0, zIndex: 2 } as object,
      default: {},
    }),
  },
  tableBodyRow: {
    minHeight: 44,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  tableRowHover: Platform.select({
    web: { backgroundColor: "#F9FAFB" } as object,
    default: {},
  }),
  th: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.muted2,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  td: { fontSize: 12, color: colors.ink },
  colPlayer: { flex: 2.6, minWidth: 200 },
  colId: { flex: 1, minWidth: 88 },
  colSport: { flex: 0.9, minWidth: 80 },
  colLocation: { flex: 1, minWidth: 90 },
  colType: { flex: 0.9, minWidth: 80 },
  colActions: { width: 32, alignItems: "flex-end" },
  playerCell: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarTxt: { fontWeight: "800", fontSize: 10 },
  playerMeta: { flex: 1, minWidth: 0, gap: 1 },
  playerNameRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  playerName: { fontSize: 13, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  playerNameDeact: { color: colors.muted2 },
  playerSub: { fontSize: 11, color: colors.hint, fontWeight: "500" },
  inactivePill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.pill,
  },
  inactivePillTxt: { fontSize: 8, fontWeight: "800", color: "#64748B" },
  pendingFeePill: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  pendingFeePillTxt: { fontSize: 8, fontWeight: "800", color: "#B45309" },
  idCell: {
    color: colors.muted,
    fontWeight: "600",
    fontSize: 11,
    fontFamily: Platform.select({ web: "ui-monospace, SFMono-Regular, Menlo, monospace", default: undefined }),
  },
  tagBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tagBadgeTxt: { fontSize: 10, fontWeight: "700" },
  dash: { fontSize: 12, color: colors.hint },
  actionBtn: {
    padding: 4,
    borderRadius: radii.sm,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  actionBtnHover: Platform.select({
    web: { backgroundColor: "#F3F4F6" } as object,
    default: {},
  }),
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    ...Platform.select({
      web: { position: "sticky", bottom: 0, zIndex: 2 } as object,
      default: {},
    }),
  },
  footerText: { fontSize: 12, color: colors.muted2, fontWeight: "500" },
  footerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  pageSizeSlot: { width: 108 },
  pagination: { flexDirection: "row", alignItems: "center", gap: 4 },
  pageBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  pageBtnDisabled: { opacity: 0.45 },
  pageIndicator: { fontSize: 12, fontWeight: "700", color: colors.muted2, minWidth: 44, textAlign: "center" },
  loader: { marginTop: 48 },
  empty: { alignItems: "center", padding: 32, gap: 8 },
  emptyText: { color: colors.muted, textAlign: "center", fontSize: 13 },
  clearSearchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    backgroundColor: "#ECFDF5",
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  clearSearchTxt: { fontSize: 12, fontWeight: "700", color: PLAYER_GREEN },
  blockedBox: {
    padding: 16,
    backgroundColor: "#FEF2F2",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    gap: 6,
  },
  blockedTitle: { fontSize: 15, fontWeight: "800", color: "#991B1B" },
  blockedText: { textAlign: "center", color: "#7F1D1D", lineHeight: 18, fontSize: 13 },
});
