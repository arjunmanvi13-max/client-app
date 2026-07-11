import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../src/auth";
import { useBreakpoint } from "../src/useBreakpoint";
import { colors } from "../src/theme";

type Step = "login" | "force_change";

const DOMAIN = "@prarambhika.com";

export default function Login() {
  const { login, changePassword } = useAuth();
  const router = useRouter();
  const { isWide } = useBreakpoint();

  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [roleAfter, setRoleAfter] = useState<string>("");

  const goAfterLogin = (role: string) => {
    setLoading(false);
    router.replace((role === "parent" ? "/parent" : "/(tabs)/dashboard") as any);
  };

  const doLogin = async () => {
    setErr(null);
    const e = email.trim().toLowerCase();
    if (!e.endsWith(DOMAIN)) {
      setErr(`Only ${DOMAIN} email addresses are allowed`);
      return;
    }
    setLoading(true);
    try {
      const r = await login(e, password);
      if (r.must_change_password) {
        setRoleAfter(r.role);
        setStep("force_change");
        setLoading(false);
      } else {
        goAfterLogin(r.role);
      }
    } catch (er: any) {
      setErr(er?.response?.data?.detail || "Invalid email or password");
      setLoading(false);
    }
  };

  const doForceChange = async () => {
    setErr(null);
    if (newPwd.length < 6) { setErr("Password must be at least 6 characters"); return; }
    if (newPwd === password) { setErr("New password must be different from the assigned one"); return; }
    if (newPwd !== newPwd2) { setErr("Passwords do not match"); return; }
    setLoading(true);
    try {
      await changePassword(password, newPwd);
      goAfterLogin(roleAfter);
    } catch (er: any) {
      setErr(er?.response?.data?.detail || "Failed to update password");
      setLoading(false);
    }
  };

  const renderLoginStep = () => (
    <>
      <Text style={s.formHeading}>Sign in</Text>
      <Text style={s.formSub}>Use your {DOMAIN} email address and password.</Text>

      <Text style={s.label}>Email</Text>
      <View style={s.inputWrap}>
        <Feather name="mail" size={18} color={colors.hint} />
        <TextInput
          testID="login-email"
          value={email}
          onChangeText={(v) => { setEmail(v); setErr(null); }}
          placeholder={`yourname${DOMAIN}`}
          placeholderTextColor={colors.hint}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          style={s.input}
        />
      </View>

      <Text style={[s.label, { marginTop: 14 }]}>Password</Text>
      <View style={s.inputWrap}>
        <Feather name="lock" size={18} color={colors.hint} />
        <TextInput
          testID="login-password"
          value={password}
          onChangeText={(v) => { setPassword(v); setErr(null); }}
          secureTextEntry={!showPwd}
          placeholder="••••••••"
          placeholderTextColor={colors.hint}
          style={s.input}
          onSubmitEditing={doLogin}
          returnKeyType="go"
        />
        <Pressable onPress={() => setShowPwd(!showPwd)} hitSlop={10}>
          <Feather name={showPwd ? "eye-off" : "eye"} size={18} color={colors.hint} />
        </Pressable>
      </View>

      {err && <Text style={s.err} testID="login-error">{err}</Text>}

      <TouchableOpacity testID="btn-login" onPress={doLogin} disabled={loading || !email.trim() || !password} style={[s.primaryBtn, (loading || !email.trim() || !password) && { opacity: 0.6 }]}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Sign in</Text>}
      </TouchableOpacity>

      <Text style={s.helpNote}>Forgot your password? Contact the Super Admin to reset it.</Text>
    </>
  );

  const renderForceChangeStep = () => (
    <>
      <Text style={s.formHeading}>Create your own password</Text>
      <Text style={s.formSub}>Your password was assigned by the administrator. Please set a new secure password to continue.</Text>

      <Text style={s.label}>New password</Text>
      <View style={s.inputWrap}>
        <Feather name="lock" size={18} color={colors.hint} />
        <TextInput testID="force-new-pwd" value={newPwd} onChangeText={(v) => { setNewPwd(v); setErr(null); }} secureTextEntry placeholder="Min 6 characters" placeholderTextColor={colors.hint} style={s.input} />
      </View>
      <Text style={[s.label, { marginTop: 14 }]}>Confirm new password</Text>
      <View style={s.inputWrap}>
        <Feather name="lock" size={18} color={colors.hint} />
        <TextInput testID="force-new-pwd2" value={newPwd2} onChangeText={(v) => { setNewPwd2(v); setErr(null); }} secureTextEntry placeholder="Repeat password" placeholderTextColor={colors.hint} style={s.input} onSubmitEditing={doForceChange} returnKeyType="go" />
      </View>
      {err && <Text style={s.err} testID="force-pwd-error">{err}</Text>}
      <TouchableOpacity testID="btn-force-change" onPress={doForceChange} disabled={loading} style={[s.primaryBtn, loading && { opacity: 0.7 }]}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Save & Continue</Text>}
      </TouchableOpacity>
    </>
  );

  const Form = (
    <View style={isWide ? s.cardWide : s.card}>
      {step === "login" ? renderLoginStep() : renderForceChangeStep()}
    </View>
  );
  const Hero = (
    <View style={isWide ? s.heroWide : s.heroMobile}>
      <View style={s.logoWrap}>
        <View style={s.logoCircle}>
          <Image source={require("../assets/alpha-sports-logo.png")} style={s.logoImg} resizeMode="contain" testID="alpha-logo" />
        </View>
      </View>
      <View style={s.heroRow}>
        <View style={[s.brandBadge, { backgroundColor: isWide ? "rgba(255,255,255,0.18)" : colors.primary }]}>
          <Text style={s.brandBadgeText}>PWS</Text>
        </View>
        <Text style={[s.brandPlus, !isWide && { color: colors.muted }]}>×</Text>
        <View style={[s.brandBadge, { backgroundColor: isWide ? "rgba(255,255,255,0.18)" : "#EA580C" }]}>
          <Text style={s.brandBadgeText}>ALPHA</Text>
        </View>
      </View>
      <Text style={isWide ? s.h1Wide : s.h1Mobile}>Sign in with your work email.</Text>
      <Text style={isWide ? s.subWide : s.subMobile}>Unified portal for Prarambhika World School & ALPHA Sports Academy, Patna.</Text>
      {isWide && (
        <View style={s.heroFeatures}>
          {[
            { icon: "mail" as const, t: "Domain-restricted", d: `Only ${DOMAIN} email accounts can sign in` },
            { icon: "shield" as const, t: "Centrally managed", d: "Accounts & permissions assigned by the Super Admin" },
            { icon: "key" as const, t: "Your own password", d: "Set a personal password on first login; change anytime" },
          ].map((f) => (
            <View key={f.t} style={s.featRow}>
              <View style={s.featIcon}>
                <Feather name={f.icon} size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.featTitle}>{f.t}</Text>
                <Text style={s.featDesc}>{f.d}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={s.safe} edges={isWide ? [] : ["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {isWide ? (
          <View style={s.split}>
            {Hero}
            <ScrollView style={s.formCol} contentContainerStyle={s.formColInner} keyboardShouldPersistTaps="handled">
              {Form}
            </ScrollView>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            {Hero}
            {Form}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 24, paddingBottom: 48 },
  split: { flex: 1, flexDirection: "row" },
  heroWide: { width: "42%", minWidth: 380, maxWidth: 560, backgroundColor: colors.primaryDeeper, padding: 56, justifyContent: "center" },
  heroMobile: { alignItems: "flex-start", marginBottom: 8 },
  formCol: { flex: 1 },
  formColInner: { padding: 40, paddingBottom: 60, alignItems: "center" },
  cardWide: { width: "100%", maxWidth: 480, backgroundColor: colors.surface, borderRadius: 20, padding: 28, borderWidth: 1, borderColor: colors.border },
  logoWrap: { marginBottom: 24 },
  logoCircle: { width: 88, height: 88, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  logoImg: { width: 70, height: 70 },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  brandBadge: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  brandBadgeText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: 1.5 },
  brandPlus: { fontSize: 22, color: "rgba(255,255,255,0.7)", fontWeight: "300" },
  h1Wide: { fontSize: 38, fontWeight: "800", color: "#fff", marginTop: 28, lineHeight: 46, letterSpacing: -0.8 },
  h1Mobile: { fontSize: 28, fontWeight: "700", color: colors.ink, marginTop: 24, lineHeight: 34, letterSpacing: -0.5 },
  subWide: { fontSize: 16, color: "rgba(255,255,255,0.78)", marginTop: 12, lineHeight: 24, maxWidth: 420 },
  subMobile: { fontSize: 15, color: colors.muted, marginTop: 8, lineHeight: 22 },
  heroFeatures: { marginTop: 36, gap: 16 },
  featRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  featIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  featTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  featDesc: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border, marginTop: 28 },
  formHeading: { fontSize: 22, fontWeight: "800", color: colors.ink, letterSpacing: -0.4 },
  formSub: { fontSize: 13, color: colors.muted, marginTop: 4, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 8 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  prefix: { color: colors.muted, fontSize: 15, fontWeight: "700" },
  input: { flex: 1, fontSize: 15, color: colors.ink, outlineStyle: "none" as any },
  err: { color: colors.danger, fontSize: 13, marginTop: 12 },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 18 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  modeSwitchRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, alignItems: "center" },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  linkTextMuted: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  legacyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 18, gap: 6, opacity: 0.7 },
  legacyTxt: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 12 },
  backTxt: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, alignItems: "center" },
  metaTxt: { color: colors.muted, fontSize: 12 },
});
