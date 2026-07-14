import type { Dispatch, SetStateAction } from "react";
import { View, Text, TextInput, TouchableOpacity, Switch, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  PWS_CLASSES,
  PWS_STUDENT_TYPES,
  TRANSPORT_DISTANCES,
  resolveCategoryAmounts,
  type PwsStudentType,
  type TransportDistance,
} from "./pwsFeeStructure";
import { DATE_PLACEHOLDER } from "./dateFormat";
import { useBreakpoint } from "./useBreakpoint";
import { colors, radii } from "./theme";
import { FormSelect, type FormSelectOption } from "./components/forms/FormSelect";
import { FormSectionCard } from "./components/forms/FormSectionCard";
import { FormFieldGrid } from "./components/forms/FormFieldGrid";

const ORGS = ["PWS", "ALPHA", "BOTH"] as const;
const SECTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
const GENDERS = ["Male", "Female", "Other"] as const;

/** Full class list for the dropdown (includes LKG per product spec). */
export const PWS_CLASS_OPTIONS = [
  "Nursery",
  "LKG",
  "UKG",
  ...PWS_CLASSES.filter((c) => c !== "Nursery" && c !== "UKG"),
] as const;

const CLASS_PREFIX: Record<string, string> = {
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

function parseSectionLetter(group: string): string {
  const m = group.trim().match(/-([A-F])$/i);
  return m ? m[1].toUpperCase() : "";
}

function resolveSectionMatch(
  pwsClass: string,
  letter: string,
  sections: { id: string; label: string }[],
): { id: string | null; label: string } {
  const prefix = CLASS_PREFIX[pwsClass] || pwsClass;
  const target = `${prefix}-${letter}`;
  const exact = sections.find((sec) => sec.label.toLowerCase() === target.toLowerCase());
  if (exact) return { id: exact.id, label: exact.label };
  const suffix = sections.find((sec) => sec.label.toUpperCase().endsWith(`-${letter}`));
  if (suffix) return { id: suffix.id, label: suffix.label };
  return { id: null, label: target };
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
  guardianPhone: string;
  setGuardianPhone: (v: string) => void;
  pwsOverrides: Record<string, string>;
  setPwsOverrides: Dispatch<SetStateAction<Record<string, string>>>;
  canOverrideFees: boolean;
};

function FieldLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text style={s.label}>
      {children}
      {required ? " *" : ""}
    </Text>
  );
}

export function StudentRosterFormFields(props: StudentRosterFormFieldsProps) {
  const router = useRouter();
  const { isWide } = useBreakpoint();
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
    guardianPhone,
    setGuardianPhone,
    pwsOverrides,
    setPwsOverrides,
    canOverrideFees,
  } = props;

  const sectionLetter = parseSectionLetter(group);

  const applySectionLetter = (letter: string) => {
    const { id: nextId, label } = resolveSectionMatch(pwsClass, letter, academicSections);
    setSectionId(nextId);
    setGroup(label);
  };

  const classOptions: FormSelectOption[] = PWS_CLASS_OPTIONS.map((c) => ({ value: c, label: c }));
  const sectionOptions: FormSelectOption[] = SECTION_LETTERS.map((l) => ({ value: l, label: l }));
  const studentTypeOptions: FormSelectOption[] = PWS_STUDENT_TYPES.map((t) => ({ value: t, label: t }));
  const orgOptions: FormSelectOption[] = ORGS.map((o) => ({ value: o, label: o }));

  const ovNum: Record<string, number> = {};
  for (const [k, v] of Object.entries(pwsOverrides)) {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) ovNum[k] = n;
  }
  const amounts = resolveCategoryAmounts(
    pwsClass,
    transportEnabled,
    transportDistance,
    canOverrideFees ? ovNum : undefined,
  );

  return (
    <>
      <FormSectionCard title="Personal Information">
        <FormFieldGrid columns={3} isWide={isWide}>
          <View style={s.field}>
            <FieldLabel required>Name</FieldLabel>
            <TextInput
              testID="field-name"
              editable={!readOnly}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
          <View style={s.field}>
            <FieldLabel>Gender</FieldLabel>
            <View style={s.chipRow}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  disabled={readOnly}
                  testID={`field-gender-${g.toLowerCase()}`}
                  style={[s.chip, gender === g && s.chipActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[s.chipText, gender === g && s.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={s.field}>
            <FieldLabel>Date of Birth</FieldLabel>
            <TextInput
              testID="field-student-dob"
              editable={!readOnly}
              value={dob}
              onChangeText={setDob}
              placeholder={DATE_PLACEHOLDER}
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
        </FormFieldGrid>

        <FormFieldGrid columns={3} isWide={isWide}>
          <View style={s.field}>
            <FieldLabel>Phone</FieldLabel>
            <TextInput
              testID="field-student-phone"
              editable={!readOnly}
              value={mobile}
              onChangeText={setMobile}
              keyboardType="phone-pad"
              placeholder="Student phone"
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
          <View style={s.field}>
            <FieldLabel>Email</FieldLabel>
            <TextInput
              testID="field-student-email"
              editable={!readOnly}
              value={personEmail}
              onChangeText={setPersonEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="student@email.com"
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
          <View style={s.field}>
            <FieldLabel>Address</FieldLabel>
            <TextInput
              testID="field-address"
              editable={!readOnly}
              value={address}
              onChangeText={setAddress}
              placeholder="Full address"
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
        </FormFieldGrid>
      </FormSectionCard>

      <FormSectionCard title="Academic & Admission Details">
        <FormFieldGrid columns={3} isWide={isWide}>
          <View style={s.field}>
            <FieldLabel>Admission Number</FieldLabel>
            <TextInput
              testID="field-admission-number"
              editable={!readOnly}
              value={admissionNumber}
              onChangeText={setAdmissionNumber}
              placeholder="e.g. PWS-20250001"
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
          <View style={s.field}>
            <FieldLabel>Roll Number</FieldLabel>
            <TextInput
              testID="field-roll-number"
              editable={!readOnly}
              value={rollNumber}
              onChangeText={setRollNumber}
              placeholder="e.g. 101"
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
          <View style={s.field}>
            <FieldLabel required>Date of Admission</FieldLabel>
            <TextInput
              testID="field-admission-date"
              editable={!readOnly}
              value={dateOfAdmission}
              onChangeText={setDateOfAdmission}
              placeholder={DATE_PLACEHOLDER}
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
        </FormFieldGrid>

        <FormFieldGrid columns={4} isWide={isWide}>
          <FormSelect
            label="Class"
            required
            testID="field-pws-class"
            value={pwsClass}
            disabled={readOnly}
            options={classOptions}
            placeholder="Select class"
            onChange={(v) => {
              setPwsClass(v);
              if (sectionLetter) applySectionLetter(sectionLetter);
            }}
          />
          <FormSelect
            label="Section"
            testID="field-section"
            value={sectionLetter}
            disabled={readOnly}
            options={sectionOptions}
            placeholder="Select section"
            onChange={applySectionLetter}
          />
          <FormSelect
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
          <FormSelect
            label="Organization"
            testID="field-organization"
            value={organization}
            disabled={readOnly}
            options={orgOptions}
            placeholder="Select organization"
            onChange={(v) => setOrganization(v as "PWS" | "ALPHA" | "BOTH")}
          />
        </FormFieldGrid>

        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.switchLabel}>Transportation</Text>
            <Text style={s.switchHelp}>Include monthly transport fee</Text>
          </View>
          <Switch
            testID="field-transport-enabled"
            value={transportEnabled}
            onValueChange={setTransportEnabled}
            disabled={readOnly}
            trackColor={{ true: colors.primary }}
          />
        </View>

        {transportEnabled && (
          <FormFieldGrid columns={2} isWide={isWide}>
            <FormSelect
              label="Distance"
              testID="field-transport-distance"
              value={transportDistance}
              disabled={readOnly}
              options={TRANSPORT_DISTANCES.map((d) => ({ value: d, label: d }))}
              onChange={(v) => setTransportDistance(v as TransportDistance)}
            />
          </FormFieldGrid>
        )}

        <View style={[s.feeGrid, isWide && s.feeGridWide]} testID="fees-config">
          <View style={[s.feesBox, isWide && s.feesBoxCol]}>
            <View style={s.feesBoxHeader}>
              <Feather name="credit-card" size={14} color={colors.primary} />
              <Text style={s.feesBoxTitle}>Fee breakdown · AY 2026-27</Text>
            </View>
            <View style={s.feesReadonlyBox}>
              {Object.entries(amounts).map(([cat, amt]) => (
                <View key={cat} style={s.feesReadonlyRow}>
                  <Text style={s.feesReadonlyKey}>{cat}</Text>
                  <Text style={s.feesReadonlyVal}>₹{amt.toLocaleString("en-IN")}</Text>
                </View>
              ))}
            </View>
            {isNew && (
              <Text style={s.feesBoxNote}>
                Fees auto-create on save. First-month tuition: admission on/before 15th = full; from 16th = 50%.
              </Text>
            )}
            {!isNew && (
              <TouchableOpacity
                style={s.feeLink}
                onPress={() => router.push(`/fees/pws-student/${id}` as any)}
              >
                <Feather name="calendar" size={14} color={colors.primary} />
                <Text style={s.feeLinkText}>Open yearly fee roadmap</Text>
              </TouchableOpacity>
            )}
          </View>

          {canOverrideFees && (
            <View style={[s.feesBox, s.overrideBox, isWide && s.feesBoxCol]}>
              <View style={s.feesBoxHeader}>
                <Feather name="edit-3" size={14} color="#0F766E" />
                <Text style={[s.feesBoxTitle, { color: "#0F766E" }]}>Override / Scholarship</Text>
              </View>
              {Object.keys(amounts).map((cat) => (
                <View key={`ov-${cat}`} style={s.overrideField}>
                  <Text style={s.overrideHint}>
                    {cat} (default ₹{amounts[cat].toLocaleString("en-IN")})
                  </Text>
                  <TextInput
                    testID={`override-${cat.replace(/\s+/g, "-")}`}
                    value={pwsOverrides[cat] || ""}
                    onChangeText={(v) => setPwsOverrides((prev) => ({ ...prev, [cat]: v }))}
                    keyboardType="numeric"
                    placeholder="Leave blank for default"
                    placeholderTextColor={colors.hint}
                    style={s.input}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </FormSectionCard>

      <FormSectionCard title="Guardian Information">
        <FormFieldGrid columns={2} isWide={isWide}>
          <View style={s.field}>
            <FieldLabel>Guardian Name</FieldLabel>
            <TextInput
              testID="field-guardian-name"
              editable={!readOnly}
              value={guardianName}
              onChangeText={setGuardianName}
              placeholder="Parent / guardian"
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
          <View style={s.field}>
            <FieldLabel>Guardian Phone</FieldLabel>
            <TextInput
              testID="field-guardian-phone"
              editable={!readOnly}
              value={guardianPhone}
              onChangeText={setGuardianPhone}
              keyboardType="phone-pad"
              placeholder="+91 …"
              placeholderTextColor={colors.hint}
              style={[s.input, readOnly && s.inputReadonly]}
            />
          </View>
        </FormFieldGrid>
      </FormSectionCard>
    </>
  );
}

const s = StyleSheet.create({
  field: { flex: 1, minWidth: 0 },
  label: { fontSize: 13, fontWeight: "700", color: colors.muted, marginBottom: 8 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  inputReadonly: { backgroundColor: colors.surface2, color: colors.muted2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontWeight: "700", fontSize: 13, color: colors.muted },
  chipTextActive: { color: "#fff" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  switchLabel: { fontSize: 14, fontWeight: "700", color: colors.ink },
  switchHelp: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  feeGrid: { gap: 12 },
  feeGridWide: { flexDirection: "row", alignItems: "flex-start" },
  feesBox: {
    backgroundColor: colors.primarySofter,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: radii.md,
    padding: 12,
  },
  feesBoxCol: { flex: 1, minWidth: 0 },
  overrideBox: { backgroundColor: "#F0FDFA", borderColor: "#A7F3D0" },
  feesBoxHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  feesBoxTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  feesReadonlyBox: { backgroundColor: colors.surface, padding: 10, borderRadius: radii.sm, marginTop: 8 },
  feesReadonlyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  feesReadonlyKey: { fontSize: 12, color: colors.muted2, fontWeight: "600" },
  feesReadonlyVal: { fontSize: 12, color: colors.ink, fontWeight: "800" },
  feesBoxNote: { fontSize: 11, color: colors.primary, marginTop: 8, fontStyle: "italic" },
  feeLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  feeLinkText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  overrideField: { marginTop: 10 },
  overrideHint: { fontSize: 12, color: colors.muted2, marginBottom: 6 },
});
