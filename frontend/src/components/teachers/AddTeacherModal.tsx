import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { api } from "../../auth";
import { getApiError } from "../../ScreenStates";
import { useBreakpoint } from "../../useBreakpoint";
import { colors, spacing } from "../../theme";
import { FormSectionCard } from "../forms/FormSectionCard";
import { FormTextField } from "../forms/FormTextField";
import { FormSelect, type FormSelectOption } from "../forms/FormSelect";
import { FormFieldGrid } from "../forms/FormFieldGrid";
import { DATE_PLACEHOLDER, dateHelpText, isValidDisplayDate, parseToISO } from "../../dateFormat";
import { isValidIndianMobile, normalizeIndianMobile } from "../../TeacherUserFormFields";

const QUALIFICATION_OPTIONS: FormSelectOption[] = [
  { value: "B.Ed", label: "B.Ed" },
  { value: "Bachelor's Degree", label: "Bachelor's Degree" },
  { value: "Master's Degree", label: "Master's Degree" },
  { value: "Other", label: "Other" },
];

type FormState = {
  name: string;
  dateOfBirth: string;
  address: string;
  mobile: string;
  personalEmail: string;
  aadhaarNumber: string;
  qualification: string;
  qualificationOther: string;
  lastJob: string;
  guardianName: string;
  guardianMobile: string;
  referenceName: string;
  referenceMobile: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY_FORM: FormState = {
  name: "",
  dateOfBirth: "",
  address: "",
  mobile: "",
  personalEmail: "",
  aadhaarNumber: "",
  qualification: "",
  qualificationOther: "",
  lastJob: "",
  guardianName: "",
  guardianMobile: "",
  referenceName: "",
  referenceMobile: "",
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidAadhaar(value: string): boolean {
  return /^\d{12}$/.test(value.replace(/\D/g, ""));
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = "Full name is required";
  if (!form.dateOfBirth.trim()) errors.dateOfBirth = "Date of birth is required";
  else if (!isValidDisplayDate(form.dateOfBirth)) errors.dateOfBirth = dateHelpText();
  if (!form.address.trim()) errors.address = "Address is required";
  if (!form.mobile.trim()) errors.mobile = "Mobile number is required";
  else if (!isValidIndianMobile(form.mobile)) errors.mobile = "Enter a valid 10-digit mobile number";
  if (!form.personalEmail.trim()) errors.personalEmail = "Personal email is required";
  else if (!isValidEmail(form.personalEmail)) errors.personalEmail = "Enter a valid email address";
  if (!form.aadhaarNumber.trim()) errors.aadhaarNumber = "Aadhaar number is required";
  else if (!isValidAadhaar(form.aadhaarNumber)) errors.aadhaarNumber = "Aadhaar must be exactly 12 digits";
  if (!form.qualification) errors.qualification = "Qualification is required";
  if (form.qualification === "Other" && !form.qualificationOther.trim()) {
    errors.qualificationOther = "Specify qualification when Other is selected";
  }
  if (!form.lastJob.trim()) errors.lastJob = "Last job / experience is required";
  if (!form.guardianName.trim()) errors.guardianName = "Husband's / Father's name is required";
  if (!form.guardianMobile.trim()) errors.guardianMobile = "Husband's / Father's mobile is required";
  else if (!isValidIndianMobile(form.guardianMobile)) errors.guardianMobile = "Enter a valid 10-digit mobile number";
  if (!form.referenceName.trim()) errors.referenceName = "Reference name is required";
  if (!form.referenceMobile.trim()) errors.referenceMobile = "Reference mobile is required";
  else if (!isValidIndianMobile(form.referenceMobile)) errors.referenceMobile = "Enter a valid 10-digit mobile number";
  return errors;
}

export function AddTeacherModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (message?: string) => void;
}) {
  const { isWide } = useBreakpoint();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setForm(EMPTY_FORM);
    setErrors({});
    setSubmitError(null);
    setSubmitting(false);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSubmitError(null);
  }, []);

  const showQualificationOther = form.qualification === "Other";

  const payload = useMemo(() => {
    const dobIso = parseToISO(form.dateOfBirth.trim());
    return {
      name: form.name.trim(),
      date_of_birth: dobIso || form.dateOfBirth.trim(),
      address: form.address.trim(),
      mobile: normalizeIndianMobile(form.mobile),
      personal_email: form.personalEmail.trim().toLowerCase(),
      aadhaar_number: form.aadhaarNumber.replace(/\D/g, ""),
      qualification: form.qualification,
      qualification_other: showQualificationOther ? form.qualificationOther.trim() : null,
      last_job: form.lastJob.trim(),
      guardian_name: form.guardianName.trim(),
      guardian_mobile: normalizeIndianMobile(form.guardianMobile),
      reference_name: form.referenceName.trim(),
      reference_mobile: normalizeIndianMobile(form.referenceMobile),
    };
  }, [form, showQualificationOther]);

  const submit = async () => {
    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post("/users/directory-teachers", payload);
      onCreated("Teacher added successfully");
      reset();
      onClose();
    } catch (e: any) {
      setSubmitError(getApiError(e, "Failed to add teacher. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const renderError = (key: keyof FormState) =>
    errors[key] ? <Text style={s.errorText} testID={`error-${key}`}>{errors[key]}</Text> : null;

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={close}>
      <View style={s.overlay}>
        <Pressable style={s.backdrop} onPress={close} accessibilityLabel="Close add teacher modal" />
        <View style={s.drawer} testID="add-teacher-modal">
          <View style={s.drawerHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.overline}>DIRECTORY · TEACHERS</Text>
              <Text style={s.title}>Add Teacher</Text>
            </View>
            <Pressable onPress={close} testID="add-teacher-close" hitSlop={12}>
              <Feather name="x" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
            {submitError ? (
              <View style={s.submitErrorBox} testID="add-teacher-submit-error">
                <Feather name="alert-circle" size={16} color="#991B1B" />
                <Text style={s.submitErrorText}>{submitError}</Text>
              </View>
            ) : null}

            <FormSectionCard overline="Section A" title="Personal Information">
              <FormFieldGrid columns={2} isWide={isWide}>
                <View>
                  <FormTextField
                    label="Full Name"
                    required
                    value={form.name}
                    onChangeText={(v) => setField("name", v)}
                    placeholder="Full name"
                    testID="teacher-name"
                  />
                  {renderError("name")}
                </View>
                <View>
                  <FormTextField
                    label="Date of Birth"
                    required
                    value={form.dateOfBirth}
                    onChangeText={(v) => setField("dateOfBirth", v)}
                    placeholder={DATE_PLACEHOLDER}
                    trailingIcon="calendar"
                    testID="teacher-dob"
                  />
                  {renderError("dateOfBirth")}
                </View>
              </FormFieldGrid>

              <View>
                <FormTextField
                  label="Address"
                  required
                  multiline
                  value={form.address}
                  onChangeText={(v) => setField("address", v)}
                  placeholder="Residential address"
                  testID="teacher-address"
                />
                {renderError("address")}
              </View>

              <FormFieldGrid columns={2} isWide={isWide}>
                <View>
                  <FormTextField
                    label="Mobile Number"
                    required
                    value={form.mobile}
                    onChangeText={(v) => setField("mobile", v)}
                    placeholder="10-digit mobile"
                    keyboardType="phone-pad"
                    maxLength={14}
                    testID="teacher-mobile"
                  />
                  {renderError("mobile")}
                </View>
                <View>
                  <FormTextField
                    label="Personal Email"
                    required
                    value={form.personalEmail}
                    onChangeText={(v) => setField("personalEmail", v)}
                    placeholder="name@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    testID="teacher-personal-email"
                  />
                  {renderError("personalEmail")}
                </View>
              </FormFieldGrid>

              <View>
                <FormTextField
                  label="Aadhaar Number"
                  required
                  secureTextEntry
                  value={form.aadhaarNumber}
                  onChangeText={(v) => setField("aadhaarNumber", v.replace(/\D/g, "").slice(0, 12))}
                  placeholder="12-digit Aadhaar"
                  keyboardType="number-pad"
                  maxLength={12}
                  testID="teacher-aadhaar"
                />
                {renderError("aadhaarNumber")}
              </View>
            </FormSectionCard>

            <FormSectionCard overline="Section B" title="Professional Details">
              <View>
                <FormSelect
                  label="Qualification"
                  required
                  value={form.qualification}
                  options={QUALIFICATION_OPTIONS}
                  onChange={(v) => {
                    setField("qualification", v);
                    if (v !== "Other") setField("qualificationOther", "");
                  }}
                  placeholder="Select qualification"
                  testID="teacher-qualification"
                />
                {renderError("qualification")}
              </View>

              {showQualificationOther && (
                <View>
                  <FormTextField
                    label="Specify Qualification"
                    required
                    value={form.qualificationOther}
                    onChangeText={(v) => setField("qualificationOther", v)}
                    placeholder="Enter qualification"
                    testID="teacher-qualification-other"
                  />
                  {renderError("qualificationOther")}
                </View>
              )}

              <View>
                <FormTextField
                  label="Last Job / Experience"
                  required
                  value={form.lastJob}
                  onChangeText={(v) => setField("lastJob", v)}
                  placeholder="e.g. Name of School / Company"
                  testID="teacher-last-job"
                />
                {renderError("lastJob")}
              </View>
            </FormSectionCard>

            <FormSectionCard overline="Section C" title="Family & Reference Details">
              <FormFieldGrid columns={2} isWide={isWide}>
                <View>
                  <FormTextField
                    label="Husband's / Father's Name"
                    required
                    value={form.guardianName}
                    onChangeText={(v) => setField("guardianName", v)}
                    placeholder="Full name"
                    testID="teacher-guardian-name"
                  />
                  {renderError("guardianName")}
                </View>
                <View>
                  <FormTextField
                    label="Husband's / Father's Mobile Number"
                    required
                    value={form.guardianMobile}
                    onChangeText={(v) => setField("guardianMobile", v)}
                    placeholder="10-digit mobile"
                    keyboardType="phone-pad"
                    maxLength={14}
                    testID="teacher-guardian-mobile"
                  />
                  {renderError("guardianMobile")}
                </View>
              </FormFieldGrid>

              <Text style={s.referenceHeading}>Reference Details</Text>
              <FormFieldGrid columns={2} isWide={isWide}>
                <View>
                  <FormTextField
                    label="Reference Name"
                    required
                    value={form.referenceName}
                    onChangeText={(v) => setField("referenceName", v)}
                    placeholder="Reference full name"
                    testID="teacher-reference-name"
                  />
                  {renderError("referenceName")}
                </View>
                <View>
                  <FormTextField
                    label="Reference Mobile Number"
                    required
                    value={form.referenceMobile}
                    onChangeText={(v) => setField("referenceMobile", v)}
                    placeholder="10-digit mobile"
                    keyboardType="phone-pad"
                    maxLength={14}
                    testID="teacher-reference-mobile"
                  />
                  {renderError("referenceMobile")}
                </View>
              </FormFieldGrid>
            </FormSectionCard>
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.cancelBtn} onPress={close} disabled={submitting} testID="add-teacher-cancel">
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={submit}
              disabled={submitting}
              testID="add-teacher-submit"
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.submitTxt}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, flexDirection: "row", justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.45)" },
  drawer: {
    width: Platform.OS === "web" ? 560 : "94%",
    maxWidth: "100%",
    backgroundColor: colors.surface,
    height: "100%",
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  overline: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: { fontSize: 20, fontWeight: "800", color: colors.ink, marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xl },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  cancelTxt: { color: colors.ink, fontWeight: "700", fontSize: 14 },
  submitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: colors.primary,
  },
  submitTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  errorText: { color: "#DC2626", fontSize: 12, fontWeight: "600", marginTop: -4 },
  submitErrorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: spacing.md,
  },
  submitErrorText: { flex: 1, color: "#991B1B", fontSize: 13, fontWeight: "600" },
  referenceHeading: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.ink,
    marginTop: spacing.sm,
  },
});
