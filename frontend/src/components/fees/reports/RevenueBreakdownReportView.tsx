import { View, Text, StyleSheet } from "react-native";
import type { RevenueBreakdownData } from "../../../fees/financeReportsTypes";
import { DonutChart, DonutLegend, inr, ReportTable, SummaryCards } from "./FinanceReportShared";

const COLORS = ["#1E40AF", "#16A34A", "#EA580C", "#7C3AED", "#0EA5E9", "#DC2626"];

export function RevenueBreakdownReportView({ data }: { data: RevenueBreakdownData }) {
  const columns = ["Line Item", "Transactions", "Gross Revenue", "Discounts", "Net Revenue"];
  const rows = data.rows.map((r) => [
    r.lineItem,
    String(r.transactions),
    inr(r.grossRevenue),
    inr(r.discountsApplied),
    inr(r.netRevenue),
  ]);

  const legend = data.rows.map((r, i) => ({
    label: r.lineItem,
    amount: r.netRevenue,
    pct: data.totalNet ? Math.round((r.netRevenue / data.totalNet) * 100) : 0,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <View>
      <SummaryCards items={[{ label: "Total Net Revenue", value: inr(data.totalNet), tone: "success" }]} />
      <Text style={s.sectionTitle}>Revenue Split</Text>
      <DonutChart items={legend.map((item) => ({ label: item.label, pct: item.pct, color: item.color }))} />
      <DonutLegend items={legend} />
      <Text style={s.sectionTitle}>Line Item Detail</Text>
      <ReportTable columns={columns} rows={rows} numericFromIndex={2} />
    </View>
  );
}

const s = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#0F172A", marginBottom: 8, marginTop: 4 },
});
