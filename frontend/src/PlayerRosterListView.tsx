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
import { FilterSelect, filterSelectSlotStyle } from "./components/FilterSelect";

const BOARDING_TYPES = ["Daily", "Day Boarding", "Hostel", "Boarding"] as const;
const PLAYER_SPORTS = ["Cricket", "Football"] as const;
const CENTRES = ["Balua", "Harding Park"] as const;
const PAGE_SIZE = 10;

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

type PlayerRosterListViewProps = {
  items: any[];
  loading: boolean;
  search: string;
  setSearch: (v: string) => void;
  onSearchSubmit: () => void;
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
  setSearch,
  onSearchSubmit,
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

  const pageStyle = {
    paddingHorizontal: horizontalPadding,
    maxWidth: contentMaxWidth,
    alignSelf: contentMaxWidth ? ("center" as const) : undefined,
    width: contentMaxWidth ? ("100%" as const) : undefined,
  };

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIdx = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, total);
  const pageItems = items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, showDeactivated, sportFilter, typeFilter, centreFilter, total]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const statusOptions: FormSelectOption[] = [
    { value: "active", label: "Active" },
    { value: "all", label: "All (incl. inactive)" },
  ];

  const sportOptions: FormSelectOption[] = canBrowseAllSports
    ? [{ value: "", label: "All Sports" }, ...PLAYER_SPORTS.map((sp) => ({ value: sp, label: sp }))]
    : coachScope.assignedSport
      ? [{ value: coachScope.assignedSport, label: coachScope.assignedSport }]
      : [];

  const typeOptions: FormSelectOption[] = [
    { value: "", label: "All Types" },
    ...BOARDING_TYPES.map((t) => ({ value: t, label: t })),
  ];

  const locationOptions: FormSelectOption[] = [
    { value: "", label: "All Locations" },
    ...CENTRES.map((c) => ({ value: c, label: c })),
  ];

  const showSportFilter = canBrowseAllSports || (isCoachPlayerView && !!coachScope.assignedSport);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={[s.page, pageStyle]}>
        <View style={s.headerSection}>
          <View style={s.titleRow}>
            <TouchableOpacity onPress={onBack} style={s.backBtn} testID="list-back">
              <Feather name="chevron-left" size={22} color={colors.ink} />
            </TouchableOpacity>
            <View style={s.titleGroup}>
              <Text style={s.h1}>Players</Text>
              <View style={s.countBadge}>
                <Text style={s.countBadgeTxt}>
                  {search.trim()
                    ? `${total} matching record${total !== 1 ? "s" : ""}`
                    : `${total} record${total !== 1 ? "s" : ""}`}
                </Text>
              </View>
            </View>
            {isCoachPlayerView && coachScope.assignedSport && !coachScope.requiresSportAssignment && (
              <View style={s.scopeBadge}>
                <Feather name="lock" size={11} color="#1D4ED8" />
                <Text style={s.scopeText}>{coachScope.assignedSport} only</Text>
              </View>
            )}
          </View>

          {!coachBlocked && (
            <View style={s.toolbarRow}>
              <View style={[s.searchWrap, searchFocused && s.searchWrapFocused]}>
                <Feather name="search" size={15} color={searchFocused ? colors.primary : colors.hint} />
                <TextInput
                  testID="people-search"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search name, ID, phone…"
                  placeholderTextColor={colors.hint}
                  style={s.searchInput}
                  onSubmitEditing={onSearchSubmit}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                    <Feather name="x" size={15} color={colors.hint} />
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

              <TouchableOpacity
                testID="add-player"
                style={[s.addBtn, !canAdd && { opacity: 0.45 }]}
                disabled={!canAdd}
                onPress={onAdd}
              >
                <Feather name="plus" size={16} color="#fff" />
                <Text style={s.addText}>Add Player</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {coachBlocked && (
          <View style={s.blockedBox}>
            <Feather name="alert-circle" size={28} color="#DC2626" />
            <Text style={s.blockedTitle}>Sport assignment required</Text>
            <Text style={s.blockedText}>{coachSportAssignmentMessage(coachScope)}</Text>
          </View>
        )}

        {!coachBlocked && (
          <>
            {loading ? (
              <ActivityIndicator color="#16A34A" style={{ marginTop: 32 }} />
            ) : total === 0 ? (
              <View style={s.empty}>
                <Feather name="users" size={36} color={colors.hint} />
                <Text style={s.emptyText}>
                  {search.trim()
                    ? `No matches for "${search.trim()}".`
                    : "No players yet. Tap Add Player to create one."}
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={isDesktop ? false : true}>
                <View style={[s.table, !isDesktop && s.tableWide]}>
                  <View style={[s.tableRow, s.tableHead]}>
                    <Text style={[s.th, s.colPlayer]}>Player</Text>
                    <Text style={[s.th, s.colId]}>Player ID</Text>
                    <Text style={[s.th, s.colSport]}>Sport</Text>
                    <Text style={[s.th, s.colLocation]}>Location</Text>
                    <Text style={[s.th, s.colType]}>Type</Text>
                    <View style={s.colActions} />
                  </View>

                  {pageItems.map((it) => {
                    const isDeact = it.status === "deactivated";
                    const initials = it.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("");
                    const avatar = sportAvatarStyle(it.sport);
                    const sportBadge = sportBadgeStyle(it.sport);
                    const typeLabel = it.player_type === "Hostel Only" ? "Hostel" : it.player_type;

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
                          <View style={s.playerNameWrap}>
                            <Text style={[s.playerName, isDeact && s.playerNameDeact]}>{it.name}</Text>
                            {isDeact && (
                              <View style={s.inactivePill}>
                                <Text style={s.inactivePillTxt}>Inactive</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        <Text style={[s.td, s.colId, s.idCell]}>
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

                        <Text style={[s.td, s.colLocation]}>{it.centre || "—"}</Text>

                        <View style={s.colType}>
                          {typeLabel ? (
                            <View style={s.typeBadge}>
                              <Text style={s.typeBadgeTxt}>{typeLabel}</Text>
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
                            <Feather name="more-vertical" size={16} color={colors.muted2} />
                          </Pressable>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {!loading && total > 0 && (
              <View style={s.footer}>
                <Text style={s.footerText}>
                  Showing {startIdx}–{endIdx} of {total} player{total !== 1 ? "s" : ""}
                </Text>
                <View style={s.pagination}>
                  <TouchableOpacity
                    testID="page-prev"
                    style={[s.pageBtn, safePage <= 1 && s.pageBtnDisabled]}
                    disabled={safePage <= 1}
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <Feather name="chevron-left" size={16} color={safePage <= 1 ? colors.hint : colors.ink} />
                    <Text style={[s.pageBtnTxt, safePage <= 1 && s.pageBtnTxtDisabled]}>Previous</Text>
                  </TouchableOpacity>
                  <Text style={s.pageIndicator}>
                    {safePage} / {totalPages}
                  </Text>
                  <TouchableOpacity
                    testID="page-next"
                    style={[s.pageBtn, safePage >= totalPages && s.pageBtnDisabled]}
                    disabled={safePage >= totalPages}
                    onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <Text style={[s.pageBtnTxt, safePage >= totalPages && s.pageBtnTxtDisabled]}>Next</Text>
                    <Feather name="chevron-right" size={16} color={safePage >= totalPages ? colors.hint : colors.ink} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: formColors.pageBg },
  page: { paddingTop: spacing.lg, paddingBottom: 48, gap: spacing.lg },
  headerSection: { gap: spacing.md },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  backBtn: { padding: 6, marginLeft: -6 },
  titleGroup: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink, letterSpacing: -0.4 },
  countBadge: {
    backgroundColor: "#F1F5F9",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  countBadgeTxt: { fontSize: 12, fontWeight: "600", color: colors.muted2 },
  scopeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  scopeText: { color: "#1D4ED8", fontWeight: "700", fontSize: 10 },
  toolbarRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "flex-end",
  },
  searchWrap: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 200,
    maxWidth: 320,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 9 : 8,
    ...Platform.select({
      web: { transition: "border-color 0.15s ease, box-shadow 0.15s ease" } as object,
      default: {},
    }),
  },
  searchWrapFocused: {
    borderColor: "#1D4ED8",
    ...Platform.select({
      web: { boxShadow: "0 0 0 3px rgba(29, 78, 216, 0.12)" } as object,
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
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#16A34A",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.md,
    flexShrink: 0,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  addText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  table: {
    flex: 1,
    minWidth: "100%",
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    overflow: "hidden",
    ...Platform.select({
      web: { boxShadow: "0 1px 3px rgba(15, 23, 42, 0.05)" } as object,
      default: {},
    }),
  },
  tableWide: { minWidth: 860 },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  tableHead: {
    paddingVertical: 10,
    backgroundColor: "#FAFBFC",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tableBodyRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  tableRowHover: Platform.select({
    web: { backgroundColor: "#F9FAFB" } as object,
    default: {},
  }),
  th: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.muted2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  td: { fontSize: 13, color: colors.ink },
  colPlayer: { flex: 2.4, minWidth: 200 },
  colId: { flex: 1, minWidth: 90 },
  colSport: { flex: 1, minWidth: 90 },
  colLocation: { flex: 1, minWidth: 100 },
  colType: { flex: 1, minWidth: 100 },
  colActions: { width: 40, alignItems: "flex-end" },
  playerCell: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarTxt: { fontWeight: "800", fontSize: 12 },
  playerNameWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  playerName: { fontSize: 14, fontWeight: "600", color: colors.ink, flexShrink: 1 },
  playerNameDeact: { color: colors.muted2 },
  inactivePill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  inactivePillTxt: { fontSize: 9, fontWeight: "800", color: "#64748B" },
  idCell: {
    color: "#475569",
    fontWeight: "600",
    fontFamily: Platform.select({ web: "ui-monospace, SFMono-Regular, Menlo, monospace", default: undefined }),
  },
  tagBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  tagBadgeTxt: { fontSize: 11, fontWeight: "700" },
  typeBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  typeBadgeTxt: { fontSize: 11, fontWeight: "700", color: "#475569" },
  dash: { fontSize: 13, color: colors.hint },
  actionBtn: {
    padding: 6,
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
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  footerText: { fontSize: 13, color: colors.muted2, fontWeight: "500" },
  pagination: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  pageBtnDisabled: { opacity: 0.5 },
  pageBtnTxt: { fontSize: 13, fontWeight: "600", color: colors.ink },
  pageBtnTxtDisabled: { color: colors.hint },
  pageIndicator: { fontSize: 13, fontWeight: "600", color: colors.muted2, minWidth: 48, textAlign: "center" },
  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyText: { color: colors.muted, textAlign: "center", fontSize: 13 },
  blockedBox: {
    padding: 20,
    backgroundColor: "#FEF2F2",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    gap: 8,
  },
  blockedTitle: { fontSize: 16, fontWeight: "800", color: "#991B1B" },
  blockedText: { textAlign: "center", color: "#7F1D1D", lineHeight: 20 },
});
