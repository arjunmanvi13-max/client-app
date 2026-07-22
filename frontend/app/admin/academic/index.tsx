import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl, Pressable, Platform,
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
import { FormFieldGrid } from "../../../src/components/forms/FormFieldGrid";
import { inactiveUserSuffix } from "../../../src/userStatus";
import { useBreakpoint } from "../../../src/useBreakpoint";

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

type GroupedAssignmentRow = {
  sectionId: string;
  sectionLabel: string;
  stdName: string;
  subjectIds: string[];
  subjects: string;
  ids: string[];
};

type GroupedAssignment = {
  teacherId: string;
  teacher: any;
  rows: GroupedAssignmentRow[];
};

function assignRowsForTeacher(teacherId: string, assignments: any[]): TeacherAssignRow[] {
  const bySection = new Map<string, string[]>();
  for (const a of assignments) {
    if (a.teacher_user_id !== teacherId || !a.section_id) continue;
    const subjectIds = bySection.get(a.section_id) || [];
    if (a.subject_id && !subjectIds.includes(a.subject_id)) {
      subjectIds.push(a.subject_id);
    }
    bySection.set(a.section_id, subjectIds);
  }
  return Array.from(bySection.entries()).map(([sectionId, subjectIds]) => ({
    key: `row-${sectionId}-${Math.random().toString(36).slice(2, 7)}`,
    sectionId,
    subjectIds,
  }));
}

export default function AcademicAdmin() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("years");
  const [loading, setLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const loadSeqRef = useRef(0);
  const assignmentsLoadSeqRef = useRef(0);

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
  const [openAssignRowKey, setOpenAssignRowKey] = useState<string | null>(null);
  const [openTeacherSelect, setOpenTeacherSelect] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [seedingSubjects, setSeedingSubjects] = useState(false);
  const [seedingStandards, setSeedingStandards] = useState(false);

  const canManage = userHasPermission(user, Permission.MANAGE_TEACHERS_MAP_SUBJECTS)
    || userHasPermission(user, Permission.MANAGE_TEACHERS_MAP_SECTIONS);
  const { isWide } = useBreakpoint();

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

  const groupedAssignments = useMemo((): GroupedAssignment[] => {
    const map = new Map<string, { teacher: any; rows: Map<string, GroupedAssignmentRow> }>();
    for (const a of classAssignments) {
      const tid = a.teacher_user_id;
      const sectionId = a.section_id || a.section?.id || "";
      if (!tid || !sectionId) continue;
      if (!map.has(tid)) {
        map.set(tid, { teacher: a.teacher, rows: new Map() });
      }
      const entry = map.get(tid)!;
      let row = entry.rows.get(sectionId);
      if (!row) {
        row = {
          sectionId,
          sectionLabel: a.section?.label || sectionId.slice(0, 8) || "—",
          stdName: a.grade?.name || a.section?.grade_name || "—",
          subjectIds: [],
          subjects: "",
          ids: [],
        };
        entry.rows.set(sectionId, row);
      }
      if (a.subject_id && !row.subjectIds.includes(a.subject_id)) {
        row.subjectIds.push(a.subject_id);
      }
      row.ids.push(a.id);
    }

    const subjectNameById = new Map(subjects.map((sub) => [sub.id, sub.name]));

    return Array.from(map.entries())
      .map(([teacherId, { teacher, rows }]) => ({
        teacherId,
        teacher: teacher ? { ...teacher, id: teacherId } : { id: teacherId, name: "Teacher" },
        rows: Array.from(rows.values()).map((row) => ({
          ...row,
          subjects: row.subjectIds
            .map((id) => subjectNameById.get(id))
            .filter(Boolean)
            .join(", ") || "—",
        })),
      }))
      .sort((a, b) =>
        (a.teacher?.name || "").localeCompare(b.teacher?.name || "", undefined, { sensitivity: "base" }),
      );
  }, [classAssignments, subjects]);

  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teachers) {
      if (t.id) map.set(t.id, t.name);
    }
    for (const group of groupedAssignments) {
      if (group.teacherId && group.teacher?.name) {
        map.set(group.teacherId, group.teacher.name);
      }
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }, [teachers, groupedAssignments]);

  const editingTeacherName = useMemo(() => {
    if (!editingTeacherId) return "";
    return teachers.find((t) => t.id === editingTeacherId)?.name
      || groupedAssignments.find((g) => g.teacherId === editingTeacherId)?.teacher?.name
      || "Teacher";
  }, [editingTeacherId, teachers, groupedAssignments]);

  const loadClassAssignments = useCallback(async (yearId: string) => {
    const seq = ++assignmentsLoadSeqRef.current;
    setAssignmentsLoading(true);
    try {
      const { data } = await api.get("/academic/class-assignments", {
        params: { academic_year_id: yearId },
      });
      if (seq !== assignmentsLoadSeqRef.current) return;
      setClassAssignments(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (seq !== assignmentsLoadSeqRef.current) return;
      console.error("Failed to load class assignments", e);
      setClassAssignments([]);
    } finally {
      if (seq === assignmentsLoadSeqRef.current) setAssignmentsLoading(false);
    }
  }, []);

  const load = useCallback(async (forceYearId?: string) => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    try {
      const [yearsRes, usersRes] = await Promise.all([
        api.get("/academic/years"),
        api.get("/users/directory", { params: { role: "teacher" } }).catch(() => ({ data: [] })),
      ]);
      if (seq !== loadSeqRef.current) return;
      setYears(yearsRes.data);
      setTeachers(usersRes.data);
      const yid = forceYearId
        || selectedYearId
        || yearsRes.data.find((y: any) => y.status === "open")?.id
        || yearsRes.data[0]?.id;
      if (yid && yid !== selectedYearId) setSelectedYearId(yid);
      if (yid) {
        const results = await Promise.allSettled([
          api.get("/academic/grades", { params: { academic_year_id: yid } }),
          api.get("/academic/sections", { params: { academic_year_id: yid } }),
          api.get("/academic/subjects", { params: { academic_year_id: yid } }),
        ]);
        if (seq !== loadSeqRef.current) return;
        const pick = <T,>(idx: number, fallback: T): T => {
          const r = results[idx];
          return r.status === "fulfilled" ? r.value.data : fallback;
        };
        setGrades(pick(0, []));
        setSections(pick(1, []));
        setSubjects(pick(2, []));
        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length === results.length) {
          throw (failed[0] as PromiseRejectedResult).reason;
        }
        await loadClassAssignments(yid);
      } else {
        setGrades([]);
        setSections([]);
        setSubjects([]);
        setClassAssignments([]);
      }
    } catch (e: any) {
      if (seq !== loadSeqRef.current) return;
      Alert.alert("Error", e?.response?.data?.detail || "Failed to load academic data");
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [selectedYearId, loadClassAssignments]);

  useEffect(() => {
    if (!grades.length) return;
    if (!sectionGradeId || !grades.some((g) => g.id === sectionGradeId)) {
      setSectionGradeId(grades[0].id);
    }
  }, [grades, sectionGradeId]);

  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; }, [load]);

  useFocusEffect(useCallback(() => { void loadRef.current(); }, []));

  useEffect(() => {
    if (tab !== "assignments" || !selectedYearId || loading) return;
    void loadClassAssignments(selectedYearId);
  }, [tab, selectedYearId, loading, loadClassAssignments]);

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
    const replacing = editingTeacherId === payload.teacherId;
    let created = 0;
    let skipped = 0;
    try {
      if (replacing) {
        const existing = classAssignments.filter((a) => a.teacher_user_id === payload.teacherId);
        for (const a of existing) {
          await api.delete(`/academic/class-assignments/${a.id}`);
        }
      }
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
      setEditingTeacherId(null);
      setAssignRows([newTeacherAssignRow()]);
      await load();
      Alert.alert(
        replacing ? "Assignments updated" : "Assignments saved",
        replacing
          ? `${created} assignment(s) saved for this teacher.`
          : `${created} assignment(s) created${skipped ? `, ${skipped} already existed` : ""}.`,
      );
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to assign teacher");
    }
  };

  const editTeacherAssignments = (group: GroupedAssignment) => {
    const teacherId = group.teacherId;
    if (!teacherId || isReadOnly) return;
    const rows = assignRowsForTeacher(teacherId, classAssignments);
    setAssignTeacherId(teacherId);
    setEditingTeacherId(teacherId);
    setAssignRows(rows.length ? rows : [newTeacherAssignRow()]);
    setOpenAssignRowKey(null);
    setOpenTeacherSelect(false);
  };

  const cancelEditAssignments = () => {
    setEditingTeacherId(null);
    setAssignTeacherId(null);
    setAssignRows([newTeacherAssignRow()]);
    setOpenAssignRowKey(null);
    setOpenTeacherSelect(false);
  };

  const removeTeacherAssignments = (group: GroupedAssignment) => {
    const teacherName = group.teacher?.name || "this teacher";
    const ids = group.rows.flatMap((row) => row.ids);
    if (!ids.length || isReadOnly) return;
    Alert.alert(
      "Delete all assignments?",
      `Remove every class assignment for ${teacherName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              for (const id of ids) {
                await api.delete(`/academic/class-assignments/${id}`);
              }
              if (editingTeacherId === group.teacherId) {
                cancelEditAssignments();
              }
              await load();
            } catch (e: any) {
              Alert.alert("Error", e?.response?.data?.detail || "Failed to remove assignments");
            }
          },
        },
      ],
    );
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

      {tab === "assignments" ? (
        <View style={s.assignmentsViewport}>
          {loading ? (
            <ActivityIndicator color="#1E40AF" style={{ marginTop: 24 }} />
          ) : (
            <View style={[s.assignmentsShell, isWide && s.assignmentsShellWide]}>
              {!isReadOnly && (
                <View style={[s.assignPanel, s.assignFormPanel, openTeacherSelect && s.assignPanelOpen, editingTeacherId && s.assignFormPanelEditing]}>
                  <View style={s.assignFormTitleRow}>
                    <View style={s.assignFormTitleWrap}>
                      <Text style={s.assignPanelTitle}>
                        {editingTeacherId ? `Edit assignment for ${editingTeacherName}` : "Assign classes"}
                      </Text>
                      {editingTeacherId ? (
                        <View style={s.editingBadge}>
                          <Text style={s.editingBadgeTxt}>Editing</Text>
                        </View>
                      ) : null}
                    </View>
                    {editingTeacherId ? (
                      <TouchableOpacity
                        testID="cancel-edit-assignments"
                        onPress={cancelEditAssignments}
                        style={s.cancelEditBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel editing assignments"
                      >
                        <Text style={s.cancelEditTxt}>Cancel</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <Text style={s.fieldHelpCompact}>
                    {editingTeacherId
                      ? "Update classes and subjects below, then save. You can add or remove class blocks."
                      : "Map one or more classes; for each class, select the subjects the teacher handles."}
                  </Text>

                  <View style={[s.teacherSelectWrap, openTeacherSelect && s.teacherSelectWrapOpen]}>
                    <FormSearchSelect
                      label="Teacher"
                      value={assignTeacherId || ""}
                      options={teacherOptions}
                      onChange={(id) => {
                        setAssignTeacherId(id || null);
                        if (id !== editingTeacherId) setEditingTeacherId(null);
                      }}
                      onOpenChange={setOpenTeacherSelect}
                      placeholder="Search and select teacher…"
                      searchPlaceholder="Search teachers…"
                      required
                      compact
                      disabled={!!editingTeacherId}
                      testID="assign-teacher"
                    />
                  </View>

                  <ScrollView
                    style={s.assignFormScroll}
                    contentContainerStyle={s.assignFormScrollContent}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {assignRows.map((row, idx) => (
                      <View
                        key={row.key}
                        style={[
                          s.assignFormRow,
                          openAssignRowKey === row.key && s.assignFormRowOpen,
                        ]}
                      >
                        <View style={s.assignFormHeader}>
                          <Text style={s.assignFormTitle}>Class {idx + 1}</Text>
                          {assignRows.length > 1 && (
                            <TouchableOpacity onPress={() => setAssignRows((rows) => rows.filter((r) => r.key !== row.key))}>
                              <Feather name="trash-2" size={15} color="#EF4444" />
                            </TouchableOpacity>
                          )}
                        </View>
                        <FormFieldGrid columns={2} isWide={isWide}>
                          <FormSelect
                            label="Class / section"
                            value={row.sectionId}
                            options={sectionOptions}
                            onChange={(sectionId) => updateAssignRow(row.key, { sectionId })}
                            placeholder="Select class…"
                            required
                            compact
                            testID={`assign-section-${idx}`}
                          />
                          <FormMultiSelect
                            label="Subjects for this class"
                            values={row.subjectIds}
                            options={subjectOptions}
                            onChange={(subjectIds) => updateAssignRow(row.key, { subjectIds })}
                            onOpenChange={(open) => {
                              setOpenAssignRowKey((current) => {
                                if (open) return row.key;
                                return current === row.key ? null : current;
                              });
                            }}
                            placeholder="Select one or more subjects…"
                            searchPlaceholder="Search subjects…"
                            required={!!row.sectionId}
                            testID={`assign-subjects-${idx}`}
                          />
                        </FormFieldGrid>
                      </View>
                    ))}
                  </ScrollView>

                  <View style={s.assignActions}>
                    <TouchableOpacity
                      style={s.secondaryBtnCompact}
                      onPress={() => setAssignRows((rows) => [...rows, newTeacherAssignRow()])}
                    >
                      <Text style={s.secondaryBtnTxt}>+ Add another class</Text>
                    </TouchableOpacity>
                    <View style={s.assignPrimaryActions}>
                      {editingTeacherId ? (
                        <TouchableOpacity
                          testID="cancel-edit-assignments-footer"
                          style={s.cancelEditBtnFooter}
                          onPress={cancelEditAssignments}
                        >
                          <Text style={s.cancelEditTxt}>Cancel edit</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity
                        testID="btn-assign-class"
                        style={s.btnCompact}
                        onPress={assignClasses}
                      >
                        <Text style={s.btnTxt}>{editingTeacherId ? "Update assignments" : "Save assignments"}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

              <View style={[s.assignPanel, s.assignListPanel, isReadOnly && s.assignListPanelFull]}>
                <View style={s.assignListHeader}>
                  <Text style={s.assignPanelTitle}>Current assignments</Text>
                  <Text style={s.assignListCount}>
                    {assignmentsLoading ? "Loading…" : `${groupedAssignments.length} teacher(s)`}
                  </Text>
                </View>
                <ScrollView
                  style={s.assignListScroll}
                  contentContainerStyle={s.assignListScrollContent}
                  nestedScrollEnabled
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                >
                  {assignmentsLoading ? (
                    <ActivityIndicator color="#1E40AF" style={{ marginTop: 24 }} />
                  ) : groupedAssignments.length === 0 ? (
                    <Text style={s.hintCompact}>No class assignments yet.</Text>
                  ) : groupedAssignments.map((group) => {
                    const teacherId = group.teacherId;
                    const isEditingThis = editingTeacherId === teacherId;
                    return (
                      <View
                        key={teacherId}
                        style={[s.teacherCard, isEditingThis && s.teacherCardEditing]}
                        testID={`teacher-assignments-${teacherId}`}
                      >
                        <View style={s.teacherCardHeader}>
                          <View style={s.teacherCardTitleWrap}>
                            <Text style={s.assignName} numberOfLines={1}>
                              {group.teacher?.name || "Teacher"}
                              {inactiveUserSuffix(group.teacher)}
                            </Text>
                            <Text style={s.assignClassCount}>
                              {group.rows.length} class{group.rows.length === 1 ? "" : "es"}
                            </Text>
                          </View>
                          {!isReadOnly && (
                            <View style={s.teacherCardActions}>
                              <Pressable
                                testID={`edit-teacher-assignments-${teacherId}`}
                                accessibilityRole="button"
                                accessibilityLabel={`Edit assignments for ${group.teacher?.name || "teacher"}`}
                                onPress={() => editTeacherAssignments(group)}
                                style={({ pressed, hovered }) => [
                                  s.assignActionBtn,
                                  s.assignActionBtnEdit,
                                  (pressed || (Platform.OS === "web" && hovered)) && s.assignActionBtnHover,
                                ]}
                              >
                                <Feather name="edit-2" size={14} color="#1E40AF" />
                              </Pressable>
                              <Pressable
                                testID={`delete-teacher-assignments-${teacherId}`}
                                accessibilityRole="button"
                                accessibilityLabel={`Delete all assignments for ${group.teacher?.name || "teacher"}`}
                                onPress={() => removeTeacherAssignments(group)}
                                style={({ pressed, hovered }) => [
                                  s.assignActionBtn,
                                  s.assignActionBtnDelete,
                                  (pressed || (Platform.OS === "web" && hovered)) && s.assignActionBtnDeleteHover,
                                ]}
                              >
                                <Feather name="trash-2" size={14} color="#EF4444" />
                              </Pressable>
                            </View>
                          )}
                        </View>
                        {group.rows.map((row) => (
                          <View key={row.sectionId} style={s.assignRow} testID={`class-assignment-${row.ids[0]}`}>
                            <Text style={s.assignMeta} numberOfLines={2}>
                              {row.sectionLabel} · {stdLabel(row.stdName)} · {row.subjects}
                            </Text>
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}
        </View>
      ) : (
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? <ActivityIndicator color="#1E40AF" style={{ marginTop: 24 }} /> : (
          <>
            {tab === "years" && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Academic years</Text>
                {years.map((y) => (
                  <View key={y.id} style={s.yearRow} testID={`year-${y.id}`}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => { setSelectedYearId(y.id); void load(y.id); }}>
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

          </>
        )}
      </ScrollView>
      )}
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
  yearBar: { paddingHorizontal: 20, paddingVertical: 6, backgroundColor: "#EEF2FF" },
  yearBarTxt: { fontSize: 12, fontWeight: "700", color: "#1E40AF" },
  scroll: { padding: 20, paddingBottom: 40 },
  assignmentsViewport: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  assignmentsShell: {
    flex: 1,
    minHeight: 0,
    gap: 10,
  },
  assignmentsShellWide: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  assignPanel: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    overflow: "visible",
    minHeight: 0,
    flexDirection: "column",
  },
  assignPanelOpen: {
    zIndex: 200,
    elevation: 200,
  },
  assignFormPanel: {
    flex: 1.05,
    minWidth: 0,
  },
  assignFormPanelEditing: {
    borderColor: "#93C5FD",
    backgroundColor: "#F8FBFF",
  },
  assignFormTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  assignFormTitleWrap: { flex: 1, minWidth: 0, gap: 6 },
  editingBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#DBEAFE",
    marginTop: 4,
  },
  editingBadgeTxt: { fontSize: 10, fontWeight: "800", color: "#1E40AF", textTransform: "uppercase", letterSpacing: 0.4 },
  cancelEditBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#fff",
  },
  cancelEditBtnFooter: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#fff",
  },
  cancelEditTxt: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  assignPrimaryActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  assignListPanel: {
    flex: 0.95,
    minWidth: 0,
  },
  assignListPanelFull: {
    flex: 1,
  },
  assignPanelTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  assignListHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 8,
  },
  assignListCount: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
  },
  teacherSelectWrap: {
    position: "relative",
    zIndex: 2,
    marginBottom: 8,
  },
  teacherSelectWrapOpen: {
    zIndex: 1200,
    elevation: 1200,
  },
  assignFormScroll: {
    flex: 1,
    minHeight: 0,
  },
  assignFormScrollContent: {
    gap: 6,
    paddingBottom: 4,
  },
  assignListScroll: {
    flex: 1,
    minHeight: 0,
  },
  assignListScrollContent: {
    paddingBottom: 8,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
    overflow: "visible",
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#0F172A", backgroundColor: "#F8FAFC", marginBottom: 8 },
  btn: { backgroundColor: "#1E40AF", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  btnTxt: { color: "#fff", fontWeight: "700", fontSize: 14 },
  hint: { fontSize: 12, color: "#64748B", marginTop: 8 },
  hintCompact: { fontSize: 12, color: "#64748B", marginTop: 4 },
  label: { fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 6, marginTop: 4 },
  fieldHelp: { fontSize: 11, color: "#94A3B8", marginBottom: 10, lineHeight: 16 },
  fieldHelpCompact: { fontSize: 11, color: "#94A3B8", marginBottom: 8, lineHeight: 15 },
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
  secondaryBtnCompact: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#fff",
  },
  secondaryBtnTxt: { color: "#1E40AF", fontWeight: "700", fontSize: 13 },
  btnCompact: {
    backgroundColor: "#1E40AF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  assignFormRow: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 10,
    marginBottom: 6,
    backgroundColor: "#F8FAFC",
    gap: 6,
    position: "relative",
    zIndex: 1,
    overflow: "visible",
  },
  assignFormRowOpen: {
    zIndex: 100,
    elevation: 100,
  },
  assignActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    position: "relative",
    zIndex: 1,
  },
  assignFormHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  assignFormTitle: { fontSize: 12, fontWeight: "800", color: "#0F172A" },
  teacherCard: {
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  teacherCardEditing: {
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    paddingHorizontal: 8,
    borderBottomColor: "#BFDBFE",
  },
  teacherCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 4,
  },
  teacherCardTitleWrap: { flex: 1, minWidth: 0 },
  teacherCardActions: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  assignActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  assignActionBtnEdit: {
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
  },
  assignActionBtnDelete: {
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  assignActionBtnHover: {
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
  },
  assignActionBtnDeleteHover: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  assignRow: { paddingVertical: 4, paddingLeft: 2 },
  assignName: { fontSize: 13, fontWeight: "700", color: "#0F172A" },
  assignClassCount: { fontSize: 11, color: "#94A3B8", marginTop: 1, fontWeight: "600" },
  assignMeta: { fontSize: 12, color: "#64748B", lineHeight: 16 },
  denied: { padding: 24, color: "#64748B", textAlign: "center" },
});
