import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/ai/files  (multipart/form-data: file=<File>)
 * ------------------------------------------------------
 * REAL document intelligence for uploaded files:
 *   - txt / md / csv / json / log ... -> read directly
 *   - xlsx / xls                      -> parsed with SheetJS (real cells)
 *   - pdf                             -> z-ai vision document reader (real text),
 *                                        falls back to a raw-stream extractor
 *   - png / jpg / webp                -> z-ai vision OCR (real)
 * Returns { name, sizeKb, mime, engine, text, summary, fields, risks }
 * so chat, the doc pipeline and reports all share one honest parser.
 */

const TEXT_EXT = [
  "txt", "md", "markdown", "csv", "tsv", "json", "log", "yaml", "yml", "xml",
  "html", "htm", "js", "ts", "tsx", "jsx", "py", "sql", "sh", "ini", "cfg", "rpt",
];
const SHEET_EXT = ["xlsx", "xls", "xlsm"];
const PDF_EXT = ["pdf"];
const IMAGE_MIMES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

function extOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Extremely small raw-PDF text salvage for PDFs the vision reader cannot take. */
function rawPdfText(buf: Buffer): string {
  const s = buf.toString("latin1");
  const out: string[] = [];
  // collect text between parentheses in BT/ET content streams (uncompressed PDFs)
  const re = /\(((?:\\.|[^()\\])*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const t = m[1].replace(/\\([()\\])/g, "$1").replace(/\\n/g, "\n").trim();
    if (t.length > 0 && /[A-Za-z0-9]/.test(t)) out.push(t);
    if (out.length > 20000) break;
  }
  return out.join(" ").replace(/\s{3,}/g, "  ").trim();
}

async function zai() {
  const mod = (await import("z-ai-web-dev-sdk")).default;
  return mod.create();
}

async function readWithVision(
  base64: string,
  mime: string,
  name: string,
  mode: "doc" | "image"
): Promise<{ text: string; engine: string }> {
  try {
    const sdk = await zai();
    const dataUrl = `data:${mime};base64,${base64}`;
    const content: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
      | { type: "file_url"; file_url: { url: string } }
    > = [
      {
        type: "text",
        text:
          mode === "doc"
            ? "Extract ALL text content from this document. Keep the original structure with headings, tables and lists where possible. Output plain text only, no commentary."
            : "Extract ALL visible text from this image (OCR). Preserve layout with line breaks. Also note any dates, money amounts, percentages or GPS coordinates you see. Output plain text only.",
      },
    ];
    if (mode === "image") {
      content.push({ type: "image_url", image_url: { url: dataUrl } });
    } else {
      content.push({ type: "file_url", file_url: { url: dataUrl } });
    }
    const res = await sdk.chat.completions.createVision({
      model: "glm-4.5v",
      messages: [{ role: "user", content }],
      thinking: { type: "disabled" },
    });
    const text = res.choices?.[0]?.message?.content;
    if (text && text.trim().length > 0) {
      return { text: text.trim().slice(0, 60000), engine: mode === "doc" ? "ai-document-reader" : "ai-vision-ocr" };
    }
  } catch {
    /* fall through */
  }
  return { text: "", engine: "unavailable" };
}

function summarize(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentences = clean.split(/(?<=[.!?])\s+/).slice(0, 4).join(" ");
  return sentences.slice(0, 600);
}

function extractFields(text: string) {
  const fields: Record<string, string> = {};
  const money = text.match(/₹\s?[\d,.]+|\b\d[\d,.]*\s?(?:crore|cr|lakh|l)\b/gi);
  if (money) fields.money = Array.from(new Set(money)).slice(0, 10).join(" · ");
  const pcts = text.match(/\b\d{1,3}(?:\.\d+)?\s?%/g);
  if (pcts) fields.percentages = Array.from(new Set(pcts)).slice(0, 12).join(" · ");
  const dates = text.match(/\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/g);
  if (dates) fields.dates = Array.from(new Set(dates)).slice(0, 12).join(" · ");
  const psIds = text.match(/\bPR[JU]-\d{4}-\d+\b/gi);
  if (psIds) fields.projectIds = Array.from(new Set(psIds)).slice(0, 10).join(" · ");
  return fields;
}

const RISK_PATTERNS: Array<[RegExp, string]> = [
  [/delay(?:ed)?\s+of\s+\d+|behind schedule|time overrun/i, "schedule-delay"],
  [/cost overrun|budget overrun|exceeds? (?:the )?budget|escalat/i, "budget-overrun"],
  [/penalt|liquidated damages/i, "contractual-penalty"],
  [/shortfall|deficit|underutili/i, "fund-underutilisation"],
  [/pending (?:approval|sanction)|await(?:s|ing) (?:approval|clearance)/i, "approval-pending"],
  [/contractor (?:issue|dispute|default)|labour (?:shortage|dispute)/i, "execution-risk"],
  [/quality (?:issue|concern|defect)|rework/i, "quality-risk"],
  [/security|fraud|irregularit|misappropriat/i, "integrity-risk"],
  [/weather|monsoon|flood|cyclone/i, "weather-exposure"],
  [/land (?:acquisition|dispute)|ROW|right of way/i, "land-issue"],
];

function scanRisks(text: string) {
  const found: string[] = [];
  for (const [re, tag] of RISK_PATTERNS) {
    if (re.test(text)) found.push(tag);
  }
  return found;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "file_too_large", maxMb: 25 }, { status: 413 });
    }
    const name = file.name || "upload";
    const ext = extOf(name);
    const mime = file.type || "application/octet-stream";
    const buf = Buffer.from(await file.arrayBuffer());
    const sizeKb = Math.max(1, Math.round(file.size / 1024));

    let text = "";
    let engine = "";
    let sheets: string[] = [];

    if (TEXT_EXT.includes(ext)) {
      text = buf.toString("utf-8").slice(0, 120000);
      engine = "text-reader";
    } else if (SHEET_EXT.includes(ext)) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "buffer" });
      sheets = wb.SheetNames;
      const parts: string[] = [];
      for (const sn of wb.SheetNames) {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sn], { blankrows: false });
        parts.push(`## Sheet: ${sn}\n${csv}`);
        if (parts.join("\n").length > 100000) break;
      }
      text = parts.join("\n\n").slice(0, 120000);
      engine = "spreadsheet-parser";
    } else if (PDF_EXT.includes(ext)) {
      const vision = await readWithVision(buf.toString("base64"), "application/pdf", name, "doc");
      text = vision.text;
      engine = vision.engine;
      if (!text || text.length < 40) {
        const raw = rawPdfText(buf);
        if (raw.length > 40) {
          text = raw;
          engine = "pdf-stream-extractor";
        }
      }
    } else if (IMAGE_MIMES.includes(mime) || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
      const vision = await readWithVision(buf.toString("base64"), mime.startsWith("image/") ? mime : "image/png", name, "image");
      text = vision.text;
      engine = vision.engine;
    } else {
      // unknown binary: try utf-8 salvage
      const salvage = buf.toString("utf-8").replace(/[^\x20-\x7E\n\r\t]+/g, " ").trim();
      text = salvage.length > 30 ? salvage.slice(0, 50000) : "";
      engine = text ? "binary-salvage" : "unsupported";
    }

    if (!text || text.length < 5) {
      return NextResponse.json({
        ok: true,
        name,
        sizeKb,
        mime,
        engine: engine || "unsupported",
        text: "",
        summary: "",
        fields: {},
        risks: [],
        note:
          engine === "unavailable"
            ? "Live document reading is not connected on this deployment — text-like and spreadsheet files always parse for real."
            : "This file type could not be read into text in the current environment.",
      });
    }

    return NextResponse.json({
      ok: true,
      name,
      sizeKb,
      mime,
      engine,
      sheets,
      text: text.slice(0, 120000),
      summary: summarize(text),
      fields: extractFields(text),
      risks: scanRisks(text),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "parse_failed", detail: String(err) },
      { status: 500 }
    );
  }
}
