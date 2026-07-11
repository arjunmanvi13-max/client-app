import { useCallback, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, useAuth } from "../../../src/auth";

export default function CoachAssessmentAdmin() {
  const router = useRouter();
  const { user } = useAuth();
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("Sprint Test");
  const [atype, setAtype] = useState<"rating" | "score" | "test">("score");
  const [sport, setSport] = useState<"Cricket" | "Football">("Cricket");
  const [centre, setCentre] = useState<"Balua" | "Harding Park">("Balua");
  const [slot, setSlot] = useState<"Morning" | "Evening">("Morning");
  const [maxScore, setMaxScore] = useState("100");
  const [publishDefId, setPublishDefId] = useState<string | null>(null);
  const [publishDate, setPublishDate] = useState(new Date().toISOString().slice(0, 10));

  const canManage = user?.role === "super_admin" || user?.role === "admin"
    || user?.permissions?.manage_coach_assessments;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/coach-assessments/definitions");
      setDefinitions(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    try {
      await api.post("/coach-assessments/definitions", {
        name: name.trim(),
        assessment_type: atype,
        sport,
        centre,
        slot,
        max_score: atype === "rating" ? undefined : Number(maxScore) || 100,
      });
      setName("");
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed");
    }
  };

  const publish = async () => {
    if (!publishDefId) return;
    try {
      const r = await api.post("/coach-assessments/publish", {
        definition_id: publishDefId,
        date: publishDate,
      });
      Alert.alert("Published", `${r.data.published} records published.`);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed");
    }
  };

  if (!canManage) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.denied}>Coach assessment configuration requires admin access.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.h1}>Coach Assessment Config</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
        <View style={s.card}>
          <Text style={s.cardTitle}>Definitions</Text>
          {definitions.map((d) => (
            <Text key={d.id} style={s.rowTxt}>{d.name} · {d.sport} · {d.assessment_type}{d.max_score ? ` /${d.max_score}` : ""}</Text>
          ))}
          <TextInput value={name} onChangeText={setName} placeholder="Assessment name" style={s.input} placeholderTextColor="#94A3B8" />
          <ScrollView horizontal style={s.chipScroll}>
            {(["rating", "score", "test"] as const).map((t) => (
              <TouchableOpacity key={t} style={[s.chip, atype === t && s.chipOn]} onPress={() => setAtype(t)}>
                <Text style={[s.chipTxt, atype === t && s.chipTxtOn]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {atype !== "rating" && (
            <TextInput value={maxScore} onChangeText={setMaxScore} placeholder="Max score" keyboardType="numeric" style={s.input} placeholderTextColor="#94A3B8" />
          )}
          <TouchableOpacity style={s.btn} onPress={create}><Text style={s.btnTxt}>Create definition</Text></TouchableOpacity>
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>Publish finalized assessments</Text>
          <TextInput value={publishDate} onChangeText={setPublishDate} placeholder="Date YYYY-MM-DD" style={s.input} placeholderTextColor="#94A3B8" />
          <ScrollView horizontal style={s.chipScroll}>
            {definitions.map((d) => (
              <TouchableOpacity key={d.id} style={[s.chip, publishDefId === d.id && s.chipOn]} onPress={() => setPublishDefId(d.id)}>
                <Text style={[s.chipTxt, publishDefId === d.id && s.chipTxtOn]}>{d.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={s.btn} onPress={publish}><Text style={s.btnTxt}>Publish</Text></TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8, gap: 8 },
  backBtn: { padding: 8 },
  h1: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  scroll: { padding: 20 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "800", marginBottom: 8 },
  rowTxt: { fontSize: 13, color: "#475569", paddingVertical: 4 },
  input: { borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, padding: 10, marginBottom: 8, fontSize: 14 },
  btn: { backgroundColor: "#EA580C", padding: 12, borderRadius: 10, alignItems: "center" },
  btnTxt: { color: "#fff", fontWeight: "700" },
  chipScroll: { flexGrow: 0, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#E2E8F0", marginRight: 8 },
  chipOn: { backgroundColor: "#EA580C", borderColor: "#EA580C" },
  chipTxt: { fontSize: 12, fontWeight: "700", color: "#475569" },
  chipTxtOn: { color: "#fff" },
  denied: { padding: 24, textAlign: "center", color: "#64748B" },
});
