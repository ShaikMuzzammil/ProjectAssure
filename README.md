<div align="center">

# 🛡️ ProjectAssure

### Intelligence-Powered Predictive Project Monitoring Platform

**Smart India Hackathon 2026 · SIH26103 · Team NEXGEN** — Amrita Vishwa Vidyapeetham, Chennai

**Every button works. Every number is grounded. Every action is audit-logged.**

`v12 · the deployment-hardened release` — Gemini-first provider chain · full project dossier grounding · concise decidable answers · **Vercel-clean install (dependency conflict fixed)**

</div>

---

## Run it (60 seconds)

```bash
bun install          # or: npm install
bun run dev          # or: npm run dev
# → http://localhost:3000 → “Launch demo” → pick a persona → sign in
```

Zero configuration needed: with **no API keys at all** the app runs its built-in
engine + demo world completely offline (jury-safe). Add keys to upgrade
individual subsystems — the app detects them automatically and shows live status.

## Optional keys (`.env.example` has the full annotated template)

| Purpose | Key | Free? | Where |
|---|---|---|---|
| **Live intelligence answers** (top priority) | `GEMINI_API_KEY` | ✅ free | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| Fallback 1 — very fast | `GROQ_API_KEY` | ✅ free | [console.groq.com/keys](https://console.groq.com/keys) |
| Fallback 2 — community models | `OPENROUTER_API_KEY` | ✅ free | [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys) |
| Fallback 3 | `OPENAI_API_KEY` | paid | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Server-side per-user data | `DATABASE_URL` (Neon) | ✅ free | [neon.tech](https://neon.tech) |
| Real outbound email | `EMAIL_USER`+`EMAIL_PASS` / `BREVO_API_KEY` / `RESEND_API_KEY` | ✅ free | see `.env.example` |

**The intelligence chain:** Gemini (free) → Groq (free) → OpenRouter (free) →
OpenAI → built-in engine. The first working provider serves every answer; if it
ever fails mid-demo, the built-in engine answers instead — the demo cannot break.
Each user sees only a masked status (“live intelligence service · connected”);
keys never reach the browser.

## What the assistant analyzes (not a chatbot — a project analyst)

When you ask from inside a project, the live service receives the **full project
dossier**: every uploaded document's real text, the live risk register,
milestones, budget position, delay prediction with factors, KPIs, open alerts,
**pending change orders awaiting approval** and the engine's own ranked
recommended actions — then answers in one strict shape: **answer first → ≤4
evidence bullets with real numbers → one action (owner + deadline)**. Approval
questions end with an explicit recommendation and the single missing item that
would settle it.

## Deploy (one web address, ~10 minutes)

**GitHub → Vercel:**

1. Push this repo to GitHub (`src/` + configs only — old versions are already
   git-ignored).
2. [vercel.com/new](https://vercel.com/new) → import the repo → **Deploy**
   (Next.js is auto-detected; no settings needed).
3. Vercel → Settings → Environment Variables → add any optional keys above →
   Redeploy.

**v12 deployment fixes** (if your Vercel build previously failed):

- `next-auth` was **removed** (it was never imported anywhere in `src/`) — its
  optional peer dependency `nodemailer@^7` conflicted with `nodemailer@^9`
  and broke `npm install` on Vercel with `ERESOLVE`.
- `nodemailer` is pinned to **`^7.0.13`** (same `createTransport`/`sendMail`
  API the Email Centre uses) and `@types/nodemailer` to `^7.0.12`.
- A root **`.npmrc` with `legacy-peer-deps=true`** ships with the repo, so npm
  never hard-fails on any other peer range.
- The **`build` script is now Vercel-aware**: it runs plain `next build` on
  Vercel and only assembles the standalone bundle locally (`npm start`).
- `postinstall: prisma generate` works **without `DATABASE_URL`** (verified) —
  the prototype runs in browser-persistence mode on Vercel with zero env vars.

No `vercel.json` is needed — Vercel auto-detects Next.js from `package.json`.
A full clean `npm install` + `npm run build` with `VERCEL=1` was verified
end-to-end before packaging this zip.

Local production check before pushing: `npm run build && npm start`.

## The 7 features (all working)

| # | Feature | What it does |
|---|---|---|
| 1 | **Dashboard** | 4 big numbers + live feed of the whole portfolio |
| 2 | **Projects** | grid/folder views → 6-step wizard → full workspace with documents, risks, Gantt, budget |
| 3 | **Assure Intelligence** | the project analyst described above (live + built-in) |
| 4 | **Prediction Engine** | 18-signal delay/cost prediction with explainable factors |
| 5 | **Reports & Exports** | pick **what** to export (faults / recommendations / …) → PDF · Excel · CSV |
| 6 | **Email Centre** | real outbound email when keys are set, honest outbox simulation otherwise |
| 7 | **Help & Guide** | every workflow documented with one line each |

## Stack (honest version — in docs, masked in the UI)

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Zustand · Prisma (optional
Neon PostgreSQL) · Gemini/Groq/OpenRouter/OpenAI provider chain · in-browser
document reading + 45-pattern risk scanner · deterministic 18-signal prediction
engine · PDF/Excel/CSV export.

## Full documentation

See `docs/` in the submission package (WORKFLOWS.md — every workflow in one
line; 15 per-workflow guides; DEPLOYMENT_GUIDE with key setup; TEAM_GUIDE;
USER_GUIDE).
