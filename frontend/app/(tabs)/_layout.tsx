import { Tabs, Redirect, Slot } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../src/auth";
import { ActivityIndicator, View } from "react-native";
import { useBreakpoint } from "../../src/useBreakpoint";

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const { isDesktop } = useBreakpoint();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F5F7" }}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (user.role === "parent") return <Redirect href="/parent" />;

  // On desktop the global Sidebar handles nav — render the active screen full-bleed.
  if (isDesktop) return <Slot />;

  const showHostel = ["warden", "super_admin"].includes(user.role);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1E40AF",
        tabBarInactiveTintColor: "#94A3B8",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E2E8F0",
          height: 70,
          paddingTop: 8,
          paddingBottom: 14,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="attendance"
        options={{ title: "Attendance", tabBarIcon: ({ color, size }) => <Feather name="check-square" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: "Tasks", tabBarIcon: ({ color, size }) => <Feather name="list" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="hostel"
        options={{
          title: "Hostel",
          tabBarIcon: ({ color, size }) => <Feather name="home" color={color} size={size} />,
          href: showHostel ? "/(tabs)/hostel" : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Feather name="user" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
