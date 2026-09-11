import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth, userHasPermission } from "../../src/auth";
import { Permission } from "../../src/rbac";
import { LOGIN_TIER_CATALOG } from "../../src/userClassification";

export default function ManageHub() {
  const router = useRouter();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <ActivityIndicator color="#1E40AF" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!user) return null;

  const canManageUsersRosters = userHasPermission(user, Permission.MANAGE_USERS_ROSTERS);

  if (!canManageUsersRosters) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="manage-back">
            <Feather name="chevron-left" size={22} color="#0F172A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.h1}>Manage</Text>
            <Text style={s.sub}>Login user accounts</Text>
          </View>
        </View>
        <View style={s.empty}>
          <Feather name="shield-off" size={36} color="#94A3B8" />
          <Text style={s.emptyTitle}>Access restricted</Text>
          <Text style={s.emptyText}>
            Manage Users &amp; Rosters requires the Manage Users &amp; Rosters permission.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="manage-back">
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>Manage Users & Rosters</Text>
          <Text style={s.sub}>Super Admin, Admin, and Staff login accounts</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {LOGIN_TIER_CATALOG.map((item) => (
          <TouchableOpacity
            key={item.code}
            testID={`manage-${item.code}`}
            style={s.card}
            onPress={() => router.push(`/manage/${item.code}`)}
          >
            <View style={[s.iconBox, { backgroundColor: item.tint + "1A" }]}>
              <Feather name={item.icon as any} size={22} color={item.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{item.displayName}</Text>
              <Text style={s.cardDesc}>{item.manageDescription}</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#94A3B8" />
          </TouchableOpacity>
        ))}

        <View style={s.note}>
          <Feather name="info" size={14} color="#1E40AF" />
          <Text style={s.noteText}>
            Students, players, and non-login staff remain roster records under Directory. Admin and Staff logins get an entity, designation, and module access matrix.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 16, paddingBottom: 4, gap: 8 },
  backBtn: { padding: 8 },
  h1: { fontSize: 26, fontWeight: "700", color: "#0F172A", letterSpacing: -0.5 },
  sub: { fontSize: 13, color: "#64748B", marginTop: 2 },
  scroll: { padding: 20, gap: 12 },
  card: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  iconBox: { width: 48, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  cardDesc: { fontSize: 12, color: "#64748B", marginTop: 2 },
  empty: { padding: 40, alignItems: "center", gap: 8, flex: 1, justifyContent: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginTop: 6 },
  emptyText: { color: "#64748B", textAlign: "center", fontSize: 13, lineHeight: 18, paddingHorizontal: 24 },
  note: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: "#DBEAFE", borderRadius: 12, alignItems: "flex-start", marginTop: 8 },
  noteText: { color: "#1E40AF", fontSize: 12, flex: 1, lineHeight: 18 },
});
