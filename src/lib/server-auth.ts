// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — server-side session tokens for the user-state API.
// Stateless HMAC tokens: base64url(payload).signature
// The secret is AUTH_SECRET when set, otherwise derived from DATABASE_URL so
// the whole flow works with zero extra configuration on Vercel.
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac, timingSafeEqual } from "crypto";

const DAY_MS = 30 * 24 * 60 * 60 * 1000; // 30-day state tokens

function secret(): string {
  const raw = process.env.AUTH_SECRET || process.env.DATABASE_URL || "projectassure-dev-secret";
  return createHmac("sha256", "pa-key-derivation").update(raw).digest("hex");
}

export interface TokenPayload {
  userId: string;
  email: string;
  exp: number;
}

function b64url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64url");
}

export function createStateToken(userId: string, email: string): string {
  const payload: TokenPayload = { userId, email, exp: Date.now() + DAY_MS };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyStateToken(token: string | null | undefined): TokenPayload | null {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const expected = Buffer.from(createHmac("sha256", secret()).update(body).digest("base64url"));
    const got = Buffer.from(sig);
    if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as TokenPayload;
    if (!payload.userId || !payload.email || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** True when a database is configured (postgres or sqlite file) and usable. */
export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
