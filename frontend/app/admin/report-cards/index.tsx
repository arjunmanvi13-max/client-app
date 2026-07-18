import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, useAuth, userHasPermission } from "../../../src/auth";
import { BusinessEntity, Permission, UserRole, normalizeRole } from "../../../src/rbac";

type Tab = "teacher" | "review" | "list";

export default function ReportCardsAdmin() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("teacher");
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<any[]>([]);
  const [terms, setTerms] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [termId, setTermId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [remark, setRemark] = useState("");
  const [coachRemark, setCoachRemark] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selected, setSelected] = useState<any | null>(null);

  const isAdmin = userHasPermission(user, Permission.MANAGE_TEACHERS_MAP_SUBJECTS, BusinessEntity.PWS)
    || userHasPermission(user, Permission.MANAGE_TEACHERS_MAP_SECTIONS, BusinessEntity.PWS);
  const isTeacher = normalizeRole(user?.role || "") === UserRole.PWS_TEACHER || isAdmin;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const yearsRes = await api.get("/academic/years");
      const openYear = yearsRes.data.find((y: any) => y.status === "open") || yearsRes.data[0];
      if (!openYear) return;
      const listParams: Record<string, string> = {};
      if (tab === "review") listParams.status = "review";
      if (tab === "list" && statusFilter) listParams.status = statusFilter;
      if (tab === "list" && search.trim()) listParams.search = search.trim();
      const [tRes, cRes] = await Promise.all([
        api.get("/marks/exam-terms", { params: { academic_year_id: openYear.id } }),
        api.get("/report-cards", { params: listParams }),
      ]);
      setTerms(tRes.data);
      setCards(cRes.data);
      if (!termId && tRes.data[0]) setTermId(tRes.data[0].id);

      if (isAdmin) {
        const secRes = await api.get("/academic/sections", { params: { academic_year_id: openYear.id } });
        const nineA = secRes.data.find((s: any) => s.label === "9-A") || secRes.data[0];
        if (nineA) {
          const stRes = await api.get("/people", { params: { kind: "student", section_id: nineA.id } });
          setStudents(stRes.data);
          if (!studentId && stRes.data[0]) setStudentId(stRes.data[0].id);
        }
      } else if (user?.role === "teacher") {
        const combos = await api.get("/marks/my-combinations");
        const sectionIds = [...new Set((combos.data.combinations || []).map((c: any) => c.section_id))];
        const all: any[] = [];
        for (const sid of sectionIds) {
          const stRes = await api.get("/people", { params: { kind: "student", section_id: sid } });
          all.push(...stRes.data);
        }
        setStudents(all);
        if (!studentId && all[0]) setStudentId(all[0].id);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to load report cards");
    } finally {
      setLoading(false);
    }
  }, [tab, termId, studentId, isAdmin, user?.role, search, statusFilter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const buildCard = async () => {
    if (!studentId || !termId) return;
    try {
      const { data } = await api.post("/report-cards/build", { person_id: studentId, exam_term_id: termId });
      setSelected(data);
      setRemark(data.teacher_remark || "");
      Alert.alert("Built", "Report card refreshed from saved marks and attendance.");
      router.push(`/admin/report-cards/${data.id}`);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Build failed");
    }
  };

  const saveRemark = async () => {
    if (!selected?.id) return;
    try {
      await api.patch(`/report-cards/${selected.id}/teacher-remark`, { teacher_remark: remark });
      await api.post(`/report-cards/${selected.id}/submit`);
      Alert.alert("Submitted", "Report card sent for admin review.");
      setSelected(null);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Submit failed");
    }
  };

  const publish = async (card: any) => {
    try {
      await api.post(`/report-cards/${card.id}/publish`, {
        coach_remark: card.has_alpha_participation ? (coachRemark || card.suggested_coach_remark || card.approved_coach_remark) : undefined,
      });
      Alert.alert("Published", "Parents can now view this report card.");
      setCoachRemark("");
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Publish failed");
    }
  };

  const openCard = async (card: any) => {
    router.push(`/report-cards/${card.id}`);
  };

  const teacherCards = cards.filter((c) => c.status === "draft" || c.status === "review");
  const reviewCards = cards.filter((c) => c.status === "review");

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>ACADEMIC</Text>
          <Text style={s.h1}>Report Cards</Text>
        </View>
      </View>

      <View style={s.tabs}>
        {isTeacher && (
          <TouchableOpacity style={[s.tab, tab === "teacher" && s.tabOn]} onPress={() => setTab("teacher")}>
            <Text style={[s.tabTxt, tab === "teacher" && s.tabTxtOn]}>Teacher remarks</Text>
          </TouchableOpacity>
        )}
        {isAdmin && (
          <TouchableOpacity style={[s.tab, tab === "list" && s.tabOn]} onPress={() => setTab("list")}>
            <Text style={[s.tabTxt, tab === "list" && s.tabTxtOn]}>All report cards</Text>
          </TouchableOpacity>
        )}
        {isAdmin && (
          <TouchableOpacity style={[s.tab, tab === "review" && s.tabOn]} onPress={() => setTab("review")}>
            <Text style={[s.tabTxt, tab === "review" && s.tabTxtOn]}>Review & publish</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator color="#1E40AF" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
          {tab === "teacher" && isTeacher && (
            <>
              <Text style={s.section}>Build from saved data</Text>
              <View style={s.row}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                  {students.map((st) => (
                    <TouchableOpacity
                      key={st.id}
                      style={[s.chip, studentId === st.id && s.chipOn]}
                      onPress={() => setStudentId(st.id)}
                    >
                      <Text style={[s.chipTxt, studentId === st.id && s.chipTxtOn]}>{st.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={s.row}>
                {terms.map((t) => (
                  <TouchableOpacity key={t.id} style={[s.chip, termId === t.id && s.chipOn]} onPress={() => setTermId(t.id)}>
                    <Text style={[s.chipTxt, termId === t.id && s.chipTxtOn]}>{t.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={s.primaryBtn} onPress={buildCard}>
                <Feather name="refresh-cw" size={16} color="#fff" />
                <Text style={s.primaryBtnTxt}>Build / refresh report card</Text>
              </TouchableOpacity>

              {selected && (
                <View style={s.card}>
                  <Text style={s.cardTitle}>{selected.person_name} · {selected.exam_term_name}</Text>
                  <Text style={s.meta}>
                    {selected.percentage != null ? `${selected.percentage}% · ${selected.overall_grade}` : ""}
                    {selected.attendance_pct != null ? ` · Attendance ${selected.attendance_pct}%` : ""}
                  </Text>
                  <TextInput
                    style={s.input}
                    multiline
                    placeholder="Class teacher remark"
                    value={remark}
                    onChangeText={setRemark}
                  />
                  <TouchableOpacity style={s.primaryBtn} onPress={saveRemark}>
                    <Text style={s.primaryBtnTxt}>Save remark & submit for review</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={s.section}>Your report cards</Text>
              {teacherCards.length === 0 ? (
                <Text style={s.empty}>No draft or review cards yet.</Text>
              ) : teacherCards.map((c) => (
                <TouchableOpacity key={c.id} style={s.listRow} onPress={() => { setSelected(c); setRemark(c.teacher_remark || ""); }}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>{c.person_name}</Text>
                    <Text style={s.meta}>{c.exam_term_name} · {c.status}</Text>
                  </View>
                  <TouchableOpacity onPress={() => openCard(c)}><Feather name="eye" size={18} color="#1E40AF" /></TouchableOpacity>
                </TouchableOpacity>
              ))}
            </>
          )}

          {tab === "list" && isAdmin && (
            <>
              <TextInput
                style={s.search}
                placeholder="Search student, admission no., term…"
                value={search}
                onChangeText={setSearch}
                onSubmitEditing={load}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.row}>
                {["", "draft", "review", "finalized", "published"].map((st) => (
                  <TouchableOpacity
                    key={st || "all"}
                    style={[s.chip, statusFilter === st && s.chipOn]}
                    onPress={() => { setStatusFilter(st); }}
                  >
                    <Text style={[s.chipTxt, statusFilter === st && s.chipTxtOn]}>{st || "All"}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={s.secondaryBtn} onPress={load}>
                <Text style={s.secondaryBtnTxt}>Apply filters</Text>
              </TouchableOpacity>
              {cards.length === 0 ? (
                <Text style={s.empty}>No report cards match your filters.</Text>
              ) : cards.map((c) => (
                <TouchableOpacity key={c.id} style={s.listRow} onPress={() => router.push(`/admin/report-cards/${c.id}`)}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>{c.person_name}</Text>
                    <Text style={s.meta}>
                      {c.exam_term_name} · {c.academic_year_name} · {c.status}
                      {c.percentage != null ? ` · ${c.percentage}%` : ""}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => openCard(c)}>
                    <Feather name="eye" size={18} color="#1E40AF" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </>
          )}

          {tab === "review" && isAdmin && (
            <>
              <Text style={s.section}>Awaiting publication</Text>
              {reviewCards.length === 0 ? (
                <Text style={s.empty}>No cards in review.</Text>
              ) : reviewCards.map((c) => (
                <View key={c.id} style={s.card}>
                  <TouchableOpacity onPress={() => openCard(c)}>
                    <Text style={s.cardTitle}>{c.person_name} · {c.exam_term_name}</Text>
                    <Text style={s.meta}>
                      {c.percentage != null ? `${c.percentage}% · ${c.overall_grade}` : ""}
                      {c.attendance_pct != null ? ` · Attendance ${c.attendance_pct}%` : ""}
                    </Text>
                    {c.teacher_remark ? <Text style={s.remark}>{c.teacher_remark}</Text> : null}
                  </TouchableOpacity>
                  {c.has_alpha_participation && (
                    <TextInput
                      style={s.input}
                      multiline
                      placeholder={c.suggested_coach_remark || "Approved coach remark (optional)"}
                      value={coachRemark}
                      onChangeText={setCoachRemark}
                    />
                  )}
                  <TouchableOpacity style={s.primaryBtn} onPress={() => router.push(`/admin/report-cards/${c.id}`)}>
                    <Feather name="edit-2" size={16} color="#fff" />
                    <Text style={s.primaryBtnTxt}>Review & finalize</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  backBtn: { padding: 8 },
  overline: { fontSize: 10, fontWeight: "700", color: "#64748B", letterSpacing: 1 },
  h1: { fontSize: 22, fontWeight: "700", color: "#0F172A" },
  tabs: { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginTop: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#E2E8F0" },
  tabOn: { backgroundColor: "#1E40AF" },
  tabTxt: { fontSize: 13, fontWeight: "600", color: "#475569" },
  tabTxtOn: { color: "#fff" },
  scroll: { padding: 16, gap: 12 },
  section: { fontSize: 13, fontWeight: "700", color: "#334155", marginTop: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#E2E8F0" },
  chipOn: { backgroundColor: "#DBEAFE" },
  chipTxt: { fontSize: 12, color: "#475569" },
  chipTxtOn: { color: "#1E40AF", fontWeight: "600" },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#1E40AF", padding: 12, borderRadius: 10, marginTop: 8 },
  primaryBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  meta: { fontSize: 12, color: "#64748B" },
  remark: { fontSize: 13, color: "#334155", marginTop: 4 },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, padding: 10, minHeight: 80, textAlignVertical: "top", backgroundColor: "#F8FAFC" },
  listRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  rowTitle: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  empty: { color: "#94A3B8", fontSize: 13 },
  search: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  secondaryBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#fff",
    marginBottom: 8,
  },
  secondaryBtnTxt: { color: "#1E40AF", fontWeight: "700", fontSize: 13 },
});
