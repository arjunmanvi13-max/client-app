import { useCallback, useState, useEffect } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, useAuth, userHasPermission } from "../../../src/auth";
import { Permission } from "../../../src/rbac";
import { formatDate, DATE_PLACEHOLDER, parseToISO } from "../../../src/dateFormat";

type Tab = "years" | "structure" | "subjects" | "assignments";

const TABS: { key: Tab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "years", label: "Years", icon: "calendar" },
  { key: "structure", label: "Grades & Sections", icon: "layers" },
  { key: "subjects", label: "Subjects", icon: "book" },
  { key: "assignments", label: "Teacher Assignments", icon: "users" },
];

const STATUS_COLORS: Record<string, string> = {
  open: "#16A34A",
  closed: "#64748B",
  archived: "#94A3B8",
};

export default function AcademicAdmin() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("years");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [years, setYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const [grades, setGrades] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classAssignments, setClassAssignments] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);

  const [newYearName, setNewYearName] = useState("2026-27");
  const [newYearStart, setNewYearStart] = useState("01/04/2026");
  const [newYearEnd, setNewYearEnd] = useState("31/03/2027");
  const [gradeName, setGradeName] = useState("");
  const [sectionGradeId, setSectionGradeId] = useState<string | null>(null);
  const [sectionName, setSectionName] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [subjectGradeIds, setSubjectGradeIds] = useState<string[]>([]);
  const [subjectSectionIds, setSubjectSectionIds] = useState<string[]>([]);
  const [assignTeacherId, setAssignTeacherId] = useState<string | null>(null);
  const [assignGradeId, setAssignGradeId] = useState<string | null>(null);
  const [assignSectionId, setAssignSectionId] = useState<string | null>(null);
  const [assignSubjectId, setAssignSubjectId] = useState<string | null>(null);

  const canManage = userHasPermission(user, Permission.MANAGE_TEACHERS_MAP_SUBJECTS)
    || userHasPermission(user, Permission.MANAGE_TEACHERS_MAP_SECTIONS);

  const selectedYear = years.find((y) => y.id === selectedYearId) || years.find((y) => y.status === "open") || years[0];
  const isReadOnly = selectedYear?.status === "archived";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [yearsRes, usersRes] = await Promise.all([
        api.get("/academic/years"),
        api.get("/users/directory", { params: { role: "teacher" } }),
      ]);
      setYears(yearsRes.data);
      setTeachers(usersRes.data);
      const yid = selectedYearId || yearsRes.data.find((y: any) => y.status === "open")?.id || yearsRes.data[0]?.id;
      if (yid && !selectedYearId) setSelectedYearId(yid);
      if (yid) {
        const [g, s, sub, ca] = await Promise.all([
          api.get("/academic/grades", { params: { academic_year_id: yid } }),
          api.get("/academic/sections", { params: { academic_year_id: yid } }),
          api.get("/academic/subjects", { params: { academic_year_id: yid } }),
          api.get("/academic/class-assignments", { params: { academic_year_id: yid } }),
        ]);
        setGrades(g.data);
        setSections(s.data);
        setSubjects(sub.data);
        setClassAssignments(ca.data);
        if (g.data[0] && !sectionGradeId) setSectionGradeId(g.data[0].id);
        if (g.data[0] && !assignGradeId) setAssignGradeId(g.data[0].id);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to load academic data");
    } finally {
      setLoading(false);
    }
  }, [selectedYearId, sectionGradeId, assignGradeId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (selectedYearId) load();
  }, [selectedYearId]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const createYear = async () => {
    if (!newYearName.trim()) return;
    try {
      await api.post("/academic/years", {
        name: newYearName.trim(),
        start_date: parseToISO(newYearStart) || newYearStart,
        end_date: parseToISO(newYearEnd) || newYearEnd,
        entity_id: "pws",
      });
      setNewYearName("");
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to create year");
    }
  };

  const setYearStatus = async (yearId: string, status: string) => {
    try {
      await api.patch(`/academic/years/${yearId}/status`, { status });
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to update year status");
    }
  };

  const addGrade = async () => {
    if (!gradeName.trim() || !selectedYear || isReadOnly) return;
    try {
      await api.post("/academic/grades", {
        academic_year_id: selectedYear.id,
        name: gradeName.trim(),
        entity_id: "pws",
      });
      setGradeName("");
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to add grade");
    }
  };

  const addSection = async () => {
    if (!sectionName.trim() || !sectionGradeId || !selectedYear || isReadOnly) return;
    try {
      await api.post("/academic/sections", {
        academic_year_id: selectedYear.id,
        grade_id: sectionGradeId,
        name: sectionName.trim(),
        entity_id: "pws",
      });
      setSectionName("");
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to add section");
    }
  };

  const addSubject = async () => {
    if (!subjectName.trim() || !selectedYear || isReadOnly) return;
    try {
      await api.post("/academic/subjects", {
        academic_year_id: selectedYear.id,
        name: subjectName.trim(),
        grade_ids: subjectGradeIds,
        section_ids: subjectSectionIds,
        entity_id: "pws",
      });
      setSubjectName("");
      setSubjectGradeIds([]);
      setSubjectSectionIds([]);
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to add subject");
    }
  };

  const assignClass = async () => {
    if (!assignTeacherId || !assignGradeId || !assignSectionId || !assignSubjectId || !selectedYear || isReadOnly) return;
    try {
      await api.post("/academic/class-assignments", {
        teacher_user_id: assignTeacherId,
        academic_year_id: selectedYear.id,
        grade_id: assignGradeId,
        section_id: assignSectionId,
        subject_id: assignSubjectId,
      });
      setAssignTeacherId(null);
      setAssignSubjectId(null);
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to assign teacher");
    }
  };

  const removeAssignment = async (id: string) => {
    try {
      await api.delete(`/academic/class-assignments/${id}`);
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to remove assignment");
    }
  };

  const toggleChip = (list: string[], id: string, setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  if (!canManage) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.denied}>Academic structure management is restricted to school administrators.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="academic-back">
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>Academic Structure</Text>
          <Text style={s.sub}>PWS — years, grades, sections, subjects & teacher assignments</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll} contentContainerStyle={s.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            testID={`tab-${t.key}`}
            style={[s.tab, tab === t.key && s.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Feather name={t.icon} size={14} color={tab === t.key ? "#fff" : "#475569"} />
            <Text style={[s.tabTxt, tab === t.key && s.tabTxtActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {selectedYear && (
        <View style={s.yearBar}>
          <Text style={s.yearBarTxt}>
            {selectedYear.name} · <Text style={{ color: STATUS_COLORS[selectedYear.status] || "#64748B", fontWeight: "800" }}>{selectedYear.status}</Text>
            {isReadOnly ? " · read-only" : ""}
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? <ActivityIndicator color="#1E40AF" style={{ marginTop: 24 }} /> : (
          <>
            {tab === "years" && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Academic years</Text>
                {years.map((y) => (
                  <View key={y.id} style={s.yearRow} testID={`year-${y.id}`}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => setSelectedYearId(y.id)}>
                      <Text style={[s.yearName, selectedYearId === y.id && { color: "#1E40AF" }]}>{y.name}</Text>
                      <Text style={s.yearMeta}>{formatDate(y.start_date)} → {formatDate(y.end_date)}</Text>
                    </TouchableOpacity>
                    <View style={[s.statusPill, { backgroundColor: (STATUS_COLORS[y.status] || "#64748B") + "22" }]}>
                      <Text style={[s.statusPillTxt, { color: STATUS_COLORS[y.status] }]}>{y.status}</Text>
                    </View>
                    {y.status !== "archived" && (
                      <View style={s.statusActions}>
                        {y.status !== "open" && (
                          <TouchableOpacity testID={`open-year-${y.id}`} onPress={() => setYearStatus(y.id, "open")} style={s.miniBtn}>
                            <Text style={s.miniBtnTxt}>Open</Text>
                          </TouchableOpacity>
                        )}
                        {y.status === "open" && (
                          <TouchableOpacity testID={`close-year-${y.id}`} onPress={() => setYearStatus(y.id, "closed")} style={s.miniBtn}>
                            <Text style={s.miniBtnTxt}>Close</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity testID={`archive-year-${y.id}`} onPress={() => setYearStatus(y.id, "archived")} style={[s.miniBtn, { backgroundColor: "#F1F5F9" }]}>
                          <Text style={[s.miniBtnTxt, { color: "#64748B" }]}>Archive</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
                <Text style={[s.cardTitle, { marginTop: 16 }]}>Create academic year</Text>
                <TextInput value={newYearName} onChangeText={setNewYearName} placeholder="e.g. 2026-27" style={s.input} placeholderTextColor="#94A3B8" />
                <View style={s.row}>
                  <TextInput value={newYearStart} onChangeText={setNewYearStart} placeholder={`Start ${DATE_PLACEHOLDER}`} style={s.input} placeholderTextColor="#94A3B8" />
                  <TextInput value={newYearEnd} onChangeText={setNewYearEnd} placeholder={`End ${DATE_PLACEHOLDER}`} style={s.input} placeholderTextColor="#94A3B8" />
                </View>
                <TouchableOpacity testID="btn-create-year" style={s.btn} onPress={createYear}>
                  <Text style={s.btnTxt}>Create year</Text>
                </TouchableOpacity>
              </View>
            )}

            {tab === "structure" && (
              <>
                <View style={s.card}>
                  <Text style={s.cardTitle}>Grades</Text>
                  {!isReadOnly && (
                    <View style={s.row}>
                      <TextInput testID="input-grade" value={gradeName} onChangeText={setGradeName} placeholder="e.g. 9" style={s.input} placeholderTextColor="#94A3B8" />
                      <TouchableOpacity testID="btn-add-grade" style={s.btn} onPress={addGrade}><Text style={s.btnTxt}>Add</Text></TouchableOpacity>
                    </View>
                  )}
                  <Text style={s.hint}>{grades.map((g) => `Grade ${g.name}`).join(", ") || "No grades yet"}</Text>
                </View>
                <View style={s.card}>
                  <Text style={s.cardTitle}>Sections</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                    {grades.map((g) => (
                      <TouchableOpacity key={g.id} style={[s.chip, sectionGradeId === g.id && s.chipActive]} onPress={() => setSectionGradeId(g.id)}>
                        <Text style={[s.chipTxt, sectionGradeId === g.id && s.chipTxtActive]}>Grade {g.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {!isReadOnly && (
                    <View style={s.row}>
                      <TextInput testID="input-section" value={sectionName} onChangeText={setSectionName} placeholder="Section e.g. A" style={s.input} placeholderTextColor="#94A3B8" autoCapitalize="characters" />
                      <TouchableOpacity testID="btn-add-section" style={s.btn} onPress={addSection}><Text style={s.btnTxt}>Add</Text></TouchableOpacity>
                    </View>
                  )}
                  <Text style={s.hint}>{sections.map((x) => x.label).join(", ") || "No sections yet"}</Text>
                </View>
              </>
            )}

            {tab === "subjects" && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Subjects</Text>
                <Text style={s.label}>Assign to grades (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                  {grades.map((g) => (
                    <TouchableOpacity key={g.id} style={[s.chip, subjectGradeIds.includes(g.id) && s.chipActive]} onPress={() => toggleChip(subjectGradeIds, g.id, setSubjectGradeIds)}>
                      <Text style={[s.chipTxt, subjectGradeIds.includes(g.id) && s.chipTxtActive]}>Grade {g.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <Text style={s.label}>Assign to sections (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                  {sections.map((sec) => (
                    <TouchableOpacity key={sec.id} style={[s.chip, subjectSectionIds.includes(sec.id) && s.chipActive]} onPress={() => toggleChip(subjectSectionIds, sec.id, setSubjectSectionIds)}>
                      <Text style={[s.chipTxt, subjectSectionIds.includes(sec.id) && s.chipTxtActive]}>{sec.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {!isReadOnly && (
                  <View style={s.row}>
                    <TextInput testID="input-subject" value={subjectName} onChangeText={setSubjectName} placeholder="e.g. Mathematics" style={s.input} placeholderTextColor="#94A3B8" />
                    <TouchableOpacity testID="btn-add-subject" style={s.btn} onPress={addSubject}><Text style={s.btnTxt}>Add</Text></TouchableOpacity>
                  </View>
                )}
                {subjects.map((sub) => (
                  <View key={sub.id} style={s.subjectRow}>
                    <Text style={s.subjectName}>{sub.name} ({sub.code})</Text>
                    <Text style={s.subjectMeta}>
                      Grades: {(sub.grade_ids || []).map((gid: string) => grades.find((g) => g.id === gid)?.name).filter(Boolean).join(", ") || "all"}
                      {" · "}Sections: {(sub.section_ids || []).map((sid: string) => sections.find((x) => x.id === sid)?.label).filter(Boolean).join(", ") || "all"}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {tab === "assignments" && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Teacher · year · grade · section · subject</Text>
                {!isReadOnly && (
                  <>
                    <Text style={s.label}>Teacher</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                      {teachers.map((t) => (
                        <TouchableOpacity key={t.id} style={[s.chip, assignTeacherId === t.id && s.chipActive]} onPress={() => setAssignTeacherId(t.id)}>
                          <Text style={[s.chipTxt, assignTeacherId === t.id && s.chipTxtActive]}>{t.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <Text style={s.label}>Grade</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                      {grades.map((g) => (
                        <TouchableOpacity key={g.id} style={[s.chip, assignGradeId === g.id && s.chipActive]} onPress={() => { setAssignGradeId(g.id); setAssignSectionId(null); }}>
                          <Text style={[s.chipTxt, assignGradeId === g.id && s.chipTxtActive]}>Grade {g.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <Text style={s.label}>Section</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                      {sections.filter((sec) => !assignGradeId || sec.grade_id === assignGradeId).map((sec) => (
                        <TouchableOpacity key={sec.id} style={[s.chip, assignSectionId === sec.id && s.chipActive]} onPress={() => setAssignSectionId(sec.id)}>
                          <Text style={[s.chipTxt, assignSectionId === sec.id && s.chipTxtActive]}>{sec.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <Text style={s.label}>Subject</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                      {subjects.map((sub) => (
                        <TouchableOpacity key={sub.id} style={[s.chip, assignSubjectId === sub.id && s.chipActive]} onPress={() => setAssignSubjectId(sub.id)}>
                          <Text style={[s.chipTxt, assignSubjectId === sub.id && s.chipTxtActive]}>{sub.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <TouchableOpacity testID="btn-assign-class" style={[s.btn, { alignSelf: "flex-start", marginTop: 10 }]} onPress={assignClass}>
                      <Text style={s.btnTxt}>Assign</Text>
                    </TouchableOpacity>
                  </>
                )}
                {classAssignments.length === 0 ? (
                  <Text style={s.hint}>No class assignments yet.</Text>
                ) : classAssignments.map((a) => (
                  <View key={a.id} style={s.assignRow} testID={`class-assignment-${a.id}`}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.assignName}>{a.teacher?.name}</Text>
                      <Text style={s.assignMeta}>
                        {a.section?.label} · {a.subject?.name} · Grade {a.grade?.name || a.grade_id?.slice(0, 6)}
                      </Text>
                    </View>
                    {!isReadOnly && (
                      <TouchableOpacity onPress={() => removeAssignment(a.id)}>
                        <Feather name="trash-2" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
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
  tabScroll: { maxHeight: 48, marginTop: 8 },
  tabRow: { paddingHorizontal: 16, gap: 8 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#fff" },
  tabActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  tabTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  tabTxtActive: { color: "#fff" },
  yearBar: { paddingHorizontal: 20, paddingVertical: 8, backgroundColor: "#EEF2FF" },
  yearBarTxt: { fontSize: 12, fontWeight: "700", color: "#1E40AF" },
  scroll: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#0F172A", backgroundColor: "#F8FAFC", marginBottom: 8 },
  btn: { backgroundColor: "#1E40AF", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  btnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
  hint: { fontSize: 12, color: "#64748B", marginTop: 8 },
  label: { fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 6, marginTop: 4 },
  chipScroll: { flexGrow: 0, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#E2E8F0", marginRight: 8, backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  chipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  chipTxtActive: { color: "#fff" },
  yearRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  yearName: { fontSize: 15, fontWeight: "700", color: "#0F172A" },
  yearMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusPillTxt: { fontSize: 11, fontWeight: "800", textTransform: "capitalize" },
  statusActions: { flexDirection: "row", gap: 4 },
  miniBtn: { backgroundColor: "#DBEAFE", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  miniBtnTxt: { fontSize: 10, fontWeight: "800", color: "#1E40AF" },
  subjectRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  subjectName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  subjectMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  assignRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  assignName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  assignMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  denied: { padding: 24, color: "#64748B", textAlign: "center" },
});
