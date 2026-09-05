# ProjectAssure Host Control

> **The master control plane for the ProjectAssure portfolio.**
> One pane of glass for India's central-sector infrastructure — mission control, approvals, budget risk, alerts aggregation, intelligence console, audit trail, and a public demo showcase.
>
> SIH 2026 · SIH26103 · Team NEXGEN · Amrita Vishwa Vidyapeetham Chennai

This is a **separate, standalone Next.js 16 deployment** that controls the main ProjectAssure prototype at [https://project-assure.vercel.app](https://project-assure.vercel.app). It does NOT replace the prototype — it sits on top of it, polls its `/api/health`, mirrors its seed data, and presents an aggregated portfolio view for the **Chief Programme Officer** persona.

---

## Table of Contents

1. [What is this?](#what-is-this)
2. [Architecture](#architecture)
3. [Feature list](#feature-list)
4. [Tech stack](#tech-stack)
5. [Quick start (local dev)](#quick-start-local-dev)
6. [Deploy to Vercel as a SEPARATE project](#deploy-to-vercel-as-a-separate-project)
7. [Environment variables](#environment-variables)
8. [Connecting host-control ↔ main prototype](#connecting-host-control--main-prototype)
9. [Admin persona demo credentials](#admin-persona-demo-credentials)
10. [Project structure](#project-structure)
11. [API reference](#api-reference)
12. [Troubleshooting](#troubleshooting)

---

## What is this?

The main ProjectAssure prototype is a **per-user project-monitoring app** — a project manager logs in, sees their 10 projects, gets delay predictions, raises approvals, exports reports. That is great for an individual officer but useless for the Chief Programme Officer who needs to see **all 1,800+ projects across 5 MoSPI divisions at once**.

**Host Control is that birds-eye view.** It is a separate Vercel project (different URL, different repo, different env vars) that:

- **Polls** the main prototype's `/api/health` every 5 seconds and shows a live status indicator.
- **Mirrors** the prototype's seed portfolio (30 demo projects, 4 personas, 8 sample approvals, 8 sample alerts) in-memory + localStorage.
- **Aggregates** everything into one admin console — KPIs, health bands, top-5 at-risk projects, approval queue, budget variance, alert feed, audit trail.
- **Approves / rejects** change orders, budget increases, extension-of-time requests, procurement sign-offs — every decision is logged.
- **Broadcasts** custom alerts to all 30 projects in one click.
- **Asks** the same Gemini/Groq/OpenRouter/OpenAI intelligence chain as the prototype, with a **universal mode** for free-form Q&A.
- **Shows** a public-facing demo showcase that links back to the main prototype for visitors to try.

The admin persona is the **Chief Programme Officer** with role `ADMIN` — `Arun Kulkarni`, Joint Secretary, MoSPI.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Vercel — 2 separate projects                    │
│                                                                          │
│   ┌─────────────────────────────┐    ┌──────────────────────────────┐  │
│   │  project-assure.vercel.app   │    │  host-control.vercel.app      │  │
│   │  (the MAIN prototype)        │    │  (THIS repo)                   │  │
│   │                              │    │                                │  │
│   │  • Per-user PM app           │    │  • Chief Programme Officer     │  │
│   │  • 4 demo personas           │    │    admin console               │  │
│   │  • Prisma + SQLite           │    │  • In-memory + localStorage    │  │
│   │  • /api/health               │◄───┤  • Polls /api/health every 5s  │  │
│   │  • /api/ai/chat (Gemini… )   │    │  • /api/admin/sync (mirror)    │  │
│   │  • /api/auth/login           │    │  • /api/admin/approve          │  │
│   │  • /api/users                │    │  • /api/admin/alert (broadcast)│  │
│   │                              │    │  • /api/ai/chat (universal)    │  │
│   │   Different repo             │    │  • /api/ai/status              │  │
│   │   Different env vars         │    │                                │  │
│   └─────────────┬───────────────┘    └────────────┬───────────────────┘  │
│                 │                                  │                      │
│                 │   (optional) webhook POST       │                      │
│                 └─────────────────────────────────►                      │
│                   /api/admin/sync with                             │      │
│                   x-webhook-secret header                          │      │
└─────────────────────────────────────────────────────────────────────────┘
                                                                    │
                                                                    ▼
                                                    ┌──────────────────────────┐
                                                    │  Google AI Studio (free)  │
                                                    │  Groq (free)              │
                                                    │  OpenRouter (free)        │
                                                    │  OpenAI (paid, optional) │
                                                    │  Built-in engine (zero)  │
                                                    └──────────────────────────┘
```

| Property | Main prototype | Host Control |
|---|---|---|
| Vercel project | `project-assure` | `project-assure-host-control` |
| GitHub repo | `ProjectAssure_SIH2026/prototype` | `ProjectAssure_SIH2026/host-control` |
| Port (local dev) | 3000 | **3001** |
| Database | Prisma + SQLite | None (in-memory + localStorage) |
| AI provider chain | Gemini → Groq → OpenRouter → OpenAI → built-in | Same |
| Admin persona | Joint Secretary, MoSPI | Chief Programme Officer |
| Primary user | Project Manager / Stakeholder / Viewer | Chief Programme Officer (ADMIN) |

---

## Feature list

| # | Feature | Description |
|---|---|---|
| 1 | **Mission Control** | 4 KPI tiles (projects, sanctioned, alerts, pending approvals) · health-band distribution bar · top-5 at-risk projects · live activity ticker · quick actions (broadcast / resync / open queue) |
| 2 | **Approval Centre** | Tabs: Change Orders / Budget Increases / Extension of Time / Procurement · each row shows project, requester, amount/duration, reason, risk score, recommended decision · approve / approve with conditions / reject · filter by status + department + search · decision logged in audit trail |
| 3 | **Budget Risk Management** | Org-wide utilisation gauge · variance histogram · top-5 worst overruns · editable thresholds (AMBER/RED/WARN %) · forecast-vs-actual chart · per-department breakdown table |
| 4 | **Alerts Aggregation Feed** | Live feed (polls every 5s) · filter by severity / department / source (demo vs fresh-user) / status · broadcast alert button · export CSV · stats bar (total/unread/critical/acknowledged) |
| 5 | **User & Tenant Management** | Table of demo personas + simulated fresh users · columns: name, role, email, dept, projects owned, last active · row click → user detail drawer showing their projects, alerts, approvals · "Simulate Fresh User" button · toggle: all / demo / fresh |
| 6 | **Intelligence Console** | Universal AI chat · universal vs grounded mode toggle · file upload (PDF, Excel, CSV, TXT, images) · export conversation as PDF/Markdown/TXT · provider status indicator · quick admin prompts · settings: temperature, max tokens, model · token counter · built-in engine fallback |
| 7 | **Integrations** | Main project URL input + connection test · status grid (main project, AI provider, email, webhook) · inbound webhook URL + shared secret · env vars reference table · "Open main project" button |
| 8 | **Demo Showcase** | Public-facing landing section · hero "ProjectAssure Control Plane — one pane of glass for India's infrastructure portfolio" · 4 demo project cards with "Try in main app" buttons · stats showcase · CTA "Connect your ministry's portfolio" |
| 9 | **Audit Trail** | Append-only log of every admin action · columns: timestamp, admin, action, target, note · filter by action type · export CSV · search |
| 10 | **Real-time sync** | Polls `/api/admin/sync` every 5 seconds · live indicator in top bar (green pulsing dot) · also probes main project `/api/health` when URL configured · "Force resync" button · last sync timestamp displayed |

---

## Tech stack

- **Framework**: Next.js 16 with App Router (TypeScript 5)
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style)
- **State**: Zustand (with persist middleware for preferences)
- **Icons**: lucide-react
- **Animations**: framer-motion
- **Charts**: recharts
- **Intelligence**: z-ai-web-dev-sdk + native fetch to Gemini / Groq / OpenRouter / OpenAI
- **Exports**: jspdf (PDF) + xlsx (Excel) + native CSV
- **Database**: NONE (in-memory + localStorage mirror). Prisma schema exists only so `prisma generate` succeeds during `postinstall`.
- **Color palette**: ministry blue `#0c93e7` / `#0b426e` / `#072b49` + status emerald/amber/rose. **No indigo or violet.**

---

## Quick start (local dev)

```bash
# 1. cd into the host-control project
cd host-control

# 2. install deps (npm works fine; bun also works)
npm install
# or: bun install

# 3. copy env template and fill in any keys you have (all optional — app runs without them)
cp .env.example .env.local
# edit .env.local — at minimum set:
#   MAIN_PROJECT_URL=https://project-assure.vercel.app
#   GEMINI_API_KEY=...       (free, https://aistudio.google.com/apikey)

# 4. run dev — runs on port 3001 (different from the prototype's 3000)
npm run dev
# → http://localhost:3001
```

Open `http://localhost:3001` — the host-control hydrates from `/api/admin/sync` on first load and then polls every 5 seconds.

> **Note for sandbox / preview users**: in this restricted cloud environment you cannot visit `http://localhost:3001` directly. Use the **Preview Panel** on the right side of the interface and click the **"Open in New Tab"** button to view the app externally.

---

## Deploy to Vercel as a SEPARATE project

This is the critical step — host-control MUST be its own Vercel project, NOT a sub-path of the main prototype.

### Step-by-step

1. **Push `host-control/` to its own GitHub repo.**

   ```bash
   cd host-control
   git init
   git add .
   git commit -m "feat: ProjectAssure Host Control — master control plane (SIH 2026)"
   git branch -M main
   git remote add origin git@github.com:<your-org>/projectassure-host-control.git
   git push -u origin main
   ```

   > The repo must be SEPARATE from the prototype's repo. Two repos, two Vercel projects.

2. **Import to Vercel as a NEW project.**

   - Go to [vercel.com/new](https://vercel.com/new)
   - Select the `projectassure-host-control` repo
   - Vercel auto-detects Next.js — keep defaults
   - **Project name**: `project-assure-host-control` (or your preferred name)
   - **Framework preset**: Next.js
   - **Root directory**: `./` (the repo root is the Next.js app)
   - **Build command**: `next build` (leave default)
   - **Output directory**: leave default
   - **Install command**: `npm install` (leave default — `.npmrc` has `legacy-peer-deps=true`)

3. **Set environment variables** (Project → Settings → Environment Variables):

   | Key | Value | Required? |
   |---|---|---|
   | `MAIN_PROJECT_URL` | `https://project-assure.vercel.app` | YES — points host-control at the main prototype |
   | `GEMINI_API_KEY` | `AIzaSy…` (from [Google AI Studio](https://aistudio.google.com/apikey)) | Recommended (free, first-choice provider) |
   | `GROQ_API_KEY` | `gsk_…` (from [console.groq.com](https://console.groq.com)) | Optional (free fallback) |
   | `OPENROUTER_API_KEY` | `sk-or-…` (from [openrouter.ai](https://openrouter.ai)) | Optional (free community models) |
   | `OPENAI_API_KEY` | `sk-…` | Optional (paid last-resort fallback) |
   | `WEBHOOK_SECRET` | `whsec_…` (any random string) | Optional — only if you wire up the inbound webhook |

4. **Deploy.** Vercel builds + provisions + gives you a URL like `https://project-assure-host-control.vercel.app`.

5. **(Optional) Configure the webhook on the main prototype** so it pushes events to host-control:
   - On the main prototype repo, add an env var `HOST_CONTROL_WEBHOOK_URL=https://project-assure-host-control.vercel.app/api/admin/sync`
   - Add `HOST_CONTROL_WEBHOOK_SECRET=<same value as WEBHOOK_SECRET on host-control>`
   - In the main prototype's alert/approval-raised handlers, POST to that URL with `x-webhook-secret` header
   - The host-control's `/api/admin/sync` POST route validates the secret and acknowledges receipt

6. **Verify.** Open the deployed host-control URL. The Integrations panel should show:
   - Main project URL: `https://project-assure.vercel.app` → **Connected**
   - Intelligence provider: `live intelligence service · connected` (if Gemini key is set)
   - Live sync indicator: green pulsing dot in the top bar

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `MAIN_PROJECT_URL` | YES | `https://project-assure.vercel.app` | URL of the main ProjectAssure prototype. Host-control polls its `/api/health` and links to it from the Demo Showcase. |
| `GEMINI_API_KEY` | Recommended | — | Free-tier Google AI Studio key — first-choice intelligence provider. [Get one](https://aistudio.google.com/apikey). |
| `GOOGLE_API_KEY` | alt | — | Accepted as an alias for `GEMINI_API_KEY`. |
| `GROQ_API_KEY` | Optional | — | Free-tier Groq key — OpenAI-compatible fallback. [Get one](https://console.groq.com). |
| `OPENROUTER_API_KEY` | Optional | — | OpenRouter key — free community models fallback. |
| `OPENAI_API_KEY` | Optional | — | Paid OpenAI key — last-resort fallback. |
| `WEBHOOK_SECRET` | Optional | — | Shared secret the main project sends in `x-webhook-secret` header when POSTing events to `/api/admin/sync`. |
| `DATABASE_URL` | Optional | `file:./dev.db` | SQLite URL — only used by the empty Prisma schema; not required for the demo. |

All keys are OPTIONAL. Without any of them, the app runs in **built-in engine mode** (deterministic answers) and the Integrations panel shows "built-in engine · not connected".

---

## Connecting host-control ↔ main prototype

The connection is one-way by default (host-control polls main):

```
host-control  ──every 5s──►  GET main-prototype/api/health
host-control  ──on demand──►  GET main-prototype/api/users  (future)
```

For two-way sync (main prototype pushes events to host-control), set up the inbound webhook:

```
main-prototype  ──on event──►  POST host-control/api/admin/sync
                                Header: x-webhook-secret: <WEBHOOK_SECRET>
                                Body: { event, project, alert }
```

The webhook contract is documented in the **Integrations** panel of the running app — copy the inbound URL and shared secret from there.

---

## Admin persona demo credentials

The host-control ships with one admin persona (no password — the app is open by design for the SIH demo):

| Field | Value |
|---|---|
| Name | Arun Kulkarni |
| Email | arun.kulkarni@mospi.gov.in |
| Role | `ADMIN` |
| Designation | Chief Programme Officer, MoSPI |
| Persona | "Chief Programme Officer (Host)" |
| Avatar | AK |
| Phone | +91 98200 11223 |

The 4 demo personas from the main prototype are also mirrored in the Users panel:

| Persona | Role | Email |
|---|---|---|
| Arun Kulkarni (Joint Secretary) | ADMIN | arun.kulkarni@mospi.gov.in |
| Priya Venkatesh (Director, Projects) | PROJECT_MANAGER | priya.venkatesh@mospi.gov.in |
| Sneha Iyer (Deputy Director, Analysis) | STAKEHOLDER | sneha.iyer@mospi.gov.in |
| Meera Nair (Director, PMO Coordination) | VIEWER | meera.nair@pmo.gov.in |

---

## Project structure

```
host-control/
├── package.json                     # Next 16, React 19, Tailwind 4, shadcn deps,
│                                    # z-ai-web-dev-sdk, lucide-react, framer-motion,
│                                    # zustand, recharts, jspdf, xlsx
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json                  # shadcn (New York style)
├── eslint.config.mjs
├── .env.example
├── .gitignore
├── .npmrc                           # legacy-peer-deps=true
├── README.md                        # this file
├── prisma/
│   └── schema.prisma                # minimal User model (DB not used by app)
├── public/
│   ├── logo.svg                     # ProjectAssure host-control logo
│   └── robots.txt
└── src/
    ├── app/
    │   ├── layout.tsx               # Inter font + ThemeProvider + Sonner toaster
    │   ├── page.tsx                  # single-route entry — renders AppShell + active view
    │   ├── globals.css              # design tokens + keyframes + custom scrollbar
    │   └── api/
    │       ├── ai/chat/route.ts      # universal + grounded AI chat (Gemini → Groq → … → built-in)
    │       ├── ai/status/route.ts    # cached (90s) provider probe
    │       ├── admin/approve/route.ts # POST {type, id, decision, note} → audit + activity
    │       ├── admin/alert/route.ts  # POST broadcast alert to all projects
    │       ├── admin/sync/route.ts   # GET full mirror / POST inbound webhook
    │       └── health/route.ts       # self-status (used by Integrations panel)
    ├── components/
    │   ├── ui/                       # shadcn components (button, card, tabs, dialog, badge,
    │   │                             # input, textarea, switch, select, dropdown-menu, avatar,
    │   │                             # tooltip, separator, scroll-area, sheet, progress, skeleton,
    │   │                             # sonner, label, checkbox, popover)
    │   └── host/
    │       ├── app-shell.tsx         # admin shell with sidebar + top bar + sync polling
    │       ├── mission-dashboard.tsx # the control centre view
    │       ├── approval-centre.tsx   # change orders / budget / EoT / procurement queue
    │       ├── budget-risk.tsx       # org-wide budget risk view
    │       ├── alerts-feed.tsx       # aggregated live alerts + broadcast
    │       ├── user-management.tsx   # tenants / users table + drawer + simulate fresh
    │       ├── intelligence-console.tsx # universal AI with upload + export
    │       ├── integrations.tsx      # main project URL config + status
    │       ├── demo-showcase.tsx     # public-facing demo cards
    │       └── audit-trail.tsx       # admin action log
    ├── lib/
    │   ├── utils.ts                  # cn(), fmtINR(), fmtDate(), downloadText/CSV/XLSX/PDF,
    │   │                             # extractFileText(), nextId(), clamp()
    │   ├── db.ts                     # empty Prisma client (in-memory app)
    │   └── host/
    │       ├── seed.ts               # mirrored seed data (4 personas, 30 demo projects,
    │       │                         # 8 sample approvals, 8 sample alerts, dept breakdown,
    │       │                         # portfolio snapshot, demo showcase cards)
    │       ├── store.ts              # server-side in-memory state mirror
    │       ├── ai.ts                 # AI provider chain (Gemini → Groq → OpenRouter → OpenAI → z-ai → built-in)
    │       └── types.ts              # domain types
    └── store/
        └── admin-store.ts            # Zustand client store (hydrates from /api/admin/sync every 5s)
```

---

## API reference

| Route | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Self-status — host-control's own deployment posture + env var presence. Used by Integrations panel + external watchers. |
| `/api/admin/sync` | GET | Returns the full portfolio mirror (snapshot + users + projects + approvals + alerts + activity + audit + thresholds + integration + aiStatus + admin). Polled by client every 5s. |
| `/api/admin/sync` | POST | Inbound webhook — main project can POST events here. Validates `x-webhook-secret` header against `WEBHOOK_SECRET` env var. |
| `/api/admin/approve` | POST | Body: `{type, id, decision, note}`. Records an approval decision, appends to audit log + activity ticker. |
| `/api/admin/alert` | POST | Body: `{title, description, severity, recommendedAction, deadline}`. Broadcasts a custom alert to ALL projects in the portfolio. |
| `/api/ai/chat` | POST | Body: `{question, universal?, context?, dossier?, attachments?, temperature?, maxTokens?, user?}`. Returns `{answer, intent, provider, model, tokens, freshness}`. Provider chain: Gemini → Groq → OpenRouter → OpenAI → z-ai → built-in. |
| `/api/ai/status` | GET | Cached (90s) probe of which intelligence provider is live. Returns `{connected, tier, label, model, checkedAt}`. |

---

## Troubleshooting

### `npm install` fails with peer-dep errors

The `.npmrc` file sets `legacy-peer-deps=true` which should resolve all peer-dep conflicts. If you still see errors, try:

```bash
npm install --legacy-peer-deps
```

### Intelligence console shows "built-in engine"

This means no provider key is configured. Set at least `GEMINI_API_KEY` (free, [get one here](https://aistudio.google.com/apikey)). The Integrations panel shows the masked label and tier once a key is live.

### "Main project not reachable" in Integrations

- Check `MAIN_PROJECT_URL` is set correctly (no trailing slash, `https://` prefix)
- Click "Test connection" — if it fails, the main project may be down or blocking cross-origin requests. The host-control self-health check should still succeed (probes its own `/api/health`).
- The main prototype at [https://project-assure.vercel.app](https://project-assure.vercel.app) is the default URL.

### Chat returns 503 "no live provider"

This is the expected behaviour when no provider keys are configured. The host-control falls back to the built-in deterministic engine, so the chat never goes silent — you'll see a "Built-in engine" badge on the assistant's reply.

### Sync indicator stays amber

The sync indicator pulses green while polling is in flight. If it stays amber, open your browser DevTools → Network → look for `/api/admin/sync` requests. If they're failing, the deploy may not have the API routes built — redeploy.

### `prisma generate` fails on `postinstall`

The Prisma schema is intentionally minimal (one `User` model) and the app does NOT query it. If `prisma generate` fails for some reason on a CI build, you can either:
- Remove the `postinstall` script from `package.json`
- Or set `DATABASE_URL="file:./dev.db"` in your env (it's already the default in `.env.example`)

The app's host-control code paths do not import `@/lib/db`, so the app runs even if Prisma fails to generate.

---

## Credits

- **Team NEXGEN** · Amrita Vishwa Vidyapeetham Chennai
- **SIH 2026** · Problem Statement SIH26103
- Built on top of the ProjectAssure prototype (separate repo)
- Uses Google AI Studio (Gemini), Groq, OpenRouter, OpenAI as intelligence providers — all optional, all swappable
- shadcn/ui component library (New York style)
- Tailwind CSS 4 design tokens

---

*ProjectAssure Host Control · v1.0.0 · "Intelligence-powered predictive project monitoring for India's central-sector portfolio."*
