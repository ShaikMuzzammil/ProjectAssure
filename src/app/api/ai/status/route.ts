import { NextResponse } from "next/server";

// GET /api/ai/status — one cheap, cached probe that answers:
//   "is a live intelligence service connected, and which tier?"
//
// Priority mirrors /api/ai/chat: Gemini key → Groq key → OpenRouter key →
// OpenAI key → sandbox SDK. The probe is a free metadata request (models
// list), not a completion, so it costs nothing against daily quotas.
// Result is cached in-module for 90 seconds so opening the panel N times
// does not spam the provider. The UI shows only the masked `label`
// ("live intelligence service · connected" / "built-in engine") — provider
// and model names stay server-side (terminology masking, SIH-integrity).

export const maxDuration = 30;

let cache: { at: number; json: Record<string, unknown> } | null = null;
const TTL_MS = 90_000;

async function probe(url: string, init: RequestInit = {}, ms = 6000): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.json);
  }

  const tier = (n: number) => (n === 1 ? "primary" : n === 2 ? "secondary" : n === 3 ? "community" : n === 4 ? "standard" : "sandbox");

  const ok = (connected: boolean, slot: number, model?: string) => {
    const json = {
      connected,
      tier: connected ? tier(slot) : "built-in",
      label: connected ? "live intelligence service · connected" : "built-in engine",
      model: model ?? null,
      checkedAt: new Date().toISOString(),
    };
    cache = { at: Date.now(), json };
    return NextResponse.json(json);
  };

  // 1) Gemini — free tier (models list is free; 200 = key works)
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    const res = await probe(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(geminiKey)}&pageSize=1`);
    if (res?.ok) return ok(true, 1, "gemini-2.0-flash");
  }

  // 2) Groq — free tier
  if (process.env.GROQ_API_KEY) {
    const res = await probe("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } });
    if (res?.ok) return ok(true, 2, "llama-3.3-70b");
  }

  // 3) OpenRouter — free community models
  if (process.env.OPENROUTER_API_KEY) {
    const res = await probe("https://openrouter.ai/api/v1/models", { headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } });
    if (res?.ok) return ok(true, 3, "community-model");
  }

  // 4) OpenAI
  if (process.env.OPENAI_API_KEY) {
    const res = await probe("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } });
    if (res?.ok) return ok(true, 4, "gpt-4o-mini");
  }

  // 5) sandbox SDK (this workspace only — on Vercel this resolves false
  //    instantly because the SDK has no credentials there)
  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    await ZAI.create();
    return ok(true, 5, "sandbox");
  } catch {
    /* fall through */
  }

  return ok(false, 0);
}
