/** Download names for Reports & Exports files. */

export const REPORT_FILE_LABELS: Record<string, string> = {
  students: "Students",
  players: "Players",
  staff: "Staff",
  "attendance-summary": "Attendance-Summary",
  "attendance-detail": "Attendance-Detail",
  "fee-collection": "Fee-Collection",
  "fee-setup": "Fee-Setup",
  "outstanding-invoices": "Outstanding-Invoices",
  "payment-receipts": "Payment-Receipts",
  "marks-summary": "Marks-Summary",
  "report-card-status": "Report-Card-Status",
};

const FILTER_FILE_PARTS: { key: string; label: string }[] = [
  { key: "centre", label: "Centre" },
  { key: "sport", label: "Sport" },
  { key: "player_type", label: "Category" },
  { key: "grade", label: "Grade" },
  { key: "pws_student_type", label: "Type" },
  { key: "status", label: "Status" },
  { key: "department", label: "Dept" },
  { key: "designation", label: "Role" },
  { key: "fee_collection_type", label: "FeeType" },
  { key: "payment_method", label: "Pay" },
  { key: "shift", label: "Shift" },
  { key: "date_from", label: "From" },
  { key: "date_to", label: "To" },
];

function token(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function reportExportFilename(
  reportId: string,
  params: Record<string, string> | null | undefined,
  ext: "pdf" | "xlsx" | "csv",
  asOf = new Date(),
): string {
  const kind = REPORT_FILE_LABELS[reportId] || token(reportId) || "Report";
  const day = `${asOf.getFullYear()}-${String(asOf.getMonth() + 1).padStart(2, "0")}-${String(asOf.getDate()).padStart(2, "0")}`;
  const bits = [kind, day];
  const skipDates = new Set([
    "students", "players", "staff", "outstanding-invoices", "marks-summary", "report-card-status", "fee-setup",
  ]);
  for (const { key, label } of FILTER_FILE_PARTS) {
    if (skipDates.has(reportId) && (key === "date_from" || key === "date_to")) continue;
    const raw = (params?.[key] || "").trim();
    if (!raw || raw.toLowerCase() === "all") continue;
    const value = key === "date_from" || key === "date_to" ? raw.slice(0, 10) : raw;
    const t = token(value);
    if (t) bits.push(`${label}-${t}`);
  }
  return `${bits.join("_")}.${ext}`;
}
