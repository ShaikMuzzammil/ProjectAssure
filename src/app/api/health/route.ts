import { NextResponse } from "next/server";

// GET /api/health — deployment posture (used by Host Control's connection
// test and the Admin data-mode panel). Never throws, never exposes which
// provider keys are configured — only aggregate readiness flags.
export async function GET() {
  const liveIntelligence =
    !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GROQ_API_KEY ||
      process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY);
  const emailReady =
    !!(process.env.EMAIL_USER && process.env.EMAIL_PASS) || !!process.env.BREVO_API_KEY || !!process.env.RESEND_API_KEY;
  const mode = process.env.DATABASE_URL ? "connected" : "simulation";
  return NextResponse.json({
    ok: true,
    app: "ProjectAssure",
    mode,
    subsystems: {
      database: mode === "connected",
      intelligence: liveIntelligence,
      email: emailReady,
    },
    aiProvider: liveIntelligence ? "live" : "built-in",
    emailProvider: emailReady ? "configured" : "outbox",
    timeIST: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
  });
}
