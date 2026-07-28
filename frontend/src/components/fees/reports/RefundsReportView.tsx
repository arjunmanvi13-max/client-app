import { View, Text, StyleSheet } from "react-native";
import { formatDate } from "../../../dateFormat";
import type { RefundsReportData } from "../../../fees/financeReportsTypes";
import { inr, ReportTable, SummaryCards } from "./FinanceReportShared";

export function RefundsReportView({ data }: { data: RefundsReportData }) {
  const columns = ["Student", "Program", "Venue", "Cancellation Date", "Exit Reason", "Status", "Refunded"];
  const rows = data.rows.map((r) => [
    r.studentName,
    r.program,
    r.venue,
    formatDate(r.cancellationDate),
    r.exitReason,
    r.refundStatus,
    inr(r.amountRefunded),
  ]);

  return (
    <View>
      <SummaryCards
        items={[
          { label: "Refunds Processed", value: String(data.summary.totalRefunds) },
          { label: "Total Cancellations", value: String(data.summary.totalCancellations), tone: "warn" },
          { label: "Net Refund Amount", value: inr(data.summary.netRefundAmount), tone: "danger" },
        ]}
      />
      <Text style={s.sectionTitle}>Refunds & Cancellations</Text>
      <ReportTable columns={columns} rows={rows} numericFromIndex={6} />
    </View>
  );
}

const s = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#0F172A", marginBottom: 8, marginTop: 4 },
});
