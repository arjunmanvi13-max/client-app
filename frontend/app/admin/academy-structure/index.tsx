import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, useAuth } from "../../../src/auth";
import { LoadingState, ErrorState, getApiError } from "../../../src/ScreenStates";
import { useBreakpoint } from "../../../src/useBreakpoint";
import { colors, radii, spacing } from "../../../src/theme";
import {
  ALPHA_CATEGORY_FIELDS,
  ALPHA_SPORTS,
  PWS_CLASS_FIELDS,
  alphaBaselineFromApi,
  emptyAlphaBaselineStrings,
  emptyPwsBaselineStrings,
  parseAlphaBaseline,
  parsePwsBaseline,
  pwsBaselineFromApi,
  sumAlphaBaseline,
  sumPwsBaseline,
  type AlphaCategoryKey,
  type AlphaSportKey,
  type PwsClassKey,
} from "../../../src/academyStructureTypes";

export default function AcademyStructureAdmin() {
  const router = useRouter();
  const { user } = useAuth();
  const { isWide, horizontalPadding, contentMaxWidth } = useBreakpoint();
  const [pwsForm, setPwsForm] = useState(emptyPwsBaselineStrings());
  const [alphaForm, setAlphaForm] = useState(emptyAlphaBaselineStrings());
  const [loading, setLoading] = useState(true);
  const [savingPws, setSavingPws] = useState(false);
  const [savingAlpha, setSavingAlpha] = useState(false);
  const [error, setError] = useState("");

  const isSuperAdmin = user?.role === "super_admin";

  const pwsTotal = useMemo(() => sumPwsBaseline(pwsForm), [pwsForm]);
  const alphaTotals = useMemo(() => sumAlphaBaseline(alphaForm), [alphaForm]);

  const load = useCallback(async () => {
    setError("");
    try {
      const { data } = await api.get("/academy-structure");
      setPwsForm(pwsBaselineFromApi(data?.entities?.PWS?.pws_classes));
      setAlphaForm(alphaBaselineFromApi(data?.entities?.ALPHA?.alpha_matrix));
    } catch (e: any) {
      setError(getApiError(e, "Could not load structure baselines."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updatePwsField = (key: PwsClassKey, value: string) => {
    const digits = value.replace(/[^\d]/g, "");
    setPwsForm((prev) => ({ ...prev, [key]: digits }));
  };

  const updateAlphaField = (category: AlphaCategoryKey, sport: AlphaSportKey, value: string) => {
    const digits = value.replace(/[^\d]/g, "");
    setAlphaForm((prev) => ({
      ...prev,
      [category]: { ...prev[category], [sport]: digits },
    }));
  };

  const savePws = async () => {
    setSavingPws(true);
    try {
      await api.put("/academy-structure/PWS", { pws_classes: parsePwsBaseline(pwsForm) });
      Alert.alert("Saved", "PWS baselines updated.");
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to save PWS baselines.");
    } finally {
      setSavingPws(false);
    }
  };

  const saveAlpha = async () => {
    setSavingAlpha(true);
    try {
      await api.put("/academy-structure/ALPHA", { alpha_matrix: parseAlphaBaseline(alphaForm) });
      Alert.alert("Saved", "ALPHA baselines updated.");
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to save ALPHA baselines.");
    } finally {
      setSavingAlpha(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <SafeAreaView style={s.safe}>
        <Text style={s.denied}>ALPHA/PWS Structure is restricted to Super Admin.</Text>
      </SafeAreaView>
    );
  }

  const pageStyle = {
    paddingHorizontal: horizontalPadding,
    maxWidth: contentMaxWidth ? Math.min(contentMaxWidth, 1280) : undefined,
    alignSelf: contentMaxWidth ? ("center" as const) : undefined,
    width: contentMaxWidth ? ("100%" as const) : undefined,
  };

  let lastPwsGroup = "";

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={[s.header, pageStyle]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="academy-structure-back">
          <Feather name="chevron-left" size={22} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>ALPHA/PWS Structure</Text>
          <Text style={s.sub}>Class-wise and sport-wise seat capacity baselines</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[s.scroll, pageStyle]}>
        {loading ? (
          <LoadingState message="Loading baselines…" compact />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
          <View style={[s.grid, isWide && s.gridWide]}>
            <View style={s.card}>
              <View style={s.cardHead}>
                <Feather name="book-open" size={16} color={colors.primary} />
                <Text style={s.cardTitle}>PWS capacity baselines</Text>
                <View style={s.totalBadge}>
                  <Text style={s.totalBadgeTxt}>Total: {pwsTotal}</Text>
                </View>
              </View>
              <Text style={s.cardHint}>Class-wise maximum seats for enrollment gap tracking.</Text>

              <View style={s.pwsGrid}>
                {PWS_CLASS_FIELDS.map((field) => {
                  const showGroup = field.group !== lastPwsGroup;
                  lastPwsGroup = field.group;
                  return (
                    <View key={field.key} style={s.pwsCell}>
                      {showGroup ? <Text style={s.groupLabel}>{field.group}</Text> : null}
                      <Text style={s.fieldLabel}>{field.label}</Text>
                      <TextInput
                        testID={`baseline-pws-${field.key}`}
                        value={pwsForm[field.key]}
                        onChangeText={(v) => updatePwsField(field.key, v)}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={colors.hint}
                        style={s.inputCompact}
                      />
                    </View>
                  );
                })}
              </View>

              <TouchableOpacity testID="save-baselines-PWS" style={s.saveBtn} disabled={savingPws} onPress={savePws}>
                {savingPws ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save PWS baselines</Text>}
              </TouchableOpacity>
            </View>

            <View style={s.card}>
              <View style={s.cardHead}>
                <Feather name="award" size={16} color={colors.accent} />
                <Text style={s.cardTitle}>ALPHA capacity baselines</Text>
              </View>
              <View style={s.alphaTotalsRow}>
                <View style={s.totalBadge}>
                  <Text style={s.totalBadgeTxt}>Cricket: {alphaTotals.cricket}</Text>
                </View>
                <View style={s.totalBadge}>
                  <Text style={s.totalBadgeTxt}>Football: {alphaTotals.football}</Text>
                </View>
                <View style={[s.totalBadge, s.totalBadgePrimary]}>
                  <Text style={[s.totalBadgeTxt, s.totalBadgeTxtPrimary]}>Total: {alphaTotals.overall}</Text>
                </View>
              </View>
              <Text style={s.cardHint}>Category × sport matrix for ALPHA enrollment planning.</Text>

              <View style={s.alphaTable}>
                <View style={s.alphaHeaderRow}>
                  <Text style={[s.alphaHeaderCell, s.alphaCatCol]}>Category</Text>
                  <Text style={s.alphaHeaderCell}>Cricket</Text>
                  <Text style={s.alphaHeaderCell}>Football</Text>
                </View>
                {ALPHA_CATEGORY_FIELDS.map((cat) => (
                  <View key={cat.key} style={s.alphaRow}>
                    <Text style={[s.fieldLabel, s.alphaCatCol]}>{cat.label}</Text>
                    {ALPHA_SPORTS.map((sport) => (
                      <TextInput
                        key={`${cat.key}-${sport}`}
                        testID={`baseline-alpha-${cat.key}-${sport}`}
                        value={alphaForm[cat.key][sport]}
                        onChangeText={(v) => updateAlphaField(cat.key, sport, v)}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={colors.hint}
                        style={[s.inputCompact, s.alphaInput]}
                      />
                    ))}
                  </View>
                ))}
              </View>

              <TouchableOpacity testID="save-baselines-ALPHA" style={s.saveBtn} disabled={savingAlpha} onPress={saveAlpha}>
                {savingAlpha ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>Save ALPHA baselines</Text>}
              </TouchableOpacity>
            </View>
          </View>
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 8 },
  h1: { fontSize: 20, fontWeight: "800", color: colors.ink },
  sub: { fontSize: 12, color: colors.muted2, marginTop: 2 },
  scroll: { paddingVertical: spacing.md, paddingBottom: spacing.lg },
  grid: { gap: spacing.md },
  gridWide: { flexDirection: "row", alignItems: "flex-start" },
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 8,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  cardTitle: { fontSize: 14, fontWeight: "800", color: colors.ink, flex: 1 },
  cardHint: { fontSize: 11, color: colors.muted2 },
  totalBadge: {
    backgroundColor: colors.primarySofter,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  totalBadgePrimary: { backgroundColor: colors.accentSoft },
  totalBadgeTxt: { fontSize: 11, fontWeight: "800", color: colors.primary },
  totalBadgeTxtPrimary: { color: colors.accentHover },
  alphaTotalsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pwsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  pwsCell: {
    width: Platform.OS === "web" ? "23%" : "47%",
    minWidth: 88,
    gap: 4,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.hint,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 2,
  },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: colors.muted },
  inputCompact: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "web" ? 7 : 9,
    fontSize: 14,
    color: colors.ink,
    minHeight: 36,
    ...Platform.select({ web: { outlineStyle: "none" } as object, default: {} }),
  },
  alphaTable: { gap: 6 },
  alphaHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 2 },
  alphaHeaderCell: {
    flex: 1,
    fontSize: 10,
    fontWeight: "800",
    color: colors.hint,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  alphaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  alphaCatCol: { flex: 1.2, minWidth: 92 },
  alphaInput: { flex: 1 },
  saveBtn: {
    marginTop: 4,
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
