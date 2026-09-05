# 🛡️ ProjectAssure Prototype (main app + host-control)

> **Monorepo structure** — this folder is the single GitHub repo you push to
> deploy **two** Vercel projects from one codebase:
>
> - **Main app** (this folder root) → the user-facing ProjectAssure prototype
> - **Host Control** (`./host-control/`) → the master admin plane
>
> Both share the same codebase, same seed data, same team — they just deploy to
> separate Vercel projects that link to each other.

---

## Quick start (local)

```bash
# From this folder:
npm install --legacy-peer-deps
npm run dev            # main app on http://localhost:3000

# In a second terminal:
cd host-control
npm install --legacy-peer-deps
npm run dev            # host-control on http://localhost:3001
```

Both apps run side-by-side on ports 3000 and 3001. The host-control polls the
main app's `/api/health` every 5 seconds.

---

## Deploy to Vercel (TWO projects from ONE repo)

### Project 1 — the main app

1. Push this folder to a GitHub repo (e.g. `projectassure-prototype`).
2. Go to [vercel.com/new](https://vercel.com/new) → import the repo.
3. Vercel auto-detects Next.js from the root `package.json`.
4. **Deploy** → main app live at `https://project-assure.vercel.app`.

### Project 2 — the host-control admin plane

1. From the **same GitHub repo**, go to [vercel.com/new](https://vercel.com/new)
   → import the repo again.
2. **IMPORTANT:** under "Root Directory", set it to `host-control` (NOT the repo
   root). Vercel will then build the host-control app instead of the main app.
3. Add environment variables:
   - `GEMINI_API_KEY` — free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   - `MAIN_PROJECT_URL` — the URL of your main app from Project 1 above
4. **Deploy** → host-control live at `https://projectassure-host.vercel.app`
   (or whatever URL you prefer).

The two deployments now talk to each other:

- Host-control polls `<MAIN_PROJECT_URL>/api/health` every 5 seconds.
- Both share the same seed data (4 demo personas + 30 demo projects) so the
  host-control shows realistic content even if the main app is unreachable.

---

## Folder layout

```
prototype/                         ← GitHub repo root · Vercel Project 1
├── src/                           ← main app source (Next.js 16)
├── public/                        ← static assets
├── prisma/                        ← Prisma schemas (SQLite + Postgres variants)
├── package.json                   ← main app deps
├── next.config.ts                 ← main app Next config
├── vercel.json                    ← Vercel build config for main app
├── .env.example                   ← full annotated env template
├── .npmrc                         ← legacy-peer-deps=true (npm safety)
│
└── host-control/                  ← Vercel Project 2 (set as Root Directory)
    ├── src/                       ← host-control source (Next.js 16)
    ├── public/
    ├── prisma/
    ├── package.json               ← host-control deps
    ├── next.config.ts
    ├── vercel.json
    ├── .env.example
    └── README.md                  ← host-control-specific deployment guide
```

---

## Why monorepo?

- **Single source of truth** — change a seed value once, both apps reflect it
- **Atomic deploys** — push one commit, rebuild both apps
- **Easier code review** — diff shows changes across both apps in one PR
- **Team-aligned** — the same six engineers own both apps

The host-control is **intentionally a separate Vercel project** (not a route
inside the main app) because:

- It has its own env vars (different `MAIN_PROJECT_URL` per environment)
- It can scale independently (admins are few; users are many)
- It can be taken offline for maintenance without affecting the user-facing app

---

## Optional environment variables

See `.env.example` in each folder for the full annotated template. The TL;DR:

| Purpose | Key | Where |
|---|---|---|
| Live intelligence (Gemini) | `GEMINI_API_KEY` | both folders |
| Fallback 1 (Groq) | `GROQ_API_KEY` | both folders |
| Fallback 2 (OpenRouter) | `OPENROUTER_API_KEY` | both folders |
| Real outbound email | `EMAIL_USER` + `EMAIL_PASS` (or `BREVO_API_KEY` / `RESEND_API_KEY`) | main app only |
| Host-control → main app link | `MAIN_PROJECT_URL` | host-control only |

With **zero env vars** the app runs in offline/built-in mode (jury-safe).
