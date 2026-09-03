<div align="center">

# 🚀 ProjectAssure — Vercel Deployment Guide

**Complete, step-by-step instructions to deploy this project to Vercel — zero errors, first try.**

Covers: Prerequisites → Dashboard deploy → CLI deploy → GitHub auto-deploy → Domain & settings → Environment variables → Cron jobs → Troubleshooting (including the `ETARGET` error this project previously hit).

</div>

---

## 📋 Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Fix already applied — why your last build failed](#2-fix-already-applied--why-your-last-build-failed)
3. [Method A — Deploy via Vercel Dashboard (GitHub)](#3-method-a--deploy-via-vercel-dashboard-github)
4. [Method B — Deploy via Vercel CLI](#4-method-b--deploy-via-vercel-cli)
5. [Method C — Deploy from a local folder without GitHub](#5-method-c--deploy-from-a-local-folder-without-github)
6. [Project settings reference](#6-project-settings-reference)
7. [Environment variables](#7-environment-variables)
8. [Custom domain](#8-custom-domain)
9. [Scheduled scoring runs (cron)](#9-scheduled-scoring-runs-cron)
10. [Verify the deployment](#10-verify-the-deployment)
11. [Troubleshooting](#11-troubleshooting)
12. [Cost: how this stays at ₹0](#12-cost-how-this-stays-at-0)

---

## 1. Prerequisites

| Requirement | Details |
|---|---|
| **Node.js** | **18.18+ or 20+** locally (Vercel build image ships Node 20/22 by default) |
| **npm** | 9+ (comes with Node) — this project uses `package-lock.json`-free plain `npm install` |
| **Vercel account** | Free **Hobby** plan is enough → sign up at [vercel.com/signup](https://vercel.com/signup) with GitHub / GitLab / Bitbucket / Email |
| **Git repo** *(recommended)* | Push this project to GitHub for auto-deploys on every commit |
| **This codebase** | The fixed `package.json` (all versions verified against the npm registry ✅) |

Local sanity check before deploying (both must pass):

```bash
npm install        # must complete with no ETARGET/notarget errors
npm run build      # must compile + type-check cleanly
```

---

## 2. Fix already applied — why your last build failed

Your previous Vercel log showed:

```
npm error notarget No matching version found for @radix-ui/react-collapsible@^1.2.11.
npm error notarget In most cases you or one of your dependencies are requesting a package
version that doesn't exist.
```

**Root cause:** `package.json` requested `@radix-ui/react-collapsible@^1.2.11`, but the `react-collapsible` package never published a `1.2.x` release — its latest line is **1.1.x**. A second silent time-bomb existed too: `@radix-ui/react-menubar@^1.2.15` (real line is 1.1.x). npm aborts on the *first* unresolvable range, so fixing collapsible alone would have failed again on menubar.

**What was fixed in this repo:**

| Package | Old (broken) | New (verified live) |
|---|---|---|
| `@radix-ui/react-collapsible` | `^1.2.11` ❌ | `^1.1.20` ✅ |
| `@radix-ui/react-menubar` | `^1.2.15` ❌ | `^1.1.24` ✅ |
| All other Radix packages + Next/React/etc. | mixed | audited & pinned to real versions ✅ |

No action is needed from you — just deploy this codebase. Section 11 explains how to diagnose any future `ETARGET` errors yourself in 30 seconds.

---

## 3. Method A — Deploy via Vercel Dashboard (GitHub) ⭐ recommended

### Step 3.1 — Push the project to GitHub

```bash
cd ProjectAssure
git init
git add .
git commit -m "ProjectAssure — SIH 2026 submission (build fixed)"
git branch -M main
git remote add origin https://github.com/<your-username>/ProjectAssure.git
git push -u origin main
```

> ⚠️ Do **not** commit `node_modules/` or `.next/` — the included `.gitignore` already excludes them.

### Step 3.2 — Import into Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Find your `ProjectAssure` repo in the **Import Git Repository** list → click **Import**
   *(first time? click **Adjust GitHub App Permissions** → grant access to the repo)*
3. Vercel auto-detects the framework — confirm the settings (see table below)
4. Click **Deploy**

### Step 3.3 — Build settings (auto-detected, shown here for confirmation)

| Setting | Value |
|---|---|
| **Framework Preset** | `Next.js` |
| **Root Directory** | `./` (leave default) |
| **Build Command** | `next build` *(or leave empty — Vercel uses the default)* |
| **Output Directory** | `.next` *(default — do not change; `output: "standalone"` is handled automatically by Vercel)* |
| **Install Command** | `npm install` *(default)* |
| **Node.js Version** | 20.x or 22.x (Project Settings → General) |

### Step 3.4 — Wait ~1–2 minutes

The build log should show:

```
✓ Compiled successfully
✓ Generating static pages (4/4)
Route (app)          ┌ ○ /
                     ├ ○ /_not-found
                     └ ƒ /api
```

Your app is live at `https://<project-name>.vercel.app` 🎉

Every future `git push` to `main` triggers an automatic production deploy; every pull request gets its own preview URL.

---

## 4. Method B — Deploy via Vercel CLI

Best for quick iterations from your machine.

```bash
# 1. Install the CLI
npm i -g vercel

# 2. Log in (opens browser)
vercel login

# 3. From the project root — first deploy (creates preview)
cd ProjectAssure
vercel

#    Answer the prompts:
#    ? Set up and deploy "~/…/ProjectAssure"?        → Y
#    ? Which scope do you want to deploy to?         → <your account>
#    ? Link to existing project?                     → N
#    ? What's your project's name?                   → projectassure
#    ? In which directory is your code located?      → ./
#    ? Want to modify these settings?                → N   (auto-detected Next.js)

# 4. Promote to production
vercel --prod
```

Useful CLI commands afterwards:

```bash
vercel logs <deployment-url>     # stream build/runtime logs
vercel ls                        # list deployments
vercel env ls                    # list env vars
vercel domains                   # manage domains
```

---

## 5. Method C — Deploy from a local folder without GitHub

No Git repo needed at all:

```bash
cd ProjectAssure
vercel --prod --yes
```

Vercel uploads the folder, builds it in the cloud, and returns the production URL. (Note: without Git integration, redeployments are manual.)

---

## 6. Project settings reference

After the first deploy, verify these in **Dashboard → your project → Settings**:

| Section | Key settings |
|---|---|
| **General → Node.js Version** | `20.x` (or 22.x) |
| **General → Build & Output** | Framework: Next.js · Build: default · Install: `npm install` |
| **Git** | Production Branch: `main` · auto-deploy: ON |
| **Functions** | Default region (e.g. `iad1` / `bom1` — Mumbai `bom1` is best for India) · Max duration 10 s (free plan default is fine — `/api` is a trivial health-check) |
| **Domains** | see section 8 |

---

## 7. Environment variables

**This prototype needs none.** It is a fully client-side deterministic simulation — no database, no API keys.

If/when you wire the production data plane (Neon/Upstash/Resend), add them in **Settings → Environment Variables** (and locally in `.env.local`, which is git-ignored):

| Variable | Example | Used for |
|---|---|---|
| `DATABASE_URL` | `postgres://…@neon.tech/projectassure` | Neon Postgres (production) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | `https://…upstash.io` | Rate limiting / cache |
| `RESEND_API_KEY` | `re_…` | Email alert delivery |

CLI equivalents: `vercel env add DATABASE_URL production`

---

## 8. Custom domain

1. **Settings → Domains → Add** → e.g. `projectassure.vercel.app` (free subdomain) or your own `projectassure.gov.in`-style domain
2. For a custom domain, add the DNS records Vercel shows you at your registrar:

| Type | Name | Value |
|---|---|---|
| `A` | `@` | `76.76.21.21` |
| `CNAME` | `www` | `cname.vercel-dns.com` |

3. Wait for DNS propagation (minutes → 24 h). Vercel issues a free TLS certificate automatically.
4. The production architecture note in the app mentions `analytics.projectassure.vercel.app` — you can create that as a second Vercel project and attach it as a subdomain the same way.

---

## 9. Scheduled scoring runs (cron)

The production design re-scores all projects **every 6 hours**. To wire that up when the scoring worker app exists, add to `vercel.json` in that app's repo:

```json
{
  "crons": [
    { "path": "/api/score", "schedule": "0 */6 * * *" }
  ]
}
```

- `0 */6 * * *` = every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- Free (Hobby) plan allows daily cron limits per project — enough for the demo; the Pro plan removes the restriction
- The **current prototype repo does not need** this file — don't add it here.

---

## 10. Verify the deployment

Run through this checklist on your live URL:

- [ ] Login screen renders with the animated gradient + 6 persona cards
- [ ] **Sign in with SSO** (any persona) lands on the Command Centre: 30 projects, ₹2,191 Cr, health donut, budget gauge, critical alerts
- [ ] Open the **Jal Jeevan Bundelkhand** project → all 8 tabs render (Overview / Milestones / Budget / Resources / Documents / Risk / Alerts / Audit)
- [ ] **Budget** tab shows the forecast chart with the sanctioned reference line
- [ ] `Ctrl/Cmd + K` opens the command palette; `/` opens the AI chat panel
- [ ] AI Assistant answers *"Which projects need my attention today?"* with citations
- [ ] Alerts Centre → **Mark all read** clears the sidebar badge
- [ ] Dark-mode toggle works
- [ ] `https://<your-url>/api` returns `{"message":"Hello, world!"}`

---

## 11. Troubleshooting

### ❌ `npm error notarget No matching version found for <pkg>@^X.Y.Z`

A `package.json` range points at a version that doesn't exist. Diagnose in 30 seconds:

```bash
npm view <package-name> version          # latest real version
npm view <package-name> versions --json  # every real version
```

Then pin to a real one, e.g. `"@radix-ui/react-collapsible": "^1.1.20"`, commit, redeploy. **This specific error is already fixed in this repo** for all 27 Radix packages.

### ❌ `Command "npm install" exited with 1` (other causes)

- Delete any committed `package-lock.json` that was generated against non-existent versions, then `npm install` locally and commit the fresh lockfile:
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  git add package-lock.json && git commit -m "regenerate lockfile" && git push
  ```

### ❌ Type errors fail the build

This repo enforces `tsc` during `next build` (the old `ignoreBuildErrors: true` mask was removed). All current errors are fixed; if you add new code and see TS errors, run `npx tsc --noEmit` locally first.

### ❌ Build succeeds locally but fails on Vercel

- **Node version mismatch**: set Project → Settings → General → Node.js Version to the same major version you run locally
- **OS-specific deps**: rare — add them to `optionalDependencies` or use `--force` as a last resort
- Check the exact failure in **Dashboard → Deployments → click the failed deploy → Build Logs**

### ❌ 404 / blank page after deploy

- Confirm the framework preset is **Next.js** (not "Other")
- Keep Output Directory as the default `.next` — do **not** point it at `standalone` or `out`
- The app is client-only (`ssr: false` dynamic import) — the first paint shows the loading screen for ~1 s; that is expected

### ❌ Google Fonts timeout during build

If the build log hangs on fetching `Inter`/`JetBrains_Mono`, retry the deploy (transient), or check Vercel status. Fonts are fetched at build time by `next/font`.

### 🧭 Getting help

- Vercel docs: [vercel.com/docs](https://vercel.com/docs) · Framework docs: [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- Deployment log history: Dashboard → **Deployments** tab

---

## 12. Cost: how this stays at ₹0

| Component | Provider | Free-tier allowance |
|---|---|---|
| Web hosting (3 apps) | Vercel Hobby | 100 GB bandwidth/mo, unlimited static requests |
| Postgres | Neon | 0.5 GB storage, generous compute hours |
| Cache / rate-limit | Upstash Redis | 10k commands/day |
| Email alerts | Resend | 3k emails/month |
| Document storage | Cloudflare R2 | 10 GB, zero egress fees |
| **Total** | | **₹0 / month** |

---

<div align="center">

**That's it — `vercel --prod` and ProjectAssure is live. 🛡️**
For the full product feature walkthrough, see [README.md](./README.md).

</div>
