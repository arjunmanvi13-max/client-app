import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { formatDate } from "../../../dateFormat";
import type { PastDueReportData } from "../../../fees/financeReportsTypes";
import { BucketCards, inr, ReportTable, SummaryCards } from "./FinanceReportShared";

const BUCKET_LABELS = {
  "1_30": "1–30 Days",
  "31_60": "31–60 Days",
  "61_90": "61–90 Days",
  "90_plus": "90+ Days",
} as const;

export function PastDueReportView({ data, onMarkPaid }: { data: PastDueReportData; onMarkPaid?: (id: string) => void }) {
  const buckets = (Object.keys(BUCKET_LABELS) as (keyof typeof BUCKET_LABELS)[]).map((key) => ({
    label: BUCKET_LABELS[key],
    count: data.buckets[key].count,
    amount: data.buckets[key].amount,
  }));

  const columns = ["Student", "Venue", "Program", "Type", "Due Date", "Days Overdue", "Outstanding"];
  const rows = data.rows.map((r) => [
    r.studentName,
    r.venue,
    r.program,
    r.type,
    formatDate(r.dueDate),
    String(r.daysOverdue),
    inr(r.outstanding),
  ]);

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
      <ReportTable columns={columns} rows={rows} numericFromIndex={6} />
      <View style={s.actionList}>
        {data.rows.slice(0, 5).map((r) => (
          <View key={r.id} style={s.actionRow}>
            <Text style={s.actionName}>{r.studentName}</Text>
            <View style={s.actionBtns}>
              <TouchableOpacity
                style={s.remindBtn}
                onPress={() => Alert.alert("Reminder sent", `WhatsApp reminder queued for ${r.studentName}.`)}
              >
                <Feather name="message-circle" size={12} color="#1E40AF" />
                <Text style={s.remindTxt}>Send Reminder</Text>
              </TouchableOpacity>
              {onMarkPaid && (
                <TouchableOpacity style={s.paidBtn} onPress={() => onMarkPaid(r.id)}>
                  <Text style={s.paidTxt}>Mark Paid</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#0F172A", marginBottom: 8 },
  actionList: { marginTop: 12, gap: 8 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10,
  },
  actionName: { fontSize: 13, fontWeight: "700", color: "#0F172A", flex: 1 },
  actionBtns: { flexDirection: "row", gap: 6 },
  remindBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: "#EFF6FF" },
  remindTxt: { fontSize: 11, fontWeight: "700", color: "#1E40AF" },
  paidBtn: { backgroundColor: "#1E40AF", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  paidTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
