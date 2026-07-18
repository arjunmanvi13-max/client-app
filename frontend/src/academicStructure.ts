import type { FormSelectOption } from "./components/forms/FormSelect";

/** Canonical PWS subject catalogue for Academic Structure. */
export const DEFAULT_PWS_SUBJECTS: { name: string; code: string }[] = [
  { name: "Mathematics", code: "MATH" },
  { name: "English", code: "ENG" },
  { name: "Science", code: "SCI" },
  { name: "Hindi", code: "HIN" },
  { name: "Computers", code: "IT" },
  { name: "Social Science", code: "SST" },
  { name: "Art", code: "ART" },
  { name: "Music", code: "MUS" },
  { name: "Sanskrit", code: "SAN" },
  { name: "Physical Education", code: "PT" },
  { name: "Yoga", code: "YOG" },
];

/** Canonical standard names stored in grades.name (matches student/teacher class mapping). */
export const DEFAULT_PWS_STANDARDS: { name: string; sort: number }[] = [
  { name: "Nur", sort: 1 },
  { name: "LKG", sort: 2 },
  { name: "UKG", sort: 3 },
  { name: "1", sort: 4 },
  { name: "2", sort: 5 },
  { name: "3", sort: 6 },
  { name: "4", sort: 7 },
  { name: "5", sort: 8 },
  { name: "6", sort: 9 },
  { name: "7", sort: 10 },
  { name: "8", sort: 11 },
  { name: "9", sort: 12 },
  { name: "10", sort: 13 },
];

export const DEFAULT_PWS_SUBJECT_OPTIONS: FormSelectOption[] = DEFAULT_PWS_SUBJECTS.map(
  (s) => ({ value: s.name, label: s.name }),
);

/** Display label for a standard/grade name stored in the database. */
export function stdLabel(name: string | undefined | null): string {
  const n = (name || "").trim();
  if (!n) return "—";
  if (/^std\b/i.test(n)) return n;
  return `Std ${n}`;
}

export type TeacherAssignRow = {
  key: string;
  sectionId: string;
  subjectIds: string[];
};

export function newTeacherAssignRow(): TeacherAssignRow {
  return {
    key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sectionId: "",
    subjectIds: [],
  };
}
