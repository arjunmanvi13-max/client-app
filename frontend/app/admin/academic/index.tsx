import { useCallback, useState, useEffect, useMemo } from "react";
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
import {
  DEFAULT_PWS_STANDARDS,
  DEFAULT_PWS_SUBJECTS,
  buildTeacherAssignmentPayload,
  newTeacherAssignRow,
  stdLabel,
  validateTeacherAssignments,
  type TeacherAssignRow,
} from "../../../src/academicStructure";
import { FormSelect } from "../../../src/components/forms/FormSelect";
import { FormMultiSelect } from "../../../src/components/forms/FormMultiSelect";
import { FormSearchSelect } from "../../../src/components/forms/FormSearchSelect";

type Tab = "years" | "structure" | "subjects" | "assignments";

const TABS: { key: Tab; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { key: "years", label: "Years", icon: "calendar" },
  { key: "structure", label: "Std & Sections", icon: "layers" },
  { key: "subjects", label: "Subjects", icon: "book" },
  { key: "assignments", label: "Teacher Assignments", icon: "users" },
];

const STATUS_COLORS: Record<string, string> = {
  open: "#16A34A",
  closed: "#64748B",
  archived: "#94A3B8",
};

function gradeNamesForSubject(sub: any, grades: any[]): string {
  const ids = sub.grade_ids || [];
  if (!ids.length) return "all";
  return ids
    .map((gid: string) => grades.find((g) => g.id === gid)?.name)
    .filter(Boolean)
    .map((name) => stdLabel(String(name)))
    .join(", ") || "all";
}

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
  const [assignTeacherId, setAssignTeacherId] = useState<string | null>(null);
  const [assignRows, setAssignRows] = useState<TeacherAssignRow[]>([newTeacherAssignRow()]);
  const [seedingSubjects, setSeedingSubjects] = useState(false);
  const [seedingStandards, setSeedingStandards] = useState(false);

  const canManage = userHasPermission(user, Permission.MANAGE_TEACHERS_MAP_SUBJECTS)
    || userHasPermission(user, Permission.MANAGE_TEACHERS_MAP_SECTIONS);

  const selectedYear = years.find((y) => y.id === selectedYearId) || years.find((y) => y.status === "open") || years[0];
  const isReadOnly = selectedYear?.status === "archived";

  const subjectOptions = useMemo(
    () => subjects.map((sub) => ({ value: sub.id, label: sub.name })),
    [subjects],
  );

  const sectionOptions = useMemo(
    () => sections.map((sec) => ({ value: sec.id, label: sec.label })),
    [sections],
  );

  const teacherOptions = useMemo(
    () => teachers.map((t) => ({ value: t.id, label: t.name })),
    [teachers],
  );

  const missingDefaultSubjects = useMemo(
    () => DEFAULT_PWS_SUBJECTS.filter(
      (def) => !subjects.some((s) => s.name.toLowerCase() === def.name.toLowerCase()),
    ),
    [subjects],
  );

  const missingDefaultStandards = useMemo(
    () => DEFAULT_PWS_STANDARDS.filter(
      (def) => !grades.some((g) => g.name.toLowerCase() === def.name.toLowerCase()),
    ),
    [grades],
  );

  const visibleSections = useMemo(
    () => (sectionGradeId ? sections.filter((sec) => sec.grade_id === sectionGradeId) : sections),
    [sections, sectionGradeId],
  );

  const groupedAssignments = useMemo(() => {
    const map = new Map<string, {
      teacher: any;
      rows: { sectionLabel: string; stdName: string; subjects: string; ids: string[] }[];
    }>();
    for (const a of classAssignments) {
      const tid = a.teacher_user_id;
      if (!map.has(tid)) {
        map.set(tid, { teacher: a.teacher, rows: [] });
      }
      const entry = map.get(tid)!;
      const sectionLabel = a.section?.label || a.section_id?.slice(0, 8) || "—";
      const stdName = a.grade?.name || a.section?.grade_name || "—";
      const existing = entry.rows.find((r) => r.sectionLabel === sectionLabel);
      if (existing) {
        const names = existing.subjects.split(", ").filter(Boolean);
        if (a.subject?.name && !names.includes(a.subject.name)) {
          names.push(a.subject.name);
          existing.subjects = names.join(", ");
        }
        existing.ids.push(a.id);
      } else {
        entry.rows.push({
          sectionLabel,
          stdName,
          subjects: a.subject?.name || "—",
          ids: [a.id],
        });
      }
    }
    return Array.from(map.values());
  }, [classAssignments]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [yearsRes, usersRes] = await Promise.all([
        api.get("/academic/years"),
        api.get("/users/directory", { params: { role: "teacher" } }).catch(() => ({ data: [] })),
      ]);
      setYears(yearsRes.data);
      setTeachers(usersRes.data);
      const yid = selectedYearId || yearsRes.data.find((y: any) => y.status === "open")?.id || yearsRes.data[0]?.id;
      if (yid && !selectedYearId) setSelectedYearId(yid);
      if (yid) {
        const results = await Promise.allSettled([
          api.get("/academic/grades", { params: { academic_year_id: yid } }),
          api.get("/academic/sections", { params: { academic_year_id: yid } }),
          api.get("/academic/subjects", { params: { academic_year_id: yid } }),
          api.get("/academic/class-assignments", { params: { academic_year_id: yid } }),
        ]);
        const pick = <T,>(idx: number, fallback: T): T => {
          const r = results[idx];
          return r.status === "fulfilled" ? r.value.data : fallback;
        };
        setGrades(pick(0, []));
        setSections(pick(1, []));
        setSubjects(pick(2, []));
        setClassAssignments(pick(3, []));
        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length === results.length) {
          throw (failed[0] as PromiseRejectedResult).reason;
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to load academic data");
    } finally {
      setLoading(false);
    }
  }, [selectedYearId]);

  useEffect(() => {
    if (!grades.length) return;
    if (!sectionGradeId || !grades.some((g) => g.id === sectionGradeId)) {
      setSectionGradeId(grades[0].id);
    }
  }, [grades, sectionGradeId]);

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
      Alert.alert("Error", e?.response?.data?.detail || "Failed to add standard");
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

  const addSubject = async (name?: string, code?: string) => {
    const subject = (name || subjectName).trim();
    if (!subject || !selectedYear || isReadOnly) return;
    try {
      await api.post("/academic/subjects", {
        academic_year_id: selectedYear.id,
        name: subject,
        code: code || undefined,
        grade_ids: subjectGradeIds,
        section_ids: [],
        entity_id: "pws",
      });
      if (!name) setSubjectName("");
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to add subject");
    }
  };

  const seedDefaultStandards = async () => {
    if (!selectedYear || isReadOnly || missingDefaultStandards.length === 0) return;
    setSeedingStandards(true);
    let added = 0;
    try {
      for (const def of missingDefaultStandards) {
        try {
          await api.post("/academic/grades", {
            academic_year_id: selectedYear.id,
            name: def.name,
            sort_order: def.sort,
            entity_id: "pws",
          });
          added++;
        } catch {
          // skip duplicates
        }
      }
      await load();
      Alert.alert("Standards updated", added ? `${added} standard(s) added.` : "No new standards were added.");
    } finally {
      setSeedingStandards(false);
    }
  };

  const seedDefaultSubjects = async () => {
    if (!selectedYear || isReadOnly || missingDefaultSubjects.length === 0) return;
    setSeedingSubjects(true);
    let added = 0;
    try {
      for (const def of missingDefaultSubjects) {
        try {
          await api.post("/academic/subjects", {
            academic_year_id: selectedYear.id,
            name: def.name,
            code: def.code,
            grade_ids: subjectGradeIds,
            section_ids: [],
            entity_id: "pws",
          });
          added++;
        } catch {
          // skip duplicates or validation errors
        }
      }
      await load();
      Alert.alert("Subjects updated", added ? `${added} subject(s) added.` : "No new subjects were added.");
    } finally {
      setSeedingSubjects(false);
    }
  };

  const updateAssignRow = (key: string, patch: Partial<TeacherAssignRow>) => {
    setAssignRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const assignClasses = async () => {
    if (!selectedYear || isReadOnly) return;
    const validationError = validateTeacherAssignments(assignTeacherId, assignRows);
    if (validationError) {
      Alert.alert("Cannot save", validationError);
      return;
    }
    const payload = buildTeacherAssignmentPayload(assignTeacherId!, assignRows);
    let created = 0;
    let skipped = 0;
    try {
      for (const mapping of payload.mappings) {
        const section = sections.find((sec) => sec.id === mapping.sectionId);
        if (!section) {
          Alert.alert("Error", "One or more selected classes are no longer available. Refresh and try again.");
          return;
        }
        for (const subjectId of mapping.subjectIds) {
          try {
            await api.post("/academic/class-assignments", {
              teacher_user_id: payload.teacherId,
              academic_year_id: selectedYear.id,
              grade_id: section.grade_id,
              section_id: mapping.sectionId,
              subject_id: subjectId,
            });
            created++;
          } catch (e: any) {
            if (e?.response?.status === 400) skipped++;
            else throw e;
          }
        }
      }
      setAssignTeacherId(null);
      setAssignRows([newTeacherAssignRow()]);
      await load();
      Alert.alert(
        "Assignments saved",
        `${created} assignment(s) created${skipped ? `, ${skipped} already existed` : ""}.`,
      );
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
          <Text style={s.sub}>PWS — years, standards, sections, subjects & teacher assignments</Text>
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
                  <Text style={s.cardTitle}>Std</Text>
                  {!isReadOnly && missingDefaultStandards.length > 0 && (
                    <TouchableOpacity
                      testID="btn-seed-standards"
                      style={[s.secondaryBtn, seedingStandards && { opacity: 0.6 }]}
                      onPress={seedDefaultStandards}
                      disabled={seedingStandards}
                    >
                      {seedingStandards ? (
                        <ActivityIndicator size="small" color="#1E40AF" />
                      ) : (
                        <Text style={s.secondaryBtnTxt}>
                          Add missing default standards ({missingDefaultStandards.length})
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                  {!isReadOnly && (
                    <View style={s.row}>
                      <TextInput testID="input-grade" value={gradeName} onChangeText={setGradeName} placeholder="Std e.g. 9" style={s.input} placeholderTextColor="#94A3B8" />
                      <TouchableOpacity testID="btn-add-grade" style={s.btn} onPress={addGrade}><Text style={s.btnTxt}>Add</Text></TouchableOpacity>
                    </View>
                  )}
                  {grades.length === 0 ? (
                    <Text style={s.hint}>No standards yet. Add manually or use the default catalogue button above.</Text>
                  ) : (
                    <View style={s.listWrap}>
                      {grades.map((g) => (
                        <View key={g.id} style={s.listRow}>
                          <Text style={s.listTitle}>{stdLabel(g.name)}</Text>
                          <Text style={s.listMeta}>Stored as: {g.name}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <View style={s.card}>
                  <Text style={s.cardTitle}>Sections</Text>
                  {grades.length === 0 ? (
                    <Text style={s.hint}>Add standards first, then create sections for each std.</Text>
                  ) : (
                    <>
                      <Text style={s.label}>Select std</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                        {grades.map((g) => (
                          <TouchableOpacity key={g.id} style={[s.chip, sectionGradeId === g.id && s.chipActive]} onPress={() => setSectionGradeId(g.id)}>
                            <Text style={[s.chipTxt, sectionGradeId === g.id && s.chipTxtActive]}>{stdLabel(g.name)}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                      {!isReadOnly && (
                        <View style={s.row}>
                          <TextInput testID="input-section" value={sectionName} onChangeText={setSectionName} placeholder="Section e.g. A" style={s.input} placeholderTextColor="#94A3B8" autoCapitalize="characters" />
                          <TouchableOpacity testID="btn-add-section" style={s.btn} onPress={addSection}><Text style={s.btnTxt}>Add</Text></TouchableOpacity>
                        </View>
                      )}
                      {visibleSections.length === 0 ? (
                        <Text style={s.hint}>No sections for {stdLabel(grades.find((g) => g.id === sectionGradeId)?.name)} yet.</Text>
                      ) : (
                        <View style={s.listWrap}>
                          {visibleSections.map((sec) => (
                            <View key={sec.id} style={s.listRow}>
                              <Text style={s.listTitle}>{sec.label}</Text>
                              <Text style={s.listMeta}>{stdLabel(sec.grade_name || grades.find((g) => g.id === sec.grade_id)?.name)}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                </View>
              </>
            )}

            {tab === "subjects" && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Subjects</Text>
                <Text style={s.label}>Assign to std (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                  {grades.map((g) => (
                    <TouchableOpacity key={g.id} style={[s.chip, subjectGradeIds.includes(g.id) && s.chipActive]} onPress={() => toggleChip(subjectGradeIds, g.id, setSubjectGradeIds)}>
                      <Text style={[s.chipTxt, subjectGradeIds.includes(g.id) && s.chipTxtActive]}>{stdLabel(g.name)}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {!isReadOnly && missingDefaultSubjects.length > 0 && (
                  <>
                    <Text style={s.label}>Default catalogue</Text>
                    <View style={s.defaultRow}>
                      {DEFAULT_PWS_SUBJECTS.map((def) => {
                        const exists = !missingDefaultSubjects.some((m) => m.name === def.name);
                        return (
                          <View key={def.name} style={[s.defaultChip, exists && s.defaultChipDone]}>
                            <Text style={[s.defaultChipTxt, exists && s.defaultChipTxtDone]}>
                              {def.name}{def.code ? ` (${def.code})` : ""}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    <TouchableOpacity
                      testID="btn-seed-subjects"
                      style={[s.secondaryBtn, seedingSubjects && { opacity: 0.6 }]}
                      onPress={seedDefaultSubjects}
                      disabled={seedingSubjects}
                    >
                      {seedingSubjects ? (
                        <ActivityIndicator size="small" color="#1E40AF" />
                      ) : (
                        <Text style={s.secondaryBtnTxt}>Add missing default subjects ({missingDefaultSubjects.length})</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {!isReadOnly && (
                  <View style={s.row}>
                    <TextInput testID="input-subject" value={subjectName} onChangeText={setSubjectName} placeholder="e.g. Mathematics" style={s.input} placeholderTextColor="#94A3B8" />
                    <TouchableOpacity testID="btn-add-subject" style={s.btn} onPress={() => addSubject()}><Text style={s.btnTxt}>Add</Text></TouchableOpacity>
                  </View>
                )}
                {subjects.map((sub) => (
                  <View key={sub.id} style={s.subjectRow}>
                    <Text style={s.subjectName}>{sub.name} ({sub.code})</Text>
                    <Text style={s.subjectMeta}>
                      Std: {gradeNamesForSubject(sub, grades)}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {tab === "assignments" && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Teacher · class · subjects</Text>
                {!isReadOnly && (
                  <>
                    <FormSearchSelect
                      label="Teacher"
                      value={assignTeacherId || ""}
                      options={teacherOptions}
                      onChange={(id) => setAssignTeacherId(id || null)}
                      placeholder="Search and select teacher…"
                      searchPlaceholder="Search teachers…"
                      required
                      testID="assign-teacher"
                    />

                    <Text style={[s.label, { marginTop: 12 }]}>Class assignments</Text>
                    <Text style={s.fieldHelp}>Map one or more classes; for each class, select the subjects the teacher handles.</Text>
                    {assignRows.map((row, idx) => (
                      <View key={row.key} style={s.assignFormRow}>
                        <View style={s.assignFormHeader}>
                          <Text style={s.assignFormTitle}>Class {idx + 1}</Text>
                          {assignRows.length > 1 && (
                            <TouchableOpacity onPress={() => setAssignRows((rows) => rows.filter((r) => r.key !== row.key))}>
                              <Feather name="trash-2" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          )}
                        </View>
                        <FormSelect
                          label="Class / section"
                          value={row.sectionId}
                          options={sectionOptions}
                          onChange={(sectionId) => updateAssignRow(row.key, { sectionId })}
                          placeholder="Select class…"
                          required
                          testID={`assign-section-${idx}`}
                        />
                        <FormMultiSelect
                          label="Subjects for this class"
                          values={row.subjectIds}
                          options={subjectOptions}
                          onChange={(subjectIds) => updateAssignRow(row.key, { subjectIds })}
                          placeholder="Select one or more subjects…"
                          searchPlaceholder="Search subjects…"
                          required={!!row.sectionId}
                          testID={`assign-subjects-${idx}`}
                        />
                      </View>
                    ))}
                    <TouchableOpacity
                      style={s.secondaryBtn}
                      onPress={() => setAssignRows((rows) => [...rows, newTeacherAssignRow()])}
                    >
                      <Text style={s.secondaryBtnTxt}>+ Add another class</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="btn-assign-class" style={[s.btn, { alignSelf: "flex-start", marginTop: 10 }]} onPress={assignClasses}>
                      <Text style={s.btnTxt}>Save assignments</Text>
                    </TouchableOpacity>
                  </>
                )}
                {groupedAssignments.length === 0 ? (
                  <Text style={s.hint}>No class assignments yet.</Text>
                ) : groupedAssignments.map((group) => (
                  <View key={group.teacher?.id || group.teacher?.name} style={s.teacherGroup}>
                    <Text style={s.assignName}>{group.teacher?.name || "Teacher"}</Text>
                    {group.rows.map((row) => (
                      <View key={`${row.sectionLabel}-${row.subjects}`} style={s.assignRow} testID={`class-assignment-${row.ids[0]}`}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.assignMeta}>
                            {row.sectionLabel} · {stdLabel(row.stdName)} · {row.subjects}
                          </Text>
                        </View>
                        {!isReadOnly && row.ids.map((id) => (
                          <TouchableOpacity key={id} onPress={() => removeAssignment(id)} style={{ marginLeft: 8 }}>
                            <Feather name="trash-2" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
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
  fieldHelp: { fontSize: 11, color: "#94A3B8", marginBottom: 10, lineHeight: 16 },
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
  listWrap: { marginTop: 4 },
  listRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  listTitle: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  listMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  defaultRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  defaultChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: "#CBD5E1", backgroundColor: "#F8FAFC" },
  defaultChipDone: { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" },
  defaultChipTxt: { fontSize: 11, fontWeight: "600", color: "#475569" },
  defaultChipTxtDone: { color: "#15803D" },
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
  assignFormRow: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#F8FAFC",
    gap: 8,
  },
  assignFormHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  assignFormTitle: { fontSize: 13, fontWeight: "800", color: "#0F172A" },
  teacherGroup: { marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  assignRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  assignName: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  assignMeta: { fontSize: 12, color: "#64748B" },
  denied: { padding: 24, color: "#64748B", textAlign: "center" },
});
