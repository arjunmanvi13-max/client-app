import { api } from "../auth";
import { computePeriodRange } from "./financeReportsFilters";
import type { FinanceReportFilters } from "./financeReportsTypes";
import type { CollectionsSummaryData, DailyReceiptRow, ExpenseOutflowReportData, RevenueBreakdownData } from "./financeReportsTypes";

type FinancialSummaryResponse = {
  totals: {
    collected_all_time: number;
    current_month: number;
    previous_month: number;
    outstanding: number;
  };
  by_fee_head: { fee_head: string; amount: number; count: number }[];
};

type PaymentModesResponse = {
  summary: Record<string, { count: number; sum: number }>;
};

type DailyRevenueLogResponse = {
  daily: { date: string; collected: number; transactions: number; expected: number }[];
  trend: { label: string; expected: number; collected: number }[];
  totals: { collected: number; expected: number; transactions: number };
};

type DailyCollectionsResponse = {
  receipts: {
    id: string;
    source: "legacy_fee" | "invoice_payment";
    receipt_number?: string | null;
    invoice_number?: string | null;
    payer_name?: string | null;
    amount: number;
    payment_mode?: string | null;
    reference_id?: string | null;
    paid_at: string;
    venue?: string | null;
    fee_type?: string | null;
    collected_by_name?: string | null;
  }[];
  totals: { count: number; amount: number; collected_today: number; transactions_today: number };
};

function mapPaymentModes(summary: PaymentModesResponse["summary"]) {
  const entries = Object.entries(summary || {});
  const total = entries.reduce((s, [, v]) => s + (v.sum || 0), 0);
  return entries
    .map(([mode, v]) => ({
      mode,
      amount: v.sum || 0,
      count: v.count || 0,
      pct: total ? Math.round(((v.sum || 0) / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function institutionParam(entity: FinanceReportFilters["entity"]): string {
  if (entity === "pws") return "PWS";
  if (entity === "all") return "BOTH";
  return "ALPHA";
}

function centreParam(centre: FinanceReportFilters["centre"]): string | undefined {
  if (centre === "all") return undefined;
  return centre;
}

function reportApiParams(filters: FinanceReportFilters): Record<string, string> {
  const { from, to } = computePeriodRange(filters.period, filters.customFrom, filters.customTo);
  const params: Record<string, string> = {
    date_from: from,
    date_to: to,
    institution: institutionParam(filters.entity),
  };
  const centre = centreParam(filters.centre);
  if (centre) params.centre = centre;
  return params;
}

function mapReceiptRows(receipts: DailyCollectionsResponse["receipts"]): DailyReceiptRow[] {
  return (receipts || []).map((r) => ({
    id: r.id,
    source: r.source,
    receiptNumber: r.receipt_number || r.reference_id || r.id.slice(0, 8),
    invoiceNumber: r.invoice_number,
    payerName: r.payer_name || "—",
    amount: r.amount || 0,
    paymentMode: r.payment_mode || "Unknown",
    referenceId: r.reference_id,
    paidAt: r.paid_at,
    venue: r.venue,
    feeType: r.fee_type,
    collectedBy: r.collected_by_name,
  }));
}

export async function fetchCollectionsSummary(filters: FinanceReportFilters): Promise<CollectionsSummaryData> {
  const params = reportApiParams(filters);
  const [summaryRes, modesRes, dailyRes, collectionsRes] = await Promise.all([
    api.get<FinancialSummaryResponse>("/reports/financial/summary", { params }),
    api.get<PaymentModesResponse>("/reports/financial/payment-modes", { params }),
    api.get<DailyRevenueLogResponse>("/reports/financial/daily-revenue-log", { params }).catch(() => ({ data: null })),
    api.get<DailyCollectionsResponse>("/reports/financial/daily-collections", { params }).catch(() => ({ data: null })),
  ]);

  const summary = summaryRes.data;
  const daily = dailyRes.data;
  const collections = collectionsRes.data;
  const receiptsLog = mapReceiptRows(collections?.receipts || []);
  const collectedPeriod = daily?.totals?.collected
    ?? collections?.totals?.amount
    ?? summary?.totals?.collected_all_time
    ?? 0;
  const collectedToday = collections?.totals?.collected_today ?? 0;
  const expectedRevenue = daily?.totals?.expected || (collectedPeriod + (summary?.totals?.outstanding || 0));
  const efficiencyPct = expectedRevenue
    ? Math.round((collectedPeriod / expectedRevenue) * 100)
    : 0;

  const trend = (daily?.trend?.length
    ? daily.trend
    : [{ label: "Period", expected: expectedRevenue, collected: collectedPeriod }])
    .map((t) => ({
      label: t.label,
      expected: Math.max(t.expected, 1),
      collected: t.collected,
    }));

  return {
    summary: {
      collectedToday,
      collectedMonth: collectedPeriod,
      expectedRevenue,
      efficiencyPct,
    },
    trend,
    paymentModes: mapPaymentModes(modesRes.data?.summary),
    dailyLog: (daily?.daily || []).filter((d) => d.collected > 0 || d.expected > 0),
    receiptsLog,
  };
}

export async function fetchRevenueBreakdown(filters: FinanceReportFilters): Promise<RevenueBreakdownData> {
  const params = reportApiParams(filters);
  const { data } = await api.get<FinancialSummaryResponse>("/reports/financial/summary", { params });

  const rows = (data.by_fee_head || []).map((h) => ({
    lineItem: h.fee_head || "Other",
    transactions: h.count || 0,
    grossRevenue: h.amount || 0,
    discountsApplied: 0,
    netRevenue: h.amount || 0,
  }));

  const totalNet = rows.reduce((s, r) => s + r.netRevenue, 0);
  return { rows, totalNet };
}

export async function fetchExpenseOutflow(filters: FinanceReportFilters): Promise<ExpenseOutflowReportData> {
  const { from, to } = computePeriodRange(filters.period, filters.customFrom, filters.customTo);
  const params: Record<string, string | boolean> = { date_from: from, date_to: to, all_statuses: true };
  if (filters.entity === "pws") params.entity_id = "pws";
  else if (filters.entity === "alpha") params.entity_id = "alpha";
  if (filters.centre !== "all") params.venue = filters.centre;
  const { data } = await api.get<{
    summary?: {
      total_amount: number;
      total_count: number;
      pending_count: number;
      pending_amount: number;
      approved_count: number;
      approved_amount: number;
      rejected_count: number;
      rejected_amount: number;
    };
    totals: { amount: number; count: number };
    by_expense_head: { expense_head: string; main_category?: string; amount: number; count: number }[];
    by_venue: { venue: string; amount: number }[];
    rows: {
      expense_date?: string;
      urgency?: string | null;
      entity_id?: string;
      expense_head_name?: string;
      main_category?: string;
      sub_category?: string;
      items?: { item_name: string; rate: number; quantity: number; amount: number }[];
      payment_mode?: string;
      reference_number?: string | null;
      amount: number;
      status?: string;
      created_by_name?: string;
      venue?: string;
    }[];
  }>("/expenses/summary", { params });

  const statusLabel = (status?: string) => {
    if (status === "pending") return "Pending Approval";
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    return status || "—";
  };

  const summary = data.summary || {
    total_amount: data.totals?.amount || 0,
    total_count: data.totals?.count || 0,
    pending_count: 0,
    pending_amount: 0,
    approved_count: data.totals?.count || 0,
    approved_amount: data.totals?.amount || 0,
    rejected_count: 0,
    rejected_amount: 0,
  };

  return {
    summary: {
      totalAmount: summary.total_amount || 0,
      totalCount: summary.total_count || 0,
      pendingCount: summary.pending_count || 0,
      pendingAmount: summary.pending_amount || 0,
      approvedCount: summary.approved_count || 0,
      approvedAmount: summary.approved_amount || 0,
      rejectedCount: summary.rejected_count || 0,
      rejectedAmount: summary.rejected_amount || 0,
    },
    totals: data.totals,
    byExpenseHead: data.by_expense_head || [],
    byVenue: data.by_venue || [],
    rows: (data.rows || []).map((r) => ({
      date: r.expense_date || "",
      urgency: r.urgency,
      entity: (r.entity_id || "pws").toUpperCase(),
      head: r.main_category || r.expense_head_name || "Other",
      mainCategory: r.main_category,
      subCategory: r.sub_category || r.expense_head_name || "—",
      items: r.items,
      paymentMethod: r.payment_mode || "—",
      referenceNumber: r.reference_number,
      amount: r.amount || 0,
      status: statusLabel(r.status),
      submittedBy: r.created_by_name || "—",
      venue: r.venue,
    })),
  };
}
