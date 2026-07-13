import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { api } from "../../auth";
import { colors } from "../../theme";

export function BulkReminderBar({
  count,
  playerIds,
  onDone,
  onClear,
}: {
  count: number;
  playerIds: string[];
  onDone: () => void;
  onClear: () => void;
}) {
  if (count === 0) return null;

  const send = async () => {
    try {
      const { data } = await api.post("/fees/remind", { player_ids: playerIds, channel: "whatsapp" });
      const links = (data.reminders || []).filter((r: any) => r.whatsapp_url);
      if (Platform.OS === "web" && links.length > 0) {
        window.open(links[0].whatsapp_url, "_blank");
        if (links.length > 1) {
          window.alert(`Prepared ${data.count} reminder(s). Open each WhatsApp link to send.`);
        }
      } else if (links[0]?.whatsapp_url) {
        Linking.openURL(links[0].whatsapp_url);
      } else {
        Alert.alert("Reminders prepared", `${data.count} message(s) ready — add mobile numbers for WhatsApp links.`);
      }
      onDone();
    } catch (e: any) {
      Alert.alert("Reminder failed", e?.response?.data?.detail || "Could not send reminders.");
    }
  };

  return (
    <View style={s.bar} testID="bulk-reminder-bar">
      <Text style={s.label}>{count} overdue selected</Text>
      <View style={s.actions}>
        <TouchableOpacity onPress={onClear} style={s.clearBtn} testID="bulk-clear">
          <Text style={s.clearTxt}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={send} style={s.remindBtn} testID="bulk-remind">
          <Feather name="message-circle" size={14} color="#fff" />
          <Text style={s.remindTxt}>Send Reminder</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: "absolute", left: 16, right: 16, bottom: 72,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#0F172A", borderRadius: 14, padding: 14,
    shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  label: { color: "#fff", fontWeight: "700", fontSize: 13 },
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  clearTxt: { color: "#94A3B8", fontWeight: "700", fontSize: 12 },
  remindBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#16A34A", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  remindTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
