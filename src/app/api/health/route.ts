import { NextResponse } from "next/server";

// GET /api/health — deployment posture & subsystem status (used by the Admin
// "Data mode" panel and the go-live checklist). Never throws.
export async function GET() {
  const env = {
    database: !!process.env.DATABASE_URL,
    email: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS) || !!process.env.RESEND_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    redis: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    blob: !!process.env.BLOB_READ_WRITE_TOKEN,
    pinecone: !!process.env.PINECONE_API_KEY,
  };
  const mode = env.database ? "connected" : "simulation";
  const aiProvider = process.env.GEMINI_API_KEY ? "gemini" : process.env.OPENAI_API_KEY ? "openai" : "deterministic";
  return NextResponse.json({
    ok: true,
    app: "ProjectAssure",
    version: "ultra-2.0.0",
    mode,
    portal: process.env.NEXT_PUBLIC_PORTAL ?? "main",
    subsystems: env,
    aiProvider,
    emailProvider: env.email ? "smtp" : "outbox",
    timeIST: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
  });
}
