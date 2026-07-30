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
import { api, useAuth } from "./auth";
import { colors, radii, spacing } from "./theme";
import { calendarDayInfo, type AttendanceKind, type CalendarDayInfo } from "./attendanceCalendar";
import {
  defaultAttendanceKind,
  getAttendanceKindOptions,
  resolveDefaultStaffOrg,
  staffOrgSelectable,
  resolvePlayerFilterScope,
  toggleFilterValue,
  filterPlayersBySelection,
  PLAYER_CATEGORIES,
  type PlayerVenue,
  type PlayerSport,
  type PlayerCategory,
} from "./attendanceAccess";
import { coachSportAssignmentMessage, resolveCoachDataScope } from "./coachAccess";
import { isPwsTeacherUser, resolveTeacherDataScope } from "./teacherAccess";
import { formatDate, toISODate, parseToISO } from "./dateFormat";
import { useBreakpoint } from "./useBreakpoint";
import { FormDateField } from "./components/forms/FormDateField";

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

function isForbidden(e: unknown): boolean {
  return (e as { response?: { status?: number } })?.response?.status === 403;
}

type Person = {
  id: string;
  name: string;
  group?: string;
  sport?: string;
  player_type?: string;
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

function playerMetaLine(p: Person) {
  return [p.centre, p.sport, p.player_type].filter(Boolean).join(" · ") || "—";
}

function FilterChipRow({
  label,
  options,
  selected,
  locked,
  onToggle,
  testPrefix,
}: {
  label: string;
  options: readonly string[];
  selected: string[];
  locked: boolean;
  onToggle: (value: string) => void;
  testPrefix: string;
}) {
  return (
    <View style={s.filterGroup}>
      <Text style={s.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.groupRow}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <TouchableOpacity
              key={opt}
              testID={`${testPrefix}-${opt.replace(/\s+/g, "-")}`}
              disabled={locked}
              onPress={() => onToggle(opt)}
              style={[s.groupChip, active && s.groupChipActive]}
            >
              <Text style={[s.groupText, active && s.groupTextActive]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function Attendance() {
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();
  const kindOptions = useMemo(() => getAttendanceKindOptions(user), [user]);
  const playerScope = useMemo(() => resolvePlayerFilterScope(user), [user]);
  const coachScope = useMemo(() => resolveCoachDataScope(user), [user]);
  const teacherScope = useMemo(() => resolveTeacherDataScope(user), [user]);
  const isTeacherLocked = teacherScope.isTeacher;

  const [kind, setKind] = useState<AttendanceKind>("student");
  const [groups, setGroups] = useState<string[]>([]);
  const [group, setGroup] = useState<string | null>(null);
  const [playerVenues, setPlayerVenues] = useState<PlayerVenue[]>([]);
  const [playerSports, setPlayerSports] = useState<PlayerSport[]>([]);
  const [playerCategories, setPlayerCategories] = useState<PlayerCategory[]>([]);
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
    if (isTeacherLocked) {
      setKind("student");
      return;
    }
    const next = defaultAttendanceKind(user, kindOptions);
    if (!next) return;
    setKind((current) => (kindOptions.some((k) => k.key === current) ? current : next));
  }, [user, kindOptions, isTeacherLocked]);

  useEffect(() => {
    setStaffOrg(resolveDefaultStaffOrg(user));
  }, [user]);

  useEffect(() => {
    if (kind !== "player") return;
    setPlayerVenues(playerScope.defaultVenues);
    setPlayerSports(playerScope.defaultSports);
    setPlayerCategories([]);
  }, [kind, playerScope.defaultVenues, playerScope.defaultSports]);

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

      if (kind === "teacher" || kind === "coach" || kind === "staff" || kind === "player") {
        setGroups([]);
        setGroup(null);
        setSections([]);
        setSectionId(null);
        return;
      }

      try {
        const { data } = await api.get("/people/groups", {
          params: { kind, institution: "ALPHA" },
        });
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
          roster = Array.isArray(data) ? data : [];
        } catch (e) {
          if (!isNotFound(e) && !isForbidden(e)) throw e;
          const { data } = await api.get("/users/directory", { params: { role: "teacher" } });
          roster = Array.isArray(data) ? data : [];
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

      if (kind === "player") {
        if (playerScope.requiresSportAssignment) {
          setPeople([]);
          setMarks({});
          return;
        }

        const params: Record<string, string> = { kind: "player", institution: "ALPHA" };
        if (playerVenues.length === 1) params.centre = playerVenues[0];
        if (playerSports.length === 1) params.sport = playerSports[0];
        if (playerCategories.length === 1) params.player_type = playerCategories[0];

        const { data } = await api.get("/people", { params });
        const roster = filterPlayersBySelection(
          data as Person[],
          playerVenues,
          playerSports,
          playerCategories,
        );
        setPeople(roster);

        const attParams: Record<string, string> = {
          date: attendanceDateIso,
          kind: "player",
          session,
        };
        if (playerSports.length === 1) attParams.sport = playerSports[0];

        const att = await api.get("/attendance", { params: attParams });
        const rosterIds = new Set(roster.map((p) => p.id));
        const m: Record<string, AttendanceStatus> = {};
        roster.forEach((p) => {
          m[p.id] = "present";
        });
        att.data.forEach((r: { person_id: string; status: AttendanceStatus }) => {
          if (rosterIds.has(r.person_id)) m[r.person_id] = r.status;
        });
        setMarks(m);
        setAbsentIds(new Set());
        return;
      }

      const rosterKey = kind === "student" ? sectionId : group;
      if (!rosterKey) {
        setPeople([]);
        setMarks({});
        return;
      }

      const params: Record<string, string> = { kind };
      if (kind === "student") {
        params.institution = "PWS";
        if (sectionId) params.section_id = sectionId;
      } else if (group) {
        params.group = group;
      }

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
  }, [kind, group, sectionId, session, attendanceDateIso, staffOrg, playerVenues, playerSports, playerCategories, playerScope.requiresSportAssignment]);

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
        group: kind === "player" ? null : group,
        session,
        sport:
          kind === "player"
            ? (playerSports.length === 1 ? playerSports[0] : people[0]?.sport || null)
            : null,
        centre:
          kind === "player"
            ? (playerVenues.length === 1 ? playerVenues[0] : people[0]?.centre || null)
            : null,
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
  const playerFiltersBlocked = kind === "player" && playerScope.requiresSportAssignment;

  const renderRoster = () => {
    if (loading) {
      return <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />;
    }
    if (loadError) {
      return (
        <View style={s.errorBox} testID="attendance-load-error">
          <Feather name="alert-circle" size={18} color={colors.danger} />
          <Text style={s.errorText}>{loadError}</Text>
        </View>
      );
    }
    if (playerFiltersBlocked) {
      return (
        <View style={s.blockedBox}>
          <Feather name="alert-circle" size={28} color={colors.danger} />
          <Text style={s.blockedTitle}>Sport assignment required</Text>
          <Text style={s.blockedText}>{coachSportAssignmentMessage(coachScope)}</Text>
        </View>
      );
    }
    if (people.length === 0) {
      return (
        <Text style={s.empty}>
          {kind === "player" ? "No players match the selected filters." : "No people in this group."}
        </Text>
      );
    }
    if (usesAbsentOnly) {
      return people.map((p) => {
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
                {kind === "player" ? playerMetaLine(p) : `${p.group || kind}${p.organization ? ` · ${p.organization}` : ""}${p.sport ? ` · ${p.sport}` : ""}${p.centre ? ` · ${p.centre}` : ""}`}
              </Text>
            </View>
            <Text style={[s.statusPill, { color: isAbs ? colors.danger : colors.success }]}>
              {isAbs ? "Absent" : "Present"}
            </Text>
          </TouchableOpacity>
        );
      });
    }
    if (isMobile) {
      return (
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
      );
    }
    return people.map((p) => (
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
          <Text style={s.rowMeta}>{kind === "player" ? playerMetaLine(p) : `${p.group || "—"}${p.sport ? ` · ${p.sport}` : ""}`}</Text>
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
    ));
  };

  if (kindOptions.length === 0) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.deniedWrap}>
          <Feather name="lock" size={28} color={colors.muted2} />
          <Text style={s.deniedTitle}>Attendance not available</Text>
          <Text style={s.deniedText}>
            Your account does not have permission to mark attendance for any roster type.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.shell}>
        <View style={s.topPane}>
          <View style={s.pageHeaderCompact}>
            <Text style={s.breadcrumb}>OPERATIONS · ATTENDANCE</Text>
            <Text style={s.h1Compact}>Take Attendance</Text>
            <Text style={s.subCompact}>
              {isTeacherLocked
                ? "PWS students · assigned classes only"
                : `${calendarInfo?.weekday || "—"} · ${kind === "player" ? "ALPHA players" : "linked to academic calendar"}`}
            </Text>
          </View>

          {isTeacherLocked && (
            <View style={s.scopeBanner}>
              <Feather name="lock" size={14} color={colors.primary} />
              <Text style={s.scopeBannerTxt}>Scoped to PWS · Students tab locked for your role</Text>
            </View>
          )}

          <View style={s.cardCompact}>
            <View style={[s.filterRow, !isMobile && s.filterRowWide]}>
              <View style={[s.filterCell, !isMobile && { flex: 1, maxWidth: 200 }]}>
                <FormDateField
                  label="Date"
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

          {(kindOptions.length > 1 && !isTeacherLocked) && (
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
          )}

          {kind === "staff" && staffOrgSelectable(user) && (
            <View style={s.cardCompact}>
              <Text style={s.cardTitleCompact}>Staff entity</Text>
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

          {kind === "student" && (
            <View style={s.cardCompact}>
              <Text style={s.cardTitleCompact}>Class / section</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.groupRow}>
                {sections.length === 0 ? (
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
                )}
              </ScrollView>
            </View>
          )}

          {kind === "player" && (
            <View style={s.cardCompact}>
              <Text style={s.cardTitleCompact}>Player filters</Text>
              {!playerScope.fullAccess && (
                <Text style={s.scopeHint}>Showing your assigned venue and sport roster only.</Text>
              )}
              <FilterChipRow
                label="Venue"
                options={playerScope.venues}
                selected={playerVenues}
                locked={playerScope.lockedVenues}
                testPrefix="player-venue"
                onToggle={(v) => setPlayerVenues((prev) => toggleFilterValue(prev, v as PlayerVenue))}
              />
              <FilterChipRow
                label="Sport"
                options={playerScope.sports}
                selected={playerSports}
                locked={playerScope.lockedSports}
                testPrefix="player-sport"
                onToggle={(v) => setPlayerSports((prev) => toggleFilterValue(prev, v as PlayerSport))}
              />
              <FilterChipRow
                label="Category"
                options={PLAYER_CATEGORIES}
                selected={playerCategories}
                locked={false}
                testPrefix="player-category"
                onToggle={(v) => setPlayerCategories((prev) => toggleFilterValue(prev, v as PlayerCategory))}
              />
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
        </View>

        <ScrollView
          style={s.listScroll}
          contentContainerStyle={s.listScrollInner}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.listCard}>{renderRoster()}</View>
        </ScrollView>

        <View style={[s.bottomBar, isMobile && s.bottomBarMobile]}>
          <TouchableOpacity
            testID="save-attendance"
            onPress={submit}
            disabled={saving || saveCount === 0 || readOnly || playerFiltersBlocked}
            style={[
              s.saveBtn,
              activeKind && { backgroundColor: activeKind.color },
              (saving || saveCount === 0 || readOnly || playerFiltersBlocked) && { opacity: 0.5 },
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
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  shell: {
    flex: 1,
    ...Platform.select({
      web: { height: "100vh", maxHeight: "100vh", overflow: "hidden" } as object,
      default: {},
    }),
  },
  topPane: {
    flexShrink: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  listScroll: { flex: 1 },
  listScrollInner: { paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  pageHeaderCompact: { marginBottom: spacing.xs },
  h1Compact: { fontSize: 22, fontWeight: "800", color: colors.ink, letterSpacing: -0.5, marginTop: 4 },
  subCompact: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  scopeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  scopeBannerTxt: { flex: 1, fontSize: 12, fontWeight: "600", color: colors.primary },
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
  cardCompact: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    ...Platform.select({
      web: { boxShadow: "0 1px 3px rgba(15,23,42,0.05)" } as object,
      default: {},
    }),
  },
  cardTitleCompact: { fontSize: 12, fontWeight: "800", color: colors.ink, marginBottom: spacing.sm },
  scopeHint: { fontSize: 11, color: colors.muted2, marginBottom: spacing.sm },
  filterGroup: { marginBottom: spacing.sm },
  filterLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.muted2,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
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
    alignItems: "center",
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
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
  blockedBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  blockedTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  blockedText: { fontSize: 13, color: colors.muted2, textAlign: "center", lineHeight: 18 },
  bottomBar: {
    flexShrink: 0,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  bottomBarMobile: {
    paddingHorizontal: spacing.md,
  },
  saveBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radii.lg,
    alignItems: "center",
  },
  saveTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  deniedWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  deniedTitle: { fontSize: 18, fontWeight: "800", color: colors.ink, marginTop: spacing.sm },
  deniedText: { fontSize: 14, color: colors.muted2, textAlign: "center", lineHeight: 20 },
});
