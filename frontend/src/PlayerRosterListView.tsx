import { useState, type ReactNode } from "react";
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

const BOARDING_TYPES = ["Daily", "Day Boarding", "Hostel", "Boarding"] as const;
const PLAYER_SPORTS = ["Cricket", "Football"] as const;
const CENTRES = ["Balua", "Harding Park"] as const;

function sportAvatarStyle(sport?: string) {
  if (sport === "Cricket") return { bg: "#DCFCE7", text: "#15803D" };
  if (sport === "Football") return { bg: "#DBEAFE", text: "#1D4ED8" };
  return { bg: "#ECFDF5", text: "#16A34A" };
}

function FilterRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={s.filterScroll}
      contentContainerStyle={s.filterRowInner}
    >
      {children}
    </ScrollView>
  );
}

function FilterPill({
  label,
  active,
  onPress,
  testID,
  disabled,
  locked,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
  disabled?: boolean;
  locked?: boolean;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.filterPill,
        active && (locked ? s.filterPillLocked : s.filterPillActive),
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[s.filterPillTxt, active && (locked ? s.filterPillTxtLocked : s.filterPillTxtActive)]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function MetaBadge({ label, tint = "neutral" }: { label: string; tint?: "neutral" | "sport" | "location" }) {
  const palette =
    tint === "sport"
      ? { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" }
      : tint === "location"
        ? { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0" }
        : { bg: "#F9FAFB", text: "#475569", border: "#E5E7EB" };
  return (
    <View style={[s.metaBadge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[s.metaBadgeTxt, { color: palette.text }]}>{label}</Text>
    </View>
  );
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
  const { horizontalPadding, contentMaxWidth, isDesktop, isTablet } = useBreakpoint();
  const [searchFocused, setSearchFocused] = useState(false);

  const pageStyle = {
    paddingHorizontal: horizontalPadding,
    maxWidth: contentMaxWidth,
    alignSelf: contentMaxWidth ? ("center" as const) : undefined,
    width: contentMaxWidth ? ("100%" as const) : undefined,
  };

  const cardWidth = isDesktop ? "31.5%" : isTablet ? "48%" : "100%";

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={[s.page, pageStyle]}>
        <View style={s.topBar}>
          <View style={s.titleBlock}>
            <TouchableOpacity onPress={onBack} style={s.backBtn} testID="list-back">
              <Feather name="chevron-left" size={22} color={colors.ink} />
            </TouchableOpacity>
            <View style={s.titleTextWrap}>
              <Text style={s.h1}>Players</Text>
              <Text style={s.sub}>{items.length} record{items.length !== 1 ? "s" : ""}</Text>
              {isCoachPlayerView && coachScope.assignedSport && !coachScope.requiresSportAssignment && (
                <View style={s.scopeBadge}>
                  <Feather name="lock" size={11} color="#1D4ED8" />
                  <Text style={s.scopeText}>{coachScope.assignedSport} only</Text>
                </View>
              )}
            </View>
          </View>

          {!coachBlocked && (
            <View style={s.actionsRow}>
              <View style={[s.searchWrap, searchFocused && s.searchWrapFocused]}>
                <Feather name="search" size={16} color={searchFocused ? colors.primary : colors.hint} />
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
                    <Feather name="x" size={16} color={colors.hint} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                testID="add-player"
                style={[s.addBtn, !canAdd && { opacity: 0.45 }]}
                disabled={!canAdd}
                onPress={onAdd}
              >
                <Feather name="plus" size={18} color="#fff" />
                <Text style={s.addText}>Add</Text>
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
          <View style={s.filtersBlock}>
            {isAdmin && (
              <FilterRow>
                <FilterPill
                  testID="toggle-active"
                  label="Active"
                  active={!showDeactivated}
                  onPress={() => setShowDeactivated(false)}
                />
                <FilterPill
                  testID="toggle-deactivated"
                  label="All (incl. inactive)"
                  active={showDeactivated}
                  onPress={() => setShowDeactivated(true)}
                />
              </FilterRow>
            )}

            {(canBrowseAllSports || (isCoachPlayerView && coachScope.assignedSport)) && (
              <FilterRow>
                {canBrowseAllSports && (
                  <FilterPill
                    testID="sport-all"
                    label="All Sports"
                    active={!sportFilter}
                    onPress={() => setSportFilter(null)}
                  />
                )}
                {(canBrowseAllSports ? PLAYER_SPORTS : coachScope.assignedSport ? [coachScope.assignedSport] : []).map((sp) => (
                  <FilterPill
                    key={sp}
                    testID={`sport-${String(sp).toLowerCase()}`}
                    label={sp}
                    active={sportFilter === sp}
                    locked={isCoachPlayerView}
                    disabled={isCoachPlayerView}
                    onPress={() => setSportFilter(sp)}
                  />
                ))}
              </FilterRow>
            )}

            <FilterRow>
              <FilterPill
                testID="ptype-all"
                label="All Types"
                active={!typeFilter}
                onPress={() => setTypeFilter(null)}
              />
              {BOARDING_TYPES.map((t) => (
                <FilterPill
                  key={t}
                  testID={`ptype-${t.toLowerCase().replace(/\s+/g, "-")}`}
                  label={t}
                  active={typeFilter === t}
                  onPress={() => setTypeFilter(t)}
                />
              ))}
            </FilterRow>

            <FilterRow>
              <FilterPill
                testID="centre-all"
                label="All Locations"
                active={!centreFilter}
                onPress={() => setCentreFilter(null)}
              />
              {CENTRES.map((c) => (
                <FilterPill
                  key={c}
                  testID={`centre-${c.toLowerCase().replace(/\s+/g, "-")}`}
                  label={c}
                  active={centreFilter === c}
                  onPress={() => setCentreFilter(c)}
                />
              ))}
            </FilterRow>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color="#16A34A" style={{ marginTop: 32 }} />
        ) : items.length === 0 ? (
          <View style={s.empty}>
            <Feather name="users" size={36} color={colors.hint} />
            <Text style={s.emptyText}>
              {search.trim()
                ? `No matches for "${search.trim()}".`
                : "No players yet. Tap Add to create one."}
            </Text>
          </View>
        ) : (
          <View style={s.cardGrid}>
            {items.map((it) => {
              const isDeact = it.status === "deactivated";
              const initials = it.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("");
              const avatar = sportAvatarStyle(it.sport);
              const typeLabel = it.player_type === "Hostel Only" ? "Hostel" : it.player_type;

              return (
                <Pressable
                  key={it.id}
                  testID={`row-${it.id}`}
                  style={({ hovered }: any) => [
                    s.card,
                    { width: cardWidth },
                    isDeact && s.cardDeact,
                    hovered && s.cardHovered,
                  ]}
                  onPress={() => onOpenPlayer(it.id)}
                >
                    <View style={[s.avatar, { backgroundColor: isDeact ? "#E2E8F0" : avatar.bg }]}>
                      <Text style={[s.avatarTxt, { color: isDeact ? "#64748B" : avatar.text }]}>{initials}</Text>
                    </View>

                    <View style={s.cardMain}>
                      <View style={s.nameRow}>
                        <Text style={s.name} numberOfLines={1}>{it.name}</Text>
                        {isDeact && (
                          <View style={s.inactivePill}>
                            <Text style={s.inactivePillTxt}>Inactive</Text>
                          </View>
                        )}
                      </View>

                      <View style={s.badgeRow}>
                        {it.player_id ? <MetaBadge label={it.player_id} /> : null}
                        {it.sport ? <MetaBadge label={it.sport} tint="sport" /> : null}
                        {it.centre ? <MetaBadge label={it.centre} tint="location" /> : null}
                        {typeLabel ? <MetaBadge label={typeLabel} /> : null}
                      </View>
                    </View>

                    <TouchableOpacity
                      testID={`view-${it.id}`}
                      style={s.viewBtn}
                      onPress={() => onOpenPlayer(it.id)}
                      hitSlop={8}
                    >
                      <Feather name="more-horizontal" size={18} color={colors.muted2} />
                    </TouchableOpacity>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: formColors.pageBg },
  page: { paddingTop: spacing.lg, paddingBottom: 48, gap: spacing.lg },
  topBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  titleBlock: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexGrow: 1, minWidth: 180 },
  backBtn: { padding: 6, marginLeft: -6 },
  titleTextWrap: { gap: 2 },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink, letterSpacing: -0.4 },
  sub: { fontSize: 13, color: colors.muted, fontWeight: "500" },
  scopeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  scopeText: { color: "#1D4ED8", fontWeight: "700", fontSize: 10 },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexGrow: 1,
    minWidth: 260,
    justifyContent: "flex-end",
  },
  searchWrap: {
    flex: 1,
    minWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 10 : 8,
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
    fontSize: 14,
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
    paddingVertical: 10,
    borderRadius: radii.md,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  addText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  filtersBlock: { gap: spacing.sm },
  filterScroll: { flexGrow: 0 },
  filterRowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 2,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
  filterPillActive: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8",
  },
  filterPillLocked: {
    backgroundColor: "#EFF6FF",
    borderColor: "#93C5FD",
  },
  filterPillTxt: { fontSize: 12, fontWeight: "700", color: "#374151" },
  filterPillTxtActive: { color: "#fff" },
  filterPillTxtLocked: { color: "#1D4ED8" },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    padding: spacing.lg,
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
        transition: "box-shadow 0.15s ease",
      } as object,
      default: {
        shadowColor: "#0F172A",
        shadowOpacity: 0.05,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      },
    }),
  },
  cardHovered: Platform.select({
    web: {
      transform: [{ translateY: -1 }],
      boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
    } as object,
    default: {},
  }),
  cardDeact: { opacity: 0.7 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { fontWeight: "800", fontSize: 15 },
  cardMain: { flex: 1, minWidth: 0, gap: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  name: { fontSize: 15, fontWeight: "700", color: colors.ink, flexShrink: 1 },
  inactivePill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  inactivePillTxt: { fontSize: 10, fontWeight: "800", color: "#64748B" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  metaBadgeTxt: { fontSize: 10, fontWeight: "700" },
  viewBtn: {
    padding: 4,
    ...Platform.select({ web: { cursor: "pointer" } as object, default: {} }),
  },
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
