import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../src/auth";

export default function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F5F7" }}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }
  if (!user) return <Redirect href="/login" />;
  if (user.role === "parent") return <Redirect href="/parent" />;
  return <Redirect href="/(tabs)/dashboard" />;
}
