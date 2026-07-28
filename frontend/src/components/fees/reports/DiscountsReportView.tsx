import { View, Text, StyleSheet } from "react-native";
import { formatDate } from "../../../dateFormat";
import type { DiscountsReportData } from "../../../fees/financeReportsTypes";
import { inr, ReportTable, SummaryCards } from "./FinanceReportShared";

export function DiscountsReportView({ data }: { data: DiscountsReportData }) {
  const columns = ["Student", "Venue", "Original Fee", "Discount", "Reason", "Approved By", "Date"];
  const rows = data.rows.map((r) => [
    r.studentName,
    r.venue,
    inr(r.originalFee),
    `${inr(r.discountAmount)} (${r.discountPct}%)`,
    r.reason,
    r.approvedBy,
    formatDate(r.approvalDate),
  ]);

  return (
    <View>
      <SummaryCards
        items={[
          { label: "Total Concessions", value: inr(data.summary.totalConcessions), tone: "warn" },
          { label: "Approved Requests", value: String(data.summary.approvedRequests) },
          { label: "% of Revenue Discounted", value: `${data.summary.pctOfRevenue}%` },
        ]}
      />
      <Text style={s.sectionTitle}>Concession Audit</Text>
      <ReportTable columns={columns} rows={rows} numericFromIndex={2} />
    </View>
  );
}

const s = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#0F172A", marginBottom: 8, marginTop: 4 },
});
