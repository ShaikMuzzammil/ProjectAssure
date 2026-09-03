/* ============================================================
 * ProjectAssure — formatting helpers
 * Indian digit grouping, INR crore/lakh, dates per doc 06 rules
 * ============================================================ */

/** 14500 (lakhs) -> "₹14,500.00 L" ; >= 100 lakhs shows crore too */
export function formatLakhs(lakhs: number, opts?: { compact?: boolean }): string {
  if (lakhs >= 100) {
    const cr = lakhs / 100;
    if (opts?.compact && cr >= 1000) return `₹${formatIndian(Math.round(cr))} Cr`;
    return `₹${formatIndian(Number(cr.toFixed(2)))} Cr`;
  }
  return `₹${formatIndian(Number(lakhs.toFixed(2)))} L`;
}

export function formatIndian(n: number): string {
  const neg = n < 0;
  const s = Math.abs(n).toString();
  let [int, dec] = s.split(".");
  if (int.length > 3) {
    const last3 = int.slice(-3);
    const rest = int.slice(0, -3);
    int = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  }
  return (neg ? "-" : "") + int + (dec ? "." + dec : "");
}

export function formatPct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** DD Mon YYYY (doc 06 rule: DD Mon YYYY) */
export function formatDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)} · ${hh}:${mm} IST`;
}

export function monthLabel(month: number, year: number): string {
  return `${MONTHS[month - 1]} ${String(year).slice(2)}`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
