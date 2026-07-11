import { api } from "./auth";

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
        today: new Date().toISOString().slice(0, 10),
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
