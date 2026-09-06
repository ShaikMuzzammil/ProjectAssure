# ProjectAssure — Prototype (v22)

**Smart India Hackathon 2026 · Problem SIH26103 · Smart Automation · Software**
**Team NEXGEN — Amrita Vishwa Vidyapeetham, Chennai Campus**

ProjectAssure is the intelligence cockpit that watches every rupee and every deadline across India's 1,800+ central-sector infrastructure projects.

> **Two-deployment structure** — this folder contains TWO separate Next.js apps:
> 1. **Main app** (root of `prototype/`) — the public dashboard, login, tracking, India map, geo-audit, AI assistant, prediction engine, reports. Deploy as one Vercel project.
> 2. **Host Control** (`prototype/host-control/`) — the master control tower for administrators. Deploy as a **separate** Vercel project (port 3001 in dev). It syncs with the main app via the `/api/sync/*` API.

---

## Folder structure

```
prototype/                          ← MAIN APP (Vercel project #1)
├── src/                            # Next.js source
│   ├── app/
│   │   ├── page.tsx                # Hash-routed AppRoot (landing/login/app)
│   │   ├── api/
│   │   │   ├── ai/                 # AI chat (z-ai-web-dev-sdk)
│   │   │   ├── auth/               # Register / login
│   │   │   ├── email/              # Email send + status
│   │   │   ├── sync/               # Main ↔ Host sync (push/state/commands/webhook)
│   │   │   ├── users/              # User list
│   │   │   └── health/             # Health probe
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/
│   │   ├── projectassure/          # Main app components + 3 NEW views
│   │   │   ├── views/              # tracking, geo-audit, india-map (NEW in v22)
│   │   │   ├── shared/             # Gantt, geo-evidence, ai-chat-panel
│   │   │   ├── shell/              # App shell
│   │   │   ├── landing/, auth/, about/, public/
│   │   │   └── app-root.tsx
│   │   └── ui/                     # shadcn/ui (60+ components)
│   ├── lib/
│   │   ├── projectassure/          # Engine (ml, rag, agent, geo, reports, etc.)
│   │   ├── sync/                   # Main ↔ Host sync client/server
│   │   └── db.ts                   # Prisma client
│   ├── store/
│   │   └── app-store.ts            # Zustand store
│   └── hooks/                      # use-mobile, use-toast
├── prisma/                         # Prisma schema (3 variants)
├── public/                         # logo.svg, robots.txt
├── package.json                    # Main app deps
├── next.config.ts, tsconfig.json, tailwind.config.ts, etc.
├── .env.example
├── vercel.json
│
└── host-control/                   ← HOST CONTROL (Vercel project #2 — SEPARATE)
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx            # Host Control UI (session gate → shell)
    │   │   ├── api/                # Host's OWN API (NOT merged with main app)
    │   │   │   ├── admin/          # users, approvals, broadcast, sync, settings, export
    │   │   │   ├── auth/           # login, logout, session
    │   │   │   ├── ai/             # chat, status
    │   │   │   ├── email/          # send, status
    │   │   │   └── health/
    │   │   ├── globals.css
    │   │   └── layout.tsx
    │   ├── components/host/        # Host UI components (shell, views, drawer)
    │   └── lib/
    │       ├── host/               # store, sync, auth, mailer, format, types
    │       ├── db.ts
    │       └── utils.ts
    ├── prisma/schema.prisma
    ├── public/robots.txt
    ├── package.json                # Host's OWN deps (separate from main app)
    ├── next.config.ts, tsconfig.json, etc.
    ├── .env.example, .gitignore, .npmrc
    ├── vercel.json
    └── README.md                   # Host-control API reference
```

---

## ✨ What's new in v22

| # | Feature | Where |
|---|---------|-------|
| 1 | **Real-Time Tracking Dashboard** — Gantt + interactive milestone status bars + 5s live refresh | `#/app/tracking` |
| 2 | **Geo-Tagged Site Audits** — GPS-locked photo upload with capture timestamps; auto-flags off-site photos | `#/app/geo-audit` |
| 3 | **India Project Map** — interactive Leaflet map of India with project pins coloured by delay probability | `#/app/india-map` |
| 4 | **AI-Driven Delay Prediction** — 18-feature ML model with confidence intervals + factor breakdown | `#/app/model-lab` |
| 5 | **Automated Alert System** — email + SMS simulation, escalates at 10% / 20% budget overrun | `#/app/alerts` |
| 6 | **Role-Based Access Control** — 4 roles (Admin / PM / Stakeholder / Viewer) — sidebar adapts | `src/lib/projectassure/permissions.ts` |
| 7 | **Enhanced Login Background** — animated mesh gradient + India silhouette + grid overlay | `src/components/projectassure/auth/login-view.tsx` |
| 8 | **Cleaner Landing Nav** — removed "Demo personas" + "Citizen view" from top nav (already in About) | `src/components/projectassure/landing/landing-view.tsx` |

---

## Two-deployment architecture

```
                        ┌─────────────────────────────────┐
                        │       Vercel Project #1        │
                        │   (main app — this folder)     │
                        │                                │
                        │   /                Landing     │
                        │   /#/login         Sign in     │
                        │   /#/app/tracking  Live Gantt  │
                        │   /#/app/india-map Leaflet     │
                        │   /#/app/geo-audit GPS photos  │
                        │   /#/app/model-lab ML predict  │
                        │   /api/sync/*      Sync API    │
                        └────────┬───────────────────────┘
                                 │ HTTP push/pull
                                 ▼
                        ┌─────────────────────────────────┐
                        │      Vercel Project #2         │
                        │  (host-control/ subfolder)      │
                        │                                │
                        │   /                Admin login │
                        │   /#/dashboard     KPI grid    │
                        │   /#/users         User mgmt  │
                        │   /#/approvals     Change ord.│
                        │   /#/alerts        Broadcast  │
                        │   /#/audit         Audit trail│
                        │   /api/admin/*      Host API  │
                        └────────────────────────────────┘
```

The main app pushes state changes to the host-control via `/api/sync/push`. The host-control polls the main app's `/api/sync/state` every 5s to keep its mirror warm.

---

## Quick start (local dev — run BOTH apps)

```bash
# Terminal 1 — Main app (port 3000)
cd prototype
npm install --legacy-peer-deps
cp .env.example .env
# Edit .env — set DATABASE_URL, NEXTAUTH_SECRET, NEXT_PUBLIC_HOST_URL
bun run db:push
bun run dev          # → http://localhost:3000

# Terminal 2 — Host Control (port 3001)
cd prototype/host-control
npm install --legacy-peer-deps
cp .env.example .env
# Edit .env — set HOST_CONTROL_ADMIN_EMAIL, HOST_CONTROL_ADMIN_PASSWORD_HASH,
#             MAIN_APP_URL=http://localhost:3000
bun run db:push
bun run dev          # → http://localhost:3001
```

Demo personas (every password is `demo1234`):
- `ananya.k@nic.in` — Administrator (main app)
- `priya.v@nic.in` — Project Manager (main app)
- `karthik.s@nic.in` — Stakeholder (financial auditor, main app)
- `rahul.s@nhai.gov.in` — Project Manager (roads, main app)
- Host Control admin: configured via `HOST_CONTROL_ADMIN_EMAIL` env var

---

## Deploy to Vercel (two separate projects)

### Project 1 — Main app

1. Push this `prototype/` folder to a GitHub repo (root of `main`).
2. On [vercel.com/new](https://vercel.com/new), import the repo.
3. **Root Directory** → leave as `/` (project root).
4. Framework → Next.js. Build → `next build`. Install → `npm install --legacy-peer-deps`.
5. Env vars: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_HOST_URL` (will be the host-control URL after step 2).
6. Deploy → e.g., `https://projectassure.vercel.app`.

### Project 2 — Host Control

1. On Vercel, import the **same GitHub repo**.
2. **Root Directory** → set to `host-control/` (NOT `/`).
3. Framework → Next.js. Build → `next build`. Install → `npm install --legacy-peer-deps`.
4. Env vars: `DATABASE_URL` (can be same Postgres), `HOST_CONTROL_ADMIN_EMAIL`, `HOST_CONTROL_ADMIN_PASSWORD_HASH`, `MAIN_APP_URL=https://projectassure.vercel.app`.
5. Deploy → e.g., `https://projectassure-host.vercel.app`.
6. Back in Project 1, set `NEXT_PUBLIC_HOST_URL=https://projectassure-host.vercel.app` and redeploy.

> Both apps share the same database; per-row `app` field isolates main-app data from host-control mirror data.

See `DEPLOYMENT.md` for full Vercel/Docker/on-prem instructions.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | shadcn/ui + Tailwind 4 + Radix + Framer Motion |
| State | Zustand + TanStack Query |
| Database | Prisma ORM + PostgreSQL (or SQLite locally) |
| Maps | Leaflet 1.9 (CDN-loaded, India-friendly) |
| Charts | Recharts |
| AI | z-ai-web-dev-sdk (chat + vision + RAG) |
| Auth | Web Crypto (PBKDF2 for main; PBKDF2-SHA256 for host) |
| Email | Nodemailer (optional SMTP) |
| Export | jsPDF + xlsx (SheetJS) |

---

## Role-based access control (main app)

| Role | Sidebar | Can do |
|------|---------|--------|
| **ADMIN** | Dashboard, Live Tracking, India Map, Projects, AI, Prediction, Reports, Email, Help, Admin | Everything |
| **PROJECT_MANAGER** | Dashboard, Live Tracking, Geo-Audit, India Map, Projects, AI, Prediction, Reports, Email, Help | Create/edit projects, upload docs, submit evidence, run predictions |
| **STAKEHOLDER** | Dashboard, Live Tracking, India Map, Projects, AI, Reports, Help | Read-only oversight, exports, alerts |
| **VIEWER** | Dashboard, India Map, Projects, AI, Help | Read-only briefing |

---

## Documentation

- `DEPLOYMENT.md` — Step-by-step Vercel (2 projects) + Docker + on-prem
- `host-control/README.md` — Host Control API reference + store design
- `docs/USER_GUIDE.md` — End-user walkthrough
- `docs/TEAM_GUIDE.md` — Developer onboarding
- `docs/WORKFLOWS.md` — 15 numbered user workflows
- `docs/reference-md/` — Deep dives (architecture, tech stack, DB schema, API design, AI/ML engine, UI/UX system, DevOps, build prompts)

---

## Live demo flow (for the jury)

1. Open the main app URL → landing page (cleaner nav).
2. Click **Launch demo** → login page (enhanced animated background).
3. Sign in as `ananya.k@nic.in` / `demo1234` (Admin).
4. Click **Live Tracking** → milestone status bars + 5s live feed.
5. Click **India Map** → interactive Leaflet map, click any pin.
6. Click **Geo-Audit** → upload a site photo, see GPS lock + verification.
7. Click **Prediction Engine** → run a delay prediction.
8. Click **Email Centre** → send a portfolio report to any email.
9. Open the host-control URL in a new tab → admin login → control tower.
10. Back in main app, sign in as `karthik.s@nic.in` → role-scoped sidebar.

---

## Team NEXGEN

Built by Team NEXGEN at Amrita Vishwa Vidyapeetham, Chennai Campus, for Smart India Hackathon 2026, Problem Statement SIH26103 (Smart Automation · Software).
