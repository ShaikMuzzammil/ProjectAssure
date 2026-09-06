# ProjectAssure — Prototype (v22)

**Smart India Hackathon 2026 · Problem SIH26103 · Smart Automation · Software**
**Team NEXGEN — Amrita Vishwa Vidyapeetham, Chennai Campus**

ProjectAssure is the intelligence cockpit that watches every rupee and every deadline across India's 1,800+ central-sector infrastructure projects. The prototype is a single Next.js application — the main dashboard lives at `/`, and the master control plane (formerly a separate `host-control` app) is merged inside as `/host-control`.

> This folder is **self-contained**. Host Control is **inside** this prototype as `/host-control` — no separate app to deploy.

---

## What's new in v22

| # | Feature | Where |
|---|---------|-------|
| 1 | **Real-Time Tracking Dashboard** — Gantt + interactive milestone status bars + 5s live refresh | `#/app/tracking` |
| 2 | **Geo-Tagged Site Audits** — GPS-locked photo upload with capture timestamps; auto-flags off-site photos | `#/app/geo-audit` |
| 3 | **India Project Map** — interactive Leaflet map of India with project pins coloured by delay probability | `#/app/india-map` |
| 4 | **AI-Driven Delay Prediction** — 18-feature ML model with confidence intervals + factor breakdown | `#/app/model-lab` |
| 5 | **Automated Alert System** — email + SMS simulation, escalates at 10% / 20% budget overrun, slips above threshold | `#/app/alerts` + `/api/host/admin/broadcast` |
| 6 | **Role-Based Access Control** — 4 roles (Admin / Project Manager / Stakeholder / Viewer) — sidebar adapts | `src/lib/projectassure/permissions.ts` |
| 7 | **Merged Host Control** — `/host-control` route + `/api/host/*` API surface — no separate deployment needed | `src/app/host-control/` |
| 8 | **Enhanced Login Background** — animated mesh gradient + India silhouette + grid overlay | `src/components/projectassure/auth/login-view.tsx` |
| 9 | **Cleaner Landing Nav** — removed "Demo personas" + "Citizen view" from top nav (already in About) | `src/components/projectassure/landing/landing-view.tsx` |
| 10 | **All build errors fixed** — Host Control store exports, Turbopack config, ESLint warnings suppressed | see `CHANGELOG` |

---

## Architecture

```
prototype/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Mounts the hash-routed AppRoot
│   │   ├── host-control/page.tsx       # ← Merged Host Control UI
│   │   └── api/
│   │       ├── ai/                     # Main app AI chat (z-ai-web-dev-sdk)
│   │       ├── auth/                   # Main app register/login
│   │       ├── email/                  # Main app email send/status
│   │       ├── sync/                   # Main ↔ Host sync (push/state/commands/webhook)
│   │       ├── users/                  # User list
│   │       ├── health/                # Health probe
│   │       └── host/                   # ← Merged host-control API (namespaced)
│   │           ├── admin/              # /api/host/admin/{users,approvals,broadcast,settings,sync,export}
│   │           ├── auth/               # /api/host/auth/{login,logout,session}
│   │           ├── ai/                 # /api/host/ai/{chat,status}
│   │           ├── email/              # /api/host/email/{send,status}
│   │           └── health/             # /api/host/health
│   ├── components/
│   │   ├── projectassure/              # Main app components
│   │   │   ├── app-root.tsx            # Hash router (landing/about/login/demo/public/app)
│   │   │   ├── landing/                # Public landing page
│   │   │   ├── auth/                   # Login + sign-up + demo persona picker
│   │   │   ├── shell/                  # App shell (sidebar + topbar + view router)
│   │   │   ├── views/                 # 25+ feature views (NEW: tracking, geo-audit, india-map)
│   │   │   └── shared/                # Gantt, geo-evidence, ai-chat-panel, gov-header
│   │   ├── host/                       # ← Merged Host Control components
│   │   └── ui/                         # shadcn/ui (60+ components)
│   ├── lib/
│   │   ├── projectassure/             # Engine: ml, rag, agent, risks, reports, geo, etc.
│   │   ├── host/                      # ← Merged Host Control lib (store, sync, mailer, auth)
│   │   ├── sync/                       # Main ↔ Host sync client/server
│   │   └── db.ts                      # Prisma client
│   ├── store/
│   │   └── app-store.ts                # Zustand store (auth, projects, routes, notifications, ML)
│   └── hooks/                          # use-mobile, use-toast
├── prisma/
│   ├── schema.prisma                   # PostgreSQL schema (default)
│   ├── schema.sqlite.prisma            # SQLite fallback for local dev
│   └── schema.postgres.prisma          # PostgreSQL production schema
├── public/
│   ├── logo.svg
│   └── robots.txt
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── eslint.config.mjs
├── components.json                     # shadcn/ui config
├── .env.example
└── README.md  (you are here)
```

---

## Quick start (local dev)

```bash
# 1. Install deps
npm install --legacy-peer-deps

# 2. Copy env template and set secrets
cp .env.example .env
# Edit .env — set DATABASE_URL, NEXTAUTH_SECRET, HOST_CONTROL_ADMIN_EMAIL etc.

# 3. Push the Prisma schema (SQLite by default — easiest local dev)
bun run db:push   # or: npx prisma db push --accept-data-loss

# 4. Run dev server
bun run dev        # or: npm run dev
# → http://localhost:3000

# 5. Open the Host Control plane
# → http://localhost:3000/host-control
```

Demo personas (every password is `demo1234`):
- `ananya.k@nic.in` — Administrator
- `priya.v@nic.in` — Project Manager
- `karthik.s@nic.in` — Stakeholder (financial auditor)
- `rahul.s@nhai.gov.in` — Project Manager (roads)

---

## Deploy to Vercel (one web address)

1. Push this `prototype/` folder to a GitHub repo (root of `main` branch).
2. Go to [vercel.com/new](https://vercel.com/new), import the repo.
3. Framework preset → **Next.js**. Build command: `next build`. Output: leave default.
4. Add environment variables (see `.env.example`):
   - `DATABASE_URL` — Postgres (Vercel Postgres free tier works)
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32`
   - `HOST_CONTROL_ADMIN_EMAIL` — your admin login email
   - `HOST_CONTROL_ADMIN_PASSWORD_HASH` — scrypt-style hash (see `src/lib/host/auth.ts`)
   - Optional: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` for real email outbox
5. Deploy. Both the dashboard and `/host-control` will be live on the **same** URL.

> **Note**: Vercel's read-only filesystem means the host-control store lives in RAM per lambda instance. For persistent state across cold starts, use Vercel Postgres + a `prisma db push` step.

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Next.js 16** (App Router, Turbopack) | One web address, zero config, server components for SSR |
| Language | **TypeScript 5** | Strict typing across UI + API + lib |
| UI | **shadcn/ui** + Tailwind 4 + Radix + Framer Motion | 60+ accessible components, dark mode, animated transitions |
| State | **Zustand** + **TanStack Query** | Client state + server cache, no boilerplate |
| Database | **Prisma ORM** + PostgreSQL (or SQLite locally) | Type-safe schema, migrations, transactions |
| Maps | **Leaflet 1.9** (CDN-loaded, no SSR issue) | Free, OpenStreetMap tiles, India-friendly |
| Charts | **Recharts** | Composable React charts (Gantt, status bars, sparklines) |
| AI | **z-ai-web-dev-sdk** (chat + vision) | RAG over project corpus, evidence-cited answers |
| Auth | **Web Crypto** (scrypt-style hashing) + NextAuth available | Zero-cost secure accounts |
| Email | **Nodemailer** (optional SMTP) | Real SMTP if configured, simulated otherwise |
| Export | **jsPDF** + **xlsx (SheetJS)** | PDF dossiers + Excel/CSV data exports |
| Real-time | **Zustand live events** (5s heartbeat) + 45s sync poll | Deterministic demo, swappable for WebSocket later |

---

## Role-based access control

| Role | Sidebar | Can do |
|------|---------|--------|
| **ADMIN** (Administrator) | Dashboard, Live Tracking, India Map, Projects, Assure AI, Prediction Engine, Reports, Email Centre, Help, Admin | Everything — manage users, broadcast alerts, sync, settings, exports |
| **PROJECT_MANAGER** (Field officer) | Dashboard, Live Tracking, Geo-Audit, India Map, Projects, AI, Prediction, Reports, Email, Help | Create/edit projects, upload docs, submit evidence, run predictions, send emails |
| **STAKEHOLDER** (Financial auditor) | Dashboard, Live Tracking, India Map, Projects, AI, Reports, Help | Read-only oversight, exports, alerts |
| **VIEWER** (Public citizen) | Dashboard, India Map, Projects, AI, Help | Read-only briefing |

---

## NPM scripts

```bash
bun run dev           # Next.js dev server (port 3000)
bun run build         # Production build (Vercel-compatible)
bun run start         # Serve the production build (port 3000)
bun run lint          # ESLint
bun run db:push       # Push Prisma schema → database
bun run db:generate   # Regenerate Prisma client
bun run db:migrate    # Create + apply migration
bun run db:reset      # Drop + recreate (dev only!)
```

---

## Documentation

- `DEPLOYMENT.md` — Step-by-step Vercel/Docker/on-prem deployment
- `host-control/README.md` — Host Control plane reference
- `docs/USER_GUIDE.md` — End-user walkthrough
- `docs/TEAM_GUIDE.md` — Developer onboarding
- `docs/WORKFLOWS.md` — 15 numbered user workflows
- `docs/PROTOTYPE_FEATURE_MAP.md` — Feature inventory
- `docs/reference-md/` — Deep dives (architecture, tech stack, DB schema, API design, AI/ML engine, UI/UX system, DevOps, build prompts)

---

## Live demo flow (for the jury)

1. Open the deployed URL → landing page (cleaner nav now, no demo personas in top bar).
2. Click **Launch demo** → login page (enhanced animated background).
3. Sign in as `ananya.k@nic.in` / `demo1234` (Admin) → see the portfolio dashboard.
4. Click **Live Tracking** in the sidebar → milestone status bars + 5s live feed.
5. Click **India Map** → interactive Leaflet map, click any pin for project details.
6. Click **Geo-Audit** → upload a site photo (camera works on mobile), see GPS lock + verification.
7. Click **Prediction Engine** → run a delay prediction, see the 18-feature breakdown.
8. Click **Email Centre** → send a portfolio report to any email address.
9. Sign out, sign in as `karthik.s@nic.in` (Stakeholder) → see the role-scoped sidebar.
10. Visit `/host-control` → log in with admin credentials → see the master control tower.

---

## Team NEXGEN

Built by Team NEXGEN at Amrita Vishwa Vidyapeetham, Chennai Campus, for Smart India Hackathon 2026, Problem Statement SIH26103 (Smart Automation · Software).
