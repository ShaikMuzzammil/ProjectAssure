// ═══════════════════════════════════════════════════════════════════════════
// Host Control auth — real login, signed httpOnly session cookie, IP lockout.
//
// · Credentials from env: HOST_ADMIN_EMAIL / HOST_ADMIN_PASSWORD
//   (defaults cpo@mospi.gov.in / hostoverseer — documented in .env.example).
// · Session token: `email|issuedAtMs|HMAC-SHA256(email|issuedAtMs, secret)`.
//   Secret = HOST_SESSION_SECRET env, or a digest derived from the admin
//   password (so changing the password invalidates every live session).
// · Cookie: httpOnly + SameSite=Lax, 8h TTL, Secure in production.
// · Brute force: 6 failed attempts per IP → 10-minute lockout (in-RAM).
// · Every attempt is audited.
// ═══════════════════════════════════════════════════════════════════════════

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { audit, getStore, nowIso } from "./store";

export const SESSION_COOKIE = "host_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAX_FAILS = 6;
const LOCKOUT_MS = 10 * 60 * 1000; // 10 minutes

export function adminEmail(): string {
  return (process.env.HOST_ADMIN_EMAIL ?? "cpo@mospi.gov.in").trim().toLowerCase();
}

export function adminPassword(): string {
  return process.env.HOST_ADMIN_PASSWORD ?? "hostoverseer";
}

function sessionSecret(): string {
  if (process.env.HOST_SESSION_SECRET && process.env.HOST_SESSION_SECRET.length >= 16) {
    return process.env.HOST_SESSION_SECRET;
  }
  // Derive a stable secret from the admin password (documented fallback).
  return createHash("sha256").update(`${adminPassword()}::projectassure-host-control-v21`).digest("hex");
}

export function signSessionToken(email: string): string {
  const issued = Date.now().toString();
  const payload = `${email}|${issued}`;
  const mac = createHmac("sha256", sessionSecret()).update(payload).digest("hex");
  return `${payload}|${mac}`;
}

export function verifySessionToken(token: string | undefined): { ok: boolean; email?: string } {
  if (!token) return { ok: false };
  const parts = token.split("|");
  if (parts.length !== 3) return { ok: false };
  const [email, issued, mac] = parts;
  const expected = createHmac("sha256", sessionSecret()).update(`${email}|${issued}`).digest("hex");
  try {
    const a = Buffer.from(mac, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
  } catch {
    return { ok: false };
  }
  const issuedAt = Number(issued);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > SESSION_TTL_MS) return { ok: false };
  if (email.toLowerCase() !== adminEmail()) return { ok: false };
  return { ok: true, email };
}

// ── Cookie helpers (raw Set-Cookie strings, no framework dep) ───────────────

export function sessionCookieHeader(token: string): string {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

export function clearCookieHeader(): string {
  const parts = [`${SESSION_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (process.env.NODE_ENV === "production") parts.push("Secure");
  return parts.join("; ");
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return undefined;
}

export function getSession(req: Request): { ok: boolean; email?: string } {
  return verifySessionToken(readCookie(req, SESSION_COOKIE));
}

/** Gate for every /api/admin route — 401 JSON when the session is invalid. */
export function requireHost(req: Request): { ok: true; email: string } | { ok: false; res: NextResponse } {
  const s = getSession(req);
  if (s.ok && s.email) return { ok: true, email: s.email };
  return {
    ok: false,
    res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }),
  };
}

// ── IP + brute-force lockout ────────────────────────────────────────────────

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "local";
}

export interface AttemptResult {
  allowed: boolean;
  locked: boolean;
  remainingAttempts?: number;
  retryAfterSec?: number;
}

/** Pre-check: is this IP currently locked out? */
export function checkLockout(ip: string): { locked: boolean; retryAfterSec: number } {
  const lock = getStore().lockouts[ip];
  if (lock?.lockedUntil) {
    const until = Date.parse(lock.lockedUntil);
    if (Number.isFinite(until) && until > Date.now()) {
      return { locked: true, retryAfterSec: Math.ceil((until - Date.now()) / 1000) };
    }
  }
  return { locked: false, retryAfterSec: 0 };
}

/** Record a failed attempt. Locks out after MAX_FAILS. Audits everything. */
export function recordFailure(ip: string, emailTried: string): AttemptResult {
  const ctl = getStore();
  const lock = ctl.lockouts[ip] ?? { fails: 0, lastFailAt: nowIso() };
  lock.fails += 1;
  lock.lastFailAt = nowIso();
  if (lock.fails >= MAX_FAILS) {
    const until = new Date(Date.now() + LOCKOUT_MS).toISOString();
    lock.lockedUntil = until;
    ctl.lockouts[ip] = lock;
    audit("auth.login.locked", "system", `IP ${ip} locked for 10 minutes after ${MAX_FAILS} failed attempts (tried: ${emailTried.slice(0, 80)})`, "critical");
    return { allowed: false, locked: true, retryAfterSec: Math.ceil(LOCKOUT_MS / 1000) };
  }
  ctl.lockouts[ip] = lock;
  audit("auth.login.failed", "system", `IP ${ip} failed attempt ${lock.fails}/${MAX_FAILS} (tried: ${emailTried.slice(0, 80)})`, "warning");
  return { allowed: false, locked: false, remainingAttempts: MAX_FAILS - lock.fails };
}

/** Successful login clears the IP counter. */
export function clearFailures(ip: string): void {
  delete getStore().lockouts[ip];
}
