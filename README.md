# ProjectAssure

**Smart India Hackathon 2026 · Problem SIH26103 · Team NEXGEN — Amrita Vishwa Vidyapeetham, Chennai**

ProjectAssure is an intelligence cockpit for infrastructure projects: it predicts delays 30–60 days early, reads field documents itself, verifies site evidence with GPS, and routes every approval through a real-time control tower.

---

## Two apps in this repo

| App | Folder | Deploy as | Purpose |
|---|---|---|---|
| **Main app** | repo root (`src/`) | Vercel project #1 → e.g. `project-assure.vercel.app` | The user workspace: dashboard, projects, documents, geo-audit, predictions, reports, intelligence chat |
| **Host Control** | `host-control/` | Vercel project #2 (root dir = `host-control/`) → e.g. `project-assure-host.vercel.app` | The administrator control tower: approvals, users, broadcasts, email outbox, audit, intelligence |

They talk over HTTP: the host polls `{MAIN}/api/sync/state` every 5 s (server-to-server), and decisions/broadcasts flow back as commands that appear in users' apps within seconds.

---

## Quick start (local)

```bash
# 1 · Main app (port 3000)
npm install
npm run dev                  # → http://localhost:3000

# 2 · Host Control (port 3001)
cd host-control
npm install
npm run dev                  # → http://localhost:3001
```

No environment variables needed for a first run — everything degrades gracefully:
- no `DATABASE_URL` → each user's workspace persists privately in their browser
- no email keys → emails are honestly logged as `SIMULATED` in the outbox
- no AI keys → the built-in deterministic engine answers, grounded on live data

**Demo access**: the login page has a clean universal sign-in; use *Explore the guided demo* for one-click demo personas (a curated 5-project portfolio). New accounts start with an empty, private workspace.

---

## The v23 upgrade (what changed)

1. **Database works universally, per user.** The Prisma schema is auto-selected from `DATABASE_URL` (Postgres or SQLite) at install time — no file copying. Register/login are database-backed (scrypt hashes), and every registered user's **entire workspace** (projects, notifications, evidence, reports) is stored in an isolated per-user cloud record, hydrated on any device.
2. **Demo and real users never mix.** Demo personas get a curated 5-project world; new accounts start clean (welcome + explore notifications only) and see only what they create.
3. **Real-time approvals, both directions.** Creating a project, uploading documents, submitting site evidence or asking the AI for approval raises a live request in Host Control's Approvals Centre (≤5 s). Host decisions flow back as project-state updates + notifications (≤8 s).
4. **Email attachments are real.** Report emails now build the actual PDF and attach it (SMTP / Brevo / Resend all carry attachments). The host outbox composer accepts file attachments too.
5. **Risk management is input-driven.** The create-project wizard shows a **live risk preview** that reacts to every field — missing or unrealistic entries raise risk; complete plans lower it; staged documents are scanned for risk language before the project even exists.
6. **Cleaner UI.** Login page is universal (no persona cards / exposed passwords), the sidebar has no AI promo card, the live portfolio feed is a toggle (off by default), dashboard KPI cards all land on sidebar pages, the geo-audit is a per-project side-by-side workspace with full-size preview + download + CSV export, the India map flies into the project location on click, and the prediction engine is three focused tabs (how it works / predict / train).
7. **No credential exposure.** No env-var names, API-key names or default credentials are shown in any UI. Intelligence status is aggregate-only ("live" / "built-in").
8. **Sync survives cold starts.** With `DATABASE_URL` set, the sync hub (main) and the host store (approvals/audit/outbox) persist to the database instead of per-instance memory.

---

## Configuration (all optional)

| Variable | App | Effect |
|---|---|---|
| `DATABASE_URL` | both | Postgres (e.g. Neon) → per-user cloud persistence + approvals/audit/outbox survive restarts. Schema is picked automatically. |
| `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY` / `OPENAI_API_KEY` | both | Live intelligence answers (first working one serves). Never named in the UI. |
| `EMAIL_USER` + `EMAIL_PASS` (SMTP), `BREVO_API_KEY`, `RESEND_API_KEY` | both | Real email delivery with attachments. |
| `HOST_ADMIN_EMAIL`, `HOST_ADMIN_PASSWORD` | host | Host portal login. |
| `MAIN_PROJECT_URL` | host | The main app URL the host polls (set it to your Vercel domain). |
| `SYNC_TOKEN` | both | Optional shared secret for main ↔ host traffic. |
| `AUTH_SECRET` | main | Optional signing secret for user-state tokens (derived from `DATABASE_URL` if unset). |

Full template: [`.env.example`](.env.example) · Host: [`host-control/.env.example`](host-control/.env.example)

---

## Deploying to Vercel

**Project #1 — main app**
1. Import this repo; framework preset **Next.js**; root directory = repo root.
2. (Optional but recommended) add `DATABASE_URL` from [neon.tech](https://neon.tech) (pooled connection string).
3. Deploy. First deploy creates all tables automatically (`prisma db push` runs via `postinstall` → schema auto-pick; for a fresh database run `npm run db:push` once locally against it if you prefer manual control).

**Project #2 — host control**
1. Import the same repo; root directory = `host-control/`.
2. Set `MAIN_PROJECT_URL` = your main app URL, plus `HOST_ADMIN_EMAIL` / `HOST_ADMIN_PASSWORD`.
3. (Optional) the same `DATABASE_URL` so approvals/audit/outbox persist across cold starts.

Notes:
- `.npmrc` with `legacy-peer-deps=true` ships in both folders — the React 19 / react-leaflet peer combination requires it.
- Demo logins only work on the main app; host login is env-configured only.

---

## Architecture in one screen

```
 users (browser, main app)
   │  workspace mutations → per-user cloud record (UserState) + sync push
   ▼
 main app (Next.js, Vercel #1)
   │  POST /api/sync/push (snapshots + approval requests)
   │  GET  /api/sync/state   ← host polls every 5s
   │  POST /api/sync/webhook ← host decisions (approve/reject/broadcast)
   │  GET  /api/sync/commands ← browsers poll every 8s
   ▼
 host-control (Next.js, Vercel #2)
   │  mirror → approvals (project / account / budget / document / evidence / AI)
   │  decisions → commands back to users + automated emails
   └  broadcast → every connected user
```

Per-user isolation: the main app store swaps to the active user's workspace at login; the sync hub keeps a merged directory so Host Control still sees the whole portfolio.

---

## Scripts

| Command (main / host) | What it does |
|---|---|
| `npm run dev` | Dev server (3000 / 3001) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run db:push` | Create/update database tables (schema auto-picked from `DATABASE_URL`) |
| `npm run lint` | ESLint |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Users report "nothing is saved" | `DATABASE_URL` not set on that deployment → workspaces persist in-browser only. Add it in Vercel → Settings → Environment Variables and redeploy. |
| Host shows "main app unreachable" | Set `MAIN_PROJECT_URL` to the main app URL (or paste it in Host → Integrations). If `SYNC_TOKEN` is set on the main app, set the same value on the host. |
| Emails say `SIMULATED` | No email provider configured — add one of SMTP / Brevo / Resend. Attachments are always built; they deliver once a provider is set. |
| Intelligence says "built-in engine" | No live provider key configured (works fine — answers stay grounded). Add any provider key to switch to full language answers. |
| Map tiles blank | Government tile mirror occasionally rate-limits; the standard OpenStreetMap layer loads as fallback. |
