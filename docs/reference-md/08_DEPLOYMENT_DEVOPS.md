# ProjectAssure - Multi-Domain Vercel Deployment & DevOps

> **How to read this file:** This is the complete DevOps handbook for ProjectAssure. It is organised into three zones. **Setup Guides (Parts 1-9)** take you from zero to a fully deployed three-domain platform. **Workflows (Part 10)** explain, step by step and in simple language, what happens during every operational task you will perform — first deploy, daily redeploy, migration, rollback, email alerts, and more. **Runbooks (Parts 11-16)** are your reference material for security, troubleshooting, go-live, and cost control. If you read only one section before your hackathon demo, read Part 10 — it explains exactly what to do and what to say when something changes or breaks.

---

## PART 0: The Big Picture of ProjectAssure Deployment

### 0.1 What "deploying ProjectAssure" actually means

ProjectAssure is not one website — it is **three independent Next.js applications** (plus one small Python service) that behave like one product. The main application is where officials log in and manage projects. The analytics application renders heavy charts and exports. The AI engine application hosts the AI assistant, document pipeline, and prediction dashboards. Each one is deployed separately on Vercel, yet they share one database, one login system, and one design language, so the user experiences them as a single seamless platform.

### 0.2 The three domains at a glance

| # | Domain | Purpose | Key Screens | Repository Path |
|---|--------|---------|-------------|-----------------|
| 1 | `projectassure.vercel.app` | Main application — entry point for all users | Login, Executive Dashboard, Projects, Tasks, Milestones, Alerts, Settings | `apps/web` |
| 2 | `analytics.projectassure.vercel.app` | Analytics engine — deep analysis and exports | Portfolio analytics, Budget analytics, Trends, CSV/PDF exports | `apps/analytics` |
| 3 | `ai.projectassure.vercel.app` | AI engine — intelligence layer | AI Chat, Document Ingestion, Prediction dashboards, Report summaries | `apps/ai-engine` |

The main application links to the other two through the top navigation bar, so a user moves between domains with a single click while staying logged in.

### 0.3 The shared services behind all three domains

| Service | Provider | Role | Free Tier Limits (approx.) |
|---------|----------|------|----------------------------|
| PostgreSQL database | Neon | Single source of truth for all data | 0.5 GB storage, 191.9 compute-hours/month |
| Cache, rate limiting, sessions | Upstash Redis | Fast in-memory layer shared by all domains | 10,000 commands/day (generous free tier) |
| Vector database | Pinecone | Embeddings for document search (RAG) | 1 serverless index, ~100K vectors |
| File storage | Vercel Blob | Uploaded PDFs, Excel files, images | 1 GB storage on free tier |
| Email delivery | Gmail SMTP (Nodemailer) | Alert emails and weekly digests | ~500 emails/day via App Password |
| LLM | OpenAI GPT-4o (primary), Gemini (fallback) | Summaries, extraction, Agentic AI | Pay-as-you-go with hard budget caps |
| Hosting + CDN | Vercel | All three apps + edge network | Hobby plan: 100 GB bandwidth/month |

### In Plain English

> Think of ProjectAssure as **three shops in one mall** (main app, analytics, AI engine). Each shop has its own counter and its own staff (independent Vercel deployments), but they all share one warehouse (Neon database), one security badge system (NextAuth SSO), one announcement system (Upstash Redis + Socket.io), and one delivery van (Gmail SMTP). If the AI shop closes for repairs, the other two shops keep trading — that is the whole point of splitting the platform into three domains.

---

## PART 1: Deployment Architecture

### 1.1 Full deployment topology

```
                    ┌─────────────────────────────────────┐
                    │          VERCEL EDGE NETWORK          │
                    │    (Global CDN + Edge Functions)       │
                    └────┬──────────────┬──────────────┬────┘
                         │              │              │
              ┌──────────┴──┐  ┌───────┴──────┐  ┌──┴──────────┐
              │ projectassure│  │ analytics.   │  │ ai.         │
              │ .vercel.app  │  │ projectassure│  │ projectassure│
              │              │  │ .vercel.app  │  │ .vercel.app │
              │ Main App     │  │ Analytics    │  │ AI Engine   │
              │ (Next.js 15) │  │ (Next.js 15) │  │ (Next.js +  │
              │              │  │              │  │  FastAPI)   │
              └──────┬──────┘  └──────┬───────┘  └──────┬──────┘
                     │                │                  │
                     └────────────┬───┴──────────────────┘
                                  │  (JWT verified identically on all 3)
              ┌───────────────────┴───────────────────┐
              │           SHARED SERVICES              │
              │  ┌──────────┐ ┌────────┐ ┌───────────┐ │
              │  │ Neon PG  │ │ Upstash│ │ Pinecone  │ │
              │  │ (DB)     │ │ Redis  │ │ (Vectors) │ │
              │  └──────────┘ └────────┘ └───────────┘ │
              │  ┌──────────┐ ┌──────────────────────┐   │
              │  │ Vercel   │ │ Gmail SMTP           │   │
              │  │ Blob     │ │ (Nodemailer alerts)  │   │
              │  └──────────┘ └──────────────────────┘   │
              └───────────────────────────────────────┘
```

### 1.2 What each arrow means — step by step

1. A user's browser first hits the **Vercel Edge Network**, which serves cached static assets (JavaScript, CSS, images) from the data centre closest to the user, keeping first-load times low.
2. Any dynamic request (data fetch, login, AI call) is routed to the correct **serverless function** belonging to one of the three Next.js apps.
3. Every serverless function verifies the user's **JWT token** against the shared `NEXTAUTH_SECRET` before doing anything — this one rule is what makes single sign-on across three domains possible.
4. Verified requests read or write the **Neon PostgreSQL** database through Prisma using pooled connections.
5. Read-heavy results (dashboard aggregates, analytics) are cached in **Upstash Redis** so repeated views do not recompute or re-query anything.
6. Uploaded documents go to **Vercel Blob**; their extracted embeddings go to **Pinecone** so the AI engine can search them later.
7. When the system detects a critical event (health score drop, budget overrun, prediction change), the AI engine or main app sends an **email through Gmail SMTP** and an **in-app notification through Socket.io**.

### 1.3 Component responsibility matrix

| Concern | Main App | Analytics | AI Engine | Shared Service |
|---------|----------|-----------|-----------|----------------|
| Authentication (login/register) | Owns | Verifies only | Verifies only | NextAuth + Neon |
| Project / Task / Milestone CRUD | Owns | Reads | Reads | Neon |
| Health score display | Shows latest | Recomputes views | Computes | Neon + Redis |
| Delay / budget predictions | Displays | Charts | Runs models | FastAPI + Neon |
| Document upload | Upload UI | — | Processes | Blob + Pinecone |
| AI chat | Entry link | — | Owns | GPT-4o/Gemini |
| Alert emails | Sends | — | Sends | Gmail SMTP |
| Exports (CSV/PDF) | Basic | Owns | Summaries | — |

### In Plain English

> The responsibility matrix is like a **hospital department map**: reception (main app) is where patients arrive and register, the laboratory (analytics) produces detailed reports, and the specialist consultants (AI engine) diagnose and predict. All three share the same patient records room (Neon) — no matter which department you visit, they see the same file.

---

## PART 2: Prerequisites — Accounts and Keys Checklist

Before touching Vercel, create and collect every account and key. Doing this first prevents mid-deployment blocked states.

| # | Service | Sign up at | What you collect | Env var it feeds |
|---|---------|-----------|------------------|------------------|
| 1 | GitHub | github.com | Repository containing the monorepo | — |
| 2 | Vercel | vercel.com | Account linked to GitHub; 3 projects later | — |
| 3 | Neon | neon.tech | Pooled connection string + direct connection string | `DATABASE_URL`, `DIRECT_URL` |
| 4 | Upstash | upstash.com | Redis REST URL + token | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` |
| 5 | Pinecone | pinecone.io | API key + index host | `PINECONE_API_KEY`, `PINECONE_INDEX_HOST` |
| 6 | Gmail | mail.google.com | App-specific 16-character password | `EMAIL_USER`, `EMAIL_PASS` |
| 7 | OpenAI | platform.openai.com | API key (set a monthly spend limit) | `OPENAI_API_KEY` |
| 8 | Google AI Studio | aistudio.google.com | Gemini API key (free tier) | `GEMINI_API_KEY` |
| 9 | Vercel Blob | (created inside Vercel) | Read/write token | `BLOB_READ_WRITE_TOKEN` |

**Order matters:** create Neon first, because its connection string is needed by all three Vercel projects. Create the Gmail App Password second, because testing alert emails early is the best confidence check that your shared infrastructure works.

### In Plain English

> This checklist is your **pre-cooking mise en place**: before you start cooking (deploying), every ingredient (account, key, secret) is chopped and laid out on the counter. Halfway-through missing ingredients are the number-one cause of failed deployment evenings.

---

## PART 3: Vercel Project Setup (Three Projects)

### 3.1 Create the three Vercel projects

| # | Project Name | Monorepo Directory (Root Directory setting) | Resulting Domain |
|---|--------------|---------------------------------------------|------------------|
| 1 | `projectassure-main` | `apps/web` | `projectassure.vercel.app` |
| 2 | `projectassure-analytics` | `apps/analytics` | `analytics.projectassure.vercel.app` |
| 3 | `projectassure-ai` | `apps/ai-engine` | `ai.projectassure.vercel.app` |

### 3.2 Step-by-step import (repeat three times)

1. Push the monorepo to GitHub (branch `main`).
2. In Vercel, click **Add New → Project** and select the repository.
3. In **Root Directory**, click Edit and select the app directory (`apps/web`, `apps/analytics`, or `apps/ai-engine`) — this is the single most important setting for a monorepo; Vercel will then build only that app.
4. Vercel auto-detects Next.js. Leave build command as default (`next build`); framework preset **Next.js**.
5. Open **Environment Variables** and add every variable from Part 4 for this specific app.
6. Click **Deploy**. The first build takes 2-4 minutes.
7. Repeat for the second and third apps.
8. Vercel assigns the domain names shown in the table above automatically (if a name is taken, rename the project in Settings → General → Project Name, and the domain follows the project name).

### 3.3 Monorepo build notes

- Turborepo is optional on Vercel: because each Vercel project's Root Directory points at one app, Vercel runs `pnpm install` + `next build` inside that directory only. Shared packages (`packages/ui`, `packages/db`, `packages/types`, `packages/config`) are consumed as workspace dependencies and are compiled transitively.
- If a build fails with "cannot find shared package", confirm `pnpm-workspace.yaml` includes `apps/*` and `packages/*`, and that each app's `package.json` lists its shared dependencies with the `workspace:*` protocol.

### In Plain English

> Setting the Root Directory is like telling the delivery driver **which shop in the mall** to deliver to. Forget it, and the driver dumps all three shops' goods at the mall entrance — the build fails immediately.

---

## PART 4: Environment Variables — Every Variable and What It Does

Add these in **Vercel Dashboard → Project → Settings → Environment Variables**. Add to all three projects unless noted. Mark all of them as sensitive/hidden.

### 4.1 Main app (`projectassure-main`)

```env
# ── Database ─────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.aws.neon.tech/projectassure?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxx.aws.neon.tech/projectassure?sslmode=require

# ── Auth ─────────────────────────────────────────────────
NEXTAUTH_URL=https://projectassure.vercel.app
NEXTAUTH_SECRET=your-256-bit-random-secret

# ── Email (Gmail SMTP) ───────────────────────────────────
EMAIL_USER=projectassure.mail@gmail.com
EMAIL_PASS=your-16-char-app-password

# ── Redis ────────────────────────────────────────────────
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# ── Blob Storage ─────────────────────────────────────────
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

# ── Cross-Domain URLs ────────────────────────────────────
ANALYTICS_APP_URL=https://analytics.projectassure.vercel.app
AI_ENGINE_URL=https://ai.projectassure.vercel.app

# ── LLM (light AI features in main app) ──────────────────
OPENAI_API_KEY=sk-xxx
```

### 4.2 Analytics app (`projectassure-analytics`)

```env
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.aws.neon.tech/projectassure?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxx.aws.neon.tech/projectassure?sslmode=require
NEXTAUTH_URL=https://analytics.projectassure.vercel.app
NEXTAUTH_SECRET=your-256-bit-random-secret        # MUST be identical to main app
MAIN_APP_URL=https://projectassure.vercel.app
AI_ENGINE_URL=https://ai.projectassure.vercel.app
```

### 4.3 AI engine (`projectassure-ai`)

```env
DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.aws.neon.tech/projectassure?sslmode=require
DIRECT_URL=postgresql://user:pass@ep-xxx.aws.neon.tech/projectassure?sslmode=require
NEXTAUTH_URL=https://ai.projectassure.vercel.app
NEXTAUTH_SECRET=your-256-bit-random-secret        # MUST be identical to main app

# AI keys
OPENAI_API_KEY=sk-xxx
GEMINI_API_KEY=AIzaXXX
PINECONE_API_KEY=xxx-xxx-xxx
PINECONE_INDEX_HOST=xxx.pinecone.io

# Cross-domain
MAIN_APP_URL=https://projectassure.vercel.app
ANALYTICS_APP_URL=https://analytics.projectassure.vercel.app
```

### 4.4 What each variable actually does

| Variable | What it does | Why it exists | What breaks without it |
|----------|--------------|---------------|------------------------|
| `DATABASE_URL` | Pooled Neon connection string used by every Prisma query at runtime | Serverless functions open many short-lived connections; the pooler absorbs them | Every data page shows 500 errors |
| `DIRECT_URL` | Direct (non-pooled) connection used only by Prisma Migrate | Migrations need a dedicated session, not a pooler | `prisma migrate` fails or corrupts schema |
| `NEXTAUTH_URL` | Canonical URL of the app issuing the JWT | Callbacks and cookie scope derive from it | Login loops back to login |
| `NEXTAUTH_SECRET` | Signs and verifies JWTs on all three domains | Identical secret = one login works everywhere | Users logged out between domains (SSO dead) |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail account + App Password for Nodemailer | Sends alert and digest emails | Silent alert failures |
| `UPSTASH_REDIS_*` | REST endpoint + token for the shared Redis | Cache, rate limits, Socket.io adapter | Slow dashboards, no rate limiting |
| `BLOB_READ_WRITE_TOKEN` | Grants Blob upload/read | Document storage | Document upload fails |
| `ANALYTICS_APP_URL` / `AI_ENGINE_URL` / `MAIN_APP_URL` | Absolute URLs for cross-domain navigation and server-to-server calls | Deep links and internal API calls | Broken navigation, dead internal calls |
| `OPENAI_API_KEY` | GPT-4o access | Summarisation, extraction, agent reasoning | AI features return errors |
| `GEMINI_API_KEY` | Fallback LLM | Continuity if OpenAI fails or rate-limits | Fallback chain degrades |
| `PINECONE_API_KEY` / `PINECONE_INDEX_HOST` | Vector search access | RAG document search | AI answers lose document citations |

**Generate a strong secret:** `openssl rand -base64 32` — run once, paste the SAME value into all three projects.

### In Plain English

> Environment variables are the **key rack behind the reception desk**. Each shop (app) gets its own labelled set of keys. The database key opens the warehouse for everyone; the signing key (`NEXTAUTH_SECRET`) must be the identical master key copied across all three shops, or the badge system will not recognise staff moving between them.

---

## PART 5: Database Setup — Neon PostgreSQL

### 5.1 Create the database (one time)

1. Go to [neon.tech](https://neon.tech) and sign up (GitHub login is fastest).
2. Click **Create project**, name it `projectassure`, choose the region closest to your users (e.g., `AWS Mumbai ap-south-1` for Indian government demos).
3. Neon creates the database and shows two connection strings — **Pooled** (contains `-pooler`) and **Direct**. Copy both.
4. Pooled string → `DATABASE_URL`. Direct string → `DIRECT_URL`. Store them in a local `.env` and in all three Vercel projects.
5. Enable **connection pooling** (on by default) — serverless functions need it.

### 5.2 Run the first migration and seed

```bash
# From the repository root, inside apps/web (which owns the Prisma schema)
cd apps/web
npx prisma migrate dev --name init      # creates tables in Neon
npx prisma db seed                      # loads demo data (30 projects, 5 departments)
npx prisma studio                       # optional: visually verify the data
```

### 5.3 Neon branching for safe development

| Branch | Purpose | Used by |
|--------|---------|---------|
| `main` | Production data shown during the demo | All three Vercel projects (production env vars) |
| `dev` | Disposable copy for experiments | Local development, preview deployments |

1. In the Neon console, open **Branches → Create branch**, parent = `main`, name = `dev`.
2. Copy the `dev` branch's pooled connection string.
3. Use it in your local `.env.local` and in Vercel **preview** environment variables.
4. Now `git push` to a feature branch creates a Vercel preview deployment pointing at the `dev` database — you can break anything there with zero risk to the demo data.

### In Plain English

> Branching is a **photocopier for your whole database**. You scribble all over the copy while testing; the original on the podium stays untouched for the jury.

---

## PART 6: Email Setup — Gmail SMTP with App Password

### 6.1 Generate the App Password (one time)

1. Create (or choose) the sender account, e.g. `projectassure.mail@gmail.com`.
2. Google Account → **Security** → turn on **2-Step Verification** (mandatory for App Passwords).
3. Go to **App Passwords** (search "App passwords" in the account settings, or visit myaccount.google.com/apppasswords).
4. Name it `ProjectAssure` and create. Google shows a **16-character password** once — copy it and remove the spaces.
5. Put the account in `EMAIL_USER` and the 16 characters in `EMAIL_PASS` in the Vercel projects (main + AI engine).

### 6.2 Sender implementation (already coded in `lib/email.ts`)

```typescript
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

export async function sendAlertEmail({ to, subject, html }: {
  to: string; subject: string; html: string;
}) {
  try {
    await transporter.sendMail({
      from: `ProjectAssure <${process.env.EMAIL_USER}>`,
      to, subject, html,
    });
    return { success: true };
  } catch (error) {
    console.error('Email send failed:', error);
    return { success: false, error: (error as Error).message };
  }
}
```

### 6.3 Email catalogue — what the platform sends

| Email | Trigger | Priority | Contains |
|-------|---------|----------|----------|
| Welcome / account created | Admin registers a user | Low | Login URL + role |
| Critical alert | Health score enters Red (0-49) | Immediate | Project, score, top factors, recommended action |
| High alert | Delay probability crosses 70% | Immediate | Prediction summary + link |
| Weekly portfolio digest | Cron, Monday 08:00 IST | Batch | Portfolio KPIs, top movers, at-risk list |
| Document processed | Ingestion pipeline finishes | Low | Extracted summary + link to document |

### In Plain English

> The App Password is a **special doorbell key** you give to the platform, so it never needs your real house key (the Google password). Even if the doorbell key leaks, you can revoke just that one key without touching anything else.

---

## PART 7: Docker Setup (Local Development)

### 7.1 docker-compose.yml

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: projectassure
      POSTGRES_PASSWORD: localdev
      POSTGRES_DB: projectassure
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U projectassure']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

  python-ml:
    build:
      context: ./apps/ai-engine/python
      dockerfile: Dockerfile
    ports:
      - '8000:8000'
    volumes:
      - ./apps/ai-engine/python:/app
    env_file:
      - .env.local

volumes:
  pgdata:
```

### 7.2 What each local service does

| Service | Local URL | Purpose | Production twin |
|---------|-----------|---------|-----------------|
| `postgres` | `localhost:5432` | Local database identical in schema to Neon | Neon PostgreSQL |
| `redis` | `localhost:6379` | Local cache/rate-limit | Upstash Redis |
| `python-ml` | `localhost:8000` | FastAPI ML service (XGBoost, Prophet, health score) | Same container image on Vercel/any host |

### 7.3 Daily local workflow

```bash
docker compose up -d                 # start infrastructure (detached)
cd apps/web && pnpm dev              # terminal 1 — main app on :3000
cd apps/analytics && pnpm dev        # terminal 2 — analytics on :3001
cd apps/ai-engine && pnpm dev        # terminal 3 — AI engine on :3002
cd apps/ai-engine/python && \
  uvicorn app:app --port 8000 --reload   # terminal 4 — ML service
docker compose down                  # end of day — stop everything cleanly
```

### In Plain English

> `docker compose up` is the **"set the whole test kitchen" button** — one command gives you a private miniature of production (database, cache, ML service) on your laptop, so you can cook freely before serving in the real restaurant.

---

## PART 8: CI/CD Pipeline

### 8.1 The built-in Vercel pipeline (zero config)

```
git push to GitHub
       ↓
Vercel detects which apps changed (Root Directory scoping)
       ↓
┌──────────────────────────────────────────┐
│ For each changed app:                     │
│  1. pnpm install (workspace-aware cache)  │
│  2. next build (Turborepo cache hits)     │
│  3. Deploy to Vercel Edge Network         │
│  4. Health check on new deployment        │
│  5. Atomic cutover — instant, zero-downtime│
└──────────────────────────────────────────┘
       ↓
Production URL updated only if branch = main
Preview URL created for every other branch
```

### 8.2 Optional quality gate — GitHub Actions before deploy

Add `.github/workflows/ci.yml` so broken code never reaches Vercel:

```yaml
name: CI
on: [pull_request, push]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint typecheck test --parallel
```

### 8.3 Pipeline stages explained

| Stage | What it does | Fails when |
|-------|--------------|-----------|
| Install | Restores exact dependency versions from lockfile | Lockfile and package.json disagree |
| Lint + typecheck | Static analysis across the monorepo | Type errors, unused critical vars |
| Test | Unit + integration tests (Vitest) | Any test failure blocks merge |
| Build | Next.js production build per app | Import errors, env validation failures |
| Deploy | Atomic promotion to Edge Network | Rare — only platform incidents |
| Health check | Verifies the new deployment responds 200 | Broken middleware or env vars |

### In Plain English

> CI is the **bouncer at the door of production**: code must pass the ID checks (lint, types, tests) before entering. Vercel then performs the room swap so quickly that guests (users) never notice the furniture changed.

---

## PART 9: How the Three Domains Talk to Each Other (Quick Recap)

- **Navigation:** the main app's top bar links to the analytics and AI-engine domains (configured through `ANALYTICS_APP_URL` / `AI_ENGINE_URL`).
- **Shared login (SSO):** all three apps verify the same JWT with the same `NEXTAUTH_SECRET`, so one login works everywhere (detailed walk-through in Workflow 7).
- **Server-to-server calls:** the analytics app fetches predictions from the AI engine; the main app requests summaries. All internal calls use the cross-domain fetch helper in `lib/api-client.ts` with the absolute base URLs from env vars.

---

## PART 10: OPERATIONAL WORKFLOWS (What Happens, Step by Step)

> This part answers the question **"when I do X, what actually happens, and what do I do if it fails?"** Every workflow below has the same five blocks: **What it does** (one plain sentence), **When you use it**, **Steps**, **What happens at each step**, and **If it fails**.

---

### Workflow 1: First-Time Deployment (zero to live platform)

**What it does:** Takes the project from an empty Vercel account to all three domains running against a seeded database — the complete "go live for the first time" path.

**When you use it:** Once, at the start; or again from scratch if you ever rebuild the account.

**Steps:**

1. Push the monorepo to GitHub (`main` branch).
2. Create the Neon project; copy pooled + direct connection strings.
3. Run `npx prisma migrate dev --name init` and `npx prisma db seed` from `apps/web`.
4. Import the three Vercel projects with correct Root Directories (`apps/web`, `apps/analytics`, `apps/ai-engine`).
5. Add every environment variable from Part 4 to each project (same `NEXTAUTH_SECRET` everywhere).
6. Deploy all three; wait for green "Ready" status.
7. Open `projectassure.vercel.app`, log in with a seeded admin account, click through to Analytics and AI engine via the top bar.

**What happens at each step:**

1. GitHub stores the source and becomes the deployment trigger for everything that follows.
2. Neon provisions a fresh PostgreSQL cluster and returns the two connection strings — pooled for runtime traffic, direct for migrations.
3. Prisma reads `schema.prisma`, creates all tables and indexes in Neon, then the seeder fills realistic MoSPI-style demo data (30 projects, 5 departments, milestones, tasks, budget records, alerts).
4. Vercel clones the repo per project, `pnpm install`s, and builds only the scoped app directory — three isolated Next.js apps.
5. Vercel encrypts and stores the env vars, injecting them into serverless functions at runtime — they are never written into the git history.
6. Each build goes through install → build → deploy → health check; the Edge Network starts serving each domain globally.
7. The end-to-end path (browser → edge → function → Neon → UI) is verified in the real configuration, and cross-domain links prove SSO works.

**If it fails:**

- **Build fails with "Module not found: @projectassure/ui"** → Root Directory is wrong or `pnpm-workspace.yaml` is missing `packages/*`; fix and redeploy.
- **Login loops forever** → `NEXTAUTH_SECRET` differs between projects, or `NEXTAUTH_URL` does not match the actual domain.
- **Database connection timeout** → connection strings were swapped (pooled vs direct), or the Neon project region is far from Vercel's default region; regenerate strings.
- **Pages load but with no data** → migrations ran against a different Neon branch than the one the env vars point to.

---

### Workflow 2: Daily Redeployment (normal development rhythm)

**What it does:** Ships any code change to the live platform through one `git push` — the routine you repeat dozens of times during the build.

**When you use it:** Every time a feature, fix, or tweak is finished.

**Steps:**

1. Commit changes locally and `git push origin main`.
2. Watch the Vercel dashboard: one or more of the three projects enters "Building".
3. Build completes with a green "Ready"; Vercel atomically switches traffic.
4. Open the live domain and verify the change; check function logs if anything looks off.

**What happens at each step:**

1. GitHub notifies Vercel via webhook; Vercel diffs the commit and detects which Root Directories changed, so only affected apps rebuild.
2. For each affected app, Vercel restores the dependency cache, runs `next build` (Turborepo shares the compile cache), and produces serverless bundles.
3. The new deployment is tested and promoted to production instantly with zero downtime — no maintenance window, no dropped user sessions.
4. The old build remains listed in **Deployments**, so the previous version is always one click away (that is Workflow 5).

**If it fails:**

- **Build error appears** → the failure is shown with file/line in the Vercel build log; fix locally, push again — the broken build never reached users.
- **Only one app rebuilt but two changed** → the second app's files are outside its Root Directory or untouched; force a redeploy from Deployments → Redeploy if needed.
- **Deploy passes but page crashes** → check Vercel → Logs; usually a missing env var on the newly touched code path.

---

### Workflow 3: Preview Deployment (test before merge)

**What it does:** Gives every feature branch its own temporary, fully functional copy of the app on a unique URL — so the team tests a change in a real environment before it touches production.

**When you use it:** For every non-trivial feature or risky change.

**Steps:**

1. `git checkout -b feature/budget-alerts` and push the branch.
2. Open the pull request on GitHub; Vercel posts a preview link on the PR automatically.
3. Test the preview (it uses the Neon `dev` branch database if configured per Part 5.3).
4. Merge the PR; Vercel automatically deploys `main` to production.

**What happens at each step:**

1. Vercel builds the changed apps exactly as it would for production, then hosts them under a URL like `projectassure-main-git-feature-budget-alerts-team.vercel.app`.
2. The preview shares all the production env vars (or your preview-scoped overrides), so the test is honest — same services, same build pipeline.
3. Because preview points at the disposable `dev` database branch, any damage from testing is quarantined.
4. The merge triggers Workflow 2 for the production domains.

**If it fails:**

- **Preview built but shows production data** → preview env vars are inheriting production `DATABASE_URL`; add a preview-scoped `DATABASE_URL` pointing at the `dev` Neon branch.
- **Preview link 404 after merge** → previews expire once branches are deleted; that is normal — production holds the change now.

---

### Workflow 4: Database Migration (schema change without breaking anything)

**What it does:** Applies a structural change to the live database (new column, new table, new index) while the platform stays online.

**When you use it:** Whenever Prisma models change during development.

**Steps:**

1. Edit `prisma/schema.prisma` locally (e.g., add `severityScore Float?` to `Alert`).
2. Run `npx prisma migrate dev --name add_alert_severity` against the **dev** branch first; test locally.
3. Commit the migration folder with the code that uses it; open a PR; preview deployment validates it on `dev`.
4. After merge, run the migration on production: `npx prisma migrate deploy` with `DIRECT_URL` pointing at the Neon `main` branch (run locally or from a one-off CI step).
5. Redeploy the apps if the change includes new queries (usually the merge already did).

**What happens at each step:**

1. Prisma diffs the schema against the migration history and writes a SQL file — this file is the single source of truth for the change.
2. The dev database is altered locally; you verify behaviour with real screens before anything touches production.
3. The preview deployment runs the new code against the dev database — the exact pair that will ship.
4. `migrate deploy` replays only unapplied migrations in order, using the direct (non-pooled) connection; each migration is transactional.
5. Production now has the new schema; new code paths start using the new columns immediately.

**If it fails:**

- **"Migration failed" on production** → a long transaction blocked it (Neon scale-to-zero cold start can also cause a first-attempt timeout); retry once; check Neon console → History.
- **Apps error with "column does not exist"** → migration ran but apps still on old code (or the reverse: code deployed before the migration). Always migrate first, deploy second.
- **Need to undo** → restore the Neon branch to a point-in-time before the migration (Workflow 11), or `prisma migrate resolve --rolled-back` after manual repair.

---

### Workflow 5: Rollback a Bad Deployment

**What it does:** Reverts the live site to the previous working version in under a minute — the emergency brake.

**When you use it:** A fresh deployment misbehaves (crash, wrong data, broken layout) and you need production stable before fixing code.

**Steps:**

1. Vercel Dashboard → the affected project → **Deployments** tab.
2. Find the last green deployment before the bad one.
3. Open its overflow menu → **Promote to Production** (or **Instant Rollback**).
4. Confirm. Traffic switches atomically to the old build.
5. In parallel, `git revert` the offending commit and push the fix through the normal pipeline.

**What happens at each step:**

1. Every build Vercel ever produced is retained and instantly addressable — rollback needs no rebuild.
2. That build's immutable snapshot (bundles, assets, functions) still exists intact.
3. Promoting re-points the production domain at the chosen snapshot — no build, no install, no waiting.
4. Users on the old version keep their sessions because the JWT secret and cookie domain are unchanged across builds.
5. The proper fix then travels through Workflow 3 (preview) so the same mistake never ships twice.

**If it fails:**

- **Rollback works but errors persist** → the bug lives in the **database** (a migration), not the code; pair the code rollback with Workflow 11 (restore DB branch) — this is exactly why migrations and deployments ship together but roll back independently.
- **"Promote" disabled** → the older deployment used a different domain config; redeploy that commit from the Deployments screen instead.

---

### Workflow 6: Connecting a Custom Domain (optional, professional finish)

**What it does:** Replaces `*.vercel.app` addresses with your own branded addresses like `projectassure.in`.

**When you use it:** If the team buys a domain for the submission; purely optional — vercel.app URLs work fully for the demo.

**Steps:**

1. Buy the domain at any registrar (e.g., GoDaddy, Namecheap).
2. Vercel → project → Settings → Domains → Add `projectassure.in` (main), `analytics.projectassure.in`, `ai.projectassure.in`.
3. At the registrar, add the DNS records Vercel shows (A record `76.76.21.21` or CNAME `cname.vercel-dns.com` per instruction).
4. Wait for DNS propagation (minutes to a few hours); Vercel auto-issues SSL certificates.
5. Update the cross-domain env vars (`NEXTAUTH_URL`, `ANALYTICS_APP_URL`, `AI_ENGINE_URL`, `MAIN_APP_URL`) to the new addresses in all three projects.

**What happens at each step:**

1. The registrar owns the name; Vercel will claim the routing.
2. Vercel registers the intended hostname per project and waits for proof of ownership.
3. The DNS records are that proof — they tell the internet where the names live.
4. Vercel validates the DNS and provisions Let's Encrypt certificates automatically — HTTPS with zero manual work.
5. Old cookies belong to the old domain, so users simply log in once at the new domain; all three apps then agree on the new URLs.

**If it fails:**

- **"DNS verification pending" for hours** → a stray old record conflicts; remove duplicates at the registrar and recheck.
- **SSL error** → certificate issuance can lag DNS propagation by a few minutes; retry after 10 minutes before touching anything.
- **Login breaks after domain change** → `NEXTAUTH_URL` still says the old `.vercel.app` address; update it and redeploy.

---

### Workflow 7: Cross-Domain SSO Login (what happens when a user logs in once)

**What it does:** Lets a user log in on the main app and then open the analytics or AI-engine domain already authenticated — one credential, three doors.

**When you use it:** Constantly — this is a user-facing feature, not an admin task. The team must be able to explain it to the jury.

**Steps (what the system does internally):**

1. User submits email + password on `projectassure.vercel.app/login`.
2. NextAuth verifies credentials (bcrypt hash check) against the `User` table in Neon.
3. NextAuth signs a JWT with the shared `NEXTAUTH_SECRET` and stores it in an HttpOnly cookie scoped to the main domain.
4. User clicks "Analytics" in the top bar → browser opens `analytics.projectassure.vercel.app` with the same cookie path strategy.
5. The analytics app's middleware verifies the JWT signature using the **same secret** — no second login.
6. Role claims inside the token (ADMIN / PROJECT_MANAGER / STAKEHOLDER / VIEWER) drive what the analytics UI renders.

**What happens at each step:**

1. The login POST hits a NextAuth route handler; rate limiting (Upstash) counts the attempts first to block brute force.
2. Prisma fetches the user; `bcrypt.compare` runs; only on success does the flow continue — failures are logged with a generic message (no user enumeration).
3. The token contains `sub` (user id), `role`, `departmentId`, and expiry; HttpOnly + Secure flags mean JavaScript cannot read it and it travels only over HTTPS.
4. The redirect is a normal top-level navigation; because every app verifies the same signing secret, the token is trusted everywhere.
5. Verification is local and stateless — the analytics app does **not** call the main app to ask "is this token real?"; signature math is the proof.
6. Component-level guards then filter data views by role and department.

**If it fails:**

- **Logged in on main, logged out on analytics** → the two projects have different `NEXTAUTH_SECRET` values, or a project's `NEXTAUTH_SECRET` env var was left empty.
- **Session dies after seconds** → token expiry misconfigured; check the NextAuth session config (`maxAge`).
- **403 on analytics for an admin** → role claim missing from the token (roles not included at JWT encoding); re-check the auth callbacks.

---

### Workflow 8: Email Alert Flow (health drop to inbox)

**What it does:** Turns a detected risk into a real email in an official's inbox — the "system talks to you" feature.

**When you use it:** Automatically, whenever triggers fire; tested manually after setup.

**Steps (automatic):**

1. The prediction cron (every 6 hours) recomputes health scores and delay predictions for all active projects.
2. A project's score drops into Red (0-49), or delay probability crosses 70%.
3. The engine creates an `Alert` row (severity, factors, recommended action) and a `Notification` row.
4. The alert rules decide the channel: Critical/High → email + in-app; Medium → in-app only.
5. `sendAlertEmail` renders the HTML template and hands the mail to Gmail SMTP.
6. Socket.io simultaneously pushes a real-time toast to every connected dashboard.

**What happens at each step:**

1. The cron fetches all projects in one pooled query, computes features, and calls the FastAPI ML service in batch.
2. Threshold rules are plain code — auditable and explainable to the jury (no black-box decisions on who gets emailed).
3. Persistence first: the alert exists in the database even if every later step fails, so nothing is lost silently.
4. Channel policy keeps the inbox sane: officials get emails only for what truly matters.
5. Nodemailer authenticates with the App Password and TLS; Gmail relays the message; failures are logged with the SMTP response code.
6. Dashboards update without refresh — the email and the toast are twins born from the same alert row.

**If it fails:**

- **No emails at all** → check `EMAIL_PASS` is the 16-character App Password (not the Google password), 2-Step Verification is on, and the address matches `EMAIL_USER`.
- **Emails in spam** → add SPF awareness in messaging to officials, or send from a Google Workspace address in a real deployment; for the demo, mark "not spam" once.
- **Alerts created but no email** → severity routing set the alert to Medium (in-app only) by design; verify the alert's severity column.

---

### Workflow 9: Document Ingestion Pipeline (upload to insight)

**What it does:** Converts an unstructured field report (PDF/Excel/image) into clean structured data on the dashboard — the feature that kills manual data entry.

**When you use it:** When a project manager uploads a monthly progress report; demonstrated live in the hackathon demo.

**Steps (automatic):**

1. User drags a file onto the upload zone on the project page.
2. The API stores the raw file in Vercel Blob and creates a `Document` row with status `PROCESSING`.
3. The AI engine fetches the file; text is extracted (pdfplumber for PDFs, openpyxl for Excel, Tesseract OCR for images).
4. The LLM (GPT-4o, Gemini fallback) converts raw text into structured JSON matching a Zod schema: progress %, milestones touched, spend, risks, issues.
5. Validation passes → the platform updates the project's records (new budget row, task statuses, notes).
6. Embeddings of the text are stored in Pinecone (project-scoped namespace) for future RAG answers.
7. Status flips to `PROCESSED`; the user sees an AI summary and the dashboard reflects the new data; Socket.io notifies subscribers.

**What happens at each step:**

1. The upload endpoint streams the file so even large reports do not block the serverless function; a size cap (e.g., 10 MB) guards the free tier.
2. Persisting before processing means a crash never loses the original file — reprocessing is always possible.
3. Different formats need different extractors; OCR is the slowest path, so it runs last and only for images/scans.
4. The LLM receives the extraction schema, not the database — it can never invent IDs or corrupt unrelated tables.
5. Zod is the safety net: anything the LLM outputs that does not match the schema is rejected and queued for human review, not silently applied.
6. Namespace-per-project isolation means searching Project A's documents can never leak Project B's content.
7. The user sees the loop close: file in, structured insight out, everything auditable.

**If it fails:**

- **Stuck in `PROCESSING`** → the function timed out on a huge scan; check Vercel logs, raise the cap or split the PDF, then re-trigger from the Documents panel.
- **"Extraction failed validation"** → the report's language/format defeated the schema; the row keeps the raw text — a human can map it manually, and the failure sample improves the prompt.
- **Blob upload 413** → file exceeds the limit; compress or split the file.

---

### Workflow 10: Monitoring and Incident Response (something broke — now what?)

**What it does:** Gives you a fixed diagnostic order so that under demo pressure you find any failure in under five minutes.

**When you use it:** Whenever any domain behaves strangely, before and during the hackathon.

**Steps (the diagnostic ladder — top to bottom):**

1. **Which layer?** Open the failing page and note the symptom type: blank screen, error toast, slow load, stale data.
2. **Vercel status first:** Dashboard → Deployments — is the latest deployment green? If red, roll back (Workflow 5).
3. **Function logs:** Vercel → Logs, filter by the failing path; read the newest error line — in 80% of cases the exception message names the missing variable or table.
4. **Database health:** Neon console → the project — is compute active (not scaled to zero with a cold-start delay)? Any active alerts?
5. **Redis/Pinecone:** Upstash and Pinecone consoles — quota hit? Connection errors?
6. **External APIs:** OpenAI/Gemini dashboards — rate limits or billing warnings?
7. Fix, redeploy, and re-run the failing action to confirm closure.

**What happens at each step:**

1. Symptom classification saves minutes: "blank page" points at rendering/build; "stale data" points at cache or cron; "error toast" points at an API.
2. Most demo-day failures are actually a bad deployment — checking this first is the cheapest possible test.
3. Logs are per-request and searchable; serverless errors appear within seconds of reproducing the issue.
4. Neon's scale-to-zero means the first request after idle can take 1-2 seconds (not an error — but must be explained if the jury notices).
5. Quota exhaustion on shared services is silent at the app layer and visible only in their consoles.
6. LLM failures fall back automatically (GPT-4o → Gemini → cache), so a red quota here explains "AI answers feel generic".
7. Every incident closes with the verification step, not just the fix — no "it should work now" in front of a jury.

**If it fails (the ladder itself):**

- **Cannot reproduce locally** → compare env vars between local `.env.local` and Vercel; 90% of "works on my machine" is an env difference.

---

### Workflow 11: Backup and Restore (Neon point-in-time recovery)

**What it does:** Protects the demo database — a bad migration or accidental deletion is reversible to any moment in the recent past.

**When you use it:** Before risky migrations; after any data accident; weekly as hygiene.

**Steps:**

1. **Automatic safety net:** Neon keeps point-in-time history (hours of it on the free tier) with zero configuration.
2. To restore: Neon console → Branches → choose `main` → **Restore to point in time** → pick the timestamp → confirm.
3. Neon creates a restored branch at that moment; verify the data (row counts, key records).
4. Repoint production: update `DATABASE_URL`/`DIRECT_URL` env vars in all three Vercel projects to the restored branch's connection strings, then redeploy.
5. Optional extra export: `pg_dump "$DATABASE_URL" > backup_$(date +%F).sql` for a portable offline copy before big changes.

**What happens at each step:**

1. Neon records page-level changes continuously — restore granularity is minutes, not nightly snapshots.
2. The restore is copy-on-write: instant, cheap, and it never touches the damaged branch (you can inspect both side by side).
3. Verification before repointing prevents restoring into a different mistake.
4. Swapping env vars + redeploy moves all three domains onto the recovered data atomically (Workflow 2 mechanics).
5. The SQL dump is the belt-and-braces artifact that lives outside any vendor.

**If it fails:**

- **Restore timestamp missing** → free-tier history window is limited (hours, not weeks); act quickly and take dumps before experiments.
- **Row counts look wrong after restore** → confirm the timestamp timezone (UTC vs IST confusion is the classic cause).

---

### Workflow 12: Scaling Up (when the project grows past free tiers)

**What it does:** Defines the pre-planned upgrade path when usage grows — the jury question "will this scale?" answered with specifics, not hope.

**When you use it:** After the hackathon, when a sponsoring ministry pilots the platform for real.

**Steps:**

1. **Vercel Pro** — higher function limits, analytics, more bandwidth (per-team, not per-app).
2. **Neon Scale** — more storage and compute branches; keep the same connection-string discipline.
3. **Upstash pay-as-you-go** — raise command limits; same REST API, zero code change.
4. **OpenAI/Gemini** — raise spend caps; keep the fallback chain; add response caching for repeated queries.
5. **Python ML service** — move from a single container to a managed service (Railway/Fly.io/cloud run) with autoscaling; the contract (REST endpoints) does not change.
6. **Socket.io** — if real-time fan-out grows, add the Redis adapter across instances (already coded) or move to a managed realtime provider.

**What happens at each step:**

1-4. Every upgrade is a billing-plan change on the same API surface — no rewrites, because the architecture already treats each service as replaceable.
5. The ML service was built stateless precisely so horizontal scaling is a config change.
6. Real-time scale is the only component needing architectural attention — planned for, not discovered in panic.

**If it fails:**

- **Costs spike** → every provider has usage alerts; set them at onboarding, not after the first bill.

### In Plain English (Workflows in one breath)

> Workflows 1-6 are **how you move the platform** (first launch, daily pushes, previews, migrations, rollback, custom name). Workflows 7-9 are **how the platform moves for users** (one login everywhere, risk emails, reports-to-data). Workflows 10-12 are **how you stay calm** (a fixed diagnostic ladder, undo for data, a growth plan). If you can narrate these three sentences, you can answer almost any DevOps question the jury asks.

---

## PART 11: Security Checklist

| # | Control | Implementation | Status check |
|---|---------|----------------|--------------|
| 1 | Secrets never in git | All keys live in Vercel env vars / local `.env.local` (gitignored) | `git log -p | grep sk-` returns nothing |
| 2 | Strong auth secret | `NEXTAUTH_SECRET` = 256-bit random, identical across domains | `openssl rand -base64 32` used at setup |
| 3 | HttpOnly cookies | Session cookie unreachable from JavaScript | Application tab in devtools shows HttpOnly flag |
| 4 | HTTPS everywhere | Vercel + Neon + Upstash all enforce TLS 1.2+ | URLs all `https://`; `sslmode=require` in DB strings |
| 5 | Role-based access | Middleware route guards + per-endpoint role checks | Table in 05_API_DESIGN.md followed |
| 6 | Input validation | Zod schema on every mutating endpoint | Invalid payloads get 422, not 500 |
| 7 | SQL-injection safety | Prisma parameterised queries only; no raw string SQL | No `$queryRawUnsafe` with user input |
| 8 | Rate limiting | Upstash: 100 req/min/user general, 5/min on login | 429 responses under load |
| 9 | Email security | Gmail App Password (revocable), never the account password | App Password removable in one click |
| 10 | CORS | Only the three platform origins allowed | Foreign origins get blocked |
| 11 | Upload limits | 10 MB cap, MIME whitelist (pdf/xlsx/png/jpg) | Oversized/malicious files rejected |
| 12 | Audit trail | `AuditLog` rows for every mutation (who, what, when) | Records visible in admin panel |
| 13 | LLM guardrails | Zod-validated tool outputs, schema-bound extraction, project-scoped RAG filters | Malformed LLM output is rejected, not applied |
| 14 | Dependency hygiene | Lockfile pinned; Dependabot enabled | No critical advisories open |

### In Plain English

> Security here is a **stack of seatbelts**: no single belt is fancy, but wearing all fourteen at once means a single failure never becomes an accident.

---

## PART 12: Troubleshooting Matrix (symptom → cause → fix)

| # | Symptom | Most likely cause | Fix |
|---|---------|-------------------|-----|
| 1 | Build fails: "Module not found @projectassure/ui" | Wrong Root Directory / workspace config | Set Root Directory to the app folder; check `pnpm-workspace.yaml` |
| 2 | Login redirects back to login | `NEXTAUTH_URL` mismatch or missing secret | Match URL to the live domain; set the secret in all projects |
| 3 | SSO broken between domains | Different `NEXTAUTH_SECRET` values | Copy the identical secret to all three projects, redeploy |
| 4 | All data pages 500 | Wrong `DATABASE_URL` / DB paused | Verify pooled string; wake Neon; check logs |
| 5 | Migrations fail on deploy | Used pooled URL for migrations | `DIRECT_URL` must be the direct (non-pooler) string |
| 6 | Dashboard numbers stale | Redis cache not invalidated on write | Check cache keys and invalidation on mutation endpoints |
| 7 | Real-time toasts missing | Socket.io not connected / adapter down | Confirm Upstash token; check `/api/socket` route logs |
| 8 | AI answers generic or erroring | OpenAI quota/rate limit | Fallback chain engaged; check OpenAI usage, top up or wait |
| 9 | Document stuck PROCESSING | Function timeout on a big scan | Split the file; reprocess from Documents panel |
| 10 | Emails not arriving | App Password wrong / 2FA off | Regenerate App Password; verify 2-Step Verification on |
| 11 | First request after idle is slow (1-2 s) | Neon scale-to-zero cold start | Normal behaviour; mention it proactively in the demo |
| 12 | Preview shows production data | Preview env inherits prod `DATABASE_URL` | Add preview-scoped DB var pointing at the Neon dev branch |
| 13 | Upload 413 error | File exceeds Blob/upload limit | Compress or split; raise cap consciously |
| 14 | Random 429s during demo | Rate limit threshold hit by retries | Raise the login/demo limits temporarily via env config |

---

## PART 13: Go-Live Checklist (tick all before the jury arrives)

- [ ] All three domains return 200 and render the correct app (not a sibling app).
- [ ] Login works on the main app **and** the session carries into analytics and AI engine without re-login.
- [ ] Executive dashboard shows seeded data with the correct health-score colours.
- [ ] One project is deliberately Red, one Amber, rest Green — the demo story is visible in 5 seconds.
- [ ] Creating a project → milestone → task works end to end; the change appears in analytics.
- [ ] Prediction panel shows delay probability + top factors for at least one at-risk project.
- [ ] AI chat answers "Which projects need my attention today?" with citations in under 10 seconds.
- [ ] Document upload of the sample PDF completes to `PROCESSED` and updates the dashboard.
- [ ] A critical alert arrives as both a toast and an email.
- [ ] CSV export downloads from the analytics domain.
- [ ] Rollback rehearsed once (Workflow 5) — you know the clicks under pressure.
- [ ] Backup point-in-time restore rehearsed once (Workflow 11).
- [ ] All env var values double-checked against Part 4 (especially the shared secret).
- [ ] Backup demo video on two devices + offline PWA mode tested.
- [ ] Free-tier quotas checked (Vercel bandwidth, Neon hours, OpenAI credits) on demo morning.

---

## PART 14: Cost Monitoring and Free-Tier Headroom

| Service | Free limit | Expected demo usage | Headroom | Upgrade trigger |
|---------|-----------|---------------------|----------|-----------------|
| Vercel bandwidth | 100 GB/month | < 5 GB (demo + team) | Very high | Team pilots with real users |
| Vercel function invocations | Generous hobby limits | Low (single-team traffic) | Very high | Real national deployment |
| Neon storage | 0.5 GB | < 50 MB seeded + uploads metadata | High | Months of real documents |
| Neon compute hours | ~191 hrs/month | Scales to zero; demo-day usage is minutes | High | Always-on pilot |
| Upstash commands | 10K/day | < 2K/day typical | High | Real-time at scale |
| Pinecone | 1 index, ~100K vectors | 30 projects x docs ≈ few thousand vectors | High | National document corpus |
| Gmail SMTP | ~500/day | < 50/day | High | Official recipient lists |
| OpenAI | Pay-as-you-go | Set a $5 monthly cap for the build | Capped by design | Ministry pilot budget |
| Gemini | Free tier quota | Fallback only | High | Replace OpenAI as primary if needed |

**Total running cost of the platform as submitted: INR 0.** The only spend is the optional OpenAI usage, hard-capped by a billing limit the team sets in the OpenAI dashboard — and even that falls back to the free Gemini tier if it runs out.

---

*This document is part of the ProjectAssure SIH 2026 submission.*




