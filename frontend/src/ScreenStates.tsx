import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, spacing, radii } from "./theme";

type IconName = React.ComponentProps<typeof Feather>["name"];

export function getApiError(e: any, fallback = "Something went wrong. Please try again."): string {
  if (!e?.response) {
    if (e?.code === "ERR_NETWORK" || e?.message === "Network Error") {
      return "Unable to reach the server. Check your internet connection, or try again once the API is back online.";
    }
    if (e?.code === "ECONNABORTED") {
      return "The request timed out. Please try again.";
    }
  }
  if (e?.response?.status === 502 || e?.response?.status === 503) {
    return "The server is temporarily unavailable. Please try again in a few minutes.";
  }
  const data = e?.response?.data;
  const d = typeof data === "string" ? data : data?.detail ?? data?.message;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x: any) => x?.msg || String(x)).join(", ");
  return e?.message || fallback;
}

/** Parse FastAPI validation errors when axios used responseType blob/arraybuffer. */
export async function getApiErrorFromResponse(
  e: any,
  fallback = "Something went wrong. Please try again.",
): Promise<string> {
  const data = e?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      const d = parsed?.detail;
      if (typeof d === "string") return d;
      if (Array.isArray(d)) return d.map((x: any) => x?.msg || String(x)).join(", ");
    } catch {
      // not JSON — fall through
    }
  }
  return getApiError(e, fallback);
}

/** Cross-platform confirmation — keeps existing Alert pattern, clearer copy. */
export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  options?: { confirmLabel?: string; destructive?: boolean; cancelLabel?: string },
) {
  const confirmLabel = options?.confirmLabel || "Confirm";
  const cancelLabel = options?.cancelLabel || "Cancel";
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  const { Alert } = require("react-native");
  Alert.alert(title, message, [
    { text: cancelLabel, style: "cancel" },
    { text: confirmLabel, style: options?.destructive ? "destructive" : "default", onPress: onConfirm },
  ]);
}

export function LoadingState({ message = "Loading…", compact }: { message?: string; compact?: boolean }) {
  return (
    <View style={[st.center, compact && { paddingVertical: spacing.xl }]} testID="loading-state">
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={st.loadingMsg}>{message}</Text>
    </View>
  );
}

export function EmptyState({
  icon = "inbox",
  title = "Nothing here yet",
  message,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={st.center} testID="empty-state">
      <View style={st.emptyIcon}>
        <Feather name={icon} size={32} color={colors.hint} />
      </View>
      <Text style={st.emptyTitle}>{title}</Text>
      {message ? <Text style={st.emptyMsg}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={st.emptyBtn} onPress={onAction}>
          <Text style={st.emptyBtnTxt}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function ErrorState({
  message = "Could not load data.",
  onRetry,
  compact,
}: {
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <View style={[st.errorWrap, compact && { marginVertical: spacing.md }]} testID="error-state">
      <Feather name="alert-circle" size={20} color={colors.danger} />
      <View style={{ flex: 1 }}>
        <Text style={st.errorTitle}>Unable to load</Text>
        <Text style={st.errorMsg}>{message}</Text>
      </View>
      {onRetry ? (
        <TouchableOpacity style={st.retryBtn} onPress={onRetry} testID="retry-btn">
          <Feather name="refresh-cw" size={14} color="#fff" />
          <Text style={st.retryTxt}>Retry</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function InlineFieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <View style={st.fieldErr} testID="field-error">
      <Feather name="alert-circle" size={12} color={colors.danger} />
      <Text style={st.fieldErrTxt}>{message}</Text>
    </View>
  );
}

export function FormLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <Text style={st.formLabel}>
      {children}
      {required ? <Text style={st.required}> *</Text> : null}
    </Text>
  );
}

/** Readable horizontal table for reports and admin lists. */
export function DataTable({
  columns,
  rows,
  numericFromIndex = 1,
}: {
  columns: string[];
  rows: string[][];
  /** Right-align columns from this index (e.g. amount columns). */
  numericFromIndex?: number;
}) {
  if (!rows.length) {
    return <Text style={st.tableEmpty}>No rows to display.</Text>;
  }
  return (
    <View style={st.tableWrap}>
      <View style={st.tableHead}>
        {columns.map((c, i) => (
          <Text
            key={i}
            style={[st.th, i === 0 && st.thFirst, i >= numericFromIndex && st.thNum]}
            numberOfLines={1}
          >
            {c}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={[st.tr, ri % 2 === 1 && st.trAlt]}>
          {row.map((cell, ci) => (
            <Text
              key={ci}
              style={[st.td, ci === 0 && st.tdFirst, ci >= numericFromIndex && st.tdNum]}
              numberOfLines={2}
            >
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const COL_MIN = 100;
const COL_FIRST = 160;

const st = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: spacing.xl },
  loadingMsg: { marginTop: spacing.md, fontSize: 13, color: colors.muted2, fontWeight: "600" },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: colors.ink },
  emptyMsg: { fontSize: 13, color: colors.muted2, textAlign: "center", marginTop: spacing.xs, lineHeight: 20, maxWidth: 280 },
  emptyBtn: { marginTop: spacing.lg, backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.md },
  emptyBtnTxt: { color: "#fff", fontWeight: "700", fontSize: 13 },
  errorWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: radii.md,
    padding: spacing.md,
    marginVertical: spacing.sm,
  },
  errorTitle: { fontSize: 13, fontWeight: "800", color: "#B91C1C" },
  errorMsg: { fontSize: 12, color: "#B91C1C", marginTop: 2, lineHeight: 18 },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 8, borderRadius: radii.sm },
  retryTxt: { color: "#fff", fontWeight: "700", fontSize: 11 },
  fieldErr: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, marginBottom: spacing.xs },
  fieldErrTxt: { fontSize: 12, color: colors.danger, fontWeight: "600" },
  formLabel: { fontSize: 12, fontWeight: "700", color: colors.muted, marginBottom: 6, marginTop: spacing.md, textTransform: "uppercase", letterSpacing: 0.4 },
  required: { color: colors.danger },
  tableWrap: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, overflow: "hidden" },
  tableHead: { flexDirection: "row", backgroundColor: colors.primarySofter, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { flex: 1, minWidth: COL_MIN, fontSize: 11, fontWeight: "800", color: colors.muted, textTransform: "uppercase", paddingVertical: 10, paddingHorizontal: 8 },
  thFirst: { minWidth: COL_FIRST, flex: 1.4 },
  thNum: { textAlign: "right" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  trAlt: { backgroundColor: colors.surface2 },
  td: { flex: 1, minWidth: COL_MIN, fontSize: 13, color: colors.ink, paddingVertical: 10, paddingHorizontal: 8 },
  tdFirst: { minWidth: COL_FIRST, flex: 1.4, fontWeight: "600" },
  tdNum: { textAlign: "right", fontVariant: ["tabular-nums"] },
  tableEmpty: { fontSize: 13, color: colors.hint, fontStyle: "italic", padding: spacing.md },
});
