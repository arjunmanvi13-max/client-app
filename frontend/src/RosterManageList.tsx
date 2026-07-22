import { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, ROLE_COLORS, useAuth, userHasPermission } from "./auth";
import { BusinessEntity, Permission, UserRole, normalizeRole, canAddDirectoryTeacher } from "./rbac";
import { isCoachUser, resolveCoachDataScope, coachSportAssignmentMessage, unwrapCoachPlayerList } from "./coachAccess";
import { getManageListMeta } from "./manageKinds";
import { consumeManageDirectoryToast, setManageDirectoryToast } from "./manageDirectoryToast";
import { colors } from "./theme";
import { PlayerRosterListView } from "./PlayerRosterListView";
import { StudentRosterListView } from "./StudentRosterListView";
import { AddTeacherModal } from "./components/teachers/AddTeacherModal";
import { getApiError } from "./ScreenStates";

type TeacherStatusFilter = "all" | "active" | "inactive";

const TEACHER_STATUS_FILTERS: { key: TeacherStatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
];

function isTeacherInactive(record: { status?: string; is_active?: boolean }) {
  return record.status === "deactivated" || record.is_active === false;
}

function matchesTeacherSearch(record: any, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    (record.name || "").toLowerCase().includes(q)
    || (record.email || "").toLowerCase().includes(q)
    || String(record.mobile || record.phone || "").includes(q)
    || String(record.id || "").toLowerCase().includes(q)
  );
}

function sortByName<T extends { name?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }),
  );
}

/** Roster records (students, players, staff) and legacy user lists from Directory sidebar. */
export function RosterManageList({ kind }: { kind: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [centreFilter, setCentreFilter] = useState<string | null>(null);
  const [sportFilter, setSportFilter] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<TeacherStatusFilter>("all");
  const [addTeacherOpen, setAddTeacherOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const meta = getManageListMeta(kind)!;
  const isTeacherList = kind === "teacher";
  const canAddDirectoryTeacherBtn = isTeacherList && canAddDirectoryTeacher(user);
  const role = normalizeRole(user?.role || "");
  const isAdmin = userHasPermission(user, Permission.MANAGE_PLAYERS, BusinessEntity.ALPHA)
    || userHasPermission(user, Permission.ADD_PWS_STUDENTS, BusinessEntity.PWS)
    || userHasPermission(user, Permission.MANAGE_ACCESS);
  const isPlayer = kind === "player";
  const coachScope = resolveCoachDataScope(user);
  const isCoachPlayerView = isPlayer && isCoachUser(user);
  const canBrowseAllSports = isPlayer && isAdmin && !isCoachPlayerView;
  const coachBlocked = isPlayer && isCoachUser(user) && coachScope.requiresSportAssignment;
  const isStudent = kind === "student";
  const isTeacher = role === UserRole.PWS_TEACHER;
  const canAdd = (() => {
    if (isTeacherList) return false;
    if (isTeacher && kind === "student") return false;
    if (isAdmin) return true;
    if (meta.isUser) return (user?.can_manage || []).includes(kind);
    if (kind === "student") return userHasPermission(user, Permission.ADD_PWS_STUDENTS, BusinessEntity.PWS);
    if (kind === "player") return userHasPermission(user, Permission.MANAGE_PLAYERS, BusinessEntity.ALPHA);
    return (user?.can_manage || []).includes(kind);
  })();

  useEffect(() => {
    if (user && isCoachUser(user) && kind === "staff") {
      router.replace("/(tabs)/dashboard");
    }
  }, [user, kind, router]);

  useEffect(() => {
    if (!isPlayer || coachBlocked) return;
    if (isCoachPlayerView && coachScope.assignedSport) {
      setSportFilter(coachScope.assignedSport);
    }
  }, [isPlayer, isCoachPlayerView, coachScope.assignedSport, coachBlocked]);

  const load = useCallback(async () => {
    if (coachBlocked) return;
    setLoading(true);
    setLoadError(null);
    try {
      if (meta.isUser) {
        const params: Record<string, string | boolean> = { role: kind };
        if (isTeacherList) params.include_deactivated = true;
        const { data } = await api.get("/users", { params });
        let rows = data;
        if (search.trim() && !isTeacherList) {
          const q = search.trim().toLowerCase();
          rows = rows.filter((u: any) =>
            (u.name || "").toLowerCase().includes(q)
            || (u.email || "").toLowerCase().includes(q)
            || (u.mobile || "").includes(q),
          );
        }
        setItems(rows);
      } else {
        const params: any = { kind };
        if (search.trim()) params.q = search.trim();
        if (isPlayer && showDeactivated) params.include_deactivated = true;
        if (isStudent && showDeactivated) params.include_deactivated = true;
        if (isPlayer && typeFilter) params.player_type = typeFilter === "Hostel" ? "Hostel Only" : typeFilter;
        if (isPlayer && centreFilter) params.centre = centreFilter;
        if (isPlayer && sportFilter) params.sport = sportFilter;
        if (isStudent && classFilter) params.pws_class = classFilter;
        const { data } = await api.get("/people", { params });
        setItems(isPlayer && isCoachUser(user) ? unwrapCoachPlayerList(data) : data);
      }
    } catch (e: any) {
      setItems([]);
      setLoadError(getApiError(e, "Could not load records. Please try again."));
    } finally { setLoading(false); }
  }, [kind, meta, isPlayer, isStudent, isTeacherList, showDeactivated, search, typeFilter, classFilter, centreFilter, sportFilter, user, coachBlocked]);

  const visibleItems = useMemo(() => {
    if (!isTeacherList) return items;
    let rows = items;
    if (teacherStatusFilter === "active") {
      rows = rows.filter((u) => !isTeacherInactive(u));
    } else if (teacherStatusFilter === "inactive") {
      rows = rows.filter((u) => isTeacherInactive(u));
    }
    if (search.trim()) {
      rows = rows.filter((u) => matchesTeacherSearch(u, search));
    }
    return sortByName(rows);
  }, [items, isTeacherList, teacherStatusFilter, search]);

  const listItems = isTeacherList ? visibleItems : items;
  const hasTeacherCriteria = isTeacherList && (teacherStatusFilter !== "all" || !!search.trim());

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useFocusEffect(useCallback(() => {
    const message = consumeManageDirectoryToast();
    if (message) setToastMessage(message);
  }, []));

  if (user && isCoachUser(user) && kind === "staff") {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <ActivityIndicator color="#1E40AF" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (isPlayer) {
    return (
      <PlayerRosterListView
        items={items}
        loading={loading}
        search={search}
        setSearch={setSearch}
        onSearchSubmit={load}
        showDeactivated={showDeactivated}
        setShowDeactivated={setShowDeactivated}
        sportFilter={sportFilter}
        setSportFilter={setSportFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        centreFilter={centreFilter}
        setCentreFilter={setCentreFilter}
        canBrowseAllSports={canBrowseAllSports}
        isCoachPlayerView={isCoachPlayerView}
        coachScope={coachScope}
        isAdmin={isAdmin}
        coachBlocked={coachBlocked}
        canAdd={canAdd}
        onAdd={() => router.push("/manage/player/new")}
        onBack={() => router.back()}
        onOpenPlayer={(id) => router.push(`/manage/player/${id}`)}
      />
    );
  }

  if (isStudent) {
    return (
      <StudentRosterListView
        items={items}
        loading={loading}
        search={search}
        setSearch={setSearch}
        onSearchSubmit={load}
        showDeactivated={showDeactivated}
        setShowDeactivated={setShowDeactivated}
        classFilter={classFilter}
        setClassFilter={setClassFilter}
        isAdmin={isAdmin}
        canAdd={canAdd}
        onAdd={() => router.push("/manage/student/new")}
        onBack={() => router.back()}
        onOpenStudent={(id) => router.push(`/manage/student/${id}`)}
      />
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="list-back">
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>{meta.label}</Text>
          <Text style={s.sub}>{listItems.length} record{listItems.length !== 1 ? "s" : ""}</Text>
          {isPlayer && isCoachUser(user) && coachScope.assignedSport && !coachScope.requiresSportAssignment && (
            <View style={s.scopeBadge}>
              <Feather name="lock" size={12} color="#1E40AF" />
              <Text style={s.scopeText}>Showing {coachScope.assignedSport} players</Text>
            </View>
          )}
        </View>
        {canAdd && (
        <TouchableOpacity
          testID={`add-${kind}`}
          style={[s.addBtn, { backgroundColor: meta.tint }, !canAdd && { opacity: 0.45 }]}
          disabled={!canAdd}
          onPress={() => router.push(`/manage/${kind}/new`)}
          accessibilityState={{ disabled: !canAdd }}
        >
          <Feather name="plus" size={18} color="#fff" />
          <Text style={s.addText}>Add</Text>
        </TouchableOpacity>
        )}
      </View>

      {toastMessage ? (
        <View style={s.toastBanner} testID="directory-toast">
          <Feather name="check-circle" size={16} color={colors.success} />
          <Text style={s.toastTxt}>{toastMessage}</Text>
          <TouchableOpacity onPress={() => setToastMessage(null)} hitSlop={8}>
            <Feather name="x" size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>
      ) : null}

      {loadError ? (
        <View style={s.loadErrorBanner} testID="directory-load-error">
          <Feather name="alert-circle" size={16} color="#991B1B" />
          <Text style={s.loadErrorTxt}>{loadError}</Text>
          <TouchableOpacity onPress={() => { void load(); }} hitSlop={8} testID="directory-retry">
            <Text style={s.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={s.searchRow}>
        {!coachBlocked && (
        <>
        <Feather name="search" size={16} color="#94A3B8" />
        <TextInput
          testID="people-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, ID, phone…"
          placeholderTextColor="#94A3B8"
          style={s.searchInput}
          onSubmitEditing={load}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(""); }}>
            <Feather name="x" size={16} color="#94A3B8" />
          </TouchableOpacity>
        )}
        </>
        )}
      </View>

      {isTeacherList && canAddDirectoryTeacherBtn && (
        <View style={s.teacherActionRow} testID="teacher-add-action-row">
          <TouchableOpacity
            testID="add-teacher-btn"
            style={[s.addTeacherBtn, { backgroundColor: meta.tint }]}
            onPress={() => setAddTeacherOpen(true)}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={s.addTeacherText}>Add Teacher</Text>
          </TouchableOpacity>
        </View>
      )}

      {isTeacherList && (
        <View style={s.toggleRow} testID="teacher-status-filters">
          {TEACHER_STATUS_FILTERS.map(({ key, label }) => {
            const active = teacherStatusFilter === key;
            return (
              <TouchableOpacity
                key={key}
                testID={`teacher-filter-${key}`}
                style={[s.togglePill, active && s.togglePillActive]}
                onPress={() => setTeacherStatusFilter(key)}
              >
                <Text style={[s.toggleTxt, active && s.toggleTxtActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {coachBlocked && (
        <View style={s.blockedBox}>
          <Feather name="alert-circle" size={28} color="#DC2626" />
          <Text style={s.blockedTitle}>Sport assignment required</Text>
          <Text style={s.blockedText}>{coachSportAssignmentMessage(coachScope)}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll}>
        {loading ? <ActivityIndicator color={meta.tint} style={{ marginTop: 24 }} /> :
         listItems.length === 0 ? (
           <View style={s.empty}>
             <Feather name="users" size={36} color="#94A3B8" />
             <Text style={s.emptyText}>
               {isTeacherList && hasTeacherCriteria
                 ? "No teachers found matching this criteria."
                 : isTeacherList
                   ? canAddDirectoryTeacherBtn
                     ? "No teachers yet. Tap Add Teacher to create one."
                     : "No teachers yet."
                 : search.trim()
                   ? `No matches for "${search.trim()}".`
                   : `No ${meta.label.toLowerCase()} yet. Tap Add to create one.`}
             </Text>
           </View>
         ) : listItems.map((it) => {
          const isDeact = isTeacherInactive(it);
          return (
          <TouchableOpacity
            key={it.id}
            testID={`row-${it.id}`}
            style={[s.row, isDeact && s.rowDeact]}
            onPress={() => router.push(`/manage/${kind}/${it.id}`)}
          >
            <View style={[s.avatar, { backgroundColor: isDeact ? "#94A3B8" : (ROLE_COLORS[kind] || meta.tint) }]}>
              <Text style={s.avatarTxt}>{it.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={s.name}>{it.name}</Text>
                {isDeact && <View style={s.deactPill}><Text style={s.deactPillTxt}>Inactive</Text></View>}
              </View>
              <Text style={s.metaTxt}>{meta.subtitle(it)}</Text>
              {meta.isUser && it.can_manage?.length > 0 && (
                <View style={s.permRow}>
                  {it.can_manage.map((p: string) => (
                    <View key={p} style={s.permPill}><Text style={s.permTxt}>{p}</Text></View>
                  ))}
                </View>
              )}
            </View>
            <Feather name="chevron-right" size={18} color="#94A3B8" />
          </TouchableOpacity>
          );
        })}
      </ScrollView>

      <AddTeacherModal
        visible={addTeacherOpen}
        onClose={() => setAddTeacherOpen(false)}
        onCreated={(message) => {
          if (message) {
            setToastMessage(message);
            setManageDirectoryToast(message);
          }
          void load();
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  backBtn: { padding: 8 },
  h1: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  sub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  addText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 20, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  teacherActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  addTeacherBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  addTeacherText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  searchInput: { flex: 1, fontSize: 14, color: "#0F172A", padding: 0 },
  toggleRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 10 },
  typeScroll: { maxHeight: 44, marginTop: 8 },
  typeRow: { paddingHorizontal: 20, gap: 8, alignItems: "center" },
  togglePill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  togglePillActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  togglePillLocked: { backgroundColor: "#EFF6FF", borderColor: "#93C5FD" },
  toggleTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  toggleTxtActive: { color: "#fff" },
  toggleTxtLocked: { color: "#1E40AF" },
  scroll: { padding: 20, paddingBottom: 40 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  rowDeact: { opacity: 0.65 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  name: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  metaTxt: { fontSize: 12, color: "#64748B", marginTop: 2 },
  deactPill: { backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  deactPillTxt: { fontSize: 10, fontWeight: "800", color: "#64748B" },
  permRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  permPill: { backgroundColor: "#EEF2FF", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  permTxt: { fontSize: 10, fontWeight: "700", color: "#1E40AF" },
  empty: { alignItems: "center", padding: 40, gap: 8 },
  emptyText: { color: "#64748B", textAlign: "center", fontSize: 13 },
  scopeBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, alignSelf: "flex-start", backgroundColor: "#EFF6FF", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  scopeText: { color: "#1E40AF", fontWeight: "700", fontSize: 11 },
  blockedBox: { marginHorizontal: 20, marginTop: 16, padding: 20, backgroundColor: "#FEF2F2", borderRadius: 14, borderWidth: 1, borderColor: "#FECACA", alignItems: "center", gap: 8 },
  blockedTitle: { fontSize: 16, fontWeight: "800", color: "#991B1B" },
  blockedText: { textAlign: "center", color: "#7F1D1D", lineHeight: 20 },
  toastBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.successSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  toastTxt: { flex: 1, fontSize: 13, fontWeight: "700", color: "#065F46" },
  loadErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  loadErrorTxt: { flex: 1, fontSize: 13, fontWeight: "600", color: "#991B1B" },
  retryTxt: { fontSize: 12, fontWeight: "800", color: "#1E40AF" },
});
