import { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import type { Dispatch, SetStateAction } from "react";
import { Feather } from "@expo/vector-icons";
import { UserRole } from "./rbac";
import { CategoryPermissionsPreview } from "./CategoryPermissionsPreview";
import { entityScopeLabel, type LoginUserType } from "./userClassification";
import { useBreakpoint } from "./useBreakpoint";
import { colors, formColors, radii, spacing } from "./theme";
import { FormSectionCard } from "./components/forms/FormSectionCard";
import { FormTextField } from "./components/forms/FormTextField";
import { FormSelect, type FormSelectOption } from "./components/forms/FormSelect";
import { FormMultiSelect } from "./components/forms/FormMultiSelect";
import { DATE_PLACEHOLDER, dateHelpText, formatDate } from "./dateFormat";
import { CLASS_PREFIX, resolveSectionMatch } from "./StudentRosterFormFields";

export type TeacherDesignation = "CLASS_TEACHER" | "TEACHER";

export type TeacherClassAllocationRow = {
  key: string;
  className: string;
  sectionLetter: string;
  subjects: string[];
};

export type AcademicGrade = { id: string; name: string };
export type AcademicSection = { id: string; label: string; grade_id: string };
export type AcademicSubject = { id: string; name: string; grade_ids?: string[]; section_ids?: string[] };

/** Canonical class values with display labels per product spec. */
export const TEACHER_CLASS_OPTIONS: FormSelectOption[] = [
  { value: "Nursery", label: "Nur" },
  { value: "LKG", label: "LKG" },
  { value: "UKG", label: "UKG" },
  { value: "Class I", label: "Class I" },
  { value: "Class II", label: "Class II" },
  { value: "Class III", label: "Class III" },
  { value: "Class IV", label: "Class IV" },
  { value: "Class V", label: "Class V" },
  { value: "Class VI", label: "Class VI" },
  { value: "Class VII", label: "Class VII" },
  { value: "Class VIII", label: "Class VIII" },
  { value: "Class IX", label: "Class IX" },
  { value: "Class X", label: "Class X" },
];

export const TEACHER_SECTION_OPTIONS: FormSelectOption[] = [
  "A", "B", "C", "D", "E", "F", "G",
].map((letter) => ({ value: letter, label: letter }));

export const TEACHER_SUBJECT_OPTIONS: FormSelectOption[] = [
  "Social Science",
  "IT",
  "Sanskrit",
  "Drawing",
  "PT",
  "Music",
  "Chemistry",
  "Biology",
  "Physics",
].map((name) => ({ value: name, label: name }));

const CLASS_NAME_BY_GRADE: Record<string, string> = Object.fromEntries(
  Object.entries(CLASS_PREFIX).map(([className, gradeName]) => [gradeName, className]),
);

function parseSectionLetter(label: string): string {
  const m = label.trim().match(/-([A-G])$/i);
  return m ? m[1].toUpperCase() : "";
}

function gradeNameForClass(className: string): string {
  return CLASS_PREFIX[className] || className;
}

function findGrade(className: string, grades: AcademicGrade[]): AcademicGrade | undefined {
  const key = gradeNameForClass(className);
  return grades.find(
    (g) => g.name === key || g.name === className || g.name.toLowerCase() === key.toLowerCase(),
  );
}

const TEACHER_DESIGNATION_OPTIONS: FormSelectOption[] = [
  { value: "CLASS_TEACHER", label: "Class Teacher" },
  { value: "TEACHER", label: "Teacher" },
];

type TeacherUserFormFieldsProps = {
  readOnly: boolean;
  isNew: boolean;
  isSuper: boolean;
  displayTitle: string;
  userTypeKind: LoginUserType | null;
  entityScope: string;
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  dateOfJoining: string;
  setDateOfJoining: (v: string) => void;
  mobile: string;
  setMobile: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  teacherDesignation: TeacherDesignation;
  setTeacherDesignation: (v: TeacherDesignation) => void;
  attendanceAllowed: boolean;
  setAttendanceAllowed: (v: boolean) => void;
  marksEntry: boolean;
  setMarksEntry: (v: boolean) => void;
  studentAssessment: boolean;
  setStudentAssessment: (v: boolean) => void;
  classRows: TeacherClassAllocationRow[];
  setClassRows: Dispatch<SetStateAction<TeacherClassAllocationRow[]>>;
  grades: AcademicGrade[];
  sections: AcademicSection[];
  subjects: AcademicSubject[];
  academicLoading: boolean;
  userStatus?: "active" | "deactivated";
  onToggleUserStatus?: () => void;
  resetPwdVal?: string;
  setResetPwdVal?: (v: string) => void;
  onResetPassword?: () => void;
  resetBusy?: boolean;
};

function newClassRow(): TeacherClassAllocationRow {
  return {
    key: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    className: "",
    sectionLetter: "",
    subjects: [],
  };
}

function PermissionSwitch({
  label,
  help,
  value,
  onValueChange,
  disabled,
  testID,
}: {
  label: string;
  help: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <View style={s.permSwitchRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.fieldLabel}>{label}</Text>
        <Text style={s.fieldHelp}>{help}</Text>
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.primary }}
      />
    </View>
  );
}

export function resolveTeacherAllocationIds(
  row: TeacherClassAllocationRow,
  grades: AcademicGrade[],
  sections: AcademicSection[],
  subjects: AcademicSubject[],
): { gradeId: string; sectionId: string; subjectId: string }[] {
  if (!row.className || !row.sectionLetter || row.subjects.length === 0) return [];

  const grade = findGrade(row.className, grades);
  if (!grade) return [];

  const gradeSections = sections
    .filter((sec) => sec.grade_id === grade.id)
    .map((sec) => ({ id: sec.id, label: sec.label }));
  const { id: sectionId } = resolveSectionMatch(row.className, row.sectionLetter, gradeSections);
  if (!sectionId) return [];

  const out: { gradeId: string; sectionId: string; subjectId: string }[] = [];
  for (const subjectName of row.subjects) {
    const subject = subjects.find(
      (sub) => sub.name.toLowerCase() === subjectName.toLowerCase(),
    );
    if (!subject) continue;
    if (subject.grade_ids?.length && !subject.grade_ids.includes(grade.id)) continue;
    if (subject.section_ids?.length && !subject.section_ids.includes(sectionId)) continue;
    out.push({ gradeId: grade.id, sectionId, subjectId: subject.id });
  }
  return out;
}

export function expandClassAllocations(
  rows: TeacherClassAllocationRow[],
  grades: AcademicGrade[],
  sections: AcademicSection[],
  subjects: AcademicSubject[],
) {
  return rows.flatMap((row) => resolveTeacherAllocationIds(row, grades, sections, subjects));
}

export function assignmentsToClassRows(
  assignments: any[],
  grades: AcademicGrade[],
  sections: AcademicSection[],
  subjects: AcademicSubject[],
): TeacherClassAllocationRow[] {
  const map = new Map<string, TeacherClassAllocationRow>();
  for (const a of assignments) {
    const grade = grades.find((g) => g.id === a.grade_id);
    const section = sections.find((s) => s.id === a.section_id);
    const subject = subjects.find((s) => s.id === a.subject_id);
    if (!grade || !section || !subject) continue;

    const className = CLASS_NAME_BY_GRADE[grade.name] || grade.name;
    const sectionLetter = parseSectionLetter(section.label);
    const groupKey = `${className}:${sectionLetter}`;
    if (!map.has(groupKey)) {
      map.set(groupKey, {
        key: groupKey,
        className,
        sectionLetter,
        subjects: [],
      });
    }
    const row = map.get(groupKey)!;
    if (!row.subjects.includes(subject.name)) {
      row.subjects.push(subject.name);
    }
  }
  return Array.from(map.values());
}

export function isTeacherClassRowComplete(row: TeacherClassAllocationRow): boolean {
  return !!(row.className && row.sectionLetter && row.subjects.length > 0);
}

export function buildTeacherPermissions(
  attendanceAllowed: boolean,
  marksEntry: boolean,
  studentAssessment: boolean,
): Record<string, boolean> {
  return {
    mark_student_attendance: attendanceAllowed,
    view_attendance: attendanceAllowed,
    enter_academic_marks: marksEntry,
    view_academic_marks: marksEntry || studentAssessment,
    dashboard_access: true,
  };
}

export function normalizeIndianMobile(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return digits;
}

export function isValidIndianMobile(raw: string): boolean {
  const n = normalizeIndianMobile(raw);
  return /^[6-9]\d{9}$/.test(n);
}

export function TeacherUserFormFields({
  readOnly,
  isNew,
  isSuper,
  displayTitle,
  userTypeKind,
  entityScope,
  name,
  setName,
  email,
  setEmail,
  password,
  setPassword,
  dateOfJoining,
  setDateOfJoining,
  mobile,
  setMobile,
  address,
  setAddress,
  teacherDesignation,
  setTeacherDesignation,
  attendanceAllowed,
  setAttendanceAllowed,
  marksEntry,
  setMarksEntry,
  studentAssessment,
  setStudentAssessment,
  classRows,
  setClassRows,
  grades,
  sections,
  subjects,
  academicLoading,
  userStatus,
  onToggleUserStatus,
  resetPwdVal = "",
  setResetPwdVal,
  onResetPassword,
  resetBusy,
}: TeacherUserFormFieldsProps) {
  const { isWide } = useBreakpoint();
  const previewType = userTypeKind || UserRole.PWS_TEACHER;

  const unresolvedCount = useMemo(
    () =>
      classRows.filter(
        (row) =>
          isTeacherClassRowComplete(row) &&
          resolveTeacherAllocationIds(row, grades, sections, subjects).length === 0,
      ).length,
    [classRows, grades, sections, subjects],
  );

  const updateRow = (key: string, patch: Partial<TeacherClassAllocationRow>) => {
    setClassRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  };

  const removeRow = (key: string) => {
    setClassRows((prev) => prev.filter((row) => row.key !== key));
  };

  return (
    <View style={s.root}>
      <View style={s.metaRow}>
        <View style={s.metaChip}>
          <Text style={s.metaChipLabel}>User Type</Text>
          <Text style={s.metaChipValue} testID="field-user-type">{displayTitle}</Text>
        </View>
        <View style={[s.metaChip, s.metaChipScope]}>
          <Text style={s.metaChipLabel}>Business Scope</Text>
          <Text style={[s.metaChipValue, s.metaChipScopeValue]} testID="field-entity-scope">
            {entityScopeLabel(entityScope)}
          </Text>
        </View>
      </View>

      <CategoryPermissionsPreview userType={previewType} displayName={displayTitle} />

      <View style={[s.grid, isWide && s.gridWide]}>
        <FormSectionCard
          title="Profile"
          style={isWide ? s.col : { ...s.col, ...s.colFull }}
          testID="teacher-profile-card"
        >
          <FormTextField
            label="Name"
            required
            testID="field-name"
            value={name}
            onChangeText={setName}
            placeholder="Full name"
            readOnly={readOnly}
          />
          <FormTextField
            label="Date of Joining"
            required
            testID="field-date-of-joining"
            value={dateOfJoining}
            onChangeText={setDateOfJoining}
            placeholder={DATE_PLACEHOLDER}
            readOnly={readOnly}
            hint={dateHelpText()}
            trailingIcon="calendar"
          />
          {dateOfJoining ? (
            <Text style={s.previewDate}>Parsed: {formatDate(dateOfJoining) || "—"}</Text>
          ) : null}
          <FormTextField
            label="Mobile Number"
            required
            testID="field-mobile"
            value={mobile}
            onChangeText={setMobile}
            keyboardType="phone-pad"
            placeholder="+91 98765 43210"
            readOnly={readOnly}
            hint="10-digit Indian mobile number"
          />
          <FormTextField
            label="Address"
            testID="field-address"
            value={address}
            onChangeText={setAddress}
            placeholder="Residential address"
            readOnly={readOnly}
            multiline
          />
          <FormSelect
            label="Designation"
            required
            testID="field-teacher-designation"
            value={teacherDesignation}
            options={TEACHER_DESIGNATION_OPTIONS}
            onChange={(v) => setTeacherDesignation(v as TeacherDesignation)}
            disabled={readOnly}
          />
        </FormSectionCard>

        <FormSectionCard
          title="Account & Access"
          style={isWide ? s.col : { ...s.col, ...s.colFull }}
          testID="teacher-account-card"
        >
          <FormTextField
            label="Email (@prarambhika.com)"
            required
            testID="field-email"
            value={email}
            onChangeText={setEmail}
            editable={isNew || isSuper}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="name@prarambhika.com"
            readOnly={!isNew && !isSuper}
          />
          <FormTextField
            label={isNew ? "Assigned password" : "Assign new password (leave blank to keep)"}
            required={isNew}
            testID="field-password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            readOnly={readOnly}
            hint="The user signs in with this password and will be prompted to set their own on first login."
          />

          <View style={s.fieldBlock}>
            <Text style={s.sectionSubtitle}>Permission Level</Text>
            <PermissionSwitch
              label="Attendance Allowed"
              help="Mark daily student attendance for assigned classes."
              value={attendanceAllowed}
              onValueChange={setAttendanceAllowed}
              disabled={readOnly}
              testID="perm-attendance"
            />
            <PermissionSwitch
              label="Marks Entry"
              help="Enter and edit academic marks for assigned subjects."
              value={marksEntry}
              onValueChange={setMarksEntry}
              disabled={readOnly}
              testID="perm-marks"
            />
            <PermissionSwitch
              label="Student Assessment"
              help="View assessments and submit report-card remarks."
              value={studentAssessment}
              onValueChange={setStudentAssessment}
              disabled={readOnly}
              testID="perm-assessment"
            />
          </View>
        </FormSectionCard>
      </View>

      <FormSectionCard title="Class Allocated" testID="teacher-class-card">
        <Text style={s.fieldHelp}>
          Assign one or more classes. For each class, select the section and the subjects this teacher will teach.
        </Text>
        {academicLoading && (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
        )}
        {!academicLoading && unresolvedCount > 0 && (
          <Text style={s.warnHint}>
            Some selections could not be matched to the academic structure yet. Ensure grades, sections, and subjects exist under Academic Structure.
          </Text>
        )}
        <View style={s.classRows}>
          {classRows.map((row, index) => (
            <View key={row.key} style={s.classRow} testID={`class-row-${index}`}>
              <View style={s.classRowHead}>
                <Text style={s.classRowTitle}>Class {index + 1}</Text>
                {!readOnly && classRows.length > 1 && (
                  <TouchableOpacity
                    testID={`remove-class-row-${index}`}
                    onPress={() => removeRow(row.key)}
                    style={s.removeRowBtn}
                  >
                    <Feather name="trash-2" size={14} color="#EF4444" />
                    <Text style={s.removeRowTxt}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={[s.classRowFields, isWide && s.classRowFieldsWide]}>
                <View style={s.classField}>
                  <FormSelect
                    label="Class"
                    required
                    testID={`class-grade-${index}`}
                    value={row.className}
                    options={TEACHER_CLASS_OPTIONS}
                    placeholder="Select class"
                    disabled={readOnly}
                    onChange={(className) =>
                      updateRow(row.key, { className, sectionLetter: "", subjects: [] })
                    }
                  />
                </View>
                <View style={s.classField}>
                  <FormSelect
                    label="Section"
                    required
                    testID={`class-section-${index}`}
                    value={row.sectionLetter}
                    options={TEACHER_SECTION_OPTIONS}
                    placeholder={row.className ? "Select section" : "Select class first"}
                    disabled={readOnly || !row.className}
                    onChange={(sectionLetter) =>
                      updateRow(row.key, { sectionLetter, subjects: [] })
                    }
                  />
                </View>
                <View style={[s.classField, s.subjectField]}>
                  <FormMultiSelect
                    label="Subject"
                    required
                    testID={`class-subjects-${index}`}
                    values={row.subjects}
                    options={TEACHER_SUBJECT_OPTIONS}
                    placeholder={row.sectionLetter ? "Select subjects" : "Select section first"}
                    searchPlaceholder="Search subjects…"
                    disabled={readOnly || !row.sectionLetter}
                    onChange={(subjects) => updateRow(row.key, { subjects })}
                  />
                </View>
              </View>
            </View>
          ))}
          {!readOnly && (
            <TouchableOpacity
              testID="add-class-row"
              style={s.addRowBtn}
              onPress={() => setClassRows((prev) => [...prev, newClassRow()])}
            >
              <Feather name="plus" size={16} color={colors.primary} />
              <Text style={s.addRowTxt}>Add another class</Text>
            </TouchableOpacity>
          )}
        </View>
      </FormSectionCard>

      {!isNew && isSuper && userStatus && onToggleUserStatus && (
        <FormSectionCard title="Account Status" testID="teacher-status-card">
          <View style={s.statusRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel}>Teacher Status</Text>
              <View style={[s.statusPill, userStatus === "active" ? s.statusPillActive : s.statusPillDeact]}>
                <Feather
                  name={userStatus === "active" ? "check-circle" : "slash"}
                  size={12}
                  color={userStatus === "active" ? "#16A34A" : "#64748B"}
                />
                <Text style={[s.statusPillTxt, { color: userStatus === "active" ? "#16A34A" : "#64748B" }]}>
                  {userStatus === "active" ? "Active" : "Deactivated"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              testID={userStatus === "active" ? "btn-user-deactivate" : "btn-user-activate"}
              style={[s.statusBtn, userStatus === "active" ? s.statusBtnDeact : s.statusBtnAct]}
              onPress={onToggleUserStatus}
            >
              <Feather
                name={userStatus === "active" ? "user-x" : "user-check"}
                size={16}
                color={userStatus === "active" ? "#EF4444" : "#16A34A"}
              />
              <Text style={[s.statusBtnTxt, { color: userStatus === "active" ? "#EF4444" : "#16A34A" }]}>
                {userStatus === "active" ? "Deactivate" : "Reactivate"}
              </Text>
            </TouchableOpacity>
          </View>
        </FormSectionCard>
      )}

      {!isNew && isSuper && setResetPwdVal && onResetPassword && (
        <FormSectionCard title="Reset Password" testID="teacher-reset-card">
          <Text style={s.fieldHelp}>
            Assign a temporary password. The user will be forced to set their own password on next login.
          </Text>
          <View style={s.resetRow}>
            <FormTextField
              label=""
              testID="reset-pwd-input"
              value={resetPwdVal}
              onChangeText={setResetPwdVal}
              placeholder="Temporary password (min 6)"
              style={{ flex: 1, marginBottom: 0 }}
            />
            <TouchableOpacity
              testID="btn-reset-password"
              disabled={resetBusy || resetPwdVal.length < 6}
              style={[s.resetBtn, (resetBusy || resetPwdVal.length < 6) && { opacity: 0.5 }]}
              onPress={onResetPassword}
            >
              {resetBusy ? (
                <ActivityIndicator color="#B45309" size="small" />
              ) : (
                <Text style={s.resetBtnTxt}>Set</Text>
              )}
            </TouchableOpacity>
          </View>
        </FormSectionCard>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: spacing.lg },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metaChip: {
    flex: 1,
    minWidth: 160,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  metaChipScope: { backgroundColor: formColors.pageBg },
  metaChipLabel: { fontSize: 10, fontWeight: "700", color: colors.muted2, letterSpacing: 1, marginBottom: 4 },
  metaChipValue: { fontSize: 15, fontWeight: "800", color: colors.ink },
  metaChipScopeValue: { color: colors.primary },
  grid: { gap: spacing.lg },
  gridWide: { flexDirection: "row", alignItems: "flex-start" },
  col: { flex: 1, minWidth: 280 },
  colFull: { width: "100%" },
  fieldBlock: { gap: spacing.sm, marginTop: spacing.sm },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: colors.muted, letterSpacing: 0.2 },
  fieldHelp: { fontSize: 12, color: colors.muted2, lineHeight: 18 },
  sectionSubtitle: { fontSize: 13, fontWeight: "800", color: colors.ink, marginBottom: 4 },
  previewDate: { fontSize: 11, color: colors.muted2, marginTop: -4 },
  permSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  classRows: { gap: spacing.md, marginTop: spacing.md },
  classRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    backgroundColor: formColors.pageBg,
    gap: spacing.md,
  },
  classRowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  classRowTitle: { fontSize: 13, fontWeight: "800", color: colors.ink },
  removeRowBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 4 },
  removeRowTxt: { fontSize: 12, fontWeight: "700", color: "#EF4444" },
  classRowFields: { gap: spacing.md },
  classRowFieldsWide: { flexDirection: "row", alignItems: "flex-start" },
  classField: { flex: 1, minWidth: 140 },
  subjectField: { zIndex: 5 },
  warnHint: {
    fontSize: 12,
    color: "#B45309",
    marginTop: 10,
    lineHeight: 18,
    backgroundColor: "#FFFBEB",
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  addRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  addRowTxt: { fontSize: 13, fontWeight: "700", color: colors.primary },
  emptyHint: { fontSize: 13, color: colors.muted2, marginTop: 12, lineHeight: 20 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 6,
  },
  statusPillActive: { backgroundColor: "#DCFCE7" },
  statusPillDeact: { backgroundColor: "#F1F5F9" },
  statusPillTxt: { fontSize: 12, fontWeight: "700" },
  statusBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  statusBtnDeact: { backgroundColor: "#FEE2E2" },
  statusBtnAct: { backgroundColor: "#DCFCE7" },
  statusBtnTxt: { fontSize: 13, fontWeight: "700" },
  resetRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 8 },
  resetBtn: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radii.md,
    marginBottom: 8,
  },
  resetBtnTxt: { color: "#B45309", fontWeight: "800", fontSize: 13 },
});
