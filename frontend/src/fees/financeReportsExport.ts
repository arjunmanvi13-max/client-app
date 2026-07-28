import { Platform, Alert } from "react-native";
import { api } from "../auth";
import { formatDate, formatDateTimeIST } from "../dateFormat";
import { getApiErrorFromResponse } from "../ScreenStates";
import { centreLabel, entityLabel, periodLabel } from "./financeReportsFilters";
import type { FinanceReportExportPayload, FinanceReportFilters } from "./financeReportsTypes";
import { reportViewTitle } from "./financeReportsTypes";

const ORG_NAME = "ALPHA Sports Academy & PWS";

function buildFilterSubtitle(filters: FinanceReportFilters, userName?: string): string {
  const parts = [
    `Venue: ${centreLabel(filters.centre)}`,
    `Entity: ${entityLabel(filters.entity)}`,
    `Period: ${periodLabel(filters.period)}`,
  ];
  if (filters.period === "custom") {
    parts.push(`${formatDate(filters.customFrom)} – ${formatDate(filters.customTo)}`);
  }
  const ts = formatDateTimeIST(new Date());
  parts.push(`Generated on: ${ts}${userName ? ` by ${userName}` : ""}`);
  return parts.join(" · ");
}

function downloadBlob(blob: Blob, filename: string) {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    Alert.alert("Export", "File download is available on web.");
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportCsvClient(payload: FinanceReportExportPayload, subtitle: string) {
  const lines: string[] = [
    ORG_NAME,
    payload.title,
    subtitle,
    "",
    payload.columns.join(","),
    ...payload.rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
  ];
  if (payload.summaryRows?.length) {
    lines.push("", "Summary");
    payload.summaryRows.forEach((row) => lines.push(row.join(",")));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${payload.reportView}.csv`);
}

export async function exportFinanceReport(
  payload: FinanceReportExportPayload,
  userName?: string,
) {
  const subtitle = buildFilterSubtitle(payload.filters, userName);
  const fullPayload = {
    organization: ORG_NAME,
    title: payload.title,
    subtitle,
    report_view: payload.reportView,
    format: payload.format,
    columns: payload.columns,
    rows: payload.rows,
    summary_rows: payload.summaryRows || [],
  };

  if (payload.format === "csv") {
    exportCsvClient(payload, subtitle);
    return;
  }

  try {
    const { data } = await api.post("/reports/finance-reports/export", fullPayload, {
      responseType: "blob",
    });
    const ext = payload.format === "pdf" ? "pdf" : "xlsx";
    const mime = payload.format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    downloadBlob(new Blob([data], { type: mime }), `${payload.reportView}.${ext}`);
  } catch (e) {
    const msg = await getApiErrorFromResponse(e, "Export failed");
    Alert.alert("Export failed", msg);
  }
}

export function buildExportPayload(
  filters: FinanceReportFilters,
  columns: string[],
  rows: string[][],
  summaryRows?: string[][],
): FinanceReportExportPayload {
  return {
    title: reportViewTitle(filters.reportView),
    reportView: filters.reportView,
    format: "csv",
    filters,
    columns,
    rows,
    summaryRows,
  };
}
