import { NextResponse } from "next/server";
import { requireHost } from "@/lib/host/auth";

export const dynamic = "force-dynamic";

// GET /api/ai/status — which Intelligence providers are configured (masked).
export async function GET(req: Request) {
  const gate = requireHost(req);
  if (!gate.ok) return gate.res;

  const providers = [
    { name: "gemini", label: "Gemini REST (free tier)", configured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) },
    { name: "groq", label: "Groq llama-3.3-70b (free tier)", configured: Boolean(process.env.GROQ_API_KEY) },
    { name: "z-ai", label: "Sandbox SDK (this workspace)", configured: true },
    { name: "builtin", label: "Built-in deterministic engine (from the live mirror)", configured: true },
  ];
  return NextResponse.json({ ok: true, providers, checkedAt: new Date().toISOString() });
}
