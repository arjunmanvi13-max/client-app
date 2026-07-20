import type { FormSelectOption } from "./components/forms/FormSelect";

/** Maps teacher/student class labels to stored academic grade names. */
export const CLASS_PREFIX: Record<string, string> = {
  Nursery: "Nursery",
  LKG: "LKG",
  UKG: "UKG",
  "Class I": "1",
  "Class II": "2",
  "Class III": "3",
  "Class IV": "4",
  "Class V": "5",
  "Class VI": "6",
  "Class VII": "7",
  "Class VIII": "8",
  "Class IX": "9",
  "Class X": "10",
};

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

export type TeacherAssignmentPayload = {
  teacherId: string;
  mappings: { sectionId: string; subjectIds: string[] }[];
};

/** Validate teacher class assignment form before submit. Returns error message or null. */
export function validateTeacherAssignments(
  teacherId: string | null | undefined,
  rows: TeacherAssignRow[],
): string | null {
  if (!teacherId) return "Select a teacher before saving assignments.";
  const partial = rows.filter(
    (r) => (r.sectionId && r.subjectIds.length === 0) || (!r.sectionId && r.subjectIds.length > 0),
  );
  if (partial.length) {
    return "Each class row must include both a class/section and at least one subject.";
  }
  const valid = rows.filter((r) => r.sectionId && r.subjectIds.length > 0);
  if (!valid.length) return "Add at least one class with one or more subjects.";
  return null;
}

export function buildTeacherAssignmentPayload(
  teacherId: string,
  rows: TeacherAssignRow[],
): TeacherAssignmentPayload {
  return {
    teacherId,
    mappings: rows
      .filter((r) => r.sectionId && r.subjectIds.length > 0)
      .map((r) => ({ sectionId: r.sectionId, subjectIds: r.subjectIds })),
  };
}

export function normalizeGradeKey(name: string): string {
  return name.trim().toLowerCase().replace(/^std\s+/i, "").replace(/^grade\s+/i, "");
}

export function gradeAliasKeys(className: string): string[] {
  const primary = CLASS_PREFIX[className] || className;
  const keys = new Set<string>();
  const add = (v: string) => {
    if (v.trim()) keys.add(normalizeGradeKey(v));
  };
  add(primary);
  add(className);
  if (/^\d+$/.test(primary)) {
    add(`Std ${primary}`);
    add(`Grade ${primary}`);
  }
  if (primary === "Nursery" || className === "Nursery" || normalizeGradeKey(primary) === "nur") {
    add("Nur");
    add("Nursery");
  }
  return Array.from(keys);
}

export type AcademicGradeRef = { id: string; name: string };
export type AcademicSectionRef = { id: string; label: string; grade_id?: string };
export type AcademicSubjectRef = { id: string; name: string; code?: string };

export function matchAcademicGrade(
  className: string,
  grades: AcademicGradeRef[],
): AcademicGradeRef | undefined {
  const aliases = new Set(gradeAliasKeys(className));
  return grades.find((g) => aliases.has(normalizeGradeKey(g.name)));
}

function gradeNameVariants(gradeName: string): string[] {
  const n = gradeName.trim();
  const variants = new Set<string>([n, `Std ${n}`, `Grade ${n}`]);
  if (normalizeGradeKey(n) === "nur") {
    variants.add("Nur");
    variants.add("Nursery");
  }
  return Array.from(variants);
}

export function sectionLabelCandidates(className: string, sectionLetter: string): string[] {
  const prefix = CLASS_PREFIX[className] || className;
  const letter = sectionLetter.trim().toUpperCase();
  const candidates = new Set<string>();
  for (const p of gradeNameVariants(prefix)) candidates.add(`${p}-${letter}`);
  for (const p of gradeNameVariants(className)) candidates.add(`${p}-${letter}`);
  return Array.from(candidates);
}

export function matchAcademicSection(
  className: string,
  sectionLetter: string,
  sections: AcademicSectionRef[],
  gradeId?: string,
): AcademicSectionRef | null {
  const letter = sectionLetter.trim().toUpperCase();
  const pool = gradeId ? sections.filter((s) => s.grade_id === gradeId) : sections;
  for (const candidate of sectionLabelCandidates(className, letter)) {
    const exact = pool.find((s) => s.label.toLowerCase() === candidate.toLowerCase());
    if (exact) return exact;
  }
  const aliases = new Set(gradeAliasKeys(className));
  return pool.find((sec) => {
    const m = sec.label.trim().match(/^(.+)-([A-G])$/i);
    if (!m || m[2].toUpperCase() !== letter) return false;
    return aliases.has(normalizeGradeKey(m[1]));
  }) || null;
}

export function matchAcademicSubject(
  subjectName: string,
  subjects: AcademicSubjectRef[],
): AcademicSubjectRef | undefined {
  const needle = subjectName.trim().toLowerCase();
  return subjects.find(
    (s) => s.name.toLowerCase() === needle || (s.code || "").toLowerCase() === needle,
  );
}

export function classNameForGradeName(gradeName: string): string {
  for (const [className] of Object.entries(CLASS_PREFIX)) {
    if (gradeAliasKeys(className).includes(normalizeGradeKey(gradeName))) return className;
  }
  return gradeName;
}

export function describeTeacherAllocationFailure(
  row: { className: string; sectionLetter: string; subjects: string[] },
  grades: AcademicGradeRef[],
  sections: AcademicSectionRef[],
  subjects: AcademicSubjectRef[],
): string | null {
  if (!row.className || !row.sectionLetter || !row.subjects.length) return null;
  const grade = matchAcademicGrade(row.className, grades);
  if (!grade) {
    return `Standard for ${row.className} was not found. Add it under Academic Structure → Std & Sections for the open academic year.`;
  }
  const section = matchAcademicSection(row.className, row.sectionLetter, sections, grade.id);
  if (!section) {
    const labels = sectionLabelCandidates(row.className, row.sectionLetter).join(" or ");
    return `Section ${labels} was not found. Add section ${row.sectionLetter} for ${stdLabel(grade.name)} under Academic Structure.`;
  }
  const missing = row.subjects.filter((name) => !matchAcademicSubject(name, subjects));
  if (missing.length) {
    return `Subject(s) not found in the open academic year: ${missing.join(", ")}. Add them under Academic Structure → Subjects.`;
  }
  return null;
}
