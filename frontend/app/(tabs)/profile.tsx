import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth, ROLE_COLORS } from "../../src/auth";
import { isCoachUser } from "../../src/coachAccess";
import { useState } from "react";

export default function Profile() {
  const { user, logout, changePassword } = useAuth();
  const router = useRouter();
  const [pwdOpen, setPwdOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [nw2, setNw2] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdErr, setPwdErr] = useState<string | null>(null);

  if (!user) return null;

  const isCoach = isCoachUser(user);
  const canManageRosters = user.role === "admin" || user.role === "super_admin"
    || (user.role !== "teacher" && !isCoach && (user.can_manage || []).length > 0);

  const onLogout = () => {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: async () => { await logout(); router.replace("/login"); } },
    ]);
  };

  const submitChangePwd = async () => {
    setPwdErr(null);
    if (nw.length < 6) { setPwdErr("New password must be at least 6 characters"); return; }
    if (nw !== nw2) { setPwdErr("Passwords do not match"); return; }
    setPwdLoading(true);
    try {
      await changePassword(cur, nw);
      Alert.alert("Done", "Password updated. You'll need it next time you sign in.");
      setPwdOpen(false); setCur(""); setNw(""); setNw2("");
    } catch (e: any) {
      setPwdErr(e?.response?.data?.detail || "Failed to update password");
    } finally { setPwdLoading(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.h1}>Profile</Text>
        <View style={s.profileCard}>
          <View style={[s.avatar, { backgroundColor: ROLE_COLORS[user.role] }]}>
            <Text style={s.avatarTxt}>{user.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}</Text>
          </View>
          <Text style={s.name}>{user.name}</Text>
          <Text style={s.email}>{user.email}</Text>
          <View style={[s.rolePill, { borderColor: ROLE_COLORS[user.role] }]}>
            <View style={[s.dot, { backgroundColor: ROLE_COLORS[user.role] }]} />
            <Text style={[s.roleText, { color: ROLE_COLORS[user.role] }]}>{user.role.replace("_", " ").toUpperCase()}</Text>
          </View>
          {user.department && <Text style={s.dept}>{user.department} · {user.organization}</Text>}
        </View>

        <View style={s.menu}>
          {canManageRosters && (
            <Row icon="user-plus" label="Manage users & rosters" onPress={() => router.push("/manage")} testID="menu-manage" />
          )}
          <Row icon="key" label="Change password" onPress={() => setPwdOpen(true)} testID="menu-change-pwd" />
          {!isCoach && (
            <Row icon="bell" label="Notifications" onPress={() => router.push("/notifications")} testID="menu-notif" />
          )}
          {user.role !== "teacher" && !isCoach && (
            <Row icon="users" label="Directory" onPress={() => router.push("/directory")} testID="menu-dir" />
          )}
          <Row icon="info" label="About PWS & ALPHA" onPress={() => Alert.alert("PWS & ALPHA", "Unified task & attendance system v1.0")} testID="menu-about" />
        </View>

        <TouchableOpacity testID="logout-btn" style={s.logout} onPress={onLogout}>
          <Feather name="log-out" size={18} color="#EF4444" />
          <Text style={s.logoutTxt}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={pwdOpen} animationType="slide" transparent onRequestClose={() => setPwdOpen(false)}>
        <View style={s.modalBg}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Change password</Text>
              <TouchableOpacity onPress={() => setPwdOpen(false)} testID="cp-close"><Feather name="x" size={20} color="#475569" /></TouchableOpacity>
            </View>
            <Text style={s.fieldLabel}>Current password</Text>
            <TextInput testID="cp-current" value={cur} onChangeText={setCur} secureTextEntry placeholder="••••••••" placeholderTextColor="#94A3B8" style={s.field} />
            <Text style={s.fieldLabel}>New password (min 6 chars)</Text>
            <TextInput testID="cp-new" value={nw} onChangeText={setNw} secureTextEntry placeholder="••••••" placeholderTextColor="#94A3B8" style={s.field} />
            <Text style={s.fieldLabel}>Confirm new password</Text>
            <TextInput testID="cp-new2" value={nw2} onChangeText={setNw2} secureTextEntry placeholder="••••••" placeholderTextColor="#94A3B8" style={s.field} />
            {pwdErr && <Text style={s.errTxt} testID="cp-error">{pwdErr}</Text>}
            <TouchableOpacity style={[s.primary, pwdLoading && { opacity: 0.6 }]} disabled={pwdLoading} onPress={submitChangePwd} testID="cp-submit">
              {pwdLoading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryTxt}>Update password</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ icon, label, onPress, testID }: any) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} testID={testID}>
      <View style={s.rowIcon}><Feather name={icon} size={18} color="#475569" /></View>
      <Text style={s.rowLabel}>{label}</Text>
      <Feather name="chevron-right" size={18} color="#94A3B8" />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F4F5F7" },
  scroll: { padding: 20, paddingBottom: 100 },
  h1: { fontSize: 28, fontWeight: "700", color: "#0F172A", marginBottom: 20 },
  profileCard: { backgroundColor: "#fff", borderRadius: 20, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarTxt: { color: "#fff", fontWeight: "800", fontSize: 26 },
  name: { fontSize: 20, fontWeight: "700", color: "#0F172A" },
  email: { fontSize: 13, color: "#64748B", marginTop: 4 },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  roleText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  dept: { fontSize: 12, color: "#94A3B8", marginTop: 8 },
  menu: { marginTop: 24, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: "#0F172A" },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24, padding: 14, backgroundColor: "#FEE2E2", borderRadius: 14 },
  logoutTxt: { color: "#EF4444", fontWeight: "700", fontSize: 14 },
  modalBg: { flex: 1, backgroundColor: "rgba(15,23,42,0.55)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", padding: 24, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: 36 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: "#0F172A", letterSpacing: -0.3 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: "#475569", marginTop: 12, marginBottom: 6 },
  field: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: "#0F172A" },
  errTxt: { color: "#EF4444", fontSize: 13, marginTop: 10 },
  primary: { backgroundColor: "#1E40AF", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 18 },
  primaryTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
