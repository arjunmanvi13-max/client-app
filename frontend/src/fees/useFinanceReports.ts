import { useMemo } from "react";
import { formatDate } from "../dateFormat";
import { buildFinanceReportData } from "./financeReportsMockData";
import type { FinanceReportFilters } from "./financeReportsTypes";
import type {
  CollectionsSummaryData,
  DiscountsReportData,
  PastDueReportData,
  RefundsReportData,
  RevenueBreakdownData,
} from "./financeReportsTypes";
import { reportViewTitle } from "./financeReportsTypes";

function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export function getExportMatrix(filters: FinanceReportFilters): {
  columns: string[];
  rows: string[][];
  summaryRows?: string[][];
} {
  const data = buildFinanceReportData(filters);

  if (filters.reportView === "past_due_aging") {
    const d = data as PastDueReportData;
    return {
      columns: ["Student", "Venue", "Program", "Type", "Due Date", "Days Overdue", "Outstanding"],
      rows: d.rows.map((r) => [r.studentName, r.venue, r.program, r.type, formatDate(r.dueDate), String(r.daysOverdue), inr(r.outstanding)]),
      summaryRows: [
        ["Total Past Due", inr(d.summary.totalPastDue)],
        ["Students with Dues", String(d.summary.studentsWithDues)],
        ["Average Outstanding", inr(d.summary.avgOutstanding)],
      ],
    };
  }

  if (filters.reportView === "collections_summary") {
    const d = data as CollectionsSummaryData;
    return {
      columns: ["Payment Mode", "Transactions", "Amount", "Share"],
      rows: d.paymentModes.map((m) => [m.mode, String(m.count), inr(m.amount), `${m.pct}%`]),
      summaryRows: [
        ["Collected Today", inr(d.summary.collectedToday)],
        ["Collected (Month)", inr(d.summary.collectedMonth)],
        ["Expected Revenue", inr(d.summary.expectedRevenue)],
        ["Collection Efficiency", `${d.summary.efficiencyPct}%`],
      ],
    };
  }

  if (filters.reportView === "revenue_breakdown") {
    const d = data as RevenueBreakdownData;
    return {
      columns: ["Line Item", "Transactions", "Gross Revenue", "Discounts", "Net Revenue"],
      rows: d.rows.map((r) => [r.lineItem, String(r.transactions), inr(r.grossRevenue), inr(r.discountsApplied), inr(r.netRevenue)]),
      summaryRows: [["Total Net Revenue", inr(d.totalNet)]],
    };
  }

  if (filters.reportView === "discounts_waivers") {
    const d = data as DiscountsReportData;
    return {
      columns: ["Student", "Venue", "Original Fee", "Discount", "Reason", "Approved By", "Date"],
      rows: d.rows.map((r) => [r.studentName, r.venue, inr(r.originalFee), `${inr(r.discountAmount)} (${r.discountPct}%)`, r.reason, r.approvedBy, formatDate(r.approvalDate)]),
      summaryRows: [
        ["Total Concessions", inr(d.summary.totalConcessions)],
        ["Approved Requests", String(d.summary.approvedRequests)],
        ["% of Revenue Discounted", `${d.summary.pctOfRevenue}%`],
      ],
    };
  }

  const d = data as RefundsReportData;
  return {
    columns: ["Student", "Program", "Venue", "Cancellation Date", "Exit Reason", "Status", "Refunded"],
    rows: d.rows.map((r) => [r.studentName, r.program, r.venue, formatDate(r.cancellationDate), r.exitReason, r.refundStatus, inr(r.amountRefunded)]),
    summaryRows: [
      ["Refunds Processed", String(d.summary.totalRefunds)],
      ["Total Cancellations", String(d.summary.totalCancellations)],
      ["Net Refund Amount", inr(d.summary.netRefundAmount)],
    ],
  };
}

export function useFinanceReportData(filters: FinanceReportFilters) {
  return useMemo(
    () => buildFinanceReportData(filters),
    [filters.centre, filters.entity, filters.reportView, filters.period, filters.customFrom, filters.customTo],
  );
}

export { reportViewTitle };
