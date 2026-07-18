import { View, Text, ScrollView, StyleSheet } from "react-native";
import { formatDate } from "../dateFormat";

export type ReportCardData = {
  person_name?: string;
  father_name?: string;
  mother_name?: string;
  dob?: string;
  grade_name?: string;
  section_label?: string;
  academic_year_name?: string;
  exam_term_name?: string;
  scholastic_rows?: any[];
  subjects?: any[];
  co_scholastic?: Record<string, string | null>;
  teacher_remark?: string;
  attendance_display?: string;
  attendance_pct?: number;
  attendance_present?: number;
  attendance_total?: number;
  overall_marks_display?: string;
  total_obtained?: number;
  total_max?: number;
  percentage?: number;
  overall_grade?: string;
  grading_scale_note?: string;
  issue_date?: string;
  finalized_at?: string;
  published_at?: string;
  status?: string;
  branding?: { school_name?: string; tagline?: string; logo_url?: string };
};

const COMPONENT_COLS = [
  { key: "periodic_test", label: "PT (20)" },
  { key: "independent_assessment", label: "IA (10)" },
  { key: "written_assessment", label: "WA (40)" },
  { key: "project", label: "Proj (20)" },
  { key: "group_discussion", label: "GD (10)" },
  { key: "theory", label: "Theory (50)" },
  { key: "practical_viva", label: "Prac (40)" },
] as const;

const CO_SCHOLASTIC = [
  { key: "music_dramatics", label: "Music / Dramatics" },
  { key: "art_education", label: "Art / Education" },
  { key: "physical_education_yoga", label: "Physical Education / Yoga" },
] as const;

function cellVal(v: any) {
  if (v === null || v === undefined || v === "") return "-----";
  return String(v);
}

function formatDobDisplay(dob?: string) {
  if (!dob) return "—";
  return formatDate(dob) || dob;
}

function displayClass(grade?: string, section?: string) {
  if (section && section.includes("-")) {
    const prefix = section.split("-")[0];
    const map: Record<string, string> = {
      "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V", "6": "VI",
      "7": "VII", "8": "VIII", "9": "IX", "10": "X",
    };
    if (map[prefix]) return map[prefix];
  }
  return grade || section || "—";
}

function attendanceText(card: ReportCardData) {
  if (card.attendance_display) return card.attendance_display;
  if (card.attendance_present != null && card.attendance_total) {
    return `${card.attendance_present}/${card.attendance_total}`;
  }
  if (card.attendance_pct != null) return `${card.attendance_pct}%`;
  return "—";
}

type Props = {
  card: ReportCardData;
  readOnly?: boolean;
};

export function ReportCardSheet({ card }: Props) {
  const branding = card.branding || {};
  const session = card.academic_year_name || "2025 - 26";
  const term = (card.exam_term_name || "TERM I").toUpperCase();
  const rows = card.scholastic_rows?.length ? card.scholastic_rows : (card.subjects || []).map((s) => ({
    subject_name: s.subject_name,
    marks_obtained: s.marks_obtained,
    grade: s.grade,
  }));
  const overall = card.overall_marks_display
    || (card.total_obtained != null && card.total_max != null ? `${card.total_obtained}/${card.total_max}` : "—");
  const co = card.co_scholastic || {};
  const isLocked = card.status === "finalized" || card.status === "published";

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={s.sheet}>
        <View style={s.headerRow}>
          <Text style={s.school}>{branding.school_name || "Prarambhika World School"}</Text>
          {branding.tagline ? <Text style={s.tagline}>{branding.tagline}</Text> : null}
        </View>
        <View style={s.brandBar} />
        <Text style={s.title}>
          Report Card for Academic Session: {session} ({term})
        </Text>

        <View style={s.detailsGrid}>
          <Detail label="Student's Name" value={card.person_name || "—"} />
          <Detail label="Class" value={displayClass(card.grade_name, card.section_label)} />
          <Detail label="Father's Name" value={card.father_name || "—"} />
          <Detail label="Date of Birth" value={formatDobDisplay(card.dob)} />
          <Detail label="Mother's Name" value={card.mother_name || "—"} wide />
        </View>

        <Text style={s.sectionHead}>SCHOLASTIC AREA</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tableScroll}>
          <View>
            <View style={s.tableHead}>
              <Text style={[s.th, s.colSubject]}>Subject</Text>
              {COMPONENT_COLS.map((c) => (
                <Text key={c.key} style={s.th}>{c.label}</Text>
              ))}
              <Text style={s.th}>Marks</Text>
              <Text style={s.th}>Grade</Text>
            </View>
            {rows.map((row: any, i: number) => (
              <View key={row.subject_id || i} style={s.tableRow}>
                <Text style={[s.td, s.colSubject]} numberOfLines={2}>{row.subject_name}</Text>
                {COMPONENT_COLS.map((c) => (
                  <Text key={c.key} style={s.td}>{cellVal(row[c.key])}</Text>
                ))}
                <Text style={s.td}>{cellVal(row.marks_obtained)}</Text>
                <Text style={[s.td, s.gradeCell]}>{cellVal(row.grade)}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <Text style={s.scaleNote}>
          {card.grading_scale_note
            || "8 Point Grading Scale: A1 (91 - 100), A2 (81 - 90), B1 (71 - 80), B2 (61-70), C1 (51 - 60), C2 (41 - 50), D (33 - 40), E (0 - 32)"}
        </Text>

        <View style={s.summaryRow}>
          <Text style={s.summaryBox}>OVERALL MARKS {overall}</Text>
          <Text style={s.summaryBox}>PERCENTAGE {card.percentage != null ? `${card.percentage}%` : "—"}</Text>
        </View>

        <Text style={s.sectionHead}>Co-Scholastic Area</Text>
        <View style={s.coTable}>
          <View style={s.coHead}>
            <Text style={[s.coTh, { flex: 2 }]}>Area</Text>
            <Text style={s.coTh}>Grade</Text>
          </View>
          {CO_SCHOLASTIC.map((item) => (
            <View key={item.key} style={s.coRow}>
              <Text style={[s.coTd, { flex: 2 }]}>{item.label}</Text>
              <Text style={s.coTd}>{co[item.key] || "—"}</Text>
            </View>
          ))}
        </View>

        {card.teacher_remark ? (
          <Text style={s.remarkLine}>Remarks - {card.teacher_remark}</Text>
        ) : null}
        <Text style={s.metaLine}>Attendance - {attendanceText(card)}</Text>
        {(card.issue_date || card.finalized_at || card.published_at) ? (
          <Text style={s.metaLine}>
            Date of issue - {formatDobDisplay(card.issue_date || card.finalized_at || card.published_at)}
          </Text>
        ) : null}

        <View style={s.signRow}>
          <Text style={s.sign}>Class Teacher</Text>
          <Text style={s.sign}>Principal</Text>
        </View>

        {isLocked ? (
          <Text style={s.locked}>Finalized — read only</Text>
        ) : (
          <Text style={s.draft}>Draft — editable until finalized</Text>
        )}
      </View>
    </ScrollView>
  );
}

function Detail({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[s.detailCell, wide && s.detailWide]}>
      <Text style={s.detailLabel}>{label}</Text>
      <Text style={s.detailValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    width: "100%",
    minWidth: 680,
    backgroundColor: "#fff",
    borderRadius: 4,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerRow: { alignItems: "center", marginBottom: 8 },
  school: { fontSize: 20, fontWeight: "800", color: "#1E40AF", textAlign: "center" },
  tagline: { fontSize: 11, color: "#64748B", marginTop: 4, textAlign: "center" },
  brandBar: { height: 4, backgroundColor: "#1E40AF", borderRadius: 2, marginBottom: 16 },
  title: { fontSize: 14, fontWeight: "700", textAlign: "center", color: "#0F172A", marginBottom: 16 },
  detailsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  detailCell: { width: "48%", marginBottom: 6 },
  detailWide: { width: "100%" },
  detailLabel: { fontSize: 10, fontWeight: "700", color: "#64748B" },
  detailValue: { fontSize: 13, fontWeight: "600", color: "#0F172A", marginTop: 2 },
  sectionHead: { fontSize: 12, fontWeight: "800", color: "#0F172A", marginTop: 8, marginBottom: 8 },
  tableScroll: { marginBottom: 8 },
  tableHead: { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: "#1E40AF", paddingBottom: 6 },
  th: { width: 52, fontSize: 8, fontWeight: "700", color: "#1E40AF", textAlign: "center" },
  colSubject: { width: 88, textAlign: "left", paddingRight: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F1F5F9", paddingVertical: 6 },
  td: { width: 52, fontSize: 9, color: "#334155", textAlign: "center" },
  gradeCell: { fontWeight: "700", color: "#1E40AF" },
  scaleNote: { fontSize: 8, color: "#64748B", lineHeight: 14, marginVertical: 10 },
  summaryRow: { flexDirection: "row", gap: 16, marginVertical: 10 },
  summaryBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 10,
    fontSize: 12,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    borderRadius: 4,
  },
  coTable: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 4, marginBottom: 12 },
  coHead: { flexDirection: "row", backgroundColor: "#F8FAFC", padding: 8, borderBottomWidth: 1, borderColor: "#E2E8F0" },
  coTh: { fontSize: 10, fontWeight: "700", color: "#475569" },
  coRow: { flexDirection: "row", padding: 8, borderBottomWidth: 1, borderColor: "#F1F5F9" },
  coTd: { fontSize: 12, color: "#334155" },
  remarkLine: { fontSize: 12, color: "#334155", marginTop: 8, lineHeight: 18 },
  metaLine: { fontSize: 12, color: "#475569", marginTop: 6 },
  signRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 24, paddingTop: 12, borderTopWidth: 1, borderColor: "#E2E8F0" },
  sign: { fontSize: 11, fontWeight: "600", color: "#64748B" },
  locked: { marginTop: 16, textAlign: "center", fontSize: 11, color: "#16A34A", fontWeight: "700" },
  draft: { marginTop: 16, textAlign: "center", fontSize: 11, color: "#F59E0B", fontWeight: "600" },
});

export function canExportPdf(card: ReportCardData) {
  return card.status === "finalized" || card.status === "published";
}

export function isReportCardLocked(card: ReportCardData) {
  return card.status === "finalized" || card.status === "published";
}
