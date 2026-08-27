import { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { api, useAuth, userHasPermission } from "../../src/auth";
import { Permission } from "../../src/rbac";
import { getApiError } from "../../src/ScreenStates";
import { useSubmitGuard } from "../../src/useSubmitGuard";

type UploadTarget = { key: string; label: string; path: string; blurb: string };

const TARGETS: UploadTarget[] = [
  { key: "all", label: "All sheets", path: "workbook", blurb: "Students, players, staff and teachers in one workbook." },
  { key: "student", label: "Students", path: "students", blurb: "PWS students with class, section, fee profile and transport." },
  { key: "player", label: "Players", path: "players", blurb: "ALPHA players with centre, sport, slot and fee overrides." },
  { key: "staff", label: "Staff", path: "staff", blurb: "Support staff with employee ID, department and contact." },
  { key: "teacher", label: "Teachers", path: "teachers", blurb: "Directory teachers with qualification and references." },
];

const PICKER_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const KIND_LABEL: Record<string, string> = {
  student: "students", player: "players", staff: "staff", teacher: "teachers",
};

export default function BulkUpload() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [target, setTarget] = useState<UploadTarget>(TARGETS[0]);
  const [result, setResult] = useState<any>(null);
  const [mode, setMode] = useState<"validate" | "import" | null>(null);
  const [limits, setLimits] = useState<{ rowLimit: number; maxMb: number } | null>(null);
  const { submitting: busy, run } = useSubmitGuard();
  const { submitting: downloading, run: runDownload } = useSubmitGuard();

  const allowed = userHasPermission(user, Permission.BULK_UPLOAD_USERS);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{ row_limit?: number; max_bytes?: number }>("/bulk-upload/schema");
        if (cancelled || !data) return;
        setLimits({
          rowLimit: data.row_limit ?? 500,
          maxMb: Math.round((data.max_bytes ?? 8 * 1024 * 1024) / (1024 * 1024)),
        });
      } catch {
      }
    })();
    return () => { cancelled = true; };
  }, [allowed]);

  const downloadTemplate = () => runDownload(async () => {
    try {
      const params = target.key === "all" ? {} : { kind: target.key };
      const { data } = await api.get("/bulk-upload/template", { params, responseType: "blob" });
      if (Platform.OS !== "web" || typeof window === "undefined") {
        Alert.alert("Template", "Open Bulk Upload on the web app to download the workbook.");
        return;
      }
      const url = window.URL.createObjectURL(data as Blob);
      const a = window.document.createElement("a");
      a.href = url;
      a.download = target.key === "all"
        ? "pws-alpha-bulk-upload.xlsx"
        : `pws-alpha-bulk-upload-${target.key}.xlsx`;
      window.document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      Alert.alert("Download failed", getApiError(e, "Could not fetch the template."));
    }
  });

  const pickAndSend = (dryRun: boolean) => run(async () => {
    const picked = await DocumentPicker.getDocumentAsync({
      type: PICKER_TYPES,
      copyToCacheDirectory: true,
    });
    if (picked.canceled) return;
    const asset = picked.assets?.[0];
    if (!asset) return;

    setResult(null);
    setMode(dryRun ? "validate" : "import");
    const fd = new FormData();
    if (Platform.OS === "web") {
      // @ts-ignore - on web the picker returns a File
      fd.append("file", asset.file || asset);
    } else {
      // @ts-ignore - native needs the uri/name/type triple
      fd.append("file", { uri: asset.uri, name: asset.name, type: asset.mimeType || "text/csv" });
    }
    try {
      const { data } = await api.post(`/bulk-upload/${target.path}`, fd, {
        params: { dry_run: dryRun },
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
    } catch (e: any) {
      const body = e?.response?.data;
      if (body && typeof body === "object" && (body.errors || body.status)) {
        setResult(body);
      } else {
        Alert.alert("Upload failed", getApiError(e, "Could not process the file."));
      }
    }
  });

  if (authLoading || !user) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.empty}><ActivityIndicator size="small" color="#1E40AF" /></View>
      </SafeAreaView>
    );
  }
  if (!allowed) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}><Text style={s.h1}>Bulk Upload</Text></View>
        <View style={s.empty}>
          <Feather name="lock" size={40} color="#94A3B8" />
          <Text style={s.emptyTitle}>bulk_upload permission required</Text>
        </View>
      </SafeAreaView>
    );
  }

  const counts = result?.counts || {};
  const countLine = Object.keys(counts).length
    ? Object.entries(counts).map(([k, v]) => `${v} ${KIND_LABEL[k] || k}`).join(" · ")
    : "";

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="bulk-back">
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>BULK UPLOAD</Text>
          <Text style={s.h1}>Import records from a sheet</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.card}>
          <Text style={s.cardTitle}>What are you importing?</Text>
          <View style={s.chipRow}>
            {TARGETS.map((t) => {
              const active = t.key === target.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  testID={`bulk-target-${t.key}`}
                  onPress={() => { setTarget(t); setResult(null); }}
                  style={[s.chip, active && s.chipActive]}
                >
                  <Text style={[s.chipTxt, active && s.chipTxtActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={s.cardBody}>{target.blurb}</Text>
        </View>

        <View style={s.card}>
          <Feather name="download" size={20} color="#1E40AF" />
          <Text style={s.cardTitle}>Step 1 — Download the template</Text>
          <Text style={s.cardBody}>
            An Excel workbook with one sheet per record type. Row 1 is the column name,
            row 2 explains the column and is ignored on upload. Required columns are marked *.
            Dropdown columns only accept listed values. Delete the sample rows before importing.
            {limits ? ` Up to ${limits.rowLimit} rows per sheet, ${limits.maxMb} MB per file.` : ""}
          </Text>
          <TouchableOpacity
            testID="bulk-download"
            style={[s.btnSecondary, downloading && { opacity: 0.6 }]}
            disabled={downloading}
            onPress={downloadTemplate}
          >
            <Feather name="download-cloud" size={14} color="#1E40AF" />
            <Text style={s.btnSecondaryTxt}>{downloading ? "Preparing…" : "Download template"}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <Feather name="check-square" size={20} color="#B45309" />
          <Text style={s.cardTitle}>Step 2 — Check the file (nothing is saved)</Text>
          <Text style={s.cardBody}>
            Runs every validation and reports problems row by row without writing anything.
          </Text>
          <TouchableOpacity
            testID="bulk-validate-btn"
            style={[s.btnWarn, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={() => pickAndSend(true)}
          >
            {busy && mode === "validate"
              ? <ActivityIndicator color="#92400E" />
              : <><Feather name="search" size={14} color="#92400E" /><Text style={s.btnWarnTxt}>Pick file & check</Text></>}
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <Feather name="upload-cloud" size={20} color="#16A34A" />
          <Text style={s.cardTitle}>Step 3 — Import</Text>
          <Text style={s.cardBody}>
            All rows are validated first. If any row fails, nothing is saved. Fees are
            generated automatically for imported students and players.
          </Text>
          <TouchableOpacity
            testID="bulk-upload-btn"
            style={[s.btnPrimary, busy && { opacity: 0.6 }]}
            disabled={busy}
            onPress={() => Alert.alert(
              "Import to the database?",
              `This writes ${target.label.toLowerCase()} records and generates their fee schedules. Run "Check the file" first if you have not.`,
              [
                { text: "Cancel", style: "cancel" },
                { text: "Import", style: "destructive", onPress: () => { void pickAndSend(false); } },
              ],
            )}
          >
            {busy && mode === "import"
              ? <ActivityIndicator color="#fff" />
              : <><Feather name="upload" size={14} color="#fff" /><Text style={s.btnPrimaryTxt}>Pick file & import</Text></>}
          </TouchableOpacity>
        </View>

        {result && (
          <View style={s.card} testID="bulk-result">
            <Text style={s.cardTitle}>Result</Text>

            {result.status === "ok" && result.dry_run && (
              <View style={[s.resultPill, { backgroundColor: "#DBEAFE" }]}>
                <Feather name="check-circle" size={16} color="#1D4ED8" />
                <Text style={[s.resultTxt, { color: "#1D4ED8" }]}>
                  {countLine || "No rows"} ready to import. Nothing has been saved yet.
                </Text>
              </View>
            )}

            {result.status === "ok" && !result.dry_run && (
              <View style={[s.resultPill, { backgroundColor: "#DCFCE7" }]}>
                <Feather name="check-circle" size={16} color="#16A34A" />
                <Text style={[s.resultTxt, { color: "#16A34A" }]}>
                  Imported {countLine || "0 records"}.
                  {result.pending_fee_approvals
                    ? ` ${result.pending_fee_approvals} awaiting fee approval.`
                    : ""}
                </Text>
              </View>
            )}

            {result.status !== "ok" && (
              <View style={[s.resultPill, { backgroundColor: "#FEE2E2" }]}>
                <Feather name="x-circle" size={16} color="#EF4444" />
                <Text style={[s.resultTxt, { color: "#EF4444" }]}>
                  {result.errors?.length || 0} row(s) need fixing. Nothing was saved.
                </Text>
              </View>
            )}

            {(result.warnings || []).map((w: any, i: number) => (
              <View key={`w${i}`} testID={`bulk-warn-${i}`} style={s.warnRow}>
                <Text style={s.warnRowHdr}>
                  {w.sheet} row {w.row}{w.name ? ` · ${w.name}` : ""}
                </Text>
                <Text style={s.warnRowMsg}>• {w.warning}</Text>
              </View>
            ))}

            {(result.errors || []).map((e: any, i: number) => (
              <View key={`e${i}`} testID={`bulk-err-${i}`} style={s.errRow}>
                <Text style={s.errRowHdr}>
                  {e.sheet ? `${e.sheet} ` : ""}row {e.row}{e.name ? ` · ${e.name}` : ""}
                </Text>
                {(e.errors || []).map((msg: string, j: number) => (
                  <Text key={j} style={s.errRowMsg}>• {msg}</Text>
                ))}
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
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: "#F1F5F9", borderWidth: 1, borderColor: "#E2E8F0" },
  chipActive: { backgroundColor: "#1E40AF", borderColor: "#1E40AF" },
  chipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  chipTxtActive: { color: "#fff" },
  btnPrimary: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 12, paddingVertical: 12, backgroundColor: "#1E40AF", borderRadius: 12 },
  btnPrimaryTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },
  btnSecondary: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 12, paddingVertical: 12, backgroundColor: "#1E40AF1A", borderRadius: 12 },
  btnSecondaryTxt: { color: "#1E40AF", fontSize: 13, fontWeight: "800" },
  btnWarn: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 12, paddingVertical: 12, backgroundColor: "#FEF3C7", borderRadius: 12 },
  btnWarnTxt: { color: "#92400E", fontSize: 13, fontWeight: "800" },
  resultPill: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, marginTop: 8 },
  resultTxt: { fontSize: 12, fontWeight: "700", flex: 1 },
  errRow: { padding: 8, backgroundColor: "#FEF2F2", borderRadius: 8, marginTop: 6 },
  errRowHdr: { fontSize: 12, fontWeight: "800", color: "#991B1B" },
  errRowMsg: { fontSize: 11, color: "#991B1B", marginTop: 2 },
  warnRow: { padding: 8, backgroundColor: "#FFFBEB", borderRadius: 8, marginTop: 6 },
  warnRowHdr: { fontSize: 12, fontWeight: "800", color: "#92400E" },
  warnRowMsg: { fontSize: 11, color: "#92400E", marginTop: 2 },
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginTop: 8 },
});
