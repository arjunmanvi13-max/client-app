import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { api, useAuth } from "../../src/auth";

const TOKEN_KEY = "@auth_token";

async function getToken() {
  try { if (Platform.OS === "web") return localStorage.getItem(TOKEN_KEY); } catch {}
  try {
    const ss = (await import("expo-secure-store")) as any;
    return await ss.getItemAsync(TOKEN_KEY);
  } catch { return null; }
}

export default function BulkUpload() {
  const router = useRouter();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const allowed = user && (user.permissions?.bulk_upload || user.role === "super_admin");

  const downloadTemplate = async () => {
    try {
      const { data } = await api.get("/bulk-upload/template");
      // On web: trigger download; on native: just show in alert
      if (Platform.OS === "web") {
        const blob = new Blob([data], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "players_template.csv"; a.click();
        URL.revokeObjectURL(url);
      } else {
        Alert.alert("Template", "Open the URL on a desktop to save the CSV.");
      }
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to fetch template");
    }
  };

  const pickAndUpload = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({ type: ["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], copyToCacheDirectory: true });
      if (r.canceled) return;
      const asset = r.assets?.[0];
      if (!asset) return;
      setBusy(true); setResult(null);
      const fd = new FormData();
      if (Platform.OS === "web") {
        // On web, asset.file should be a File
        // @ts-ignore
        fd.append("file", asset.file || asset);
      } else {
        // @ts-ignore
        fd.append("file", { uri: asset.uri, name: asset.name, type: asset.mimeType || "text/csv" });
      }
      const token = await getToken();
      const url = `${process.env.EXPO_PUBLIC_BACKEND_URL || ""}/api/bulk-upload/players`;
      const resp = await fetch(url, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: fd as any });
      const data = await resp.json();
      setResult(data);
      if (resp.status >= 400 && data?.detail) Alert.alert("Error", data.detail);
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message || "Error");
    } finally { setBusy(false); }
  };

  if (!user) return null;
  if (!allowed) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}><Text style={s.h1}>Bulk Upload</Text></View>
        <View style={s.empty}><Feather name="lock" size={40} color="#94A3B8" /><Text style={s.emptyTitle}>bulk_upload permission required</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="bulk-back"><Feather name="chevron-left" size={22} color="#0F172A" /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>BULK UPLOAD</Text>
          <Text style={s.h1}>Players + Fees</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.card}>
          <Feather name="download" size={20} color="#1E40AF" />
          <Text style={s.cardTitle}>Step 1 – Download CSV template</Text>
          <Text style={s.cardBody}>Use the template to ensure all required columns are present (Name, Father's Name, Age, Mobile, Locality, City, Centre, Sport, Category, Slot, Skill Level, Date of Admission). Max 500 rows per upload.</Text>
          <TouchableOpacity testID="bulk-download" style={s.btnSecondary} onPress={downloadTemplate}><Feather name="download-cloud" size={14} color="#1E40AF" /><Text style={s.btnSecondaryTxt}>Download template</Text></TouchableOpacity>
        </View>

        <View style={s.card}>
          <Feather name="upload-cloud" size={20} color="#16A34A" />
          <Text style={s.cardTitle}>Step 2 – Upload file</Text>
          <Text style={s.cardBody}>Select a CSV or XLSX. The system will validate every row before inserting any data and auto-create fees for valid rows.</Text>
          <TouchableOpacity testID="bulk-upload-btn" style={[s.btnPrimary, busy && { opacity: 0.6 }]} disabled={busy} onPress={pickAndUpload}>
            {busy ? <ActivityIndicator color="#fff" /> : <><Feather name="upload" size={14} color="#fff" /><Text style={s.btnPrimaryTxt}>Pick file & upload</Text></>}
          </TouchableOpacity>
        </View>

        {result && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Result</Text>
            {result.status === "ok" ? (
              <View style={[s.resultPill, { backgroundColor: "#DCFCE7" }]}>
                <Feather name="check-circle" size={16} color="#16A34A" />
                <Text style={[s.resultTxt, { color: "#16A34A" }]}>Success! {result.players_created} players · {result.fees_created} fees auto-generated.</Text>
              </View>
            ) : (
              <View style={[s.resultPill, { backgroundColor: "#FEE2E2" }]}>
                <Feather name="x-circle" size={16} color="#EF4444" />
                <Text style={[s.resultTxt, { color: "#EF4444" }]}>Validation failed — {result.errors?.length || 0} row(s) had errors. No records were inserted.</Text>
              </View>
            )}
            {(result.errors || []).map((e: any, i: number) => (
              <View key={i} testID={`bulk-err-${i}`} style={s.errRow}>
                <Text style={s.errRowHdr}>Row {e.row}{e.name ? ` · ${e.name}` : ""}</Text>
                {(e.errors || []).map((msg: string, j: number) => <Text key={j} style={s.errRowMsg}>• {msg}</Text>)}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  backBtn: { padding: 8 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#94A3B8" },
  h1: { fontSize: 22, fontWeight: "700", color: "#0F172A", marginTop: 2 },
  scroll: { padding: 20 },
  card: { padding: 16, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#0F172A", marginTop: 8 },
  cardBody: { fontSize: 12, color: "#64748B", marginTop: 6, lineHeight: 18 },
  btnPrimary: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 12, paddingVertical: 12, backgroundColor: "#1E40AF", borderRadius: 12 },
  btnPrimaryTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },
  btnSecondary: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 12, paddingVertical: 12, backgroundColor: "#1E40AF1A", borderRadius: 12 },
  btnSecondaryTxt: { color: "#1E40AF", fontSize: 13, fontWeight: "800" },
  resultPill: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, marginTop: 8 },
  resultTxt: { fontSize: 12, fontWeight: "700", flex: 1 },
  errRow: { padding: 8, backgroundColor: "#FEF2F2", borderRadius: 8, marginTop: 6 },
  errRowHdr: { fontSize: 12, fontWeight: "800", color: "#991B1B" },
  errRowMsg: { fontSize: 11, color: "#991B1B", marginTop: 2 },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginTop: 8 },
});
