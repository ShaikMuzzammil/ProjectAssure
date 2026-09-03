<div align="center">

# 🛡️ ProjectAssure

### AI-Powered Predictive Project Monitoring Platform

**One dashboard for India's projects — predicts delays 30–60 days early, reads reports itself, and recommends the next best action.**

Smart India Hackathon 2026 · Problem Statement **SIH26103** · Organisation **MoSPI** (Ministry of Statistics & Programme Implementation)
Theme: *Smart Automation* · **Team NEXGEN**

`Next.js 16` · `React 19` · `TypeScript` · `Tailwind CSS 4` · `shadcn/ui` · `Recharts` · `Zustand` · `Framer Motion`

[Live Demo](#-quick-start) · [Deployment Guide](./DEPLOYMENT.md) · [How It Works](./HOW_IT_WORKS.md) · [Feature Map](#-complete-feature-map) · [Architecture](#-architecture)

</div>

---

## 📖 About

Government of India ministries monitor thousands of infrastructure projects through **27,000+ pages of monthly PDF reports** — a manual, reactive process where delays and cost overruns are discovered only after they happen. **ProjectAssure** flips that model:

| Traditional monitoring | ProjectAssure |
|---|---|
| Delays discovered after they happen | ML model flags delay risk **30–60 days early** |
| Officers read thousands of PDF pages | Document AI **reads reports itself** and extracts structured data |
| Escalations via emails & meetings | Every alert ships with a **recommended action, owner & deadline** |
| Fragmented portals per ministry | **One dashboard** — portfolio, analytics, AI, alerts, reports, admin |
| Expensive data-centre hosting | **₹0/month** on free-tier Vercel + Neon + Upstash |

> ⚠️ **Prototype notice:** This is a fully client-side *deterministic simulation* built for the SIH 2026 evaluation. The ML scoring, agentic AI and document intelligence are faithful, explainable re-implementations of the production design (see `src/lib/projectassure/`), running on 30 seeded projects with a fixed PRNG (`mulberry32(42)`) so every reload reproduces the same demo world. No backend or real API keys are required.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies (Node.js 18.18+ or 20+ required)
npm install

# 2. Start the dev server
npm run dev

# 3. Open the app
#    http://localhost:3000
```

That's it — **no database, no environment variables, no API keys** needed for the prototype. Everything runs in the browser.

### Production build

```bash
npm run build     # compiled + type-checked (strict mode, no ignored errors)
npm run start     # serve the production build on :3000
npm run lint      # ESLint
```

### Demo credentials

The login screen is a **persona picker** — click any of the 6 personas and hit **Sign in with SSO** (any password works, the field is pre-filled):

| Persona | Name | Role | What they see |
|---|---|---|---|
| 🏛️ The Portfolio Overseer | Arun Kulkarni | `ADMIN` | Full portfolio + Administration |
| 📋 The Ministry Project Manager | Priya Venkatesh | `PROJECT_MANAGER` | Own projects, Gantt, actions |
| 📡 The Field Reporting Officer | Rahul Sharma | `PROJECT_MANAGER` | Report uploads, alerts |
| 📊 The MoSPI Data Analyst | Sneha Iyer | `STAKEHOLDER` | Reports & document intelligence |
| 🔍 The Accountability Auditor | Vikram Desai | `STAKEHOLDER` | Audit trails, exports |
| 👁️ The Strategic Observer | Meera Nair | `VIEWER` | Read-only dashboards |

RBAC is enforced in `src/components/projectassure/views/settings-view.tsx` and across views via `user.role`.

---

## ✨ Complete Feature Map

### 1️⃣ Command Centre (Dashboard) — `dashboard-view.tsx`
- **Portfolio KPI strip**: 30 projects · active count · total sanctioned (₹2,191 Cr) · healthy/at-risk/critical counts with drill-down
- **Health distribution** donut (GREEN ≥75 / AMBER 50–74 / RED <50) with interactive legend
- **Budget utilisation** radial gauge (spend vs sanction) with overrun warning banner
- **Critical alerts feed** — click any alert to jump straight to its project
- **Budget by sector** bar chart + **project ranking table** (sortable by health / progress / budget / name)
- **Export CSV** of the full portfolio & one-click **Ask Assure AI**

### 2️⃣ Projects — `projects-view.tsx`
- Search (name, district, scheme), sector filter chips, health filter
- Rich project cards: health ring, progress bar, budget burn, delay-probability pill
- **Quick-create wizard** to register a new project (name, department, sector, budget)

### 3️⃣ Project Detail — `project-detail-view.tsx` (8 tabs)
- **Overview**: story, key facts, weighted health score breakdown (Schedule 30% · Budget 25% · Resources 20% · Milestones 25%), mini timeline & AI prediction card
- **Milestones**: full list with status, weights, critical-path flags + **Gantt timeline** (`shared/gantt.tsx`)
- **Budget**: Prophet-style forecast chart — planned vs actual vs projected with 90% CI band, sanctioned reference line, overrun %, thresholds (10% warn / 20% critical)
- **Resources**: HUMAN / EQUIPMENT / MATERIAL allocation with utilisation heat (bottleneck >90% flagged)
- **Documents**: uploaded reports with OCR/extraction status, fields captured, key findings
- **Risk**: formal risk assessment (schedule/budget/resource/overall) with factor impact bars
- **Alerts**: project-level alert history with recommended action/owner/deadline, mark-as-read
- **Audit**: append-only audit trail of every mutation (login, exports, AI accept/override)
- Header actions: **Run prediction**, **Export report**, **Ask AI** (opens chat panel with project context)

### 4️⃣ AI Assistant — `ai-assistant-view.tsx` + `lib/projectassure/ai.ts`
- **Agentic, tool-calling assistant** (ReAct-style trace): classifies intent → calls simulated tools (`get_project_detail`, `run_delay_prediction`, `query_projects`, `forecast/budget`, `compare_portfolio`, `search_documents`, `generate_report`) → answers **grounded in the live dataset with numbered citations [n]** and a data-freshness stamp
- Handles: risk explanations ("Why is Bharatmala at risk?"), portfolio queries ("Which roads projects in Tamil Nadu are delayed?"), comparisons ("Bharatmala vs NH-44"), budget analyses, document queries, executive summaries, small talk
- Quick-action chips, markdown-rendered answers, tool-call trace viewer, per-project context chip
- Global **AI chat side-panel** (`shared/ai-chat-panel.tsx`) available on every screen (press `/`)

### 5️⃣ Analytics — `analytics-view.tsx`
- Delay-risk scatter (progress vs delay probability), sector performance bars
- Health-score histogram, state-wise budget treemap-style breakdown
- Financial exposure panel: projected overruns >10%, combined exposure ₹
- Export PDF/Excel buttons (simulated) + production-architecture note

### 6️⃣ Alerts Centre — `alerts-view.tsx`
- Portfolio-wide, risk-ranked alert inbox (7 unread of 12 seeded)
- Severity filters (CRITICAL / HIGH / MEDIUM / LOW), per-alert **recommended action + owner + deadline**
- "Simulate critical slip" demo trigger, **Mark all read**, unread badge syncs to sidebar + bell

### 7️⃣ Reports & Document Intelligence — `reports-view.tsx`
- **Simulated upload pipeline**: drop a PDF/CSV → `EXTRACTING` → `PROCESSED` with animated status
- Extraction summary: fields auto-captured, pages read, key findings, reconciliation note (±2%)
- Full document library across projects with filters

### 8️⃣ Administration — `settings-view.tsx`
- **RBAC matrix** for all 6 roles (who can create/approve/export/administer)
- Alert **threshold configuration** (health bands, overrun warn/critical %, staleness days)
- Deployment posture panel (3-app Vercel architecture, data plane, security notes)
- Every mutation writes an audit-log entry (visible in project audit tabs)

### 🔔 Global chrome — `app-shell.tsx`
- Responsive collapsible sidebar with unread-alert badge, notification bell dropdown
- **Command palette** (`Ctrl/Cmd + K`) — jump to any view, search projects, trigger AI
- Keyboard shortcuts: `Ctrl/Cmd+K` palette · `/` AI panel · `Esc` close
- Dark/light theme toggle (`next-themes`), animated login backdrop, toast notifications (`sonner`)

---

## 🧠 The Simulated Intelligence Layer

All "AI/ML" runs deterministically in the browser — faithfully reproducing the production design:

| File | What it implements |
|---|---|
| `lib/projectassure/ml.ts` | **18-feature delay model** (XGBoost-style surrogate): task completion rate, milestone adherence, budget burn velocity & deviation, critical milestones delayed, dependency-chain health, resource bottlenecks, days-to-deadline, weather seasonality (monsoon), procurement delays, team adequacy… → sigmoid delay probability, estimated slip days with 90% CI, per-feature **SHAP-style contribution waterfall** in plain language |
| `lib/projectassure/engine.ts` | Portfolio assembly: weighted health score (0.30·schedule + 0.25·budget + 0.20·resources + 0.25·milestones), status bands, risk assessments, alert generation (budget overrun, milestone slippage, risk-level change, data staleness, resource bottleneck), portfolio stats |
| `lib/projectassure/ai.ts` | Agentic assistant: intent classifier, 7 tools, ReAct trace, grounded answers with citations, executive-summary generator |
| `lib/projectassure/seed-data.ts` | 30-project deterministic world: 5 departments, 6 personas, milestones/tasks/budgets/resources/documents/audit trails via `mulberry32(42)` PRNG — identical on every reload |
| `lib/projectassure/format.ts` | Indian number formatting (₹ lakh/crore), date/time helpers |

**Business rules honoured in the demo:** health bands (GREEN ≥75, AMBER 50–74, RED <50) · budget overrun alert at >10% projected, critical at >20% · BUDGET_STRESS fires when the forecast *upper interval* crosses sanction · AMBER→RED transitions require human-officer verification (rule R10).

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser (this repo — single Next.js 16 app)             │
│                                                          │
│  app/            layout, fonts (Inter/JetBrains), Toaster│
│  components/     projectassure/* (8 views + shared)      │
│                  ui/* (shadcn/ui primitives)             │
│  store/          Zustand — auth, navigation, alerts, UI  │
│  lib/            ml.ts · ai.ts · engine.ts · seed-data.ts│
└──────────────────────────────────────────────────────────┘
                    ▼ production target (designed, not wired)
┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Vercel app 1│  │ Vercel app 2     │  │ Vercel app 3     │
│ Dashboard   │  │ Scoring worker   │  │ Analytics        │
│ (this UI)   │  │ Cron every 6 h   │  │ + public portal  │
└─────────────┘  └──────────────────┘  └──────────────────┘
        ▼                    ▼                      ▼
     Neon Postgres (free tier)   ·   Upstash Redis (rate limit)
     Resend (email alerts)       ·   Cloudflare R2 (documents)
     Total running cost: ₹0/month
```

### Project structure

```
ProjectAssure/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # fonts, metadata, toaster
│   │   ├── page.tsx                # client-only AppShell mount
│   │   ├── globals.css             # Tailwind 4 theme tokens
│   │   └── api/route.ts            # health-check endpoint
│   ├── components/
│   │   ├── projectassure/
│   │   │   ├── app-shell.tsx       # sidebar, topbar, palette, view router
│   │   │   ├── views/              # 8 feature views (dashboard…settings)
│   │   │   └── shared/             # ui-bits (badges, cards), gantt, ai-chat-panel
│   │   └── ui/                     # shadcn/ui components
│   ├── lib/projectassure/          # 🧠 types, seed-data, engine, ml, ai, format
│   ├── store/app-store.ts          # Zustand global state
│   └── hooks/                      # use-toast, use-mobile
├── README.md                       # ← you are here
├── DEPLOYMENT.md                   # step-by-step Vercel deployment guide
├── package.json                    # all deps pinned to real versions ✅
├── next.config.ts                  # standalone output, strict type-check ON
└── tsconfig.json
```

---

## 🐛 Fixed in This Version

This build resolves every blocking error from the previous drop:

1. **Vercel build failure** — `npm error notarget No matching version found for @radix-ui/react-collapsible@^1.2.11`
   → `package.json` now pins **every dependency to a version that actually exists on npm** (collapsible `^1.1.20`, menubar `^1.1.24`, and 24 other Radix packages audited against the live registry). `npm install` now succeeds on Vercel.
2. **7 hidden TypeScript errors** (were masked by `ignoreBuildErrors: true`):
   - `types.ts` — `DocumentItem.id` was the literal type `"string"` instead of `string`
   - `app-store.ts` — `ViewId` was imported but never re-exported (broke `app-shell.tsx`)
   - `engine.ts` — non-existent `p.health` property + invalid `"R"` tier argument (risk scoring)
   - `ml.ts` — non-existent `p.health` property (procurement-delay feature)
   - `dashboard-view.tsx` — invalid `domain` prop on Recharts `RadialBarChart`
   - `project-detail-view.tsx` — impossible `never[]` prop type on `BudgetTab`
   → All fixed; **type validation is now enforced at build time** (`ignoreBuildErrors` removed), so `npm run build` is clean and can never silently regress.
3. **tsconfig hardened** to compile only project sources (no workspace leakage).
4. Verified end-to-end: production build passes, all 8 views + AI assistant + all detail tabs render with **zero runtime errors** (tested in a real browser).

---

## 📦 Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on `http://localhost:3000` |
| `npm run build` | Production build **with strict type-checking** |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (Next.js core-web-vitals config) |

## 🧰 Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack, standalone output) + React 19
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS 4 + tw-animate-css, dark mode via `next-themes`
- **UI kit**: shadcn/ui (Radix primitives), lucide-react icons, sonner toasts
- **Charts**: Recharts (donut, radial gauge, composed forecast, scatter, waterfall)
- **State**: Zustand · **Animation**: Framer Motion
- **Fonts**: Inter + JetBrains Mono (Google Fonts via `next/font`)

---

## 🎬 60-Second Demo Script (for judges)

1. **Land on login** → pick *The Portfolio Overseer* → **Sign in with SSO**
2. **Command Centre** → 10-second portfolio pulse: 30 projects, ₹2,191 Cr, 27 green / 2 amber / 1 red → note the critical alerts feed
3. Click the **Jal Jeevan Bundelkhand** critical alert → project detail → open **Budget** tab → Prophet-style forecast breaches the sanctioned line → **Risk** tab shows the permit-stalemate factor chain
4. Press **`Ctrl+K`** → *"Ask AI: attention needed"* → AI answers with tool trace + citations
5. **Reports & Docs** → upload a PDF → watch OCR → extraction summary in <60 s
6. **Alerts Centre** → every alert carries an action, owner and deadline
7. **Administration** → RBAC matrix + thresholds; sign out, log in as a *Viewer* → read-only RBAC in action

---

## 🚢 Deploying to Vercel

Full step-by-step instructions (CLI + dashboard + GitHub flow), custom domains, cron configuration and troubleshooting live in **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

```bash
npm i -g vercel
vercel          # preview
vercel --prod   # production
```

---

## 👥 Team NEXGEN

Built for **Smart India Hackathon 2026** — Problem **SIH26103** under **MoSPI**.

*Prototype demo — 30 seeded projects, deterministic simulated ML/AI, all client-side. Production architecture: 3 Vercel apps + Neon + Upstash, total cost ₹0.*
