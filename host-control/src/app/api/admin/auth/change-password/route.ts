import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireHost } from "@/lib/host/auth";
import { audit, getStore, IS_VERCEL, saveNow } from "@/lib/host/store";

export const dynamic = "force-dynamic";

// v23 — POST /api/admin/auth/change-password
// Lets the host admin change their password in dev (persisted to the host
// store under the env-configured email). The current password is verified
// against the env var (or the stored hash if the admin already changed it
// once). The new password must meet the policy.
//
// HONEST BEHAVIOUR:
//   - On Vercel: the change is per-lambda-instance. To make it permanent,
//     update HOST_ADMIN_PASSWORD in the Vercel project settings and
//     redeploy. The response tells the admin this clearly.
//   - In dev: the new hash is persisted to .host-store.json and survives
//     restarts. The env var still wins for the first login after a fresh
//     start, but once changed, the stored hash is the source of truth
//     until the file is deleted.
//   - Changing the password invalidates every live session (the session
//     secret is derived from the admin password in lib/host/auth.ts).
//
// REQUEST: { currentPassword: string, newPassword: string }
// RESPONSE: { ok: true, message: string, persistence?: string }

const MIN_PW = 8;
const HOST_USER_KEY = "__hostAdminPasswordHash";

function pwIssues(pw: string): string[] {
  const out: string[] = [];
  if (pw.length < MIN_PW) out.push(`${MIN_PW}+ characters`);
  if (!/[A-Za-z]/.test(pw)) out.push("one letter");
  if (!/[0-9]/.test(pw)) out.push("one number");
  return out;
}

function hashPw(pw: string): string {
  // salted sha256 — good enough for an env-configured single-admin login
  // (the main app uses scrypt for end users; the host admin is one row).
  const salt = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const hash = createHash("sha256").update(`${salt}::${pw}::projectassure-host`).digest("hex");
  return `sha256$${salt}$${hash}`;
}

function verifyPw(pw: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "sha256") return false;
  const salt = parts[1];
  const known = parts[2];
  const test = createHash("sha256").update(`${salt}::${pw}::projectassure-host`).digest("hex");
  return test === known;
}

export async function POST(req: Request) {
  const gate = requireHost(req);
  if (!gate.ok) return gate.res;
  const actor = gate.email;

  let body: { currentPassword?: string; newPassword?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 }); }

  const cur = String(body.currentPassword ?? "");
  const next = String(body.newPassword ?? "");
  if (!cur || !next) return NextResponse.json({ ok: false, error: "current_and_new_required" }, { status: 422 });
  const issues = pwIssues(next);
  if (issues.length) return NextResponse.json({ ok: false, error: `New password needs ${issues.join(", ")}.` }, { status: 422 });
  if (cur === next) return NextResponse.json({ ok: false, error: "New password must be different from the current one." }, { status: 422 });

  // The "current" password to verify against:
  //   1. if the host store already has a stored hash for this admin → verify against it
  //   2. otherwise → verify against the env var (HOST_ADMIN_PASSWORD)
  const store = getStore();
  const stored = (store as unknown as { [k: string]: unknown })[HOST_USER_KEY] as string | undefined;
  const envPw = process.env.HOST_ADMIN_PASSWORD ?? "hostoverseer";

  let currentOk = false;
  if (stored && stored.startsWith("sha256$")) {
    currentOk = verifyPw(cur, stored);
  } else {
    currentOk = cur === envPw;
  }
  if (!currentOk) {
    audit("auth.password-change-failed", actor, "current password did not match", "warning");
    return NextResponse.json({ ok: false, error: "Current password is incorrect." }, { status: 401 });
  }

  // Store the new hash. We stash it on the store's runtime controller so it
  // survives the request (and, in dev, gets persisted via saveNow). On
  // Vercel the env var still wins for the FIRST login after a cold start —
  // the admin is told to update the env var for permanent change.
  (store as unknown as { [k: string]: unknown })[HOST_USER_KEY] = hashPw(next);
  saveNow();

  audit(
    "auth.password-changed",
    actor,
    `Host admin password changed${IS_VERCEL ? " (Vercel — per-lambda-instance; update HOST_ADMIN_PASSWORD env var for permanent change)" : " (persisted to .host-store.json)"}`,
    "success",
  );

  return NextResponse.json({
    ok: true,
    message: IS_VERCEL
      ? "Password changed for this server instance. Update HOST_ADMIN_PASSWORD in the Vercel project settings to make it permanent across cold starts."
      : "Password changed and persisted. Your existing session is invalidated — please sign out and back in with the new password.",
    persistence: IS_VERCEL
      ? "in-memory (Vercel — read-only FS)"
      : "persisted to .host-store.json",
  });
}
