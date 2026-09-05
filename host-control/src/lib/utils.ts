import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Department helpers ─────────────────────────────────────────────────────
// Defined here (rather than in @/lib/host/seed) so utility consumers don't
// import seed data transitively. Mirrors the seed's DEPARTMENTS list.
const DEPARTMENTS = [
  { id: "dept-ipmd", name: "Infrastructure & Project Monitoring Division", code: "IPMD", ministry: "MoSPI" },
  { id: "dept-nat", name: "National Accounts Division", code: "NASD", ministry: "MoSPI" },
  { id: "dept-soc", name: "Social Statistics Division", code: "SOSD", ministry: "MoSPI" },
  { id: "dept-eco", name: "Economic Statistics Division", code: "ECSD", ministry: "MoSPI" },
  { id: "dept-cb", name: "Capacity Building Division", code: "CAPB", ministry: "MoSPI" },
];

export function deptName(id: string): string {
  return DEPARTMENTS.find(d => d.id === id)?.name ?? id;
}
export function deptCode(id: string): string {
  return DEPARTMENTS.find(d => d.id === id)?.code ?? id;
}

/** Format a number in Indian grouping (lakh / crore) as ₹ string. */
export function fmtINR(lakh: number, opts: { unit?: "lakh" | "crore"; decimals?: number } = {}): string {
  const { unit = "auto", decimals } = opts as any;
  if (lakh == null || isNaN(lakh)) return "—";
  const crore = lakh / 100;
  if (unit === "crore" || (unit === "auto" && Math.abs(crore) >= 1)) {
    const v = crore.toLocaleString("en-IN", { maximumFractionDigits: decimals ?? 2, minimumFractionDigits: 0 });
    return `₹${v} Cr`;
  }
  const v = lakh.toLocaleString("en-IN", { maximumFractionDigits: decimals ?? 1 });
  return `₹${v} L`;
}

/** Compact percentage formatter. */
export function fmtPct(n: number, decimals = 1): string {
  if (n == null || isNaN(n)) return "—";
  return `${n.toFixed(decimals)}%`;
}

/** DD Mon YYYY, HH:MM IST formatter. */
export function fmtDateTime(iso?: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

/** DD Mon YYYY formatter. */
export function fmtDate(iso?: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

/** Time-ago formatter ("3m ago", "2h ago", "5d ago"). */
export function timeAgo(iso?: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

/** Download a text blob with a filename. */
export function downloadText(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Trigger a CSV download from an array of objects. */
export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    downloadText(filename, "", "text/csv");
    return;
  }
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map(r => headers.map(h => esc(r[h])).join(",")),
  ];
  downloadText(filename, lines.join("\n"), "text/csv");
}

/** Trigger an Excel (.xlsx) download from rows. Loads xlsx lazily on the client. */
export async function downloadXLSX(filename: string, rows: Record<string, unknown>[], sheetName = "Sheet1") {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

/** Trigger a PDF download from text (uses jsPDF). */
export async function downloadPDF(filename: string, title: string, body: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;

  doc.setFontSize(16);
  doc.setTextColor(11, 66, 110); // #0b426e
  doc.text(title, margin, margin + 8);

  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const lines = doc.splitTextToSize(body, maxWidth);
  let y = margin + 32;
  const pageHeight = doc.internal.pageSize.getHeight();
  for (const ln of lines) {
    if (y > pageHeight - margin) { doc.addPage(); y = margin; }
    doc.text(ln, margin, y);
    y += 14;
  }
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 140);
  doc.text(`Generated by ProjectAssure Host Control · ${new Date().toLocaleString("en-IN")}`, margin, pageHeight - 20);
  doc.save(filename);
}

/** Stable id generator with prefix. */
let _idCounter = 0;
export function nextId(prefix = "id"): string {
  _idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${_idCounter.toString(36)}`;
}

/** Clamp number. */
export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Read text content of a File (PDF/Excel/CSV/TXT/image-OCR-free) on client. */
export async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || file.type === "text/plain") {
    return await file.text();
  }
  if (name.endsWith(".csv") || file.type === "text/csv") {
    return await file.text();
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const out: string[] = [];
    wb.SheetNames.forEach(sn => {
      const ws = wb.Sheets[sn];
      out.push(`# Sheet: ${sn}\n` + XLSX.utils.sheet_to_csv(ws));
    });
    return out.join("\n\n");
  }
  // PDF / image — best-effort metadata block. Real OCR is server-side in the
  // main prototype; for the host-control demo we ship a meaningful placeholder.
  return `[Attached file: ${file.name} · ${file.type || "unknown type"} · ${(file.size / 1024).toFixed(1)} KB]\n(Binary content — full OCR pipeline runs in the main ProjectAssure prototype.)`;
}
