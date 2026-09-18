import { useCallback, useMemo, useState } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Platform, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useAuth } from "../auth";
import { canAccessGroundBooking, canManageGroundBooking } from "../rbac";
import { LoadingState, EmptyState, ErrorState, getApiError } from "../ScreenStates";
import { useBreakpoint } from "../useBreakpoint";
import { colors, radii, spacing } from "../theme";
import { formatDate, formatDateTime, toISODate } from "../dateFormat";
import { formatInr } from "../expenses/expenseFormat";
import { GroundBookingFormModal } from "./GroundBookingFormModal";
import { createGroundBooking, fetchGroundBookings, updateGroundBooking, updateGroundBookingStatus } from "./api";
import { bookingOverlapsDay, daysInMonthGrid, monthKey, shiftMonth } from "./pricing";
import { GROUND_SPORTS, SLOT_LABELS, type BookingPayload, type GroundBooking, type GroundSport } from "./types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toneColor(tone?: string) {
  if (tone === "confirmed") return { bg: "#DCFCE7", fg: "#15803D", bar: "#22C55E" };
  if (tone === "past") return { bg: "#F1F5F9", fg: "#64748B", bar: "#94A3B8" };
  return { bg: "#FFEDD5", fg: "#C2410C", bar: "#F97316" };
}

function personStamp(name?: string, role?: string, email?: string, at?: string) {
  const who = [name, role ? role.replace(/_/g, " ") : "", email].filter(Boolean).join(" · ");
  if (!who && !at) return "";
  return `${who || "Unknown"}${at ? ` · ${formatDateTime(at)}` : ""}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function GroundBookingScreen() {
  const { user } = useAuth();
  const { isDesktop, horizontalPadding } = useBreakpoint();
  const allowed = canAccessGroundBooking(user);
  const canWrite = canManageGroundBooking(user);
  const [sport, setSport] = useState<GroundSport | "">("");
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [month, setMonth] = useState(monthKey());
  const [rows, setRows] = useState<GroundBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(false);
  const [pickDate, setPickDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<GroundBooking | null>(null);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<GroundBooking | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(toISODate());

  const load = useCallback(async () => {
    setError("");
    try {
      setRows(await fetchGroundBookings({ sport, month }));
    } catch (e) {
      setError(getApiError(e, "Could not load ground bookings."));
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sport, month]);

  useFocusEffect(useCallback(() => {
    if (!allowed) return;
    setLoading(true);
    load();
  }, [allowed, load]));

  const cells = useMemo(() => daysInMonthGrid(month), [month]);
  const today = toISODate();
  const dayBookings = useMemo(
    () => selectedDay
      ? rows.filter((b) => b.status !== "Cancelled" && bookingOverlapsDay(b.dates.startDate, b.dates.endDate, selectedDay))
      : [],
    [rows, selectedDay],
  );
  const kpis = useMemo(() => {
    const live = rows.filter((r) => r.status !== "Cancelled");
    return {
      total: live.length,
      tentative: live.filter((r) => r.status === "Tentative").length,
      confirmed: live.filter((r) => r.status === "Confirmed").length,
      revenue: live.reduce((s, r) => s + (r.pricing?.totalRevenue || 0), 0),
    };
  }, [rows]);

  const openNew = (iso?: string) => {
    setEditing(null);
    setPickDate(iso || today);
    setModal(true);
  };

  const openBooking = (b: GroundBooking) => {
    setSelected(b);
    if (canWrite && b.status === "Tentative") {
      setEditing(b);
      setPickDate(b.dates.startDate);
      setModal(true);
    }
  };

  const submit = async (payload: BookingPayload) => {
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateGroundBooking(editing.id, payload);
        setModal(false);
        setEditing(null);
        setSelected(updated);
        await load();
        const extra = updated.discount_submitted
          ? " Discount sent to Super Admin for approval."
          : "";
        Alert.alert("Booking updated", `Changes saved.${extra}`);
        return;
      }
      const created = await createGroundBooking(payload);
      setModal(false);
      await load();
      const extra = created.discount_submitted
        ? " Discount sent to Super Admin for approval."
        : "";
      Alert.alert("Booking saved", `Marked Tentative on the calendar.${extra}`);
    } catch (e) {
      Alert.alert("Could not save", getApiError(e, "Failed to save booking."));
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (booking: GroundBooking, status: "Confirmed" | "Cancelled") => {
    try {
      await updateGroundBookingStatus(booking.id, status);
      setSelected(null);
      await load();
    } catch (e) {
      Alert.alert("Update failed", getApiError(e));
    }
  };

  if (!allowed) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.denied}>
          <Feather name="lock" size={28} color={colors.muted2} />
          <Text style={s.deniedTitle}>Ground Booking access is not granted</Text>
          <Text style={s.deniedTxt}>Ask Super Admin to enable Ground Booking in Individual permission overrides, or sign in as ALPHA Admin or ALPHA Accounts.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        <View style={s.header}>
          <View>
            <Text style={s.kicker}>OPERATIONS · ALPHA</Text>
            <Text style={s.h1}>Ground Booking</Text>
            <Text style={s.sub}>Half day ₹6,000 · Full day ₹10,000 · Cricket and football grounds.</Text>
          </View>
          {canWrite ? (
            <TouchableOpacity testID="new-booking" style={s.primaryBtn} onPress={() => openNew()}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={s.primaryTxt}>New Booking</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={s.kpiRow}>
          {[
            { label: "This month", value: String(kpis.total), color: colors.accent },
            { label: "Tentative", value: String(kpis.tentative), color: "#F97316" },
            { label: "Confirmed", value: String(kpis.confirmed), color: "#16A34A" },
            { label: "Quoted revenue", value: formatInr(kpis.revenue, 0), color: colors.primary },
          ].map((k) => (
            <View key={k.label} style={[s.kpi, { borderLeftColor: k.color }]}>
              <Text style={s.kpiLabel}>{k.label}</Text>
              <Text style={[s.kpiValue, { color: k.color }]}>{k.value}</Text>
            </View>
          ))}
        </View>

        <View style={s.toolbar}>
          <View style={s.filters}>
            <Text style={s.filterLbl}>Sport</Text>
            {(["", ...GROUND_SPORTS] as const).map((opt) => (
              <TouchableOpacity
                key={opt || "all"}
                testID={`filter-sport-${opt || "all"}`}
                onPress={() => setSport(opt)}
                style={[s.chip, sport === opt && s.chipOn]}
              >
                <Text style={[s.chipTxt, sport === opt && s.chipTxtOn]}>{opt || "All"}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.filters}>
            <Text style={s.filterLbl}>View</Text>
            {(["calendar", "list"] as const).map((opt) => (
              <TouchableOpacity
                key={opt}
                testID={`view-${opt}`}
                onPress={() => setView(opt)}
                style={[s.chip, view === opt && s.chipOn]}
              >
                <Text style={[s.chipTxt, view === opt && s.chipTxtOn]}>{opt === "calendar" ? "Calendar" : "List"}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {loading ? <LoadingState message="Loading bookings…" /> : null}
        {error ? <ErrorState message={error} onRetry={load} /> : null}

        {!loading && !error && view === "calendar" ? (
          <View style={s.calSplit}>
            <View style={s.calCard}>
              <View style={s.calNav}>
                <TouchableOpacity onPress={() => setMonth((m) => shiftMonth(m, -1))} testID="month-prev" style={s.iconBtn}>
                  <Feather name="chevron-left" size={18} color={colors.ink} />
                </TouchableOpacity>
                <Text style={s.calTitle}>{monthLabel(month)}</Text>
                <TouchableOpacity onPress={() => setMonth((m) => shiftMonth(m, 1))} testID="month-next" style={s.iconBtn}>
                  <Feather name="chevron-right" size={18} color={colors.ink} />
                </TouchableOpacity>
              </View>
              <View style={s.weekRow}>
                {WEEKDAYS.map((d) => <Text key={d} style={s.weekLbl}>{d}</Text>)}
              </View>
              <View style={s.grid}>
                {cells.map((cell) => {
                  const onDay = rows.filter((b) =>
                    b.status !== "Cancelled" && bookingOverlapsDay(b.dates.startDate, b.dates.endDate, cell.iso),
                  );
                  const isToday = cell.iso === today;
                  const isSel = cell.iso === selectedDay;
                  return (
                    <TouchableOpacity
                      key={cell.iso}
                      testID={`cal-day-${cell.iso}`}
                      onPress={() => setSelectedDay(cell.iso)}
                      style={[s.dayCell, !cell.inMonth && s.dayMuted, isToday && s.dayToday, isSel && s.daySelected]}
                    >
                      <Text style={[s.dayNum, !cell.inMonth && { color: colors.hint }]}>{Number(cell.iso.slice(8))}</Text>
                      {onDay.slice(0, isDesktop ? 3 : 2).map((b) => {
                        const t = toneColor(b.calendarTone);
                        return (
                          <TouchableOpacity
                            key={b.id}
                            testID={`cal-booking-${b.id}`}
                            onPress={() => openBooking(b)}
                            style={[s.pill, { backgroundColor: t.bg }]}
                          >
                            <Text style={[s.pillTxt, { color: t.fg }]} numberOfLines={1}>
                              {b.sport === "Cricket" ? "🏏" : "⚽"} {b.customer.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                      {onDay.length > (isDesktop ? 3 : 2) ? (
                        <Text style={s.more}>+{onDay.length - (isDesktop ? 3 : 2)}</Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={s.legend}>
                <View style={s.legItem}><View style={[s.dot, { backgroundColor: "#F97316" }]} /><Text style={s.legTxt}>Tentative</Text></View>
                <View style={s.legItem}><View style={[s.dot, { backgroundColor: "#22C55E" }]} /><Text style={s.legTxt}>Confirmed</Text></View>
                <View style={s.legItem}><View style={[s.dot, { backgroundColor: "#94A3B8" }]} /><Text style={s.legTxt}>Past / cancelled</Text></View>
              </View>
            </View>
            <View style={s.dayPanel}>
              <Text style={s.dayPanelKicker}>SELECTED DAY</Text>
              <Text style={s.dayPanelTitle}>{selectedDay ? formatDate(selectedDay) : "Pick a date"}</Text>
              {canWrite ? (
                <TouchableOpacity style={s.dayBookBtn} onPress={() => openNew(selectedDay || today)} testID="book-selected-day">
                  <Feather name="plus" size={14} color="#fff" />
                  <Text style={s.dayBookTxt}>Book this day</Text>
                </TouchableOpacity>
              ) : null}
              {dayBookings.length === 0 ? (
                <Text style={s.dayEmpty}>No bookings yet. Create one with the default half-day or full-day rate.</Text>
              ) : dayBookings.map((b) => {
                const t = toneColor(b.calendarTone);
                return (
                  <TouchableOpacity key={b.id} style={s.dayItem} onPress={() => openBooking(b)}>
                    <View style={[s.statusBadge, { backgroundColor: t.bg }]}>
                      <Text style={[s.statusTxt, { color: t.fg }]}>{b.status}</Text>
                    </View>
                    <Text style={s.listName}>{b.customer.name}</Text>
                    <Text style={s.listMeta}>
                      {b.sport} · {SLOT_LABELS[b.dates.timeSlot]} · {formatInr(b.pricing.totalRevenue)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {!loading && !error && view === "list" ? (
          rows.length === 0 ? (
            <EmptyState title="No bookings this month" subtitle="Create a booking to see it here." />
          ) : (
            <View style={{ gap: spacing.md }}>
              {rows.map((b) => {
                const t = toneColor(b.calendarTone);
                return (
                  <TouchableOpacity key={b.id} style={s.listCard} onPress={() => openBooking(b)}>
                    <View style={[s.statusBadge, { backgroundColor: t.bg }]}>
                      <Text style={[s.statusTxt, { color: t.fg }]}>{b.status}</Text>
                    </View>
                    <Text style={s.listName}>{b.customer.name}</Text>
                    <Text style={s.listMeta}>
                      {b.sport} · {formatDate(b.dates.startDate)}
                      {b.dates.endDate !== b.dates.startDate ? ` – ${formatDate(b.dates.endDate)}` : ""}
                      {" · "}{SLOT_LABELS[b.dates.timeSlot]}
                    </Text>
                    <Text style={s.listRev}>{formatInr(b.pricing.totalRevenue)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        ) : null}

        {selected ? (
          <View style={s.detail}>
            <View style={s.detailHead}>
              <Text style={s.detailTitle}>{selected.customer.name}</Text>
              <TouchableOpacity onPress={() => setSelected(null)}><Feather name="x" size={16} color={colors.muted} /></TouchableOpacity>
            </View>
            <Text style={s.detailMeta}>
              {selected.sport} · {selected.eventDetails.type} · {selected.eventDetails.numberOfPeople} people
            </Text>
            <Text style={s.detailMeta}>
              {formatDate(selected.dates.startDate)} – {formatDate(selected.dates.endDate)} · {SLOT_LABELS[selected.dates.timeSlot]}
            </Text>
            <Text style={s.detailMeta}>{selected.customer.phone}{selected.customer.organization ? ` · ${selected.customer.organization}` : ""}</Text>
            <Text style={s.detailRev}>{formatInr(selected.pricing.totalRevenue)}</Text>
            {selected.created_at ? (
              <Text style={s.audit}>Created by {personStamp(selected.created_by_name, selected.created_by_role, selected.created_by_email, selected.created_at)}</Text>
            ) : null}
            {selected.updated_at && selected.updated_by_name ? (
              <Text style={s.audit}>Last edited by {personStamp(selected.updated_by_name, selected.updated_by_role, selected.updated_by_email, selected.updated_at)}</Text>
            ) : null}
            {(selected.edit_history || []).slice().reverse().slice(0, 5).map((h, i) => (
              <Text key={`${h.at}-${i}`} style={s.historyLine}>
                {(h.action || "edited")} · {personStamp(h.name, h.role, h.email, h.at)}
              </Text>
            ))}
            {selected.pricing.discountPending ? (
              <Text style={s.pending}>Discount pending Super Admin approval</Text>
            ) : null}
            <View style={s.detailActions}>
              {canWrite && selected.status === "Tentative" ? (
                <TouchableOpacity style={s.editBtn} onPress={() => openBooking(selected)} testID="edit-booking">
                  <Text style={s.editTxt}>Edit</Text>
                </TouchableOpacity>
              ) : null}
              {canWrite && selected.status === "Tentative" && !selected.pricing.discountPending ? (
                <TouchableOpacity style={s.confirmBtn} onPress={() => setStatus(selected, "Confirmed")}>
                  <Text style={s.confirmTxt}>Confirm</Text>
                </TouchableOpacity>
              ) : null}
              {canWrite && selected.status !== "Cancelled" ? (
                <TouchableOpacity style={s.cancelBtn} onPress={() => setStatus(selected, "Cancelled")}>
                  <Text style={s.cancelTxt}>Cancel booking</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <GroundBookingFormModal
        visible={modal}
        saving={saving}
        defaultDate={pickDate}
        booking={editing}
        onClose={() => { setModal(false); setEditing(null); }}
        onSubmit={submit}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md, paddingTop: spacing.lg, marginBottom: spacing.lg },
  kicker: { fontSize: 10, fontWeight: "800", color: colors.accent, letterSpacing: 1.2 },
  h1: { fontSize: 28, fontWeight: "800", color: colors.ink, marginTop: 4 },
  sub: { fontSize: 13, color: colors.muted2, marginTop: 4 },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.accent, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radii.lg },
  primaryTxt: { color: "#fff", fontWeight: "800" },
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  kpi: { flexGrow: 1, minWidth: 140, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, borderLeftWidth: 4, borderWidth: 1, borderColor: colors.borderSoft },
  kpiLabel: { fontSize: 11, fontWeight: "700", color: colors.muted2, textTransform: "uppercase" },
  kpiValue: { fontSize: 20, fontWeight: "800", marginTop: 4 },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginBottom: spacing.md },
  filters: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  filterLbl: { fontSize: 11, fontWeight: "800", color: colors.muted2, textTransform: "uppercase" },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipTxt: { fontSize: 12, fontWeight: "700", color: colors.muted },
  chipTxtOn: { color: "#fff" },
  calSplit: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, alignItems: "flex-start" },
  calCard: { flexGrow: 1, flexBasis: 640, backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md, ...Platform.select({ web: { boxShadow: "0 8px 24px rgba(15,23,42,0.06)" } as object, default: {} }) },
  dayPanel: { flexGrow: 1, flexBasis: 280, maxWidth: 380, backgroundColor: colors.surface, borderRadius: radii.xl, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.lg, gap: spacing.sm },
  dayPanelKicker: { fontSize: 10, fontWeight: "800", color: colors.accent, letterSpacing: 1 },
  dayPanelTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  dayBookBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.accent, alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.md },
  dayBookTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
  dayEmpty: { fontSize: 13, color: colors.muted2, lineHeight: 18 },
  dayItem: { borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radii.md, padding: spacing.sm },
  daySelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  calNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  calTitle: { fontSize: 16, fontWeight: "800", color: colors.ink },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2 },
  weekRow: { flexDirection: "row" },
  weekLbl: { flex: 1, textAlign: "center", fontSize: 10, fontWeight: "800", color: colors.muted2, paddingBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: "14.28%", minHeight: 88, borderWidth: 1, borderColor: colors.borderSoft, padding: 4, backgroundColor: colors.surface },
  dayMuted: { backgroundColor: "#F8FAFC" },
  dayToday: { borderColor: colors.accent },
  dayNum: { fontSize: 11, fontWeight: "800", color: colors.ink, marginBottom: 2 },
  pill: { borderRadius: 6, paddingHorizontal: 4, paddingVertical: 2, marginBottom: 2 },
  pillTxt: { fontSize: 9, fontWeight: "700" },
  more: { fontSize: 9, color: colors.muted2, fontWeight: "700" },
  legend: { flexDirection: "row", gap: spacing.lg, paddingTop: spacing.md },
  legItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legTxt: { fontSize: 11, color: colors.muted, fontWeight: "600" },
  listCard: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderSoft, padding: spacing.md },
  statusBadge: { alignSelf: "flex-start", borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 8 },
  statusTxt: { fontSize: 11, fontWeight: "800" },
  listName: { fontSize: 16, fontWeight: "800", color: colors.ink },
  listMeta: { fontSize: 12, color: colors.muted2, marginTop: 4 },
  listRev: { fontSize: 15, fontWeight: "800", color: colors.primary, marginTop: 8 },
  detail: { marginTop: spacing.lg, backgroundColor: colors.surface, borderRadius: radii.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  detailHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  detailTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  detailMeta: { fontSize: 13, color: colors.muted, marginTop: 4 },
  detailRev: { fontSize: 22, fontWeight: "800", color: colors.primary, marginTop: 12 },
  audit: { fontSize: 12, color: colors.muted, marginTop: 8, fontWeight: "600" },
  historyLine: { fontSize: 11, color: colors.muted2, marginTop: 3 },
  pending: { marginTop: 8, color: "#B45309", fontWeight: "700", fontSize: 12 },
  detailActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  editBtn: { backgroundColor: colors.accent, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 10 },
  editTxt: { color: "#fff", fontWeight: "800" },
  confirmBtn: { backgroundColor: "#16A34A", borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 10 },
  confirmTxt: { color: "#fff", fontWeight: "800" },
  cancelBtn: { borderWidth: 1, borderColor: colors.danger, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 10 },
  cancelTxt: { color: colors.danger, fontWeight: "800" },
  denied: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  deniedTitle: { fontSize: 18, fontWeight: "800", color: colors.ink },
  deniedTxt: { fontSize: 13, color: colors.muted2, textAlign: "center" },
});
