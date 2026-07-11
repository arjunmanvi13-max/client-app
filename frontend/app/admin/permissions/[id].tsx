import { useState, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Switch, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, useAuth } from "../../../src/auth";

type Templates = {
  groups: Record<string, string[]>;
  keys: string[];
  templates: Record<string, { label: string; category: string; organization: string; permissions: Record<string, boolean> }>;
};

const PERM_LABELS: Record<string, string> = {
  view_students: "View Students (PWS)",
  view_players: "View Players (ALPHA)",
  view_staff: "View Staff",
  mark_student_attendance: "Mark Student Attendance",
  mark_player_attendance: "Mark Player Attendance",
  mark_staff_attendance: "Mark Staff Attendance",
  add_players: "Add Players",
  edit_players: "Edit Players",
  toggle_player_status: "Activate / Deactivate Players",
  add_students: "Add Students",
  edit_students: "Edit Students",
  access_reports: "Access Reports",
  dashboard_access: "Dashboard Access",
  lifecycle_dashboard: "Lifecycle Dashboard",
  manage_users: "Manage Users",
  manage_academic_structure: "Manage Academic Structure",
};

export default function PermissionsEdit() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me, refresh } = useAuth();
  const [target, setTarget] = useState<any>(null);
  const [tmpls, setTmpls] = useState<Templates | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);

  const confirm = (title: string, message: string, onOk: () => void) => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) onOk();
    } else {
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        { text: "OK", onPress: onOk },
      ]);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [usersResp, tmplResp] = await Promise.all([
          api.get("/users"),
          api.get("/permissions/templates"),
        ]);
        const u = usersResp.data.find((x: any) => x.id === id);
        setTarget(u);
        setPerms(u?.permissions || {});
        setTmpls(tmplResp.data);
      } catch (e: any) {
        Alert.alert("Error", e?.response?.data?.detail || "Failed to load");
      } finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <SafeAreaView style={s.safe}><ActivityIndicator color="#0F766E" style={{ marginTop: 60 }} /></SafeAreaView>;
  if (!target || !tmpls) return null;
  if (me?.role !== "super_admin") {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.empty}><Feather name="lock" size={40} color="#94A3B8" /><Text style={s.emptyTitle}>Super Admin only</Text></View>
      </SafeAreaView>
    );
  }

  const toggle = (k: string) => setPerms((prev) => ({ ...prev, [k]: !prev[k] }));

  const applyTemplate = (key: string) => {
    const tpl = tmpls.templates[key];
    if (!tpl) return;
    confirm("Apply template?", `${tpl.label}\n\nThis replaces current toggles with the template defaults.`, () => setPerms({ ...tpl.permissions }));
  };

  const allOff = tmpls.keys.every((k) => !perms[k]);

  const save = async () => {
    if (allOff) {
      confirm("Warning", "All permissions are turned OFF — this will restrict the user from accessing any module. Continue?", doSave);
      return;
    }
    doSave();
  };

  const doSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/users/${id}/permissions`, { permissions: perms });
      // Refresh self if applicable
      if (data.id === me?.id) await refresh?.();
      setSaved(true);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || "Failed";
      if (Platform.OS === "web" && typeof window !== "undefined") window.alert(`Error: ${msg}`);
      else Alert.alert("Error", msg);
    } finally { setSaving(false); }
  };

  const enabledCount = tmpls.keys.filter((k) => !!perms[k]).length;

  if (saved) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="perm-edit-back">
            <Feather name="chevron-left" size={22} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>PERMISSIONS SUMMARY</Text>
            <Text style={s.h1}>{target.name}</Text>
            <Text style={s.sub}>{target.email} · {target.role.replace("_", " ")} · {target.organization}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={s.scroll}>
          <View style={s.successBanner} testID="perm-saved-banner">
            <Feather name="check-circle" size={18} color="#047857" />
            <Text style={s.successTxt}>Changes saved successfully</Text>
          </View>

          <Text style={s.summaryCount}>
            {enabledCount} of {tmpls.keys.length} permissions enabled
          </Text>

          {enabledCount === 0 ? (
            <View style={s.warnCard}>
              <Feather name="alert-triangle" size={16} color="#D97706" />
              <Text style={s.warnTxt}>No permissions enabled — this user cannot access any module.</Text>
            </View>
          ) : (
            Object.entries(tmpls.groups).map(([groupName, keys]) => {
              const active = (keys as string[]).filter((k) => !!perms[k]);
              if (active.length === 0) return null;
              return (
                <View key={groupName} style={s.group}>
                  <Text style={s.groupTitle}>{groupName.toUpperCase()}</Text>
                  <View style={[s.card, { paddingVertical: 4 }]}>
                    {active.map((k, i) => (
                      <View key={k} style={[s.summaryRow, i < active.length - 1 && s.toggleDivider]} testID={`summary-${k}`}>
                        <Feather name="check" size={16} color="#047857" />
                        <Text style={s.summaryLabel}>{PERM_LABELS[k] || k}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })
          )}
          <View style={{ height: 110 }} />
        </ScrollView>

        <View style={s.bottom}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity testID="perm-edit-again" style={s.editAgainBtn} onPress={() => setSaved(false)}>
              <Feather name="edit-2" size={15} color="#0F766E" />
              <Text style={s.editAgainTxt}>Edit Permissions</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="perm-done" style={[s.saveBtn, { flex: 1 }]} onPress={() => router.back()}>
              <Feather name="check" size={16} color="#fff" />
              <Text style={s.saveTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="perm-edit-back">
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>EDIT PERMISSIONS</Text>
          <Text style={s.h1}>{target.name}</Text>
          <Text style={s.sub}>{target.email} · {target.role.replace("_", " ")} · {target.organization}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.section}>Quick templates</Text>
        <View style={s.tmplRow}>
          {Object.entries(tmpls.templates).map(([key, t]) => (
            <TouchableOpacity key={key} testID={`tmpl-${key}`} style={s.tmplBtn} onPress={() => applyTemplate(key)}>
              <Feather name="copy" size={14} color="#0F766E" />
              <Text style={s.tmplTxt}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {Object.entries(tmpls.groups).map(([groupName, keys]) => (
          <View key={groupName} style={s.group}>
            <Text style={s.groupTitle}>{groupName.toUpperCase()}</Text>
            <View style={s.card}>
              {(keys as string[]).map((k, i) => (
                <View key={k} style={[s.toggleRow, i < (keys as string[]).length - 1 && s.toggleDivider]}>
                  <Text style={s.toggleLabel}>{PERM_LABELS[k] || k}</Text>
                  <Switch testID={`toggle-${k}`} value={!!perms[k]} onValueChange={() => toggle(k)} trackColor={{ true: "#0F766E", false: "#CBD5E1" }} />
                </View>
              ))}
            </View>
          </View>
        ))}

        {allOff && (
          <View style={s.warnCard}>
            <Feather name="alert-triangle" size={16} color="#D97706" />
            <Text style={s.warnTxt}>All permissions are OFF — this will restrict user access entirely.</Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={s.bottom}>
        <TouchableOpacity testID="perm-save" disabled={saving} style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={save}>
          {saving ? <ActivityIndicator color="#fff" /> : (
            <>
              <Feather name="save" size={16} color="#fff" />
              <Text style={s.saveTxt}>Save permissions</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  backBtn: { padding: 8 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#94A3B8" },
  h1: { fontSize: 22, fontWeight: "700", color: "#0F172A", marginTop: 2 },
  sub: { fontSize: 12, color: "#64748B", marginTop: 4 },
  scroll: { padding: 20, paddingTop: 12 },
  section: { fontSize: 13, fontWeight: "800", color: "#94A3B8", letterSpacing: 1, marginTop: 4, marginBottom: 8 },
  tmplRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  tmplBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#0F766E1A", borderRadius: 999 },
  tmplTxt: { fontSize: 12, fontWeight: "700", color: "#0F766E" },
  group: { marginBottom: 16 },
  groupTitle: { fontSize: 12, fontWeight: "800", color: "#94A3B8", letterSpacing: 1.2, marginBottom: 6 },
  card: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 14 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  toggleDivider: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  toggleLabel: { fontSize: 14, color: "#0F172A", flex: 1 },
  warnCard: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, backgroundColor: "#FEF3C7", borderRadius: 12, marginTop: 4 },
  warnTxt: { flex: 1, fontSize: 12, color: "#92400E", fontWeight: "600" },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginTop: 8 },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 28, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#0F766E", paddingVertical: 14, borderRadius: 14 },
  saveTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
  successBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14, backgroundColor: "#D1FAE5", borderRadius: 12, borderWidth: 1, borderColor: "#6EE7B7", marginBottom: 12 },
  successTxt: { flex: 1, fontSize: 14, color: "#047857", fontWeight: "800" },
  summaryCount: { fontSize: 12, fontWeight: "700", color: "#64748B", marginBottom: 14 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 },
  summaryLabel: { fontSize: 14, color: "#0F172A", flex: 1, fontWeight: "600" },
  editAgainBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: "#0F766E", backgroundColor: "#fff" },
  editAgainTxt: { color: "#0F766E", fontWeight: "800", fontSize: 14 },
});
