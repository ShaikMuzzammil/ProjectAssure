# ProjectAssure Host Control — the master control plane

> **Separate deployment** — this is a standalone Next.js 16 app deployed as a
> SEPARATE Vercel project from the same GitHub repo. It controls the main
> ProjectAssure prototype at <https://project-assure.vercel.app>.
>
> SIH 2026 · SIH26103 · Team NEXGEN · Amrita Vishwa Vidyapeetham Chennai

---

## What is this?

The host-control is the **Chief Programme Officer's cockpit** — a master admin
plane that sits ABOVE the main ProjectAssure prototype. It aggregates the whole
portfolio in one view, with approval queues, budget risk panels, alert feeds,
user management and a universal intelligence console.

It does NOT replace the main prototype — it controls it. Both deploy from the
same GitHub repo but as two separate Vercel projects that link to each other.

---

## Quick start (local)

```bash
cd host-control
npm install --legacy-peer-deps
npm run dev
# → http://localhost:3001 → mission dashboard loads automatically
```

The host-control runs on port 3001 (the main prototype is on 3000) so you can
run both side-by-side. By default it shows seed data; set `MAIN_PROJECT_URL` in
`.env.local` to also probe the live main project's `/api/health`.

---

## Deploy to Vercel (SEPARATE project from the same repo)

1. Push the entire `prototype/` folder (this folder's parent) to a GitHub repo.
2. Go to [vercel.com/new](https://vercel.com/new) → import the repo.
3. **IMPORTANT:** under "Root Directory", set it to `host-control` (NOT the repo
   root). Vercel will then build the host-control app instead of the main app.
4. Add environment variables:
   - `GEMINI_API_KEY` — free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - `MAIN_PROJECT_URL` — the URL of your deployed main app (e.g. `https://project-assure.vercel.app`)
5. **Deploy** → host-control live at `https://projectassure-host.vercel.app` (or
   whatever URL you prefer).

---

## 9 admin views

| View | What it shows |
|---|---|
| **Mission Dashboard** | 4 KPI tiles (Total Projects · Total Sanctioned · Open Alerts · Pending Approvals) + health-band distribution + Top 5 at-risk projects + live activity feed |
| **Approval Centre** | Every pending change order, budget increase, extension of time and procurement request — approve/reject with audit-logged notes |
| **Budget Risk** | Org-wide budget utilisation + variance % + projected outturn + Top 5 budget overruns (with variance bars) |
| **Alerts Aggregation** | Every alert across every project in one feed. Severity-ranked with pathway badges (DEMO / FRESH / BROADCAST). Broadcast button |
| **User Management** | Every user (demo + registered) with role, source badge, designation, email, project count, last-active stamp |
| **Intelligence Console** | Universal AI chat grounded on live portfolio data. Multi-provider chain (Gemini → Groq → OpenRouter → built-in) |
| **Integrations** | Main project URL config + connection test + env var reference table |
| **Demo Showcase** | Public-facing demo cards linking back to the main prototype |
| **Audit Trail** | Append-only searchable log of every admin action |

---

## Environment variables

See `.env.example` for the full template. The TL;DR:

| Key | Purpose | Free? |
|---|---|---|
| `GEMINI_API_KEY` | Live intelligence (default provider) | ✅ free |
| `GROQ_API_KEY` | Fallback 1 — fast | ✅ free |
| `OPENROUTER_API_KEY` | Fallback 2 — community models | ✅ free |
| `OPENAI_API_KEY` | Fallback 3 — paid | paid |
| `MAIN_PROJECT_URL` | URL of the main ProjectAssure prototype | — |

With **zero env vars** the host-control runs in offline/built-in mode (jury-safe).

---

## Tech stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Zustand · Prisma ·
Gemini/Groq/OpenRouter/OpenAI provider chain · Recharts · Lucide icons ·
Framer Motion · Sonner toasts.

---

## How host-control ↔ main prototype connect

1. **Read-only probe** — host-control polls `<MAIN_PROJECT_URL>/api/health` every 5s
2. **Shared seed** — both projects ship the same demo data so the host-control shows realistic content even when the main project is unreachable
3. **(Production) Webhook** — configure the main project to POST events to the host-control's `/api/admin/sync` for true real-time updates

---

## Team NEXGEN

Harshavardhan (Team Lead) · Shaik Muzzammil (Intelligence) · Kalathuru Varshitha (Prediction Engine) · Keerthana Varapradha NB (Document Intelligence) · Nishitha Penagaluru (UI/UX) · A. Gandhimathi (Quality & Docs)

Amrita Vishwa Vidyapeetham, Chennai Campus · SIH 2026 · SIH26103
