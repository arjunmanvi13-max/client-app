import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api, useAuth, userHasPermission } from "./auth";
import {
  BusinessEntity,
  Permission,
  UserRole,
  isSuperAdminUser,
  normalizeRole,
} from "./rbac";
import { formatDate, toISODate, parseToISO } from "./dateFormat";
import { useBreakpoint } from "./useBreakpoint";
import { FormDateField } from "./components/forms/FormDateField";
import { colors, radii, spacing } from "./theme";
import { calendarDayInfo, type AttendanceKind, type CalendarDayInfo } from "./attendanceCalendar";

type AttendanceStatus = "present" | "absent" | "late" | "leave";

function apiErrorMessage(e: unknown, fallback = "Failed to load roster"): string {
  const err = e as { response?: { data?: { detail?: string }; status?: number } };
  if (err?.response?.data?.detail) return String(err.response.data.detail);
  if (err?.response?.status === 404) return "This feature is not available on the server yet.";
  return fallback;
}

function isNotFound(e: unknown): boolean {
  return (e as { response?: { status?: number } })?.response?.status === 404;
}

type Person = {
  id: string;
  name: string;
  group?: string;
  sport?: string;
  organization?: string;
  centre?: string;
  coach_type?: string;
};

const STATUSES: { key: AttendanceStatus; label: string; color: string }[] = [
  { key: "present", label: "P", color: colors.success },
  { key: "absent", label: "A", color: colors.danger },
  { key: "late", label: "L", color: "#F59E0B" },
  { key: "leave", label: "Lv", color: "#7C3AED" },
];

const CYCLE: AttendanceStatus[] = ["present", "absent", "late", "leave"];
const STATUS_COLOR: Record<AttendanceStatus, string> = {
  present: colors.success,
  absent: colors.danger,
  late: "#F59E0B",
  leave: "#7C3AED",
};
const STATUS_SHORT: Record<AttendanceStatus, string> = {
  present: "P",
  absent: "A",
  late: "L",
  leave: "Lv",
};

const SESSIONS = ["morning", "afternoon", "evening"] as const;

function shortName(n: string) {
  const parts = n.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

function stringToColor(str: string) {
  const palette = [colors.primary, "#EA580C", "#7C3AED", colors.accent, colors.success, colors.danger, "#F59E0B"];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function useKindOptions(user: ReturnType<typeof useAuth>["user"]) {
  return useMemo(() => {
    const privileged =
      userHasPermission(user, Permission.MARK_PWS_ATTENDANCE)
      || userHasPermission(user, Permission.MARK_ALPHA_ATTENDANCE)
      || userHasPermission(user, Permission.MANAGE_ACCESS);

    const options: {
      key: AttendanceKind;
      label: string;
      icon: keyof typeof Feather.glyphMap;
      color: string;
    }[] = [];

    const canStudent =
      privileged
      || userHasPermission(user, Permission.MARK_STUDENT_ATTENDANCE)
      || normalizeRole(user?.role || "") === UserRole.PWS_TEACHER;
    if (canStudent) {
      options.push({ key: "student", label: "Students", icon: "book", color: colors.primary });
    }

    const canPlayer =
      privileged
      || userHasPermission(user, Permission.MARK_PLAYER_ATTENDANCE)
      || normalizeRole(user?.role || "") === UserRole.ALPHA_COACH;
    if (canPlayer) {
      options.push({ key: "player", label: "Players", icon: "activity", color: colors.success });
    }

    const canStaff =
      isSuperAdminUser(user)
      || userHasPermission(user, Permission.MARK_PWS_ATTENDANCE, BusinessEntity.PWS)
      || userHasPermission(user, Permission.MARK_ALPHA_ATTENDANCE, BusinessEntity.ALPHA)
      || normalizeRole(user?.role || "") === UserRole.PWS_ADMIN
      || normalizeRole(user?.role || "") === UserRole.ALPHA_ADMIN;
    if (canStaff) {
      options.push({ key: "staff", label: "Staff", icon: "users", color: colors.accent });
    }

    const canTeacher =
      privileged
      || userHasPermission(user, Permission.MARK_TEACHER_ATTENDANCE)
      || userHasPermission(user, Permission.MARK_PWS_ATTENDANCE, BusinessEntity.PWS);
    if (canTeacher) {
      options.push({ key: "teacher", label: "Teachers", icon: "user-check", color: "#6366F1" });
    }

    const isHeadCoach =
      normalizeRole(user?.role || "") === UserRole.ALPHA_COACH && user?.coach_type === "head";
    const canCoach =
      isSuperAdminUser(user)
      || userHasPermission(user, Permission.MARK_ALPHA_ATTENDANCE, BusinessEntity.ALPHA)
      || userHasPermission(user, Permission.MANAGE_ACCESS)
      || isHeadCoach;
    if (canCoach) {
      options.push({ key: "coach", label: "Coaches", icon: "award", color: "#0EA5E9" });
    }

    return options;
  }, [user]);
}

function resolveDefaultStaffOrg(user: ReturnType<typeof useAuth>["user"]): "PWS" | "ALPHA" {
  if (isSuperAdminUser(user)) return "PWS";
  if (
    userHasPermission(user, Permission.MARK_ALPHA_ATTENDANCE, BusinessEntity.ALPHA)
    && !userHasPermission(user, Permission.MARK_PWS_ATTENDANCE, BusinessEntity.PWS)
  ) {
    return "ALPHA";
  }
  if (normalizeRole(user?.role || "") === UserRole.ALPHA_ADMIN) return "ALPHA";
  return "PWS";
}

function staffOrgSelectable(user: ReturnType<typeof useAuth>["user"]) {
  return isSuperAdminUser(user)
    || (
      userHasPermission(user, Permission.MARK_PWS_ATTENDANCE, BusinessEntity.PWS)
      && userHasPermission(user, Permission.MARK_ALPHA_ATTENDANCE, BusinessEntity.ALPHA)
    );
}

export default function Attendance() {
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();
  const kindOptions = useKindOptions(user);

  const [kind, setKind] = useState<AttendanceKind>("student");
  const [groups, setGroups] = useState<string[]>([]);
  const [group, setGroup] = useState<string | null>(null);
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [session, setSession] = useState<(typeof SESSIONS)[number]>("morning");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [staffOrg, setStaffOrg] = useState<"PWS" | "ALPHA">("PWS");

  const [attendanceDateIso, setAttendanceDateIso] = useState(toISODate());
  const [attendanceDateDisplay, setAttendanceDateDisplay] = useState(formatDate(toISODate()));
  const [calendarInfo, setCalendarInfo] = useState<CalendarDayInfo>(() => calendarDayInfo(toISODate()));

  const usesAbsentOnly = kind === "staff" || kind === "teacher" || kind === "coach";
  const isHoliday = Boolean(calendarInfo?.holiday_for?.[kind]);
  const readOnly = isHoliday;

  useEffect(() => {
    if (user?.role === "coach" && kindOptions.some((k) => k.key === "player")) setKind("player");
    else if (user?.role === "teacher" && kindOptions.some((k) => k.key === "student")) setKind("student");
  }, [user, kindOptions]);

  useEffect(() => {
    if (kindOptions.length > 0 && !kindOptions.some((k) => k.key === kind)) {
      setKind(kindOptions[0].key);
    }
  }, [kindOptions, kind]);

  useEffect(() => {
    setStaffOrg(resolveDefaultStaffOrg(user));
  }, [user]);

  useEffect(() => {
    const iso = parseToISO(attendanceDateDisplay) || attendanceDateIso;
    if (parseToISO(attendanceDateDisplay)) setAttendanceDateIso(iso);
    setCalendarInfo(calendarDayInfo(iso));
    (async () => {
      try {
        const { data } = await api.get("/attendance/calendar-day", { params: { date: iso } });
        setCalendarInfo(data);
      } catch {
        // Keep client-side calendar fallback when backend route is unavailable.
      }
    })();
  }, [attendanceDateDisplay, attendanceDateIso]);

  useEffect(() => {
    (async () => {
      if (kind === "student") {
        try {
          const { data } = await api.get("/academic/sections/for-attendance");
          const list = (data.sections || []).map((s: { id: string; label: string }) => ({
            id: s.id,
            label: s.label,
          }));
          setSections(list);
          setSectionId(list[0]?.id || null);
          setGroup(list[0]?.label || null);
        } catch {
          setSections([]);
          setSectionId(null);
          setGroup(null);
        }
        setGroups([]);
        return;
      }

      if (kind === "teacher" || kind === "coach" || kind === "staff") {
        setGroups([]);
        setGroup(null);
        setSections([]);
        setSectionId(null);
        return;
      }

      try {
        const { data } = await api.get("/people/groups", { params: { kind } });
        setGroups(data.groups || []);
        setGroup(data.groups[0] || null);
      } catch {
        setGroups([]);
        setGroup(null);
      }
      setSections([]);
      setSectionId(null);
    })();
  }, [kind]);

  const loadExistingAbsent = async (
    params: Record<string, string>,
  ): Promise<Set<string>> => {
    const absent = new Set<string>();
    try {
      const att = await api.get("/attendance", { params });
      att.data.forEach((r: { person_id: string; status: string }) => {
        if (r.status === "absent") absent.add(r.person_id);
      });
    } catch {
      // No saved marks yet — default everyone to present.
    }
    return absent;
  };

  const loadPeople = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (kind === "teacher") {
        let roster: Person[] = [];
        try {
          const { data } = await api.get("/attendance/teachers-list");
          roster = data;
        } catch (e) {
          if (!isNotFound(e)) throw e;
          const { data } = await api.get("/people", { params: { kind: "teacher" } });
          roster = data;
        }
        setPeople(roster);
        setAbsentIds(await loadExistingAbsent({
          date: attendanceDateIso,
          kind: "teacher",
          session,
        }));
        setMarks({});
        return;
      }

      if (kind === "coach") {
        const { data } = await api.get("/attendance/coaches-list");
        setPeople(data);
        setAbsentIds(await loadExistingAbsent({
          date: attendanceDateIso,
          kind: "coach",
          session,
        }));
        setMarks({});
        return;
      }

      if (kind === "staff") {
        const params: { organization?: string } = {};
        if (staffOrg) params.organization = staffOrg;
        const { data } = await api.get("/attendance/staff-list", { params });
        setPeople(data);
        try {
          const att = await api.get("/attendance/staff", {
            params: { date: attendanceDateIso, organization: staffOrg, session },
          });
          const absent = new Set<string>();
          att.data.forEach((r: { person_id: string; status: string }) => {
            if (r.status === "absent") absent.add(r.person_id);
          });
          setAbsentIds(absent);
        } catch {
          setAbsentIds(new Set());
        }
        setMarks({});
        return;
      }

      const rosterKey = kind === "student" ? sectionId : group;
      if (!rosterKey) {
        setPeople([]);
        setMarks({});
        return;
      }

      const params: Record<string, string> = { kind };
      if (kind === "student" && sectionId) params.section_id = sectionId;
      else if (group) params.group = group;

      const { data } = await api.get("/people", { params });
      setPeople(data);

      const attParams: Record<string, string> = {
        date: attendanceDateIso,
        kind,
        session,
      };
      if (kind === "student" && sectionId) attParams.section_id = sectionId;
      else if (group) attParams.group = group;

      const att = await api.get("/attendance", { params: attParams });
      const m: Record<string, AttendanceStatus> = {};
      data.forEach((p: Person) => {
        m[p.id] = "present";
      });
      att.data.forEach((r: { person_id: string; status: AttendanceStatus }) => {
        m[r.person_id] = r.status;
      });
      setMarks(m);
      setAbsentIds(new Set());
    } catch (e) {
      setPeople([]);
      setMarks({});
      setAbsentIds(new Set());
      setLoadError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [kind, group, sectionId, session, attendanceDateIso, staffOrg]);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  const handleDateChange = (display: string) => {
    setAttendanceDateDisplay(display);
    const iso = parseToISO(display);
    if (iso) setAttendanceDateIso(iso);
  };

  const setMark = (id: string, st: AttendanceStatus) => {
    if (readOnly) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMarks((prev) => ({ ...prev, [id]: st }));
  };

  const cycleMark = (id: string) => {
    if (readOnly) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMarks((prev) => {
      const cur = prev[id] || "present";
      const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
      return { ...prev, [id]: next };
    });
  };

  const toggleAbsent = (id: string) => {
    if (readOnly) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAbsentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const markAllPresent = () => {
    if (readOnly) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (usesAbsentOnly) {
      setAbsentIds(new Set());
      return;
    }
    const m: Record<string, AttendanceStatus> = {};
    people.forEach((p) => {
      m[p.id] = "present";
    });
    setMarks(m);
  };

  const submit = async () => {
    if (readOnly) return;
    if (people.length === 0) {
      Alert.alert("No roster", "There is nobody to mark in this group.");
      return;
    }

    setSaving(true);
    try {
      if (kind === "staff") {
        const { data } = await api.post("/attendance/staff", {
          date: attendanceDateIso,
          organization: staffOrg,
          absent_staff_ids: Array.from(absentIds),
          session,
        });
        Alert.alert("Saved", `${data.present} present · ${data.absent} absent (${data.count} total)`);
        return;
      }

      if (kind === "teacher") {
        try {
          const { data } = await api.post("/attendance/teachers", {
            date: attendanceDateIso,
            absent_teacher_ids: Array.from(absentIds),
            session,
          });
          Alert.alert("Saved", `${data.present} present · ${data.absent} absent (${data.count} total)`);
        } catch (e) {
          if (!isNotFound(e)) throw e;
          await api.post("/attendance/batch", {
            date: attendanceDateIso,
            kind: "teacher",
            session,
            group: null,
            marks: people.map((p) => ({
              person_id: p.id,
              status: absentIds.has(p.id) ? "absent" : "present",
            })),
          });
          Alert.alert("Saved", `Teacher attendance saved for ${people.length} people.`);
        }
        return;
      }

      if (kind === "coach") {
        const { data } = await api.post("/attendance/coaches", {
          date: attendanceDateIso,
          absent_coach_ids: Array.from(absentIds),
          session,
        });
        Alert.alert("Saved", `${data.present} present · ${data.absent} absent (${data.count} total)`);
        return;
      }

      const payload: Record<string, unknown> = {
        date: attendanceDateIso,
        kind,
        group,
        session,
        sport: null,
        marks: Object.entries(marks).map(([person_id, status]) => ({ person_id, status })),
      };
      if (kind === "student" && sectionId) payload.section_id = sectionId;
      await api.post("/attendance/batch", payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("Saved", `Attendance saved for ${Object.keys(marks).length} people.`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      Alert.alert("Error", err?.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(() => {
    if (usesAbsentOnly) {
      return STATUSES.reduce(
        (acc, s) => {
          if (s.key === "present") acc.present = people.length - absentIds.size;
          else if (s.key === "absent") acc.absent = absentIds.size;
          else acc[s.key] = 0;
          return acc;
        },
        {} as Record<AttendanceStatus, number>,
      );
    }
    return STATUSES.reduce(
      (acc, s) => {
        acc[s.key] = Object.values(marks).filter((v) => v === s.key).length;
        return acc;
      },
      {} as Record<AttendanceStatus, number>,
    );
  }, [usesAbsentOnly, people.length, absentIds, marks]);

  const saveCount = usesAbsentOnly ? people.length : Object.keys(marks).length;
  const activeKind = kindOptions.find((k) => k.key === kind);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <View style={s.pageHeader}>
          <Text style={s.breadcrumb}>OPERATIONS · ATTENDANCE</Text>
          <Text style={s.h1}>Take Attendance</Text>
          <Text style={s.sub}>
            {calendarInfo?.weekday || "—"} · linked to academic calendar
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Date & session</Text>
          <View style={[s.filterRow, !isMobile && s.filterRowWide]}>
            <View style={[s.filterCell, !isMobile && { flex: 1, maxWidth: 220 }]}>
              <FormDateField
                label="Attendance date"
                compact
                value={attendanceDateDisplay}
                onChangeText={handleDateChange}
                readOnly={false}
                testID="attendance-date"
              />
            </View>
            <View style={s.sessionRow}>
              {SESSIONS.map((sess) => (
                <TouchableOpacity
                  key={sess}
                  testID={`session-${sess}`}
                  onPress={() => setSession(sess)}
                  style={[s.sessionChip, session === sess && s.sessionChipActive]}
                >
                  <Text style={[s.sessionText, session === sess && s.sessionTextActive]}>{sess}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.hScroll}
          contentContainerStyle={s.kindRow}
        >
          {kindOptions.map((k) => (
            <TouchableOpacity
              key={k.key}
              testID={`kind-${k.key}`}
              onPress={() => setKind(k.key)}
              style={[s.kindChip, kind === k.key && { backgroundColor: k.color, borderColor: k.color }]}
            >
              <Feather name={k.icon} size={14} color={kind === k.key ? "#fff" : k.color} />
              <Text style={[s.kindText, { color: kind === k.key ? "#fff" : k.color }]}>{k.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {kind === "staff" && staffOrgSelectable(user) && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Staff entity</Text>
            <View style={s.sessionRow}>
              {(["PWS", "ALPHA"] as const).map((org) => (
                <TouchableOpacity
                  key={org}
                  testID={`staff-org-${org}`}
                  onPress={() => setStaffOrg(org)}
                  style={[s.sessionChip, staffOrg === org && s.sessionChipActive]}
                >
                  <Text style={[s.sessionText, staffOrg === org && s.sessionTextActive]}>{org}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {(kind === "student" || kind === "player") && (
          <View style={s.card}>
            <Text style={s.cardTitle}>{kind === "student" ? "Class / section" : "Sport / group"}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.groupRow}>
              {kind === "student" ? (
                sections.length === 0 ? (
                  <Text style={s.emptyInline}>No sections assigned. Contact the school administrator.</Text>
                ) : (
                  sections.map((sec) => (
                    <TouchableOpacity
                      key={sec.id}
                      testID={`section-${sec.label}`}
                      onPress={() => {
                        setSectionId(sec.id);
                        setGroup(sec.label);
                      }}
                      style={[s.groupChip, sectionId === sec.id && s.groupChipActive]}
                    >
                      <Text style={[s.groupText, sectionId === sec.id && s.groupTextActive]}>{sec.label}</Text>
                    </TouchableOpacity>
                  ))
                )
              ) : (
                <>
                  {groups.length === 0 && <Text style={s.emptyInline}>No groups for this kind yet.</Text>}
                  {groups.map((g) => (
                    <TouchableOpacity
                      key={g}
                      testID={`group-${g}`}
                      onPress={() => setGroup(g)}
                      style={[s.groupChip, group === g && s.groupChipActive]}
                    >
                      <Text style={[s.groupText, group === g && s.groupTextActive]}>{g}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        )}

        {isHoliday && (
          <View style={s.holidayBanner} testID="holiday-banner">
            <Feather name="sun" size={16} color="#92400E" />
            <View style={{ flex: 1 }}>
              <Text style={s.holidayTitle}>Holiday — no attendance required</Text>
              <Text style={s.holidayText}>
                {calendarInfo?.weekday || "Sunday"} is a calendar holiday for {kind}s. View only.
              </Text>
            </View>
          </View>
        )}

        <View style={s.summaryCard}>
          {STATUSES.map((st) => (
            <View key={st.key} style={[s.sumBox, { backgroundColor: st.color + "1A" }]}>
              <Text style={[s.sumLabel, { color: st.color }]}>{st.label}</Text>
              <Text style={[s.sumValue, { color: st.color }]}>{counts[st.key] ?? 0}</Text>
            </View>
          ))}
          {!readOnly && (
            <TouchableOpacity style={s.allBtn} onPress={markAllPresent} testID="mark-all-present">
              <Feather name="check-circle" size={14} color="#fff" />
              <Text style={s.allText}>All P</Text>
            </TouchableOpacity>
          )}
        </View>

        {!readOnly && (
          <View style={s.hintBanner}>
            <Feather name="info" size={12} color={colors.primary} />
            <Text style={s.hintText}>
              {usesAbsentOnly
                ? "All Present by default. Tap a person to mark Absent."
                : isMobile
                  ? "All Present by default. Tap to cycle P → A → L → Lv."
                  : "All Present by default. Use buttons to mark exceptions only."}
            </Text>
          </View>
        )}

        <View style={s.listCard}>
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 32 }} />
          ) : loadError ? (
            <View style={s.errorBox} testID="attendance-load-error">
              <Feather name="alert-circle" size={18} color={colors.danger} />
              <Text style={s.errorText}>{loadError}</Text>
            </View>
          ) : people.length === 0 ? (
            <Text style={s.empty}>No people in this group.</Text>
          ) : usesAbsentOnly ? (
            people.map((p) => {
              const isAbs = absentIds.has(p.id);
              return (
                <TouchableOpacity
                  key={p.id}
                  testID={`person-${p.id}`}
                  onPress={() => toggleAbsent(p.id)}
                  disabled={readOnly}
                  style={[s.row, isAbs && s.rowAbsent, readOnly && s.rowReadonly]}
                >
                  <View style={[s.avatar, { backgroundColor: isAbs ? colors.dangerSoft : colors.successSoft }]}>
                    <Feather name={isAbs ? "x" : "check"} size={16} color={isAbs ? colors.danger : colors.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{p.name}</Text>
                    <Text style={s.rowMeta}>
                      {p.group || kind}
                      {p.organization ? ` · ${p.organization}` : ""}
                      {p.sport ? ` · ${p.sport}` : ""}
                      {p.centre ? ` · ${p.centre}` : ""}
                    </Text>
                  </View>
                  <Text style={[s.statusPill, { color: isAbs ? colors.danger : colors.success }]}>
                    {isAbs ? "Absent" : "Present"}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : isMobile ? (
            <View style={s.mobileGrid}>
              {people.map((p) => {
                const st = marks[p.id] || "present";
                const color = STATUS_COLOR[st];
                return (
                  <TouchableOpacity
                    key={p.id}
                    testID={`person-${p.id}`}
                    onPress={() => cycleMark(p.id)}
                    disabled={readOnly}
                    style={[s.cell, { borderColor: color, backgroundColor: color + "14" }, readOnly && s.rowReadonly]}
                  >
                    <View style={[s.cellBadge, { backgroundColor: color }]}>
                      <Text style={s.cellBadgeTxt}>{STATUS_SHORT[st]}</Text>
                    </View>
                    <Text style={s.cellName} numberOfLines={1}>
                      {shortName(p.name)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            people.map((p) => (
              <View key={p.id} style={[s.row, readOnly && s.rowReadonly]} testID={`person-${p.id}`}>
                <View style={[s.avatar, { backgroundColor: stringToColor(p.name) }]}>
                  <Text style={s.avatarTxt}>
                    {p.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName}>{p.name}</Text>
                  <Text style={s.rowMeta}>
                    {p.group || "—"}
                    {p.sport ? ` · ${p.sport}` : ""}
                  </Text>
                </View>
                <View style={s.statusBtns}>
                  {STATUSES.map((st) => (
                    <TouchableOpacity
                      key={st.key}
                      testID={`mark-${p.id}-${st.key}`}
                      onPress={() => setMark(p.id, st.key)}
                      disabled={readOnly}
                      style={[s.statBtn, marks[p.id] === st.key && { backgroundColor: st.color }]}
                    >
                      <Text
                        style={[
                          s.statBtnTxt,
                          { color: marks[p.id] === st.key ? "#fff" : st.color },
                        ]}
                      >
                        {st.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={[s.bottomBar, isMobile && s.bottomBarMobile]}>
        <TouchableOpacity
          testID="save-attendance"
          onPress={submit}
          disabled={saving || saveCount === 0 || readOnly}
          style={[
            s.saveBtn,
            activeKind && { backgroundColor: activeKind.color },
            (saving || saveCount === 0 || readOnly) && { opacity: 0.5 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.saveTxt}>
              {readOnly ? "Holiday — read only" : `Save attendance (${saveCount})`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  page: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  pageHeader: { marginBottom: spacing.lg },
  breadcrumb: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted2,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  h1: { fontSize: 28, fontWeight: "800", color: colors.ink, letterSpacing: -0.5, marginTop: 6 },
  sub: { fontSize: 13, color: colors.muted2, marginTop: 4 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...Platform.select({
      web: { boxShadow: "0 1px 3px rgba(15,23,42,0.05)" } as object,
      default: {},
    }),
  },
  cardTitle: { fontSize: 14, fontWeight: "800", color: colors.ink, marginBottom: spacing.sm },
  filterRow: { gap: spacing.md },
  filterRowWide: { flexDirection: "row", alignItems: "flex-end", flexWrap: "wrap" },
  filterCell: { width: "100%" },
  sessionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  sessionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sessionChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  sessionText: { fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "capitalize" },
  sessionTextActive: { color: "#fff" },
  hScroll: { flexGrow: 0, marginBottom: spacing.md },
  kindRow: { gap: spacing.sm, paddingVertical: 4, alignItems: "center" },
  kindChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  kindText: { fontSize: 13, fontWeight: "700" },
  groupRow: { gap: spacing.sm, alignItems: "center" },
  groupChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupChipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  groupText: { fontSize: 12, fontWeight: "700", color: colors.muted },
  groupTextActive: { color: "#fff" },
  holidayBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: "#FEF3C7",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  holidayTitle: { fontSize: 13, fontWeight: "800", color: "#92400E" },
  holidayText: { fontSize: 12, color: "#B45309", marginTop: 2 },
  summaryCard: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sumBox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  sumLabel: { fontSize: 10, fontWeight: "800" },
  sumValue: { fontSize: 14, fontWeight: "800" },
  allBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  allText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  hintBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primarySofter,
    borderRadius: radii.md,
  },
  hintText: { color: colors.primary, fontSize: 11, flex: 1 },
  listCard: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  rowAbsent: { backgroundColor: colors.dangerSoft, borderColor: "#FECACA" },
  rowReadonly: { opacity: 0.72 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  rowName: { fontSize: 14, fontWeight: "700", color: colors.ink },
  rowMeta: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  statusPill: { fontSize: 12, fontWeight: "800" },
  statusBtns: { flexDirection: "row", gap: 4 },
  statBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  statBtnTxt: { fontWeight: "800", fontSize: 12 },
  empty: { textAlign: "center", color: colors.muted2, padding: spacing.xl },
  emptyInline: { color: colors.muted2, fontSize: 13 },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: spacing.sm,
  },
  errorText: { flex: 1, fontSize: 13, color: colors.danger, lineHeight: 18 },
  mobileGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  cell: {
    width: "48.5%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    borderWidth: 1.5,
    marginBottom: spacing.sm,
  },
  cellBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  cellBadgeTxt: { color: "#fff", fontWeight: "800", fontSize: 11 },
  cellName: { flex: 1, fontSize: 13, fontWeight: "700", color: colors.ink },
  bottomBar: {
    position: "absolute",
    bottom: 78,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: "transparent",
  },
  bottomBarMobile: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: "#FFFFFFF2",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radii.lg,
    alignItems: "center",
  },
  saveTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
