export type ExpenseEntityId = "pws" | "alpha";

export type ExpenseStatus = "pending" | "approved" | "rejected" | "cancelled";

export type ExpenseUrgency = "Today" | "Tomorrow" | "This Week";

export type ExpensePaymentMode = "Cash" | "UPI" | "Bank Transfer" | "Cheque" | "Credit Card";

export type ExpenseHead = {
  id: string;
  entity_id: ExpenseEntityId;
  category_code: string;
  main_category: string;
  sub_category: string;
  monthly_budget_limit?: number | null;
  status: "active" | "inactive";
  created_at?: string;
  updated_at?: string;
};

export type BudgetAlert = {
  over_budget: boolean;
  monthly_budget_limit?: number;
  monthly_spent?: number;
  projected_total?: number;
  overage?: number;
};

export type ExpenseAuditEntry = {
  id: string;
  action: string;
  user_id: string;
  user_name: string;
  user_role?: string;
  note?: string;
  changes?: Record<string, unknown>;
  at: string;
};

export type ExpenseEntry = {
  id: string;
  request_id: string;
  entity_id: ExpenseEntityId;
  expense_head_id: string;
  expense_head_name?: string;
  main_category?: string;
  category_code?: string;
  sub_category?: string;
  expense_date: string;
  amount: number;
  rate?: number | null;
  quantity?: number | null;
  urgency?: ExpenseUrgency | null;
  payment_mode: ExpensePaymentMode;
  vendor_name: string;
  reference_number?: string | null;
  description?: string | null;
  venue?: string | null;
  status: ExpenseStatus;
  attachment_id?: string | null;
  rejection_reason?: string | null;
  budget_alert?: BudgetAlert | null;
  created_at: string;
  created_by_id: string;
  created_by_name: string;
  created_by_role?: string;
  entered_by_name?: string;
  entered_by_role?: string;
  approved_at?: string | null;
  approved_by_name?: string | null;
  rejected_at?: string | null;
  rejected_by_name?: string | null;
  audit_trail?: ExpenseAuditEntry[];
};

export type ExpenseOutflowSummary = {
  totals: { amount: number; count: number };
  by_expense_head: { expense_head: string; main_category?: string; amount: number; count: number }[];
  by_venue: { venue: string; amount: number }[];
  rows: ExpenseEntry[];
};

export const EXPENSE_MAIN_CATEGORIES = [
  "Operational",
  "Capital Expenditure",
  "Canteen",
  "Sports Equipment",
  "Academic Supplies",
  "Utilities",
  "Maintenance",
] as const;

export const EXPENSE_PAYMENT_MODES: ExpensePaymentMode[] = [
  "Cash", "UPI", "Bank Transfer", "Cheque", "Credit Card",
];

export const EXPENSE_URGENCY_OPTIONS: ExpenseUrgency[] = ["Today", "Tomorrow", "This Week"];

export type ExpenseTab = "all" | "pending" | "approved" | "rejected";
