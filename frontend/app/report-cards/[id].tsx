import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { api, useAuth, userHasPermission } from "../../src/auth";
import { BusinessEntity, Permission } from "../../src/rbac";
import { canExportPdf, isReportCardLocked, ReportCardSheet } from "../../src/reportCards/ReportCardSheet";

const API_ROOT = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

async function downloadPdf(cardId: string, filename: string) {
  const token = Platform.OS === "web" && typeof window !== "undefined"
    ? window.localStorage.getItem("pws_alpha_token")
    : null;
  const res = await fetch(`${API_ROOT}/api/report-cards/${cardId}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "PDF download failed");
  }
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
  const { user } = useAuth();
  const [card, setCard] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const isAdmin = userHasPermission(user, Permission.MANAGE_TEACHERS_MAP_SUBJECTS, BusinessEntity.PWS)
    || userHasPermission(user, Permission.MANAGE_TEACHERS_MAP_SECTIONS, BusinessEntity.PWS);

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
    if (!card || !canExportPdf(card)) {
      Alert.alert("Not available", "Finalize the report card before exporting PDF.");
      return;
    }
    setBusy(true);
    try {
      await downloadPdf(card.id, `${(card.person_name || "report").replace(/\s+/g, "_")}_report_card.pdf`);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "PDF download failed");
    } finally {
      setBusy(false);
    }
  };

  const onEdit = () => router.push(`/admin/report-cards/${id}`);

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
      <View style={s.toolbar}>
        <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.toolbarTitle}>Report Card Preview</Text>
        <View style={s.toolbarActions}>
          {!locked && isAdmin && (
            <TouchableOpacity onPress={onEdit} style={s.iconBtn}>
              <Feather name="edit-2" size={18} color="#1E40AF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onPdf} style={s.iconBtn} disabled={busy || !canExportPdf(card)}>
            {busy ? (
              <ActivityIndicator size="small" color="#1E40AF" />
            ) : (
              <Feather name="download" size={20} color={canExportPdf(card) ? "#1E40AF" : "#94A3B8"} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.page}>
        <ReportCardSheet card={card} readOnly={locked} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#E2E8F0" },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "#F4F5F7",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  iconBtn: { padding: 8, width: 40, alignItems: "center" },
  toolbarTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#0F172A" },
  toolbarActions: { flexDirection: "row" },
  page: { padding: 16, alignItems: "stretch" },
  empty: { textAlign: "center", marginTop: 40, color: "#94A3B8" },
});
