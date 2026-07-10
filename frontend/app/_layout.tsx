import { Stack, usePathname } from "expo-router";
import { View } from "react-native";
import { AuthProvider, useAuth } from "../src/auth";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Sidebar } from "../src/Sidebar";
import { useBreakpoint } from "../src/useBreakpoint";
import { colors } from "../src/theme";

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

  if (!isDesktop || hideSidebar) return stack;

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.bg }}>
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
