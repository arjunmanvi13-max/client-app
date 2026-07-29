export function formatInr(amount: number | null | undefined, decimals = 2): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return "₹0.00";
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function parseInrInput(raw: string): number {
  const cleaned = raw.replace(/[₹,\s]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
