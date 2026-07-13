import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { api, useAuth, userHasPermission } from "./auth";
import { Permission } from "./rbac";
import { formatDate, toISODate } from "./dateFormat";
import { useBreakpoint } from "./useBreakpoint";

const KIND_OPTIONS = [
  { key: "student", label: "Students", icon: "book", color: "#2563EB", perm: Permission.MARK_STUDENT_ATTENDANCE },
  { key: "player", label: "Players", icon: "activity", color: "#16A34A", perm: Permission.MARK_PLAYER_ATTENDANCE },
  { key: "staff", label: "Staff", icon: "users", color: "#0EA5E9", perm: Permission.MARK_PWS_ATTENDANCE },
];
const STATUSES: { key: "present" | "absent" | "late" | "leave"; label: string; color: string }[] = [
  { key: "present", label: "P", color: "#10B981" },
  { key: "absent", label: "A", color: "#EF4444" },
  { key: "late", label: "L", color: "#F59E0B" },
  { key: "leave", label: "Lv", color: "#7C3AED" },
];
const CYCLE: ("present" | "absent" | "late" | "leave")[] = ["present", "absent", "late", "leave"];
const STATUS_COLOR: Record<string, string> = { present: "#10B981", absent: "#EF4444", late: "#F59E0B", leave: "#7C3AED" };
const STATUS_SHORT: Record<string, string> = { present: "P", absent: "A", late: "L", leave: "Lv" };

function shortName(n: string) {
  const parts = n.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0]}.`;
}

export default function Attendance() {
  const { user } = useAuth();
  const { isMobile } = useBreakpoint();
  const [kind, setKind] = useState<string>("student");
  const [groups, setGroups] = useState<string[]>([]);
  const [group, setGroup] = useState<string | null>(null);
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [people, setPeople] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, "present" | "absent" | "late" | "leave">>({});
  const [session, setSession] = useState<string>("morning");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isPrivileged = userHasPermission(user, Permission.MARK_PWS_ATTENDANCE)
    || userHasPermission(user, Permission.MARK_ALPHA_ATTENDANCE);
  const kindOptions = KIND_OPTIONS.filter((k) => isPrivileged || userHasPermission(user, k.perm));

  useEffect(() => {
    if (user?.role === "coach") setKind("player");
    if (user?.role === "teacher") setKind("student");
  }, [user]);

  useEffect(() => {
    if (kindOptions.length > 0 && !kindOptions.some((k) => k.key === kind)) {
      setKind(kindOptions[0].key);
    }
  }, [kindOptions, kind]);

  useEffect(() => {
    (async () => {
      if (kind === "student") {
        try {
          const { data } = await api.get("/academic/sections/for-attendance");
          const list = (data.sections || []).map((s: any) => ({ id: s.id, label: s.label }));
          setSections(list);
          setSectionId(list[0]?.id || null);
          setGroup(list[0]?.label || null);
        } catch {
          setSections([]);
          setSectionId(null);
          setGroup(null);
        }
        setGroups([]);
        return;
      }
      const { data } = await api.get("/people/groups", { params: { kind } });
      setGroups(data.groups);
      setGroup(data.groups[0] || null);
      setSections([]);
      setSectionId(null);
    })();
  }, [kind]);

  const loadPeople = useCallback(async () => {
    const rosterKey = kind === "student" ? sectionId : group;
    if (!rosterKey) return;
    setLoading(true);
    try {
      const params: any = { kind };
      if (kind === "student" && sectionId) params.section_id = sectionId;
      else if (group) params.group = group;
      const { data } = await api.get("/people", { params });
      setPeople(data);
      const today = toISODate();
      const attParams: any = { date: today, kind, session };
      if (kind === "student" && sectionId) attParams.section_id = sectionId;
      else if (group) attParams.group = group;
      const att = await api.get("/attendance", { params: attParams });
      const m: any = {};
      // Mobile: exception-based marking — everyone defaults to Present
      if (isMobile) data.forEach((p: any) => { m[p.id] = "present"; });
      att.data.forEach((r: any) => { m[r.person_id] = r.status; });
      setMarks(m);
    } finally { setLoading(false); }
  }, [kind, group, sectionId, session, isMobile]);

  useEffect(() => { loadPeople(); }, [loadPeople]);

  const setMark = (id: string, st: "present" | "absent" | "late" | "leave") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMarks((prev) => ({ ...prev, [id]: st }));
  };

  const cycleMark = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setMarks((prev) => {
      const cur = prev[id] || "present";
      const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
      return { ...prev, [id]: next };
    });
  };

  const markAllPresent = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const m: any = {};
    people.forEach((p) => { m[p.id] = "present"; });
    setMarks(m);
  };

  const submit = async () => {
    if (Object.keys(marks).length === 0) { Alert.alert("Mark at least one"); return; }
    setSaving(true);
    try {
      const today = toISODate();
      const payload: any = {
        date: today,
        kind,
        group,
        session,
        sport: null,
        marks: Object.entries(marks).map(([person_id, status]) => ({ person_id, status })),
      };
      if (kind === "student" && sectionId) payload.section_id = sectionId;
      await api.post("/attendance/batch", payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("Saved", `Attendance saved for ${Object.keys(marks).length} people.`);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to save");
    } finally { setSaving(false); }
  };

  const counts = STATUSES.reduce((acc: any, s) => {
    acc[s.key] = Object.values(marks).filter((v) => v === s.key).length;
    return acc;
  }, {});

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <Text style={s.h1}>Attendance</Text>
        <Text style={s.sub}>{formatDate(new Date())}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.hScroll} contentContainerStyle={s.kindRow}>
        {kindOptions.map((k) => (
          <TouchableOpacity
            key={k.key}
            testID={`kind-${k.key}`}
            onPress={() => setKind(k.key)}
            style={[s.kindChip, kind === k.key && { backgroundColor: k.color, borderColor: k.color }]}
          >
            <Feather name={k.icon as any} size={14} color={kind === k.key ? "#fff" : k.color} />
            <Text style={[s.kindText, { color: kind === k.key ? "#fff" : k.color }]}>{k.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.hScroll} contentContainerStyle={s.groupRow}>
        {(["morning", "afternoon", "evening"] as const).map((sess) => (
          <TouchableOpacity
            key={sess}
            testID={`session-${sess}`}
            onPress={() => setSession(sess)}
            style={[s.groupChip, session === sess && s.groupChipActive]}
          >
            <Text style={[s.groupText, session === sess && { color: "#fff" }]}>{sess}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.hScroll} contentContainerStyle={s.groupRow}>
        {kind === "student" ? (
          sections.length === 0 ? (
            <Text style={s.empty}>No sections assigned. Contact the school administrator.</Text>
          ) : sections.map((sec) => (
            <TouchableOpacity
              key={sec.id}
              testID={`section-${sec.label}`}
              onPress={() => { setSectionId(sec.id); setGroup(sec.label); }}
              style={[s.groupChip, sectionId === sec.id && s.groupChipActive]}
            >
              <Text style={[s.groupText, sectionId === sec.id && { color: "#fff" }]}>{sec.label}</Text>
            </TouchableOpacity>
          ))
        ) : (
          <>
            {groups.length === 0 && <Text style={s.empty}>No groups for this kind yet.</Text>}
            {groups.map((g) => (
              <TouchableOpacity key={g} testID={`group-${g}`} onPress={() => setGroup(g)} style={[s.groupChip, group === g && s.groupChipActive]}>
                <Text style={[s.groupText, group === g && { color: "#fff" }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </>
        )}
      </ScrollView>

      {!isMobile && (
        <View style={s.summaryBar}>
          {STATUSES.map((st) => (
            <View key={st.key} style={[s.sumBox, { backgroundColor: st.color + "1A" }]}>
              <Text style={[s.sumLabel, { color: st.color }]}>{st.label}</Text>
              <Text style={[s.sumValue, { color: st.color }]}>{counts[st.key]}</Text>
            </View>
          ))}
          <TouchableOpacity style={s.allBtn} onPress={markAllPresent} testID="mark-all-present">
            <Feather name="check-circle" size={14} color="#fff" />
            <Text style={s.allText}>All P</Text>
          </TouchableOpacity>
        </View>
      )}

      {isMobile && (
        <View style={s.hintBanner}>
          <Feather name="info" size={12} color="#1E40AF" />
          <Text style={s.hintText}>All Present by default. Tap to cycle P → A → L → Lv.</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={[s.list, isMobile && s.listMobile]}>
        {loading ? <ActivityIndicator color="#1E40AF" style={{ marginTop: 24 }} /> :
          people.length === 0 ? <Text style={s.empty}>No people in this group.</Text> :
          isMobile ? people.map((p) => {
            const st = marks[p.id] || "present";
            const color = STATUS_COLOR[st];
            return (
              <TouchableOpacity
                key={p.id}
                testID={`person-${p.id}`}
                onPress={() => cycleMark(p.id)}
                style={[s.cell, { borderColor: color, backgroundColor: color + "14" }]}
              >
                <View style={[s.cellBadge, { backgroundColor: color }]}>
                  <Text style={s.cellBadgeTxt}>{STATUS_SHORT[st]}</Text>
                </View>
                <Text style={s.cellName} numberOfLines={1}>{shortName(p.name)}</Text>
              </TouchableOpacity>
            );
          }) :
          people.map((p) => (
            <View key={p.id} style={s.row} testID={`person-${p.id}`}>
              <View style={[s.avatar, { backgroundColor: stringToColor(p.name) }]}>
                <Text style={s.avatarTxt}>{p.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{p.name}</Text>
                <Text style={s.rowMeta}>{p.group}{p.sport ? ` · ${p.sport}` : ""}</Text>
              </View>
              <View style={s.statusBtns}>
                {STATUSES.map((st) => (
                  <TouchableOpacity
                    key={st.key}
                    testID={`mark-${p.id}-${st.key}`}
                    onPress={() => setMark(p.id, st.key)}
                    style={[s.statBtn, marks[p.id] === st.key && { backgroundColor: st.color }]}
                  >
                    <Text style={[s.statBtnTxt, { color: marks[p.id] === st.key ? "#fff" : st.color }]}>{st.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        }
        <View style={{ height: isMobile ? 140 : 80 }} />
      </ScrollView>

      <View style={[s.bottomBar, isMobile && s.bottomBarMobile]}>
        {isMobile && (
          <View style={s.stickyCounts}>
            {STATUSES.map((st) => (
              <View key={st.key} style={s.stickyCount}>
                <View style={[s.stickyDot, { backgroundColor: st.color }]} />
                <Text style={[s.stickyCountTxt, { color: st.color }]}>{st.label}: {counts[st.key]}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {isMobile && (
            <TouchableOpacity style={s.allBtnSticky} onPress={markAllPresent} testID="mark-all-present-mobile">
              <Feather name="check-circle" size={14} color="#10B981" />
              <Text style={s.allBtnStickyTxt}>All P</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity testID="save-attendance" onPress={submit} disabled={saving || Object.keys(marks).length === 0} style={[s.saveBtn, { flex: 1 }, (saving || Object.keys(marks).length === 0) && { opacity: 0.5 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.saveTxt}>Save attendance ({Object.keys(marks).length})</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

function stringToColor(str: string) {
  const colors = ["#1E40AF", "#EA580C", "#7C3AED", "#0EA5E9", "#16A34A", "#EF4444", "#F59E0B"];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  h1: { fontSize: 28, fontWeight: "700", color: "#0F172A", letterSpacing: -0.5 },
  sub: { fontSize: 13, color: "#64748B", marginTop: 4 },
  kindRow: { paddingHorizontal: 20, gap: 8, paddingVertical: 16, alignItems: "center" },
  hScroll: { flexGrow: 0 },
  kindChip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#fff" },
  kindText: { fontSize: 13, fontWeight: "700" },
  groupRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  groupChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0" },
  groupChipActive: { backgroundColor: "#0F172A", borderColor: "#0F172A" },
  groupText: { fontSize: 12, fontWeight: "700", color: "#475569" },
  summaryBar: { flexDirection: "row", paddingHorizontal: 20, gap: 6, marginBottom: 8, alignItems: "center" },
  sumBox: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: "row", gap: 6, alignItems: "center" },
  sumLabel: { fontSize: 10, fontWeight: "800" },
  sumValue: { fontSize: 14, fontWeight: "800" },
  allBtn: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#10B981", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  allText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  list: { paddingHorizontal: 20, paddingBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 8 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  rowName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  rowMeta: { fontSize: 12, color: "#64748B", marginTop: 2 },
  statusBtns: { flexDirection: "row", gap: 4 },
  statBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  statBtnTxt: { fontWeight: "800", fontSize: 12 },
  empty: { textAlign: "center", color: "#64748B", padding: 20 },
  bottomBar: { position: "absolute", bottom: 78, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, backgroundColor: "transparent" },
  bottomBarMobile: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, backgroundColor: "#FFFFFFF2", borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  saveBtn: { backgroundColor: "#1E40AF", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  saveTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  hintBanner: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 12, marginBottom: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#DBEAFE", borderRadius: 8 },
  hintText: { color: "#1E40AF", fontSize: 11, flex: 1 },
  listMobile: { paddingHorizontal: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { width: "48.5%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1.5 },
  cellBadge: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  cellBadgeTxt: { color: "#fff", fontWeight: "800", fontSize: 11 },
  cellName: { flex: 1, fontSize: 13, fontWeight: "700", color: "#0F172A" },
  stickyCounts: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8, paddingHorizontal: 4 },
  stickyCount: { flexDirection: "row", alignItems: "center", gap: 5 },
  stickyDot: { width: 8, height: 8, borderRadius: 4 },
  stickyCountTxt: { fontSize: 12, fontWeight: "800" },
  allBtnSticky: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: "#10B981", backgroundColor: "#fff" },
  allBtnStickyTxt: { color: "#10B981", fontWeight: "800", fontSize: 13 },
});
