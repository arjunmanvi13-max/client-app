import { useCallback, useMemo, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../../src/auth";
import { canAccessTimetable, canViewTimetableAll } from "../../../src/rbac";
import { LoadingState, ErrorState } from "../../../src/ScreenStates";
import { useBreakpoint } from "../../../src/useBreakpoint";
import { colors, radii, spacing } from "../../../src/theme";
import { fetchMyWeek, fetchTimetableMeta } from "../../../src/timetable/timetableApi";
import {
  DAYS, DAY_LABELS, formatTimeRange, subjectColor, type SchedulePeriod,
} from "../../../src/timetable/timetableUtils";

export default function MyTimetableScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { horizontalPadding, contentMaxWidth, isWide, width } = useBreakpoint();
  const isMobile = width < 768;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [yearId, setYearId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const meta = await fetchTimetableMeta();
      const yid = meta.open_year_id || meta.years[0]?.id;
      setYearId(yid || null);
      if (yid) {
        const data = await fetchMyWeek(yid);
        setPeriods(data.periods || []);
      }
    } catch (e: any) {
      const status = e?.response?.status;
      setError(status === 404
        ? "Time Table API is not available on this server yet. Deploy the latest backend."
        : (e?.response?.data?.detail || "Failed to load timetable"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const byDay = useMemo(() => {
    const map: Record<string, SchedulePeriod[]> = {};
    DAYS.forEach((d) => { map[d] = []; });
    periods.forEach((p) => {
      const d = p.day_of_week || "MON";
      if (map[d]) map[d].push(p);
    });
    Object.values(map).forEach((rows) =>
      rows.sort((a, b) => (a.period?.period_order ?? 0) - (b.period?.period_order ?? 0)),
    );
    return map;
  }, [periods]);

  if (!user || !canAccessTimetable(user)) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.denied}>Time Table is not available for your role.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: contentMaxWidth ? "center" : undefined, width: contentMaxWidth ? "100%" : undefined },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Feather name="arrow-left" size={18} color={colors.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>PWS · Time Table</Text>
            <Text style={s.h1}>My Time Table</Text>
            <Text style={s.helper}>Read-only weekly schedule</Text>
          </View>
          {canViewTimetableAll(user) && (
            <TouchableOpacity style={s.adminBtn} onPress={() => router.push("/academics/timetable")}>
              <Text style={s.adminBtnTxt}>Admin view</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <LoadingState message="Loading schedule…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : isMobile ? (
          DAYS.map((day) => (
            <View key={day} style={s.dayBlock}>
              <Text style={s.dayTitle}>{DAY_LABELS[day]}</Text>
              {byDay[day].length === 0 ? (
                <Text style={s.emptyDay}>No periods</Text>
              ) : (
                byDay[day].map((p) => (
                  <View key={p.id} style={[s.mobileRow, { borderLeftColor: subjectColor(p.subject_name) }]}>
                    <Text style={s.time}>{formatTimeRange(p.period?.start_time, p.period?.end_time)}</Text>
                    <Text style={s.subject}>{p.subject_name || "—"}</Text>
                    <Text style={s.classTxt}>{[p.class_name, p.section_label].filter(Boolean).join(" ")}</Text>
                    {p.is_substitute && <Text style={s.subNote}>Covering for {p.covering_for}</Text>}
                    {p.is_covered && <Text style={s.coveredNote}>Covered by {p.covered_by}</Text>}
                  </View>
                ))
              )}
            </View>
          ))
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.weekGrid}>
              {DAYS.map((day) => (
                <View key={day} style={s.dayCol}>
                  <Text style={s.colHead}>{DAY_LABELS[day]}</Text>
                  {byDay[day].map((p) => (
                    <View key={p.id} style={[s.cell, { backgroundColor: `${subjectColor(p.subject_name)}18` }]}>
                      <Text style={s.cellTime}>{p.period?.period_label}</Text>
                      <Text style={s.cellSubj} numberOfLines={1}>{p.subject_name || "—"}</Text>
                      <Text style={s.cellClass} numberOfLines={1}>
                        {[p.class_name, p.section_label].filter(Boolean).join(" ")}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.xxl, paddingTop: spacing.lg },
  denied: { padding: spacing.xl, color: colors.muted, fontSize: 15 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.lg },
  backBtn: { padding: 6, borderRadius: radii.sm, backgroundColor: colors.primarySofter, marginTop: 4 },
  overline: { fontSize: 10, color: colors.primary, fontWeight: "800", letterSpacing: 0.8 },
  h1: { fontSize: 24, fontWeight: "800", color: colors.ink, marginTop: 2 },
  helper: { fontSize: 13, color: colors.muted2, marginTop: 4 },
  adminBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.md, borderWidth: 1, borderColor: colors.primary },
  adminBtnTxt: { fontSize: 12, fontWeight: "700", color: colors.primary },
  dayBlock: { marginBottom: spacing.lg },
  dayTitle: { fontSize: 14, fontWeight: "800", color: colors.ink, marginBottom: spacing.sm },
  emptyDay: { fontSize: 13, color: colors.muted2, paddingVertical: spacing.sm },
  mobileRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  time: { fontSize: 12, fontWeight: "600", color: colors.muted2 },
  subject: { fontSize: 15, fontWeight: "700", color: colors.ink, marginTop: 2 },
  classTxt: { fontSize: 13, color: colors.muted, marginTop: 2 },
  subNote: { fontSize: 11, color: "#B45309", marginTop: 4, fontWeight: "600" },
  coveredNote: { fontSize: 11, color: colors.muted2, marginTop: 4, textDecorationLine: "line-through" },
  weekGrid: { flexDirection: "row", gap: spacing.sm, paddingBottom: spacing.lg },
  dayCol: { width: 140, gap: spacing.sm },
  colHead: { fontSize: 12, fontWeight: "800", color: colors.primary, textAlign: "center", marginBottom: 4 },
  cell: { borderRadius: radii.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.borderSoft, minHeight: 72 },
  cellTime: { fontSize: 10, fontWeight: "700", color: colors.muted2 },
  cellSubj: { fontSize: 12, fontWeight: "700", color: colors.ink, marginTop: 2 },
  cellClass: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
