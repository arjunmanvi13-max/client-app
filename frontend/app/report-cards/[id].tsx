import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { api } from "../../src/auth";
import { formatDate } from "../../src/dateFormat";

const API_ROOT = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

async function downloadPdf(cardId: string, filename: string) {
  const token = Platform.OS === "web" && typeof window !== "undefined"
    ? window.localStorage.getItem("pws_alpha_token")
    : null;
  const res = await fetch(`${API_ROOT}/api/report-cards/${cardId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("PDF download failed");
  const blob = await res.blob();
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export default function ReportCardView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfBusy, setPdfBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/report-cards/${id}`);
      setCard(data);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onPdf = async () => {
    if (!card) return;
    setPdfBusy(true);
    try {
      await downloadPdf(card.id, `${(card.person_name || "report").replace(/\s+/g, "_")}_report_card.pdf`);
    } catch {
      // fallback: open in new tab on web (may fail without cookie auth)
      if (typeof window !== "undefined") window.open(`${API_ROOT}/api/report-cards/${card.id}/pdf`, "_blank");
    } finally {
      setPdfBusy(false);
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

  const branding = card.branding || {};

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.toolbar}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.toolbarTitle}>Report Card</Text>
        <TouchableOpacity onPress={onPdf} style={s.iconBtn} disabled={pdfBusy}>
          {pdfBusy ? <ActivityIndicator size="small" color="#1E40AF" /> : <Feather name="download" size={20} color="#1E40AF" />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.page}>
        <View style={s.sheet}>
          <View style={s.brandBar} />
          <Text style={s.school}>{branding.school_name || "Prarambhika World School"}</Text>
          {branding.tagline ? <Text style={s.tagline}>{branding.tagline}</Text> : null}
          <Text style={s.docTitle}>Report Card</Text>

          <View style={s.infoGrid}>
            <Info label="Student" value={card.person_name} />
            <Info label="Admission No." value={card.admission_number || "—"} />
            <Info label="Academic Year" value={card.academic_year_name || "—"} />
            <Info label="Grade / Section" value={`${card.grade_name || "—"} / ${card.section_label || "—"}`} />
            <Info label="Term" value={card.exam_term_name || "—"} />
            {card.percentage != null && (
              <Info label="Overall" value={`${card.percentage}% (${card.overall_grade || "—"})`} />
            )}
            {card.attendance_pct != null && (
              <Info label="Attendance" value={`${card.attendance_pct}%`} />
            )}
          </View>

          <View style={s.tableHead}>
            <Text style={[s.th, { flex: 2 }]}>Subject</Text>
            <Text style={s.th}>Marks</Text>
            <Text style={s.th}>%</Text>
            <Text style={s.th}>Grade</Text>
          </View>
          {(card.subjects || []).map((row: any, i: number) => (
            <View key={row.subject_id || i} style={s.tableRow}>
              <Text style={[s.td, { flex: 2 }]}>{row.subject_name}</Text>
              <Text style={s.td}>{row.marks_obtained}/{row.max_marks}</Text>
              <Text style={s.td}>{row.percentage ?? "—"}</Text>
              <Text style={s.td}>{row.grade || "—"}</Text>
            </View>
          ))}

          {card.teacher_remark ? (
            <View style={s.remarkBox}>
              <Text style={s.remarkLabel}>Class Teacher's Remark</Text>
              <Text style={s.remarkText}>{card.teacher_remark}</Text>
            </View>
          ) : null}

          {card.approved_coach_remark ? (
            <View style={s.remarkBox}>
              <Text style={s.remarkLabel}>Sports Coach Remark (Approved)</Text>
              <Text style={s.remarkText}>{card.approved_coach_remark}</Text>
            </View>
          ) : null}

          {card.status === "published" && card.published_at ? (
            <Text style={s.footer}>Published {formatDate(card.published_at)}</Text>
          ) : (
            <Text style={s.footerDraft}>Status: {card.status}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoCell}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#E2E8F0" },
  toolbar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 8, backgroundColor: "#F4F5F7" },
  iconBtn: { padding: 8, width: 40, alignItems: "center" },
  toolbarTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#0F172A" },
  page: { padding: 16, alignItems: "center" },
  sheet: {
    width: "100%",
    maxWidth: 720,
    backgroundColor: "#fff",
    borderRadius: 4,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  brandBar: { height: 4, backgroundColor: "#1E40AF", borderRadius: 2, marginBottom: 16 },
  school: { fontSize: 22, fontWeight: "800", color: "#1E40AF", textAlign: "center" },
  tagline: { fontSize: 11, color: "#64748B", textAlign: "center", marginTop: 4 },
  docTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", marginVertical: 16, color: "#0F172A" },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  infoCell: { width: "47%", marginBottom: 4 },
  infoLabel: { fontSize: 10, color: "#94A3B8", fontWeight: "600", textTransform: "uppercase" },
  infoValue: { fontSize: 13, color: "#0F172A", fontWeight: "600" },
  tableHead: { flexDirection: "row", borderBottomWidth: 2, borderBottomColor: "#1E40AF", paddingBottom: 6, marginTop: 8 },
  th: { flex: 1, fontSize: 11, fontWeight: "700", color: "#1E40AF" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F1F5F9", paddingVertical: 8 },
  td: { flex: 1, fontSize: 13, color: "#334155" },
  remarkBox: { marginTop: 16, padding: 12, backgroundColor: "#F8FAFC", borderRadius: 8, borderLeftWidth: 3, borderLeftColor: "#1E40AF" },
  remarkLabel: { fontSize: 11, fontWeight: "700", color: "#64748B", marginBottom: 4 },
  remarkText: { fontSize: 13, color: "#334155", lineHeight: 20 },
  footer: { marginTop: 20, fontSize: 10, color: "#94A3B8", textAlign: "center" },
  footerDraft: { marginTop: 20, fontSize: 11, color: "#F59E0B", textAlign: "center", fontWeight: "600" },
  empty: { textAlign: "center", marginTop: 40, color: "#94A3B8" },
});
