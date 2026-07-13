import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth, userHasPermission } from "../../src/auth";
import { BusinessEntity, Permission, UserRole, normalizeRole } from "../../src/rbac";
import { isCoachUser } from "../../src/coachAccess";

const KINDS = [
  { key: "admin", label: "Sports Admin", icon: "shield", tint: "#7C3AED", desc: "ALPHA Sports Admin — manages players, coaches & fees" },
  { key: "coach", label: "Coaches", icon: "award", tint: "#EA580C", desc: "Sport coaches who log in & manage players" },
  { key: "teacher", label: "Teachers", icon: "book-open", tint: "#1E40AF", desc: "PWS teachers — attendance & marks (view only)" },
  { key: "parent", label: "Parents / Guardians", icon: "heart", tint: "#0891B2", desc: "Parent accounts linked to students or players" },
  { key: "player", label: "Players", icon: "activity", tint: "#16A34A", desc: "ALPHA athletes — attendance roster" },
  { key: "student", label: "Students", icon: "users", tint: "#2563EB", desc: "PWS students — attendance roster" },
  { key: "staff", label: "Staff", icon: "user-check", tint: "#0EA5E9", desc: "Non-login staff (PWS & ALPHA) — attendance roster" },
];

export default function ManageHub() {
  const router = useRouter();
  const { user } = useAuth();
  if (!user) return null;
  const isCoach = isCoachUser(user);
  const role = normalizeRole(user.role);
  const isSuper = userHasPermission(user, Permission.MANAGE_ACCESS);
  const isAdmin = userHasPermission(user, Permission.MANAGE_PLAYERS)
    || userHasPermission(user, Permission.ADD_PWS_STUDENTS, BusinessEntity.PWS)
    || isSuper;
  const isSportsAdmin = role === UserRole.ALPHA_ADMIN;
  const canKind = (key: string) => {
    if (isAdmin) return true;
    if ((user.can_manage || []).includes(key as any)) return true;
    if (key === "student" && userHasPermission(user, Permission.ADD_PWS_STUDENTS, BusinessEntity.PWS)) return true;
    if (key === "player" && userHasPermission(user, Permission.MANAGE_PLAYERS, BusinessEntity.ALPHA)) return true;
    if (key === "staff" && isCoach) return false;
    if (key === "staff" && userHasPermission(user, Permission.MARK_PWS_ATTENDANCE)) return true;
    if (key === "parent" && isSuper) return true;
    return false;
  };
  const allowed = KINDS
    .filter((k) => canKind(k.key))
    .filter((k) => !(isSportsAdmin && (k.key === "student" || k.key === "teacher")))
    .filter((k) => !(k.key === "admin" && !isSuper))
    .filter((k) => !(k.key === "parent" && !isSuper && !userHasPermission(user, Permission.ADD_PWS_STUDENTS, BusinessEntity.PWS)));

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} testID="manage-back">
          <Feather name="chevron-left" size={22} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.h1}>Manage</Text>
          <Text style={s.sub}>Add or edit accounts and rosters</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {allowed.length === 0 ? (
          <View style={s.empty}>
            <Feather name="shield-off" size={36} color="#94A3B8" />
            <Text style={s.emptyTitle}>No management rights</Text>
            <Text style={s.emptyText}>Ask an Admin or Super Admin to grant you editing rights from your profile.</Text>
          </View>
        ) : allowed.map((k) => (
          <TouchableOpacity
            key={k.key}
            testID={`manage-${k.key}`}
            style={s.card}
            onPress={() => router.push(`/manage/${k.key}`)}
          >
            <View style={[s.iconBox, { backgroundColor: k.tint + "1A" }]}>
              <Feather name={k.icon as any} size={22} color={k.tint} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{k.label}</Text>
              <Text style={s.cardDesc}>{k.desc}</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#94A3B8" />
          </TouchableOpacity>
        ))}

        {!isAdmin && allowed.length > 0 && (
          <View style={s.note}>
            <Feather name="info" size={14} color="#1E40AF" />
            <Text style={s.noteText}>
              You can manage: {(user.can_manage || []).join(", ")}. Only Admins / Super Admins can grant or revoke rights.
            </Text>
          </View>
        )}
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
  empty: { padding: 40, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginTop: 6 },
  emptyText: { color: "#64748B", textAlign: "center", fontSize: 13, lineHeight: 18 },
  note: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: "#DBEAFE", borderRadius: 12, alignItems: "flex-start", marginTop: 8 },
  noteText: { color: "#1E40AF", fontSize: 12, flex: 1, lineHeight: 18 },
});
