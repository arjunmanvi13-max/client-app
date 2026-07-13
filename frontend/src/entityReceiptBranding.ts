/**
 * Central entity branding for fee payment receipts.
 * Text/labels prefer the server `branding` payload on PaymentReceipt; local assets
 * are keyed by trusted entityCode/entityId from the server — never from UI tabs.
 */
import type { ImageSourcePropType } from "react-native";
import type { PaymentReceipt, PaymentReceiptBranding } from "./feesCollectionTypes";

export type EntityCode = "PWS" | "ALPHA";

export type EntityReceiptBrandingConfig = {
  entityCode: EntityCode;
  entityId: "pws" | "alpha";
  displayName: string;
  shortName: string;
  addressLines: string[];
  logoSource: ImageSourcePropType;
  logoAlt: string;
  receiptPrefix: string;
  receiptTitle: string;
};

export const ENTITY_RECEIPT_BRANDING: Record<EntityCode, EntityReceiptBrandingConfig> = {
  PWS: {
    entityCode: "PWS",
    entityId: "pws",
    displayName: "Prarambhika World School",
    shortName: "PWS",
    addressLines: ["Balua Ahmedpur", "Patna 801113"],
    logoSource: require("../assets/brand/prarambhika-world-school-logo.png"),
    logoAlt: "Prarambhika World School logo",
    receiptPrefix: "PWS",
    receiptTitle: "Fee Payment Receipt",
  },
  ALPHA: {
    entityCode: "ALPHA",
    entityId: "alpha",
    displayName: "ALPHA Sports Academy",
    shortName: "ALPHA",
    addressLines: [],
    logoSource: require("../assets/brand/alpha-sports-logo.png"),
    logoAlt: "ALPHA Sports Academy logo",
    receiptPrefix: "ALPHA",
    receiptTitle: "Fee Payment Receipt",
  },
};

const DEFAULT_ENTITY: EntityCode = "ALPHA";

function entityCodeFromReceipt(receipt: Pick<PaymentReceipt, "entity_id" | "entity_code" | "branding">): EntityCode | null {
  const code = receipt.branding?.entityCode ?? receipt.entity_code;
  if (code === "PWS" || code === "ALPHA") return code;
  if (receipt.entity_id === "pws") return "PWS";
  if (receipt.entity_id === "alpha") return "ALPHA";
  return null;
}

function entityCodeFromServer(server?: PaymentReceiptBranding, fallback: EntityCode = DEFAULT_ENTITY): EntityCode {
  if (server?.entityCode === "PWS" || server?.entityCode === "ALPHA") return server.entityCode;
  if (server?.entityId === "pws") return "PWS";
  if (server?.entityId === "alpha") return "ALPHA";
  return fallback;
}

/** Resolve branding for modal display — server payload overrides text fields. */
export function resolveReceiptBranding(
  receipt: Pick<PaymentReceipt, "entity_id" | "entity_code" | "branding" | "receipt_number" | "batch_id">,
): EntityReceiptBrandingConfig & { addressLine: string; receiptNumber: string } {
  const detected = entityCodeFromReceipt(receipt);
  if (!detected) {
    console.warn("[receipt] Unknown entity on payment receipt — using ALPHA branding fallback");
  }
  const code = detected ?? DEFAULT_ENTITY;
  const base = ENTITY_RECEIPT_BRANDING[code];
  const server = receipt.branding;
  const entityKey = entityCodeFromServer(server, code);
  const assetBase = ENTITY_RECEIPT_BRANDING[entityKey];

  const merged: EntityReceiptBrandingConfig = {
    entityCode: entityKey,
    entityId: assetBase.entityId,
    displayName: server?.displayName ?? base.displayName,
    shortName: server?.shortName ?? base.shortName,
    addressLines: server?.addressLines ?? base.addressLines,
    receiptTitle: server?.receiptTitle ?? base.receiptTitle,
    receiptPrefix: server?.receiptPrefix ?? base.receiptPrefix,
    logoAlt: server?.logoAlt ?? assetBase.logoAlt,
    logoSource: assetBase.logoSource,
  };

  return {
    ...merged,
    addressLine: merged.addressLines.filter(Boolean).join(", "),
    receiptNumber: formatReceiptNumberDisplay(
      receipt.receipt_number,
      merged.entityId,
      merged.receiptPrefix,
      receipt.batch_id,
    ),
  };
}

export function institutionFromBranding(branding: EntityReceiptBrandingConfig): "PWS" | "ALPHA" {
  return branding.entityCode;
}

export function formatReceiptNumberDisplay(
  receiptNumber: string | undefined,
  entityId: "pws" | "alpha",
  prefix: string,
  batchId?: string,
): string {
  if (receiptNumber) {
    let num = receiptNumber.trim();
    if (num.startsWith("RCP-")) num = num.slice(4);
    return num;
  }
  if (batchId) {
    return `${prefix}-${batchId.slice(0, 8).toUpperCase()}`;
  }
  return "—";
}
