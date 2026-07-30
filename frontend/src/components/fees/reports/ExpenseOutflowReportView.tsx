import { View, Text, StyleSheet } from "react-native";
import { formatDate } from "../../../dateFormat";
import type { ExpenseOutflowReportData } from "../../../fees/financeReportsTypes";
import { inr, ReportTable, SummaryCards } from "./FinanceReportShared";

function paymentCell(method: string, ref?: string | null) {
  if (!ref) return method;
  return `${method} · Ref ${ref}`;
}

function dateUrgencyCell(date: string, urgency?: string | null) {
  const d = formatDate(date);
  return urgency ? `${d} · ${urgency}` : d;
}

export function ExpenseOutflowReportView({ data }: { data: ExpenseOutflowReportData }) {
  const summary = data.summary ?? {
    totalAmount: data.totals?.amount || 0,
    totalCount: data.totals?.count || 0,
    pendingCount: 0,
    pendingAmount: 0,
    approvedCount: data.totals?.count || 0,
    approvedAmount: data.totals?.amount || 0,
    rejectedCount: 0,
    rejectedAmount: 0,
  };

  const detailRows = (data.rows || []).flatMap((r) => {
    const items = r.items?.length
      ? r.items
      : [{ item_name: r.subCategory || "Expense", rate: 0, quantity: 1, amount: r.amount }];
    return items.map((it) => [
      dateUrgencyCell(r.date, r.urgency),
      r.entity,
      r.head,
      it.item_name,
      paymentCell(r.paymentMethod, r.referenceNumber),
      inr(it.amount),
      r.status,
      r.submittedBy,
    ]);
  });

  const headRows = (data.byExpenseHead || []).map((h) => [
    h.expense_head,
    h.main_category || "—",
    String(h.count),
    inr(h.amount),
  ]);

  return (
    <View>
      <SummaryCards
        items={[
          { label: "Total Expenses", value: inr(summary.totalAmount), tone: "warn" },
          { label: "Pending Approvals", value: `${summary.pendingCount} (${inr(summary.pendingAmount)})`, tone: "warn" },
          { label: "Approved Expenses", value: `${summary.approvedCount} (${inr(summary.approvedAmount)})`, tone: "success" },
          { label: "Rejected", value: `${summary.rejectedCount} (${inr(summary.rejectedAmount)})`, tone: summary.rejectedCount ? "danger" : "default" },
        ]}
      />

      <Text style={s.sectionTitle}>Expense Ledger</Text>
      <ReportTable
        columns={[
          "Date / Urgency",
          "Entity",
          "Head / Category",
          "Item / Description",
          "Payment Method & Ref No.",
          "Amount",
          "Status",
          "Submitted By",
        ]}
        rows={detailRows}
        numericFromIndex={5}
      />

      {headRows.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Breakdown by Expense Head</Text>
          <ReportTable columns={["Expense Head", "Category", "Count", "Amount"]} rows={headRows} numericFromIndex={3} />
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: "800", color: "#0F172A", marginBottom: 8, marginTop: 16 },
});
