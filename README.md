# ProjectAssure — Prototype Source

Intelligence-powered predictive project-monitoring platform · **SIH 2026 · SIH26103 · Team NEXGEN**

This folder is the complete, runnable source of the ProjectAssure prototype:
one Next.js app containing the public site (landing / login / about), the full
in-app workspace (7-feature sidebar + deep screens), the document-ingestion
pipeline, the deterministic prediction engine, the grounded assistant, the
report factory (PDF/Excel/CSV) and the email centre.

## Run it (60 seconds)

```bash
bun install          # or: npm install
bun run dev          # or: npm run dev
```

Open **http://localhost:3000** → *Launch demo* → pick a demo persona → **Sign in**.

No keys, no database required — a deterministic 30-project demo world runs
fully in-browser and can never break mid-demo.

## Default demo personas (one per role)

| Persona | Email | Password | Role |
|---|---|---|---|
| The Portfolio Overseer | `arun.kulkarni@mospi.gov.in` | `overseer` | ADMIN |
| The Ministry Project Manager | `priya.venkatesh@mospi.gov.in` | `director` | PROJECT_MANAGER |
| The MoSPI Data Analyst | `sneha.iyer@mospi.gov.in` | `analyst` | STAKEHOLDER |
| The Strategic Observer | `meera.raghavan@mospi.gov.in` | `observer` | VIEWER |

Or **create your own account** (sign-up card) — each account gets a private
workspace: its own projects, documents, predictions and exports.

## Try the 60-second flow

1. Sign in as the Ministry Project Manager.
2. Dashboard → read *Requires attention today*.
3. Projects → open **Bharatmala P-4** → **Risk & Intelligence** → **Run prediction**.
4. Press **Ask Assure Intelligence** → “Why is Bharatmala P-4 at risk?”.
5. Projects → **New project** → 6 steps → upload any TXT/PDF report →
   watch the risk register fill.
6. Reports & Exports → tick *Recommended only* → **PDF**.
7. Email Centre → send it anywhere.

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | dev server (http://localhost:3000) |
| `bun run build` | production build |
| `bun run lint` | ESLint |
| `npx tsc --noEmit` | type check |
| `npx prisma generate` | generate the Prisma client (production mode) |

## Optional keys (all free — see `../docs/DEPLOYMENT_GUIDE.md`)

| Variable | Unlocks |
|---|---|
| `DATABASE_URL` (PostgreSQL) | server-side auth, Prisma persistence, per-user mirror |
| `GEMINI_API_KEY` | live intelligence-service answers (grounded chain) |
| `SMTP_*` / `BREVO_API_KEY` / `RESEND_API_KEY` | real outbound email |

Without any key the app degrades honestly: built-in engine answers,
queued-outbox email, in-browser persistence — **never fake success**.

## Structure

```
src/
├── app/                     Next.js App Router (layout, page, API routes)
│   └── api/                 health · auth/login · auth/register · users · email/send · email/status · ai/chat
├── components/projectassure/
│   ├── landing/ login/ about/          public surfaces (portal header everywhere)
│   ├── shell/                          app shell: sidebar, topbar, ⌘K palette, intelligence slide-over
│   ├── views/                          25+ screens (dashboard, projects, detail 9-tab, alerts, reports, email…)
│   └── shared/                         gov-style portal header, pipeline strip, doc pipeline, chat panel, badges
├── lib/projectassure/       the engine room — types, seed (30 projects), ml (18 features),
│                            engine (recompute + RBAC + alert rules R1–R12), risks (45 patterns),
│                            ocr (document pipeline), rag (vector store), agent (assistant tools),
│                            recommendations, monitor, reports, email, glossary, geo, team
├── store/                   zustand store with persistence (per-user workspaces)
└── prisma/                  schema (sqlite dev / postgres prod) + seed
```

## Behavioural guarantees (verified)

- Every project created is **alive on minute one** (register, prediction, alerts, KPIs).
- Every upload re-derives the risk register and re-scores the prediction.
- Every prediction shows probability, confidence range and driving factors.
- Every alert carries a recommended action, owner and deadline (rule R10: humans verify).
- Every export contains exactly the sections you ticked and is audit-logged.
- Dark mode is contrast-checked; the interface exposes no technology names.
