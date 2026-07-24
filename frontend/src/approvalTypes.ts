/** Approval workflow types — mirrors backend approval_types.py enrichment. */

export type ApprovalCategory =
  | "user_deactivation"
  | "fee_edit"
  | "fee_concession"
  | "fee_override_admission"
  | "refund";

export type ApprovalUserRole =
  | "Principal"
  | "Vice Principal"
  | "Academic Head"
  | "Warden"
  | "Event Coordinator"
  | "Teacher"
  | "Coach"
  | "Staff"
  | "Student"
  | "Player"
  | "PWS Admin"
  | "ALPHA Admin"
  | "Super Admin"
  | string;

export type ApprovalEntity = "PWS" | "ALPHA" | "BOTH";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

export type ApprovalRequest = {
  id: string;
  type?: string;
  category: ApprovalCategory;
  targetUserRole?: ApprovalUserRole;
  targetUserName: string;
  entity: ApprovalEntity;
  requestedBy: string;
  status: ApprovalStatus;
  details: Record<string, unknown>;
  createdAt: string;
  reason?: string;
  subject_id?: string;
  subject_label?: string;
  entity_id?: string;
  requested_by_name?: string;
  requested_at?: string;
  decided_by_name?: string;
  decided_at?: string;
  decision_note?: string;
  history?: Array<{ action: string; user_name: string; at: string; note?: string }>;
  comments?: Array<{ id: string; user_name: string; text: string; created_at: string }>;
  payload?: Record<string, unknown>;
};

export const APPROVAL_CATEGORY_FILTERS: Array<{ key: "all" | ApprovalCategory; label: string }> = [
  { key: "all", label: "All" },
  { key: "user_deactivation", label: "Deactivations" },
  { key: "fee_edit", label: "Fee edits" },
  { key: "fee_concession", label: "Concessions" },
  { key: "fee_override_admission", label: "Fee overrides" },
  { key: "refund", label: "Refunds" },
];

const LEGACY_TYPE_TO_CATEGORY: Record<string, ApprovalCategory> = {
  student_deactivation: "user_deactivation",
  player_deactivation: "user_deactivation",
  user_deactivation: "user_deactivation",
  fee_edit: "fee_edit",
  fee_concession: "fee_concession",
  fee_override_admission: "fee_override_admission",
  refund: "refund",
};

export const CATEGORY_LABELS: Record<ApprovalCategory, string> = {
  user_deactivation: "User deactivation",
  fee_edit: "Fee edit",
  fee_concession: "Fee concession",
  fee_override_admission: "Fee override",
  refund: "Refund",
};

function inferCategory(raw: any): ApprovalCategory {
  if (raw?.category && LEGACY_TYPE_TO_CATEGORY[raw.category]) {
    return raw.category as ApprovalCategory;
  }
  const t = raw?.type || "";
  return LEGACY_TYPE_TO_CATEGORY[t] || "user_deactivation";
}

function inferRole(raw: any): ApprovalUserRole | undefined {
  if (raw?.target_user_role) return raw.target_user_role;
  const payload = raw?.payload || raw?.details || {};
  if (payload.target_role) return String(payload.target_role);
  if (raw?.type === "student_deactivation") return "Student";
  if (raw?.type === "player_deactivation") return "Player";
  return undefined;
}

function inferEntity(raw: any): ApprovalEntity {
  const org = raw?.entity || raw?.organization;
  if (org === "PWS" || org === "ALPHA" || org === "BOTH") return org;
  const eid = (raw?.entity_id || "").toLowerCase();
  if (eid === "alpha") return "ALPHA";
  if (eid === "both") return "BOTH";
  return "PWS";
}

export function normalizeApprovalRequest(raw: any): ApprovalRequest {
  const category = inferCategory(raw);
  const details = raw?.details || raw?.payload || {};
  return {
    id: raw.id,
    type: raw.type,
    category,
    targetUserRole: inferRole(raw),
    targetUserName: raw.target_user_name || raw.subject_label || raw.targetUserName || "—",
    entity: inferEntity(raw),
    requestedBy: raw.requested_by || raw.requested_by_name || "",
    status: raw.status || "pending",
    details,
    createdAt: raw.created_at || raw.requested_at || "",
    reason: raw.reason,
    subject_id: raw.subject_id,
    subject_label: raw.subject_label,
    entity_id: raw.entity_id,
    requested_by_name: raw.requested_by_name,
    requested_at: raw.requested_at,
    decided_by_name: raw.decided_by_name,
    decided_at: raw.decided_at,
    decision_note: raw.decision_note,
    history: raw.history,
    comments: raw.comments,
    payload: raw.payload,
  };
}

export function formatInr(amount: unknown): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN")}`;
}

export function financialSummary(req: ApprovalRequest): string[] {
  const d = req.details || {};
  const lines: string[] = [];
  if (req.category === "fee_concession") {
    if (d.person_name || req.targetUserName) lines.push(String(d.person_name || req.targetUserName));
    if (d.discount_amount != null) lines.push(`Concession: ${formatInr(d.discount_amount)}`);
    if (d.discount_percent != null) lines.push(`Rate: ${d.discount_percent}%`);
    if (d.original_amount_due != null) lines.push(`Current due: ${formatInr(d.original_amount_due)}`);
  }
  if (req.category === "fee_edit") {
    if (d.person_name || req.targetUserName) lines.push(String(d.person_name || req.targetUserName));
    if (d.previous_amount_due != null && d.new_amount_due != null) {
      lines.push(`Amount: ${formatInr(d.previous_amount_due)} → ${formatInr(d.new_amount_due)}`);
    }
    if (d.fee_type) lines.push(`Type: ${d.fee_type}`);
    if (d.period_month) lines.push(`Period: ${d.period_month}`);
  }
  if (req.category === "fee_override_admission") {
    const defaults = (d.default_fees || {}) as Record<string, unknown>;
    const custom = (d.custom_fees || {}) as Record<string, unknown>;
    Object.keys({ ...defaults, ...custom }).forEach((key) => {
      const defVal = defaults[key];
      const customVal = custom[key];
      if (customVal != null) {
        lines.push(`${key}: ${formatInr(defVal)} → ${formatInr(customVal)}`);
      }
    });
  }
  if (req.category === "refund") {
    if (d.amount != null) lines.push(`Refund: ${formatInr(d.amount)}`);
    if (d.invoice_id) lines.push(`Invoice: ${d.invoice_id}`);
  }
  return lines;
}

export function roleBadgeLabel(req: ApprovalRequest): string | null {
  if (req.category !== "user_deactivation") return null;
  const role = req.targetUserRole || "User";
  return `${role} · ${req.entity}`;
}
