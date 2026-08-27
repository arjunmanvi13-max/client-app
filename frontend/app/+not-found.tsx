import { Link, Stack } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View style={s.wrap}>
        <Text style={s.title}>Page not found</Text>
        <Text style={s.body}>The page you are looking for does not exist or has moved.</Text>
        <Link href="/(tabs)/dashboard" style={s.link}>Go to Dashboard</Link>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#F8FAFC" },
  title: { fontSize: 20, fontWeight: "700", color: "#0F172A" },
  body: { marginTop: 8, color: "#64748B", textAlign: "center" },
  link: { marginTop: 20, color: "#1E40AF", fontWeight: "600" },
});
