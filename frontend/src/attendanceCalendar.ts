/** Client-side academic calendar rules — mirrors backend `academic_calendar.py`. */
export type AttendanceKind = "student" | "player" | "staff" | "teacher" | "coach";

export type CalendarDayInfo = {
  date: string;
  weekday: string;
  is_sunday: boolean;
  holiday_for: Record<AttendanceKind, boolean>;
};

export function calendarDayInfo(dateIso: string): CalendarDayInfo {
  const d = new Date(`${dateIso}T12:00:00`);
  const isSunday = d.getDay() === 0;
  return {
    date: dateIso,
    weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
    is_sunday: isSunday,
    holiday_for: {
      student: isSunday,
      teacher: isSunday,
      player: false,
      staff: false,
      coach: false,
    },
  };
}

export function isHolidayForKind(dateIso: string, kind: AttendanceKind): boolean {
  return calendarDayInfo(dateIso).holiday_for[kind];
}
