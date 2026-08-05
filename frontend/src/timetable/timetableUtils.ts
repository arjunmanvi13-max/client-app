import { colors } from "../theme";

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export type DayOfWeek = (typeof DAYS)[number];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
};

const SUBJECT_PALETTE = [
  colors.primary,
  colors.accent,
  "#16A34A",
  "#9333EA",
  "#EA580C",
  "#0891B2",
  "#BE185D",
  "#CA8A04",
];

export function subjectColor(name?: string | null): string {
  if (!name) return colors.borderSoft;
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return SUBJECT_PALETTE[h % SUBJECT_PALETTE.length];
}

export function isoToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayOfWeekForDate(iso: string): DayOfWeek | null {
  const wd = new Date(`${iso.slice(0, 10)}T12:00:00`).getDay();
  if (wd === 0) return null;
  return DAYS[wd === 6 ? 5 : wd - 1];
}

export function dayLabelForDate(iso: string): string {
  const d = dayOfWeekForDate(iso);
  if (!d) return "Sunday";
  return DAY_LABELS[d];
}

export function parseTimeMinutes(t?: string | null): number {
  if (!t) return 9999;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function formatTimeRange(start?: string | null, end?: string | null): string {
  if (!start) return "—";
  if (!end) return start;
  return `${start} – ${end}`;
}

export function isNonTeachingPeriod(type?: string | null): boolean {
  return !!type && type !== "TEACHING";
}

export type TimetablePermissions = {
  view_all: boolean;
  view_own: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  substitute: boolean;
  publish: boolean;
  export: boolean;
};

export type TimetablePeriod = {
  id: string;
  period_order: number;
  period_label: string;
  start_time: string;
  end_time: string;
  period_type: string;
  schedule_group: string;
  day_type: string;
};

export type TimetableSlot = {
  id: string;
  class_id: string;
  section_id?: string | null;
  day_of_week: DayOfWeek;
  period_id: string;
  subject_id?: string | null;
  teacher_id?: string | null;
  room?: string | null;
  notes?: string | null;
  status: string;
  substitution?: Record<string, unknown> | null;
};

export type TeacherLoadRow = {
  teacher_id: string;
  name?: string;
  weekly_periods: number;
  over_limit: boolean;
};

export type AbsenceRow = {
  slot_id: string;
  class_label?: string;
  period_label?: string;
  start_time?: string;
  end_time?: string;
  subject_name?: string;
  absent_teacher_name?: string;
  status: string;
  substitution?: Record<string, unknown> | null;
};

export function scheduleGroupForGrade(name?: string | null): "PRE_PRIMARY" | "PRIMARY_SECONDARY" {
  const g = (name || "").trim();
  if (["Nur", "Nursery", "LKG", "UKG"].includes(g)) return "PRE_PRIMARY";
  return "PRIMARY_SECONDARY";
}

export type SchedulePeriod = {
  id: string;
  day_of_week?: DayOfWeek;
  class_name?: string;
  section_label?: string;
  subject_name?: string;
  room?: string;
  period?: TimetablePeriod;
  is_substitute?: boolean;
  is_covered?: boolean;
  covering_for?: string;
  covered_by?: string;
};
