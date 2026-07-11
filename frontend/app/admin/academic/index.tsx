import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, useAuth } from "../../src/auth";

type Section = { id: string; label: string; grade_name: string };
type Assignment = {
  id: string;
  teacher_user_id: string;
  section_id: string;
  section?: { label: string };
  teacher?: { name: string; email: string };
};

export default function AcademicAdmin() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [year, setYear] = useState<any>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [grades, setGrades] = useState<any[]>([]);

  const [gradeName, setGradeName] = useState("");
  const [sectionGradeId, setSectionGradeId] = useState<string | null>(null);
  const [sectionName, setSectionName] = useState("");
  const [assignTeacherId, setAssignTeacherId] = useState<string | null>(null);
  const [assignSectionId, setAssignSectionId] = useState<string | null>(null);

  const canManage = user?.role === "super_admin" || user?.permissions?.manage_academic_structure
    || user?.role === "principal" || user?.role === "vice_principal";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [yearsRes, sectionsRes, assignRes, usersRes] = await Promise.all([
        api.get("/academic/years"),
        api.get("/academic/sections"),
        api.get("/academic/teacher-assignments"),
        api.get("/users", { params: { role: "teacher" } }),
      ]);
      const openYear = yearsRes.data.find((y: any) => y.status === "open") || yearsRes.data[0];
      setYear(openYear || null);
      setSections(sectionsRes.data);
      setAssignments(assignRes.data);
      setTeachers(usersRes.data);
      if (openYear) {
        const g = await api.get("/academic/grades", { params: { academic_year_id: openYear.id } });
        setGrades(g.data);
        if (g.data[0] && !sectionGradeId) setSectionGradeId(g.data[0].id);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to load academic data");
    } finally {
      setLoading(false);
    }
  }, [sectionGradeId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const ensureYear = async () => {
    if (year) return year;
    const { data } = await api.post("/academic/years", {
      name: "2025-26",
      start_date: "2025-04-01",
      end_date: "2026-03-31",
      entity_id: "pws",
    });
    setYear(data);
    return data;
  };

  const addGrade = async () => {
    if (!gradeName.trim()) return;
    try {
      const y = await ensureYear();
      await api.post("/academic/grades", {
        academic_year_id: y.id,
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
    if (!sectionName.trim() || !sectionGradeId || !year) return;
    try {
      await api.post("/academic/sections", {
        academic_year_id: year.id,
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

  const assignTeacher = async () => {
    if (!assignTeacherId || !assignSectionId) return;
    try {
      await api.post("/academic/teacher-assignments", {
        teacher_user_id: assignTeacherId,
        section_id: assignSectionId,
        academic_year_id: year?.id,
      });
      setAssignTeacherId(null);
      setAssignSectionId(null);
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to assign teacher");
    }
  };

  const removeAssignment = async (id: string) => {
    try {
      await api.delete(`/academic/teacher-assignments/${id}`);
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to remove assignment");
    }
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
          <Text style={s.sub}>Grades, sections & teacher assignments (PWS)</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? <ActivityIndicator color="#1E40AF" style={{ marginTop: 24 }} /> : (
          <>
            <View style={s.card}>
              <Text style={s.cardTitle}>Academic year</Text>
              <Text style={s.cardMeta}>{year ? `${year.name} (${year.status})` : "No year — add a grade to create one"}</Text>
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Add grade</Text>
              <View style={s.row}>
                <TextInput
                  testID="input-grade"
                  value={gradeName}
                  onChangeText={setGradeName}
                  placeholder="e.g. 9"
                  style={s.input}
                  placeholderTextColor="#94A3B8"
                />
                <TouchableOpacity testID="btn-add-grade" style={s.btn} onPress={addGrade}>
                  <Text style={s.btnTxt}>Add</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.hint}>Grades: {grades.map((g) => g.name).join(", ") || "—"}</Text>
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Add section</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                {grades.map((g) => (
                  <TouchableOpacity
                    key={g.id}
                    testID={`grade-chip-${g.name}`}
                    style={[s.chip, sectionGradeId === g.id && s.chipActive]}
                    onPress={() => setSectionGradeId(g.id)}
                  >
                    <Text style={[s.chipTxt, sectionGradeId === g.id && s.chipTxtActive]}>Grade {g.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={s.row}>
                <TextInput
                  testID="input-section"
                  value={sectionName}
                  onChangeText={setSectionName}
                  placeholder="Section letter e.g. A"
                  style={s.input}
                  placeholderTextColor="#94A3B8"
                  autoCapitalize="characters"
                />
                <TouchableOpacity testID="btn-add-section" style={s.btn} onPress={addSection}>
                  <Text style={s.btnTxt}>Add</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.hint}>{sections.length} section(s): {sections.map((x) => x.label).join(", ") || "—"}</Text>
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Assign teacher to section</Text>
              <Text style={s.label}>Teacher</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                {teachers.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    testID={`teacher-chip-${t.id}`}
                    style={[s.chip, assignTeacherId === t.id && s.chipActive]}
                    onPress={() => setAssignTeacherId(t.id)}
                  >
                    <Text style={[s.chipTxt, assignTeacherId === t.id && s.chipTxtActive]}>{t.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={[s.label, { marginTop: 10 }]}>Section</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                {sections.map((sec) => (
                  <TouchableOpacity
                    key={sec.id}
                    testID={`section-chip-${sec.label}`}
                    style={[s.chip, assignSectionId === sec.id && s.chipActive]}
                    onPress={() => setAssignSectionId(sec.id)}
                  >
                    <Text style={[s.chipTxt, assignSectionId === sec.id && s.chipTxtActive]}>{sec.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity testID="btn-assign-teacher" style={[s.btn, { alignSelf: "flex-start", marginTop: 10 }]} onPress={assignTeacher}>
                <Text style={s.btnTxt}>Assign</Text>
              </TouchableOpacity>
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Current assignments</Text>
              {assignments.length === 0 ? (
                <Text style={s.hint}>No teacher-section assignments yet.</Text>
              ) : assignments.map((a) => (
                <View key={a.id} style={s.assignRow} testID={`assignment-${a.id}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.assignName}>{a.teacher?.name || a.teacher_user_id}</Text>
                    <Text style={s.assignMeta}>{a.section?.label || a.section_id}</Text>
                  </View>
                  <TouchableOpacity testID={`remove-assignment-${a.id}`} onPress={() => removeAssignment(a.id)}>
                    <Feather name="trash-2" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
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
  scroll: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A", marginBottom: 8 },
  cardMeta: { fontSize: 13, color: "#64748B" },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#0F172A", backgroundColor: "#F8FAFC" },
  btn: { backgroundColor: "#1E40AF", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  btnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
  hint: { fontSize: 12, color: "#64748B", marginTop: 8 },
  label: { fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 6 },
  chipScroll: { flexGrow: 0, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#E2E8F0", marginRight: 8, backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  chipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  chipTxtActive: { color: "#fff" },
  assignRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  assignName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  assignMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  denied: { padding: 24, color: "#64748B", textAlign: "center" },
});
