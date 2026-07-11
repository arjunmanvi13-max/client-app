import { useState, useCallback } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, useAuth } from "./auth";
import { LoadingState, ErrorState, getApiError } from "./ScreenStates";
import { useBreakpoint } from "./useBreakpoint";

const SLOT_TINT: Record<string, string> = { Morning: "#F59E0B", Evening: "#7C3AED", Unassigned: "#94A3B8" };
const SKILL_TINT: Record<string, string> = { Beginner: "#10B981", Intermediate: "#0EA5E9", Advanced: "#EF4444", Unassigned: "#94A3B8" };

export default function CoachHome() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { horizontalPadding, contentMaxWidth } = useBreakpoint();
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [coachRes, mvpRes] = await Promise.all([
        api.get("/coach/dashboard"),
        api.get("/dashboard/mvp"),
      ]);
      setData({ ...coachRes.data, mvp: mvpRes.data });
    } catch (e: any) {
      setError(getApiError(e));
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  if (!user) return null;
  const isAdmin = user.role === "admin" || user.role === "super_admin";

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={[s.scroll, { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: contentMaxWidth ? "center" : undefined, width: contentMaxWidth ? "100%" : undefined }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#EA580C" />}>
        {loading && !refreshing ? (
          <LoadingState message="Loading coach dashboard…" />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : (
        <>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.overline}>{greeting.toUpperCase()}</Text>
            <Text style={s.h1}>Coach {user.name.split(" ")[0]}</Text>
            <View style={s.metaRow}>
              {(data?.mvp?.assigned_centres || data?.assigned_centres || []).map((c: string) => (
                <View key={c} style={s.sportPill}><Feather name="map-pin" size={11} color="#EA580C" /><Text style={s.sportText}>{c}</Text></View>
              ))}
              {(data?.mvp?.assigned_sports || data?.assigned_sports || [data?.assigned_sport]).filter(Boolean).map((sp: string) => (
                <View key={sp} style={s.sportPill}><Feather name="award" size={11} color="#EA580C" /><Text style={s.sportText}>{sp}</Text></View>
              ))}
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push("/profile")} style={s.avatarBtn} testID="coach-profile">
            <Feather name="user" size={18} color="#0F172A" />
          </TouchableOpacity>
        </View>

        <View style={s.heroCard}>
          <Text style={s.heroLabel}>Today's player attendance</Text>
          <Text style={s.heroValue}>{data?.mvp?.attendance_today?.marked ?? data?.today?.marked ?? "—"}</Text>
          <Text style={s.heroSub}>of {data?.total_players ?? "—"} players marked</Text>
          <View style={s.heroFooter}>
            <View style={s.heroChip}>
              <Feather name="check-circle" size={12} color="#10B981" />
              <Text style={[s.heroChipText, { color: "#10B981" }]}>{data?.mvp?.attendance_today?.present ?? data?.today?.present ?? 0} present</Text>
            </View>
            <View style={s.heroChip}>
              <Feather name="x-circle" size={12} color="#EF4444" />
              <Text style={[s.heroChipText, { color: "#EF4444" }]}>{data?.mvp?.attendance_today?.absent ?? data?.today?.absent ?? 0} absent</Text>
            </View>
            {(data?.mvp?.pending_assessments ?? 0) > 0 && (
              <View style={s.heroChip}>
                <Feather name="clipboard" size={12} color="#F59E0B" />
                <Text style={[s.heroChipText, { color: "#F59E0B" }]}>{data.mvp.pending_assessments} assessments pending</Text>
              </View>
            )}
          </View>
        </View>

        <Text style={s.section}>Players by slot</Text>
        <View style={s.row2}>
          {(["Morning", "Evening"] as const).map((slot) => (
            <View key={slot} style={[s.tile, { borderTopColor: SLOT_TINT[slot] }]}>
              <Feather name={slot === "Morning" ? "sun" : "moon"} size={16} color={SLOT_TINT[slot]} />
              <Text style={s.tileValue}>{data?.by_slot[slot] ?? 0}</Text>
              <Text style={s.tileLabel}>{slot}</Text>
            </View>
          ))}
        </View>

        <Text style={s.section}>Players by skill</Text>
        <View style={s.row3}>
          {(["Beginner", "Intermediate", "Advanced"] as const).map((sk) => (
            <View key={sk} style={[s.tile, { borderTopColor: SKILL_TINT[sk] }]}>
              <View style={[s.dot, { backgroundColor: SKILL_TINT[sk] }]} />
              <Text style={s.tileValue}>{data?.by_skill[sk] ?? 0}</Text>
              <Text style={s.tileLabel}>{sk}</Text>
            </View>
          ))}
        </View>

        <Text style={s.section}>Quick actions</Text>
        <View style={s.actionsRow}>
          <Action icon="check-square" label="Mark attendance" tint="#1E40AF" onPress={() => router.push("/(tabs)/attendance")} testID="qa-attendance" />
          <Action icon="clipboard" label="Assessments" tint="#EA580C" onPress={() => router.push("/coach/assessments")} testID="qa-assessments" />
          {(isAdmin || (user.coach_permissions || []).includes("add_players")) && (
            <Action icon="user-plus" label="Add player" tint="#16A34A" onPress={() => router.push("/manage/player/new")} testID="qa-addplayer" />
          )}
          {(isAdmin || (user.coach_permissions || []).includes("view_players")) && (
            <Action icon="users" label="My roster" tint="#EA580C" onPress={() => router.push("/manage/player")} testID="qa-roster" />
          )}
          {(isAdmin || user.coach_type === "head") && (
            <Action icon="user-check" label="Staff Attendance" tint="#BE185D" onPress={() => router.push("/staff-attendance")} testID="qa-staff-attendance" />
          )}
          {(isAdmin || user.coach_type === "head") && (
            <Action icon="award" label="Coach Attendance" tint="#EA580C" onPress={() => router.push("/coach-attendance")} testID="qa-coach-attendance" />
          )}
        </View>

        {(data?.deactivated_count ?? 0) > 0 && (
          <>
            <Text style={s.section}>Deactivated players ({data.deactivated_count})</Text>
            <View style={s.deactCard}>
              {data.deactivated_players.map((p: any) => (
                <View key={p.id} testID={`coach-deact-${p.id}`} style={s.deactRow}>
                  <View style={s.deactDot}><Feather name="slash" size={12} color="#94A3B8" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.deactName}>{p.name}</Text>
                    <Text style={s.deactMeta}>{p.centre || "—"} · {p.sport || "—"}{p.player_type ? " · " + p.player_type : ""}</Text>
                  </View>
                </View>
              ))}
              <Text style={s.deactHelp}>Read-only · Admin can reactivate from Manage › Players</Text>
            </View>
          </>
        )}
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Action({ icon, label, tint, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} style={s.actionBtn} onPress={onPress}>
      <View style={[s.actionIcon, { backgroundColor: tint + "1A" }]}>
        <Feather name={icon} size={20} color={tint} />
      </View>
      <Text style={s.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  scroll: { padding: 20, paddingBottom: 100 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 10 },
  headerLogo: { width: 44, height: 44 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.5, color: "#94A3B8" },
  h1: { fontSize: 28, fontWeight: "700", color: "#0F172A", letterSpacing: -0.5, marginTop: 4 },
  metaRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  sportPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FFEDD5", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  sportText: { fontSize: 12, fontWeight: "700", color: "#EA580C" },
  avatarBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  heroCard: { backgroundColor: "#0F172A", borderRadius: 20, padding: 24, marginTop: 8 },
  heroLabel: { color: "#94A3B8", fontSize: 12, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
  heroValue: { color: "#fff", fontSize: 56, fontWeight: "800", marginTop: 4, letterSpacing: -2 },
  heroSub: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  heroFooter: { flexDirection: "row", gap: 8, marginTop: 12 },
  heroChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  heroChipText: { fontSize: 12, fontWeight: "700" },
  section: { fontSize: 17, fontWeight: "700", color: "#0F172A", marginTop: 28, marginBottom: 12 },
  row2: { flexDirection: "row", gap: 12 },
  row3: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tile: { flex: 1, backgroundColor: "#fff", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", borderTopWidth: 3, alignItems: "flex-start", minWidth: 90 },
  tileValue: { fontSize: 24, fontWeight: "800", color: "#0F172A", marginTop: 6 },
  tileLabel: { fontSize: 12, color: "#64748B", marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  actionsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  actionBtn: { flexBasis: "30%", flexGrow: 1, backgroundColor: "#fff", padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center" },
  actionIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  actionLabel: { fontSize: 12, fontWeight: "600", color: "#0F172A", textAlign: "center" },
  deactCard: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", padding: 6, marginTop: 8 },
  deactRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 10 },
  deactDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  deactName: { fontSize: 13, fontWeight: "700", color: "#475569" },
  deactMeta: { fontSize: 11, color: "#94A3B8", marginTop: 1 },
  deactHelp: { fontSize: 11, color: "#94A3B8", padding: 8, textAlign: "center", fontStyle: "italic" },
});
