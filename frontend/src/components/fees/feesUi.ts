import type { CollectionPlayer } from "../../feesCollectionTypes";

export function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export function playerInitials(name: string) {
  return (name || "?").split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export function feeBadgeStyle(status: CollectionPlayer["fee_status"]) {
  if (status === "paid" || status === "paid_ahead") return { bg: "#DCFCE7", fg: "#16A34A" };
  if (status === "overdue") return { bg: "#FEE2E2", fg: "#DC2626" };
  return { bg: "#FEF3C7", fg: "#D97706" };
}

export function playerMeta(player: CollectionPlayer, institution: "PWS" | "ALPHA") {
  if (institution === "PWS") {
    return [player.pws_class || player.group, player.is_resident ? "Hostel" : "Day Scholar"].filter(Boolean).join(" · ");
  }
  return [player.centre, player.sport, player.player_type].filter(Boolean).join(" · ");
}
