import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Pressable,
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
import { FilterMultiSelect } from "./components/FilterMultiSelect";
import { DirectoryFilterSummary, type DirectoryFilterChip } from "./components/directory/DirectoryFilterSummary";
import { DirectoryListSkeleton } from "./components/directory/DirectoryListSkeleton";
import {
  filterPlayersByFacets,
  PLAYER_CENTRES,
  PLAYER_SKILL_LEVELS,
  PLAYER_SPORTS,
  PLAYER_TYPES,
} from "./playerRosterFilters";

const BOARDING_TYPES = PLAYER_TYPES;
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

function skillBadgeStyle(skill?: string) {
  if (skill === "Advanced") return { bg: "#F3E8FF", text: "#7E22CE", border: "#E9D5FF" };
  if (skill === "Intermediate") return { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" };
  if (skill === "Beginner") return { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" };
  return { bg: "#F9FAFB", text: "#475569", border: "#E5E7EB" };
}

function statusBadgeStyle(status?: string) {
  if (status === "deactivated") return { bg: "#F1F5F9", text: "#64748B", border: "#E2E8F0", label: "Inactive" };
  if (status === "pending_fee_approval") return { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A", label: "Pending fee" };
  return { bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", label: "Active" };
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
  sportFilter: string[];
  setSportFilter: (v: string[]) => void;
  typeFilter: string[];
  setTypeFilter: (v: string[]) => void;
  centreFilter: string[];
  setCentreFilter: (v: string[]) => void;
  skillFilter: string[];
  setSkillFilter: (v: string[]) => void;
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
  skillFilter,
  setSkillFilter,
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

  const facets = useMemo(
    () => ({ sports: sportFilter, types: typeFilter, centres: centreFilter, skills: skillFilter }),
    [sportFilter, typeFilter, centreFilter, skillFilter],
  );
  const filteredItems = useMemo(() => filterPlayersByFacets(items, facets), [items, facets]);
  const loadedTotal = items.length;
  const total = filteredItems.length;
  const hasFacetFilters = sportFilter.length + typeFilter.length + centreFilter.length + skillFilter.length > 0;
  const statusActive = showDeactivated;
  const activeSearch = debouncedSearch.trim();
  const isSearching = activeSearch.length > 0;
  const hasActiveFilters = hasFacetFilters || isSearching || statusActive;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(safePage * pageSize, total);
  const pageItems = filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize);

  const resultLabel = hasActiveFilters
    ? `Showing ${total} of ${loadedTotal} player${loadedTotal !== 1 ? "s" : ""}`
    : `Showing ${total} player${total !== 1 ? "s" : ""}`;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, showDeactivated, sportFilter, typeFilter, centreFilter, skillFilter, loadedTotal, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const clearFacets = useCallback(() => {
    if (!isCoachPlayerView) setSportFilter([]);
    setTypeFilter([]);
    setCentreFilter([]);
    setSkillFilter([]);
    setShowDeactivated(false);
    if (isSearching) onClearSearch();
  }, [isCoachPlayerView, isSearching, onClearSearch, setCentreFilter, setShowDeactivated, setSkillFilter, setSportFilter, setTypeFilter]);

  const chips: DirectoryFilterChip[] = useMemo(() => {
    const next: DirectoryFilterChip[] = [];
    if (isSearching) {
      next.push({ id: "search", label: `Search: ${activeSearch}`, onRemove: onClearSearch });
    }
    if (statusActive) {
      next.push({ id: "status", label: "Status: All", onRemove: () => setShowDeactivated(false) });
    }
    sportFilter.forEach((v) => {
      if (isCoachPlayerView) return;
      next.push({
        id: `sport-${v}`,
        label: `Sport: ${v}`,
        onRemove: () => setSportFilter(sportFilter.filter((x) => x !== v)),
      });
    });
    typeFilter.forEach((v) => {
      next.push({
        id: `type-${v}`,
        label: `Player type: ${v}`,
        onRemove: () => setTypeFilter(typeFilter.filter((x) => x !== v)),
      });
    });
    centreFilter.forEach((v) => {
      next.push({
        id: `centre-${v}`,
        label: `Location: ${v}`,
        onRemove: () => setCentreFilter(centreFilter.filter((x) => x !== v)),
      });
    });
    skillFilter.forEach((v) => {
      next.push({
        id: `skill-${v}`,
        label: `Skill: ${v}`,
        onRemove: () => setSkillFilter(skillFilter.filter((x) => x !== v)),
      });
    });
    return next;
  }, [
    activeSearch, centreFilter, isCoachPlayerView, isSearching, onClearSearch,
    setCentreFilter, setShowDeactivated, setSkillFilter, setSportFilter, setTypeFilter,
    skillFilter, sportFilter, statusActive, typeFilter,
  ]);

  const statusOptions: FormSelectOption[] = [
    { value: "active", label: "Active" },
    { value: "all", label: "All status" },
  ];

  const sportOptions: FormSelectOption[] = canBrowseAllSports
    ? PLAYER_SPORTS.map((sp) => ({ value: sp, label: sp }))
    : coachScope.assignedSport
      ? [{ value: coachScope.assignedSport, label: coachScope.assignedSport }]
      : [];

  const typeOptions: FormSelectOption[] = BOARDING_TYPES.map((t) => ({ value: t, label: t }));
  const locationOptions: FormSelectOption[] = PLAYER_CENTRES.map((c) => ({ value: c, label: c }));
  const skillOptions: FormSelectOption[] = PLAYER_SKILL_LEVELS.map((sk) => ({ value: sk, label: sk }));

  const pageSizeOptions: FormSelectOption[] = PAGE_SIZE_OPTIONS.map((n) => ({
    value: String(n),
    label: `${n} / page`,
  }));

  const showSportFilter = canBrowseAllSports || (isCoachPlayerView && !!coachScope.assignedSport);

  const tableHeader = (
    <View style={[s.tableRow, s.tableHead]}>
      <Text style={[s.th, s.colPlayer]}>Player</Text>
      <Text style={[s.th, s.colId]}>ID / Contact</Text>
      <Text style={[s.th, s.colLocation]}>Campus</Text>
      <Text style={[s.th, s.colSport]}>Sport</Text>
      <Text style={[s.th, s.colSkill]}>Skill</Text>
      <Text style={[s.th, s.colType]}>Type</Text>
      <Text style={[s.th, s.colStatus]}>Status</Text>
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
              <Text style={s.countBadgeTxt}>{resultLabel}</Text>
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
                  groupLabel="Status"
                  badgeCount={showDeactivated ? 1 : 0}
                  value={showDeactivated ? "all" : "active"}
                  options={statusOptions}
                  onChange={(v) => setShowDeactivated(v === "all")}
                />
              </View>
            )}

            {showSportFilter && sportOptions.length > 0 && (
              <View style={filterSelectSlotStyle}>
                <FilterMultiSelect
                  testID="sport-filter"
                  groupLabel="Sport"
                  placeholder="Sport"
                  values={sportFilter}
                  options={sportOptions}
                  disabled={isCoachPlayerView}
                  onChange={setSportFilter}
                />
              </View>
            )}

            <View style={filterSelectSlotStyle}>
              <FilterMultiSelect
                testID="ptype-filter"
                groupLabel="Player type"
                placeholder="Player type"
                values={typeFilter}
                options={typeOptions}
                onChange={setTypeFilter}
              />
            </View>

            <View style={filterSelectSlotStyle}>
              <FilterMultiSelect
                testID="centre-filter"
                groupLabel="Location"
                placeholder="Location"
                values={centreFilter}
                options={locationOptions}
                onChange={setCentreFilter}
              />
            </View>

            <View style={filterSelectSlotStyle}>
              <FilterMultiSelect
                testID="skill-filter"
                groupLabel="Skill"
                placeholder="Skill"
                values={skillFilter}
                options={skillOptions}
                onChange={setSkillFilter}
              />
            </View>
          </View>
        )}

        {!coachBlocked && chips.length > 0 && (
          <DirectoryFilterSummary chips={chips} onClearAll={clearFacets} />
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
              <DirectoryListSkeleton rows={8} testID="players-skeleton" />
            ) : total === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyIcon}>
                  <Feather name="filter" size={28} color={colors.hint} />
                </View>
                <Text style={s.emptyTitle}>
                  {hasActiveFilters ? "No players match these filters" : "No players yet"}
                </Text>
                <Text style={s.emptyText}>
                  {hasActiveFilters
                    ? "Try removing a filter or clearing all filters to broaden the list."
                    : "Tap Add Player to create the first roster record."}
                </Text>
                {hasActiveFilters && (
                  <TouchableOpacity style={s.clearSearchBtn} onPress={clearFacets} testID="empty-clear-search">
                    <Feather name="x-circle" size={14} color={PLAYER_GREEN} />
                    <Text style={s.clearSearchTxt}>Clear all filters</Text>
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
                      const initials = it.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("");
                      const avatar = sportAvatarStyle(it.sport);
                      const sportBadge = sportBadgeStyle(it.sport);
                      const typeLabel = it.player_type === "Hostel Only" ? "Hostel" : it.player_type;
                      const typeBadge = typeBadgeStyle(typeLabel);
                      const skillBadge = skillBadgeStyle(it.skill_level);
                      const statusBadge = statusBadgeStyle(it.status);
                      const contact = it.mobile || it.email || it.date_of_admission || "";

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
                              <Text style={[s.playerName, isDeact && s.playerNameDeact]} numberOfLines={1}>
                                {it.name}
                              </Text>
                              <Text style={s.playerSub} numberOfLines={1}>
                                {[it.sport, it.centre, it.skill_level].filter(Boolean).join(" · ") || "—"}
                              </Text>
                            </View>
                          </View>

                          <View style={s.colId}>
                            <Text style={[s.td, s.idCell]} numberOfLines={1}>{it.player_id || "—"}</Text>
                            {!!contact && (
                              <Text style={s.contactSub} numberOfLines={1}>{contact}</Text>
                            )}
                          </View>

                          <Text style={[s.td, s.colLocation]} numberOfLines={1}>{it.centre || "—"}</Text>

                          <View style={s.colSport}>
                            {it.sport ? (
                              <View style={[s.tagBadge, { backgroundColor: sportBadge.bg, borderColor: sportBadge.border }]}>
                                <Text style={[s.tagBadgeTxt, { color: sportBadge.text }]}>{it.sport}</Text>
                              </View>
                            ) : (
                              <Text style={s.dash}>—</Text>
                            )}
                          </View>

                          <View style={s.colSkill}>
                            {it.skill_level ? (
                              <View style={[s.tagBadge, { backgroundColor: skillBadge.bg, borderColor: skillBadge.border }]}>
                                <Text style={[s.tagBadgeTxt, { color: skillBadge.text }]}>{it.skill_level}</Text>
                              </View>
                            ) : (
                              <Text style={s.dash}>—</Text>
                            )}
                          </View>

                          <View style={s.colType}>
                            {typeLabel ? (
                              <View style={[s.tagBadge, { backgroundColor: typeBadge.bg, borderColor: typeBadge.border }]}>
                                <Text style={[s.tagBadgeTxt, { color: typeBadge.text }]}>{typeLabel}</Text>
                              </View>
                            ) : (
                              <Text style={s.dash}>—</Text>
                            )}
                          </View>

                          <View style={s.colStatus}>
                            <View style={[s.tagBadge, { backgroundColor: statusBadge.bg, borderColor: statusBadge.border }]}>
                              <Text style={[s.tagBadgeTxt, { color: statusBadge.text }]}>{statusBadge.label}</Text>
                            </View>
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
              {`Showing ${startIdx}–${endIdx} of ${total} player${total !== 1 ? "s" : ""}`}
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
    zIndex: 8,
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
  tableWide: { minWidth: 1040 },
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
  colPlayer: { flex: 2.2, minWidth: 180 },
  colId: { flex: 1.2, minWidth: 110 },
  colSport: { flex: 0.8, minWidth: 76 },
  colLocation: { flex: 1, minWidth: 100 },
  colSkill: { flex: 0.9, minWidth: 88 },
  colType: { flex: 0.85, minWidth: 80 },
  colStatus: { flex: 0.9, minWidth: 92 },
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
  playerName: { fontSize: 13, fontWeight: "700", color: colors.ink, flexShrink: 1 },
  playerNameDeact: { color: colors.muted2 },
  playerSub: { fontSize: 11, color: colors.hint, fontWeight: "500" },
  contactSub: { fontSize: 11, color: colors.hint, fontWeight: "500", marginTop: 1 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
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
