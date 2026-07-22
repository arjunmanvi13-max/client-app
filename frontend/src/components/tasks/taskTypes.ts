import { STATUS_COLORS } from "../../auth";

export type TaskViewTab = "assigned_to_me" | "assigned_by_me";

export type TaskStatusFilter = "all" | "pending" | "high" | "overdue";

export type TaskRecord = {
  id: string;
  title: string;
  description?: string;
  priority: "low" | "medium" | "high";
  status: string;
  due_date?: string;
  deadline?: string;
  category?: string;
  department?: string;
  created_by: string;
  created_by_name?: string;
  created_by_role?: string;
  assignee_id?: string;
  assignee_name?: string;
  assignee_role?: string;
  assignee_ids?: string[];
  entity_id?: string;
  proof_url?: string;
  comments?: unknown[];
};

export const TASK_CATEGORIES = [
  "Canteen",
  "Hostel",
  "Academics",
  "Sports",
  "Operations",
  "Finance",
  "General",
] as const;

export const ASSIGNED_TO_ME_STATUSES = ["open", "in_progress", "completed"] as const;

export function taskCategory(task: TaskRecord): string | undefined {
  return task.category || task.department || undefined;
}

export function taskDueDate(task: TaskRecord): string | undefined {
  return task.due_date || task.deadline;
}

export function isTaskCompleted(status: string): boolean {
  return status === "completed" || status === "reviewed" || status === "cancelled";
}

export function isTaskPending(status: string): boolean {
  return !isTaskCompleted(status);
}

export function isTaskOverdue(task: TaskRecord): boolean {
  const due = taskDueDate(task);
  if (!due || isTaskCompleted(task.status)) return false;
  const dt = new Date(due);
  if (isNaN(dt.getTime())) return false;
  return dt.getTime() < Date.now();
}

export function formatTaskStatus(status: string): string {
  return status.replace(/_/g, " ").toUpperCase();
}

export function statusBadgeStyle(status: string) {
  const color = STATUS_COLORS[status] || "#64748B";
  if (status === "completed" || status === "reviewed") {
    return { bg: "#DCFCE7", text: "#16A34A", border: "#BBF7D0", accent: color };
  }
  if (status === "in_progress") {
    return { bg: "#DBEAFE", text: "#1D4ED8", border: "#BFDBFE", accent: color };
  }
  if (status === "blocked" || status === "delayed") {
    return { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA", accent: color };
  }
  return { bg: "#F1F5F9", text: "#475569", border: "#E2E8F0", accent: color };
}

export function matchesTaskSearch(task: TaskRecord, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    task.title,
    task.description,
    task.created_by_name,
    task.assignee_name,
    taskCategory(task),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function matchesTaskStatusFilter(task: TaskRecord, filter: TaskStatusFilter): boolean {
  switch (filter) {
    case "pending":
      return isTaskPending(task.status);
    case "high":
      return task.priority === "high";
    case "overdue":
      return isTaskOverdue(task);
    default:
      return true;
  }
}
