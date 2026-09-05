"use client";
// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — Client-side password security (real hashing, no plaintext).
// Registered accounts never store a readable password. We derive a PBKDF2
// digest with Web Crypto (SHA-256, 100,000 iterations, 128-bit random salt).
// The server mirror (/api/auth/register) uses scrypt on the same secret, so
// simulation mode (browser) and connected mode (secure cloud database) both verify
// without ever exchanging the raw password again after sign-up.
// ═══════════════════════════════════════════════════════════════════════════

const ITERATIONS = 100_000;
const KEY_LEN = 32; // 256-bit derived key
const PREFIX = "pbkdf2$sha256$";

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function subtle(): SubtleCrypto {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("WebCrypto unavailable");
  }
  return window.crypto.subtle;
}

/** Derive a storable hash string: pbkdf2$sha256$<iterations>$<salt>$<digest> */
export async function hashPassword(password: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const key = await subtle().importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle().deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    key,
    KEY_LEN * 8,
  );
  return `${PREFIX}${ITERATIONS}$${toHex(salt.buffer as ArrayBuffer)}$${toHex(bits)}`;
}

/** Constant-time-ish comparison of two hex digests (length check first). */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verify a password against a stored pbkdf2$sha256$...$...$... string. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 5 || parts[0] !== "pbkdf2" || parts[1] !== "sha256") return false;
    const iterations = parseInt(parts[2], 10);
    const salt = parts[3];
    const digest = parts[4];
    const saltBytes = new Uint8Array(salt.match(/.{2}/g)!.map(h => parseInt(h, 16)));
    const enc = new TextEncoder();
    const key = await subtle().importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await subtle().deriveBits(
      { name: "PBKDF2", salt: saltBytes as unknown as BufferSource, iterations, hash: "SHA-256" },
      key,
      KEY_LEN * 8,
    );
    return safeEqualHex(toHex(bits), digest);
  } catch {
    return false;
  }
}

/** Password policy enforced identically on the sign-up form and the store. */
export function passwordIssues(pw: string): string[] {
  const issues: string[] = [];
  if (pw.length < 8) issues.push("at least 8 characters");
  if (!/[A-Za-z]/.test(pw)) issues.push("one letter");
  if (!/[0-9]/.test(pw)) issues.push("one number");
  return issues;
}

export function passwordStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong", "Excellent"];
  return { score, label: labels[score] };
}
