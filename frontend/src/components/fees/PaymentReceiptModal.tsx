import {
  View, Text, Modal, Pressable, ScrollView, TouchableOpacity,
  StyleSheet, Platform, Linking, Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { roleLabel } from "../../auth";
import { colors, radii, shadow } from "../../theme";
import { useBreakpoint } from "../../useBreakpoint";
import { formatDate, formatDateTime, formatMonthLong } from "../../dateFormat";
import {
  institutionFromBranding,
  resolveReceiptBranding,
} from "../../entityReceiptBranding";
import type { PaymentReceipt } from "../../feesCollectionTypes";
import {
  amountInWords, feeHeadLabel, inr, inrSigned, learnerContextLine,
} from "./feesUi";

type Props = {
  receipt: PaymentReceipt | null;
  onClose: () => void;
};

type TableRow = {
  key: string;
  head: string;
  period: string;
  amount: number;
  isDiscount?: boolean;
};

function buildTableRows(receipt: PaymentReceipt, institution: "PWS" | "ALPHA"): TableRow[] {
  const rows: TableRow[] = [];
  for (const fee of receipt.fees || []) {
    rows.push({
      key: fee.id,
      head: feeHeadLabel(fee.fee_type, institution),
      period: formatMonthLong(fee.period_month),
      amount: fee.amount ?? fee.amount_due ?? 0,
    });
    const discount = fee.discount_applied || 0;
    if (discount > 0) {
      const reason = (fee.discount_reason || "Concession").trim();
      rows.push({
        key: `${fee.id}-discount`,
        head: `Discount — ${reason}`,
        period: "—",
        amount: -discount,
        isDiscount: true,
      });
    }
  }
  return rows;
}

export function PaymentReceiptModal({ receipt, onClose }: Props) {
  const { isMobile } = useBreakpoint();
  if (!receipt) return null;

  const branding = resolveReceiptBranding(receipt);
  const institution = institutionFromBranding(branding);
  const player = receipt.player || {};
  const personLabel = institution === "PWS" ? "Student" : "Player";
  const tableRows = buildTableRows(receipt, institution);
  const words = amountInWords(receipt.total_amount || 0);
  const receiptNo = branding.receiptNumber;
  const contextLine = learnerContextLine(player, institution);
  const collectedBy = receipt.collected_by?.name
    ? `${receipt.collected_by.name}${receipt.collected_by.role ? ` (${roleLabel(receipt.collected_by.role)})` : ""}`
    : "—";
  const showReference = receipt.payment_mode === "UPI" || receipt.payment_mode === "Online";
  const grade = player.grade || player.pws_class;
  const section = player.section;
  const idLabel = institution === "PWS" ? "Admission No." : "Player ID";
  const idValue = player.admission_number || player.id?.slice(0, 8).toUpperCase() || "—";
  const balance = receipt.balance_after_payment;

  const download = () => {
    const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/fees/receipt/${receipt.batch_id}/pdf`;
    if (Platform.OS === "web") window.open(url, "_blank");
    else Linking.openURL(url);
  };

  return (
    <Modal visible animationType={isMobile ? "slide" : "fade"} transparent onRequestClose={onClose}>
      <View style={[s.overlay, isMobile && s.overlayMobile]}>
        <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close receipt" />
        <View style={[s.card, isMobile && s.cardMobile, !isMobile && s.cardDesktop]}>
          <ScrollView
            style={s.scroll}
            contentContainerStyle={s.scrollContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.header}>
              <View style={s.headerLeft}>
                <Image
                  source={branding.logoSource}
                  style={s.logo}
                  resizeMode="contain"
                  accessibilityLabel={branding.logoAlt}
                />
                <View style={s.headerText}>
                  <Text style={s.orgName} numberOfLines={2}>{branding.displayName}</Text>
                  {!!branding.addressLine && (
                    <Text style={s.orgAddress} numberOfLines={2}>{branding.addressLine}</Text>
                  )}
                  <Text style={s.receiptLabel}>{branding.receiptTitle}</Text>
                </View>
              </View>
              <View style={s.paidPill}>
                <Feather name="check-circle" size={13} color={colors.success} />
                <Text style={s.paidPillTxt}>Paid</Text>
              </View>
            </View>

            <Text style={s.receiptNo}>Receipt No. {receiptNo}</Text>

            <View style={s.section}>
              <Text style={s.sectionOverline}>{personLabel}</Text>
              <Text style={s.learnerName}>{player.name || "—"}</Text>
              <View style={s.metaGrid}>
                <MetaField label="Grade" value={grade || "—"} />
                <MetaField label="Section" value={section || "—"} />
                <MetaField label={idLabel} value={idValue} />
                <MetaField label="Mobile" value={player.mobile || "—"} />
              </View>
              {!!contextLine && <Text style={s.contextLine}>{contextLine}</Text>}
            </View>

            <View style={s.strip}>
              <StripItem label="Payment date" value={formatDate(receipt.transaction_date || receipt.paid_at)} />
              <StripItem label="Time" value={formatDateTime(receipt.paid_at)} />
              <StripItem label="Mode" value={receipt.payment_mode || "—"} />
              {showReference && (
                <StripItem label="Reference" value={receipt.reference_id || "—"} />
              )}
              <StripItem label="Collected by" value={collectedBy} />
            </View>

            <View style={s.table}>
              <View style={s.tableHead}>
                <Text style={[s.th, s.thHead]}>Fee Head</Text>
                <Text style={[s.th, s.thPeriod]}>Period</Text>
                <Text style={[s.th, s.thAmt]}>Amount</Text>
              </View>
              {tableRows.map((row) => (
                <View key={row.key} style={s.tableRow}>
                  <Text style={[s.td, s.tdHead, row.isDiscount && s.discountHead]} numberOfLines={2}>
                    {row.head}
                  </Text>
                  <Text style={[s.td, s.tdPeriod]}>{row.period}</Text>
                  <Text style={[s.td, s.tdAmt, row.isDiscount && s.discountAmt]}>
                    {inrSigned(row.amount)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={s.totalBox}>
              <View style={s.totalRow}>
                <Text style={s.totalLabel}>Total collected</Text>
                <Text style={s.totalValue}>{inr(receipt.total_amount || 0)}</Text>
              </View>
              {balance != null && balance >= 0 && (
                <Text style={s.balanceTxt}>Balance after payment: {inr(balance)}</Text>
              )}
              {!!words && (
                <Text style={s.wordsTxt} numberOfLines={3}>Amount in words: {words}</Text>
              )}
            </View>
          </ScrollView>

          <View style={[s.footer, isMobile && s.footerMobile]}>
            <TouchableOpacity onPress={download} style={s.downloadBtn} testID="receipt-download-pdf">
              <Feather name="download" size={16} color={colors.primary} />
              <Text style={s.downloadTxt}>Download PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={s.doneBtn} testID="receipt-done">
              <Text style={s.doneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metaCell}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function StripItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.stripItem}>
      <Text style={s.stripLabel}>{label}</Text>
      <Text style={s.stripValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  overlayMobile: {
    justifyContent: "flex-end",
    alignItems: "stretch",
    padding: 0,
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    maxHeight: "90%",
    ...shadow.md,
  },
  cardDesktop: {
    width: "100%",
    maxWidth: 640,
  },
  cardMobile: {
    width: "100%",
    maxHeight: "92%",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  scroll: { flexGrow: 0 },
  scrollContent: { padding: 18, paddingBottom: 8 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 6,
  },
  headerLeft: { flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1, minWidth: 0 },
  logo: { width: 52, height: 52 },
  headerText: { flex: 1, minWidth: 0, paddingTop: 2 },
  orgName: { fontSize: 14, fontWeight: "800", color: colors.ink, lineHeight: 18 },
  orgAddress: { fontSize: 10, color: colors.muted, marginTop: 2, lineHeight: 14, fontWeight: "500" },
  receiptLabel: { fontSize: 11, color: colors.hint, marginTop: 3, fontWeight: "600" },
  paidPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.pill,
    backgroundColor: colors.successSoft,
  },
  paidPillTxt: { fontSize: 11, fontWeight: "800", color: colors.success },
  receiptNo: { fontSize: 11, color: colors.hint, marginBottom: 14, fontWeight: "600" },
  section: { marginBottom: 14 },
  sectionOverline: {
    fontSize: 10, fontWeight: "800", letterSpacing: 0.8, color: colors.hint,
    textTransform: "uppercase", marginBottom: 4,
  },
  learnerName: { fontSize: 18, fontWeight: "800", color: colors.ink, marginBottom: 8 },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaCell: { width: "47%", minWidth: 120 },
  metaLabel: { fontSize: 10, color: colors.hint, fontWeight: "600" },
  metaValue: { fontSize: 12, color: colors.ink, fontWeight: "700", marginTop: 2 },
  contextLine: { fontSize: 11, color: colors.muted, marginTop: 8, fontWeight: "600" },
  strip: {
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.borderSoft,
    paddingVertical: 10, marginBottom: 12, gap: 6,
  },
  stripItem: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  stripLabel: { fontSize: 11, color: colors.hint, fontWeight: "600", flexShrink: 0 },
  stripValue: { fontSize: 11, color: colors.ink, fontWeight: "700", flex: 1, textAlign: "right" },
  table: { borderRadius: radii.sm, overflow: "hidden", borderWidth: 1, borderColor: colors.borderSoft },
  tableHead: {
    flexDirection: "row", backgroundColor: colors.surface2,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  th: { fontSize: 10, fontWeight: "800", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.4 },
  thHead: { flex: 1.4 },
  thPeriod: { width: 72, textAlign: "center" },
  thAmt: { width: 84, textAlign: "right" },
  tableRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: colors.borderSoft,
  },
  td: { fontSize: 12, color: colors.ink },
  tdHead: { flex: 1.4, fontWeight: "600", paddingRight: 6 },
  tdPeriod: { width: 72, textAlign: "center", color: colors.muted, fontSize: 11 },
  tdAmt: { width: 84, textAlign: "right", fontWeight: "800" },
  discountHead: { color: "#0F766E" },
  discountAmt: { color: "#0F766E" },
  totalBox: {
    marginTop: 12, padding: 12, borderRadius: radii.md,
    backgroundColor: colors.primarySofter,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 13, fontWeight: "700", color: colors.ink },
  totalValue: { fontSize: 20, fontWeight: "800", color: colors.primaryDeeper },
  balanceTxt: { fontSize: 11, color: colors.muted, marginTop: 6, fontWeight: "600" },
  wordsTxt: { fontSize: 10, color: colors.muted, marginTop: 6, lineHeight: 14, fontStyle: "italic" },
  footer: {
    flexDirection: "row", gap: 10, padding: 14,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  footerMobile: {
    paddingBottom: Platform.OS === "ios" ? 24 : 14,
  },
  downloadBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  downloadTxt: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  doneBtn: {
    flex: 1, paddingVertical: 12, borderRadius: radii.sm,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
  },
  doneTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
