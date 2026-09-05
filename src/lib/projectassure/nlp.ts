// ProjectAssure — NLP layer: intent classification, sentiment scoring,
// keyword/risk extraction, extractive summarisation. Deterministic, zero-API.
export type Intent = "risk_query" | "status_query" | "doc_query" | "comparison" | "report_request" | "budget_query" | "smalltalk" | "action_plan";

const INTENT_PATTERNS: { intent: Intent; re: RegExp }[] = [
  { intent: "smalltalk", re: /^(hi|hello|hey|namaste|thanks|thank you|good (morning|evening|afternoon))/i },
  { intent: "action_plan", re: /(action plan|recommended|recommendation|what should i do|what to do|next step|advice|guidance|plan of action|fix|improve|help me with)/i },
  { intent: "risk_query", re: /(why|what).*(risk|at.?risk|delay|behind|slip|red|amber|critical|failing|troubl)/i },
  { intent: "comparison", re: /(compare|comparison|vs\.?|versus|against|better|worse)/i },
  { intent: "report_request", re: /(report|summary|digest|brief|export|pdf|excel)/i },
  { intent: "doc_query", re: /(document|report text|pdf|upload|ocr|extract|page|what does.*(report|note) say)/i },
  { intent: "budget_query", re: /(budget|cost|spend|spent|burn|overrun|forecast|money|crore|expenditure)/i },
  { intent: "status_query", re: /(status|progress|health|how many|show|list|which|state|tamil|maharashtra|sector|department)/i },
];

export function classifyIntent(q: string): Intent {
  for (const p of INTENT_PATTERNS) if (p.re.test(q)) return p.intent;
  return "status_query";
}

// Tiny lexicon sentiment (government-report tuned)
const NEG = ["delay", "delayed", "pending", "slip", "behind", "overrun", "blocked", "idle", "risk", "bottleneck", "breach", "stale", "escalat", "dispute", "claim", "critical", "fail", "shortfall", "lapse", "unresolved", "idle", "monsoon loss", "verrun"];
const POS = ["complete", "completed", "on track", "on time", "stable", "pass", "aligned", "approved", "satisfactory", "recovered", "clean", "accelerat", "progress"];

export function sentiment(text: string): { score: number; label: "positive" | "neutral" | "negative"; matches: string[] } {
  const t = text.toLowerCase();
  const neg = NEG.filter(w => t.includes(w));
  const pos = POS.filter(w => t.includes(w));
  const score = Math.max(-1, Math.min(1, (pos.length - neg.length) / Math.max(3, pos.length + neg.length)));
  return { score: +score.toFixed(2), label: score < -0.15 ? "negative" : score > 0.15 ? "positive" : "neutral", matches: [...neg.slice(0, 6), ...pos.slice(0, 4)] };
}

const STOP = new Set("the a an and or of to in for on with by at from as is are was were be been this that these those it its has have had will would shall should may might can not no than then there their his her they them you your our we i he she which who whom what when where why how all any both each few more most other some such only own same so too very s t just don now also into over under again further once during before after above below up down out off very".split(" "));

export function keywords(text: string, limit = 12): string[] {
  const freq = new Map<string, number>();
  for (const w of text.toLowerCase().replace(/[^a-z0-9\s%.]/g, " ").split(/\s+/)) {
    if (w.length < 4 || STOP.has(w) || /^\d+$/.test(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(e => e[0]);
}

/** Extractive summariser: sentence scoring by keyword frequency + position. */
export function summarize(text: string, maxSentences = 3): string {
  const sentences = text.replace(/\n+/g, " ").split(/(?<=[.!?])\s+/).filter(s => s.length > 30);
  if (sentences.length <= maxSentences) return sentences.join(" ");
  const kw = new Map(keywords(text, 24).map((k, i) => [k, 24 - i]));
  const scored = sentences.map((s, idx) => {
    let score = (idx === 0 ? 8 : 0) + (idx === 1 ? 4 : 0);
    for (const [k, v] of kw) if (s.toLowerCase().includes(k)) score += v;
    if (/\d/.test(s)) score += 3;
    return { s, score, idx };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, maxSentences).sort((a, b) => a.idx - b.idx).map(x => x.s).join(" ");
}

export function numberTokens(text: string): string[] {
  return [...text.matchAll(/₹?\s?[\d,.]+\s?(crore|cr|lakh|percent|%|days|months|km|tonnes|units|persons)/gi)].map(m => m[0].trim());
}
