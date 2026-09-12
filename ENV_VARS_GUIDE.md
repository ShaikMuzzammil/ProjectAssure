# ProjectAssure — Environment Variables Guide (v23.2)

> **Your current Vercel setup** (from your screenshots):
> - **Main app** (`projectassure`): 18 env vars set ✅
> - **Host Control** (`project-assure-host`): 12 env vars set ✅
>
> Both projects are fully configured for the original v22 features. This guide
> shows what to ADD for the v23 features (forgot password, reject-with-action,
> honest AI probe, Settings panel, account persistence).

---

## Quick checklist — what to add

### Main app (`projectassure`) — add 2 new env vars

| Variable | Value | Why |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://project-assure.vercel.app` | v23 forgot-password — the reset link in the email uses this. Falls back to `NEXTAUTH_URL` (which you have), but setting it explicitly is recommended. |
| `NEXT_PUBLIC_HOST_URL` | `https://project-assure-host.vercel.app` | v23 landing page — the "Host Control" footer button + dropdown deep-links use this. Falls back to the hardcoded URL if unset. |
| `SYNC_TOKEN` | `<any random string>` | Optional — shared secret between main and host. When set on BOTH, webhook posts require the `x-sync-token` header. |

### Host Control (`project-assure-host`) — add 1 optional env var

| Variable | Value | Why |
|---|---|---|
| `SYNC_TOKEN` | `<same random string as main app>` | Optional — must match the main app's `SYNC_TOKEN` if both are set. |
| `HOST_SESSION_SECRET` | `<random 16+ char string>` | Optional — session cookie signing. When unset, derived from `HOST_ADMIN_PASSWORD`. |
| `GROQ_API_KEY` | `<free key from console.groq.com>` | Optional — second AI provider. The Intelligence Console badge shows "live" when any provider answers the probe. |

---

## Full env var reference

### Main app (`projectassure`) — 18 vars you have + 3 new

#### ✅ Already set (keep as-is)

| Variable | Purpose |
|---|---|
| `HOST_ADMIN_EMAIL` | Host admin login email (shared with host-control) |
| `HOST_ADMIN_PASSWORD` | Host admin login password (shared with host-control) |
| `DATABASE_URL` | Postgres connection — **REQUIRED for cross-device account persistence** |
| `DIRECT_URL` | Direct Postgres connection for Prisma migrate/db push |
| `NEXTAUTH_URL` | Public URL of this deployment |
| `NEXTAUTH_SECRET` | Session HMAC secret |
| `EMAIL_USER` | SMTP username (Gmail App Password) |
| `EMAIL_PASS` | SMTP password |
| `SMTP_HOST` | SMTP server (default: smtp.gmail.com) |
| `SMTP_PORT` | SMTP port (465 = implicit TLS, 587 = STARTTLS) |
| `GEMINI_API_KEY` | Google AI Studio key — first AI provider |
| `BREVO_API_KEY` | Brevo HTTP API key — email provider |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis (optional — caching) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token |
| `PINECONE_API_KEY` | Pinecone vector DB (optional — RAG) |
| `BLOB_WEBHOOK_PUBLIC_KEY` | Vercel Blob webhook key (optional) |
| `BLOB_STORE_ID` | Vercel Blob store ID (optional) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token (optional) |

#### ➕ New — add these for v23 features

```
# v23 — forgot-password reset link (falls back to NEXTAUTH_URL if unset)
NEXT_PUBLIC_APP_URL=https://project-assure.vercel.app

# v23 — landing page Host Control button URL (falls back to hardcoded URL if unset)
NEXT_PUBLIC_HOST_URL=https://project-assure-host.vercel.app

# v23 — optional shared secret for host→main webhooks
SYNC_TOKEN=<any random string>
```

#### After setting env vars, run ONCE:

```bash
# Creates all tables including the v23 PasswordResetToken table
npx prisma db push
```

This is the critical step. Without it, the `User` table may exist (from the
original schema) but the `PasswordResetToken` table is new and won't exist
until you push. Sign-up will show "Database error: ... relation does not exist"
until this is run.

---

### Host Control (`project-assure-host`) — 12 vars you have + 2 optional

#### ✅ Already set (keep as-is)

| Variable | Purpose |
|---|---|
| `HOST_ADMIN_EMAIL` | Host admin login email |
| `HOST_ADMIN_PASSWORD` | Host admin login password |
| `GEMINI_API_KEY` | Google AI Studio key — first AI provider |
| `OPENROUTER_API_KEY` | OpenRouter key — community models |
| `EMAIL_USER` | SMTP username |
| `EMAIL_PASS` | SMTP password |
| `SMTP_HOST` | SMTP server |
| `SMTP_PORT` | SMTP port |
| `BREVO_API_KEY` | Brevo HTTP API key |
| `RESEND_API_KEY` | Resend HTTP API key |
| `ALERT_EMAIL_FROM` | Verified sender for Brevo/Resend |
| `MAIN_PROJECT_URL` | Main app URL — where the host polls for sync |

#### ➕ Optional — add for enhanced security + AI

```
# Optional — shared secret (must match the main app's SYNC_TOKEN)
SYNC_TOKEN=<same random string as main app>

# Optional — session cookie signing (when unset, derived from HOST_ADMIN_PASSWORD)
HOST_SESSION_SECRET=<random 16+ char string>

# Optional — second AI provider for the Intelligence Console
GROQ_API_KEY=<free key from console.groq.com>
```

---

## Why accounts weren't persisting (and the fix)

**Root cause:** The v23 bug replaced the local PBKDF2 password hash with a
`server::scrypt` sentinel after the server mirror succeeded. This broke local
login when the server was in simulation mode (no `DATABASE_URL`) — the local
store only had the sentinel, local verify returned false, and login failed.

**The v23.2 fix:**

1. **signUp keeps the local PBKDF2 hash.** The server mirror is a bonus,
   not a replacement. Both hashes are derived from the same password.

2. **Login tries local PBKDF2 FIRST.** If local verify succeeds → login
   (no server round-trip). If local fails → server fallback. On success,
   the user is merged into the local store.

3. **Boot fetches users from the DB.** `syncUsersFromServer()` calls
   `/api/users-list` on boot and merges any users we don't have. This
   makes registered accounts visible in a fresh browser, after a cache
   clear, or on a different device.

4. **Store migration from v13.** If you had accounts in the previous
   store (`projectassure-store-v13`), the new `onRehydrateStorage`
   migration reads the old store and restores any users with valid
   PBKDF2 hashes.

5. **Simulation-mode banner.** The login page shows an amber banner
   when `DATABASE_URL` is not set — so you know accounts are per-browser.

**Your situation:** You have `DATABASE_URL` set ✅. After deploying this
zip + running `npx prisma db push`, accounts WILL persist across devices
and cache clears. The `syncUsersFromServer` boot function will pull them
from the DB on every browser load.

---

## Deploy steps (after importing the new zip)

1. **Push to GitHub** — the new zip's contents.
2. **Vercel rebuilds both projects automatically.**
3. **Add the new env vars** on the main app:
   - `NEXT_PUBLIC_APP_URL` = `https://project-assure.vercel.app`
   - `NEXT_PUBLIC_HOST_URL` = `https://project-assure-host.vercel.app`
4. **Run `npx prisma db push`** on the main app (creates the
   `PasswordResetToken` table):
   ```bash
   # From the main app's root directory
   npx prisma db push
   ```
   Or use the Vercel CLI:
   ```bash
   vercel env pull .env
   npx prisma db push
   vercel env rm .env  # cleanup
   ```
5. **Redeploy** the main app so the env vars take effect.
6. **Test:** Sign up → close browser → reopen → sign in with the same
   email/password → it works. The account was pulled from the DB by
   `syncUsersFromServer` on boot.
