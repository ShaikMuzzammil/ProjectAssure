# ProjectAssure — Deployment Guide (One Deployment · 100% Free Tier · Every API Key)

> **Goal:** deploy the whole platform as **one deployment at one web address** — every role signs in at the same link and lands on their tailored view. One Vercel project, one Neon PostgreSQL database, one email identity, at **₹0/month**. This guide covers every account, every API key, every environment variable and every click.

---

## 0. What you need before starting

| Item | Cost | Time |
|---|---|---|
| A GitHub account (code hosting + CI) | free | 2 min |
| A Vercel account (sign in with GitHub) | free (Hobby) | 2 min |
| A Google account (Gemini + Gmail SMTP) | free | 5 min |
| An email address for alerts (2FA enabled) | free | — |
| Terminal with Node 20+ / bun / npm | — | — |

**Total budget required: ₹0.** Everything below runs on free tiers with 4–16× headroom over the expected demo load.

---

## 1. Push the code to GitHub

```bash
cd ProjectAssure_SIH2026_Ultra/prototype
git init
git add -A
git commit -m "ProjectAssure ULTRA prototype"
# create an empty repo at github.com/new first (name: projectassure, private)
git remote add origin https://github.com/<your-username>/projectassure.git
git branch -M main
git push -u origin main
```

> Why GitHub first: Vercel imports from GitHub, and every later `git push` auto-deploys. You can also use `npx vercel` directly from this folder for a single-domain quick deploy.

---

## 2. Neon PostgreSQL (the database) — free API key #1

1. Go to **https://neon.com** → *Sign up with GitHub*.
2. Create a project: name `projectassure`, region `AWS ap-south-1 (Mumbai)` (lowest latency for Indian users).
3. Neon shows you a **connection string**. You need BOTH variants:
   - **Pooled** (for the running app): the URL that contains `-pooler` and port `6543` → this is `DATABASE_URL`
   - **Direct** (for migrations & seed): the same URL without `-pooler`, port `5432` → this is `DIRECT_URL`
   ```
   DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.ap-south-1.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"
   DIRECT_URL="postgresql://user:pass@ep-xxx.ap-south-1.aws.neon.tech/neondb?sslmode=require"
   ```
4. **Free tier:** 0.5 GB storage, ~190 compute-hours/month, scale-to-zero (first request after idleness takes ~1 s — pre-warm before demos, see §9).

### Create the tables

```bash
cd prototype
# switch to the production (PostgreSQL) schema — one-time:
cp prisma/schema.postgres.prisma prisma/schema.prisma

# point at Neon (temporarily export, or use .env for local):
export DATABASE_URL="postgresql://...-pooler...6543...&pgbouncer=true"
export DIRECT_URL="postgresql://...5432..."

bun install
bunx prisma generate          # build the client
bunx prisma migrate deploy --schema prisma/schema.prisma  # create 16 tables on Neon
bun prisma/seed.ts            # MoSPI org + 5 divisions + 6 personas + flagship project
```

Verify: `bunx prisma studio` opens a local browser for your Neon data (users table should show 6 personas).

> **Local SQLite vs production Postgres:** the repo ships `schema.prisma` set to SQLite so the sandbox/demo runs with zero setup. The ONLY difference in `schema.postgres.prisma` is the provider + enums as native Prisma enums; models are identical.

---

## 3. Vercel — deploy the platform (the only deployment)

1. **https://vercel.com** → *Add New… → Project* → import `projectassure`.
2. Framework auto-detects **Next.js**. Set:
   - **Root Directory** = `prototype` ← ⚠️ the single most important setting (the app lives in the `prototype/` folder of the repo)
   - Build command: `next build` (default) · Output: default
3. **Environment Variables** (Project → Settings → Environment Variables). Add these for *Production, Preview and Development*:

| Variable | Value | Required |
|---|---|---|
| `DATABASE_URL` | Neon **pooled** URL (from §2) | ✅ |
| `DIRECT_URL` | Neon **direct** URL (from §2) | ✅ (migrations/seed) |
| `NEXTAUTH_URL` | `https://<your-main-project>.vercel.app` | ✅ |
| `NEXTAUTH_SECRET` | run `openssl rand -base64 32` — **SAVE THIS** (session signing key) | ✅ |
| `NEXT_PUBLIC_PORTAL` | leave unset (single-deployment mode) | optional |
| `EMAIL_USER` | your SMTP login (Gmail address — see §5) | optional — enables real email |
| `EMAIL_PASS` | the 16-character Gmail App Password (see §5) | optional |
| `BREVO_API_KEY` | Brevo v3 API key (300 free sends/day) | optional — email provider #2 |
| `SMTP_HOST` / `SMTP_PORT` | override the SMTP endpoint (default gmail 465) | optional |
| `GEMINI_API_KEY` | Google AI Studio key (see §6) | optional — enables live-LLM chat |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Upstash keys (see §7) | optional |
| `BLOB_READ_WRITE_TOKEN` | added automatically when you create a Blob store | optional |
| `PINECONE_API_KEY` | Pinecone starter key (see §7) | optional |

4. Click **Deploy** → ~2 minutes → the platform is live at your one web address: `https://projectassure-xxxx.vercel.app`.
5. Verify: open `/api/health` — you should see `{"ok":true,"mode":"connected",...}`. Share this single link with every user; the app tailors the view to each role after sign-in.

> **Zero-key boot:** if you skip ALL optional keys, the app still runs 100% in simulation mode (deterministic 30-project world, outbox email, deterministic engine). Each key you add upgrades one subsystem.

---

## 4. One platform, one address — how the single deployment works

The platform no longer uses separate deployments for different audiences. **One deployment serves everyone:**

- Every user signs in at the **same URL** — the app checks the account's role (admin / project manager / stakeholder / viewer) and renders the matching workspace.
- Deep screens (analytics, comparisons, the AI workbench, monitoring suite) are **in-app views**, not separate sites — reached via the sidebar, in-screen links, ⌘K and project cards.
- The old multi-domain portal split remains supported via the optional `NEXT_PUBLIC_PORTAL` env var, but it is **not needed** and not recommended — one URL is simpler to share, audit and demo.

### 4.1 Custom domain (optional, free SSL)

Prefer your own domain? Vercel project → *Settings → Domains*:
- Apex `projectassure.in`: **A record** → `76.76.21.21`
- `www` or `app` sub-domain: **CNAME** → `cname.vercel-dns.com`
- Vercel issues free Let's Encrypt certificates automatically. Update `NEXTAUTH_URL` to the custom URL and redeploy.

---

## 5. Email — universal sending with 3 free providers + live diagnostics (free API key #2)

The Email Centre can send to **any address in the world**. The provider chain
(`POST /api/email/send`) tries, in order: **SMTP (any host) → Brevo API → Resend API →
honest outbox**. Configure ONE of the following.

### 5a. Gmail App Password (easiest, ~500 sends/day)

1. On the Gmail account you'll send from:
   - Enable **2-Step Verification** (myaccount.google.com → Security).
   - **Security → 2-Step Verification → App passwords** → create one named `ProjectAssure` → copy the **16-character password**.
2. In Vercel (all 3 projects) add:
   ```
   EMAIL_USER=youraddress@gmail.com
   EMAIL_PASS=abcdefghijklmnop        ← the 16 chars, spaces removed
   SMTP_HOST=smtp.gmail.com           (default — omit)
   SMTP_PORT=465                      (default; 587 = STARTTLS, auto-detected)
   ```
3. Redeploy → **Email Centre → Settings → Run diagnostics** — you should see
   **“SMTP login verified — real delivery is live”** (the diagnostics endpoint runs a
   real Nodemailer `verify()` against your credentials). Then **Send a test email**.
4. Notes: Gmail requires **From = the authenticated account** — the API enforces this
   automatically, so a wrong `ALERT_EMAIL_FROM` can no longer cause a 550 rejection.
   Failures surface in the outbox with the exact reason + a fix hint (never a silent mask).

### 5b. Brevo API (300 sends/day, no domain verification — best for sending to ANY recipient from day one)

```
BREVO_API_KEY=xkeysib-...
ALERT_EMAIL_FROM=sender@example.com   ← validate it in Brevo → Senders & IP
```

### 5c. Resend API (3,000/month — requires a verified domain to send to others)

```
RESEND_API_KEY=re_...
ALERT_EMAIL_FROM=sender@yourdomain.com
```
Until a domain is verified, Resend only delivers to your own account address —
the app warns about this honestly in the outbox (403 hint).

### 5d. Diagnostics & troubleshooting

- **GET `/api/email/status`** reports: active provider, SMTP host/port/from, whether
  keys are set, and a **live SMTP verify result**. The Email Centre's *Run diagnostics*
  button calls it.
- **Statuses are honest:** `SENT` (provider-confirmed), `FAILED` (provider rejected —
  reason + hint shown, e.g. "App Password rejected — generate a fresh one"), `SIMULATED`
  (no provider configured — full preview, never presented as sent).
- Port 465 uses implicit TLS, 587 uses STARTTLS — set `SMTP_PORT` if your relay differs;
  any SMTP host works (`SMTP_HOST=smtp-relay.brevo.com` etc.).
- Template catalogue: critical alerts, high alerts, weekly digest (Monday 08:00 IST),
  report deliveries, document-processed receipts, welcome.

> Without any key, every email is still composed, stored and previewable in the outbox — the demo story stays complete, and nothing pretends to be sent.

---

## 6. Live intelligence — the provider chain (free key #3)

The assistant uses a **five-slot provider chain**. The first working slot serves
every answer; if it ever fails mid-demo the next slot (and finally the built-in
engine) takes over — the demo cannot break:

| Slot | Key | Free tier | Get the key |
|---|---|---|---|
| 1 · **primary** | `GEMINI_API_KEY` (alias `GOOGLE_API_KEY`) | yes — ~15 req/min, 1,500/day | https://aistudio.google.com/apikey |
| 2 · secondary | `GROQ_API_KEY` | yes — generous free tier, very fast | https://console.groq.com/keys |
| 3 · community | `OPENROUTER_API_KEY` | yes — free community models | https://openrouter.ai/settings/keys |
| 4 · standard | `OPENAI_API_KEY` | paid | https://platform.openai.com/api-keys |
| 5 · built-in | *(none — automatic)* | always available | — |

**Setup (recommended: just slot 1):**

1. Go to **https://aistudio.google.com/apikey** → *Create API key* (free) → copy the `AIza...` value.
2. Add it in Vercel → Settings → Environment Variables:
   ```
   GEMINI_API_KEY=AIza...
   ```
   (locally: the same line in `.env` — see `.env.example` at the repo root).
3. Redeploy — done. Open **Assure Intelligence**: the header shows
   **“Live intelligence mode · connected”** and the side panel shows a green
   **LIVE** chip; live mode switches itself on automatically the first time.
4. Inside slot 1 the model chain also falls back automatically
   (2.0-flash → 2.5-flash → flash-latest → 1.5-flash-8b), so a model
   deprecation can never break a demo.

**How answers stay short and grounded (v11):** when you ask from inside a
project, the question travels with a **full project dossier** — every uploaded
document's real text, the live risk register, milestones, budget position,
delay-prediction factors, KPIs, open alerts, **pending change orders awaiting
approval**, and the engine's own ranked recommended actions. The system prompt
forces one answer shape: **answer first (bold) → at most 4 evidence bullets
with real numbers → one action (owner + deadline)**. Approval questions end
with an explicit *approve / approve with conditions / hold for evidence*
recommendation plus the single missing item that would settle it. A hard
length guard trims anything past ~130 words. `/api/ai/status` (a free
models-list ping, cached 90 s) powers the connection chip — the UI never
reveals provider names.

**Zero-key behaviour:** with no keys at all, the built-in deterministic engine
answers the same questions with tool traces and citations — jury-safe, fully
offline.

**GitHub → Vercel (the clean path):**

1. The repo carries **only the deployable app** (`src/`, `prisma/`, `public/`,
   configs, `package.json`, `.npmrc`, `README.md`, `.env.example`) — old
   versions, analysis copies and deliverables are git-ignored, so nothing
   stale is ever pushed. Verify with `git status` before committing.
2. Push, then import at **vercel.com/new** — Next.js is auto-detected; no
   settings needed (`postinstall` runs `prisma generate` automatically).
3. Vercel → Settings → Environment Variables → add `GEMINI_API_KEY` (and any
   optional keys) → Redeploy. Local pre-check: `npm run build && npm start`.

> **v12 build fixes (already applied in this zip — re-copy these files if you
> are updating an older repo):** the earlier Vercel failure
> (`ERESOLVE: peerOptional nodemailer@^7.0.7 from next-auth vs nodemailer@^9`)
> is fixed by (a) **removing `next-auth`** — a template leftover never imported
> in `src/`, (b) pinning **`nodemailer@^7.0.13`** (+ `@types/nodemailer@^7`),
> (c) shipping a root **`.npmrc` with `legacy-peer-deps=true`**, and (d) a
> **Vercel-aware `build` script** that runs plain `next build` on Vercel and
> only assembles the standalone bundle locally. Verified with a full clean
> `npm install` + `VERCEL=1 npm run build` before packaging. No `vercel.json`
> is needed.

---

## 6.5 User accounts & per-user data (Neon PostgreSQL)

Registration, login and per-user project isolation are **real** in this build:

- **Sign-up** (`/login` → *Create account* tab): full name, email, password (8+ chars with letter + number), account type (Project Manager / Stakeholder / Observer — ADMIN is never self-assignable), department, phone. The password policy and a live strength meter are enforced client-side.
- **Password security — double-hash architecture:**
  - *Client*: PBKDF2-SHA256, 100,000 iterations, 128-bit random salt, via Web Crypto (`src/lib/projectassure/auth-crypto.ts`). Stored in the persisted local store as `pbkdf2$sha256$100000$salt$digest` — **plaintext is never persisted**.
  - *Server mirror*: `POST /api/auth/register` re-hashes with **scrypt** (N=16384, r=8, p=1, 64-byte) and writes the `User` row to Neon PostgreSQL (department resolved by code, audit-logged). The plaintext password is used once to derive hashes and then discarded.
- **Sign-in**: registered accounts verify the PBKDF2 digest locally; demo personas use the prefilled directory. `/api/auth/login` does the same scrypt verification against Neon for API/SSO flows.
- **Per-user data**: every project created through the 6-step wizard carries `ownerId` (the account id). RBAC scoping always includes ownership — your projects, documents, reports and exports stay in your workspace; ADMIN sees everything. Fresh accounts with zero projects get a guided getting-started state on the Command Centre.
- **Admin visibility**: Administration → Users shows a `registered`/`demo` badge and the hash scheme per account.

**To verify after deploy:** register a fresh account → it appears in Neon's `User` table (check via Neon SQL editor: `SELECT email, role, "passwordHash" IS NOT NULL AS hashed FROM "User";`) → sign out → sign back in with the password.

---

## 7. Optional subsystems (all free)

| Service | Where | Free limit | Expected use | Env vars |
|---|---|---|---|---|
| **Upstash Redis** | upstash.com | 10,000 cmds/day · 256 MB | cache, rate limits, jti revocation | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| **Vercel Blob** | Vercel → Storage → Blob | ~1 GB stored | report/document storage | `BLOB_READ_WRITE_TOKEN` (auto) |
| **Pinecone** | pinecone.io (Starter) | 1 index · ~100K vectors | production RAG (namespace per ministry) | `PINECONE_API_KEY`, `PINECONE_INDEX_HOST` |
| **GitHub Actions** | included | 2,000 min/mo | CI (lint + typecheck + build) | included |

None are required for the demo; the in-browser equivalents (deterministic ML engine, hashing-embedding vector store, localStorage persistence, live event engine) cover all jury-visible behaviour.

---

## 8. Post-deploy checklist (10 minutes)

- [ ] `https://<domain>/api/health` returns `{"ok":true}` and `mode: "connected"` (with DB) or `"simulation"`
- [ ] Landing page renders with hero stats; *Create your free account* opens login
- [ ] **Register a fresh account** (Create account tab) → auto-login → account row visible in Neon `User` table
- [ ] **Sign out → sign back in** with the registered password (PBKDF2 verified); wrong password shows a real error
- [ ] **Create a project** with the 6-step wizard (name, timeline, budget, team, **upload a TXT/CSV file**) → document ingested, analytics auto-update
- [ ] Project detail → **PDF / Excel** download + **Email report** → outbox shows the delivery with attachment
- [ ] Sign-in as Portfolio Overseer works; sidebar shows 11 sections (role-adaptive)
- [ ] Command Centre shows **30 projects · 26/3/1 · ₹8,937 Cr** (deterministic story)
- [ ] Open Bharatmala detail → **75% delay probability, 44-day slip, CI 24–64**
- [ ] Assure Intelligence answers *“Why is Bharatmala P-4 at risk?”* with tool traces + citations (Gemini when `GEMINI_API_KEY` set)
- [ ] Reports → ingest the sample PDF → pipeline completes → vault updated
- [ ] Report Builder → PDF downloads (branded, multi-section)
- [ ] Email Centre → Send a test email → SENT (with keys) or SIMULATED outbox preview (without)
- [ ] Alerts → *Simulate critical slip* → real alert + notification + email chain
- [ ] Administration → Users shows your registered account with a `registered` badge
- [ ] Administration → thresholds drag → donut preview updates instantly
- [ ] Domain switcher navigates main ↔ analytics ↔ ai
- [ ] Dark mode toggle works on every screen
- [ ] Audit trail records your entire session (REGISTER, LOGIN, CREATE, UPLOAD, EXPORT, EMAIL_SEND, …)

---

## 9. Operational workflows (the 12 documented in reference-md/08, condensed)

1. **Daily redeploy** — `git push` → only the changed app rebuilds → atomic cutover, zero downtime.
2. **Preview deployments** — every PR gets a URL; point `DIRECT_URL` at a Neon branch for quarantine.
3. **Migrations** — edit `schema.postgres.prisma` → `prisma migrate dev` against a Neon branch → PR preview → `prisma migrate deploy` with `DIRECT_URL` on production → **migrate first, deploy second**.
4. **Rollback** — Vercel → Deployments → previous green → *Promote to Production* (instant).
5. **Backup** — Neon PITR (restore-to-point creates a branch; repoint env vars + redeploy); nightly `pg_dump` optional GitHub Action.
6. **Pre-warm before a demo** — Neon scales to zero; `curl https://<domain>/api/health` 2 minutes before judging.
7. **Monitoring ladder** — symptom → Vercel deployments → function logs → Neon console → Upstash/Pinecone quota → AI provider dashboard.

**Common failures:**

| Symptom | Cause | Fix |
|---|---|---|
| SSO breaks across domains | `NEXTAUTH_SECRET` differs | set the identical secret in all 3 projects |
| Prisma: `P1001 / can't reach` | pooled/direct URLs swapped or SSL missing | `DATABASE_URL` = pooler:6543 + `&pgbouncer=true`; `DIRECT_URL` = :5432 |
| First page load slow | Neon cold start | pre-warm with a health check; expected ~1 s |
| Emails land as SIMULATED | no provider configured | add EMAIL_USER/PASS, BREVO_API_KEY or RESEND_API_KEY (§5) — Run diagnostics confirms |
| Emails land as FAILED | provider rejected the send | read the reason + hint in the outbox (wrong App Password / unverified sender / wrong port) — diagnostics shows the raw error |
| intelligence answers stay deterministic | no `GEMINI_API_KEY`, or Live-LLM toggle off | add key + toggle in Assure Intelligence header |
| 500 on `/api/*` | missing Root Directory setting | Root Directory must be `prototype` |

---

## 10. Cost summary

| Service | Free limit | Expected use | Headroom |
|---|---|---|---|
| Vercel Hobby (1 deployment) | 100 GB bandwidth/mo | ~10 GB | ~8× |
| Neon | 0.5 GB · 190 compute-hrs | ~120 MB · ~30 hrs | ~4–6× |
| Gmail SMTP | 500 recipients/day | ~30 | ~16× |
| Brevo API (alt) | 300 recipients/day | ~30 | ~10× |
| Gemini | 1,500 req/day | ~250 peak | ~6× |
| Upstash | 10,000 cmds/day | ~2,500 | ~4× |
| Vercel Blob | ~1 GB | ~250 MB | ~4× |
| Pinecone Starter | ~100K vectors | ~20K | ~5× |
| GitHub + Actions | 2,000 min/mo | ~150 | ~13× |
| **Total** | | | **₹0 / month** |

---

## 11. Scaling past the free tier (when MoSPI adopts it)

Vercel Pro ($20/mo/domain) → Neon Scale → Upstash PAYG → ML microservice (FastAPI + XGBoost + Prophet) on Railway/Fly/Cloud Run → Socket.io gateway with Redis adapter → Pinecone Standard. The monorepo layout, 16-model schema and 85-endpoint API contract in `reference-md/` are designed for exactly this transition with no rewrites.

---

## v9 note

The deployed platform tells the same story as this guide: **one web address**,
universal terminology in the interface (the assistant is "Assure Intelligence"),
and the identity band reads *Smart India Hackathon 2026 · SIH26103 · Team NEXGEN*.
All env-var names below are unchanged — only their user-facing descriptions were
universalised. Workflow-level deployment steps: `docs/workflows/15-deploy-one-web-address.md`.
