# ProjectAssure — Main App (v21)

Intelligence-powered predictive project monitoring platform
Smart India Hackathon 2026 · SIH26103 · Team NEXGEN

---

## What this app does (in 5 lines)

- Reads monthly project reports (PDF / Excel / scans) automatically
- Scores every project 0–100 with 18 live signals
- Predicts delays 30–60 days early (real ML, real held-out metrics)
- Sends alerts + emails with an action, owner and deadline
- Gives citizens a public spending page — no login needed

---

## Quick start

```bash
cd prototype
npm install --legacy-peer-deps
npm run dev
```

Open → http://localhost:3000

No API keys? Everything still works offline (built-in engine + demo world).
Add keys later → subsystems switch to live mode automatically.

---

## Logins

| Who | Email | Password | Route |
|---|---|---|---|
| Portfolio Overseer (ADMIN) | arun.kulkarni@mospi.gov.in | overseer | #/demo |
| Project Manager | priya.venkatesh@mospi.gov.in | minister | #/demo |
| Data Analyst | sneha.iyer@mospi.gov.in | analyst | #/demo |
| Strategic Observer | meera.nair@pmo.gov.in | observer | #/demo |
| New users | your own email | your own password | #/login → Create account |

- Demo personas → #/demo (one click, separate route)
- Fresh accounts → #/login → Create new account
- Notifications are private per user — demo traffic and real users never mix

---

## Routes (hash-based)

```
#/                 → landing page
#/about            → about the team
#/demo             → 4 demo personas (one-click entry)
#/login            → sign in / create account
#/public           → citizen transparency page (no login)
#/app/monitor      → dashboard (after login)
#/app/projects     → projects + map + create
#/app/ai-assistant → Assure Intelligence (chat + file upload)
#/app/model-lab    → Prediction Engine (ML Lab)
#/app/reports      → report factory + document pipeline
#/app/alerts       → early warning centre + broadcast
#/app/email-center → outbox + settings
#/app/project-detail/<id>/<tab>  → one project (10 tabs + Site Evidence)
```

---

## How the data flows (the honest map)

```
Browser (this app)
  │
  ├── your projects, users, notifications
  │   └─ stored in browser localStorage (per user)
  │
  ├── every change → POST /api/sync/push      (same origin, always works)
  │                   └─ Sync Hub keeps the live mirror
  │
  ├── Host Control reads → GET /api/sync/state   (server-to-server)
  │
  ├── Host Control sends → POST /api/sync/webhook (broadcasts / user alerts)
  │
  └── logged-in browsers poll → GET /api/sync/commands (every 20s)
       └─ host broadcasts appear as real notifications
```

---

## Prediction Engine (ML Lab) — what is real

```
1. Data        → 18 signals + honest labels from milestone history
2. Split       → 70/30 (test set = real projects only)
3. Train       → logistic regression OR boosted stumps (in-browser)
4. Evaluate    → real AUC / accuracy / F1 / confusion / calibration
5. Promote     → champion re-scores every live prediction
6. Simulate    → 5,000-run Monte Carlo (P50/P80/P95 + tornado)
7. Forecast    → Holt damped trend + confidence bands
8. Drift       → PSI per feature vs the seeded anchor
```

Every metric shown is computed on held-out data. Nothing is hardcoded.

---

## Geo-tagged site evidence

```
Photo upload → EXIF GPS + timestamp parsed in-browser
            → haversine distance to project site
            → VERIFIED (≤2 km) / NEAR_SITE (≤10 km) / GPS_MISMATCH / STALE
            → PM or ADMIN accepts / rejects (audit-logged)
```

No camera GPS? Capture a live browser location first (button in the panel).

---

## AI (Assure Intelligence)

```
Chat question + attached files
  → /api/ai/files      (PDF / XLSX / images parsed for real)
  → /api/ai/chat       (Gemini → Groq → OpenRouter → OpenAI → z-ai sandbox)
  → answer with sources + freshness stamp
  → no provider? built-in deterministic engine answers offline
```

- Project mode = grounded on your live portfolio
- Universal mode = general questions + uploaded files as context
- Both work. Files persist across reloads. Threads are switchable.

---

## Email (real delivery)

```
/api/email/send tries in order:
  1. SMTP  (EMAIL_USER + EMAIL_PASS, Gmail App Password works)
  2. Brevo (BREVO_API_KEY — 300 mails/day free)
  3. Resend (RESEND_API_KEY)
  4. Outbox (honest SIMULATED + how-to hint)
```

Report emails carry the REAL generated PDF as an attachment.

---

## Environment variables (all optional)

```
GEMINI_API_KEY=        # live AI answers
GROQ_API_KEY=          # backup AI
OPENROUTER_API_KEY=    # backup AI
OPENAI_API_KEY=        # backup AI
DATABASE_URL=          # optional Postgres mirror (Prisma)
EMAIL_USER=            # SMTP login
EMAIL_PASS=            # SMTP app password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
BREVO_API_KEY=         # email provider 2
RESEND_API_KEY=        # email provider 3
SYNC_TOKEN=            # shared secret with Host Control (optional)
HOST_ORIGIN=           # host-control origin for CORS (optional)
```

See `.env.example`.

---

## Deploy to Vercel (from GitHub)

```
1. Push this folder to GitHub           (repo root = this folder or set Root Directory = prototype)
2. vercel.com → Add New → Project       → import the repo
3. Root Directory: prototype
4. Framework: Next.js (auto)
5. Environment Variables: paste the keys you have (all optional)
6. Deploy
```

- Build: `next build` (auto)
- Zero keys = zero cost, still fully working
- After deploy: set MAIN_PROJECT_URL in Host Control to this URL

---

## Scripts

```bash
npm run dev        # local dev on :3000
npm run build      # production build
npm run start      # run the production build
npm run db:push    # apply Prisma schema (needs DATABASE_URL)
npm run lint       # eslint
```

---

## Tech stack (short)

Next.js 16 · React 19 · TypeScript · Tailwind 4 · Zustand (persist)
Recharts · jsPDF · SheetJS · Nodemailer · Prisma · z-ai-web-dev-sdk
ML: hand-written logistic regression + boosted stumps + Monte Carlo + Holt + PSI

---

ProjectAssure · SIH 2026 · SIH26103 · Team NEXGEN · Amrita Vishwa Vidyapeetham Chennai
