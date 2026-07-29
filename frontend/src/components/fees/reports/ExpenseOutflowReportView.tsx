import { View, Text, StyleSheet } from "react-native";
import { formatDate } from "../../../dateFormat";
import type { ExpenseOutflowReportData } from "../../../fees/financeReportsTypes";
import { inr, ReportTable, SummaryCards } from "./FinanceReportShared";

export function ExpenseOutflowReportView({ data }: { data: ExpenseOutflowReportData }) {
  const headRows = (data.byExpenseHead || []).map((h) => [
    h.expense_head,
    h.main_category || "—",
    String(h.count),
    inr(h.amount),
  ]);
  const venueRows = (data.byVenue || []).map((v) => [v.venue, inr(v.amount)]);
  const detailRows = (data.rows || []).slice(0, 100).map((r) => [
    formatDate(r.date),
    r.entity,
    r.expense_head,
    r.vendor,
    r.venue || "—",
    inr(r.amount),
  ]);

  return (
    <View>
      <SummaryCards
        items={[
          { label: "Total Outflow", value: inr(data.totals?.amount || 0), tone: "warn" },
          { label: "Approved Expenses", value: String(data.totals?.count || 0) },
          { label: "Expense Heads", value: String((data.byExpenseHead || []).length) },
          { label: "Venues", value: String((data.byVenue || []).length) },
        ]}
      />
      {headRows.length > 0 && (
        <>
          <Text style={s.sectionTitle}>By Expense Head (₹)</Text>
          <ReportTable columns={["Expense Head", "Category", "Count", "Amount"]} rows={headRows} numericFromIndex={3} />
        </>
      )}
      {venueRows.length > 0 && (
        <>
          <Text style={s.sectionTitle}>By Venue (₹)</Text>
          <ReportTable columns={["Venue", "Amount"]} rows={venueRows} numericFromIndex={1} />
        </>
      )}
      {detailRows.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Approved Expense Ledger</Text>
          <ReportTable columns={["Date", "Entity", "Expense Head", "Vendor", "Venue", "Amount"]} rows={detailRows} numericFromIndex={5} />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#0F172A", marginBottom: 8, marginTop: 4 },
});
