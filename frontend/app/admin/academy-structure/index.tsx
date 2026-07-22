import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, useAuth } from "../../../src/auth";
import { LoadingState, ErrorState, getApiError } from "../../../src/ScreenStates";
import { colors, radii, spacing } from "../../../src/theme";

const CATEGORIES = ["Day Boarding", "Boarding", "Hostel", "Daily Players"] as const;

type EntityKey = "PWS" | "ALPHA";

type BaselineForm = Record<EntityKey, Record<string, string>>;

const EMPTY_FORM: BaselineForm = {
  PWS: Object.fromEntries(CATEGORIES.map((c) => [c, "0"])),
  ALPHA: Object.fromEntries(CATEGORIES.map((c) => [c, "0"])),
};

export default function AcademyStructureAdmin() {
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState<BaselineForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<EntityKey | null>(null);
  const [error, setError] = useState("");

  const isSuperAdmin = user?.role === "super_admin";

  const load = useCallback(async () => {
    setError("");
    try {
      const { data } = await api.get("/academy-structure");
      const next: BaselineForm = { ...EMPTY_FORM };
      for (const ent of ["PWS", "ALPHA"] as EntityKey[]) {
        const cats = data?.entities?.[ent]?.categories || {};
        for (const cat of CATEGORIES) {
          next[ent][cat] = String(cats[cat] ?? 0);
        }
      }
      setForm(next);
    } catch (e: any) {
      setError(getApiError(e, "Could not load academy structure."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateField = (entity: EntityKey, category: string, value: string) => {
    const digits = value.replace(/[^\d]/g, "");
    setForm((prev) => ({
      ...prev,
      [entity]: { ...prev[entity], [category]: digits },
    }));
  };

  const saveEntity = async (entity: EntityKey) => {
    setSaving(entity);
    try {
      const categories = Object.fromEntries(
        CATEGORIES.map((cat) => [cat, parseInt(form[entity][cat] || "0", 10) || 0]),
      );
      await api.put(`/academy-structure/${entity}`, { categories });
      Alert.alert("Saved", `${entity} baselines updated.`);
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to save baselines.");
    } finally {
      setSaving(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.denied}>Academy Structure is restricted to Super Admin.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="academy-structure-back">
          <Feather name="chevron-left" size={22} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>Academy Structure</Text>
          <Text style={s.sub}>Seat capacity baselines for PWS and ALPHA enrollment planning</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {loading ? (
          <LoadingState message="Loading baselines…" compact />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          (["PWS", "ALPHA"] as EntityKey[]).map((entity) => (
            <View key={entity} style={s.card}>
              <View style={s.cardHead}>
                <Feather name={entity === "PWS" ? "book-open" : "award"} size={18} color={colors.primary} />
                <Text style={s.cardTitle}>{entity} capacity baselines</Text>
              </View>
              <Text style={s.cardHint}>
                Maximum seat counts used on the Super Admin dashboard for enrollment gap tracking.
              </Text>

              {CATEGORIES.map((cat) => (
                <View key={`${entity}-${cat}`} style={s.fieldRow}>
                  <Text style={s.fieldLabel}>{cat}</Text>
                  <TextInput
                    testID={`baseline-${entity}-${cat}`}
                    value={form[entity][cat]}
                    onChangeText={(v) => updateField(entity, cat, v)}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.hint}
                    style={s.input}
                  />
                </View>
              ))}

              <TouchableOpacity
                testID={`save-baselines-${entity}`}
                style={s.saveBtn}
                disabled={saving === entity}
                onPress={() => saveEntity(entity)}
              >
                {saving === entity ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.saveBtnText}>Save {entity} baselines</Text>
                )}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  denied: { padding: 24, color: colors.muted, fontSize: 15 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 8 },
  h1: { fontSize: 22, fontWeight: "800", color: colors.ink },
  sub: { fontSize: 13, color: colors.muted2, marginTop: 4 },
  scroll: { padding: spacing.lg, paddingBottom: 80, gap: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 10,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  cardHint: { fontSize: 12, color: colors.muted2, marginBottom: 4 },
  fieldRow: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: "700", color: colors.muted },
  input: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  saveBtn: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
