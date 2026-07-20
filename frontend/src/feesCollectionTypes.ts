export type Institution = "PWS" | "ALPHA";

export type FeeStatusFilter = "all" | "overdue" | "due_this_month" | "paid_ahead";

export type FeeSort = "amount_due" | "amount_due_asc" | "name" | "overdue_days";

export type PaymentMode = "Cash" | "UPI" | "Online";

export type CollectionPlayer = {
  id: string;
  name: string;
  mobile?: string;
  centre?: string;
  sport?: string;
  player_type?: string;
  group?: string;
  pws_class?: string;
  is_resident?: boolean;
  amount_due: number;
  amount_due_today: number;
  overdue_days: number;
  fee_status: "paid" | "due" | "overdue" | "paid_ahead";
  badge: string;
  has_current_month_due: boolean;
};

export type CollectionKpis = {
  total_players: number;
  amount_due_today: number;
  overdue_count: number;
  collected_this_month: number;
};

export type CollectionSummary = {
  institution: Institution;
  kpis: CollectionKpis;
  players: CollectionPlayer[];
  filtered_count: number;
  total_due: number;
  current_month: string;
};

export type PaymentReceiptFee = {
  id: string;
  fee_type: string;
  amount?: number;
  amount_due: number;
  period_month?: string;
  discount_applied?: number;
  discount_reason?: string;
};

export type PaymentReceiptBranding = {
  entityCode: "PWS" | "ALPHA";
  entityId: "pws" | "alpha";
  displayName: string;
  shortName: string;
  addressLines: string[];
  receiptTitle: string;
  receiptPrefix: string;
  logoAlt: string;
};

export type PaymentReceipt = {
  batch_id: string;
  receipt_number?: string;
  entity_id?: "pws" | "alpha";
  entity_code?: "PWS" | "ALPHA";
  organization_title?: string;
  branding?: PaymentReceiptBranding;
  paid_at?: string;
  transaction_date?: string;
  player: {
    id?: string;
    name?: string;
    mobile?: string;
    admission_number?: string;
    centre?: string;
    sport?: string;
    group?: string;
    pws_class?: string;
    grade?: string;
    section?: string;
    category?: string;
    player_type?: string;
    kind?: string;
    organization?: string;
    is_resident?: boolean;
  };
  fees: PaymentReceiptFee[];
  total_amount: number;
  balance_after_payment?: number;
  payment_mode: PaymentMode;
  reference_id?: string | null;
  notes?: string | null;
  collected_by?: { id?: string; name?: string; role?: string };
};

export type DuesFee = {
  id: string;
  fee_type: string;
  amount: number;
  amount_due: number;
  period_month: string;
  status: string;
  due_date?: string;
  discount_applied?: number;
  is_first_month?: boolean;
};

export type PlayerDues = {
  player: { id: string; name: string; centre?: string; sport?: string; kind?: string };
  unpaid: DuesFee[];
  paid: DuesFee[];
  advance?: { period_month: string; fee_type: string; amount: number }[];
  current_month: string;
  financial_year_end: string;
  summary: { total_outstanding: number };
};
