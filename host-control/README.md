# ProjectAssure · Host Control

> **Master control plane for the ProjectAssure platform.**
> Smart India Hackathon 2026 · Problem **SIH26103** · Team **NEXGEN** · Amrita Vishwa Vidyapeetham, Chennai.
>
> **Live deployment:** <https://project-assure-host.vercel.app/>
> **Reaches the main app at:** `MAIN_PROJECT_URL` (env var, defaults to `http://localhost:3000`).
> The REAL bridge to the main app — nothing hardcoded, nothing faked.

---

## Table of contents

1. [What it is](#what-it-is)
2. [How it differs from the main app](#how-it-differs-from-the-main-app)
3. [The nine panels](#the-nine-panels)
4. [Quick start — local dev (port 3001)](#quick-start--local-dev-port-3001)
5. [How sync works](#how-sync-works)
6. [Env vars reference](#env-vars-reference)
7. [API surface](#api-surface)
8. [The store: in-RAM + JSON persistence](#the-store-in-ram--json-persistence)
9. [Authentication & session](#authentication--session)
10. [Email — the provider chain](#email--the-provider-chain)
11. [Intelligence Console — the AI chain](#intelligence-console--the-ai-chain)
12. [Audit trail](#audit-trail)
13. [Deploy to Vercel (separate project)](#deploy-to-vercel-separate-project)
14. [Security notes](#security-notes)
15. [Troubleshooting](#troubleshooting)
16. [File map](#file-map)

---

## What it is

ProjectAssure Host Control is the **government control tower** for the whole
portfolio. It is a **separate** Next.js 16 app that runs on its own Vercel project
(port 3001 in dev) and **mirrors** the main ProjectAssure app — every user,
project, alert, event, email and login. It then layers real host-only actions
on top of that mirror:

- **Approvals** — derived from real new items (new projects, new accounts, budget breaches) — each one notify-able to the user
- **Broadcasts** — push an alert to every main-app user (lands as a real toast + notification within ~20 s)
- **Direct user actions** — restrict / restore access, role change, direct alert, direct email — each one notifies the user for real
- **Automated emails** — login / budget-breach / welcome automations run server-side through a provider chain with an honest SIMULATED fallback
- **Audit** — append-only, searchable; every action recorded with who/when/what
- **Intelligence Console** — a host-side AI chat grounded on the live mirror (Gemini → Groq → sandbox SDK → built-in engine)
- **CSV / JSON export** — every list view exports to CSV; the audit + outbox also export to JSON

> The mirror fills within ~5 s of a change happening on the main app. The host
> never owns data — it only reflects it and acts on it.

---

## How it differs from the main app

| Aspect | Main app | Host Control |
|---|---|---|
| URL | `https://project-assure.vercel.app/` | `https://project-assure-host.vercel.app/` |
| Port (dev) | 3000 | 3001 |
| Vercel root | repo `/` | repo `/host-control` |
| Users | End users (Admin / PM / Stakeholder / Viewer) | One role — Host Administrator |
| Auth | Web Crypto PBKDF2, hash-routed sessions | HMAC-SHA256 signed httpOnly cookie, 8 h TTL |
| Owns data? | Yes — projects, users, alerts, events, predictions, emails, documents | No — mirrors the main app; only owns audit + approval decisions + broadcasts + outbox logs |
| Login | Demo personas + real registration | One env-configured admin email + password |
| Rate-limiting | None | IP-based lockout (6 fails / 10 min) |
| Database | Postgres (required) | SQLite (optional — works in-RAM) |
| AI providers | z-ai-web-dev-sdk | Gemini → Groq → z-ai-web-dev-sdk → built-in deterministic engine |

Both apps can share the same Postgres database; per-row `app` field isolates
main-app data from host-control mirror data.

---

## The nine panels

The shell sidebar (`src/components/host/shell.tsx`) exposes nine views —
the same nine appear in the **landing page's Host Control dropdown** (v23):

| # | Panel | What it shows |
|---|---|---|
| 1 | **Mission Dashboard** (`#/dashboard`) | KPI grid · health bands chart · at-risk list · live activity feed · sync card |
| 2 | **User Management** (`#/users`) | Sortable + filterable grid · per-user drawer (profile / security / projects / alerts / activity) · actions: restrict / restore / role-change / direct-alert / direct-email |
| 3 | **Projects Control** (`#/projects`) | Full grid · ₹Cr budgets · overrun % · milestones · detail drawer · CSV export |
| 4 | **Approvals Centre** (`#/approvals`) | Real derived items (new projects / new accounts / budget breaches) · decisions · owner notifications |
| 5 | **Alerts & Broadcast** (`#/alerts`) | Mirrored alert feed · broadcast (all users) · direct user alerts |
| 6 | **Email Outbox** (`#/outbox`) | Login / budget / welcome automations · provider chain (SMTP → Brevo → Resend → SIMULATED) · full log |
| 7 | **Audit Trail** (`#/audit`) | Append-only · searchable · every action (login attempts, decisions, broadcasts, emails) |
| 8 | **Intelligence** (`#/intelligence`) | AI chat grounded on the live mirror · Gemini → Groq → sandbox SDK → built-in engine |
| 9 | **Integrations** (`#/integrations`) | URL config + test · env checklist · step-by-step setup guide |

Each panel is a single component under `src/components/host/*-view.tsx` and is
wired to the global store through `use-host-data.ts` (5-second polling).

---

## Quick start — local dev (port 3001)

```bash
cd host-control
bun install          # or: npm install --legacy-peer-deps
cp .env.example .env.local
# Edit .env.local — set at minimum:
#   MAIN_PROJECT_URL=http://localhost:3000
#   HOST_ADMIN_EMAIL=cpo@mospi.gov.in
#   HOST_ADMIN_PASSWORD=hostoverseer      ← CHANGE in any non-demo setup
bun run dev          # next dev -p 3001
```

Then:

1. Start the **main app** in a second terminal (`cd .. && bun run dev` → port 3000).
2. Log into the main app in a browser (e.g. `ananya.k@nic.in` / `demo1234`). Its
   browser pushes the portfolio snapshot every 45 s.
3. Open <http://localhost:3001> → log in as `cpo@mospi.gov.in` / `hostoverseer`
   (or whatever you set in `.env.local`).
4. The mirror fills within ~5 s — see the `LIVE` badge in the top bar.

**No `DATABASE_URL` needed** — state is an in-RAM singleton + `.host-store.json`
(auto-saved, gitignored). On Vercel, the JSON persistence is skipped (read-only
filesystem) and the store lives in memory per lambda instance.

---

## How sync works

```
main app (browser, logged in)
  │  POST /api/sync/push        every 45 s + on login + on actions
  ▼
main app sync hub (server)
  │  GET  /api/sync/state       ← host polls every 5 s (server-side, no CORS)
  │  POST /api/sync/webhook     ← host broadcasts + user alerts back to main
  ▼
host-control (this app)
  │  mirror → approvals → automated emails → UI (5 s poll)
  │
  └  main-app browsers poll /api/sync/commands every 20 s
     → broadcasts land as real notifications + toasts
```

Key design choices:

- **All main-app fetches happen SERVER-side** — CORS never applies (server-to-server).
- **Unreachable main → last mirror served, marked `STALE`** (amber badge) — routes never crash.
- **First successful sync baselines existing records** — only REAL new items become approvals. This means: the first time you log in, you'll see an empty Approvals Centre; the second you log in after a real new project or budget breach on the main app, you'll see it appear here.
- **Optional push mode**: `POST /api/admin/sync` with `x-sync-token` header (using `SYNC_TOKEN`). Use this if your deployment prefers main → host pushes instead of host → main polling.
- **Snapshot capped** at 300 events / 400 login-feed / 300 alerts / 200 emails / 500 users / 500 projects (configurable in `src/lib/host/store.ts`).

The polling cycle lives in [`src/lib/host/sync.ts`](src/lib/host/sync.ts). The
client hook that triggers it is in [`src/components/host/use-host-data.ts`](src/components/host/use-host-data.ts).

---

## Env vars reference

See [`.env.example`](.env.example) for the canonical list with comments. The
table below is the quick reference:

### Main app bridge (REQUIRED in production)

| Variable | Default | Purpose |
|---|---|---|
| `MAIN_PROJECT_URL` | `http://localhost:3000` | Where the sync engine polls `/api/sync/state` and posts `/api/sync/webhook` |
| `SYNC_TOKEN` | (unset) | Optional shared secret. When set: host → main webhook posts send header `x-sync-token: <value>`; main → host direct pushes (`POST /api/admin/sync`) must send the same. |

### Host administrator login (CHANGE THE DEFAULTS)

| Variable | Default | Purpose |
|---|---|---|
| `HOST_ADMIN_EMAIL` | `cpo@mospi.gov.in` | Login email |
| `HOST_ADMIN_PASSWORD` | `hostoverseer` | Login password — **change in any real deployment** |
| `HOST_SESSION_SECRET` | (derived from `HOST_ADMIN_PASSWORD` if unset) | Cookie-signing secret (≥ 16 chars). When unset, changing the password invalidates every live session. |

### Intelligence Console (optional, first working one serves)

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Free key from Google AI Studio. First preference if set. |
| `GROQ_API_KEY` | Free key from <https://console.groq.com>. Second preference. |
| — (no keys) | Built-in deterministic engine answers from the live mirror. |

### Automated email alerts (optional, first working provider serves)

| Variable | Purpose |
|---|---|
| `EMAIL_USER` + `EMAIL_PASS` | SMTP auth (Gmail App Password — no spaces — works) |
| `SMTP_HOST` | Default: `smtp.gmail.com` |
| `SMTP_PORT` | 465 → implicit TLS · 587 → STARTTLS |
| `BREVO_API_KEY` | HTTP API, free 300/day |
| `RESEND_API_KEY` | HTTP API |
| `ALERT_EMAIL_FROM` | Verified sender for Brevo / Resend |
| — (no provider) | Emails are recorded honestly as **SIMULATED** in the Outbox |

---

## API surface

All routes live under `src/app/api/`. Every `/api/admin/*` route **rejects
without a valid host session (401)** and **audits the action**.

### Auth

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/login` | `POST` | Validate `email` + `password`, set HMAC-signed httpOnly cookie, audit `LOGIN_OK` / `LOGIN_FAIL` |
| `/api/auth/logout` | `POST` | Clear the cookie, audit `LOGOUT` |
| `/api/auth/session` | `GET` | Probe — returns 200 + session if cookie is valid, 401 otherwise |

### Admin (session-required)

| Route | Method | Purpose |
|---|---|---|
| `/api/admin/sync` | `GET` | Run a sync cycle (poll main, merge, derive approvals, fire automated emails) and return the full host state. The UI polls this every 5 s. |
| `/api/admin/sync` | `POST` | Optional push mode — accepts a snapshot from the main app (requires `x-sync-token` header if `SYNC_TOKEN` is set). |
| `/api/admin/users` | `GET` / `PATCH` | List users; PATCH a user's role, access flag, or send a direct alert/email |
| `/api/admin/approvals` | `GET` / `PATCH` | List approvals; PATCH to approve / reject a derived item (notifies the user) |
| `/api/admin/broadcast` | `POST` | Broadcast an alert to every main-app user (lands as a real notification within ~20 s) |
| `/api/admin/settings` | `GET` / `PATCH` | Get / update host settings (e.g. `mainUrlOverride`, sync toggle) |
| `/api/admin/export` | `GET` | CSV / JSON export of users / projects / audit / outbox |

### Intelligence + email + health

| Route | Method | Purpose |
|---|---|---|
| `/api/ai/chat` | `POST` | Host-side AI chat (Gemini → Groq → sandbox SDK → built-in engine) |
| `/api/ai/status` | `GET` | Which AI provider is currently active |
| `/api/email/send` | `POST` | Send an email through the provider chain (SMTP → Brevo → Resend → SIMULATED) |
| `/api/email/status` | `GET` | Last N emails' delivery status |
| `/api/health` | `GET` | Probe — returns 200 if the host can reach its own store |

---

## The store: in-RAM + JSON persistence

The host does NOT need a database for the demo. State lives in a singleton on
`globalThis` (so Next.js dev hot-reload keeps one instance), and **persists** to
`.host-store.json` in the project root. On Vercel, the JSON persistence is
skipped (read-only FS) — the store lives in memory for the life of the lambda
instance.

```ts
// src/lib/host/store.ts (excerpt)
const STORE_VERSION = 21;
const PERSIST_PATH = path.join(process.cwd(), ".host-store.json");
const IS_VERCEL = process.env.VERCEL === "1" || Boolean(process.env.VERCEL);

const AUDIT_CAP = 600;
const OUTBOX_CAP = 400;
const BROADCAST_CAP = 80;
const APPROVAL_CAP = 200;
const MIRROR_CAPS = { events: 300, loginFeed: 400, alerts: 300, emails: 200, users: 500, projects: 500 };
```

If you want durable state on Vercel, point Prisma at a Postgres database
(`DATABASE_URL`). The schema in `prisma/schema.prisma` is intentionally minimal
(one `User` model) — the real data lives in the mirror, not in tables. You'd
typically only persist the audit log and approvals.

---

## Authentication & session

| Surface | Mechanism |
|---|---|
| Password verification | PBKDF2-SHA256, compared in constant time |
| Session token | HMAC-SHA256 signed cookie, httpOnly, 8-hour TTL |
| Cookie name | `pa_host_session` |
| Lockout | 6 failed logins from one IP → 10-minute IP lockout (in-memory, never persisted) |
| Audit | Every login attempt recorded (success or failure) |
| Logout | `POST /api/auth/logout` clears the cookie; `LOGOUT` audit entry recorded |

The session secret is `HOST_SESSION_SECRET` if set, otherwise derived from
`HOST_ADMIN_PASSWORD` (so changing the password invalidates every live session
— useful for incident response).

Implementation: [`src/lib/host/auth.ts`](src/lib/host/auth.ts).

---

## Email — the provider chain

The host sends automated emails (login alerts, budget-breach warnings,
welcome emails) through a **provider chain** — the first configured one
serves. If none is configured, the email is still recorded honestly as
`SIMULATED` in the Outbox.

```
SMTP (EMAIL_USER + EMAIL_PASS + SMTP_HOST + SMTP_PORT)
  │   ↓ if missing
  Brevo HTTP API (BREVO_API_KEY + ALERT_EMAIL_FROM)
  │   ↓ if missing
  Resend HTTP API (RESEND_API_KEY + ALERT_EMAIL_FROM)
  │   ↓ if missing
  SIMULATED  ← logged honestly, no message leaves the server
```

Every email — sent or simulated — is recorded in the Outbox with a delivery
status, provider label, retries, and timestamp. The Outbox view (`#/outbox`)
lets you filter by status (`SENT` / `SIMULATED` / `FAILED`), retry a failed
send, or export the whole log as CSV / JSON.

Implementation: [`src/lib/host/mailer.ts`](src/lib/host/mailer.ts).

---

## Intelligence Console — the AI chain

The host's Intelligence Console (`#/intelligence`) is a chat grounded on the
**live mirror** — so you can ask "show me the top 5 over-budget projects" or
"which officers haven't logged in this week?" and get answers from current
data, not training cutoffs.

```
Gemini (GEMINI_API_KEY)
  │   ↓ if missing
  Groq (GROQ_API_KEY)
  │   ↓ if missing
  z-ai-web-dev-sdk (sandbox SDK)
  │   ↓ if missing
  Built-in deterministic engine  ← answers from the live mirror, no LLM call
```

The built-in engine is intentionally honest — it parses common questions
(over-budget, at-risk, recent logins, project search) and answers from the
mirror with cited rows. No made-up numbers.

Implementation: [`src/app/api/ai/chat/route.ts`](src/app/api/ai/chat/route.ts).

---

## Audit trail

Every host action is appended to a ring-buffer (cap 600) and is **never
edited or deleted**. The audit trail is searchable by actor, action type,
and free-text, and exports to CSV / JSON.

Recorded events include:

- `LOGIN_OK`, `LOGIN_FAIL`, `LOGOUT`
- `APPROVE`, `REJECT` (with item id + reason)
- `BROADCAST` (with body + recipient count)
- `DIRECT_ALERT` (user id + body)
- `EMAIL` (provider + status + recipient)
- `ROLE_CHANGE`, `ACCESS_RESTRICT`, `ACCESS_RESTORE`
- `SYNC_OK`, `SYNC_FAIL`, `BASELINE_DONE`
- `SETTINGS_UPDATE`

Implementation: [`src/lib/host/store.ts`](src/lib/host/store.ts) — search for `audit(`.

---

## Deploy to Vercel (separate project)

1. Push the repo (the `host-control/` folder included) to GitHub.
2. On Vercel → **Add New Project** → import the repo.
3. **Root Directory** → set to `host-control` (NOT `/`).
4. **Framework Preset** → Next.js (auto-detected).
5. **Environment Variables** — set at minimum:

   | Variable | Example |
   |---|---|
   | `MAIN_PROJECT_URL` | `https://project-assure.vercel.app` |
   | `HOST_ADMIN_EMAIL` | `cpo@mospi.gov.in` |
   | `HOST_ADMIN_PASSWORD` | a strong, unique password (NOT `hostoverseer`) |
   | `SYNC_TOKEN` | (optional) shared webhook secret |
   | `GEMINI_API_KEY`, `GROQ_API_KEY` | (optional) Intelligence Console providers |
   | `EMAIL_USER`, `EMAIL_PASS`, `SMTP_HOST`, `SMTP_PORT` | (optional) SMTP email |
   | `BREVO_API_KEY`, `RESEND_API_KEY`, `ALERT_EMAIL_FROM` | (optional) HTTP email APIs |

6. Deploy → log in at `https://<your-host>.vercel.app`.
7. On the **main app's** Vercel project, set `NEXT_PUBLIC_HOST_URL` to your host
   URL and redeploy. (Optional: set the same `SYNC_TOKEN` if you used one.)

### On Vercel — behaviour changes worth knowing

- `.host-store.json` persistence is skipped (read-only FS) → store lives in
  memory per lambda instance. **Approvals / audit / outbox reset on cold start.**
- The mirror re-fills on the first sync after the cold start (~5 s after the
  first admin page load).
- For durable state, point Prisma at a Postgres database (schema is minimal
  on purpose — you'll typically only persist the audit log + approvals).

---

## Security notes

| Surface | Mechanism |
|---|---|
| Admin password | **Change `HOST_ADMIN_PASSWORD` before any real deployment.** The default `hostoverseer` is for the SIH demo only. |
| Session | HMAC-SHA256 signed httpOnly cookie, 8 h TTL |
| Auth rate-limit | 6 failed logins → 10-minute IP lockout (in-memory) |
| Route protection | Every `/api/admin/*` route rejects without a valid session (401) |
| Webhook secret | Optional `x-sync-token` shared secret for host ↔ main webhook traffic |
| Audit | Login attempts, decisions, broadcasts, emails — all audited, append-only |
| Secrets | Env-only — no secrets in code; never bundled into the client |
| Outbound tabs | All `target="_blank"` links use `rel="noopener,noreferrer"` |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `AWAITING PUSH` badge never clears | Open the **main app** in a browser and log in. Its client pushes the snapshot every 45 s. |
| `STALE` badge persists | Check `MAIN_PROJECT_URL` — must be reachable server-side (no Vercel preview-password protection, no IP allow-list blocking). |
| `LINK ERROR` badge | Last sync failed entirely. Check the audit trail (`#/audit`) for `SYNC_FAIL` entries — the `lastError` is captured. |
| Approvals never appear | First sync baselines existing records — only REAL new items become approvals. Trigger a fresh sync after baseline. |
| Admin login says `LOCKED OUT` | 6 failed attempts from your IP within 10 min → wait 10 min (or restart the dev server — the lockout is in-memory). |
| Intelligence Console answers "I don't know" | Set `GEMINI_API_KEY` or `GROQ_API_KEY` in `.env.local` and restart. Otherwise, the built-in engine answers only the questions it understands. |
| Emails show as `SIMULATED` | No provider configured. Set `EMAIL_USER` + `EMAIL_PASS` (Gmail App Password, no spaces) **or** `BREVO_API_KEY` + `ALERT_EMAIL_FROM`. |
| Outbox / audit reset after Vercel cold start | Expected — `.host-store.json` is skipped on Vercel's read-only FS. For durable state, point Prisma at a Postgres `DATABASE_URL`. |
| `bun install` fails | Use `npm install --legacy-peer-deps` instead. |
| `prisma generate` fails | Set `DATABASE_URL` (even a SQLite URL works for `generate`); or skip — `postinstall` is non-fatal. |

---

## File map

```
host-control/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Session gate → Shell
│   │   ├── layout.tsx                  # Root layout + Toaster
│   │   ├── globals.css                  # Theme tokens
│   │   └── api/
│   │       ├── admin/
│   │       │   ├── approvals/route.ts    # GET / PATCH approvals
│   │       │   ├── broadcast/route.ts    # POST broadcast to all
│   │       │   ├── export/route.ts       # GET CSV / JSON export
│   │       │   ├── settings/route.ts    # GET / PATCH settings
│   │       │   ├── sync/route.ts         # GET poll + POST push
│   │       │   └── users/route.ts        # GET / PATCH users
│   │       ├── ai/
│   │       │   ├── chat/route.ts         # POST chat (Gemini → Groq → SDK → built-in)
│   │       │   └── status/route.ts       # GET active provider
│   │       ├── auth/
│   │       │   ├── login/route.ts        # POST login (HMAC cookie)
│   │       │   ├── logout/route.ts       # POST logout
│   │       │   └── session/route.ts      # GET session probe
│   │       ├── email/
│   │       │   ├── send/route.ts         # POST send (SMTP → Brevo → Resend → SIMULATED)
│   │       │   └── status/route.ts       # GET outbox
│   │       └── health/route.ts           # GET health probe
│   ├── components/host/
│   │   ├── app-props.ts                 # Shared view props
│   │   ├── alerts-view.tsx              # #/alerts
│   │   ├── approvals-view.tsx            # #/approvals
│   │   ├── audit-view.tsx                # #/audit
│   │   ├── dashboard-view.tsx           # #/dashboard
│   │   ├── integrations-view.tsx        # #/integrations
│   │   ├── intelligence-view.tsx        # #/intelligence
│   │   ├── login-view.tsx               # Login screen
│   │   ├── outbox-view.tsx              # #/outbox
│   │   ├── projects-view.tsx            # #/projects
│   │   ├── shell.tsx                    # Sidebar + topbar + view switch
│   │   ├── ui.tsx                       # Shared UI bits (IconButton, Dot, Pill…)
│   │   ├── use-host-data.ts             # 5 s polling hook
│   │   ├── user-drawer.tsx              # Per-user drawer
│   │   ├── users-view.tsx               # #/users
│   │   └── view-props.ts                 # Type defs for view props
│   └── lib/
│       ├── db.ts                       # Prisma client (no DB needed for demo)
│       ├── host/
│       │   ├── auth.ts                  # HMAC cookie + IP lockout
│       │   ├── format.ts                # relTime, currency, etc.
│       │   ├── mailer.ts                # Provider chain
│       │   ├── store.ts                 # In-RAM singleton + JSON persist
│       │   ├── sync.ts                  # Poll main, merge, derive approvals
│       │   └── types.ts                 # All shared types
│       └── utils.ts                    # cn() and friends
├── prisma/schema.prisma                # Minimal (one User model)
├── public/robots.txt
├── package.json                       # Host's own deps (separate from main)
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── eslint.config.mjs
├── vercel.json
├── .env.example
├── .gitignore
└── README.md                          # ← you are here
```

---

> *ProjectAssure · Host Control · SIH 2026 · SIH26103 · Team NEXGEN.*
> *The REAL bridge — nothing hardcoded, nothing faked.*
