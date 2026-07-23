import { useEffect, useState, Children, type Dispatch, ReactNode, SetStateAction } from "react";
import { View, Text, TouchableOpacity, Switch, StyleSheet, TextInput, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  PWS_STUDENT_TYPES,
  TRANSPORT_DISTANCES,
  resolveCategoryAmounts,
  type PwsStudentType,
  type TransportDistance,
} from "./pwsFeeStructure";
import { useBreakpoint } from "./useBreakpoint";
import { colors, formColors, radii, spacing } from "./theme";
import { FormSelect, type FormSelectOption } from "./components/forms/FormSelect";
import { FormSectionCard } from "./components/forms/FormSectionCard";
import { FormTextField } from "./components/forms/FormTextField";
import { FormDateField } from "./components/forms/FormDateField";
import { CLASS_PREFIX, matchAcademicSection, sectionLabelCandidates } from "./academicStructure";

export { CLASS_PREFIX } from "./academicStructure";
export const SECTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
const SECTION_FILTER = ["All", ...SECTION_LETTERS] as const;
const GENDERS = ["Male", "Female", "Other"] as const;

export const PWS_CLASS_OPTIONS = [
  "Nursery",
  "LKG",
  "UKG",
  "Class I",
  "Class II",
  "Class III",
  "Class IV",
  "Class V",
  "Class VI",
  "Class VII",
  "Class VIII",
  "Class IX",
  "Class X",
] as const;

export const PWS_CLASS_FILTER_LABELS: Record<string, string> = {
  Nursery: "Nur",
  LKG: "LKG",
  UKG: "UKG",
  "Class I": "Std 1",
  "Class II": "Std 2",
  "Class III": "Std 3",
  "Class IV": "Std 4",
  "Class V": "Std 5",
  "Class VI": "Std 6",
  "Class VII": "Std 7",
  "Class VIII": "Std 8",
  "Class IX": "Std 9",
  "Class X": "Std 10",
};

export function pwsClassFilterLabel(pwsClass?: string | null) {
  if (!pwsClass) return "";
  return PWS_CLASS_FILTER_LABELS[pwsClass] || pwsClass;
}

const ORGS = ["PWS", "ALPHA", "BOTH"] as const;

function parseSectionLetter(group: string): string {
  const m = group.trim().match(/-([A-F])$/i);
  return m ? m[1].toUpperCase() : "";
}

export function classGroupPrefix(pwsClass: string): string {
  return CLASS_PREFIX[pwsClass] || pwsClass;
}

export function resolveSectionMatch(
  pwsClass: string,
  letter: string,
  sections: { id: string; label: string; grade_id?: string }[],
): { id: string | null; label: string } {
  const matched = matchAcademicSection(pwsClass, letter, sections);
  if (matched) return { id: matched.id, label: matched.label };
  const [fallback = `${CLASS_PREFIX[pwsClass] || pwsClass}-${letter}`] = sectionLabelCandidates(pwsClass, letter);
  return { id: null, label: fallback };
}

export type StudentRosterFormFieldsProps = {
  readOnly: boolean;
  isNew: boolean;
  id: string;
  name: string;
  setName: (v: string) => void;
  gender: "Male" | "Female" | "Other" | "";
  setGender: (v: "Male" | "Female" | "Other" | "") => void;
  dob: string;
  setDob: (v: string) => void;
  mobile: string;
  setMobile: (v: string) => void;
  personEmail: string;
  setPersonEmail: (v: string) => void;
  address: string;
  setAddress: (v: string) => void;
  admissionNumber: string;
  setAdmissionNumber: (v: string) => void;
  playerId: string;
  rollNumber: string;
  setRollNumber: (v: string) => void;
  dateOfAdmission: string;
  setDateOfAdmission: (v: string) => void;
  pwsClass: string;
  setPwsClass: (v: string) => void;
  sectionId: string | null;
  setSectionId: (v: string | null) => void;
  group: string;
  setGroup: (v: string) => void;
  academicSections: { id: string; label: string }[];
  pwsStudentType: PwsStudentType;
  setPwsStudentType: (v: PwsStudentType) => void;
  setIsResident: (v: boolean) => void;
  organization: "PWS" | "ALPHA" | "BOTH";
  setOrganization: (v: "PWS" | "ALPHA" | "BOTH") => void;
  transportEnabled: boolean;
  setTransportEnabled: (v: boolean) => void;
  transportDistance: TransportDistance;
  setTransportDistance: (v: TransportDistance) => void;
  guardianName: string;
  setGuardianName: (v: string) => void;
  motherName: string;
  setMotherName: (v: string) => void;
  guardianPhone: string;
  setGuardianPhone: (v: string) => void;
  pwsOverrides: Record<string, string>;
  setPwsOverrides: Dispatch<SetStateAction<Record<string, string>>>;
  canOverrideFees: boolean;
};

function splitName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function joinName(first: string, last: string) {
  return `${first.trim()} ${last.trim()}`.trim();
}

function FieldRow({ children }: { children: ReactNode }) {
  return (
    <View style={s.fieldRow}>
      {Children.toArray(children).map((child, i) => (
        <View key={i} style={s.fieldRowCol}>{child}</View>
      ))}
    </View>
  );
}

export function StudentRosterFormFields(props: StudentRosterFormFieldsProps) {
  const router = useRouter();
  const { isWide } = useBreakpoint();
  const compact = isWide;
  const {
    readOnly,
    isNew,
    id,
    name,
    setName,
    gender,
    setGender,
    dob,
    setDob,
    mobile,
    setMobile,
    personEmail,
    setPersonEmail,
    address,
    setAddress,
    admissionNumber,
    setAdmissionNumber,
    playerId,
    rollNumber,
    setRollNumber,
    dateOfAdmission,
    setDateOfAdmission,
    pwsClass,
    setPwsClass,
    sectionId,
    setSectionId,
    group,
    setGroup,
    academicSections,
    pwsStudentType,
    setPwsStudentType,
    setIsResident,
    organization,
    setOrganization,
    transportEnabled,
    setTransportEnabled,
    transportDistance,
    setTransportDistance,
    guardianName,
    setGuardianName,
    motherName,
    setMotherName,
    guardianPhone,
    setGuardianPhone,
    pwsOverrides,
    setPwsOverrides,
    canOverrideFees,
  } = props;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nameSynced, setNameSynced] = useState(false);
  const [showOverrides, setShowOverrides] = useState(false);

  useEffect(() => {
    if (!nameSynced && name) {
      const { first, last } = splitName(name);
      setFirstName(first);
      setLastName(last);
      setNameSynced(true);
    }
  }, [name, nameSynced]);

  const updateName = (first: string, last: string) => {
    setFirstName(first);
    setLastName(last);
    setNameSynced(true);
    setName(joinName(first, last));
  };

  const sectionLetter = parseSectionLetter(group);
  const sectionValue = sectionLetter || "All";

  const applySection = (value: string) => {
    if (value === "All") {
      setSectionId(null);
      setGroup(classGroupPrefix(pwsClass));
      return;
    }
    const { id: nextId, label } = resolveSectionMatch(pwsClass, value, academicSections);
    setSectionId(nextId);
    setGroup(label);
  };

  const onClassChange = (nextClass: string) => {
    setPwsClass(nextClass);
    if (sectionValue !== "All") applySection(sectionValue);
    else setGroup(classGroupPrefix(nextClass));
  };

  const studentTypeOptions: FormSelectOption[] = PWS_STUDENT_TYPES.map((t) => ({ value: t, label: t }));
  const entityOptions: FormSelectOption[] = ORGS.map((o) => ({
    value: o,
    label: o === "BOTH" ? "Both" : o,
  }));
  const classOptions: FormSelectOption[] = PWS_CLASS_OPTIONS.map((c) => ({ value: c, label: c }));
  const sectionOptions: FormSelectOption[] = SECTION_FILTER.map((sec) => ({ value: sec, label: sec }));

  const ovNum: Record<string, number> = {};
  for (const [k, v] of Object.entries(pwsOverrides)) {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) ovNum[k] = n;
  }
  const amounts = resolveCategoryAmounts(
    pwsClass,
    transportEnabled,
    transportDistance,
    canOverrideFees && showOverrides ? ovNum : undefined,
  );
  const feeCategories = Object.keys(amounts);
  const showOverrideColumn = canOverrideFees && showOverrides;

  return (
    <View style={[s.root, isWide && s.rootWide]} testID="student-form-grid">
      {/* Column 1 — Academic & Personal */}
      <FormSectionCard
        compact={compact}
        overline="Academic & Personal"
        style={isWide ? s.col : s.colStacked}
        testID="student-academic-personal-card"
      >
        <FormSelect
          compact={compact}
          label="Entity"
          testID="field-entity"
          value={organization}
          disabled={readOnly}
          options={entityOptions}
          placeholder="Select entity"
          onChange={(v) => setOrganization(v as typeof organization)}
        />

        <FieldRow>
          <FormSelect
            compact={compact}
            label="Class"
            testID="field-pws-class"
            value={pwsClass}
            disabled={readOnly}
            options={classOptions}
            placeholder="Select class"
            onChange={onClassChange}
          />
          <FormSelect
            compact={compact}
            label="Section"
            testID="field-section"
            value={sectionValue}
            disabled={readOnly}
            options={sectionOptions}
            placeholder="Select section"
            onChange={applySection}
          />
        </FieldRow>

        <FieldRow>
          <FormSelect
            compact={compact}
            label="Student type"
            required
            testID="field-pws-type"
            value={pwsStudentType}
            disabled={readOnly}
            options={studentTypeOptions}
            placeholder="Select type"
            onChange={(v) => {
              setPwsStudentType(v as PwsStudentType);
              setIsResident(v === "Boarding");
            }}
          />
          <FormDateField
            compact={compact}
            label="Date of Admission"
            required
            testID="field-admission-date"
            value={dateOfAdmission}
            onChangeText={setDateOfAdmission}
            readOnly={readOnly}
          />
        </FieldRow>

        <FieldRow>
          <FormTextField
            compact={compact}
            label="First Name"
            required
            testID="field-first-name"
            value={firstName}
            onChangeText={(v) => updateName(v, lastName)}
            placeholder="First name"
            readOnly={readOnly}
          />
          <FormTextField
            compact={compact}
            label="Last Name"
            testID="field-last-name"
            value={lastName}
            onChangeText={(v) => updateName(firstName, v)}
            placeholder="Last name"
            readOnly={readOnly}
          />
        </FieldRow>

        <FieldRow>
          <FormDateField
            compact={compact}
            label="Date of Birth"
            testID="field-student-dob"
            value={dob}
            onChangeText={setDob}
            readOnly={readOnly}
          />
          <FormTextField
            compact={compact}
            label="Roll Number"
            testID="field-roll-number"
            value={rollNumber}
            onChangeText={setRollNumber}
            placeholder="e.g. 101"
            readOnly={readOnly}
          />
        </FieldRow>

        <View style={s.fieldBlock}>
          <Text style={s.fieldLabel}>Gender</Text>
          <View style={s.chipRow}>
            {GENDERS.map((g) => (
              <TouchableOpacity
                key={g}
                disabled={readOnly}
                testID={`field-gender-${g.toLowerCase()}`}
                style={[s.genderPill, compact && s.genderPillCompact, gender === g && s.genderPillActive]}
                onPress={() => setGender(g)}
              >
                <Text style={[s.genderPillTxt, compact && s.genderPillTxtCompact, gender === g && s.genderPillTxtActive]}>
                  {g}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <FieldRow>
          <FormTextField
            compact={compact}
            label="Admission Number"
            testID="field-admission-number"
            value={admissionNumber}
            onChangeText={setAdmissionNumber}
            placeholder="e.g. PWS-20250001"
            readOnly={readOnly}
          />
          <FormTextField
            compact={compact}
            label="Player ID"
            testID={isNew ? "field-student-player-id-auto" : "field-student-player-id"}
            value={isNew ? "Auto (APL)" : (playerId || "—")}
            onChangeText={() => {}}
            readOnly
          />
        </FieldRow>

        <FormTextField
          compact={compact}
          label="Email"
          testID="field-student-email"
          value={personEmail}
          onChangeText={setPersonEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="student@email.com"
          readOnly={readOnly}
        />
      </FormSectionCard>

      {/* Column 2 — Contact & Parent */}
      <FormSectionCard
        compact={compact}
        overline="Contact & Parent"
        style={isWide ? s.col : s.colStacked}
        testID="student-contact-card"
      >
        <FieldRow>
          <FormTextField
            compact={compact}
            label="Father's Name"
            testID="field-father-name"
            value={guardianName}
            onChangeText={setGuardianName}
            placeholder="Father's full name"
            readOnly={readOnly}
          />
          <FormTextField
            compact={compact}
            label="Mother's Name"
            testID="field-mother-name"
            value={motherName}
            onChangeText={setMotherName}
            placeholder="Mother's full name"
            readOnly={readOnly}
          />
        </FieldRow>

        <FieldRow>
          <FormTextField
            compact={compact}
            label="Primary Mobile"
            testID="field-guardian-phone"
            value={guardianPhone}
            onChangeText={setGuardianPhone}
            keyboardType="phone-pad"
            placeholder="+91 98765 43210"
            leadingIcon="phone"
            readOnly={readOnly}
          />
          <FormTextField
            compact={compact}
            label="Emergency Contact"
            testID="field-student-phone"
            value={mobile}
            onChangeText={setMobile}
            keyboardType="phone-pad"
            placeholder="+91 alternate"
            leadingIcon="phone-call"
            readOnly={readOnly}
          />
        </FieldRow>

        <FormTextField
          compact={compact}
          label="Address"
          testID="field-address"
          value={address}
          onChangeText={setAddress}
          placeholder="House no., street, city, pin code"
          multiline
          readOnly={readOnly}
        />
      </FormSectionCard>

      {/* Column 3 — Fees & Transport */}
      <FormSectionCard
        compact={compact}
        overline="Fees & Transport"
        style={isWide ? s.col : s.colStacked}
        testID="student-fees-card"
      >
        <View style={[s.switchRow, compact && s.switchRowCompact]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.switchLabel, compact && s.switchLabelCompact]}>Transportation</Text>
            <Text style={s.switchHelp}>Monthly transport fee</Text>
          </View>
          <Switch
            testID="field-transport-enabled"
            value={transportEnabled}
            onValueChange={setTransportEnabled}
            disabled={readOnly}
            trackColor={{ true: formColors.primary }}
          />
        </View>

        {transportEnabled && (
          <FormSelect
            compact={compact}
            label="Distance"
            testID="field-transport-distance"
            value={transportDistance}
            disabled={readOnly}
            options={TRANSPORT_DISTANCES.map((d) => ({ value: d, label: d }))}
            onChange={(v) => setTransportDistance(v as TransportDistance)}
          />
        )}

        <View style={s.feesPanel} testID="fees-config">
          <View style={s.feesPanelHeader}>
            <Feather name="credit-card" size={13} color={formColors.primary} />
            <Text style={s.feesPanelTitle}>Fee breakdown · AY 2026-27</Text>
          </View>

          <View style={s.feeTable}>
            <View style={s.feeTableHead}>
              <Text style={[s.feeTableHeadCell, s.feeTableCategoryCol]}>Fee</Text>
              <Text style={[s.feeTableHeadCell, s.feeTableAmountCol]}>Amount</Text>
              {showOverrideColumn ? (
                <Text style={[s.feeTableHeadCell, s.feeTableOverrideCol]}>Override</Text>
              ) : null}
            </View>
            {feeCategories.map((cat) => (
              <View key={cat} style={s.feeTableRow}>
                <Text style={[s.feeTableCell, s.feeTableCategoryCol]} numberOfLines={1}>{cat}</Text>
                <Text style={[s.feeTableCell, s.feeTableAmountCol, s.feeTableAmount]}>
                  ₹{amounts[cat].toLocaleString("en-IN")}
                </Text>
                {showOverrideColumn ? (
                  <TextInput
                    testID={`override-${cat.replace(/\s+/g, "-")}`}
                    value={pwsOverrides[cat] || ""}
                    onChangeText={(v) => setPwsOverrides((prev) => ({ ...prev, [cat]: v }))}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor={colors.hint}
                    editable={!readOnly}
                    style={s.feeOverrideInput}
                  />
                ) : null}
              </View>
            ))}
          </View>

          {canOverrideFees && !readOnly && (
            <TouchableOpacity
              testID="toggle-fee-override"
              style={s.overrideToggle}
              onPress={() => setShowOverrides((v) => !v)}
            >
              <Feather
                name={showOverrides ? "check-square" : "square"}
                size={14}
                color={showOverrides ? formColors.primary : colors.hint}
              />
              <Text style={s.overrideToggleTxt}>Apply Scholarship / Override</Text>
            </TouchableOpacity>
          )}

          {isNew ? (
            <Text style={s.feesNote}>
              Fees auto-create on save. First-month tuition: on/before 15th = full; from 16th = 50%.
            </Text>
          ) : (
            <TouchableOpacity
              style={s.feeLink}
              onPress={() => router.push(`/fees/pws-student/${id}` as any)}
            >
              <Feather name="calendar" size={13} color={formColors.primary} />
              <Text style={s.feeLinkText}>Open yearly fee roadmap</Text>
            </TouchableOpacity>
          )}
        </View>
      </FormSectionCard>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: spacing.md },
  rootWide: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 12,
    flex: 1,
    minHeight: 0,
  },
  col: { flex: 1, minWidth: 0 },
  colStacked: { marginBottom: spacing.md },
  fieldRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  fieldRowCol: { flex: 1, minWidth: 0 },
  fieldBlock: { gap: 4 },
  fieldLabel: { fontSize: 10, fontWeight: "700", color: colors.muted, letterSpacing: 0.15 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  genderPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  genderPillCompact: { paddingHorizontal: 10, paddingVertical: 5 },
  genderPillActive: { backgroundColor: formColors.primary, borderColor: formColors.primary },
  genderPillTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  genderPillTxtCompact: { fontSize: 11 },
  genderPillTxtActive: { color: "#fff" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  switchRowCompact: { padding: 8 },
  switchLabel: { fontSize: 13, fontWeight: "700", color: colors.ink },
  switchLabelCompact: { fontSize: 12 },
  switchHelp: { fontSize: 10, color: colors.muted2, marginTop: 1 },
  feesPanel: {
    backgroundColor: formColors.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D7F5",
    borderRadius: radii.sm,
    padding: 10,
    gap: 8,
  },
  feesPanelHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  feesPanelTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: formColors.primary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  feeTable: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  feeTableHead: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  feeTableHeadCell: { fontSize: 9, fontWeight: "800", color: colors.muted2, textTransform: "uppercase" },
  feeTableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  feeTableCell: { fontSize: 11, color: colors.muted2, fontWeight: "600" },
  feeTableAmount: { color: colors.ink, fontWeight: "800", textAlign: "right" },
  feeTableCategoryCol: { flex: 1.2, minWidth: 0 },
  feeTableAmountCol: { flex: 0.8, textAlign: "right" },
  feeTableOverrideCol: { flex: 0.9, textAlign: "right" },
  feeOverrideInput: {
    flex: 0.9,
    minHeight: 28,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 11,
    color: colors.ink,
    backgroundColor: colors.surface,
    textAlign: "right",
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
  overrideToggle: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  overrideToggleTxt: { fontSize: 11, fontWeight: "700", color: "#0F766E" },
  feesNote: { fontSize: 10, color: formColors.primary, fontStyle: "italic", lineHeight: 14 },
  feeLink: { flexDirection: "row", alignItems: "center", gap: 6 },
  feeLinkText: { color: formColors.primary, fontWeight: "700", fontSize: 11 },
});
