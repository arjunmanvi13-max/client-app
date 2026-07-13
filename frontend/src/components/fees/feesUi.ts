import type { CollectionPlayer, Institution } from "../../feesCollectionTypes";

export function inr(n: number) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export function inrSigned(n: number) {
  const abs = Math.abs(n || 0);
  const formatted = abs.toLocaleString("en-IN");
  if (n < 0) return `-₹${formatted}`;
  return `₹${formatted}`;
}

const FEE_HEAD_LABELS: Record<string, { pws?: string; alpha?: string; default: string }> = {
  Registration: { default: "Registration Fee" },
  Monthly: { pws: "Monthly Tuition Fee", alpha: "Monthly Coaching Fee", default: "Monthly Fee" },
  Hostel: { default: "Hostel Fee" },
  Transport: { default: "Transport Fee" },
  Exam: { default: "Exam Fee" },
  Uniform: { default: "Uniform Fee" },
  Kit: { default: "Kit Fee" },
  Tournament: { default: "Tournament Fee" },
  Books: { default: "Books Fee" },
  Event: { default: "Event Fee" },
  Other: { default: "Other Fee" },
};

export function feeHeadLabel(feeType: string, institution: Institution): string {
  const key = feeType?.trim();
  if (!key) return "Fee";
  const mapped = FEE_HEAD_LABELS[key];
  if (mapped) {
    return institution === "PWS" ? (mapped.pws || mapped.default) : (mapped.alpha || mapped.default);
  }
  return /fee$/i.test(key) ? key : `${key} Fee`;
}

export function learnerContextLine(
  player: {
    centre?: string;
    sport?: string;
    category?: string;
    player_type?: string;
    group?: string;
    is_resident?: boolean;
    kind?: string;
  },
  institution: Institution,
) {
  if (institution === "PWS") {
    const boarding = player.is_resident ? "Hostel" : "Day Scholar";
    return [player.group || player.centre, boarding].filter(Boolean).join(" · ");
  }
  return [player.centre, player.sport, player.player_type || player.category].filter(Boolean).join(" · ");
}

const BELOW_20 = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function twoDigits(n: number): string {
  if (n < 20) return BELOW_20[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  return u ? `${TENS[t]}-${BELOW_20[u]}` : TENS[t];
}

function threeDigits(n: number): string {
  if (n >= 100) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return rest ? `${BELOW_20[h]} hundred ${twoDigits(rest)}` : `${BELOW_20[h]} hundred`;
  }
  return twoDigits(n);
}

function indianGroupWords(n: number): string {
  if (n === 0) return "";
  if (n < 1000) return threeDigits(n);
  if (n < 100000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    return rest ? `${threeDigits(thousands)} thousand ${indianGroupWords(rest)}` : `${threeDigits(thousands)} thousand`;
  }
  if (n < 10000000) {
    const lakhs = Math.floor(n / 100000);
    const rest = n % 100000;
    return rest ? `${threeDigits(lakhs)} lakh ${indianGroupWords(rest)}` : `${threeDigits(lakhs)} lakh`;
  }
  const crores = Math.floor(n / 10000000);
  const rest = n % 10000000;
  return rest ? `${threeDigits(crores)} crore ${indianGroupWords(rest)}` : `${threeDigits(crores)} crore`;
}

export function amountInWords(n: number): string | null {
  const value = Math.round(n || 0);
  if (value <= 0 || value > 99999999) return null;
  const words = indianGroupWords(value).replace(/\s+/g, " ").trim();
  if (!words) return null;
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} rupees only`;
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
