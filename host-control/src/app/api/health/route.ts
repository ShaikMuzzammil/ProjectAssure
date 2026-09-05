import { NextResponse } from "next/server";

// GET /api/health — host-control deployment posture. Used by the host-control's
// own Integrations panel "self-status" tile, by the live-sync polling on the
// client, and by external watchers (e.g. main ProjectAssure can probe this URL).
export async function GET() {
  const env = {
    mainProjectUrl: !!process.env.MAIN_PROJECT_URL,
    gemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    groq: !!process.env.GROQ_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    webhookSecret: !!process.env.WEBHOOK_SECRET,
    database: !!process.env.DATABASE_URL,
  };
  const aiTier = env.gemini ? "gemini"
    : env.groq ? "groq"
    : env.openrouter ? "openrouter"
    : env.openai ? "openai"
    : "built-in";
  return NextResponse.json({
    ok: true,
    app: "ProjectAssure Host Control",
    version: "1.0.0",
    role: "ADMIN",
    persona: "Chief Programme Officer",
    mode: "in-memory + localStorage mirror",
    mainProjectUrl: process.env.MAIN_PROJECT_URL ?? "https://project-assure.vercel.app",
    subsystems: env,
    aiTier,
    timeIST: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
  });
}
