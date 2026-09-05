# 🛡️ ProjectAssure Prototype (main app with integrated Admin Control)

> **Single deployment** — the Admin Control plane is now a view INSIDE the main
> app, accessible from the sidebar when signed in as the Portfolio Overseer
> (ADMIN role). No more separate Vercel project — one repo, one deployment,
> one web address.

---

## Quick start (local)

```bash
cd prototype
npm install --legacy-peer-deps
npm run dev
# → http://localhost:3000 → “Launch demo” → pick the "Portfolio Overseer" persona → sign in with password "overseer"
# → Click "Admin Control" in the sidebar (landmark icon) → the integrated control plane opens with 6 tabs
```

Zero configuration needed: with **no API keys at all** the app runs its built-in
engine + demo world completely offline (jury-safe). Add keys to upgrade
individual subsystems — the app detects them automatically and shows live status.

---

## What's new (v17)

| # | Change | Where |
|---|---|---|
| 1 | **Landing page restored** — the v12 stacked layout is back (Problem → Solution pillars → 7 Features → Workflow → Trust → CTA), the corner "Full overview" toggle button is gone | `src/components/projectassure/landing/landing-view.tsx` |
| 2 | **Admin Control integrated as a view** — the host-control is no longer a separate project; it's a sidebar item ("Admin Control", landmark icon) that opens a 6-tab cockpit inside the main app | `src/components/projectassure/views/admin-control-view.tsx` (new) · `src/components/projectassure/shell/app-shell.tsx` (sidebar entry + view switch) · `src/lib/projectassure/types.ts` (new `"admin-control"` ViewId) · `src/lib/projectassure/permissions.ts` (ADMIN-only access) · `src/store/app-store.ts` (route title) |
| 3 | **host-control subfolder removed** — no more separate Vercel project; one repo, one deployment | (removed `prototype/host-control/`) |

---

## Admin Control — 6 tabs

When signed in as the Portfolio Overseer (ADMIN), the sidebar shows a new
"Admin Control" item (landmark icon). Clicking it opens the integrated control
plane with 6 tabs:

| Tab | What it shows |
|---|---|
| **Mission Dashboard** | 4 KPI tiles (Total Projects · Total Sanctioned · Open Alerts · Pending Approvals) + health-band distribution (Green/Amber/Red) + Top 5 at-risk projects + live activity feed (latest 8 audit events) |
| **Approval Centre** | Every pending change order, budget increase, extension of time and procurement request — approve/reject with a decision note (audit-logged). Filter by PENDING / APPROVED / REJECTED / ALL |
| **Budget Risk** | Org-wide budget utilisation gauge + variance % + projected outturn + Top 5 budget overruns (with variance bars) + current threshold config (amber/red/warn/critical) |
| **Alerts Aggregation** | Every alert across every project in one feed. Severity-ranked, with pathway badges (DEMO / FRESH / BROADCAST), recommended action, owner and deadline. Filter by severity |
| **User Management** | Every user (demo + registered) with role, source badge, designation, email, project count, last-active stamp |
| **Audit Trail** | Append-only log of every action — admin decisions, mutations, exports, logins. Searchable |

---

## Deploy to Vercel (ONE project)

1. `cd prototype`
2. Push this folder to a GitHub repo.
3. [vercel.com/new](https://vercel.com/new) → import the repo → **Deploy**.
4. Vercel auto-detects Next.js from the root `package.json`.
5. Vercel → Settings → Environment Variables → add any optional keys → Redeploy.

One web address, one deployment, one codebase. The Admin Control plane is just
another view in the same app — no separate project needed.

---

## Optional environment variables

See `.env.example` for the full annotated template. The TL;DR:

| Purpose | Key | Free? | Where |
|---|---|---|---|
| Live intelligence (Gemini) | `GEMINI_API_KEY` | ✅ free | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Fallback 1 (Groq) | `GROQ_API_KEY` | ✅ free | [console.groq.com/keys](https://console.groq.com/keys) |
| Fallback 2 (OpenRouter) | `OPENROUTER_API_KEY` | ✅ free | [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) |
| Real outbound email | `EMAIL_USER`+`EMAIL_PASS` (or `BREVO_API_KEY` / `RESEND_API_KEY`) | ✅ free | see `.env.example` |
| Server-side per-user data | `DATABASE_URL` (Neon) | ✅ free | [neon.tech](https://neon.tech) |

With **zero env vars** the app runs in offline/built-in mode (jury-safe).

---

## Demo credentials

The main app ships with 4 demo personas (visible on the About page after clicking "Reveal demo users"):
- `overseer` — The Portfolio Overseer (ADMIN) ← **this is the persona that sees Admin Control**
- `minister` — The Ministry Project Manager (PROJECT_MANAGER)
- `analyst` — The MoSPI Data Analyst (STAKEHOLDER)
- `observer` — The Strategic Observer (VIEWER)

---

## The 7 main-app features + Admin Control

| # | Feature | What it does |
|---|---|---|
| 1 | **Dashboard** | 4 big numbers + live feed of the whole portfolio |
| 2 | **Projects** | grid/folder views → 6-step wizard → full workspace with documents, risks, Gantt, budget |
| 3 | **Assure Intelligence** | universal mode + file upload + conversation export |
| 4 | **AssurePredict 2.3** | 18-signal delay/cost prediction with explainable factors |
| 5 | **Reports & Exports** | pick **what** to export → PDF · Excel · CSV |
| 6 | **Email Centre** | real outbound email when keys are set, honest outbox simulation otherwise |
| 7 | **Help & Guide** | every workflow documented with one line each |
| 8 | **Admin Control** | integrated control plane — Mission Dashboard, Approval Centre, Budget Risk, Alerts Aggregation, User Management, Audit Trail (ADMIN only) |

---

## Stack (honest version — in docs, masked in the UI)

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Zustand · Prisma (optional
Neon PostgreSQL) · Gemini/Groq/OpenRouter/OpenAI provider chain · in-browser
document reading + 45-pattern risk scanner · deterministic 18-signal prediction
engine · PDF/Excel/CSV export · Sonner toasts · Framer Motion · Recharts.
