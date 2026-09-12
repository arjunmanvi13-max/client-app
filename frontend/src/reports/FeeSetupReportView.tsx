import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { DataTable, EmptyState } from "../ScreenStates";
import { colors, radii, spacing } from "../theme";

const PAGE_SIZE = 25;
const MONEY_KEYS = new Set(["base_fee", "registration_fee", "discounts", "net_payable"]);

function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function cell(key: string, value: any) {
  if (MONEY_KEYS.has(key)) return inr(Number(value) || 0);
  return value != null && value !== "" ? String(value) : "—";
}

type Props = { data: any };

export function FeeSetupReportView({ data }: Props) {
  const cols: string[] = data?.columns || [];
  const keys: string[] = data?.row_keys || [];
  const rows: any[] = data?.rows || [];
  const summary = data?.summary || {};
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = typeof av === "number" ? av : String(av || "").toLowerCase();
      const bn = typeof bv === "number" ? bv : String(bv || "").toLowerCase();
      if (an < bn) return sortDir === "asc" ? -1 : 1;
      if (an > bn) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const tableRows = pageRows.map((r) => keys.map((k) => cell(k, r[k])));
  const footer = keys.map((k) => {
    if (k === "name") return "TOTAL";
    if (k === "base_fee") return inr(summary.total_base_fee || 0);
    if (k === "registration_fee") return inr(summary.total_registration || 0);
    if (k === "discounts") return inr(summary.total_discounts || 0);
    if (k === "net_payable") return inr(summary.total_net_payable || 0);
    return "";
  });

  const onSort = (colIndex: number) => {
    const key = keys[colIndex];
    if (!key) return;
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  };

  if (!rows.length) {
    return <EmptyState icon="filter" title="No matching rows" message="Try another entity, campus, or status." />;
  }

  return (
    <View style={{ gap: spacing.md }} testID="fee-setup-report">
      <View style={s.kpiRow}>
        <Kpi label="People" value={String(summary.total_rows || rows.length)} />
        <Kpi label="Base fees" value={inr(summary.total_base_fee || 0)} />
        <Kpi label="Registration" value={inr(summary.total_registration || 0)} />
        <Kpi label="Discounts" value={inr(summary.total_discounts || 0)} />
        <Kpi label="Net payable" value={inr(summary.total_net_payable || 0)} />
      </View>
      <View style={s.sortBar}>
        {cols.map((c, i) => (
          <TouchableOpacity key={c} onPress={() => onSort(i)} style={s.sortChip}>
            <Text style={s.sortChipTxt}>{c}</Text>
            {keys[i] === sortKey && <Feather name={sortDir === "asc" ? "arrow-up" : "arrow-down"} size={11} color={colors.primary} />}
          </TouchableOpacity>
        ))}
      </View>
      <DataTable columns={cols} rows={[...tableRows, footer]} />
      <View style={s.pager}>
        <Text style={s.pagerTxt}>
          {safePage * PAGE_SIZE + 1}–{Math.min(sorted.length, (safePage + 1) * PAGE_SIZE)} of {sorted.length}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity disabled={safePage === 0} onPress={() => setPage((p) => Math.max(0, p - 1))} style={[s.pageBtn, safePage === 0 && s.pageBtnOff]}>
            <Text style={s.pageBtnTxt}>Previous</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={safePage >= pageCount - 1} onPress={() => setPage((p) => Math.min(pageCount - 1, p + 1))} style={[s.pageBtn, safePage >= pageCount - 1 && s.pageBtnOff]}>
            <Text style={s.pageBtnTxt}>Next</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.kpi}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: { flex: 1, minWidth: 120, backgroundColor: colors.surface2, padding: 12, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  kpiLabel: { fontSize: 10, color: colors.muted2, fontWeight: "700", textTransform: "uppercase" },
  kpiValue: { fontSize: 16, color: colors.ink, fontWeight: "800", marginTop: 2 },
  sortBar: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  sortChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: colors.primarySofter, borderWidth: 1, borderColor: colors.primarySoft },
  sortChipTxt: { fontSize: 10, fontWeight: "700", color: colors.primary },
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  pagerTxt: { fontSize: 12, color: colors.muted2, fontWeight: "600" },
  pageBtn: { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.sm },
  pageBtnOff: { opacity: 0.4 },
  pageBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
