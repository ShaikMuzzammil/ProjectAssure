# ProjectAssure

> **The intelligence cockpit that watches every rupee and every deadline.**
> Smart India Hackathon 2026 · Problem **SIH26103** · Theme: Smart Automation · Software
> Team **NEXGEN** — Amrita Vishwa Vidyapeetham, Chennai Campus

[![Deployment](https://img.shields.io/badge/deploy-Vercel-000000?logo=vercel)](https://vercel.com)
[![Framework](https://img.shields.io/badge/Next.js-16-000000?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)](https://www.typescriptlang.org)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)

ProjectAssure is an intelligence-powered project-monitoring platform for India's 1,800+ central-sector infrastructure projects. It replaces 27,000 monthly paper-pages with a **Track → Analyse → Predict → Alert → Recommend** pipeline that flags cost and schedule slips **30–60 days before they happen**, in plain language, with cited evidence.

> **Live deployments (two-app architecture)**
> - Main app · <https://project-assure.vercel.app/> *(or run locally — port 3000)*
> - Host Control · <https://project-assure-host.vercel.app/> *(or run locally — port 3001)*

---

## Table of contents

1. [Why this exists](#why-this-exists)
2. [Two-app architecture](#two-app-architecture)
3. [Folder structure](#folder-structure)
4. [Feature matrix (v22 → v23)](#feature-matrix-v22--v23)
5. [Quick start — local dev (both apps)](#quick-start--local-dev-both-apps)
6. [Deploy to Vercel — two separate projects](#deploy-to-vercel--two-separate-projects)
7. [Tech stack](#tech-stack)
8. [Role-based access control](#role-based-access-control)
9. [The Host Control bridge](#the-host-control-bridge)
10. [Landing-page Host Control toggle (v23)](#landing-page-host-control-toggle-v23)
11. [Documentation map](#documentation-map)
12. [Live jury demo script](#live-jury-demo-script)
13. [Environment variables](#environment-variables)
14. [Security posture](#security-posture)
15. [Troubleshooting](#troubleshooting)
16. [Roadmap](#roadmap)
17. [Team NEXGEN](#team-nexgen)
18. [License](#license)

---

## Why this exists

India's central-sector portfolio — 1,800+ projects of ₹150 Cr+ each, the flagships
the ministry watches closely — runs on a paper pipeline that's months stale by the
time a decision reaches the table. The honest accounting from the ministry's own
IPMD snapshots looks like this:

| Signal | Today |
|---|---|
| Average time overrun on delayed projects | **~50 months** |
| Average cost overrun across the portfolio | **20 %+** |
| Pages analysts read manually every month | **~27,000** |
| Time from field report → decision | **8–12 weeks** |

By the time a ₹1,450 Cr corridor shows red on a status pack, the slip has already
happened. **~900 analyst-hours a month** go into transcription, not judgement.

ProjectAssure flips the model. Reports are read automatically, the portfolio is
scored continuously, and the right officer is warned — with a probability, a
reason, and an action — **before** the slip is locked in.

---

## Two-app architecture

ProjectAssure ships as **two separate Next.js apps** that share one Vercel repo but
deploy as two independent projects. The split is intentional: the public dashboard
runs on one URL for everyone; the master control plane runs on a separate, hardened
URL for the central programme office.

```
┌─────────────────────────────────────────────────────────┐
│            Vercel Project #1 — Main app                 │
│            (this folder — root)                         │
│                                                         │
│   /                    Landing page                     │
│   /#/login             Sign in / Register                │
│   /#/demo              Demo personas                     │
│   /#/about             About + team                      │
│   /#/app/...           Authenticated workspace           │
│   /api/auth/*          Register / login / users         │
│   /api/ai/*            AI chat + files (z-ai SDK)        │
│   /api/email/*         Email send + status               │
│   /api/sync/*          Main ↔ Host bridge                │
│   /api/health          Health probe                      │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP push/pull (every 5–45 s)
                         ▼
┌─────────────────────────────────────────────────────────┐
│            Vercel Project #2 — Host Control              │
│            (host-control/ subfolder)                    │
│                                                         │
│   /                    Admin login + control tower      │
│   /#/dashboard         Mission KPIs + health bands      │
│   /#/users             User management                  │
│   /#/projects          Projects control                  │
│   /#/approvals         Change-order approvals            │
│   /#/alerts            Alerts & broadcast                │
│   /#/outbox            Email outbox + delivery logs      │
│   /#/audit             Tamper-proof audit trail          │
│   /#/intelligence      Host-side AI console              │
│   /#/integrations      URL config + env checklist        │
│   /api/admin/*         Admin-only mutations             │
│   /api/auth/*          Host session (HMAC cookie)       │
│   /api/ai/*            Host AI chat + status             │
│   /api/email/*         Host email send + status          │
└─────────────────────────────────────────────────────────┘
```

Both apps can share one Postgres database; per-row `app` fields isolate main-app
data from the host-control mirror. See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the
full step-by-step.

---

## Folder structure

```
prototype/                              ← MAIN APP (Vercel project #1)
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Hash-routed AppRoot
│   │   ├── api/
│   │   │   ├── ai/                      # AI chat + files (z-ai-web-dev-sdk)
│   │   │   ├── auth/                    # Register / login
│   │   │   ├── email/                   # Email send + status
│   │   │   ├── host/                    # Host bridge routes (mounted under main)
│   │   │   ├── sync/                    # Main ↔ Host sync (push/state/commands/webhook)
│   │   │   ├── users/                   # User list
│   │   │   └── health/                  # Health probe
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/
│   │   ├── projectassure/              # Main app components
│   │   │   ├── views/                   # 25+ feature views (dashboard, tracking, geo-audit, …)
│   │   │   ├── shared/                  # Gantt, geo-evidence, ai-chat-panel, onboarding-tour
│   │   │   ├── shell/                   # AppShell
│   │   │   ├── landing/, auth/, about/, public/
│   │   │   └── app-root.tsx             # Hash router (landing/login/app/demo/about/public)
│   │   ├── host/                        # Host bridge preview UI (in-app)
│   │   └── ui/                          # shadcn/ui (60+ components)
│   ├── lib/
│   │   ├── projectassure/              # Engine (ml, rag, agent, geo, reports, nlp, …)
│   │   ├── sync/                        # Main ↔ Host sync client/server
│   │   ├── host/                        # Host bridge helpers (auth, mailer, sync, types, …)
│   │   └── db.ts                        # Prisma client
│   ├── store/app-store.ts              # Zustand store
│   └── hooks/                          # use-mobile, use-toast
├── prisma/                             # Prisma schema (3 variants — postgres / sqlite / both)
├── public/                             # logo.svg, robots.txt
├── docs/                               # Best useful MD files only
│   ├── USER_GUIDE.md                  # End-user walkthrough
│   ├── TEAM_GUIDE.md                   # Developer onboarding
│   ├── DEPLOYMENT_GUIDE.md             # Full deploy steps (Vercel/Docker/on-prem)
│   ├── WORKFLOWS.md                    # 15 numbered user workflows (index)
│   ├── WORKFLOW_IMPLEMENTATION.md      # How the workflows map to code
│   ├── workflows/01-15-*.md            # One file per workflow
│   └── reference-md/01-09*.md          # 9 deep-dive reference docs
├── package.json                        # Main app deps
├── next.config.ts, tsconfig.json, tailwind.config.ts, eslint.config.mjs
├── vercel.json
├── DEPLOYMENT.md                       # Step-by-step Vercel/Docker/on-prem
├── README.md                           # ← you are here
│
└── host-control/                        ← HOST CONTROL (Vercel project #2 — SEPARATE)
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx                # Session gate → Shell
    │   │   ├── api/                    # Host's OWN API (separate from main)
    │   │   │   ├── admin/              # users, approvals, broadcast, sync, settings, export
    │   │   │   ├── auth/               # login, logout, session
    │   │   │   ├── ai/                 # chat, status
    │   │   │   ├── email/              # send, status
    │   │   │   └── health/
    │   │   ├── globals.css
    │   │   └── layout.tsx
    │   ├── components/host/            # Host UI (shell, views, drawer, ui bits)
    │   └── lib/
    │       ├── host/                    # store, sync, auth, mailer, format, types
    │       ├── db.ts
    │       └── utils.ts
    ├── prisma/schema.prisma            # Minimal — no DB required for the demo
    ├── public/robots.txt
    ├── package.json                     # Host's OWN deps (separate from main)
    ├── next.config.ts, tsconfig.json, postcss.config.mjs, eslint.config.mjs
    ├── vercel.json
    ├── .env.example
    └── README.md                        # ← host-control's own advanced README
```

---

## Feature matrix (v22 → v23)

### What shipped in v22 (the SIH release)

| # | Feature | Where |
|---|---|---|
| 1 | **Real-Time Tracking Dashboard** — Gantt + interactive milestone bars + 5 s live refresh | `#/app/tracking` |
| 2 | **Geo-Tagged Site Audits** — GPS-locked photo upload with capture timestamps; auto-flags off-site photos | `#/app/geo-audit` |
| 3 | **India Project Map** — interactive Leaflet map of India with project pins coloured by delay probability | `#/app/india-map` |
| 4 | **AI-Driven Delay Prediction** — 18-feature ML model with confidence intervals + factor breakdown | `#/app/model-lab` |
| 5 | **Automated Alert System** — email + SMS simulation, escalates at 10 % / 20 % budget overrun | `#/app/alerts` |
| 6 | **Role-Based Access Control** — 4 roles (Admin / PM / Stakeholder / Viewer) — sidebar adapts | `lib/projectassure/permissions.ts` |
| 7 | **Enhanced Login Background** — animated mesh gradient + India silhouette + grid overlay | `auth/login-view.tsx` |
| 8 | **Cleaner Landing Nav** — removed "Demo personas" + "Citizen view" from top nav (already in About) | `landing/landing-view.tsx` |

### What's new in v23 (this release)

| # | Change | Where | Why |
|---|---|---|---|
| 1 | **Host Control dropdown toggle on landing footer** — the footer's "Host Control" button now has a chevron toggle; tapping it reveals a stack of deep-links to the nine host-control panels (Mission Dashboard, User Management, Projects, Approvals, Alerts, Outbox, Audit, Intelligence, Integrations). The main button still opens the live host deployment in a new tab. | `src/components/projectassure/landing/landing-view.tsx` | Jury members asked for a "give me one click to any host panel" affordance without leaving the landing page |
| 2 | **Host Control URL updated** to `https://project-assure-host.vercel.app/` (with hyphen, matching the live Vercel project) and is opened with `target="_blank"` + `noopener,noreferrer` | same file | Hyphen is the canonical Vercel project name; `noopener` blocks tab-nabbing |
| 3 | **Click-outside + Escape-to-close** on the new dropdown | same file | Standard accessible menu pattern |
| 4 | **Docs pruned to "best useful MD files only"** — sample PDFs, `team.txt`, outdated `CHANGELOG_v13.md` and `PROTOTYPE_FEATURE_MAP.md` removed. What remains: USER_GUIDE, TEAM_GUIDE, DEPLOYMENT_GUIDE, WORKFLOWS, WORKFLOW_IMPLEMENTATION, 15 workflow step files, 9 reference deep dives. | `docs/` | Reviewers should not be faced with stale v4/v13 docs alongside the v22/v23 source |
| 5 | **Advanced README.md** for the main project (this file) and an **advanced README.md** for `host-control/` (separate, with its own env, deploy, sync, security sections) | repo root + `host-control/` | Each deployment is its own Vercel project — each deserves its own onboarding doc |

---

## Quick start — local dev (both apps)

You need **Node 18+**, **npm** (or **bun**), and a free Postgres (Neon, Supabase, or
local). The host-control can run without a database for the demo.

### Terminal 1 — Main app (port 3000)

```bash
cd prototype
npm install --legacy-peer-deps          # or: bun install
cp .env.example .env
# Edit .env — set at least:
#   DATABASE_URL=postgresql://...        (Neon / Supabase / local Postgres)
#   NEXTAUTH_SECRET=$(openssl rand -base64 32)
#   NEXT_PUBLIC_HOST_URL=http://localhost:3001   # set after starting host
npm run db:push                          # or: bun run db:push
npm run dev                              # or: bun run dev
# → http://localhost:3000
```

### Terminal 2 — Host Control (port 3001)

```bash
cd prototype/host-control
npm install --legacy-peer-deps
cp .env.example .env.local
# Edit .env.local — set at least:
#   MAIN_PROJECT_URL=http://localhost:3000
#   HOST_ADMIN_EMAIL=cpo@mospi.gov.in
#   HOST_ADMIN_PASSWORD=hostoverseer      # CHANGE THIS in any non-demo setup
npm run dev                              # → http://localhost:3001
```

### Demo personas (every password is `demo1234`)

| Email | Role | What you see |
|---|---|---|
| `ananya.k@nic.in` | **Administrator** | Everything — 30 demo projects, all views, user management, thresholds, audit |
| `priya.v@nic.in` | **Project Manager** | 10 of her projects; can create/edit, run predictions, email reports |
| `karthik.s@nic.in` | **Stakeholder** (financial auditor) | Read all IPMD projects, acknowledge alerts, generate reports |
| `rahul.s@nhai.gov.in` | **Project Manager** (roads) | 6 district projects; uploads dominate |
| Host Control admin | via `HOST_ADMIN_EMAIL` env var | All host panels — mirror fills within ~5 s |

---

## Deploy to Vercel — two separate projects

> Full instructions live in [`DEPLOYMENT.md`](./DEPLOYMENT.md). The short version:

### Project 1 — Main app

1. Push this folder to GitHub (root of `main`).
2. [vercel.com/new](https://vercel.com/new) → import the repo.
3. **Root Directory** → leave as `/` (project root).
4. Framework → Next.js. Build → `next build`. Install → `npm install --legacy-peer-deps`.
5. Env vars:

   | Variable | Required | Example |
   |---|---|---|
   | `DATABASE_URL` | yes | `postgresql://...` (Vercel Postgres / Neon) |
   | `NEXTAUTH_SECRET` | yes | `openssl rand -base64 32` |
   | `NEXT_PUBLIC_HOST_URL` | yes — set after step 2 below | `https://project-assure-host.vercel.app` |
   | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | no | Optional real email |

6. Deploy → e.g. `https://project-assure.vercel.app`.

### Project 2 — Host Control

1. On Vercel, import the **same GitHub repo**.
2. **Root Directory** → set to `host-control/` (NOT `/`).
3. Framework → Next.js. Build → `next build`. Install → `npm install --legacy-peer-deps`.
4. Env vars:

   | Variable | Required | Example |
   |---|---|---|
   | `DATABASE_URL` | no (host works in-memory) | shared Postgres if you want durable state |
   | `MAIN_PROJECT_URL` | yes | `https://project-assure.vercel.app` |
   | `HOST_ADMIN_EMAIL` | yes | `cpo@mospi.gov.in` |
   | `HOST_ADMIN_PASSWORD` | yes — change! | `hostoverseer` is the demo default |
   | `HOST_SESSION_SECRET` | no (derived if unset) | ≥ 16 chars |
   | `SYNC_TOKEN` | no | shared secret if you enable webhook mode |
   | `GEMINI_API_KEY`, `GROQ_API_KEY` | no | Intelligence Console providers |
   | `EMAIL_USER`, `EMAIL_PASS`, `SMTP_HOST`, `SMTP_PORT` | no | SMTP email (Gmail App Password works) |
   | `BREVO_API_KEY`, `RESEND_API_KEY`, `ALERT_EMAIL_FROM` | no | HTTP email APIs |

5. Deploy → e.g. `https://project-assure-host.vercel.app`.
6. Back in Project 1, set `NEXT_PUBLIC_HOST_URL=https://project-assure-host.vercel.app` and redeploy.

> Both apps can share the same database; per-row `app` field isolates main-app data from host-control mirror data.

---

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router, Turbopack) | Latest App Router + RSC; Vercel-native |
| Language | **TypeScript 5** | Strict mode end-to-end |
| UI | **shadcn/ui** + **Tailwind 4** + Radix + Framer Motion | 60 + accessible components, animation, dark mode |
| State | **Zustand** + **TanStack Query** | Minimal boilerplate, server-cache friendly |
| Database | **Prisma ORM** + **PostgreSQL** (or SQLite locally) | Type-safe queries, 3 schema variants shipped |
| Maps | **Leaflet 1.9** (CDN-loaded, India-friendly) | No API key, works offline |
| Charts | **Recharts** | Composable, accessible |
| AI | **z-ai-web-dev-sdk** (chat + vision + RAG) | First-class ZAI integration |
| Auth | **Web Crypto** (PBKDF2 for main; PBKDF2-SHA256 for host) | No external auth service needed |
| Email | **Nodemailer** (optional SMTP) + Brevo + Resend | Provider chain with honest SIMULATED fallback |
| Export | **jsPDF** + **xlsx** (SheetJS) | One-click PDF / Excel / CSV everywhere |
| Real-time | 5 s poll (host→main) + 45 s push (main→host) | No websockets needed; works through any firewall |

---

## Role-based access control

The main app enforces four roles. Each role sees a different sidebar and a different
set of mutations — both in the UI and in every API mutation. The matrix:

| Role | Sidebar | Can do |
|---|---|---|
| **ADMIN** | Dashboard, Live Tracking, India Map, Projects, AI, Prediction, Reports, Email, Help, Admin | Everything — including user management + thresholds |
| **PROJECT_MANAGER** | Dashboard, Live Tracking, Geo-Audit, India Map, Projects, AI, Prediction, Reports, Email, Help | Create/edit projects, upload docs, submit evidence, run predictions |
| **STAKEHOLDER** | Dashboard, Live Tracking, India Map, Projects, AI, Reports, Help | Read-only oversight, exports, alerts |
| **VIEWER** | Dashboard, India Map, Projects, AI, Help | Read-only briefing |

Implementation: [`src/lib/projectassure/permissions.ts`](src/lib/projectassure/permissions.ts).
The Host Control app has **one** role (Host Administrator) — protected by HMAC-signed
httpOnly cookie + IP lockout.

---

## The Host Control bridge

The host-control app is a **mirror**, not a copy. It does not own user/project/alert
data — the main app does. The host just polls a server-to-server endpoint every 5 s
and merges the snapshot. It also receives webhooks for real-time updates when the
main app pushes them.

```
main app (browser, logged in)
  │  POST /api/sync/push        every 45 s + on login + on mutations
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

- **All main-app fetches happen server-side** — CORS never applies.
- **Unreachable main → last mirror served, marked `STALE`** (amber badge) — routes never crash.
- **First sync baselines existing records** — only REAL new items become approvals.
- **Optional push mode**: `POST /api/admin/sync` with `x-sync-token: <SYNC_TOKEN>`.

See [`host-control/README.md`](host-control/README.md) for the full bridge contract.

---

## Landing-page Host Control toggle (v23)

The landing-page footer now exposes the host control plane through a small
**two-piece** control:

```
┌─────────────────────────────────────┐   ◄── lives in the dark footer
│  [ Host Control  → ] [  ▾  ]        │
└─────────────────────────────────────┘
       ▲               ▲
       │               │
       │               └── chevron toggle — tap to reveal the dropdown
       │                   (rotates 180° when open, escapes + click-outside close)
       │
       └── main button — opens https://project-assure-host.vercel.app/ in a new tab
```

The dropdown reveals the nine host panels (Mission Dashboard, User Management,
Projects Control, Approvals Centre, Alerts & Broadcast, Email Outbox, Audit Trail,
Intelligence, Integrations). Each item deep-links into the live host deployment
with its hash route (`#/dashboard`, `#/users`, …) — so a jury member can jump
straight to the panel they care about.

Implementation: [`src/components/projectassure/landing/landing-view.tsx`](src/components/projectassure/landing/landing-view.tsx).
Look for the `HOST_CONTROL_OPTIONS` constant and the `hostOpen` state.

---

## Documentation map

After the v23 docs prune, the `docs/` folder contains **only useful Markdown files**:

```
docs/
├── USER_GUIDE.md                         # End-user walkthrough (every screen, every button)
├── TEAM_GUIDE.md                         # Developer onboarding (architecture, conventions)
├── DEPLOYMENT_GUIDE.md                   # Full deploy (Vercel / Docker / on-prem)
├── WORKFLOWS.md                          # Index of the 15 numbered user workflows
├── WORKFLOW_IMPLEMENTATION.md            # How the workflows map to code paths
├── workflows/
│   ├── 01-create-an-account.md
│   ├── 02-sign-in.md
│   ├── 03-explore-the-dashboard.md
│   ├── 04-compare-projects.md
│   ├── 05-create-a-project.md
│   ├── 06-upload-documents.md
│   ├── 07-detect-risks.md
│   ├── 08-run-a-prediction.md
│   ├── 09-get-recommended-actions.md
│   ├── 10-ask-assure-intelligence.md
│   ├── 11-track-alerts-live.md
│   ├── 12-raise-an-intervention.md
│   ├── 13-export-evidence.md
│   ├── 14-send-email-reports.md
│   └── 15-deploy-one-web-address.md
└── reference-md/                         # 9 deep dives (the spec)
    ├── 01_PROJECT_OVERVIEW.md
    ├── 02_SYSTEM_ARCHITECTURE.md
    ├── 03_TECH_STACK_DEEP_DIVE.md
    ├── 04_DATABASE_SCHEMA.md
    ├── 05_API_DESIGN.md
    ├── 06_AI_ML_ENGINE.md
    ├── 07_UI_UX_DESIGN_SYSTEM.md
    ├── 08_DEPLOYMENT_DEVOPS.md
    └── 09_BUILD_PROMPTS.md
```

Plus the two top-level READMEs:

- [`README.md`](README.md) — **this file** (main project)
- [`host-control/README.md`](host-control/README.md) — Host Control advanced guide
- [`DEPLOYMENT.md`](DEPLOYMENT.md) — Short-form Vercel/Docker/on-prem

---

## Live jury demo script

1. Open the main app URL → landing page. Notice the new **Host Control ▾** toggle in the footer — click it.
2. Pick **Mission Dashboard** from the dropdown → the host control opens in a new tab (admin login required).
3. Back on the landing page, click **Launch demo** → login page (animated background).
4. Sign in as `ananya.k@nic.in` / `demo1234` (Administrator).
5. Click **Live Tracking** → milestone status bars + 5-second live feed.
6. Click **India Map** → interactive Leaflet map; click any pin.
7. Click **Geo-Audit** → upload a site photo, see GPS lock + verification.
8. Click **Prediction Engine** → run a delay prediction; observe the 18-feature breakdown.
9. Click **Email Centre** → send a portfolio report to any email.
10. In the host-control tab, refresh → see the new user, project, alert and email appear in the mirror within 5 seconds.
11. Back in main app, sign in as `karthik.s@nic.in` → role-scoped sidebar (Stakeholder, no edit access).

---

## Environment variables

### Main app (`.env`)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string (Neon, Supabase, Vercel Postgres) |
| `NEXTAUTH_SECRET` | yes | HMAC secret for session tokens |
| `NEXT_PUBLIC_HOST_URL` | yes | The host-control public URL (set after host deploy) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | no | Outbound email |
| `ZAI_API_KEY` | no | Only if your ZAI SDK needs an explicit key |

### Host Control (`host-control/.env.local`)

See [`host-control/.env.example`](host-control/.env.example) for the full list.
The minimum you need for local dev:

| Variable | Required | Purpose |
|---|---|---|
| `MAIN_PROJECT_URL` | yes | Where the host polls for the snapshot |
| `HOST_ADMIN_EMAIL` | yes | Login email |
| `HOST_ADMIN_PASSWORD` | yes | Login password (change from `hostoverseer`!) |
| `SYNC_TOKEN` | no | Shared webhook secret |
| `GEMINI_API_KEY`, `GROQ_API_KEY` | no | Intelligence Console providers |
| `EMAIL_USER`, `EMAIL_PASS`, `SMTP_HOST`, `SMTP_PORT` | no | SMTP email |
| `BREVO_API_KEY`, `RESEND_API_KEY`, `ALERT_EMAIL_FROM` | no | HTTP email APIs |

---

## Security posture

| Surface | Mechanism |
|---|---|
| Main-app password storage | PBKDF2-SHA256, 100 000 iterations, 128-bit per-user salt |
| Host-admin password storage | PBKDF2-SHA256 (verifier), compared in constant time |
| Session (main) | Hash-routed + cookie, validated server-side |
| Session (host) | **HMAC-SHA256 signed httpOnly cookie**, 8-hour TTL |
| Host-admin lockout | **6 failed attempts → 10-minute IP lockout** (in-memory) |
| Host → Main webhook | Optional `x-sync-token` shared secret |
| All `/api/admin/*` routes | Reject without a valid host session (401) |
| Audit | Append-only — login attempts, decisions, broadcasts, emails all audited |
| Secrets | Env-only — never in code, never in client bundle |
| Tabs opened from landing | `target="_blank"` + `rel="noopener,noreferrer"` (tab-nabbing-safe) |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `npm install` fails with peer-dep errors | Always use `--legacy-peer-deps` (or `bun install`) |
| Host mirror shows `AWAITING PUSH` forever | Open the main app in a browser and log in — its client pushes the snapshot every 45 s |
| Host shows `STALE` badge | Main app not reachable from the host's server — check `MAIN_PROJECT_URL` and any Vercel preview-password protection |
| Approvals never appear even though main has new projects | First successful sync baselines existing records — only REAL new items become approvals. Trigger a fresh sync after baseline. |
| `prisma generate` fails on Vercel | Make sure `DATABASE_URL` is set; or use the SQLite schema in `prisma/schema.sqlite.prisma` |
| The new Host Control dropdown doesn't open | Make sure you're on v23+ of `landing-view.tsx`; the dropdown is click-outside + Escape-aware, so click inside first |
| Email sends but shows as `SIMULATED` | No email provider configured. Set `EMAIL_USER`+`EMAIL_PASS` (Gmail App Password) **or** `BREVO_API_KEY` |

---

## Roadmap

- **WebSocket push** for the host mirror (currently 5 s poll — fine for the demo, not for thousands of projects)
- **Multi-tenant orgs** (today it's one ministry, one portfolio)
- **Two-way approvals** — let the host push back decisions to main (today main → host only)
- **Native mobile shell** (currently fully responsive, no PWA install prompt)
- **Offline-first field app** for site officers with queued uploads

---

## Team NEXGEN

Built by **Team NEXGEN** at **Amrita Vishwa Vidyapeetham, Chennai Campus**, for
**Smart India Hackathon 2026**, Problem Statement **SIH26103**
(Smart Automation · Software).

> *The whole platform lives at one secure web address — open it in any browser,
> sign in, and the portfolio is live. The same pipeline that powers the demo is
> documented end-to-end for production rollout.*

---

## License

MIT — see the SIH 2026 problem statement brief for the official usage terms.
The codebase is open for the ministry, NIC, and any reviewing body to inspect,
> extend, and deploy.
