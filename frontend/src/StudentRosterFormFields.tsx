import { useEffect, useState, type Dispatch, SetStateAction } from "react";
import { View, Text, TouchableOpacity, Switch, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  PWS_STUDENT_TYPES,
  TRANSPORT_DISTANCES,
  resolveCategoryAmounts,
  type PwsStudentType,
  type TransportDistance,
} from "./pwsFeeStructure";
import { DATE_PLACEHOLDER } from "./dateFormat";
import { useBreakpoint } from "./useBreakpoint";
import { colors, formColors, radii, spacing } from "./theme";
import { FormSelect, type FormSelectOption } from "./components/forms/FormSelect";
import { FormSectionCard } from "./components/forms/FormSectionCard";
import { FormFieldGrid } from "./components/forms/FormFieldGrid";
import { SegmentToggle } from "./components/forms/SegmentToggle";
import { PillSelect } from "./components/forms/PillSelect";
import { FormTextField } from "./components/forms/FormTextField";

const ORGS = ["PWS", "ALPHA", "BOTH"] as const;
export const SECTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;
const SECTION_FILTER = ["All", ...SECTION_LETTERS] as const;
const GENDERS = ["Male", "Female", "Other"] as const;

/** Full class list for the dropdown (includes LKG per product spec). */
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
    <View style={s.root}>
      {/* Card 1 — Academic Allocation (full width) */}
      <FormSectionCard overline="Academic Allocation" testID="student-academic-card">
        <SegmentToggle
          label="Entity"
          value={organization}
          options={ORGS}
          onChange={(v) => setOrganization(v)}
          disabled={readOnly}
          testID="field-entity"
          formatLabel={(v) => (v === "BOTH" ? "Both" : v)}
        />

        <PillSelect
          label="Class"
          value={pwsClass}
          options={PWS_CLASS_OPTIONS}
          onChange={onClassChange}
          disabled={readOnly}
          scrollable
          testID="field-pws-class"
        />

        <PillSelect
          label="Section"
          value={sectionValue}
          options={SECTION_FILTER}
          onChange={applySection}
          disabled={readOnly}
          testID="field-section"
        />

        <FormFieldGrid columns={2} isWide={isWide}>
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
          <FormTextField
            label="Date of Admission"
            required
            testID="field-admission-date"
            value={dateOfAdmission}
            onChangeText={setDateOfAdmission}
            placeholder={DATE_PLACEHOLDER}
            trailingIcon="calendar"
            readOnly={readOnly}
          />
        </FormFieldGrid>
      </FormSectionCard>

      {/* Cards 2 & 3 — two-column personal + contact */}
      <View style={[s.splitRow, isWide && s.splitRowWide]}>
        <FormSectionCard title="Personal Details" style={isWide ? s.splitCol : undefined} testID="student-personal-card">
          <FormFieldGrid columns={2} isWide={isWide}>
            <FormTextField
              label="First Name"
              required
              testID="field-first-name"
              value={firstName}
              onChangeText={(v) => updateName(v, lastName)}
              placeholder="First name"
              readOnly={readOnly}
            />
            <FormTextField
              label="Last Name"
              testID="field-last-name"
              value={lastName}
              onChangeText={(v) => updateName(firstName, v)}
              placeholder="Last name"
              readOnly={readOnly}
            />
          </FormFieldGrid>

          <FormFieldGrid columns={2} isWide={isWide}>
            <FormTextField
              label="Date of Birth"
              testID="field-student-dob"
              value={dob}
              onChangeText={setDob}
              placeholder={DATE_PLACEHOLDER}
              trailingIcon="calendar"
              readOnly={readOnly}
            />
            <FormTextField
              label="Roll Number"
              testID="field-roll-number"
              value={rollNumber}
              onChangeText={setRollNumber}
              placeholder="e.g. 101"
              readOnly={readOnly}
            />
          </FormFieldGrid>

          <View style={s.fieldBlock}>
            <Text style={s.fieldLabel}>Gender</Text>
            <View style={s.chipRow}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  disabled={readOnly}
                  testID={`field-gender-${g.toLowerCase()}`}
                  style={[s.genderPill, gender === g && s.genderPillActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[s.genderPillTxt, gender === g && s.genderPillTxtActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <FormFieldGrid columns={2} isWide={isWide}>
            <FormTextField
              label="Admission Number"
              testID="field-admission-number"
              value={admissionNumber}
              onChangeText={setAdmissionNumber}
              placeholder="e.g. PWS-20250001"
              readOnly={readOnly}
            />
            <FormTextField
              label="Email"
              testID="field-student-email"
              value={personEmail}
              onChangeText={setPersonEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="student@email.com"
              readOnly={readOnly}
            />
          </FormFieldGrid>
        </FormSectionCard>

        <FormSectionCard title="Contact & Parent Details" style={isWide ? s.splitCol : undefined} testID="student-contact-card">
          <FormTextField
            label="Father's Name"
            testID="field-father-name"
            value={guardianName}
            onChangeText={setGuardianName}
            placeholder="Father's full name"
            readOnly={readOnly}
          />
          <FormTextField
            label="Mother's Name"
            testID="field-mother-name"
            value={motherName}
            onChangeText={setMotherName}
            placeholder="Mother's full name"
            readOnly={readOnly}
          />
          <FormTextField
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
            label="Emergency Contact"
            testID="field-student-phone"
            value={mobile}
            onChangeText={setMobile}
            keyboardType="phone-pad"
            placeholder="+91 alternate number"
            leadingIcon="phone-call"
            readOnly={readOnly}
          />
          <FormTextField
            label="Address"
            testID="field-address"
            value={address}
            onChangeText={setAddress}
            placeholder="House no., street, city, pin code"
            multiline
            readOnly={readOnly}
          />
        </FormSectionCard>
      </View>

      {/* Fees & transport */}
      <FormSectionCard overline="Fees & Transport" testID="student-fees-card">
        <View style={s.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.switchLabel}>Transportation</Text>
            <Text style={s.switchHelp}>Include monthly transport fee in the fee breakdown</Text>
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
              <Feather name="credit-card" size={14} color={formColors.primary} />
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
                <Feather name="calendar" size={14} color={formColors.primary} />
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
                  <FormTextField
                    testID={`override-${cat.replace(/\s+/g, "-")}`}
                    label=""
                    value={pwsOverrides[cat] || ""}
                    onChangeText={(v) => setPwsOverrides((prev) => ({ ...prev, [cat]: v }))}
                    keyboardType="numeric"
                    placeholder="Leave blank for default"
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </FormSectionCard>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 0 },
  splitRow: { gap: spacing.xl },
  splitRowWide: { flexDirection: "row", alignItems: "flex-start" },
  splitCol: { flex: 1, minWidth: 0, marginBottom: spacing.xl },
  fieldBlock: { gap: 10 },
  fieldLabel: { fontSize: 12, fontWeight: "700", color: colors.muted, letterSpacing: 0.2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genderPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  genderPillActive: { backgroundColor: formColors.primary, borderColor: formColors.primary },
  genderPillTxt: { fontSize: 13, fontWeight: "700", color: colors.muted },
  genderPillTxtActive: { color: "#fff" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  switchLabel: { fontSize: 14, fontWeight: "700", color: colors.ink },
  switchHelp: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  feeGrid: { gap: spacing.md },
  feeGridWide: { flexDirection: "row", alignItems: "flex-start" },
  feesBox: {
    backgroundColor: formColors.primarySoft,
    borderWidth: 1,
    borderColor: "#C7D7F5",
    borderRadius: radii.md,
    padding: spacing.md,
  },
  feesBoxCol: { flex: 1, minWidth: 0 },
  overrideBox: { backgroundColor: "#F0FDFA", borderColor: "#A7F3D0" },
  feesBoxHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  feesBoxTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: formColors.primary,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  feesReadonlyBox: { backgroundColor: colors.surface, padding: 10, borderRadius: radii.sm, marginTop: 8 },
  feesReadonlyRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  feesReadonlyKey: { fontSize: 12, color: colors.muted2, fontWeight: "600" },
  feesReadonlyVal: { fontSize: 12, color: colors.ink, fontWeight: "800" },
  feesBoxNote: { fontSize: 11, color: formColors.primary, marginTop: 8, fontStyle: "italic" },
  feeLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  feeLinkText: { color: formColors.primary, fontWeight: "700", fontSize: 13 },
  overrideField: { marginTop: 10 },
  overrideHint: { fontSize: 12, color: colors.muted2, marginBottom: 6 },
});
