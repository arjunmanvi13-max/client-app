import { toISODate } from "../dateFormat";

export type FinanceEntity = "alpha" | "pws" | "all";
export type FinanceCentre = "all" | "Balua" | "Harding Park";
export type ReportView =
  | "past_due_aging"
  | "collections_summary"
  | "revenue_breakdown"
  | "expense_outflow"
  | "discounts_waivers"
  | "refunds_cancellations";
export type PeriodFilter = "today" | "current_month" | "last_month" | "custom";

export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function financialYearRange(forDate: Date = new Date()): { from: string; to: string; label: string } {
  const year = forDate.getFullYear();
  const month = forDate.getMonth() + 1;
  const fyStartYear = month >= 4 ? year : year - 1;
  const from = `${fyStartYear}-04-01`;
  const to = `${fyStartYear + 1}-03-31`;
  const label = `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, "0")}`;
  return { from, to, label };
}

export function historyMinDate(): string {
  const { from } = financialYearRange();
  const fyStartYear = parseInt(from.slice(0, 4), 10);
  return `${fyStartYear - 1}-04-01`;
}

export function defaultHistoryRange(): { from: string; to: string } {
  const { from, to } = financialYearRange();
  const today = toISODate();
  return { from, to: today < to ? today : to };
}

export function clampHistoryRange(from: string, to: string): { from: string; to: string } {
  const min = historyMinDate();
  const today = toISODate();
  let f = from < min ? min : from;
  let t = to > today ? today : to;
  if (f > t) f = t;
  return { from: f, to: t };
}

export function computePeriodRange(period: PeriodFilter, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const t = iso(today);
  if (period === "today") return { from: t, to: t };
  if (period === "current_month") {
    const s = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: iso(s), to: t };
  }
  if (period === "last_month") {
    const s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const e = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: iso(s), to: iso(e) };
  }
  return clampHistoryRange(customFrom, customTo);
}

export function reportViewFromParam(raw?: string | string[]): ReportView | null {
  const tab = Array.isArray(raw) ? raw[0] : raw;
  if (!tab) return null;
  if (tab === "past-due" || tab === "overdue" || tab === "past_due" || tab === "past_due_aging") return "past_due_aging";
  if (tab === "collections" || tab === "collections_summary") return "collections_summary";
  if (tab === "revenue" || tab === "revenue_breakdown") return "revenue_breakdown";
  if (tab === "expenses" || tab === "expense_outflow") return "expense_outflow";
  if (tab === "discounts" || tab === "discounts_waivers") return "discounts_waivers";
  if (tab === "refunds" || tab === "refunds_cancellations") return "refunds_cancellations";
  if (tab === "current-month" || tab === "main") return "past_due_aging";
  return null;
}

export function reportViewToParam(view: ReportView): string {
  const map: Record<ReportView, string> = {
    past_due_aging: "past-due",
    collections_summary: "collections",
    revenue_breakdown: "revenue",
    expense_outflow: "expenses",
    discounts_waivers: "discounts",
    refunds_cancellations: "refunds",
  };
  return map[view];
}

export function periodLabel(period: PeriodFilter): string {
  const map: Record<PeriodFilter, string> = {
    today: "Today",
    current_month: "Current Month",
    last_month: "Last Month",
    custom: "Custom Range",
  };
  return map[period];
}

export function entityLabel(entity: FinanceEntity): string {
  if (entity === "all") return "Both";
  if (entity === "pws") return "PWS";
  return "ALPHA";
}

export function centreLabel(centre: FinanceCentre): string {
  if (centre === "all") return "All Centres";
  return centre;
}
