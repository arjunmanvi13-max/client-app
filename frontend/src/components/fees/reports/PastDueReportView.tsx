import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { formatDate } from "../../../dateFormat";
import type { PastDueReportData } from "../../../fees/financeReportsTypes";
import { BucketCards, inr, SummaryCards } from "./FinanceReportShared";

const BUCKET_LABELS = {
  "1_30": "1–30 Days",
  "31_60": "31–60 Days",
  "61_90": "61–90 Days",
  "90_plus": "90+ Days",
} as const;

const COLUMNS = ["Student", "Venue", "Program", "Type", "Due Date", "Days Overdue", "Outstanding", "Quick Action"];

export function PastDueReportView({ data, onMarkPaid }: { data: PastDueReportData; onMarkPaid?: (id: string) => void }) {
  const buckets = (Object.keys(BUCKET_LABELS) as (keyof typeof BUCKET_LABELS)[]).map((key) => ({
    label: BUCKET_LABELS[key],
    count: data.buckets[key].count,
    amount: data.buckets[key].amount,
  }));

  return (
    <View>
      <SummaryCards
        items={[
          { label: "Total Past Due", value: inr(data.summary.totalPastDue), tone: "danger" },
          { label: "Students with Dues", value: String(data.summary.studentsWithDues) },
          { label: "Avg Outstanding", value: inr(data.summary.avgOutstanding), tone: "warn" },
        ]}
      />
      <Text style={s.sectionTitle}>Aging Buckets</Text>
      <BucketCards buckets={buckets} />
      <Text style={s.sectionTitle}>Outstanding Dues</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={s.tableWrap}>
          <View style={[s.tableHead, Platform.OS === "web" ? ({ position: "sticky", top: 0, zIndex: 2 } as object) : null]}>
            {COLUMNS.map((col, i) => (
              <Text key={col} style={[s.th, i === 0 && s.thFirst, i === 6 && s.thNum, i === 7 && s.thAction]} numberOfLines={1}>
                {col}
              </Text>
            ))}
          </View>
          <ScrollView style={s.tableBody} nestedScrollEnabled showsVerticalScrollIndicator>
            {data.rows.map((r, ri) => (
              <View key={r.id} style={[s.tr, ri % 2 === 1 && s.trAlt]}>
                <Text style={[s.td, s.tdFirst]} numberOfLines={2}>{r.studentName}</Text>
                <Text style={s.td} numberOfLines={1}>{r.venue}</Text>
                <Text style={s.td} numberOfLines={1}>{r.program}</Text>
                <Text style={s.td} numberOfLines={1}>{r.type}</Text>
                <Text style={s.td} numberOfLines={1}>{formatDate(r.dueDate)}</Text>
                <Text style={s.td} numberOfLines={1}>{r.daysOverdue}</Text>
                <Text style={[s.td, s.tdNum]} numberOfLines={1}>{inr(r.outstanding)}</Text>
                <View style={s.actionCell}>
                  <TouchableOpacity
                    style={s.remindBtn}
                    onPress={() => Alert.alert("Reminder sent", `WhatsApp reminder queued for ${r.studentName}.`)}
                  >
                    <Feather name="message-circle" size={11} color="#1E40AF" />
                    <Text style={s.remindTxt}>Remind</Text>
                  </TouchableOpacity>
                  {onMarkPaid && (
                    <TouchableOpacity style={s.paidBtn} onPress={() => onMarkPaid(r.id)}>
                      <Text style={s.paidTxt}>Mark Paid</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#0F172A", marginBottom: 8 },
  tableWrap: { minWidth: "100%", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 10, overflow: "hidden" },
  tableHead: { flexDirection: "row", backgroundColor: "#EFF6FF", borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  tableBody: { maxHeight: 420 },
  th: { flex: 1, minWidth: 88, paddingHorizontal: 8, paddingVertical: 10, fontSize: 10, fontWeight: "800", color: "#0F172A", textTransform: "uppercase" },
  thFirst: { minWidth: 130 },
  thNum: { minWidth: 100, textAlign: "right" },
  thAction: { minWidth: 168, flex: 1.4 },
  tr: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  trAlt: { backgroundColor: "#FAFAFA" },
  td: { flex: 1, minWidth: 88, paddingHorizontal: 8, paddingVertical: 10, fontSize: 12, color: "#334155" },
  tdFirst: { minWidth: 130, fontWeight: "600", color: "#0F172A" },
  tdNum: { minWidth: 100, textAlign: "right", fontWeight: "700" },
  actionCell: { minWidth: 168, flex: 1.4, flexDirection: "row", flexWrap: "wrap", gap: 4, paddingHorizontal: 6, paddingVertical: 6 },
  remindBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 5, borderRadius: 6, backgroundColor: "#EFF6FF" },
  remindTxt: { fontSize: 10, fontWeight: "700", color: "#1E40AF" },
  paidBtn: { backgroundColor: "#1E40AF", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  paidTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
