import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, ROLE_COLORS, useAuth } from "../src/auth";
import { isCoachUser } from "../src/coachAccess";
import { LoadingState, EmptyState, ErrorState, getApiError } from "../src/ScreenStates";
import { useBreakpoint } from "../src/useBreakpoint";
import { FormSelect } from "../src/components/forms/FormSelect";
import { FormFieldGrid } from "../src/components/forms/FormFieldGrid";
import {
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
      { org: orgFilter, pwsClass, pwsSection, alphaSport, alphaVenue, category: categoryFilter },
      search,
    ),
    [entries, orgFilter, pwsClass, pwsSection, alphaSport, alphaVenue, categoryFilter, search],
  );

  const hasActiveFilters = orgFilter !== "all"
    || !!pwsClass
    || !!pwsSection
    || !!alphaSport
    || !!alphaVenue
    || categoryFilter !== "all"
    || search.trim().length > 0;

  const clearFilters = () => {
    setOrgFilter("all");
    setPwsClass("");
    setPwsSection("");
    setAlphaSport("");
    setAlphaVenue("");
    setCategoryFilter("all");
    setSearch("");
  };

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
            label="Organization"
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
                label="Class"
                testID="directory-filter-class"
                value={pwsClass}
                options={PWS_CLASS_FILTER_OPTIONS}
                placeholder="All classes"
                onChange={setPwsClass}
              />
              <FormSelect
                compact
                label="Section"
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
                label="Sports Type"
                testID="directory-filter-sport"
                value={alphaSport}
                options={ALPHA_SPORT_FILTER_OPTIONS}
                placeholder="All sports"
                onChange={setAlphaSport}
              />
              <FormSelect
                compact
                label="Venue"
                testID="directory-filter-venue"
                value={alphaVenue}
                options={ALPHA_VENUE_FILTER_OPTIONS}
                placeholder="All venues"
                onChange={setAlphaVenue}
              />
            </>
          )}

          <FormSelect
            compact
            label="Category"
            testID="directory-filter-category"
            value={categoryFilter}
            options={CATEGORY_FILTER_OPTIONS}
            placeholder="All Categories"
            onChange={(v) => setCategoryFilter((v || "all") as CategoryFilter)}
          />
        </FormFieldGrid>

        {hasActiveFilters && (
          <TouchableOpacity style={s.clearFiltersBtn} onPress={clearFilters} testID="directory-clear-filters">
            <Feather name="rotate-ccw" size={14} color={colors.primary} />
            <Text style={s.clearFiltersTxt}>Clear filters</Text>
          </TouchableOpacity>
        )}
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
          <LoadingState message="Loading directory…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="users"
            title={hasActiveFilters ? "No matches" : "No people found"}
            message={hasActiveFilters ? "Try adjusting your search or filter selections." : "No directory entries are available yet."}
            actionLabel={hasActiveFilters ? "Clear filters" : undefined}
            onAction={hasActiveFilters ? clearFilters : undefined}
          />
        ) : (
          filtered.map((entry) => (
            <View key={`${entry.source}-${entry.id}`} style={s.row}>
              <View style={[s.avatar, { backgroundColor: ROLE_COLORS[entry.role] || "#94A3B8" }]}>
                <Text style={s.avatarTxt}>
                  {entry.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.name} numberOfLines={1}>{entry.name}</Text>
                {!!entry.email && <Text style={s.meta} numberOfLines={1}>{entry.email}</Text>}
                <Text style={s.meta} numberOfLines={1}>
                  {entry.role.replace(/_/g, " ")} · {entry.organization}{entry.department ? ` · ${entry.department}` : ""}
                </Text>
              </View>
            </View>
          ))
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
  clearFiltersBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingVertical: 4 },
  clearFiltersTxt: { fontSize: 12, fontWeight: "700", color: colors.primary },
  scroll: { paddingBottom: 40, paddingTop: 4 },
  row: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    alignItems: "center",
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  name: { fontSize: 14, fontWeight: "700", color: colors.ink },
  meta: { fontSize: 12, color: colors.muted2, marginTop: 2 },
});
