import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { colors, radii, spacing } from "../theme";
import { fetchMySchedule } from "./timetableApi";
import {
  dayLabelForDate,
  formatTimeRange,
  isoToday,
  parseTimeMinutes,
  type SchedulePeriod,
} from "./timetableUtils";

type Props = {
  academicYearId?: string;
};

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function periodState(period: SchedulePeriod): "now" | "next" | "past" | "future" {
  const start = parseTimeMinutes(period.period?.start_time);
  const end = parseTimeMinutes(period.period?.end_time);
  const now = nowMinutes();
  if (now >= start && now < end) return "now";
  if (now >= end) return "past";
  return "future";
}

function minutesUntil(start?: string): number | null {
  if (!start) return null;
  const diff = parseTimeMinutes(start) - nowMinutes();
  return diff > 0 ? diff : null;
}

export function MyClassesTodayCard({ academicYearId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<SchedulePeriod[]>([]);
  const [duties, setDuties] = useState<Array<{ duty_type: string; club_name?: string }>>([]);
  const [date, setDate] = useState(isoToday());
  const etagRef = useRef<string>("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchMySchedule(isoToday(), academicYearId);
      const payload = JSON.stringify(data);
      if (payload !== etagRef.current) {
        etagRef.current = payload;
        setDate(data.date || isoToday());
        setPeriods(data.periods || []);
        setDuties(data.duties || []);
      }
    } catch {
      if (!silent) {
        setPeriods([]);
        setDuties([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [academicYearId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const id = setInterval(() => load(true), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const sorted = useMemo(() => {
    return [...periods].sort(
      (a, b) => parseTimeMinutes(a.period?.start_time) - parseTimeMinutes(b.period?.start_time),
    );
  }, [periods]);

  const nextIdx = sorted.findIndex((p) => periodState(p) === "future" || periodState(p) === "now");

  const dutyChips = duties.map((d) => {
    if (d.duty_type === "CLUB_INCHARGE") return `Club: ${d.club_name || "In-charge"}`;
    if (d.duty_type === "LUNCH_DUTY") return "Lunch duty";
    if (d.duty_type === "ASSEMBLY_DUTY") return "Assembly duty";
    return d.duty_type;
  });

  return (
    <View style={s.card} testID="my-classes-today">
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>My Classes Today</Text>
          <Text style={s.sub}>
            {dayLabelForDate(date)} · {date} · {sorted.length} period{sorted.length === 1 ? "" : "s"}
          </Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/academics/timetable/my")} style={s.linkBtn}>
          <Text style={s.linkTxt}>Full week</Text>
          <Feather name="chevron-right" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
      ) : sorted.length === 0 ? (
        <Text style={s.empty}>No classes allocated for today.</Text>
      ) : (
        <View style={s.list}>
          {sorted.map((p, idx) => {
            const state = periodState(p);
            const isNext = idx === nextIdx && state === "future";
            const countdown = isNext ? minutesUntil(p.period?.start_time) : null;
            const classLabel = [p.class_name, p.section_label].filter(Boolean).join(" ");
            return (
              <View
                key={p.id}
                style={[
                  s.row,
                  state === "now" && s.rowNow,
                  p.is_covered && s.rowCovered,
                ]}
              >
                <View style={s.timeCol}>
                  <Text style={[s.time, p.is_covered && s.struck]}>
                    {formatTimeRange(p.period?.start_time, p.period?.end_time)}
                  </Text>
                  <Text style={s.periodLabel}>{p.period?.period_label}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.classTxt, p.is_covered && s.struck]} numberOfLines={1}>
                    {classLabel || "—"} · {p.subject_name || "—"}
                  </Text>
                  {p.room ? <Text style={s.room}>Room {p.room}</Text> : null}
                  {state === "now" && (
                    <View style={s.nowBadge}>
                      <Text style={s.nowTxt}>Now</Text>
                    </View>
                  )}
                  {isNext && countdown != null && (
                    <Text style={s.nextTxt}>Up next · {countdown} min</Text>
                  )}
                  {p.is_substitute && (
                    <View style={s.subBadge}>
                      <Text style={s.subBadgeTxt}>Substitution · Covering for {p.covering_for}</Text>
                    </View>
                  )}
                  {p.is_covered && (
                    <View style={s.coveredBadge}>
                      <Text style={s.coveredTxt}>Covered by {p.covered_by}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {dutyChips.length > 0 && (
        <View style={s.dutyRow}>
          {dutyChips.map((label) => (
            <View key={label} style={s.dutyChip}>
              <Feather name="flag" size={11} color="#B45309" />
              <Text style={s.dutyTxt}>{label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  head: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.md },
  title: { fontSize: 15, fontWeight: "700", color: colors.ink },
  sub: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 2, paddingTop: 2 },
  linkTxt: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  empty: { fontSize: 14, color: colors.muted2, paddingVertical: spacing.md },
  list: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
  },
  rowNow: { backgroundColor: colors.infoSoft, borderWidth: 1, borderColor: colors.accent },
  rowCovered: { opacity: 0.75 },
  timeCol: { width: 88 },
  time: { fontSize: 12, fontWeight: "600", color: colors.ink2 },
  periodLabel: { fontSize: 11, color: colors.muted2, marginTop: 2 },
  classTxt: { fontSize: 14, fontWeight: "600", color: colors.ink },
  room: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  struck: { textDecorationLine: "line-through", color: colors.muted2 },
  nowBadge: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: colors.accent,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  nowTxt: { fontSize: 10, fontWeight: "700", color: "#fff" },
  nextTxt: { fontSize: 11, color: colors.primary, marginTop: 4, fontWeight: "600" },
  subBadge: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: "#FEF3C7",
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  subBadgeTxt: { fontSize: 10, fontWeight: "600", color: "#B45309" },
  coveredBadge: {
    alignSelf: "flex-start",
    marginTop: 4,
    backgroundColor: colors.borderSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  coveredTxt: { fontSize: 10, fontWeight: "600", color: colors.muted },
  dutyRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  dutyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFBEB",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  dutyTxt: { fontSize: 11, color: "#B45309", fontWeight: "600" },
});
