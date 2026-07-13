import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, useAuth, userHasPermission } from "../../../src/auth";
import { Permission } from "../../../src/rbac";

type Combo = {
  academic_year_id: string;
  grade_name?: string;
  section_id: string;
  section_label?: string;
  subject_id: string;
  subject_name?: string;
  assessments: { id: string; name: string; max_marks: number }[];
};

type StudentRow = {
  person_id: string;
  name: string;
  marks_obtained: number | null;
  max_marks: number;
  grade: string | null;
  percentage: number | null;
  status: string | null;
};

export default function MarksEntry() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 720;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState<any>(null);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [maxMarks, setMaxMarks] = useState(100);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<"draft" | "final">("draft");
  const [gridStatus, setGridStatus] = useState<string | null>(null);

  const canEnter = userHasPermission(user, Permission.MANAGE_MARKS_ASSESSMENT);

  const loadMeta = useCallback(async () => {
    setLoading(true);
    try {
      const yearsRes = await api.get("/academic/years");
      const openYear = yearsRes.data.find((y: any) => y.status === "open") || yearsRes.data[0];
      setYear(openYear || null);
      if (openYear) {
        const comboRes = await api.get("/marks/my-combinations", { params: { academic_year_id: openYear.id } });
        const list: Combo[] = comboRes.data.combinations || [];
        setCombos(list);
        if (!sectionId && list[0]) {
          setSectionId(list[0].section_id);
          setSubjectId(list[0].subject_id);
          setAssessmentId(list[0].assessments?.[0]?.id || null);
          setMaxMarks(list[0].assessments?.[0]?.max_marks || 100);
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to load marks setup");
    } finally {
      setLoading(false);
    }
  }, [sectionId]);

  const sectionCombos = combos.filter((c) => !sectionId || c.section_id === sectionId);
  const subjectCombos = sectionCombos.filter((c) => !subjectId || c.subject_id === subjectId);
  const currentCombo = subjectCombos.find((c) => c.section_id === sectionId && c.subject_id === subjectId);
  const assessments = currentCombo?.assessments || [];

  const loadGrid = useCallback(async () => {
    if (!assessmentId) return;
    try {
      const { data } = await api.get("/marks/grid", { params: { assessment_id: assessmentId } });
      const rows: StudentRow[] = data.students || [];
      setStudents(rows);
      setMaxMarks(data.max_marks || data.assessment?.max_marks || 100);
      const d: Record<string, string> = {};
      rows.forEach((r) => {
        d[r.person_id] = r.marks_obtained != null ? String(r.marks_obtained) : "";
      });
      setDraft(d);
      const statuses = rows.map((r) => r.status).filter(Boolean);
      setGridStatus(statuses[0] || null);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to load mark grid");
    }
  }, [assessmentId]);

  useFocusEffect(useCallback(() => { loadMeta(); }, [loadMeta]));
  useEffect(() => { loadGrid(); }, [loadGrid]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMeta();
    await loadGrid();
    setRefreshing(false);
  };

  const save = async (status: "draft" | "final") => {
    if (!assessmentId) return;
    setSaving(true);
    try {
      const entries = students.map((s) => {
        const raw = draft[s.person_id]?.trim();
        return {
          person_id: s.person_id,
          marks_obtained: raw === "" ? null : Number(raw),
        };
      });
      for (const e of entries) {
        if (e.marks_obtained != null && (e.marks_obtained < 0 || e.marks_obtained > maxMarks)) {
          Alert.alert("Invalid marks", `Marks must be between 0 and ${maxMarks}`);
          setSaving(false);
          return;
        }
      }
      await api.post("/marks/batch", { assessment_id: assessmentId, entries, status });
      Alert.alert("Saved", status === "final" ? "Marks finalized." : "Draft saved.");
      setSaveStatus(status);
      loadGrid();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to save marks");
    } finally {
      setSaving(false);
    }
  };

  if (!canEnter) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.denied}>Academic marks entry is restricted to teachers and administrators.</Text>
      </SafeAreaView>
    );
  }

  const sectionOptions = [...new Map(combos.map((c) => [c.section_id, c.section_label || c.section_id])).entries()];
  const subjectOptions = sectionCombos.map((c) => ({ id: c.subject_id, name: c.subject_name || c.subject_id }));

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="marks-back">
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>Enter Marks</Text>
          <Text style={s.sub}>
            {year?.name || "—"} · max {maxMarks}
            {gridStatus ? ` · ${gridStatus}` : ""}
          </Text>
        </View>
        <TouchableOpacity testID="btn-save-draft" style={[s.saveBtn, s.draftBtn, saving && { opacity: 0.6 }]} onPress={() => save("draft")} disabled={saving}>
          <Text style={s.draftTxt}>Draft</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="btn-save-marks" style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={() => save("final")} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveTxt}>Finalize</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? <ActivityIndicator color="#1E40AF" style={{ marginTop: 24 }} /> : (
          <>
            <Text style={s.filterLabel}>Section</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
              {sectionOptions.map(([id, label]) => (
                <TouchableOpacity
                  key={id}
                  testID={`marks-section-${label}`}
                  style={[s.chip, sectionId === id && s.chipActive]}
                  onPress={() => {
                    setSectionId(id);
                    const c = combos.find((x) => x.section_id === id);
                    if (c) {
                      setSubjectId(c.subject_id);
                      setAssessmentId(c.assessments?.[0]?.id || null);
                      setMaxMarks(c.assessments?.[0]?.max_marks || 100);
                    }
                  }}
                >
                  <Text style={[s.chipTxt, sectionId === id && s.chipTxtActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.filterLabel}>Subject</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
              {subjectOptions.map((sub) => (
                <TouchableOpacity
                  key={sub.id}
                  testID={`marks-subject-${sub.name}`}
                  style={[s.chip, subjectId === sub.id && s.chipActive]}
                  onPress={() => {
                    setSubjectId(sub.id);
                    const c = combos.find((x) => x.section_id === sectionId && x.subject_id === sub.id);
                    setAssessmentId(c?.assessments?.[0]?.id || null);
                    setMaxMarks(c?.assessments?.[0]?.max_marks || 100);
                  }}
                >
                  <Text style={[s.chipTxt, subjectId === sub.id && s.chipTxtActive]}>{sub.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={s.filterLabel}>Assessment</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
              {assessments.length === 0 ? (
                <Text style={s.hint}>No assessments configured. Ask admin to create one.</Text>
              ) : assessments.map((a) => (
                <TouchableOpacity
                  key={a.id}
                  testID={`marks-assessment-${a.name}`}
                  style={[s.chip, assessmentId === a.id && s.chipActive]}
                  onPress={() => { setAssessmentId(a.id); setMaxMarks(a.max_marks); }}
                >
                  <Text style={[s.chipTxt, assessmentId === a.id && s.chipTxtActive]}>{a.name} /{a.max_marks}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {assessmentId && (
              <View style={[s.gridWrap, isWide && s.gridWide]}>
                <View style={s.gridHead}>
                  <Text style={[s.gridHeadTxt, { flex: 1 }]}>Student</Text>
                  <Text style={[s.gridHeadTxt, { width: 80, textAlign: "center" }]}>/{maxMarks}</Text>
                  <Text style={[s.gridHeadTxt, { width: 48, textAlign: "center" }]}>Grade</Text>
                </View>

                {students.length === 0 ? (
                  <Text style={s.empty}>No students in this section.</Text>
                ) : students.map((st) => (
                  <View key={st.person_id} style={[s.row, isWide && s.rowWide]} testID={`marks-row-${st.person_id}`}>
                    <Text style={s.name} numberOfLines={1}>{st.name}</Text>
                    <TextInput
                      testID={`marks-input-${st.person_id}`}
                      style={s.markInput}
                      value={draft[st.person_id] ?? ""}
                      onChangeText={(v) => setDraft((d) => ({ ...d, [st.person_id]: v.replace(/[^0-9.]/g, "") }))}
                      keyboardType="numeric"
                      placeholder="—"
                      placeholderTextColor="#94A3B8"
                      maxLength={6}
                      editable={gridStatus !== "published"}
                    />
                    <Text style={s.grade}>{st.grade || "—"}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  backBtn: { padding: 8 },
  h1: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  sub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  saveBtn: { backgroundColor: "#1E40AF", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, minWidth: 56, alignItems: "center" },
  draftBtn: { backgroundColor: "#E2E8F0" },
  saveTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  draftTxt: { color: "#1E40AF", fontWeight: "700", fontSize: 13 },
  scroll: { padding: 20, paddingBottom: 40 },
  filterLabel: { fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 6, marginTop: 8 },
  chipScroll: { flexGrow: 0, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#E2E8F0", marginRight: 8, backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  chipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  chipTxtActive: { color: "#fff" },
  hint: { fontSize: 12, color: "#64748B", paddingVertical: 8 },
  gridWrap: { marginTop: 12 },
  gridWide: { maxWidth: 720, alignSelf: "center", width: "100%" },
  gridHead: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  gridHeadTxt: { fontSize: 11, fontWeight: "800", color: "#64748B", textTransform: "uppercase" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", backgroundColor: "#fff", paddingHorizontal: 12, borderRadius: 10, marginBottom: 6 },
  rowWide: { paddingVertical: 12 },
  name: { flex: 1, fontSize: 14, fontWeight: "600", color: "#0F172A" },
  markInput: { width: 80, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, textAlign: "center", fontSize: 15, fontWeight: "700", color: "#0F172A", backgroundColor: "#F8FAFC" },
  grade: { width: 48, textAlign: "center", fontSize: 13, fontWeight: "800", color: "#1E40AF" },
  empty: { fontSize: 13, color: "#64748B", textAlign: "center", padding: 24 },
  denied: { padding: 24, color: "#64748B", textAlign: "center" },
});
