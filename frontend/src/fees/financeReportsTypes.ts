import type { FinanceCentre, FinanceEntity, PeriodFilter, ReportView } from "./financeReportsFilters";

export type FinanceReportFilters = {
  centre: FinanceCentre;
  entity: FinanceEntity;
  reportView: ReportView;
  period: PeriodFilter;
  customFrom: string;
  customTo: string;
};

export type AgingBucket = "1_30" | "31_60" | "61_90" | "90_plus";

export type PastDueRow = {
  id: string;
  studentName: string;
  venue: string;
  program: string;
  type: string;
  dueDate: string;
  daysOverdue: number;
  bucket: AgingBucket;
  outstanding: number;
};

export type PastDueReportData = {
  summary: {
    totalPastDue: number;
    studentsWithDues: number;
    avgOutstanding: number;
  };
  buckets: Record<AgingBucket, { count: number; amount: number }>;
  rows: PastDueRow[];
};

export type CollectionsSummaryData = {
  summary: {
    collectedToday: number;
    collectedMonth: number;
    expectedRevenue: number;
    efficiencyPct: number;
  };
  trend: { label: string; expected: number; collected: number }[];
  paymentModes: { mode: string; amount: number; pct: number; count: number }[];
};

export type RevenueLineItem = {
  lineItem: string;
  transactions: number;
  grossRevenue: number;
  discountsApplied: number;
  netRevenue: number;
};

export type RevenueBreakdownData = {
  rows: RevenueLineItem[];
  totalNet: number;
};

export type DiscountRow = {
  id: string;
  studentName: string;
  venue: string;
  originalFee: number;
  discountAmount: number;
  discountPct: number;
  reason: string;
  approvedBy: string;
  approvalDate: string;
};

export type DiscountsReportData = {
  summary: {
    totalConcessions: number;
    approvedRequests: number;
    pctOfRevenue: number;
  };
  rows: DiscountRow[];
};

export type RefundRow = {
  id: string;
  studentName: string;
  program: string;
  venue: string;
  cancellationDate: string;
  exitReason: string;
  refundStatus: "Pending" | "Processed";
  amountRefunded: number;
};

export type RefundsReportData = {
  summary: {
    totalRefunds: number;
    totalCancellations: number;
    netRefundAmount: number;
  };
  rows: RefundRow[];
};

export type FinanceReportExportPayload = {
  title: string;
  reportView: ReportView;
  format: "csv" | "xlsx" | "pdf";
  filters: FinanceReportFilters;
  columns: string[];
  rows: string[][];
  summaryRows?: string[][];
};

export function reportViewTitle(view: ReportView): string {
  const map: Record<ReportView, string> = {
    past_due_aging: "Past Due & Aging Receivables",
    collections_summary: "Fee Collections Summary",
    revenue_breakdown: "Revenue Breakdown by Line Item",
    discounts_waivers: "Discounts, Waivers & Concessions",
    refunds_cancellations: "Refunds & Cancellations",
  };
  return map[view];
}
