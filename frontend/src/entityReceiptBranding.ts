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

function entityCodeFromReceipt(
  receipt: Pick<PaymentReceipt, "entity_id" | "entity_code" | "branding" | "player">,
): EntityCode | null {
  if (receipt.entity_id === "pws") return "PWS";
  if (receipt.entity_id === "alpha") return "ALPHA";
  if (receipt.entity_code === "PWS" || receipt.entity_code === "ALPHA") return receipt.entity_code;
  const brandingCode = receipt.branding?.entityCode;
  if (brandingCode === "PWS" || brandingCode === "ALPHA") return brandingCode;
  // Trusted person fields from server payment DTO (not UI tab state)
  const person = receipt.player;
  if (person?.kind === "student") return "PWS";
  if ((person?.organization || "").toUpperCase() === "PWS") return "PWS";
  if (person?.kind === "player") return "ALPHA";
  if ((person?.organization || "").toUpperCase() === "ALPHA") return "ALPHA";
  return null;
}

/** Resolve branding for modal display — server payload overrides text fields. */
export function resolveReceiptBranding(
  receipt: Pick<PaymentReceipt, "entity_id" | "entity_code" | "branding" | "receipt_number" | "batch_id" | "player">,
): EntityReceiptBrandingConfig & { addressLine: string; receiptNumber: string } {
  const detected = entityCodeFromReceipt(receipt);
  if (!detected) {
    console.warn("[receipt] Unknown entity on payment receipt — cannot determine branding safely");
  }
  const code = detected ?? DEFAULT_ENTITY;
  const base = ENTITY_RECEIPT_BRANDING[code];
  const server = receipt.branding;
  // Logo and entity identity always follow resolved entity code — never cross-entity
  const entityKey = code;
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
