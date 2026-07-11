import { useCallback, useEffect, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, useAuth } from "../../../src/auth";

type PlayerRow = {
  player_id: string;
  name: string;
  score: number | null;
  max_score: number | null;
  rating: string | null;
  coach_remark: string | null;
  status: string | null;
};

export default function CoachAssessmentEntry() {
  const router = useRouter();
  const { user } = useAuth();
  const [centre, setCentre] = useState<"Balua" | "Harding Park">("Balua");
  const [sport, setSport] = useState<"Cricket" | "Football">("Cricket");
  const [slot, setSlot] = useState<"Morning" | "Evening">("Morning");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [definitionId, setDefinitionId] = useState<string | null>(null);
  const [definition, setDefinition] = useState<any>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [draft, setDraft] = useState<Record<string, { score: string; rating: string; remark: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const canEnter = user?.role === "coach" || user?.role === "admin" || user?.role === "super_admin"
    || user?.permissions?.enter_coach_assessments;

  const loadDefinitions = useCallback(async () => {
    try {
      const { data } = await api.get("/coach-assessments/definitions", {
        params: { centre, sport, slot },
      });
      setDefinitions(data);
      if (!definitionId && data[0]) setDefinitionId(data[0].id);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to load assessments");
    }
  }, [centre, sport, slot, definitionId]);

  const loadGrid = useCallback(async () => {
    if (!definitionId) return;
    setLoading(true);
    try {
      const { data } = await api.get("/coach-assessments/grid", {
        params: { definition_id: definitionId, date, centre, sport, slot },
      });
      setDefinition(data.definition);
      setPlayers(data.players || []);
      const d: Record<string, { score: string; rating: string; remark: string }> = {};
      (data.players || []).forEach((p: PlayerRow) => {
        d[p.player_id] = {
          score: p.score != null ? String(p.score) : "",
          rating: p.rating || "",
          remark: p.coach_remark || "",
        };
      });
      setDraft(d);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to load grid");
    } finally {
      setLoading(false);
    }
  }, [definitionId, date, centre, sport, slot]);

  useFocusEffect(useCallback(() => { loadDefinitions(); }, [loadDefinitions]));
  useEffect(() => { loadGrid(); }, [loadGrid]);

  const save = async (status: "draft" | "final") => {
    if (!definitionId) return;
    setSaving(true);
    try {
      const max = definition?.max_score;
      const entries = players.map((p) => {
        const row = draft[p.player_id] || { score: "", rating: "", remark: "" };
        const score = row.score.trim() === "" ? null : Number(row.score);
        if (score != null && max && score > max) {
          throw new Error(`Score for ${p.name} exceeds max ${max}`);
        }
        return {
          player_id: p.player_id,
          score,
          rating: row.rating.trim() || null,
          coach_remark: row.remark.trim() || null,
        };
      });
      await api.post("/coach-assessments/batch", {
        definition_id: definitionId,
        date,
        centre,
        sport,
        slot,
        status,
        entries,
      });
      Alert.alert("Saved", status === "final" ? "Assessments finalized." : "Draft saved.");
      loadGrid();
    } catch (e: any) {
      Alert.alert("Error", e?.message || e?.response?.data?.detail || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!canEnter) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.denied}>Coach assessment entry is restricted to coaches.</Text>
      </SafeAreaView>
    );
  }

  const isRating = definition?.assessment_type === "rating";
  const ratingLabels: string[] = definition?.rating_labels || ["1", "2", "3", "4", "5"];

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>Player Assessment</Text>
          <Text style={s.sub}>{centre} · {sport} · {slot}</Text>
        </View>
        <TouchableOpacity style={[s.btn, s.draftBtn]} onPress={() => save("draft")} disabled={saving}>
          <Text style={s.draftTxt}>Draft</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={() => save("final")} disabled={saving}>
          <Text style={s.btnTxt}>Finalize</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={loading} onRefresh={loadGrid} />}>
        <ChipRow values={["Balua", "Harding Park"] as const} selected={centre} onSelect={setCentre} />
        <ChipRow values={["Cricket", "Football"] as const} selected={sport} onSelect={setSport} />
        <ChipRow values={["Morning", "Evening"] as const} selected={slot} onSelect={setSlot} />

        <Text style={s.label}>Assessment / test</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
          {definitions.map((d) => (
            <TouchableOpacity key={d.id} style={[s.chip, definitionId === d.id && s.chipOn]} onPress={() => setDefinitionId(d.id)}>
              <Text style={[s.chipTxt, definitionId === d.id && s.chipTxtOn]}>{d.name} ({d.assessment_type})</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {definition && (
          <Text style={s.hint}>
            Type: {definition.assessment_type}
            {definition.max_score ? ` · max ${definition.max_score}` : ""}
          </Text>
        )}

        {loading ? <ActivityIndicator color="#EA580C" style={{ marginTop: 20 }} /> : players.map((p) => (
          <View key={p.player_id} style={s.row} testID={`coach-asm-${p.player_id}`}>
            <Text style={s.name} numberOfLines={1}>{p.name}</Text>
            {isRating ? (
              <ScrollView horizontal style={s.ratingScroll}>
                {ratingLabels.map((lbl) => (
                  <TouchableOpacity
                    key={lbl}
                    style={[s.ratingChip, draft[p.player_id]?.rating === lbl && s.ratingOn]}
                    onPress={() => setDraft((d) => ({ ...d, [p.player_id]: { ...d[p.player_id], rating: lbl, score: d[p.player_id]?.score || "", remark: d[p.player_id]?.remark || "" } }))}
                  >
                    <Text style={[s.ratingTxt, draft[p.player_id]?.rating === lbl && { color: "#fff" }]}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <TextInput
                style={s.scoreInput}
                value={draft[p.player_id]?.score ?? ""}
                onChangeText={(v) => setDraft((d) => ({ ...d, [p.player_id]: { score: v.replace(/[^0-9.]/g, ""), rating: d[p.player_id]?.rating || "", remark: d[p.player_id]?.remark || "" } }))}
                keyboardType="numeric"
                placeholder={definition?.max_score ? `/ ${definition.max_score}` : "Score"}
                placeholderTextColor="#94A3B8"
              />
            )}
            <TextInput
              style={s.remarkInput}
              value={draft[p.player_id]?.remark ?? ""}
              onChangeText={(v) => setDraft((d) => ({ ...d, [p.player_id]: { remark: v, score: d[p.player_id]?.score || "", rating: d[p.player_id]?.rating || "" } }))}
              placeholder="Remark"
              placeholderTextColor="#94A3B8"
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChipRow<T extends string>({ values, selected, onSelect }: { values: readonly T[]; selected: T; onSelect: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
      {values.map((v) => (
        <TouchableOpacity key={v} style={[s.chip, selected === v && s.chipOn]} onPress={() => onSelect(v)}>
          <Text style={[s.chipTxt, selected === v && s.chipTxtOn]}>{v}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  backBtn: { padding: 8 },
  h1: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  sub: { fontSize: 12, color: "#64748B", marginTop: 2 },
  btn: { backgroundColor: "#EA580C", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  draftBtn: { backgroundColor: "#E2E8F0" },
  btnTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  draftTxt: { color: "#EA580C", fontWeight: "700", fontSize: 13 },
  scroll: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: "700", color: "#64748B", marginTop: 8, marginBottom: 6 },
  chipScroll: { flexGrow: 0, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#E2E8F0", marginRight: 8, backgroundColor: "#fff" },
  chipOn: { backgroundColor: "#EA580C", borderColor: "#EA580C" },
  chipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  chipTxtOn: { color: "#fff" },
  hint: { fontSize: 12, color: "#64748B", marginBottom: 8 },
  row: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  name: { fontSize: 14, fontWeight: "700", color: "#0F172A", marginBottom: 8 },
  scoreInput: { width: 80, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, padding: 8, textAlign: "center", fontWeight: "700", marginBottom: 8 },
  remarkInput: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, padding: 8, fontSize: 13, color: "#0F172A" },
  ratingScroll: { flexGrow: 0, marginBottom: 8 },
  ratingChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: "#E2E8F0", marginRight: 6, backgroundColor: "#fff" },
  ratingOn: { backgroundColor: "#EA580C", borderColor: "#EA580C" },
  ratingTxt: { fontSize: 11, fontWeight: "700", color: "#475569" },
  denied: { padding: 24, textAlign: "center", color: "#64748B" },
});
