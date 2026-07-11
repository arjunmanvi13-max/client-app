export type EntityLabel = { code: string; name: string; short?: string };

export function entityLabelsFor(ward: {
  entity_labels?: EntityLabel[];
  entities?: string[];
  organization?: string;
  is_dual_participation?: boolean;
}): EntityLabel[] {
  if (ward.entity_labels?.length) return ward.entity_labels;
  const ents = ward.entities || (ward.organization === "BOTH" ? ["PWS", "ALPHA"] : [ward.organization || "PWS"]);
  return ents.filter(Boolean).map((code) => ({
    code,
    name: code === "PWS" ? "Prarambhika World School" : code === "ALPHA" ? "ALPHA Sports Academy" : code,
    short: code === "PWS" ? "School" : code === "ALPHA" ? "Sports" : code,
  }));
}

export const ENTITY_COLORS: Record<string, { bg: string; fg: string }> = {
  PWS: { bg: "#DBEAFE", fg: "#1D4ED8" },
  ALPHA: { bg: "#FFEDD5", fg: "#C2410C" },
};
