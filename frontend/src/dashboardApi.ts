import { api } from "./auth";
import { toISODate } from "./dateFormat";
import { normalizeApprovalRequest, type ApprovalRequest } from "./approvalTypes";
import type { ExpenseEntry } from "./expenses/expenseTypes";
import type { TaskRecord } from "./components/tasks/taskTypes";

export type DashboardEntity = "both" | "pws" | "alpha";

export type AttendanceKindStats = {
  present: number;
  absent: number;
  late: number;
  leave: number;
};

export type FinanceBucket = {
  collected: number;
  dues: number;
  collectedToday: number;
  txnToday: number;
  recoveryPct: number;
};

export type CampusAttendance = {
  campus: string;
  organization?: string;
  roster: number;
  present: number;
  late: number;
  absent: number;
  leave: number;
  checkins: number;
};

export type CampusCapacityRow = {
  key: string;
  campus: string;
  sport: string;
  enrolled: number;
  capacity: number;
  utilization_pct?: number | null;
  entity?: string;
  is_batch?: boolean;
};

export type SuperAdminDashboardBundle = {
  mvp: any;
  metrics?: SuperAdminMetrics;
  command?: {
    roster_counts?: Record<string, number>;
    attendance_by_kind?: Record<string, AttendanceKindStats>;
    attendance_by_campus?: CampusAttendance[];
    kpis?: { attendance_pct_today?: number };
  };
  fees?: {
    due_current_month: number;
    due_past: number;
    collected_today: number;
    received_total: number;
  };
  financeByEntity: {
    pws: FinanceBucket;
    alpha: FinanceBucket;
    combined: FinanceBucket;
  };
  openTasks: TaskRecord[];
  pendingApprovals: number;
  pendingApprovalRows: ApprovalRequest[];
  expenseApprovals: ExpenseEntry[];
};

export type EnrollmentMetric = {
  category: string;
  active: number;
  baseline: number;
  gap: number;
  utilization_pct?: number | null;
};

export type SuperAdminMetrics = {
  entity: string;
  date: string;
  enrollment: EnrollmentMetric[];
  pws_enrollment?: Array<{ key: string; label: string; active: number; baseline: number; gap: number }>;
  alpha_enrollment?: Array<{
    key: string;
    category: string;
    sports: Record<string, { active: number; baseline: number; gap: number }>;
  }>;
  pws_total_baseline?: number;
  pws_total_active?: number;
  campus_capacity?: CampusCapacityRow[];
  capacity_alerts?: CampusCapacityRow[];
  alpha_totals?: { cricket: number; football: number; overall?: number };
  revenue: {
    expected_monthly: number;
    collected_monthly: number;
    collection_gap: number;
    by_category: Array<{ category: string; expected: number; collected: number; gap: number }>;
  };
  aging_dues: {
    current_month_dues: number;
    current_month_count: number;
    overdue_past_month: number;
    overdue_count: number;
  };
  attendance_roles: {
    coaches: AttendanceKindStats & { roster: number };
    staff: AttendanceKindStats & { roster: number };
  };
  open_tasks: number;
  pending_approvals: number;
};

const OPEN_TASK_STATUSES = new Set(["open", "assigned", "in_progress", "blocked", "delayed"]);

function entityKinds(entity: DashboardEntity): string[] {
  if (entity === "pws") return ["teacher", "staff", "student"];
  if (entity === "alpha") return ["coach", "player", "staff"];
  return ["teacher", "staff", "coach", "student", "player"];
}

function filterCommandCenter(cc: any, entity: DashboardEntity) {
  const kinds = entityKinds(entity);
  const att: Record<string, AttendanceKindStats> = {};
  for (const kind of kinds) {
    if (cc?.attendance_by_kind?.[kind]) att[kind] = cc.attendance_by_kind[kind];
  }
  const roster = cc?.roster_counts || {};
  let roster_counts: Record<string, number> = { ...roster };
  if (entity === "pws") {
    roster_counts = {
      teachers: roster.teachers || 0,
      staff: roster.staff || 0,
      students: roster.students || 0,
      players: 0,
      coaches: 0,
    };
  } else if (entity === "alpha") {
    roster_counts = {
      teachers: 0,
      staff: roster.staff || 0,
      students: 0,
      players: roster.players || 0,
      coaches: roster.coaches || 0,
    };
  }
  const campuses = (cc?.attendance_by_campus || []) as CampusAttendance[];
  const attendance_by_campus = campuses.filter((row) => {
    const org = (row.organization || "").toUpperCase();
    if (entity === "pws") return org === "PWS";
    if (entity === "alpha") return org === "ALPHA";
    return true;
  });
  return { roster_counts, attendance_by_kind: att, attendance_by_campus, kpis: cc?.kpis };
}

function aggregateFeesDashboard(raw: any, entity: DashboardEntity) {
  const buckets: any[] = [];
  if (entity !== "pws") {
    Object.values(raw?.by_centre || {}).forEach((b) => buckets.push(b));
  }
  if (entity !== "alpha" && raw?.by_entity?.pws) buckets.push(raw.by_entity.pws);
  const sum = (key: string) => buckets.reduce((n, b) => n + (b?.[key] || 0), 0);
  return {
    due_current_month: sum("due_current_month"),
    due_past: sum("due_past"),
    collected_today: sum("collected_today"),
    collected_today_count: sum("collected_today_count"),
    received_total: sum("received_total"),
  };
}

function emptyFinanceBucket(): FinanceBucket {
  return { collected: 0, dues: 0, collectedToday: 0, txnToday: 0, recoveryPct: 0 };
}

function toFinanceBucket(b: any): FinanceBucket {
  const collected = Number(b?.received_total || 0);
  const dues = Number(b?.due_current_month || 0) + Number(b?.due_past || 0);
  const denom = collected + dues;
  return {
    collected,
    dues,
    collectedToday: Number(b?.collected_today || 0),
    txnToday: Number(b?.collected_today_count || 0),
    recoveryPct: denom ? Math.round((collected / denom) * 100) : 0,
  };
}

function mergeFinance(a: FinanceBucket, b: FinanceBucket): FinanceBucket {
  const collected = a.collected + b.collected;
  const dues = a.dues + b.dues;
  const denom = collected + dues;
  return {
    collected,
    dues,
    collectedToday: a.collectedToday + b.collectedToday,
    txnToday: a.txnToday + b.txnToday,
    recoveryPct: denom ? Math.round((collected / denom) * 100) : 0,
  };
}

function financeFromFeesDashboard(raw: any): SuperAdminDashboardBundle["financeByEntity"] {
  const pws = toFinanceBucket(raw?.by_entity?.pws);
  const alpha = toFinanceBucket(aggregateFeesDashboard(raw, "alpha"));
  return { pws, alpha, combined: mergeFinance(pws, alpha) };
}

function filterTasksByEntity(tasks: any[], entity: DashboardEntity) {
  return tasks.filter((t) => {
    const eid = (t.entity_id || "both").toLowerCase();
    if (entity === "both") return true;
    if (entity === "pws") return eid === "pws" || eid === "both" || !t.entity_id;
    return eid === "alpha" || eid === "both" || !t.entity_id;
  });
}

function filterApprovalsByEntity(rows: any[], entity: DashboardEntity) {
  return rows.filter((r) => {
    if (r.status !== "pending") return false;
    const eid = (r.entity_id || "pws").toLowerCase();
    if (entity === "both") return true;
    if (entity === "pws") return eid === "pws";
    return eid === "alpha";
  });
}

/** Super Admin / ALPHA Admin bento dashboard data bundle. */
export async function fetchSuperAdminDashboardBundle(entity: DashboardEntity): Promise<SuperAdminDashboardBundle> {
  const entityParam = entity === "both" ? "both" : entity;
  const expenseEntity = entity === "both" ? undefined : entity;
  const [mvp, ccRes, tasksRes, feesRes, metricsRes, approvalsRes, expensesRes] = await Promise.all([
    fetchDashboardMvp({ entity: entityParam }),
    api.get("/command-center").catch(() => ({ data: null })),
    api.get("/tasks").catch(() => ({ data: [] })),
    api.get("/fees/dashboard").catch(() => ({ data: null })),
    api.get("/dashboard/super-admin-metrics", { params: { entity: entityParam } }).catch(() => ({ data: null })),
    api.get("/approval-requests").catch(() => ({ data: [] })),
    api.get("/expenses/approvals", { params: { status: "pending", ...(expenseEntity ? { entity_id: expenseEntity } : {}) } }).catch(() => ({ data: [] })),
  ]);

  const allTasks = Array.isArray(tasksRes.data) ? tasksRes.data : [];
  const entityTasks = filterTasksByEntity(allTasks, entity);
  const openTasks = entityTasks.filter((t: any) => OPEN_TASK_STATUSES.has(t.status || "open")) as TaskRecord[];

  const approvals = Array.isArray(approvalsRes.data) ? approvalsRes.data : [];
  const pendingApprovalRows = filterApprovalsByEntity(approvals, entity).map(normalizeApprovalRequest);
  const expenseApprovals = (Array.isArray(expensesRes.data) ? expensesRes.data : []) as ExpenseEntry[];

  return {
    mvp: mvp,
    metrics: metricsRes.data || undefined,
    command: ccRes.data ? filterCommandCenter(ccRes.data, entity) : undefined,
    fees: feesRes.data ? aggregateFeesDashboard(feesRes.data, entity) : undefined,
    financeByEntity: feesRes.data ? financeFromFeesDashboard(feesRes.data) : {
      pws: emptyFinanceBucket(),
      alpha: emptyFinanceBucket(),
      combined: emptyFinanceBucket(),
    },
    openTasks,
    pendingApprovals: pendingApprovalRows.length,
    pendingApprovalRows,
    expenseApprovals,
  };
}

/** Fetch role-based dashboard MVP; falls back when older backends lack GET /dashboard/mvp. */
export async function fetchDashboardMvp(params?: Record<string, string>) {
  try {
    const { data } = await api.get("/dashboard/mvp", { params });
    return data;
  } catch (e: any) {
    if (e?.response?.status !== 404) throw e;
    return fetchDashboardMvpFallback(params?.entity);
  }
}

async function fetchDashboardMvpFallback(entity?: string) {
  // Parent portal — wards list is the meaningful fallback
  try {
    const { data: wards } = await api.get("/parent/wards");
    if (Array.isArray(wards)) {
      return {
        role: "parent",
        today: toISODate(),
        children: wards,
        _fallback: true,
      };
    }
  } catch {
    /* not a parent session */
  }

  // Teacher — return empty shell so UI renders instead of erroring
  try {
    const { data: dash } = await api.get("/dashboard");
    if (dash?.today) {
      return {
        role: "teacher",
        today: dash.today,
        assigned_classes: [],
        attendance_today: [],
        pending_marks_entry: 0,
        recent_notifications: [],
        unread_notifications: dash.unread_notifications ?? 0,
        _fallback: true,
      };
    }
  } catch {
    /* continue */
  }

  // Super Admin / Admin — assemble from command center
  const [{ data: cc }, approvalsRes] = await Promise.all([
    api.get("/command-center"),
    api.get("/approval-requests").catch(() => ({ data: [] as any[] })),
  ]);

  const att = cc.attendance_by_kind || {};
  const totals = { present: 0, absent: 0, late: 0, leave: 0, total: 0 };
  const kinds =
    entity === "pws"
      ? ["teacher", "staff", "student"]
      : entity === "alpha"
        ? ["coach", "player"]
        : ["teacher", "staff", "coach", "student", "player"];

  for (const kind of kinds) {
    const v = att[kind] || {};
    totals.present += v.present || 0;
    totals.absent += v.absent || 0;
    totals.late += v.late || 0;
    totals.leave += v.leave || 0;
  }
  totals.total = totals.present + totals.absent + totals.late + totals.leave;

  const roster = cc.roster_counts || {};
  let activePeople = 0;
  if (entity === "pws") {
    activePeople = (roster.students || 0) + (roster.teachers || 0) + (roster.staff || 0);
  } else if (entity === "alpha") {
    activePeople = (roster.players || 0) + (roster.coaches || 0);
  } else {
    activePeople =
      (roster.students || 0) +
      (roster.players || 0) +
      (roster.teachers || 0) +
      (roster.coaches || 0) +
      (roster.staff || 0);
  }

  const tasks = cc.tasks?.by_status || {};
  const openTasks =
    (tasks.open || 0) +
    (tasks.in_progress || 0) +
    (tasks.blocked || 0) +
    (tasks.assigned || 0) +
    (tasks.delayed || 0);

  const pendingApprovals = Array.isArray(approvalsRes.data)
    ? approvalsRes.data.filter((r: any) => r.status === "pending").length
    : 0;

  return {
    today: cc.date,
    active_people: activePeople,
    attendance_today: totals,
    fees_collected_today: { total: 0, transaction_count: 0 },
    outstanding_invoices: { total: 0, count: 0 },
    pending_approvals: pendingApprovals,
    open_tasks: openTasks,
    _fallback: true,
  };
}
