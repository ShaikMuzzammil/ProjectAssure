import { NextResponse } from "next/server";
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

// POST /api/auth/login — real host login with IP lockout + audit.
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
  const expectedPassword = adminPassword();
  const emailOk = email === expectedEmail;
  const passwordOk = password === expectedPassword;

  if (emailOk && passwordOk) {
    clearFailures(ip);
    const token = signSessionToken(expectedEmail);
    audit("auth.login.success", expectedEmail, `host administrator signed in from IP ${ip}`, "success");
    saveNow();
    getStore(); // ensure singleton initialized
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
