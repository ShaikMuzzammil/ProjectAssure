import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import {
  adminEmail,
  adminPassword,
  checkLockout,
  clearFailures,
  clientIp,
  recordFailure,
  sessionCookieHeader,
  signSessionToken,
} from "@/lib/host/auth";
import { audit, getStore, saveNow } from "@/lib/host/store";

export const dynamic = "force-dynamic";

// v23 — POST /api/auth/login — real host login with IP lockout + audit.
// The "current" password to verify against:
//   1. if the host store has a stored hash for this admin (set by
//      /api/admin/auth/change-password), verify against it
//   2. otherwise → verify against the env var (HOST_ADMIN_PASSWORD)
// This way the in-app "Change password" actually takes effect immediately.
// On Vercel the env var wins for the FIRST login after a cold start (the
// stored hash is per-lambda-instance); the admin is told to update the env
// var for permanent change in the Settings panel.

const HOST_USER_KEY = "__hostAdminPasswordHash";

function verifyStored(pw: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "sha256") return false;
  const salt = parts[1];
  const known = parts[2];
  const test = createHash("sha256").update(`${salt}::${pw}::projectassure-host`).digest("hex");
  return test === known;
}

export async function POST(req: Request) {
  let payload: { email?: string; password?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const ip = clientIp(req);
  const email = String(payload.email ?? "").trim().toLowerCase();
  const password = String(payload.password ?? "");

  const lock = checkLockout(ip);
  if (lock.locked) {
    return NextResponse.json(
      {
        ok: false,
        error: "locked",
        message: `Too many failed attempts. This IP is locked for ${Math.ceil(lock.retryAfterSec / 60)} more minute(s).`,
        retryAfterSec: lock.retryAfterSec,
      },
      { status: 429 },
    );
  }

  const expectedEmail = adminEmail();
  const envPassword = adminPassword();
  const emailOk = email === expectedEmail;

  // v23 — check the stored hash first (set by /api/admin/auth/change-password).
  // If no stored hash, fall back to the env var.
  const store = getStore();
  const stored = (store as unknown as { [k: string]: unknown })[HOST_USER_KEY] as string | undefined;
  let passwordOk: boolean;
  if (stored && stored.startsWith("sha256$")) {
    passwordOk = verifyStored(password, stored);
  } else {
    passwordOk = password === envPassword;
  }

  if (emailOk && passwordOk) {
    clearFailures(ip);
    const token = signSessionToken(expectedEmail);
    audit("auth.login.success", expectedEmail, `host administrator signed in from IP ${ip}${stored ? " (using stored hash from /api/admin/auth/change-password)" : " (using env var)"}`, "success");
    saveNow();
    const res = NextResponse.json({ ok: true, email: expectedEmail });
    res.headers.set("Set-Cookie", sessionCookieHeader(token));
    return res;
  }

  const result = recordFailure(ip, email || "(empty)");
  saveNow();
  if (result.locked) {
    return NextResponse.json(
      {
        ok: false,
        error: "locked",
        message: `Too many failed attempts — IP ${ip} is locked for 10 minutes.`,
        retryAfterSec: result.retryAfterSec,
      },
      { status: 429 },
    );
  }
  return NextResponse.json(
    {
      ok: false,
      error: "invalid_credentials",
      message: "Invalid email or password.",
      remainingAttempts: result.remainingAttempts,
    },
    { status: 401 },
  );
}
