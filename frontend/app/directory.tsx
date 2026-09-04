import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, ROLE_COLORS, roleLabel, useAuth } from "../src/auth";
import { isCoachUser } from "../src/coachAccess";
import { EmptyState, ErrorState, getApiError } from "../src/ScreenStates";
import { useBreakpoint } from "../src/useBreakpoint";
import { FormSelect } from "../src/components/forms/FormSelect";
import { FormFieldGrid } from "../src/components/forms/FormFieldGrid";
import { DirectoryFilterSummary, type DirectoryFilterChip } from "../src/components/directory/DirectoryFilterSummary";
import { DirectoryListSkeleton } from "../src/components/directory/DirectoryListSkeleton";
import {
  ALPHA_SKILL_FILTER_OPTIONS,
  ALPHA_SPORT_FILTER_OPTIONS,
  ALPHA_VENUE_FILTER_OPTIONS,
  CATEGORY_FILTER_OPTIONS,
  ORG_FILTER_OPTIONS,
  PWS_CLASS_FILTER_OPTIONS,
  PWS_SECTION_FILTER_OPTIONS,
  clearedSubFiltersForOrg,
  filterDirectoryEntries,
  personToDirectoryEntry,
  unwrapPeoplePayload,
  userToDirectoryEntry,
  type CategoryFilter,
  type DirectoryEntry,
  type OrgFilter,
} from "../src/directoryFilters";
import { colors, radii, spacing } from "../src/theme";

const INITIAL_FILTERS = {
  org: "all" as OrgFilter,
  pwsClass: "",
  pwsSection: "",
  alphaSport: "",
  alphaVenue: "",
  alphaSkill: "",
  category: "all" as CategoryFilter,
};

export default function Directory() {
  const router = useRouter();
  const { user } = useAuth();
  const { horizontalPadding, contentMaxWidth, isWide } = useBreakpoint();
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [orgFilter, setOrgFilter] = useState<OrgFilter>(INITIAL_FILTERS.org);
  const [pwsClass, setPwsClass] = useState("");
  const [pwsSection, setPwsSection] = useState("");
  const [alphaSport, setAlphaSport] = useState("");
  const [alphaVenue, setAlphaVenue] = useState("");
  const [alphaSkill, setAlphaSkill] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(INITIAL_FILTERS.category);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && isCoachUser(user)) {
      router.replace("/(tabs)/dashboard");
    }
  }, [user, router]);

  const onOrgChange = (value: string) => {
    const next = (value || "all") as OrgFilter;
    setOrgFilter(next);
    const cleared = clearedSubFiltersForOrg(next);
    setPwsClass(cleared.pwsClass);
    setPwsSection(cleared.pwsSection);
    setAlphaSport(cleared.alphaSport);
    setAlphaVenue(cleared.alphaVenue);
    setAlphaSkill(cleared.alphaSkill);
  };

  const load = useCallback(async () => {
    if (!user || isCoachUser(user)) return;
    setError("");
    try {
      const [usersRes, studentsRes, playersRes] = await Promise.all([
        api.get("/users/directory"),
        api.get("/people", { params: { kind: "student" } }),
        api.get("/people", { params: { kind: "player" } }),
      ]);
      const users = Array.isArray(usersRes.data) ? usersRes.data.map(userToDirectoryEntry) : [];
      const students = unwrapPeoplePayload(studentsRes.data).map(personToDirectoryEntry);
      const players = unwrapPeoplePayload(playersRes.data).map(personToDirectoryEntry);
      setEntries([...users, ...students, ...players]);
    } catch (e: any) {
      setError(getApiError(e, "Could not load directory."));
      setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);
  const onRefresh = () => { setRefreshing(true); load(); };

  const filtered = useMemo(
    () => filterDirectoryEntries(
      entries,
      { org: orgFilter, pwsClass, pwsSection, alphaSport, alphaVenue, alphaSkill, category: categoryFilter },
      search,
    ),
    [entries, orgFilter, pwsClass, pwsSection, alphaSport, alphaVenue, alphaSkill, categoryFilter, search],
  );

  const hasActiveFilters = orgFilter !== "all"
    || !!pwsClass
    || !!pwsSection
    || !!alphaSport
    || !!alphaVenue
    || !!alphaSkill
    || categoryFilter !== "all"
    || search.trim().length > 0;

  const clearFilters = () => {
    setOrgFilter("all");
    setPwsClass("");
    setPwsSection("");
    setAlphaSport("");
    setAlphaVenue("");
    setAlphaSkill("");
    setCategoryFilter("all");
    setSearch("");
  };

  const chips: DirectoryFilterChip[] = useMemo(() => {
    const next: DirectoryFilterChip[] = [];
    const q = search.trim();
    if (q) next.push({ id: "search", label: `Search: ${q}`, onRemove: () => setSearch("") });
    if (orgFilter !== "all") {
      next.push({ id: "org", label: `Organization: ${orgFilter}`, onRemove: () => onOrgChange("all") });
    }
    if (pwsClass) next.push({ id: "class", label: `Class: ${pwsClass}`, onRemove: () => setPwsClass("") });
    if (pwsSection) next.push({ id: "section", label: `Section: ${pwsSection}`, onRemove: () => setPwsSection("") });
    if (alphaSport) next.push({ id: "sport", label: `Sport: ${alphaSport}`, onRemove: () => setAlphaSport("") });
    if (alphaVenue) next.push({ id: "venue", label: `Location: ${alphaVenue}`, onRemove: () => setAlphaVenue("") });
    if (alphaSkill) next.push({ id: "skill", label: `Skill: ${alphaSkill}`, onRemove: () => setAlphaSkill("") });
    if (categoryFilter !== "all") {
      next.push({ id: "category", label: `Player type: ${categoryFilter}`, onRemove: () => setCategoryFilter("all") });
    }
    return next;
  }, [alphaSkill, alphaSport, alphaVenue, categoryFilter, orgFilter, pwsClass, pwsSection, search]);

  const resultLabel = hasActiveFilters
    ? `Showing ${filtered.length} of ${entries.length} ${filtered.length === 1 ? "person" : "people"}`
    : `Showing ${filtered.length} ${filtered.length === 1 ? "person" : "people"}`;

  if (!user || isCoachUser(user)) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <ActivityIndicator color="#1E40AF" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} accessibilityLabel="Go back">
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Directory</Text>
        <View style={s.headerCount}>
          <Text style={s.headerCountTxt}>{resultLabel}</Text>
        </View>
      </View>

      <View style={[s.searchWrap, { marginHorizontal: horizontalPadding }]}>
        <Feather name="search" size={16} color="#94A3B8" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, email, department…"
          placeholderTextColor="#94A3B8"
          style={s.searchInput}
          testID="directory-search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={16} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      <View style={[s.filterPanel, { marginHorizontal: horizontalPadding }]}>
        <FormFieldGrid columns={4} isWide={isWide}>
          <FormSelect
            compact
            label={orgFilter !== "all" ? "Organization (1)" : "Organization"}
            testID="directory-filter-org"
            value={orgFilter}
            options={ORG_FILTER_OPTIONS}
            placeholder="All"
            onChange={onOrgChange}
          />

          {orgFilter === "PWS" && (
            <>
              <FormSelect
                compact
                label={pwsClass ? "Class (1)" : "Class"}
                testID="directory-filter-class"
                value={pwsClass}
                options={PWS_CLASS_FILTER_OPTIONS}
                placeholder="All classes"
                onChange={setPwsClass}
              />
              <FormSelect
                compact
                label={pwsSection ? "Section (1)" : "Section"}
                testID="directory-filter-section"
                value={pwsSection}
                options={PWS_SECTION_FILTER_OPTIONS}
                placeholder="All sections"
                onChange={setPwsSection}
              />
            </>
          )}

          {orgFilter === "ALPHA" && (
            <>
              <FormSelect
                compact
                label={alphaSport ? "Sport (1)" : "Sport"}
                testID="directory-filter-sport"
                value={alphaSport}
                options={ALPHA_SPORT_FILTER_OPTIONS}
                placeholder="All sports"
                onChange={setAlphaSport}
              />
              <FormSelect
                compact
                label={alphaVenue ? "Location (1)" : "Location"}
                testID="directory-filter-venue"
                value={alphaVenue}
                options={ALPHA_VENUE_FILTER_OPTIONS}
                placeholder="All venues"
                onChange={setAlphaVenue}
              />
              <FormSelect
                compact
                label={alphaSkill ? "Skill (1)" : "Skill"}
                testID="directory-filter-skill"
                value={alphaSkill}
                options={ALPHA_SKILL_FILTER_OPTIONS}
                placeholder="All skill levels"
                onChange={setAlphaSkill}
              />
            </>
          )}

          <FormSelect
            compact
            label={categoryFilter !== "all" ? "Player type (1)" : "Player type"}
            testID="directory-filter-category"
            value={categoryFilter}
            options={CATEGORY_FILTER_OPTIONS}
            placeholder="All Categories"
            onChange={(v) => setCategoryFilter((v || "all") as CategoryFilter)}
          />
        </FormFieldGrid>

        <DirectoryFilterSummary chips={chips} onClearAll={clearFilters} />
      </View>

      <ScrollView
        contentContainerStyle={[
          s.scroll,
          {
            paddingHorizontal: horizontalPadding,
            maxWidth: contentMaxWidth,
            alignSelf: contentMaxWidth ? "center" : undefined,
            width: contentMaxWidth ? "100%" : undefined,
          },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1E40AF" />}
      >
        {loading ? (
          <DirectoryListSkeleton rows={8} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="filter"
            title={hasActiveFilters ? "No people match these filters" : "No people found"}
            message={hasActiveFilters ? "Clear filters to see the full directory, or try a different search." : "No directory entries are available yet."}
            actionLabel={hasActiveFilters ? "Clear all filters" : undefined}
            onAction={hasActiveFilters ? clearFilters : undefined}
          />
        ) : (
          <View style={[s.grid, isWide && s.gridWide]}>
            {filtered.map((entry) => {
              const inactive = entry.status === "deactivated";
              const statusLabel = inactive ? "Inactive" : entry.status === "pending_fee_approval" ? "Pending fee" : "Active";
              return (
                <View key={`${entry.source}-${entry.id}`} style={[s.card, isWide && s.cardWide, inactive && s.cardInactive]}>
                  <View style={s.cardTop}>
                    <View style={[s.avatar, { backgroundColor: ROLE_COLORS[entry.role] || "#94A3B8" }]}>
                      <Text style={s.avatarTxt}>
                        {entry.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                      </Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.name} numberOfLines={1}>{entry.name}</Text>
                      <Text style={s.roleLine} numberOfLines={1}>
                        {roleLabel(entry.role)} · {entry.organization}
                      </Text>
                    </View>
                    <View style={[s.statusPill, inactive ? s.statusInactive : s.statusActive]}>
                      <Text style={[s.statusPillTxt, inactive ? s.statusInactiveTxt : s.statusActiveTxt]}>
                        {statusLabel}
                      </Text>
                    </View>
                  </View>
                  <View style={s.chipRow}>
                    {!!entry.centre && (
                      <View style={s.infoChip}><Text style={s.infoChipTxt}>{entry.centre}</Text></View>
                    )}
                    {!!entry.sport && (
                      <View style={s.infoChip}><Text style={s.infoChipTxt}>{entry.sport}</Text></View>
                    )}
                    {!!entry.skillLevel && (
                      <View style={s.infoChip}><Text style={s.infoChipTxt}>{entry.skillLevel}</Text></View>
                    )}
                    {!!entry.category && (
                      <View style={s.infoChip}><Text style={s.infoChipTxt}>{entry.category}</Text></View>
                    )}
                  </View>
                  {(entry.email || entry.mobile || entry.playerId) ? (
                    <Text style={s.meta} numberOfLines={1}>
                      {[entry.playerId, entry.mobile, entry.email].filter(Boolean).join(" · ")}
                    </Text>
                  ) : entry.department ? (
                    <Text style={s.meta} numberOfLines={1}>{entry.department}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  headerCount: {
    marginLeft: "auto",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerCountTxt: { fontSize: 12, fontWeight: "700", color: colors.muted2 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.ink, padding: 0 },
  filterPanel: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  scroll: { paddingBottom: 40, paddingTop: 4 },
  grid: { gap: 10 },
  gridWide: { flexDirection: "row", flexWrap: "wrap" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
    width: "100%",
  },
  cardWide: { width: "48%", flexGrow: 1 },
  cardInactive: { opacity: 0.78 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  roleLine: { fontSize: 12, color: colors.muted2, marginTop: 2, fontWeight: "600", textTransform: "capitalize" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  infoChip: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  infoChipTxt: { fontSize: 11, fontWeight: "700", color: colors.ink2 },
  statusPill: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, flexShrink: 0 },
  statusActive: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  statusInactive: { backgroundColor: "#F1F5F9", borderColor: "#E2E8F0" },
  statusPillTxt: { fontSize: 10, fontWeight: "800" },
  statusActiveTxt: { color: "#047857" },
  statusInactiveTxt: { color: "#64748B" },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  name: { fontSize: 15, fontWeight: "800", color: colors.ink },
  meta: { fontSize: 12, color: colors.muted2 },
});
