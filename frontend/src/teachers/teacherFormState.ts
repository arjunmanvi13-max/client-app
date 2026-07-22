import type { TeacherClassAllocationRow, TeacherDesignation } from "./TeacherUserFormFields";

export type TeacherFormSnapshot = {
  name: string;
  dateOfJoining: string;
  mobile: string;
  address: string;
  email: string;
  password: string;
  teacherDesignation: TeacherDesignation;
  attendanceAllowed: boolean;
  marksEntry: boolean;
  studentAssessment: boolean;
  classRows: TeacherClassAllocationRow[];
};

function normalizeClassRows(rows: TeacherClassAllocationRow[]) {
  return rows
    .map((row) => ({
      className: row.className,
      sectionLetter: row.sectionLetter,
      subjects: [...row.subjects].sort(),
    }))
    .sort((a, b) =>
      `${a.className}:${a.sectionLetter}`.localeCompare(`${b.className}:${b.sectionLetter}`),
    );
}

function safeTrim(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function buildTeacherFormSnapshot(state: TeacherFormSnapshot): TeacherFormSnapshot {
  return {
    ...state,
    name: safeTrim(state.name),
    dateOfJoining: safeTrim(state.dateOfJoining),
    mobile: safeTrim(state.mobile),
    address: safeTrim(state.address),
    email: safeTrim(state.email).toLowerCase(),
    password: state.password,
    classRows: normalizeClassRows(state.classRows).map((row, i) => ({
      key: `snap-${i}`,
      ...row,
    })),
  };
}

export function isTeacherFormDirty(
  initial: TeacherFormSnapshot | null,
  current: TeacherFormSnapshot,
): boolean {
  if (!initial) return false;
  const a = buildTeacherFormSnapshot(initial);
  const b = buildTeacherFormSnapshot(current);
  return JSON.stringify(a) !== JSON.stringify(b);
}
