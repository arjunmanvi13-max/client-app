import { useEffect } from "react";
import { ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

/** Manage Users & Rosters hub — people CRUD now lives in Directory. */
export default function ManageHub() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/directory");
  }, [router]);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F4F5F7" }} edges={["top"]}>
      <ActivityIndicator color="#1E40AF" style={{ marginTop: 60 }} />
    </SafeAreaView>
  );
}
