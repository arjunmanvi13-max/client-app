import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl,
  Platform, Alert, TextInput, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../../src/auth";
import { canAccessTimetable, canViewTimetableAll, isPwsTeacherUser } from "../../../src/rbac";
import { LoadingState, ErrorState } from "../../../src/ScreenStates";
import { useBreakpoint } from "../../../src/useBreakpoint";
import { colors, radii, spacing } from "../../../src/theme";
import { TimetableSlotDrawer } from "../../../src/timetable/TimetableSlotDrawer";
import {
  createSubstitution,
  fetchAbsences,
  fetchGrades,
  fetchPeriods,
  fetchSlots,
  fetchSubjects,
  fetchSubstitutes,
  fetchTeacherLoad,
  fetchTeachers,
  fetchTimetableMeta,
  publishTimetable,
  revokeSubstitution,
} from "../../../src/timetable/timetableApi";
import {
  DAYS, DAY_LABELS, dayOfWeekForDate, formatTimeRange, isoToday,
  isNonTeachingPeriod, scheduleGroupForGrade, subjectColor,
  type AbsenceRow, type DayOfWeek, type TeacherLoadRow,
  type TimetablePeriod, type TimetableSlot,
} from "../../../src/timetable/timetableUtils";

type ViewMode = "class" | "teacher" | "day";

function SetupField({ label, children, flex = 1 }: { label: string; children: React.ReactNode; flex?: number }) {
  return (
    <View style={{ flex, minWidth: 140 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export default function TimetableScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { horizontalPadding, contentMaxWidth } = useBreakpoint();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [meta, setMeta] = useState<Awaited<ReturnType<typeof fetchTimetableMeta>> | null>(null);
  const [yearId, setYearId] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("class");
  const [selectedDate, setSelectedDate] = useState(isoToday());
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(dayOfWeekForDate(isoToday()) || "MON");
  const [classId, setClassId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [grades, setGrades] = useState<Array<{ id: string; name: string; label?: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string; grade_ids?: string[] }>>([]);
  const [teachers, setTeachers] = useState<Array<{ id: string; name: string }>>([]);
  const [periods, setPeriods] = useState<TimetablePeriod[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [absences, setAbsences] = useState<AbsenceRow[]>([]);
  const [teacherLoad, setTeacherLoad] = useState<TeacherLoadRow[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editContext, setEditContext] = useState<{
    slot: TimetableSlot | null;
    period: TimetablePeriod;
    day: DayOfWeek;
    classId: string;
    classLabel: string;
  } | null>(null);
  const [subPicker, setSubPicker] = useState<{ slotId: string; row: AbsenceRow } | null>(null);
  const [subCandidates, setSubCandidates] = useState<Array<{ teacher_id: string; name?: string; weekly_periods: number; high_load: boolean }>>([]);

  const perms = meta?.permissions;
  const canManage = !!perms?.create;
  const canSubstitute = !!perms?.substitute;
  const canPublish = !!perms?.publish;

  useEffect(() => {
    if (authLoading || !user || loading) return;
    if (isPwsTeacherUser(user) && !canViewTimetableAll(user)) {
      router.replace("/academics/timetable/my");
    }
  }, [user, authLoading, loading, router]);

  const selectedGrade = grades.find((g) => g.id === classId);
  const scheduleGroup = selectedGrade ? scheduleGroupForGrade(selectedGrade.name) : "PRIMARY_SECONDARY";
  const dayType = selectedDay === "SAT" ? "SATURDAY" : "WEEKDAY";

  const loadMeta = useCallback(async () => {
    try {
      const m = await fetchTimetableMeta();
      setMeta(m);
      const yid = m.open_year_id || m.years[0]?.id || "";
      setYearId((prev) => prev || yid);
      return yid;
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = status === 404
        ? "Time Table API is not available on this server yet. Deploy the latest backend or point EXPO_PUBLIC_BACKEND_URL to a server with the timetable module."
        : (e?.response?.data?.detail || "Failed to load timetable setup");
      setError(msg);
      setLoading(false);
      return "";
    }
  }, []);

  const loadData = useCallback(async (yearOverride?: string) => {
    const activeYear = yearOverride || yearId;
    if (!activeYear) return;
    setError("");
    try {
      const [g, sub, t, load] = await Promise.all([
        fetchGrades(activeYear),
        fetchSubjects(activeYear),
        fetchTeachers(),
        canViewTimetableAll(user!) ? fetchTeacherLoad(activeYear) : Promise.resolve([]),
      ]);
      setGrades(g);
      setSubjects(sub);
      setTeachers(t);
      setTeacherLoad(load);
      if (!classId && g[0]) setClassId(g[0].id);
      if (!teacherId && t[0]) setTeacherId(t[0].id);

      const p = await fetchPeriods({
        academic_year_id: activeYear,
        schedule_group: scheduleGroup,
        day_type: dayType,
      });
      setPeriods(p);

      const slotParams: Record<string, string> = { academic_year_id: activeYear, date: selectedDate };
      if (viewMode === "class" && classId) slotParams.class_id = classId;
      if (viewMode === "teacher" && teacherId) slotParams.teacher_id = teacherId;
      if (viewMode === "day") slotParams.day = selectedDay;
      const slotRows = await fetchSlots(slotParams);
      setSlots(slotRows);

      if (canSubstitute) {
        const abs = await fetchAbsences(selectedDate, activeYear);
        setAbsences(abs);
      }
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load timetable");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [yearId, classId, teacherId, viewMode, selectedDay, selectedDate, scheduleGroup, dayType, canSubstitute, user]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    setError("");
    (async () => {
      const yid = await loadMeta();
      if (yid) await loadData(yid);
      else setLoading(false);
    })();
  }, [loadMeta, loadData]));

  useEffect(() => {
    if (yearId) loadData();
  }, [yearId, classId, teacherId, viewMode, selectedDay, selectedDate, scheduleGroup, dayType]);

  useEffect(() => {
    const d = dayOfWeekForDate(selectedDate);
    if (d) setSelectedDay(d);
  }, [selectedDate]);

  const slotMap = useMemo(() => {
    const m = new Map<string, TimetableSlot>();
    slots.forEach((sl) => m.set(`${sl.day_of_week}:${sl.period_id}`, sl));
    return m;
  }, [slots]);

  const subjectName = (id?: string | null) => subjects.find((s) => s.id === id)?.name;
  const teacherName = (id?: string | null) => teachers.find((t) => t.id === id)?.name;
  const classLabel = (id: string) => {
    const g = grades.find((x) => x.id === id);
    return g?.label || g?.name || id;
  };

  const openCell = (period: TimetablePeriod, day: DayOfWeek, cid: string) => {
    if (!canManage || isNonTeachingPeriod(period.period_type)) return;
    const key = `${day}:${period.id}`;
    setEditContext({
      slot: slotMap.get(key) || null,
      period,
      day,
      classId: cid,
      classLabel: classLabel(cid),
    });
    setDrawerOpen(true);
  };

  const openSubstitute = async (row: AbsenceRow) => {
    if (!yearId) return;
    const cands = await fetchSubstitutes(row.slot_id, selectedDate, yearId);
    setSubCandidates(cands);
    setSubPicker({ slotId: row.slot_id, row });
  };

  const assignSubstitute = async (substituteTeacherId?: string) => {
    if (!subPicker) return;
    try {
      await createSubstitution({
        slot_id: subPicker.slotId,
        substitution_date: selectedDate,
        substitute_teacher_id: substituteTeacherId || null,
        reason: "TEACHER_ABSENT",
      });
      setSubPicker(null);
      loadData();
      Alert.alert("Saved", substituteTeacherId ? "Substitute assigned." : "Marked as free study.");
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to assign substitute");
    }
  };

  const handlePublish = () => {
    Alert.alert("Publish timetable", "Teachers will see all draft allocations as published.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Publish",
        onPress: async () => {
          try {
            const res = await publishTimetable(yearId);
            Alert.alert("Published", `${res.published || 0} slot(s) published.`);
            loadData();
            loadMeta();
          } catch (e: any) {
            Alert.alert("Error", e?.response?.data?.detail || "Publish failed");
          }
        },
      },
    ]);
  };

  if (authLoading) {
    return (
      <SafeAreaView style={s.safe}>
        <LoadingState message="Checking access…" />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.denied}>Please log in to view the Time Table.</Text>
        <TouchableOpacity style={s.loginBtn} onPress={() => router.push("/login")}>
          <Text style={s.loginBtnTxt}>Go to login</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (!canAccessTimetable(user)) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.denied}>Time Table is not available for your role.</Text>
      </SafeAreaView>
    );
  }

  const renderTeacherGrid = () => (
    <ScrollView horizontal={!isMobile} showsHorizontalScrollIndicator={false}>
      <View>
        <View style={s.gridRow}>
          <View style={[s.gridCorner, { width: isMobile ? 72 : 100 }]} />
          {DAYS.map((d) => (
            <View key={d} style={[s.gridHeadCell, isMobile && s.gridHeadCellMobile]}>
              <Text style={s.gridHeadTxt}>{isMobile ? d : DAY_LABELS[d]}</Text>
            </View>
          ))}
        </View>
        {periods.map((period) => {
          if (isNonTeachingPeriod(period.period_type)) {
            return (
              <View key={period.id} style={s.bandRow}>
                <Text style={s.bandTxt}>
                  {period.period_label} · {formatTimeRange(period.start_time, period.end_time)}
                </Text>
              </View>
            );
          }
          return (
            <View key={period.id} style={s.gridRow}>
              <View style={[s.periodLabelCell, { width: isMobile ? 72 : 100 }]}>
                <Text style={s.periodLabel}>{period.period_label}</Text>
                <Text style={s.periodTime}>{period.start_time}</Text>
              </View>
              {DAYS.map((day) => {
                const slot = slots.find((sl) => sl.day_of_week === day && sl.period_id === period.id);
                const subj = subjectName(slot?.subject_id);
                const tint = subjectColor(subj);
                return (
                  <View
                    key={day}
                    style={[s.gridCell, isMobile && s.gridCellMobile, slot ? { backgroundColor: `${tint}14`, borderColor: tint } : s.freeCell]}
                  >
                    {slot ? (
                      <>
                        <Text style={s.cellPrimary} numberOfLines={1}>{classLabel(slot.class_id)}</Text>
                        <Text style={s.cellSecondary} numberOfLines={1}>{subj || "—"}</Text>
                      </>
                    ) : (
                      <Text style={s.freeTxt}>Free</Text>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderClassGrid = () => (
    <ScrollView horizontal={!isMobile} showsHorizontalScrollIndicator={false}>
      <View>
        <View style={s.gridRow}>
          <View style={[s.gridCorner, { width: isMobile ? 72 : 100 }]} />
          {DAYS.map((d) => (
            <View key={d} style={[s.gridHeadCell, isMobile && s.gridHeadCellMobile]}>
              <Text style={s.gridHeadTxt}>{isMobile ? d : DAY_LABELS[d]}</Text>
            </View>
          ))}
        </View>
        {periods.map((period) => {
          if (isNonTeachingPeriod(period.period_type)) {
            return (
              <View key={period.id} style={s.bandRow}>
                <Text style={s.bandTxt}>
                  {period.period_label} · {formatTimeRange(period.start_time, period.end_time)}
                </Text>
              </View>
            );
          }
          return (
            <View key={period.id} style={s.gridRow}>
              <View style={[s.periodLabelCell, { width: isMobile ? 72 : 100 }]}>
                <Text style={s.periodLabel}>{period.period_label}</Text>
                <Text style={s.periodTime}>{period.start_time}</Text>
              </View>
              {DAYS.map((day) => {
                const slot = slotMap.get(`${day}:${period.id}`);
                const subj = subjectName(slot?.subject_id);
                const tint = subjectColor(subj);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[s.gridCell, isMobile && s.gridCellMobile, { backgroundColor: `${tint}14`, borderColor: tint }]}
                    onPress={() => openCell(period, day, classId)}
                    disabled={!canManage}
                  >
                    {slot ? (
                      <>
                        <Text style={s.cellPrimary} numberOfLines={1}>{subj || "—"}</Text>
                        <Text style={s.cellSecondary} numberOfLines={1}>{teacherName(slot.teacher_id) || "—"}</Text>
                        {slot.status === "DRAFT" && <Text style={s.draftTag}>Draft</Text>}
                      </>
                    ) : (
                      <Text style={s.emptyCell}>+</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );

  const renderDayGrid = () => (
    <ScrollView horizontal={!isMobile}>
      <View>
        <View style={s.gridRow}>
          <View style={[s.gridCorner, { width: 100 }]}><Text style={s.gridHeadTxt}>Class</Text></View>
          {periods.map((p) => (
            <View key={p.id} style={[s.gridHeadCell, { width: 96 }]}>
              <Text style={s.gridHeadTxt}>{p.period_label}</Text>
            </View>
          ))}
        </View>
        {grades.map((g) => (
          <View key={g.id} style={s.gridRow}>
            <View style={[s.periodLabelCell, { width: 100 }]}>
              <Text style={s.periodLabel}>{g.label || g.name}</Text>
            </View>
            {periods.map((period) => {
              if (isNonTeachingPeriod(period.period_type)) {
                return <View key={period.id} style={[s.gridCell, { width: 96, backgroundColor: colors.borderSoft }]} />;
              }
              const slot = slots.find((sl) => sl.class_id === g.id && sl.period_id === period.id);
              const subj = subjectName(slot?.subject_id);
              return (
                <TouchableOpacity
                  key={period.id}
                  style={[s.gridCell, { width: 96, backgroundColor: `${subjectColor(subj)}14` }]}
                  onPress={() => openCell(period, selectedDay, g.id)}
                  disabled={!canManage}
                >
                  <Text style={s.cellPrimary} numberOfLines={1}>{subj || "—"}</Text>
                  <Text style={s.cellSecondary} numberOfLines={1}>{teacherName(slot?.teacher_id) || "—"}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          s.scroll,
          { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: contentMaxWidth ? "center" : undefined, width: contentMaxWidth ? "100%" : undefined },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>PWS · Academic & Assessment</Text>
            <Text style={s.h1}>Time Table</Text>
            <Text style={s.helper}>Class allocations, substitutions and teacher load</Text>
          </View>
          {canPublish && (meta?.draft_count ?? 0) > 0 && (
            <TouchableOpacity style={s.publishBtn} onPress={handlePublish}>
              <Feather name="send" size={14} color="#fff" />
              <Text style={s.publishTxt}>Publish</Text>
            </TouchableOpacity>
          )}
        </View>

        {(meta?.draft_count ?? 0) > 0 && (
          <View style={s.draftBanner}>
            <Feather name="alert-circle" size={16} color="#B45309" />
            <Text style={s.draftBannerTxt}>Unpublished changes ({meta?.draft_count})</Text>
          </View>
        )}

        <View style={[s.setupCard, isMobile && s.setupStacked]}>
          <View style={[s.setupGrid, isMobile && { flexDirection: "column" }]}>
            <SetupField label="Academic year">
              <View style={s.selectBtn}>
                <Text style={s.selectBtnTxt} numberOfLines={1}>
                  {meta?.years.find((y) => y.id === yearId)?.name || yearId || "—"}
                </Text>
              </View>
            </SetupField>
            <SetupField label="View by">
              <View style={s.segment}>
                {(["class", "teacher", "day"] as ViewMode[]).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[s.segBtn, viewMode === m && s.segBtnActive]}
                    onPress={() => setViewMode(m)}
                  >
                    <Text style={[s.segTxt, viewMode === m && s.segTxtActive]}>
                      {m === "class" ? "Class" : m === "teacher" ? "Teacher" : "Day"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </SetupField>
            {viewMode === "class" && (
              <SetupField label="Class">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.chipRow}>
                    {grades.map((g) => (
                      <TouchableOpacity
                        key={g.id}
                        style={[s.chip, classId === g.id && s.chipActive]}
                        onPress={() => setClassId(g.id)}
                      >
                        <Text style={[s.chipTxt, classId === g.id && s.chipTxtActive]}>{g.label || g.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </SetupField>
            )}
            {viewMode === "teacher" && (
              <SetupField label="Teacher">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.chipRow}>
                    {teachers.map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        style={[s.chip, teacherId === t.id && s.chipActive]}
                        onPress={() => setTeacherId(t.id)}
                      >
                        <Text style={[s.chipTxt, teacherId === t.id && s.chipTxtActive]}>{t.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </SetupField>
            )}
            {viewMode === "day" && (
              <SetupField label="Day">
                <View style={s.chipRow}>
                  {DAYS.map((d) => (
                    <TouchableOpacity
                      key={d}
                      style={[s.chip, selectedDay === d && s.chipActive]}
                      onPress={() => setSelectedDay(d)}
                    >
                      <Text style={[s.chipTxt, selectedDay === d && s.chipTxtActive]}>{DAY_LABELS[d]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </SetupField>
            )}
            <SetupField label="Date" flex={0.9}>
              <TextInput
                style={s.dateInput}
                value={selectedDate}
                onChangeText={setSelectedDate}
                placeholder="YYYY-MM-DD"
              />
            </SetupField>
          </View>
        </View>

        {canSubstitute && absences.length > 0 && (
          <View style={s.subPanel}>
            <Text style={s.subPanelTitle}>Today&apos;s Substitutions · {selectedDate}</Text>
            {absences.map((row) => (
              <View key={row.slot_id} style={s.subRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.subPrimary}>
                    {row.class_label} · {row.period_label} · {row.subject_name}
                  </Text>
                  <Text style={s.subSecondary}>
                    {formatTimeRange(row.start_time, row.end_time)} · Absent: {row.absent_teacher_name}
                  </Text>
                </View>
                {row.status === "pending" ? (
                  <TouchableOpacity style={s.subAction} onPress={() => openSubstitute(row)}>
                    <Text style={s.subActionTxt}>Assign</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={s.subDone}>
                    <Text style={s.subDoneTxt}>Assigned</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {loading ? (
          <LoadingState message="Loading timetable…" />
        ) : error ? (
          <ErrorState message={error} onRetry={loadData} />
        ) : viewMode === "day" ? (
          renderDayGrid()
        ) : viewMode === "teacher" ? (
          renderTeacherGrid()
        ) : (
          renderClassGrid()
        )}

        {teacherLoad.length > 0 && (
          <View style={s.loadPanel}>
            <Text style={s.loadTitle}>Teacher load (periods / week)</Text>
            <View style={s.loadRow}>
              {teacherLoad.slice(0, 8).map((t) => (
                <View key={t.teacher_id} style={[s.loadChip, t.over_limit && s.loadChipWarn]}>
                  <Text style={s.loadChipTxt}>{t.name}: {t.weekly_periods}</Text>
                  {t.over_limit && <Text style={s.loadWarn}>High</Text>}
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {editContext && (
        <TimetableSlotDrawer
          visible={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onSaved={loadData}
          slot={editContext.slot}
          period={editContext.period}
          day={editContext.day}
          classId={editContext.classId}
          classLabel={editContext.classLabel}
          academicYearId={yearId}
          allocationDate={selectedDate}
          subjects={subjects}
          teachers={teachers}
          canEdit={!!perms?.edit}
          canDelete={!!perms?.delete}
        />
      )}

      {subPicker && (
        <View style={s.subModal}>
          <View style={s.subModalCard}>
            <Text style={s.subModalTitle}>Assign substitute</Text>
            <Text style={s.subModalMeta}>
              {subPicker.row.class_label} · {subPicker.row.period_label}
            </Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {subCandidates.map((c) => (
                <TouchableOpacity key={c.teacher_id} style={s.subCand} onPress={() => assignSubstitute(c.teacher_id)}>
                  <Text style={s.subCandName}>{c.name}</Text>
                  <Text style={s.subCandMeta}>
                    {c.weekly_periods} periods/wk {c.high_load ? "· High load" : ""}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.freeStudyBtn} onPress={() => assignSubstitute()}>
              <Text style={s.freeStudyTxt}>Leave unassigned / Free study</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSubPicker(null)} style={s.subModalClose}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.xxl, paddingTop: spacing.lg },
  denied: { padding: spacing.xl, color: colors.muted, fontSize: 15 },
  loginBtn: {
    marginHorizontal: spacing.xl,
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  loginBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.md },
  overline: { fontSize: 10, color: colors.primary, fontWeight: "800", letterSpacing: 0.8 },
  h1: { fontSize: 26, fontWeight: "800", color: colors.ink, marginTop: 2 },
  helper: { fontSize: 13, color: colors.muted2, marginTop: 4 },
  publishBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.md,
  },
  publishTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  draftBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#FFFBEB", borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: "#FDE68A",
  },
  draftBannerTxt: { fontSize: 13, fontWeight: "700", color: "#B45309" },
  setupCard: {
    backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.borderSoft,
    ...Platform.select({ web: { boxShadow: "0 1px 3px rgba(15,23,42,0.05)" } as any, default: {} }),
  },
  setupStacked: {},
  setupGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, alignItems: "flex-end" },
  fieldLabel: { fontSize: 10, fontWeight: "800", color: colors.muted2, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  selectBtn: {
    flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border,
    borderRadius: radii.xl, paddingHorizontal: 12, paddingVertical: 10, minHeight: 42, backgroundColor: colors.surface,
  },
  selectBtnTxt: { fontSize: 13, fontWeight: "600", color: colors.ink },
  segment: { flexDirection: "row", borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, overflow: "hidden" },
  segBtn: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface2 },
  segBtnActive: { backgroundColor: colors.primarySoft },
  segTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  segTxtActive: { color: colors.primary },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipTxt: { fontSize: 12, fontWeight: "600", color: colors.muted },
  chipTxtActive: { color: colors.primary },
  dateInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radii.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, minHeight: 42, backgroundColor: colors.surface,
  },
  subPanel: {
    backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg,
    marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  subPanelTitle: { fontSize: 14, fontWeight: "800", color: colors.ink, marginBottom: spacing.md },
  subRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderSoft },
  subPrimary: { fontSize: 13, fontWeight: "700", color: colors.ink },
  subSecondary: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  subAction: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.md },
  subActionTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
  subDone: { backgroundColor: colors.successSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill },
  subDoneTxt: { color: "#047857", fontWeight: "700", fontSize: 11 },
  gridRow: { flexDirection: "row" },
  gridCorner: { padding: spacing.sm },
  gridHeadCell: { width: 108, padding: spacing.sm, alignItems: "center" },
  gridHeadCellMobile: { width: 72 },
  gridHeadTxt: { fontSize: 11, fontWeight: "800", color: colors.primary },
  periodLabelCell: { padding: spacing.sm, justifyContent: "center" },
  periodLabel: { fontSize: 12, fontWeight: "700", color: colors.ink },
  periodTime: { fontSize: 10, color: colors.muted2, marginTop: 2 },
  gridCell: {
    width: 108, minHeight: 64, margin: 2, padding: spacing.sm, borderRadius: radii.md,
    borderWidth: 1, borderColor: colors.borderSoft, justifyContent: "center",
  },
  gridCellMobile: { width: 72, minHeight: 56 },
  cellPrimary: { fontSize: 11, fontWeight: "700", color: colors.ink },
  cellSecondary: { fontSize: 10, color: colors.muted2, marginTop: 2 },
  emptyCell: { fontSize: 16, color: colors.hint, textAlign: "center" },
  freeCell: { backgroundColor: colors.borderSoft, borderColor: colors.border },
  freeTxt: { fontSize: 11, color: colors.muted2, textAlign: "center", fontStyle: "italic" },
  draftTag: { fontSize: 9, color: "#B45309", fontWeight: "700", marginTop: 2 },
  bandRow: {
    backgroundColor: colors.borderSoft, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    marginVertical: 2, borderRadius: radii.sm,
  },
  bandTxt: { fontSize: 12, fontWeight: "600", color: colors.muted, textAlign: "center" },
  loadPanel: { marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  loadTitle: { fontSize: 13, fontWeight: "800", color: colors.ink, marginBottom: spacing.sm },
  loadRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  loadChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surface2, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  loadChipWarn: { backgroundColor: colors.warningSoft },
  loadChipTxt: { fontSize: 11, fontWeight: "600", color: colors.ink2 },
  loadWarn: { fontSize: 9, fontWeight: "800", color: "#B45309" },
  subModal: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  subModalCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    width: "100%",
    maxWidth: 420,
  },
  subModalTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  subModalMeta: { fontSize: 12, color: colors.muted2, marginBottom: spacing.md },
  subCand: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  subCandName: { fontSize: 14, fontWeight: "700", color: colors.ink },
  subCandMeta: { fontSize: 11, color: colors.muted2, marginTop: 2 },
  freeStudyBtn: { marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.borderSoft, borderRadius: radii.md },
  freeStudyTxt: { fontSize: 13, fontWeight: "600", color: colors.muted, textAlign: "center" },
  subModalClose: { marginTop: spacing.sm, alignItems: "center", padding: spacing.sm },
  cancelTxt: { fontSize: 13, color: colors.muted, fontWeight: "600" },
});
