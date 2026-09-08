import { NextResponse } from "next/server";
import { requireHost } from "@/lib/host/auth";

export const dynamic = "force-dynamic";

// GET /api/ai/status — aggregate intelligence readiness (v23: provider/key
// names are deliberately NOT exposed to the UI; only connected state).
export async function GET(req: Request) {
  const gate = requireHost(req);
  if (!gate.ok) return gate.res;

  const liveConfigured = Boolean(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GROQ_API_KEY ||
    process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
  );
  const providers = [
    { name: "intelligence", label: liveConfigured ? "Live intelligence connected" : "Built-in engine (from the live mirror)", configured: true },
    { name: "engine", label: "Deterministic mirror engine — always available", configured: true },
  ];
  return NextResponse.json({ ok: true, connected: liveConfigured, providers, checkedAt: new Date().toISOString() });
}
