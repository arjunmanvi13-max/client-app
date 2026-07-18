import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { api, useAuth, userHasPermission } from "../../../src/auth";
import { BusinessEntity, Permission } from "../../../src/rbac";
import { canExportPdf, isReportCardLocked, ReportCardSheet } from "../../../src/reportCards/ReportCardSheet";

const CO_KEYS = [
  { key: "music_dramatics", label: "Music / Dramatics" },
  { key: "art_education", label: "Art / Education" },
  { key: "physical_education_yoga", label: "Physical Education / Yoga" },
] as const;

const GRADES = ["A", "B", "C", "D", "E", "A1", "A2", "B1", "B2", "C1", "C2"];

export default function ReportCardEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [card, setCard] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [remark, setRemark] = useState("");
  const [coGrades, setCoGrades] = useState<Record<string, string>>({});
  const [attPresent, setAttPresent] = useState("");
  const [attTotal, setAttTotal] = useState("");

  const isAdmin = userHasPermission(user, Permission.MANAGE_TEACHERS_MAP_SUBJECTS, BusinessEntity.PWS)
    || userHasPermission(user, Permission.MANAGE_TEACHERS_MAP_SECTIONS, BusinessEntity.PWS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/report-cards/${id}`);
      setCard(data);
      setRemark(data.teacher_remark || "");
      setCoGrades(data.co_scholastic || {});
      setAttPresent(data.attendance_present != null ? String(data.attendance_present) : "");
      setAttTotal(data.attendance_total != null ? String(data.attendance_total) : "");
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveDraft = async () => {
    if (!card || isReportCardLocked(card)) return;
    setSaving(true);
    try {
      const body: any = {
        teacher_remark: remark,
        co_scholastic: coGrades,
      };
      if (attPresent && attTotal) {
        body.attendance_present = parseInt(attPresent, 10);
        body.attendance_total = parseInt(attTotal, 10);
        body.attendance_display = `${attPresent}/${attTotal}`;
      }
      const { data } = await api.patch(`/report-cards/${id}`, body);
      setCard(data);
      Alert.alert("Saved", "Draft updated.");
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const finalize = async () => {
    if (!isAdmin) return;
    try {
      await saveDraft();
      await api.post(`/report-cards/${id}/finalize`);
      Alert.alert("Finalized", "Report card is locked. PDF export is now available.");
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Finalize failed");
    }
  };

  const publish = async () => {
    if (!isAdmin) return;
    try {
      await api.post(`/report-cards/${id}/publish`, {});
      Alert.alert("Published", "Parents can now view this report card.");
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Publish failed");
    }
  };

  const reopen = async () => {
    if (!isAdmin) return;
    const reason = Platform.OS === "web"
      ? window.prompt("Reason for reopening?") || ""
      : "";
    if (!reason.trim()) {
      Alert.alert("Reason required", "Provide a reason to reopen.");
      return;
    }
    try {
      await api.post(`/report-cards/${id}/reopen`, { reason: reason.trim() });
      Alert.alert("Reopened", "Report card is editable again.");
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Reopen failed");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <ActivityIndicator color="#1E40AF" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <Text style={s.empty}>Report card not found.</Text>
      </SafeAreaView>
    );
  }

  const locked = isReportCardLocked(card);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>ACADEMIC · REPORT CARD</Text>
          <Text style={s.h1}>{card.person_name}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push(`/report-cards/${id}`)} style={s.backBtn}>
          <Feather name="eye" size={20} color="#1E40AF" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <ReportCardSheet card={card} />

        {!locked && (
          <View style={s.form}>
            <Text style={s.section}>Co-Scholastic Grades</Text>
            {CO_KEYS.map((item) => (
              <View key={item.key} style={s.coRow}>
                <Text style={s.coLabel}>{item.label}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={s.chipRow}>
                    {GRADES.map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[s.chip, coGrades[item.key] === g && s.chipOn]}
                        onPress={() => setCoGrades((prev) => ({ ...prev, [item.key]: g }))}
                      >
                        <Text style={[s.chipTxt, coGrades[item.key] === g && s.chipTxtOn]}>{g}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            ))}

            <Text style={s.section}>Attendance</Text>
            <View style={s.row}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                keyboardType="number-pad"
                placeholder="Present"
                value={attPresent}
                onChangeText={setAttPresent}
              />
              <Text style={s.slash}>/</Text>
              <TextInput
                style={[s.input, { flex: 1 }]}
                keyboardType="number-pad"
                placeholder="Total days"
                value={attTotal}
                onChangeText={setAttTotal}
              />
            </View>

            <Text style={s.section}>Remarks</Text>
            <TextInput
              style={s.textArea}
              multiline
              placeholder="Teacher / principal remarks"
              value={remark}
              onChangeText={setRemark}
            />

            <TouchableOpacity style={s.btnSecondary} onPress={saveDraft} disabled={saving}>
              {saving ? <ActivityIndicator color="#1E40AF" /> : <Text style={s.btnSecondaryTxt}>Save draft</Text>}
            </TouchableOpacity>
          </View>
        )}

        {isAdmin && (
          <View style={s.actions}>
            {!locked && (
              <TouchableOpacity style={s.btnPrimary} onPress={finalize}>
                <Feather name="lock" size={16} color="#fff" />
                <Text style={s.btnPrimaryTxt}>Finalize</Text>
              </TouchableOpacity>
            )}
            {card.status === "finalized" && (
              <TouchableOpacity style={s.btnPrimary} onPress={publish}>
                <Feather name="send" size={16} color="#fff" />
                <Text style={s.btnPrimaryTxt}>Publish to parents</Text>
              </TouchableOpacity>
            )}
            {locked && (
              <TouchableOpacity style={s.btnDanger} onPress={reopen}>
                <Text style={s.btnDangerTxt}>Reopen (admin)</Text>
              </TouchableOpacity>
            )}
            {canExportPdf(card) && (
              <TouchableOpacity style={s.btnSecondary} onPress={() => router.push(`/report-cards/${id}`)}>
                <Text style={s.btnSecondaryTxt}>Preview & download PDF</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  backBtn: { padding: 8 },
  overline: { fontSize: 10, fontWeight: "700", color: "#64748B", letterSpacing: 1 },
  h1: { fontSize: 20, fontWeight: "700", color: "#0F172A" },
  scroll: { padding: 16, gap: 16, paddingBottom: 40 },
  form: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 12 },
  section: { fontSize: 13, fontWeight: "700", color: "#334155" },
  coRow: { gap: 8 },
  coLabel: { fontSize: 12, fontWeight: "600", color: "#475569" },
  chipRow: { flexDirection: "row", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: "#E2E8F0" },
  chipOn: { backgroundColor: "#1E40AF" },
  chipTxt: { fontSize: 12, color: "#475569", fontWeight: "600" },
  chipTxtOn: { color: "#fff" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  slash: { fontSize: 18, color: "#64748B" },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, padding: 10, backgroundColor: "#F8FAFC" },
  textArea: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, padding: 10, minHeight: 90, textAlignVertical: "top", backgroundColor: "#F8FAFC" },
  actions: { gap: 10 },
  btnPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#1E40AF", padding: 14, borderRadius: 10 },
  btnPrimaryTxt: { color: "#fff", fontWeight: "700" },
  btnSecondary: { alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "#CBD5E1", backgroundColor: "#fff" },
  btnSecondaryTxt: { color: "#1E40AF", fontWeight: "700" },
  btnDanger: { alignItems: "center", padding: 12, borderRadius: 10, backgroundColor: "#FEE2E2" },
  btnDangerTxt: { color: "#DC2626", fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 40, color: "#94A3B8" },
});
