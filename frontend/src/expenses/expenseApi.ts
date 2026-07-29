import { api } from "../auth";
import type {
  ExpenseEntityId,
  ExpenseEntry,
  ExpenseHead,
  ExpenseOutflowSummary,
  ExpensePaymentMode,
  ExpenseTab,
  ExpenseUrgency,
} from "./expenseTypes";

export async function fetchExpenseHeads(entityId: ExpenseEntityId, activeOnly = false): Promise<ExpenseHead[]> {
  const { data } = await api.get<ExpenseHead[]>("/expenses/heads", {
    params: { entity_id: entityId, active_only: activeOnly },
  });
  return data;
}

export async function createExpenseHead(payload: Partial<ExpenseHead> & { entity_id: ExpenseEntityId; main_category: string; sub_category: string }) {
  const { data } = await api.post<ExpenseHead>("/expenses/heads", payload);
  return data;
}

export async function updateExpenseHead(id: string, payload: Partial<ExpenseHead>) {
  const { data } = await api.patch<ExpenseHead>(`/expenses/heads/${id}`, payload);
  return data;
}

export async function toggleExpenseHead(id: string) {
  const { data } = await api.post<ExpenseHead>(`/expenses/heads/${id}/toggle-active`);
  return data;
}

export async function fetchExpenseEntries(entityId: ExpenseEntityId, tab?: ExpenseTab): Promise<ExpenseEntry[]> {
  const params: Record<string, string> = { entity_id: entityId };
  if (tab && tab !== "all") params.tab = tab;
  const { data } = await api.get<ExpenseEntry[]>("/expenses/entries", { params });
  return data;
}

export async function createExpenseEntry(payload: {
  entity_id: ExpenseEntityId;
  expense_head_id: string;
  expense_date: string;
  amount: number;
  payment_mode: ExpensePaymentMode;
  reference_number?: string;
  sub_category?: string;
  rate?: number;
  quantity?: number;
  urgency?: ExpenseUrgency;
  description?: string;
  venue?: string;
}) {
  const { data } = await api.post<ExpenseEntry>("/expenses/entries", payload);
  return data;
}

export async function updateExpenseEntry(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch<ExpenseEntry>(`/expenses/entries/${id}`, payload);
  return data;
}

export async function deleteExpenseEntry(id: string) {
  await api.delete(`/expenses/entries/${id}`);
}

export async function resubmitExpenseEntry(id: string) {
  const { data } = await api.post<ExpenseEntry>(`/expenses/entries/${id}/resubmit`);
  return data;
}

export async function recallExpenseEntry(id: string) {
  const { data } = await api.post<ExpenseEntry>(`/expenses/entries/${id}/recall`);
  return data;
}

export async function uploadExpenseAttachment(entryId: string, file: File | Blob, filename: string) {
  const form = new FormData();
  form.append("file", file, filename);
  const { data } = await api.post<{ id: string; filename: string }>(`/expenses/entries/${entryId}/attachment`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function fetchExpenseAttachment(id: string) {
  const { data } = await api.get<{ data_url: string; filename: string; mime_type: string }>(`/expenses/attachments/${id}`);
  return data;
}

export async function fetchExpenseApprovals(entityId?: ExpenseEntityId, status = "pending"): Promise<ExpenseEntry[]> {
  const params: Record<string, string> = { status };
  if (entityId) params.entity_id = entityId;
  const { data } = await api.get<ExpenseEntry[]>("/expenses/approvals", { params });
  return data;
}

export async function approveExpenseEntry(id: string) {
  const { data } = await api.post<ExpenseEntry>(`/expenses/entries/${id}/approve`);
  return data;
}

export async function rejectExpenseEntry(id: string, reason: string) {
  const { data } = await api.post<ExpenseEntry>(`/expenses/entries/${id}/reject`, { reason });
  return data;
}

export async function bulkApproveExpenses(entryIds: string[]) {
  const { data } = await api.post<{ approved: string[]; count: number }>("/expenses/approvals/bulk-approve", { entry_ids: entryIds });
  return data;
}

export async function fetchExpenseOutflowSummary(params: {
  entity_id?: ExpenseEntityId;
  date_from?: string;
  date_to?: string;
  venue?: string;
}): Promise<ExpenseOutflowSummary> {
  const { data } = await api.get<ExpenseOutflowSummary>("/expenses/summary", { params });
  return data;
}
