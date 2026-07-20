import { toISODate } from "../dateFormat";

export type FinanceEntity = "alpha" | "pws" | "all";
export type FinanceCentre = "all" | "Balua" | "Harding Park";
export type ReportView = "current_month" | "past_due" | "history" | "installments";
export type MonthSplit = "dues" | "collections";

export type FinanceFee = {
  id: string;
  status: "due" | "paid";
  period_month: string;
  paid_at?: string;
  centre?: string;
  entity_id?: string;
  organization?: string;
};

export function monthKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Indian FY (Apr–Mar) containing the given date. */
export function financialYearRange(forDate: Date = new Date()): { from: string; to: string; label: string } {
  const year = forDate.getFullYear();
  const month = forDate.getMonth() + 1;
  const fyStartYear = month >= 4 ? year : year - 1;
  const from = `${fyStartYear}-04-01`;
  const to = `${fyStartYear + 1}-03-31`;
  const label = `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, "0")}`;
  return { from, to, label };
}

/** Earliest allowed history start — two financial years back from current FY start. */
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

export function feeEntityId(fee: FinanceFee): "alpha" | "pws" {
  if (fee.entity_id === "pws" || fee.entity_id === "alpha") return fee.entity_id;
  if (fee.organization === "PWS") return "pws";
  return "alpha";
}

export function filterFinanceFees(
  fees: FinanceFee[],
  opts: {
    entity: FinanceEntity;
    centre: FinanceCentre;
    reportView: ReportView;
    monthSplit: MonthSplit;
    historyFrom: string;
    historyTo: string;
    thisMonth?: string;
  },
): FinanceFee[] {
  const thisMonth = opts.thisMonth ?? monthKey();

  return fees.filter((f) => {
    const ent = feeEntityId(f);
    if (opts.entity === "alpha" && ent !== "alpha") return false;
    if (opts.entity === "pws" && ent !== "pws") return false;

    if (opts.centre !== "all") {
      if (ent === "alpha" && f.centre !== opts.centre) return false;
      if (ent === "pws" && f.centre && f.centre !== opts.centre) return false;
    }

    if (opts.reportView === "current_month") {
      if (f.period_month !== thisMonth) return false;
      return opts.monthSplit === "dues" ? f.status === "due" : f.status === "paid";
    }

    if (opts.reportView === "past_due") {
      return f.status === "due";
    }

    if (opts.reportView === "history") {
      if (f.status !== "paid" || !f.paid_at) return false;
      const paidDay = f.paid_at.slice(0, 10);
      return paidDay >= opts.historyFrom && paidDay <= opts.historyTo;
    }

    return false;
  });
}

export function reportViewFromParam(raw?: string | string[]): ReportView | null {
  const tab = Array.isArray(raw) ? raw[0] : raw;
  if (!tab) return null;
  if (tab === "past-due" || tab === "overdue") return "past_due";
  if (tab === "history") return "history";
  if (tab === "installments") return "installments";
  if (tab === "current-month" || tab === "main") return "current_month";
  return null;
}
