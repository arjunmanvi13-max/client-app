import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { formatDate } from "../dateFormat";
import { fetchCollectionsSummary, fetchRevenueBreakdown } from "./financeReportsApi";
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

const LIVE_VIEWS = new Set(["collections_summary", "revenue_breakdown"]);

function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export function getExportMatrix(
  filters: FinanceReportFilters,
  data: ReturnType<typeof buildFinanceReportData>,
): {
  columns: string[];
  rows: string[][];
  summaryRows?: string[][];
} {
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
    const receiptRows = (d.receiptsLog || []).map((r) => [
      formatDate(r.paidAt),
      r.receiptNumber,
      r.payerName,
      r.source === "invoice_payment" ? "Invoice" : "Legacy fee",
      r.paymentMode,
      inr(r.amount),
      r.venue || "—",
      r.collectedBy || "—",
    ]);
    const dailyRows = (d.dailyLog || []).map((r) => [
      formatDate(r.date),
      String(r.transactions),
      inr(r.collected),
      inr(r.expected),
    ]);
    return {
      columns: receiptRows.length
        ? ["Date", "Receipt #", "Payer", "Source", "Mode", "Amount", "Venue", "Collected By"]
        : dailyRows.length
          ? ["Date", "Transactions", "Collected", "Expected"]
          : ["Payment Mode", "Transactions", "Amount", "Share"],
      rows: receiptRows.length
        ? receiptRows
        : dailyRows.length
          ? dailyRows
          : (d.paymentModes ?? []).map((m) => [m.mode, String(m.count), inr(m.amount), `${m.pct}%`]),
      summaryRows: [
        ["Collected Today", inr(d.summary.collectedToday)],
        ["Collected (Period)", inr(d.summary.collectedMonth)],
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
  const mockData = useMemo(
    () => buildFinanceReportData(filters),
    [filters.centre, filters.entity, filters.reportView, filters.period, filters.customFrom, filters.customTo],
  );
  const isLiveView = LIVE_VIEWS.has(filters.reportView);
  const [data, setData] = useState(mockData);
  const [loading, setLoading] = useState(isLiveView);
  const [error, setError] = useState<string | null>(null);

  // Set loading before paint when switching to a live-backed view (avoids stale-data flash).
  useLayoutEffect(() => {
    if (isLiveView) setLoading(true);
  }, [filters.centre, filters.entity, filters.reportView, filters.period, filters.customFrom, filters.customTo, isLiveView]);

  useEffect(() => {
    if (!isLiveView) {
      setData(mockData);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const live = filters.reportView === "collections_summary"
          ? await fetchCollectionsSummary(filters)
          : await fetchRevenueBreakdown(filters);
        if (!cancelled) {
          setData(live);
          setLoading(false);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : "Failed to load report data";
          setError(message);
          setData(mockData);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [filters.centre, filters.entity, filters.reportView, filters.period, filters.customFrom, filters.customTo, mockData, isLiveView]);

  return { data, loading, error };
}

export { reportViewTitle };
