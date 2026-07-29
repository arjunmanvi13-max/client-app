import type {
  CollectionsSummaryData,
  DiscountsReportData,
  FinanceReportFilters,
  PastDueReportData,
  RefundsReportData,
  RevenueBreakdownData,
} from "./financeReportsTypes";

const VENUES = ["Balua", "Harding Park"] as const;
const PROGRAMS = ["Cricket", "Football"] as const;
const TYPES = ["Daily", "Day Boarding", "Hostel", "Boarding"] as const;

function entityMatch(entity: FinanceReportFilters["entity"], tag: "alpha" | "pws") {
  if (entity === "all") return true;
  return entity === tag;
}

function venueMatch(centre: FinanceReportFilters["centre"], venue: string) {
  if (centre === "all") return true;
  return centre === venue;
}

function inr(n: number) {
  return n;
}

export function buildPastDueReport(filters: FinanceReportFilters): PastDueReportData {
  const seed: PastDueReportData["rows"] = [
    { id: "pd1", studentName: "Testy", venue: "Balua", program: "Cricket", type: "Hostel", dueDate: "2026-06-15", daysOverdue: 43, bucket: "31_60", outstanding: 3000 },
    { id: "pd2", studentName: "Ankit Sinha", venue: "Balua", program: "Cricket", type: "Hostel", dueDate: "2026-05-01", daysOverdue: 88, bucket: "61_90", outstanding: 8500 },
    { id: "pd3", studentName: "Rahul Verma", venue: "Harding Park", program: "Football", type: "Daily", dueDate: "2026-07-01", daysOverdue: 27, bucket: "1_30", outstanding: 4200 },
    { id: "pd4", studentName: "Priya Sharma", venue: "Balua", program: "Football", type: "Day Boarding", dueDate: "2026-04-10", daysOverdue: 109, bucket: "90_plus", outstanding: 12000 },
    { id: "pd5", studentName: "Arjun Patel", venue: "Harding Park", program: "Cricket", type: "Boarding", dueDate: "2026-06-28", daysOverdue: 30, bucket: "31_60", outstanding: 6500 },
    { id: "pd6", studentName: "Sneha Das", venue: "Balua", program: "Cricket", type: "Daily", dueDate: "2026-07-10", daysOverdue: 18, bucket: "1_30", outstanding: 2800 },
    { id: "pd7", studentName: "Vikram Singh", venue: "Harding Park", program: "Football", type: "Hostel", dueDate: "2026-03-20", daysOverdue: 130, bucket: "90_plus", outstanding: 15500 },
    { id: "pd8", studentName: "Meera Nair", venue: "Balua", program: "Football", type: "Boarding", dueDate: "2026-06-05", daysOverdue: 53, bucket: "31_60", outstanding: 9200 },
  ];

  const rows = seed.filter((r) => venueMatch(filters.centre, r.venue));
  const totalPastDue = rows.reduce((s, r) => s + r.outstanding, 0);
  const studentsWithDues = rows.length;
  const buckets = {
    "1_30": { count: 0, amount: 0 },
    "31_60": { count: 0, amount: 0 },
    "61_90": { count: 0, amount: 0 },
    "90_plus": { count: 0, amount: 0 },
  } as PastDueReportData["buckets"];
  rows.forEach((r) => {
    buckets[r.bucket].count += 1;
    buckets[r.bucket].amount += r.outstanding;
  });

  return {
    summary: {
      totalPastDue,
      studentsWithDues,
      avgOutstanding: studentsWithDues ? Math.round(totalPastDue / studentsWithDues) : 0,
    },
    buckets,
    rows,
  };
}

export function buildCollectionsSummary(filters: FinanceReportFilters): CollectionsSummaryData {
  const scale = filters.centre === "Harding Park" ? 0.35 : filters.centre === "all" ? 1 : 0.65;
  const collectedMonth = Math.round(842500 * scale);
  const expectedRevenue = Math.round(1100000 * scale);
  return {
    summary: {
      collectedToday: Math.round(18500 * scale),
      collectedMonth,
      expectedRevenue,
      efficiencyPct: expectedRevenue ? Math.round((collectedMonth / expectedRevenue) * 100) : 0,
    },
    trend: [
      { label: "Week 1", expected: Math.round(220000 * scale), collected: Math.round(198000 * scale) },
      { label: "Week 2", expected: Math.round(275000 * scale), collected: Math.round(241000 * scale) },
      { label: "Week 3", expected: Math.round(290000 * scale), collected: Math.round(252000 * scale) },
      { label: "Week 4", expected: Math.round(315000 * scale), collected: Math.round(151500 * scale) },
    ],
    paymentModes: [
      { mode: "UPI", amount: Math.round(382000 * scale), pct: 45, count: 128 },
      { mode: "Cash", amount: Math.round(236000 * scale), pct: 28, count: 94 },
      { mode: "Credit/Debit Card", amount: Math.round(152000 * scale), pct: 18, count: 41 },
      { mode: "Net Banking", amount: Math.round(72500 * scale), pct: 9, count: 22 },
    ],
  };
}

export function buildRevenueBreakdown(filters: FinanceReportFilters): RevenueBreakdownData {
  const scale = filters.centre === "Harding Park" ? 0.4 : filters.centre === "all" ? 1 : 0.6;
  const rows = [
    { lineItem: "Registration Fees", transactions: 42, grossRevenue: inr(210000 * scale), discountsApplied: inr(12000 * scale), netRevenue: inr(198000 * scale) },
    { lineItem: "Monthly Coaching/Academic Fees", transactions: 186, grossRevenue: inr(620000 * scale), discountsApplied: inr(45000 * scale), netRevenue: inr(575000 * scale) },
    { lineItem: "Transport Charges", transactions: 58, grossRevenue: inr(87000 * scale), discountsApplied: inr(3000 * scale), netRevenue: inr(84000 * scale) },
    { lineItem: "Uniform Sales", transactions: 31, grossRevenue: inr(46500 * scale), discountsApplied: inr(1500 * scale), netRevenue: inr(45000 * scale) },
    { lineItem: "Books & Materials", transactions: 24, grossRevenue: inr(28800 * scale), discountsApplied: inr(800 * scale), netRevenue: inr(28000 * scale) },
    { lineItem: "Hostel & Boarding Fees", transactions: 67, grossRevenue: inr(402000 * scale), discountsApplied: inr(22000 * scale), netRevenue: inr(380000 * scale) },
  ];
  return {
    rows,
    totalNet: rows.reduce((s, r) => s + r.netRevenue, 0),
  };
}

export function buildDiscountsReport(filters: FinanceReportFilters): DiscountsReportData {
  const rows = [
    { id: "d1", studentName: "Ankit Sinha", venue: "Balua", originalFee: 12000, discountAmount: 2000, discountPct: 17, reason: "Merit Scholarship", approvedBy: "Sumit Prakash", approvalDate: "2026-07-02" },
    { id: "d2", studentName: "Priya Sharma", venue: "Balua", originalFee: 8500, discountAmount: 1500, discountPct: 18, reason: "Financial Aid", approvedBy: "ALPHA Admin", approvalDate: "2026-06-28" },
    { id: "d3", studentName: "Rahul Verma", venue: "Harding Park", originalFee: 6000, discountAmount: 600, discountPct: 10, reason: "Staff Concession", approvedBy: "Sumit Prakash", approvalDate: "2026-07-15" },
    { id: "d4", studentName: "Sneha Das", venue: "Balua", originalFee: 4500, discountAmount: 450, discountPct: 10, reason: "Sibling Concession", approvedBy: "Accounts Team", approvalDate: "2026-07-08" },
  ].filter((r) => venueMatch(filters.centre, r.venue));

  const totalConcessions = rows.reduce((s, r) => s + r.discountAmount, 0);
  return {
    summary: {
      totalConcessions,
      approvedRequests: rows.length,
      pctOfRevenue: 4.2,
    },
    rows,
  };
}

export function buildRefundsReport(filters: FinanceReportFilters): RefundsReportData {
  const rows = [
    { id: "r1", studentName: "Karan Mehta", program: "Cricket", venue: "Balua", cancellationDate: "2026-07-05", exitReason: "Relocation", refundStatus: "Processed" as const, amountRefunded: 8500 },
    { id: "r2", studentName: "Divya Rao", program: "Football", venue: "Harding Park", cancellationDate: "2026-07-12", exitReason: "Medical reasons", refundStatus: "Pending" as const, amountRefunded: 4200 },
    { id: "r3", studentName: "Rohan Gupta", program: "Cricket", venue: "Balua", cancellationDate: "2026-06-20", exitReason: "Program switch", refundStatus: "Processed" as const, amountRefunded: 3000 },
  ].filter((r) => venueMatch(filters.centre, r.venue));

  return {
    summary: {
      totalRefunds: rows.filter((r) => r.refundStatus === "Processed").length,
      totalCancellations: rows.length,
      netRefundAmount: rows.reduce((s, r) => s + r.amountRefunded, 0),
    },
    rows,
  };
}

export function buildExpenseOutflowReport(filters: FinanceReportFilters) {
  const scale = filters.entity === "alpha" ? 0.6 : 1;
  const rows = [
    { date: "2026-07-15", entity: "PWS", expense_head: "Electricity Bill", vendor: "WBSEDCL", amount: Math.round(45000 * scale), venue: "Balua" },
    { date: "2026-07-12", entity: "PWS", expense_head: "Cricket Gear", vendor: "Sports Mart", amount: Math.round(28000 * scale), venue: "Balua" },
    { date: "2026-07-08", entity: "ALPHA", expense_head: "Fuel & Transport", vendor: "HP Petrol Pump", amount: Math.round(12000 * scale), venue: "Unassigned" },
  ];
  return {
    totals: { amount: rows.reduce((s, r) => s + r.amount, 0), count: rows.length },
    byExpenseHead: [
      { expense_head: "Electricity Bill", main_category: "Utilities", amount: Math.round(45000 * scale), count: 1 },
      { expense_head: "Cricket Gear", main_category: "Sports Equipment", amount: Math.round(28000 * scale), count: 1 },
    ],
    byVenue: [{ venue: "Balua", amount: Math.round(73000 * scale) }],
    rows,
  };
}

export function buildFinanceReportData(filters: FinanceReportFilters) {
  switch (filters.reportView) {
    case "past_due_aging":
      return buildPastDueReport(filters);
    case "collections_summary":
      return buildCollectionsSummary(filters);
    case "revenue_breakdown":
      return buildRevenueBreakdown(filters);
    case "expense_outflow":
      return buildExpenseOutflowReport(filters);
    case "discounts_waivers":
      return buildDiscountsReport(filters);
    case "refunds_cancellations":
      return buildRefundsReport(filters);
    default:
      return buildPastDueReport(filters);
  }
}

export { VENUES, PROGRAMS, TYPES };
