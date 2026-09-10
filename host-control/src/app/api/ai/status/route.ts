import { NextResponse } from "next/server";
import { requireHost } from "@/lib/host/auth";

export const dynamic = "force-dynamic";

// GET /api/ai/status — which Intelligence providers are actually working
// right now (not just configured). The probe tries a no-op request to each
// provider before reporting it as "ready".
//
// v23 fix: previously the sandbox SDK was reported as "configured: true"
// unconditionally, which led the UI to display "live intelligence connected"
// while the actual chat fell back to the deterministic engine. We now
// actually attempt to instantiate the SDK and only mark it ready if that
// succeeds. On Vercel (no sandbox credentials) this resolves to false.
//
// The probe result is cached in-module for 60 seconds so opening the panel N
// times does not spam the providers.

let cache: { at: number; json: unknown } | null = null;
const TTL_MS = 60_000;

async function probeGemini(key: string): Promise<boolean> {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1`, { signal: AbortSignal.timeout(6000) });
    return Boolean(res?.ok);
  } catch { return false; }
}
async function probeGroq(key: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(6000) });
    return Boolean(res?.ok);
  } catch { return false; }
}
async function probeZaiSdk(): Promise<boolean> {
  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default;
    await ZAI.create();
    return true;
  } catch { return false; }
}

export async function GET(req: Request) {
  const gate = requireHost(req);
  if (!gate.ok) return gate.res;

  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.json);
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const geminiReady = geminiKey ? await probeGemini(geminiKey) : false;
  const groqReady = process.env.GROQ_API_KEY ? await probeGroq(process.env.GROQ_API_KEY) : false;
  const zaiReady = await probeZaiSdk();

  const anyLive = geminiReady || groqReady || zaiReady;

  const json = {
    ok: true,
    live: anyLive,
    checkedAt: new Date().toISOString(),
    providers: [
      { name: "gemini", label: "Gemini REST (free tier)", configured: Boolean(geminiKey), ready: geminiReady },
      { name: "groq", label: "Groq llama-3.3-70b (free tier)", configured: Boolean(process.env.GROQ_API_KEY), ready: groqReady },
      { name: "z-ai", label: "Sandbox SDK (this workspace)", configured: zaiReady, ready: zaiReady },
      { name: "builtin", label: "Built-in deterministic engine (from the live mirror)", configured: true, ready: true },
    ],
  };
  cache = { at: Date.now(), json };
  return NextResponse.json(json);
}
