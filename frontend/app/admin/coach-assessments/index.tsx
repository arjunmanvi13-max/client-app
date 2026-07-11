import { useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, useAuth } from "../../../src/auth";
import { formatDate, DATE_PLACEHOLDER, toISODate, parseToISO } from "../../../src/dateFormat";
import { colors, radii, spacing } from "../../../src/theme";
import { getApiError } from "../../../src/ScreenStates";

const STAGES = [
  { id: "week_1_baseline", label: "Week 1 - Baseline" },
  { id: "week_4_progress", label: "Week 4 - Progress" },
  { id: "week_8_12_final", label: "Week 8-12 - Final" },
] as const;
const PLAYER_TYPES = ["Daily", "Day Boarding", "Hostel", "Boarding"] as const;
const SESSIONS = ["Morning", "Evening"] as const;

export default function CoachAssessmentAdmin() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [centre, setCentre] = useState<"Balua" | "Harding Park">("Balua");
  const [sport, setSport] = useState<"Cricket" | "Football">("Cricket");
  const [playerType, setPlayerType] = useState<typeof PLAYER_TYPES[number]>("Daily");
  const [session, setSession] = useState<typeof SESSIONS[number]>("Morning");
  const [stage, setStage] = useState<typeof STAGES[number]["id"]>("week_1_baseline");
  const [publishDate, setPublishDate] = useState(formatDate(toISODate()));
  const [reopenReason, setReopenReason] = useState("");

  const canManage = user?.role === "super_admin" || user?.role === "admin"
    || user?.permissions?.manage_coach_assessments;

  const batchPayload = () => {
    const date = parseToISO(publishDate) || publishDate;
    const payload: Record<string, string> = {
      centre, sport, player_type: playerType, assessment_stage: stage, date,
    };
    if (playerType === "Daily") payload.session = session;
    return payload;
  };

  const publish = async () => {
    setLoading(true);
    try {
      const r = await api.post("/coach-assessments/publish", batchPayload());
      Alert.alert("Published", `${r.data.published} assessment(s) published for parents.`);
    } catch (e: any) {
      Alert.alert("Error", getApiError(e, "Failed to publish"));
    } finally {
      setLoading(false);
    }
  };

  const reopen = async () => {
    if (!reopenReason.trim()) {
      Alert.alert("Reason required", "Enter a reason for reopening this assessment batch.");
      return;
    }
    setLoading(true);
    try {
      const r = await api.post("/coach-assessments/reopen", { ...batchPayload(), reason: reopenReason.trim() });
      Alert.alert("Reopened", `${r.data.reopened} record(s) reopened as drafts. Audit logged.`);
      setReopenReason("");
    } catch (e: any) {
      Alert.alert("Error", getApiError(e, "Failed to reopen"));
    } finally {
      setLoading(false);
    }
  };

  if (!canManage) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.denied}>Coach assessment administration requires admin access.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="chevron-left" size={22} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.overline}>OPERATIONS · ADMIN</Text>
          <Text style={s.h1}>Coach Assessments</Text>
          <Text style={s.sub}>Publish finalized batches to parents or reopen with audit.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => {}} />}>
        <View style={s.card}>
          <Text style={s.cardTitle}>Batch scope</Text>
          <ChipRow label="Centre" values={["Balua", "Harding Park"]} selected={centre} onSelect={setCentre as any} />
          <ChipRow label="Sport" values={["Cricket", "Football"]} selected={sport} onSelect={setSport as any} />
          <ChipRow label="Player type" values={PLAYER_TYPES} selected={playerType} onSelect={setPlayerType as any} />
          {playerType === "Daily" && (
            <ChipRow label="Session type" values={SESSIONS} selected={session} onSelect={setSession as any} />
          )}
          <Text style={s.label}>Assessment stage</Text>
          <View style={s.stageRow}>
            {STAGES.map((st) => (
              <TouchableOpacity key={st.id} style={[s.stageChip, stage === st.id && s.stageChipOn]} onPress={() => setStage(st.id)}>
                <Text style={[s.stageTxt, stage === st.id && s.stageTxtOn]}>{st.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.label}>Assessment date</Text>
          <TextInput value={publishDate} onChangeText={setPublishDate} placeholder={DATE_PLACEHOLDER} placeholderTextColor={colors.hint} style={s.input} />
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Publish to parents</Text>
          <Text style={s.hint}>Promotes all finalized records in this batch to published (parent-visible).</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={publish} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnTxt}>Publish batch</Text>}
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Reopen finalized batch</Text>
          <Text style={s.hint}>Returns finalized or published records to draft. Creates an audit entry with previous values.</Text>
          <TextInput value={reopenReason} onChangeText={setReopenReason} placeholder="Reason for reopening…" placeholderTextColor={colors.hint} style={[s.input, { minHeight: 72 }]} multiline />
          <TouchableOpacity style={s.outlineBtn} onPress={reopen} disabled={loading}>
            <Text style={s.outlineBtnTxt}>Reopen batch</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChipRow<T extends string>({ label, values, selected, onSelect }: {
  label: string; values: readonly T[]; selected: T; onSelect: (v: T) => void;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.label}>{label}</Text>
      <View style={s.chipRow}>
        {values.map((v) => (
          <TouchableOpacity key={v} style={[s.chip, selected === v && s.chipOn]} onPress={() => onSelect(v)}>
            <Text style={[s.chipTxt, selected === v && s.chipTxtOn]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: 8 },
  backBtn: { padding: 8, borderRadius: radii.sm, backgroundColor: colors.primarySofter },
  overline: { fontSize: 10, color: colors.primary, fontWeight: "800", letterSpacing: 0.8 },
  h1: { fontSize: 22, fontWeight: "800", color: colors.ink, marginTop: 2 },
  sub: { fontSize: 12, color: colors.muted2, marginTop: 4 },
  scroll: { padding: spacing.lg, paddingBottom: 40, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 8 },
  cardTitle: { fontSize: 14, fontWeight: "800", color: colors.ink, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.muted2, lineHeight: 17 },
  label: { fontSize: 11, fontWeight: "700", color: colors.muted2, marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 10, fontSize: 13, color: colors.ink, backgroundColor: colors.surface2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  chipTxtOn: { color: "#fff" },
  stageRow: { gap: 6 },
  stageChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  stageChipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  stageTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  stageTxtOn: { color: colors.primary },
  primaryBtn: { backgroundColor: colors.primary, paddingVertical: 12, borderRadius: radii.md, alignItems: "center", marginTop: 8 },
  primaryBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  outlineBtn: { borderWidth: 1.5, borderColor: colors.primary, paddingVertical: 12, borderRadius: radii.md, alignItems: "center", marginTop: 8, backgroundColor: colors.primarySofter },
  outlineBtnTxt: { color: colors.primary, fontWeight: "800", fontSize: 13 },
  denied: { padding: 24, textAlign: "center", color: colors.muted2 },
});
