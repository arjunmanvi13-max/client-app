import { Redirect, Stack, usePathname, useRouter } from "expo-router";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../src/auth";
import { installWebAlert } from "../src/webAlert";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Sidebar } from "../src/Sidebar";
import { useBreakpoint } from "../src/useBreakpoint";
import { colors } from "../src/theme";
import { isCoachBlockedPath, isCoachUser } from "../src/coachAccess";
import { isTeacherBlockedPath, isPwsTeacherUser } from "../src/teacherAccess";

function CoachRouteGuard() {
  const { user, loading } = useAuth();
  const pathname = usePathname() || "";
  const router = useRouter();

  useEffect(() => {
    if (loading || !user || !isCoachUser(user)) return;
    if (isCoachBlockedPath(pathname)) {
      router.replace("/(tabs)/dashboard");
    }
  }, [loading, user, pathname, router]);

  return null;
}

function TeacherRouteGuard() {
  const { user, loading } = useAuth();
  const pathname = usePathname() || "";
  const router = useRouter();

  useEffect(() => {
    if (loading || !user || !isPwsTeacherUser(user)) return;
    if (isTeacherBlockedPath(pathname)) {
      router.replace("/(tabs)/dashboard");
    }
  }, [loading, user, pathname, router]);

  return null;
}

installWebAlert();

const PUBLIC_PATH_PREFIXES = ["/login"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isParentPath(pathname: string) {
  return pathname === "/parent" || pathname.startsWith("/parent/") || isPublicPath(pathname);
}

function isParentOnlyUser(u: { role?: string } | null | undefined) {
  return !!u && String(u.role) === "parent";
}

function ShellOrStack() {
  const { user, loading } = useAuth();
  const { isDesktop } = useBreakpoint();
  const pathname = usePathname() || "";

  if (!loading && !user && !isPublicPath(pathname)) {
    return <Redirect href="/login" />;
  }

  if (!loading && user && isParentOnlyUser(user) && !isParentPath(pathname)) {
    return <Redirect href="/parent" />;
  }

  if (loading && !isPublicPath(pathname)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="small" color="#1E40AF" />
      </View>
    );
  }

  const hideSidebar =
    !user ||
    loading ||
    pathname === "/login" ||
    pathname === "/" ||
    pathname.startsWith("/parent");

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );

  if (!isDesktop || hideSidebar) {
    return (
      <>
        <CoachRouteGuard />
        <TeacherRouteGuard />
        {stack}
      </>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.bg }}>
      <CoachRouteGuard />
      <TeacherRouteGuard />
      <Sidebar />
      <View style={{ flex: 1, minWidth: 0 }}>{stack}</View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <ShellOrStack />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#F8FAFC" }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: "#0F172A" }}>Something went wrong</Text>
      <Text style={{ marginTop: 8, color: "#64748B", textAlign: "center" }} numberOfLines={4}>
        {error?.message || "An unexpected error occurred."}
      </Text>
      <TouchableOpacity
        onPress={() => { retry(); }}
        style={{ marginTop: 20, backgroundColor: "#1E40AF", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
      >
        <Text style={{ color: "#fff", fontWeight: "600" }}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}
