import { Stack, usePathname, useRouter } from "expo-router";
import { View } from "react-native";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "../src/auth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Sidebar } from "../src/Sidebar";
import { useBreakpoint } from "../src/useBreakpoint";
import { colors } from "../src/theme";
import { isCoachBlockedPath, isCoachUser } from "../src/coachAccess";

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

function ShellOrStack() {
  const { user, loading } = useAuth();
  const { isDesktop } = useBreakpoint();
  const pathname = usePathname() || "";

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
        {stack}
      </>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.bg }}>
      <CoachRouteGuard />
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
