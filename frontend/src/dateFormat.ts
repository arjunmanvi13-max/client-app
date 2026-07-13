/** User-facing dates: dd/mm/yyyy. API/storage stays YYYY-MM-DD via toISODate/parseToISO. */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

export const DATE_PLACEHOLDER = "DD/MM/YYYY";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function toISODate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatDate(value?: string | Date | null): string {
  if (value == null || value === "") return "—";
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return "—";
    return `${pad2(value.getDate())}/${pad2(value.getMonth() + 1)}/${value.getFullYear()}`;
  }
  const s = String(value).trim();
  if (!s) return "—";

  const isoMatch = s.match(ISO_DATE);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;

  if (s.includes("T")) {
    const datePart = s.slice(0, 10);
    const m = datePart.match(ISO_DATE);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }

  if (DISPLAY_DATE.test(s)) return s;

  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    return `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}/${dt.getFullYear()}`;
  }
  return s;
}

export function formatDateTime(value?: string | Date | null): string {
  if (value == null || value === "") return "—";
  const dt = value instanceof Date ? value : new Date(String(value));
  if (isNaN(dt.getTime())) {
    const s = String(value);
    if (s.includes("T")) {
      const time = s.slice(11, 16);
      return time ? `${formatDate(s.slice(0, 10))}, ${time}` : formatDate(s);
    }
    return formatDate(s);
  }
  return `${formatDate(dt)}, ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

export function formatTime(value?: string | Date | null): string {
  if (value == null || value === "") return "—";
  const dt = value instanceof Date ? value : new Date(String(value));
  if (isNaN(dt.getTime())) return "—";
  return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

export function formatMonthLong(value?: string | null): string {
  if (!value) return "—";
  const s = String(value).trim();
  const m = s.match(ISO_MONTH);
  if (m) {
    const monthIdx = parseInt(m[2], 10) - 1;
    const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${names[monthIdx] ?? m[2]} ${m[1]}`;
  }
  return formatMonth(s);
}

export function formatMonth(value?: string | null): string {
  if (!value) return "—";
  const s = String(value).trim();
  const m = s.match(ISO_MONTH);
  if (m) return `${m[2]}/${m[1]}`;
  return formatDate(s.length >= 10 ? s.slice(0, 10) : s);
}

export function parseToISO(value: string): string | null {
  const s = value.trim();
  if (!s) return null;
  const display = s.match(DISPLAY_DATE);
  if (display) return `${display[3]}-${display[2]}-${display[1]}`;
  if (ISO_DATE.test(s)) return s;
  return null;
}

export function isValidDisplayDate(value: string): boolean {
  const iso = parseToISO(value);
  if (!iso) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function dateHelpText(): string {
  return `Format: ${DATE_PLACEHOLDER} (e.g. ${formatDate(toISODate())})`;
}
