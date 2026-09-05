// ProjectAssure — formatting helpers (Indian conventions per spec R4/R5)

export function inr(value: number, unit: "lakhs" | "auto" = "auto"): string {
  if (unit === "lakhs") return `₹${value.toLocaleString("en-IN")} L`;
  if (value >= 100000) return `₹${Math.round(value / 100).toLocaleString("en-IN")} Cr`;
  if (value >= 100) return `₹${(value / 100).toFixed(1)} Cr`;
  return `₹${Math.round(value)} L`;
}

export function inrFull(value: number): string {
  return `₹${value.toLocaleString("en-IN")} lakh`;
}

export function pct(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

export function shortDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function dateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${shortDate(d)} · ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} IST`;
}

export function monthName(m: number): string {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][((m - 1) % 12 + 12) % 12];
}

export function monthLabel(m: number, y: number): string {
  return `${monthName(m)} ${String(y).slice(2)}`;
}

export function relTime(iso: string | Date, now = new Date()): string {
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  const diff = Math.max(0, now.getTime() - t);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return shortDate(new Date(t));
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function daysBetween(a: string | Date, b: string | Date): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export function addDays(iso: string | Date, days: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function fiscalYear(d: Date = new Date()): string {
  const y = d.getFullYear();
  return d.getMonth() >= 3 ? `FY ${y}-${String(y + 1).slice(2)}` : `FY ${y - 1}-${String(y).slice(2)}`;
}
