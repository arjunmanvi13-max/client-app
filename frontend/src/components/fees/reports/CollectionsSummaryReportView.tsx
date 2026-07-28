import { View, Text, StyleSheet } from "react-native";
import type { CollectionsSummaryData } from "../../../fees/financeReportsTypes";
import { BarChartSimple, inr, ReportTable, SummaryCards } from "./FinanceReportShared";

export function CollectionsSummaryReportView({ data }: { data: CollectionsSummaryData }) {
  const modeColumns = ["Payment Mode", "Transactions", "Amount", "Share"];
  const modeRows = data.paymentModes.map((m) => [m.mode, String(m.count), inr(m.amount), `${m.pct}%`]);

  return (
    <View>
      <SummaryCards
        items={[
          { label: "Collected Today", value: inr(data.summary.collectedToday), tone: "success" },
          { label: "Collected (Month)", value: inr(data.summary.collectedMonth), tone: "success" },
          { label: "Expected Revenue", value: inr(data.summary.expectedRevenue) },
          { label: "Collection Efficiency", value: `${data.summary.efficiencyPct}%`, tone: "warn" },
        ]}
      />
      <Text style={s.sectionTitle}>Collection Trend (Expected vs Realized)</Text>
      <View style={s.trendBlock}>
        {data.trend.map((t) => (
          <View key={t.label} style={s.trendRow}>
            <Text style={s.trendLabel}>{t.label}</Text>
            <View style={s.trendBars}>
              <View style={[s.trendExpected, { flex: t.expected }]} />
              <View style={[s.trendCollected, { flex: t.collected }]} />
            </View>
            <Text style={s.trendMeta}>{inr(t.collected)} / {inr(t.expected)}</Text>
          </View>
        ))}
      </View>
      <Text style={s.sectionTitle}>Payment Mode Breakdown</Text>
      <ReportTable columns={modeColumns} rows={modeRows} numericFromIndex={2} />
      <BarChartSimple items={data.paymentModes.map((m) => ({ label: m.mode, amount: m.amount }))} valueKey="amount" />
    </View>
  );
}

const s = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#0F172A", marginBottom: 8, marginTop: 4 },
  trendBlock: { gap: 8, marginBottom: 16 },
  trendRow: { gap: 4 },
  trendLabel: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  trendBars: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", backgroundColor: "#F1F5F9" },
  trendExpected: { backgroundColor: "#CBD5E1" },
  trendCollected: { backgroundColor: "#16A34A" },
  trendMeta: { fontSize: 10, color: "#94A3B8", textAlign: "right" },
});
