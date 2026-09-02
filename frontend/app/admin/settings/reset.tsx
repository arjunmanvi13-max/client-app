import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, useAuth } from "../../../src/auth";
import { isSuperAdminUser } from "../../../src/rbac";
import { getApiError, LoadingState } from "../../../src/ScreenStates";
import { useSubmitGuard } from "../../../src/useSubmitGuard";

const PHRASE = "DELETE ALL DATA";

type Preview = {
  total_documents: number;
  counts: Record<string, number>;
  super_admins_kept: number;
  preserved_collections: string[];
};

type Scope = {
  include_academic_structure: boolean;
  include_finance_setup: boolean;
  include_login_accounts: boolean;
};

const SCOPE_LABELS: { key: keyof Scope; label: string; hint: string }[] = [
  {
    key: "include_academic_structure",
    label: "Academic structure",
    hint: "Years, grades, sections, subjects, exam terms, timetable",
  },
  {
    key: "include_finance_setup",
    label: "Finance setup",
    hint: "Fee catalogue, fee plans, expense heads, receipt counters",
  },
  {
    key: "include_login_accounts",
    label: "Login accounts",
    hint: "Every account except Super Admins — you are never removed",
  },
];

function prettyName(collection: string) {
  return collection.replace(/_/g, " ");
}

export default function FactoryReset() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const allowed = isSuperAdminUser(user);

  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState<Scope>({
    include_academic_structure: true,
    include_finance_setup: true,
    include_login_accounts: true,
  });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { submitting: checking, run: runCheck } = useSubmitGuard();
  const { submitting: wiping, run: runWipe } = useSubmitGuard();

  const body = useCallback(
    () => ({ password, confirmation: phrase.trim(), reason: reason.trim() || undefined, ...scope }),
    [password, phrase, reason, scope],
  );

  const phraseOk = phrase.trim() === PHRASE;
  const ready = phraseOk && password.length > 0;

  const check = () => runCheck(async () => {
    setError(null);
    setPreview(null);
    try {
      const { data } = await api.post<Preview>("/admin/factory-reset", body(), {
        params: { dry_run: true },
      });
      setPreview(data);
    } catch (e) {
      setError(getApiError(e, "Could not read the current data."));
    }
  });

  const wipe = () => {
    if (!preview) return;
    Alert.alert(
      "Erase everything?",
      `This permanently deletes ${preview.total_documents.toLocaleString()} records. It cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Erase",
          style: "destructive",
          onPress: () => {
            void runWipe(async () => {
              setError(null);
              try {
                const { data } = await api.post("/admin/factory-reset", body(), {
                  params: { dry_run: false },
                });
                setPreview(null);
                setPassword("");
                setPhrase("");
                Alert.alert(
                  data.status === "ok" ? "System cleared" : "Cleared with problems",
                  data.detail || `${data.total_deleted} records deleted.`,
                );
                router.replace("/dashboard");
              } catch (e) {
                setError(getApiError(e, "Reset failed. Nothing may have been deleted."));
              }
            });
          },
        },
      ],
    );
  };

  if (authLoading) return <LoadingState message="Checking access…" />;

  if (!allowed) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.denied}>
          <Feather name="lock" size={28} color="#B91C1C" />
          <Text style={s.deniedTitle}>Super Admin only</Text>
          <Text style={s.deniedBody}>Clearing the system is restricted to Super Admin accounts.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View>
          <Text style={s.overline}>SYSTEM & SETTINGS</Text>
          <Text style={s.h1}>Clear All Data</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.warnCard}>
          <Feather name="alert-triangle" size={20} color="#B91C1C" />
          <Text style={s.warnTitle}>This cannot be undone</Text>
          <Text style={s.warnBody}>
            Use this once, before going live, to remove demo and trial records. Super Admin
            accounts are always kept so you are never locked out. Take a database backup first.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Step 1 — Choose what to clear</Text>
          <Text style={s.cardBody}>
            Student, player and staff records, fees, attendance, marks, invoices and tasks are
            always cleared. These are optional.
          </Text>
          {SCOPE_LABELS.map((row) => (
            <TouchableOpacity
              key={row.key}
              testID={`scope-${row.key}`}
              style={s.checkRow}
              onPress={() => setScope((prev) => ({ ...prev, [row.key]: !prev[row.key] }))}
            >
              <View style={[s.checkbox, scope[row.key] && s.checkboxOn]}>
                {scope[row.key] ? <Feather name="check" size={13} color="#fff" /> : null}
              </View>
              <View style={s.checkText}>
                <Text style={s.checkLabel}>{row.label}</Text>
                <Text style={s.checkHint}>{row.hint}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Step 2 — Confirm it is you</Text>
          <Text style={s.label}>YOUR PASSWORD</Text>
          <TextInput
            testID="reset-password"
            style={s.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Re-enter your password"
            placeholderTextColor="#94A3B8"
            autoComplete="current-password"
          />
          <Text style={s.label}>TYPE {PHRASE} TO CONFIRM</Text>
          <TextInput
            testID="reset-phrase"
            style={[s.input, phrase.length > 0 && !phraseOk && s.inputBad]}
            value={phrase}
            onChangeText={setPhrase}
            placeholder={PHRASE}
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
          />
          <Text style={s.label}>REASON (OPTIONAL — KEPT IN THE AUDIT LOG)</Text>
          <TextInput
            testID="reset-reason"
            style={s.input}
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Clearing demo data before go-live"
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Step 3 — Review, then erase</Text>
          <Text style={s.cardBody}>
            Checking is safe — it only reports what would be deleted.
          </Text>
          <TouchableOpacity
            testID="reset-check"
            style={[s.btnSecondary, (!ready || checking) && { opacity: 0.5 }]}
            disabled={!ready || checking}
            onPress={check}
          >
            {checking
              ? <ActivityIndicator color="#1E40AF" />
              : <><Feather name="search" size={14} color="#1E40AF" /><Text style={s.btnSecondaryTxt}>Check what will be deleted</Text></>}
          </TouchableOpacity>

          {error ? <Text style={s.error} testID="reset-error">{error}</Text> : null}

          {preview ? (
            <View style={s.previewBox} testID="reset-preview">
              <Text style={s.previewTotal}>
                {preview.total_documents.toLocaleString()} records will be deleted
              </Text>
              <Text style={s.previewKept}>
                {preview.super_admins_kept} Super Admin account
                {preview.super_admins_kept === 1 ? "" : "s"} will be kept
              </Text>
              {Object.entries(preview.counts)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <View key={name} style={s.previewRow}>
                    <Text style={s.previewName}>{prettyName(name)}</Text>
                    <Text style={s.previewCount}>{count.toLocaleString()}</Text>
                  </View>
                ))}
              <TouchableOpacity
                testID="reset-confirm"
                style={[s.btnDanger, wiping && { opacity: 0.6 }]}
                disabled={wiping}
                onPress={wipe}
              >
                {wiping
                  ? <ActivityIndicator color="#fff" />
                  : <><Feather name="trash-2" size={14} color="#fff" /><Text style={s.btnDangerTxt}>Erase everything</Text></>}
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", backgroundColor: "#fff" },
  backBtn: { padding: 4 },
  overline: { fontSize: 10, fontWeight: "800", color: "#64748B", letterSpacing: 0.8 },
  h1: { fontSize: 20, fontWeight: "800", color: "#0F172A" },
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },
  warnCard: { backgroundColor: "#FEF2F2", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#FECACA", gap: 6 },
  warnTitle: { fontSize: 15, fontWeight: "800", color: "#B91C1C" },
  warnBody: { fontSize: 13, color: "#7F1D1D", lineHeight: 19 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#0F172A" },
  cardBody: { fontSize: 13, color: "#475569", lineHeight: 19 },
  label: { fontSize: 11, fontWeight: "700", color: "#64748B", letterSpacing: 0.4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: "#0F172A", backgroundColor: "#F8FAFC" },
  inputBad: { borderColor: "#EF4444", backgroundColor: "#FEF2F2" },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: "#94A3B8", alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkboxOn: { backgroundColor: "#B91C1C", borderColor: "#B91C1C" },
  checkText: { flex: 1 },
  checkLabel: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  checkHint: { fontSize: 12, color: "#64748B", marginTop: 2 },
  btnSecondary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: "#1E40AF", borderRadius: 8, paddingVertical: 11, marginTop: 6 },
  btnSecondaryTxt: { color: "#1E40AF", fontWeight: "700", fontSize: 13 },
  btnDanger: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#B91C1C", borderRadius: 8, paddingVertical: 12, marginTop: 14 },
  btnDangerTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  error: { color: "#B91C1C", fontSize: 13, marginTop: 8 },
  previewBox: { marginTop: 14, borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 12 },
  previewTotal: { fontSize: 16, fontWeight: "800", color: "#B91C1C" },
  previewKept: { fontSize: 12, color: "#16A34A", fontWeight: "700", marginTop: 2, marginBottom: 8 },
  previewRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  previewName: { fontSize: 13, color: "#334155", textTransform: "capitalize" },
  previewCount: { fontSize: 13, color: "#0F172A", fontWeight: "700" },
  denied: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 32 },
  deniedTitle: { fontSize: 17, fontWeight: "800", color: "#0F172A" },
  deniedBody: { fontSize: 13, color: "#64748B", textAlign: "center" },
});
