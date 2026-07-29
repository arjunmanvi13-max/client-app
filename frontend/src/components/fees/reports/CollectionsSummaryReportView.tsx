import { View, Text, StyleSheet } from "react-native";
import { formatDate } from "../../../dateFormat";
import type { CollectionsSummaryData } from "../../../fees/financeReportsTypes";
import { BarChartSimple, inr, ReportTable, SummaryCards } from "./FinanceReportShared";

export function CollectionsSummaryReportView({ data }: { data: CollectionsSummaryData }) {
  const summary = data.summary ?? { collectedToday: 0, collectedMonth: 0, expectedRevenue: 0, efficiencyPct: 0 };
  const paymentModes = data.paymentModes ?? [];
  const trend = data.trend ?? [];
  const modeColumns = ["Payment Mode", "Transactions", "Amount", "Share"];
  const modeRows = paymentModes.map((m) => [m.mode, String(m.count), inr(m.amount), `${m.pct}%`]);
  const dailyColumns = ["Date", "Transactions", "Collected", "Expected"];
  const dailyRows = (data.dailyLog || []).map((d) => [
    formatDate(d.date),
    String(d.transactions),
    inr(d.collected),
    inr(d.expected),
  ]);
  const receiptColumns = ["Date", "Receipt #", "Payer", "Source", "Mode", "Amount", "Venue", "Collected By"];
  const sourceLabel = (source: string) => (source === "invoice_payment" ? "Invoice" : "Legacy fee");
  const receiptRows = (data.receiptsLog || []).map((r) => [
    formatDate(r.paidAt),
    r.receiptNumber,
    r.payerName,
    sourceLabel(r.source),
    r.paymentMode,
    inr(r.amount),
    r.venue || "—",
    r.collectedBy || "—",
  ]);

  return (
    <View>
      <SummaryCards
        items={[
          { label: "Collected Today", value: inr(summary.collectedToday), tone: "success" },
          { label: "Collected (Period)", value: inr(summary.collectedMonth), tone: "success" },
          { label: "Expected Revenue", value: inr(summary.expectedRevenue) },
          { label: "Collection Efficiency", value: `${summary.efficiencyPct}%`, tone: "warn" },
        ]}
      />
      {dailyRows.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Daily Sales & Revenue Log</Text>
          <ReportTable columns={dailyColumns} rows={dailyRows} numericFromIndex={2} />
        </>
      )}
      {receiptRows.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Daily Collections & Receipts Log</Text>
          <ReportTable columns={receiptColumns} rows={receiptRows} numericFromIndex={5} />
        </>
      )}
      <Text style={s.sectionTitle}>Collection Trend (Expected vs Realized)</Text>
      <View style={s.trendBlock}>
        {trend.map((t) => (
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
      <BarChartSimple items={paymentModes.map((m) => ({ label: m.mode, amount: m.amount }))} valueKey="amount" />
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
