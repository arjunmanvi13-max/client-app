import { useEffect, useState, type ReactNode } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, Pressable, ActivityIndicator, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { FormTextField } from "../components/forms/FormTextField";
import { FormSelect } from "../components/forms/FormSelect";
import { FormDateField } from "../components/forms/FormDateField";
import { formatDate, parseToISO, toISODate } from "../dateFormat";
import { colors, radii, spacing } from "../theme";
import { useBreakpoint } from "../useBreakpoint";
import { PWS_CLASSES } from "../pwsFeeStructure";
import {
  ALPHA_CAMPUSES, ALPHA_CATEGORIES, ALPHA_SPORTS, CONTACT_METHODS, ENQUIRY_SOURCES,
  ENQUIRY_STATUSES, FEE_DISCUSSION, GENDERS, PRIORITIES, RELATIONSHIPS,
  type Enquiry, type EnquiryInstitution, type EnquiryPayload, type EnquiryStaff,
} from "./types";

type Props = {
  visible: boolean;
  saving: boolean;
  enquiry?: Enquiry | null;
  staff: EnquiryStaff[];
  onClose: () => void;
  onSubmit: (payload: EnquiryPayload) => Promise<void>;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={s.toggleRow}>
      <Text style={s.toggleLabel}>{label}</Text>
      <View style={s.toggleBtns}>
        {(["No", "Yes"] as const).map((opt) => {
          const on = (opt === "Yes") === value;
          return (
            <TouchableOpacity key={opt} onPress={() => onChange(opt === "Yes")} style={[s.toggleChip, on && s.toggleChipOn]}>
              <Text style={[s.toggleTxt, on && s.toggleTxtOn]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toISODate(d);
}

export function EnquiryFormModal({ visible, saving, enquiry, staff, onClose, onSubmit }: Props) {
  const { width: winW, height: winH } = useBreakpoint();
  const gutter = winW < 720 ? 12 : 24;
  const sheetW = Math.min(860, Math.max(320, winW - gutter * 2));
  const sheetH = Math.min(winH - gutter * 2, Math.round(winH * 0.92));
  const stack = sheetW < 640;
  const editing = Boolean(enquiry);

  const [error, setError] = useState("");
  const [institution, setInstitution] = useState<EnquiryInstitution>("PWS");
  const [academicYear, setAcademicYear] = useState("2026-27");
  const [enquiryDate, setEnquiryDate] = useState(formatDate(toISODate()));
  const [source, setSource] = useState("Phone Call");
  const [referredBy, setReferredBy] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [studentName, setStudentName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [currentSchool, setCurrentSchool] = useState("");
  const [currentClass, setCurrentClass] = useState("");
  const [applyingFor, setApplyingFor] = useState("");
  const [campus, setCampus] = useState("");
  const [sibling, setSibling] = useState(false);
  const [siblingName, setSiblingName] = useState("");
  const [siblingClass, setSiblingClass] = useState("");
  const [parentName, setParentName] = useState("");
  const [relationship, setRelationship] = useState("Father");
  const [mobile, setMobile] = useState("");
  const [altMobile, setAltMobile] = useState("");
  const [email, setEmail] = useState("");
  const [locality, setLocality] = useState("");
  const [address, setAddress] = useState("");
  const [contactMethod, setContactMethod] = useState("Call");
  const [sport, setSport] = useState("");
  const [category, setCategory] = useState("");
  const [expectations, setExpectations] = useState("");
  const [feeStatus, setFeeStatus] = useState("Not Discussed");
  const [prospectus, setProspectus] = useState(false);
  const [visitReq, setVisitReq] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("New");
  const [followUp, setFollowUp] = useState(formatDate(tomorrowIso()));
  const [followRemarks, setFollowRemarks] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [priority, setPriority] = useState("Medium");

  useEffect(() => {
    if (!visible) return;
    setError("");
    if (enquiry) {
      setInstitution(enquiry.institution);
      setAcademicYear(enquiry.academic_year || "2026-27");
      setEnquiryDate(formatDate((enquiry.enquiry_at || "").slice(0, 10)));
      setSource(enquiry.source);
      setReferredBy(enquiry.referred_by || "");
      setAssignedTo(enquiry.assigned_to_id || "");
      setStudentName(enquiry.student_name || "");
      setDob(enquiry.dob ? formatDate(enquiry.dob) : "");
      setGender(enquiry.gender || "");
      setCurrentSchool(enquiry.current_school || "");
      setCurrentClass(enquiry.current_class || "");
      setApplyingFor(enquiry.applying_for || "");
      setCampus(enquiry.preferred_campus || "");
      setSibling(Boolean(enquiry.sibling_enrolled));
      setSiblingName(enquiry.sibling_name || "");
      setSiblingClass(enquiry.sibling_class || "");
      setParentName(enquiry.parent_name || "");
      setRelationship(enquiry.relationship || "Father");
      setMobile(enquiry.mobile || "");
      setAltMobile(enquiry.alternate_mobile || "");
      setEmail(enquiry.email || "");
      setLocality(enquiry.locality || "");
      setAddress(enquiry.address || "");
      setContactMethod(enquiry.preferred_contact_method || "Call");
      setSport(enquiry.alpha_sport || "");
      setCategory(enquiry.alpha_category || "");
      setExpectations(enquiry.parent_expectations || "");
      setFeeStatus(enquiry.fee_discussion_status || "Not Discussed");
      setProspectus(Boolean(enquiry.prospectus_shared));
      setVisitReq(Boolean(enquiry.visit_required));
      setVisitDate(enquiry.preferred_visit_at ? formatDate(enquiry.preferred_visit_at.slice(0, 10)) : "");
      setNotes(enquiry.interaction_notes || "");
      setStatus(enquiry.status === "Pending Close" ? enquiry.status : enquiry.status);
      setFollowUp(enquiry.next_follow_up_at ? formatDate(enquiry.next_follow_up_at.slice(0, 10)) : formatDate(tomorrowIso()));
      setFollowRemarks(enquiry.follow_up_remarks || "");
      setLostReason(enquiry.lost_reason || "");
      setPriority(enquiry.priority || "Medium");
      return;
    }
    setInstitution("PWS");
    setAcademicYear("2026-27");
    setEnquiryDate(formatDate(toISODate()));
    setSource("Phone Call");
    setReferredBy("");
    setAssignedTo("");
    setStudentName("");
    setDob("");
    setGender("");
    setCurrentSchool("");
    setCurrentClass("");
    setApplyingFor("");
    setCampus("");
    setSibling(false);
    setSiblingName("");
    setSiblingClass("");
    setParentName("");
    setRelationship("Father");
    setMobile("");
    setAltMobile("");
    setEmail("");
    setLocality("");
    setAddress("");
    setContactMethod("Call");
    setSport("");
    setCategory("");
    setExpectations("");
    setFeeStatus("Not Discussed");
    setProspectus(false);
    setVisitReq(false);
    setVisitDate("");
    setNotes("");
    setStatus("New");
    setFollowUp(formatDate(tomorrowIso()));
    setFollowRemarks("");
    setLostReason("");
    setPriority("Medium");
  }, [visible, enquiry]);

  const field = (node: ReactNode) => <View style={[s.field, stack && s.fieldFull]}>{node}</View>;

  const submit = async () => {
    setError("");
    const apply = institution === "ALPHA"
      ? [sport, category].filter(Boolean).join(" · ") || applyingFor
      : applyingFor;
    if (!studentName.trim()) return setError("Student name is required.");
    if (!parentName.trim()) return setError("Parent/guardian name is required.");
    if (!mobile.trim()) return setError("Primary mobile number is required.");
    if (!apply.trim()) return setError("Applying for is required.");
    if (!source) return setError("Enquiry source is required.");
    if (!status) return setError("Status is required.");
    const followIso = parseToISO(followUp);
    const closed = ["Admitted", "Not Interested", "Lost", "Pending Close", "On Hold"].includes(status);
    if (!closed && !followIso) return setError("Next follow-up date is required for active enquiries.");
    const payload: EnquiryPayload = {
      institution,
      academic_year: academicYear,
      enquiry_at: `${parseToISO(enquiryDate) || toISODate()}T09:00:00`,
      source,
      referred_by: referredBy,
      assigned_to_id: assignedTo || null,
      student_name: studentName,
      dob: parseToISO(dob) || undefined,
      gender,
      current_school: currentSchool,
      current_class: currentClass,
      applying_for: apply,
      preferred_campus: campus,
      sibling_enrolled: sibling,
      sibling_name: siblingName,
      sibling_class: siblingClass,
      parent_name: parentName,
      relationship,
      mobile,
      alternate_mobile: altMobile,
      email,
      locality,
      address,
      preferred_contact_method: contactMethod,
      alpha_sport: sport,
      alpha_category: category,
      parent_expectations: expectations,
      fee_discussion_status: feeStatus,
      prospectus_shared: prospectus,
      visit_required: visitReq,
      preferred_visit_at: parseToISO(visitDate) ? `${parseToISO(visitDate)}T10:00:00` : undefined,
      interaction_notes: notes,
      status,
      next_follow_up_at: followIso ? `${followIso}T09:00:00` : undefined,
      follow_up_remarks: followRemarks,
      lost_reason: lostReason,
      priority,
    };
    await onSubmit(payload);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[s.sheet, { width: sheetW, height: sheetH }]} testID="enquiry-form">
          <View style={s.sheetHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.kicker}>OPERATIONS · ENQUIRY</Text>
              <Text style={s.sheetTitle}>{editing ? `Edit ${enquiry?.enquiry_code}` : "Add Enquiry"}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={s.iconBtn} testID="close-enquiry-form">
              <Feather name="x" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView style={s.body} contentContainerStyle={s.bodyInner} keyboardShouldPersistTaps="handled">
            <Section title="Enquiry details">
              <View style={s.fields}>
                {field(<FormSelect label="Institution" required compact value={institution} onChange={(v) => setInstitution(v as EnquiryInstitution)} options={[{ value: "PWS", label: "PWS" }, { value: "ALPHA", label: "ALPHA" }]} />)}
                {field(<FormTextField label="Academic year" compact value={academicYear} onChangeText={setAcademicYear} />)}
                {field(<FormDateField label="Enquiry date" required compact value={enquiryDate} onChangeText={setEnquiryDate} />)}
                {field(<FormSelect label="Enquiry source" required compact value={source} onChange={setSource} options={ENQUIRY_SOURCES.map((x) => ({ value: x, label: x }))} />)}
                {field(<FormTextField label="Referred by / details" compact value={referredBy} onChangeText={setReferredBy} />)}
                {field(<FormSelect label="Assigned counsellor" compact value={assignedTo} onChange={setAssignedTo} options={[{ value: "", label: "Admissions office" }, ...staff.map((u) => ({ value: u.id, label: u.name }))] } />)}
              </View>
            </Section>
            <Section title="Student details">
              <View style={s.fields}>
                {field(<FormTextField label="Student full name" required compact value={studentName} onChangeText={setStudentName} testID="field-student-name" />)}
                {field(<FormDateField label="Date of birth" compact value={dob} onChangeText={setDob} />)}
                {field(<FormSelect label="Gender" compact value={gender} onChange={setGender} options={[{ value: "", label: "—" }, ...GENDERS.map((x) => ({ value: x, label: x }))]} />)}
                {field(<FormTextField label="Current school / preschool" compact value={currentSchool} onChangeText={setCurrentSchool} />)}
                {field(<FormTextField label="Current class" compact value={currentClass} onChangeText={setCurrentClass} />)}
                {institution === "PWS"
                  ? field(<FormSelect label="Applying for class" required compact value={applyingFor} onChange={setApplyingFor} options={PWS_CLASSES.map((x) => ({ value: x, label: x }))} />)
                  : null}
                {institution === "ALPHA" ? field(<FormSelect label="Preferred campus" compact value={campus} onChange={setCampus} options={[{ value: "", label: "—" }, ...ALPHA_CAMPUSES.map((x) => ({ value: x, label: x }))]} />) : null}
                {institution === "ALPHA" ? field(<FormSelect label="Sport" compact value={sport} onChange={setSport} options={[{ value: "", label: "—" }, ...ALPHA_SPORTS.map((x) => ({ value: x, label: x }))]} />) : null}
                {institution === "ALPHA" ? field(<FormSelect label="Category" compact value={category} onChange={setCategory} options={[{ value: "", label: "—" }, ...ALPHA_CATEGORIES.map((x) => ({ value: x, label: x }))]} />) : null}
              </View>
              <YesNo label="Sibling currently enrolled?" value={sibling} onChange={setSibling} />
              {sibling ? (
                <View style={s.fields}>
                  {field(<FormTextField label="Sibling name" compact value={siblingName} onChangeText={setSiblingName} />)}
                  {field(<FormTextField label="Sibling class" compact value={siblingClass} onChangeText={setSiblingClass} />)}
                </View>
              ) : null}
            </Section>
            <Section title="Parent / guardian details">
              <View style={s.fields}>
                {field(<FormTextField label="Parent/guardian name" required compact value={parentName} onChangeText={setParentName} testID="field-parent-name" />)}
                {field(<FormSelect label="Relationship" compact value={relationship} onChange={setRelationship} options={RELATIONSHIPS.map((x) => ({ value: x, label: x }))} />)}
                {field(<FormTextField label="Mobile number" required compact keyboardType="phone-pad" value={mobile} onChangeText={setMobile} testID="field-mobile" />)}
                {field(<FormTextField label="Alternate mobile" compact keyboardType="phone-pad" value={altMobile} onChangeText={setAltMobile} />)}
                {field(<FormTextField label="Email address" compact keyboardType="email-address" value={email} onChangeText={setEmail} />)}
                {field(<FormTextField label="Residential area / locality" compact value={locality} onChangeText={setLocality} />)}
                {field(<FormTextField label="Full address" compact multiline value={address} onChangeText={setAddress} />)}
                {field(<FormSelect label="Preferred contact method" compact value={contactMethod} onChange={setContactMethod} options={CONTACT_METHODS.map((x) => ({ value: x, label: x }))} />)}
              </View>
            </Section>
            <Section title="Admission interest">
              <FormTextField label="Parent’s key requirements" compact multiline value={expectations} onChangeText={setExpectations} />
              <View style={s.fields}>
                {field(<FormSelect label="Fee discussion status" compact value={feeStatus} onChange={setFeeStatus} options={FEE_DISCUSSION.map((x) => ({ value: x, label: x }))} />)}
              </View>
              <YesNo label="Prospectus / brochure shared?" value={prospectus} onChange={setProspectus} />
              <YesNo label="Campus visit or counselling required?" value={visitReq} onChange={setVisitReq} />
              {visitReq ? <FormDateField label="Preferred visit date" compact value={visitDate} onChangeText={setVisitDate} /> : null}
              <FormTextField label="Notes from the call or interaction" compact multiline value={notes} onChangeText={setNotes} />
            </Section>
            <Section title="Follow-up tracking">
              <View style={s.fields}>
                {field(<FormSelect label="Status" required compact value={status} onChange={setStatus} options={ENQUIRY_STATUSES.filter((x) => x !== "Pending Close" && x !== "Lost" && x !== "Not Interested" && x !== "Admitted").map((x) => ({ value: x, label: x }))} />)}
                {field(<FormSelect label="Priority" compact value={priority} onChange={setPriority} options={PRIORITIES.map((x) => ({ value: x, label: x }))} />)}
                {field(<FormDateField label="Next follow-up date" required compact value={followUp} onChangeText={setFollowUp} />)}
              </View>
              <FormTextField label="Follow-up remarks" compact value={followRemarks} onChangeText={setFollowRemarks} />
            </Section>
          </ScrollView>
          <View style={s.footer}>
            {error ? <Text style={s.error}>{error}</Text> : null}
            <TouchableOpacity testID="submit-enquiry" disabled={saving} onPress={submit} style={[s.submit, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitTxt}>{editing ? "Save Enquiry" : "Add Enquiry"}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", alignItems: "center", padding: spacing.md },
  sheet: { backgroundColor: colors.bg, borderRadius: radii.xl, overflow: "hidden", flexDirection: "column", zIndex: 2 },
  sheetHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  kicker: { fontSize: 10, fontWeight: "800", color: colors.accent, letterSpacing: 1 },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: colors.ink, marginTop: 2 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 },
  body: { flex: 1, minHeight: 0, ...Platform.select({ web: { overflowY: "auto" } as object, default: {} }) },
  bodyInner: { padding: spacing.md, paddingBottom: spacing.lg },
  section: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, padding: 14, marginBottom: 12 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: colors.ink, marginBottom: 10 },
  fields: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -6 },
  field: { width: "50%", paddingHorizontal: 6, marginBottom: 10 },
  fieldFull: { width: "100%", paddingHorizontal: 0 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  toggleLabel: { fontSize: 13, fontWeight: "700", color: colors.ink, flex: 1, paddingRight: 8 },
  toggleBtns: { flexDirection: "row", gap: 8 },
  toggleChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  toggleChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  toggleTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  toggleTxtOn: { color: "#fff" },
  footer: { padding: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  submit: { backgroundColor: colors.accent, borderRadius: radii.lg, paddingVertical: 14, alignItems: "center" },
  submitTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
  error: { color: colors.danger, fontSize: 12, fontWeight: "600", marginBottom: 8 },
});
