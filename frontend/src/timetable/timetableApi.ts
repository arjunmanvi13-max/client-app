import { api } from "../auth";
import type {
  AbsenceRow,
  SchedulePeriod,
  TeacherLoadRow,
  TimetablePeriod,
  TimetablePermissions,
  TimetableSlot,
} from "./timetableUtils";

export type TimetableMeta = {
  permissions: TimetablePermissions;
  years: Array<{ id: string; name?: string; status?: string }>;
  open_year_id?: string | null;
  draft_count: number;
  days: string[];
};

export async function fetchTimetableMeta(): Promise<TimetableMeta> {
  const { data } = await api.get("/timetable/meta");
  return data;
}

export async function fetchPeriods(params: {
  academic_year_id: string;
  schedule_group?: string;
  day_type?: string;
}): Promise<TimetablePeriod[]> {
  const { data } = await api.get("/timetable/periods", { params });
  return data;
}

export async function fetchSlots(params: Record<string, string | undefined>): Promise<TimetableSlot[]> {
  const { data } = await api.get("/timetable/slots", { params });
  return data;
}

export async function fetchAbsences(date: string, academic_year_id: string): Promise<AbsenceRow[]> {
  const { data } = await api.get("/timetable/absences", { params: { date, academic_year_id } });
  return data;
}

export async function fetchTeacherLoad(academic_year_id: string): Promise<TeacherLoadRow[]> {
  const { data } = await api.get("/timetable/teacher-load", { params: { academic_year_id } });
  return data;
}

export async function fetchSubstitutes(slot_id: string, date: string, academic_year_id: string) {
  const { data } = await api.get("/timetable/substitutes", {
    params: { slot_id, date, academic_year_id },
  });
  return data as Array<{
    teacher_id: string;
    name?: string;
    weekly_periods: number;
    substitutions_today: number;
    qualified_in_subject: boolean;
    high_load: boolean;
  }>;
}

export async function createSlot(body: Record<string, unknown>) {
  const { data } = await api.post("/timetable/slots", body);
  return data;
}

export async function updateSlot(id: string, body: Record<string, unknown>) {
  const { data } = await api.patch(`/timetable/slots/${id}`, body);
  return data;
}

export async function deleteSlot(id: string) {
  const { data } = await api.delete(`/timetable/slots/${id}`);
  return data;
}

export async function publishTimetable(academic_year_id: string) {
  const { data } = await api.post("/timetable/publish", { academic_year_id });
  return data;
}

export async function createSubstitution(body: {
  slot_id: string;
  substitution_date: string;
  substitute_teacher_id?: string | null;
  reason?: string;
  reason_note?: string;
}) {
  const { data } = await api.post("/timetable/substitutions", body);
  return data;
}

export async function revokeSubstitution(id: string, reason_note?: string) {
  const { data } = await api.patch(`/timetable/substitutions/${id}/revoke`, { reason_note });
  return data;
}

export async function fetchMySchedule(date?: string, academic_year_id?: string): Promise<{
  date: string;
  periods: SchedulePeriod[];
  duties: Array<{ duty_type: string; club_name?: string }>;
}> {
  const { data } = await api.get("/timetable/my-schedule", {
    params: { date, academic_year_id },
  });
  return data;
}

export async function fetchMyWeek(academic_year_id?: string): Promise<{ periods: SchedulePeriod[] }> {
  const { data } = await api.get("/timetable/my-week", { params: { academic_year_id } });
  return data;
}

export async function fetchGrades(academic_year_id: string) {
  const { data } = await api.get("/academic/grades", { params: { academic_year_id } });
  return data as Array<{ id: string; name: string; label?: string }>;
}

export async function fetchSubjects(academic_year_id: string) {
  const { data } = await api.get("/academic/subjects", { params: { academic_year_id } });
  return data as Array<{ id: string; name: string; grade_ids?: string[] }>;
}

export async function fetchTeachers() {
  const { data } = await api.get("/users/directory", { params: { role: "teacher" } });
  return (Array.isArray(data) ? data : data?.users || []) as Array<{ id: string; name: string; status?: string }>;
}
