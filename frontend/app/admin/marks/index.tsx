import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, useAuth } from "../../../src/auth";

type Tab = "terms" | "assessments" | "grading" | "publish";

const TABS: { key: Tab; label: string }[] = [
  { key: "terms", label: "Exam terms" },
  { key: "assessments", label: "Assessments" },
  { key: "grading", label: "Grading scales" },
  { key: "publish", label: "Publish" },
];

export default function MarksAdmin() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("terms");
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<any>(null);
  const [terms, setTerms] = useState<any[]>([]);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [scales, setScales] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  const [termName, setTermName] = useState("Term 2");
  const [asmName, setAsmName] = useState("Unit Test 2");
  const [asmMax, setAsmMax] = useState("50");
  const [asmTermId, setAsmTermId] = useState<string | null>(null);
  const [asmSectionId, setAsmSectionId] = useState<string | null>(null);
  const [asmSubjectId, setAsmSubjectId] = useState<string | null>(null);
  const [scaleName, setScaleName] = useState("CBSE-style");
  const [publishAsmId, setPublishAsmId] = useState<string | null>(null);

  const canManage = user?.role === "super_admin" || user?.permissions?.manage_academic_structure
    || user?.role === "principal" || user?.role === "vice_principal";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const yearsRes = await api.get("/academic/years");
      const openYear = yearsRes.data.find((y: any) => y.status === "open") || yearsRes.data[0];
      setYear(openYear);
      if (openYear) {
        const [t, a, g, sec, sub] = await Promise.all([
          api.get("/marks/exam-terms", { params: { academic_year_id: openYear.id } }),
          api.get("/marks/assessments", { params: { academic_year_id: openYear.id } }),
          api.get("/marks/grading-scales", { params: { academic_year_id: openYear.id } }),
          api.get("/academic/sections", { params: { academic_year_id: openYear.id } }),
          api.get("/academic/subjects", { params: { academic_year_id: openYear.id } }),
        ]);
        setTerms(t.data);
        setAssessments(a.data);
        setScales(g.data);
        setSections(sec.data);
        setSubjects(sub.data);
        if (!asmTermId && t.data[0]) setAsmTermId(t.data[0].id);
        if (!asmSectionId && sec.data[0]) setAsmSectionId(sec.data[0].id);
        if (!asmSubjectId && sub.data[0]) setAsmSubjectId(sub.data[0].id);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [asmTermId, asmSectionId, asmSubjectId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const createTerm = async () => {
    if (!year || !termName.trim()) return;
    try {
      await api.post("/marks/exam-terms", { academic_year_id: year.id, name: termName.trim() });
      setTermName("");
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed");
    }
  };

  const createAssessment = async () => {
    if (!year || !asmTermId || !asmSectionId || !asmSubjectId) return;
    try {
      await api.post("/marks/assessments", {
        academic_year_id: year.id,
        exam_term_id: asmTermId,
        section_id: asmSectionId,
        subject_id: asmSubjectId,
        name: asmName.trim(),
        max_marks: Number(asmMax) || 100,
      });
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed");
    }
  };

  const createScale = async () => {
    if (!year) return;
    try {
      await api.post("/marks/grading-scales", {
        academic_year_id: year.id,
        name: scaleName,
        is_default: scales.length === 0,
        bands: [
          { min: 91, max: 100, grade: "A1", description: "Outstanding" },
          { min: 81, max: 90, grade: "A2", description: "Excellent" },
          { min: 71, max: 80, grade: "B1", description: "Very Good" },
          { min: 61, max: 70, grade: "B2", description: "Good" },
          { min: 51, max: 60, grade: "C1", description: "Average" },
          { min: 41, max: 50, grade: "C2", description: "Below Average" },
          { min: 33, max: 40, grade: "D", description: "Pass" },
          { min: 0, max: 32, grade: "E", description: "Needs Improvement" },
        ],
      });
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed");
    }
  };

  const publish = async () => {
    if (!publishAsmId) return;
    try {
      const r = await api.post("/marks/publish", { assessment_id: publishAsmId });
      Alert.alert("Published", `${r.data.published} mark records published.`);
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed");
    }
  };

  if (!canManage) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.denied}>Marks configuration requires academic structure management.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>Marks & Assessment</Text>
          <Text style={s.sub}>{year?.name || "—"} · exam terms, assessments, grading</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={[s.tab, tab === t.key && s.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[s.tabTxt, tab === t.key && s.tabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        {loading ? <ActivityIndicator color="#1E40AF" /> : (
          <>
            {tab === "terms" && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Exam terms</Text>
                {terms.map((t) => (
                  <Text key={t.id} style={s.rowTxt}>{t.name} {t.is_active ? "· active" : ""}</Text>
                ))}
                <TextInput value={termName} onChangeText={setTermName} placeholder="Term name" style={s.input} placeholderTextColor="#94A3B8" />
                <TouchableOpacity style={s.btn} onPress={createTerm}><Text style={s.btnTxt}>Add term</Text></TouchableOpacity>
              </View>
            )}

            {tab === "assessments" && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Assessments</Text>
                {assessments.map((a) => (
                  <Text key={a.id} style={s.rowTxt}>
                    {a.name} · {a.section?.label} · {a.subject?.name} · /{a.max_marks}
                  </Text>
                ))}
                <TextInput value={asmName} onChangeText={setAsmName} placeholder="Assessment name" style={s.input} placeholderTextColor="#94A3B8" />
                <TextInput value={asmMax} onChangeText={setAsmMax} placeholder="Max marks" keyboardType="numeric" style={s.input} placeholderTextColor="#94A3B8" />
                <ScrollView horizontal style={s.chipScroll}>
                  {terms.map((t) => (
                    <TouchableOpacity key={t.id} style={[s.chip, asmTermId === t.id && s.chipOn]} onPress={() => setAsmTermId(t.id)}>
                      <Text style={[s.chipTxt, asmTermId === t.id && s.chipTxtOn]}>{t.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <ScrollView horizontal style={s.chipScroll}>
                  {sections.map((sec) => (
                    <TouchableOpacity key={sec.id} style={[s.chip, asmSectionId === sec.id && s.chipOn]} onPress={() => setAsmSectionId(sec.id)}>
                      <Text style={[s.chipTxt, asmSectionId === sec.id && s.chipTxtOn]}>{sec.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <ScrollView horizontal style={s.chipScroll}>
                  {subjects.map((sub) => (
                    <TouchableOpacity key={sub.id} style={[s.chip, asmSubjectId === sub.id && s.chipOn]} onPress={() => setAsmSubjectId(sub.id)}>
                      <Text style={[s.chipTxt, asmSubjectId === sub.id && s.chipTxtOn]}>{sub.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={s.btn} onPress={createAssessment}><Text style={s.btnTxt}>Create assessment</Text></TouchableOpacity>
              </View>
            )}

            {tab === "grading" && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Grading scales</Text>
                {scales.map((g) => (
                  <Text key={g.id} style={s.rowTxt}>{g.name} {g.is_default ? "· default" : ""} · {g.bands?.length || 0} bands</Text>
                ))}
                <TextInput value={scaleName} onChangeText={setScaleName} placeholder="Scale name" style={s.input} placeholderTextColor="#94A3B8" />
                <TouchableOpacity style={s.btn} onPress={createScale}><Text style={s.btnTxt}>Add CBSE-style scale</Text></TouchableOpacity>
              </View>
            )}

            {tab === "publish" && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Publish finalized marks</Text>
                <Text style={s.hint}>Only marks saved as final will be published to students and parents.</Text>
                <ScrollView horizontal style={s.chipScroll}>
                  {assessments.map((a) => (
                    <TouchableOpacity key={a.id} style={[s.chip, publishAsmId === a.id && s.chipOn]} onPress={() => setPublishAsmId(a.id)}>
                      <Text style={[s.chipTxt, publishAsmId === a.id && s.chipTxtOn]}>{a.section?.label} · {a.subject?.name} · {a.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={s.btn} onPress={publish}><Text style={s.btnTxt}>Publish assessment</Text></TouchableOpacity>
              </View>
            )}
          </>
        )}
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
  tabRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  tabActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  tabTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  tabTxtActive: { color: "#fff" },
  scroll: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A", marginBottom: 8 },
  rowTxt: { fontSize: 13, color: "#475569", paddingVertical: 4 },
  input: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0F172A", backgroundColor: "#F8FAFC", marginBottom: 8 },
  btn: { backgroundColor: "#1E40AF", paddingVertical: 12, borderRadius: 10, alignItems: "center", marginTop: 8 },
  btnTxt: { color: "#fff", fontWeight: "700" },
  chipScroll: { flexGrow: 0, marginBottom: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: "#E2E8F0", marginRight: 6, backgroundColor: "#fff" },
  chipOn: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  chipTxt: { fontSize: 11, fontWeight: "700", color: "#475569" },
  chipTxtOn: { color: "#fff" },
  hint: { fontSize: 12, color: "#64748B", marginBottom: 8 },
  denied: { padding: 24, textAlign: "center", color: "#64748B" },
});
