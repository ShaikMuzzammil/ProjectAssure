# ProjectAssure Host Control

> Master control plane for the ProjectAssure platform.
> SIH 2026 · SIH26103 · Team NEXGEN.
> The REAL bridge to the main app — nothing hardcoded, nothing faked.

## What it is

- Government control tower for the whole portfolio
- Mirrors every user, project, alert, event, email and login from the main app
- Real host actions: approvals, broadcasts, access/role control, automated emails
- Runs as its own Next.js app on port 3001 (deploy separately on Vercel)

## Quick start (dev)

```bash
cd host-control
bun install            # or npm install
cp .env.example .env.local
bun run dev            # next dev -p 3001
```

Then:

- main app → `http://localhost:3000` (log in — its browser pushes the snapshot)
- host control → `http://localhost:3001`
- login → `cpo@mospi.gov.in` / `hostoverseer` (env-configured)

No DATABASE_URL needed — state is an in-RAM singleton + `.host-store.json` (auto-saved, gitignored).

## How sync works

```
main app (browser, logged in)
  │  POST /api/sync/push        every 45s + on login + on actions
  ▼
main app sync hub (server)
  │  GET  /api/sync/state       ← host polls every 5s (server-side, no CORS)
  │  POST /api/sync/webhook     ← host broadcasts + user alerts
  ▼
host-control (this app)
  │  mirror → approvals → automated emails → UI (5s poll)
  │
  └  main-app browsers poll /api/sync/commands every 20s
     → broadcasts land as real notifications + toasts
```

- All main-app fetches happen SERVER-side (CORS never applies)
- Unreachable main → last mirror served, marked STALE (amber badge)
- First sync baselines existing records → only REAL new items become approvals
- Optional push mode: `POST /api/admin/sync` with `x-sync-token` (SYNC_TOKEN)

## Features

- Login → real creds + HMAC-signed httpOnly cookie + IP lockout (6 fails / 10 min) + audit
- Mission Dashboard → KPIs, health bands chart, at-risk list, live feed, sync card
- User Management → sortable/filterable grid + per-user drawer (profile / security / projects / alerts / activity) + actions
- User actions → restrict/restore access, role change, direct alert (webhook), direct email — each notifies the user for real
- Projects Control → full grid, ₹Cr budgets, overrun %, milestones, detail drawer, CSV export
- Approvals Centre → real derived items (new projects / new accounts / budget breaches) + decisions + owner notifications
- Alerts & Broadcast → mirrored alert feed + broadcast (all users) + direct user alerts
- Email Outbox → login / budget / welcome automation, provider chain (SMTP → Brevo → Resend), honest SIMULATED fallback, full log
- Audit Trail → append-only, searchable, every action
- Intelligence Console → AI chat grounded on the live mirror (Gemini → Groq → sandbox SDK → built-in engine)
- Integrations → URL config + test, env checklist, setup guide

## Env vars

See `.env.example` (all documented).

- `MAIN_PROJECT_URL` — main app URL (default `http://localhost:3000`)
- `SYNC_TOKEN` — optional shared webhook secret
- `HOST_ADMIN_EMAIL` / `HOST_ADMIN_PASSWORD` — login (change defaults!)
- `HOST_SESSION_SECRET` — optional cookie-signing secret
- `GEMINI_API_KEY`, `GROQ_API_KEY` — Intelligence providers
- `EMAIL_USER` + `EMAIL_PASS` (+ `SMTP_HOST`, `SMTP_PORT`) — SMTP email
- `BREVO_API_KEY`, `RESEND_API_KEY`, `ALERT_EMAIL_FROM` — HTTP email APIs

## Deploy to Vercel (separate project)

1. Push the repo (host-control folder included) to GitHub
2. Vercel → Add New Project → import the repo
3. Root Directory → `host-control`
4. Framework preset → Next.js (auto)
5. Env vars → add at least:
   - `MAIN_PROJECT_URL=https://<your-main-app>.vercel.app`
   - `HOST_ADMIN_EMAIL`, `HOST_ADMIN_PASSWORD` (strong)
   - optional: `SYNC_TOKEN`, email keys, AI keys
6. Deploy → login at `https://<host-control>.vercel.app`
7. Main app side → set the same `SYNC_TOKEN` if you use one

On Vercel:

- `.host-store.json` persistence is skipped (read-only FS) → in-memory per lambda
- approvals/audit/outbox reset on cold start; the mirror re-fills on first sync
- for durable state, point Prisma at a database (schema kept minimal on purpose)

## Security notes

- Change `HOST_ADMIN_PASSWORD` before any real deployment
- Session = HMAC-SHA256 signed httpOnly cookie, 8h TTL
- Every `/api/admin/*` route rejects without a valid session (401)
- 6 failed logins → 10-minute IP lockout (in-memory)
- `x-sync-token` shared secret protects host ↔ main webhook traffic
- Login attempts, decisions, broadcasts, emails — all audited
- No secrets in code; env-only
