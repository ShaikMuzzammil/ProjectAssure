# ProjectAssure - System Architecture & Design

> **Document:** 02 - System Architecture & Design
> **Project:** ProjectAssure - AI-Powered Integrated Project Monitoring Platform
> **SIH 2026:** Problem Statement ID SIH26103 | Theme: Smart Automation | Category: Software | Organisation: MoSPI
> **Team:** [TEAM ID] / [TEAM NAME] - Amrita Vishwa Vidyapeetham, Chennai Campus

ProjectAssure is an **AI-powered, web-based, integrated project-monitoring platform** built for the Ministry of Statistics and Programme Implementation (MoSPI). It predicts project delays **30-60 days before they materialise** and gives MoSPI a **single pane of glass** over the entire national project portfolio. The architecture described in this document is what makes those two promises achievable at national scale: three independently deployable Next.js 15 applications, one shared intelligence layer, and one governed data layer, all wired together through a pnpm + Turborepo monorepo.

This document walks through the architecture in increasing depth:

1. The high-level deployment picture (Section 1) and the five logical layers underneath it (Section 2)
2. Why the system is split into micro-frontends, and a fully annotated tour of the monorepo (Section 3)
3. How authentication and role-based authorization work across all three domains (Section 4)
4. Three end-to-end request walk-throughs - a write, a read, and an AI query (Section 5)
5. The three core data pipelines, plus a data-ownership contract (Section 6)
6. Caching, security, scalability, failure recovery, and the key architecture decisions (Sections 7-11)

Every design choice documented here optimises four properties that a government platform tracking national projects cannot compromise on:

| Property | Meaning in ProjectAssure | Where it shows up in this document |
|---|---|---|
| **Auditability** | Every create/update/delete is attributable to a named user and timestamped | Audit log writes in the request lifecycle (Section 5.1), threat model (Section 8.2) |
| **Availability** | Officials can always see portfolio status, even when subsystems fail | Failure modes table (Section 10), caching (Section 7) |
| **Correctness** | A wrong delay prediction is worse than none; data must be consistent | Prediction pipeline (Section 6.2), validation layers (Section 5.1) |
| **Cost discipline** | Public money funds this; we pay only for real usage | Serverless scaling model and capacity math (Section 9) |

## 1. High-Level Architecture Overview

ProjectAssure follows a **micro-frontend architecture** with a shared backend, designed for national-scale deployment. The system is decomposed into **three independently deployable frontend domains** connected to a unified API and data layer:

1. **Main Application** (`projectassure.vercel.app`) - the day-to-day system of record: projects, tasks, milestones, alerts, user management, and the NextAuth v5 login that issues sessions for all three domains.
2. **Analytics Dashboard** (`analytics.projectassure.vercel.app`) - the portfolio lens for MoSPI officials: budget burn, resource utilisation, trend analysis, and PDF/Excel export.
3. **AI Engine** (`ai.projectassure.vercel.app`) - the intelligence layer exposed to users: conversational AI chat with RAG, document ingestion, delay predictions, and report summarisation - backed by a Python 3.12 FastAPI ML service running XGBoost and Prophet models.

All three domains are served through the Vercel Edge Network, which terminates TLS close to the user, serves cached static assets from the nearest region, and runs edge middleware before any serverless compute is billed.

```
┌──────────────────────────────────────────────────────────────────────┐
│                      CDN (Vercel Edge Network)                        │
│               Static Assets + Edge Middleware Functions               │
└──────────────┬───────────────────────────────┬───────────────────────┘
               │                               │
    ┌──────────┴──────────┐         ┌──────────┴─────────────┐
    │   MAIN APPLICATION  │         │  ANALYTICS DASHBOARD   │
    │ projectassure.      │         │ analytics.             │
    │   vercel.app        │         │   projectassure.       │
    │                     │         │   vercel.app           │
    │ - Next.js 15 (App)  │         │ - Next.js 15 (App)     │
    │ - Framer Motion 11  │         │ - D3.js / Recharts     │
    │ - shadcn/ui         │         │ - Export Engine        │
    │ - Tailwind CSS 4    │         │ - PDF/Excel Generation │
    │ - Auth (NextAuth v5)│         │                        │
    └──────────┬──────────┘         └──────────┬─────────────┘
               │                               │
    ┌──────────┴──────────┐         ┌──────────┴─────────────┐
    │   AI ENGINE DOMAIN  │         │    SHARED API LAYER    │
    │ ai.projectassure.   │         │ (Next.js Route         │
    │   vercel.app        │         │  Handlers in all apps) │
    │                     │         │                        │
    │ - Chat Interface    │         │ - Prisma 6 ORM         │
    │ - Doc Processing    │         │ - JWT Middleware       │
    │ - Prediction API    │         │ - Rate Limiting        │
    │ - RAG Pipeline      │         │ - Validation (Zod)     │
    └──────────┬──────────┘         └──────────┬─────────────┘
               │                               │
    ┌──────────┴───────────────────────────────┴─────────────┐
    │                 DATA & SERVICES LAYER                  │
    │                                                        │
    │  ┌───────────────┐  ┌───────────┐  ┌────────────────┐  │
    │  │ PostgreSQL 16 │  │ Redis     │  │ Vector DB      │  │
    │  │ (Neon)        │  │ (Upstash) │  │ (Pinecone)     │  │
    │  └───────────────┘  └───────────┘  └────────────────┘  │
    │  ┌───────────────┐  ┌───────────┐  ┌────────────────┐  │
    │  │ Object Store  │  │ Python ML │  │ Email (SMTP)   │  │
    │  │ (Vercel Blob) │  │ (FastAPI) │  │ (Nodemailer +  │  │
    │  │               │  │           │  │  Gmail SMTP)   │  │
    │  └───────────────┘  └───────────┘  └────────────────┘  │
    └────────────────────────────────────────────────────────┘
```

**Reading the diagram, step by step:**

1. **Entry (top box).** Every request - static asset, page, or API call - first touches the Vercel Edge Network. Edge middleware performs the cheapest checks first: TLS, JWT presence, rate limits, and redirects.
2. **Main Application (left, tier 1).** The only domain that renders the login page and mints JWTs. It owns the CRUD routes for projects, tasks, milestones, and alerts.
3. **Analytics Dashboard (right, tier 1).** Reads the same database through its own aggregation API routes; never writes project data. Its heavy chart libraries and export engine are deployed here, not in the main app.
4. **AI Engine (left, tier 2).** Streams chat responses, runs the document-ingestion pipeline, and fronts the Python ML service. It can be disabled entirely without affecting core project management - a deliberate architectural safety property.
5. **Shared API Layer (right, tier 2).** Not a separate server: it is the set of Next.js Route Handlers inside each app, all built on the same Prisma client, Zod validation schemas, JWT middleware, and Upstash rate limiter from the shared packages.
6. **Data & Services Layer (bottom).** PostgreSQL 16 on Neon is the single source of truth. Upstash Redis accelerates and protects it (cache, rate limiting, sessions, Socket.io fan-out). Pinecone stores document embeddings for RAG. Vercel Blob stores uploaded files. The Python ML service and the Gmail SMTP mailer round out the stateful satellites.

**Component inventory:**

| Tier | Component | Technology | Responsibility | Why this choice |
|---|---|---|---|---|
| Edge | CDN + static hosting | Vercel Edge Network | TLS termination, global asset caching, geo-routing | Managed global PoPs with zero ops overhead |
| Edge | Middleware | Next.js middleware (edge runtime) | First-pass JWT verification, rate limiting, redirects | Runs in ~1 ms near the user, before compute is billed |
| App | Main application | Next.js 15, TypeScript 5, Tailwind CSS 4, shadcn/ui, Framer Motion 11 | Projects, tasks, milestones, alerts, settings, login | App Router server components keep the system-of-record UI fast |
| App | Analytics dashboard | Next.js 15, D3.js / Recharts | Portfolio analytics, trends, PDF/Excel export | Heavy charts isolated from the main bundle |
| App | AI engine | Next.js 15, streaming UI | Chat, ingestion, predictions, RAG | Long-lived streams isolated from CRUD traffic |
| API | Shared API layer | Next.js Route Handlers, Prisma 6, Zod | Validation, business logic, RBAC, rate limiting | One language end-to-end; types shared via `packages/types` |
| Intelligence | LLMs | OpenAI GPT-4o + Gemini fallback | Chat, extraction, summarisation, tool calling | Best-quality primary with an independent fallback vendor |
| Intelligence | ML service | Python 3.12, FastAPI, XGBoost, Prophet | Delay classification, schedule forecasting | Python's ML ecosystem is unmatched; FastAPI is async and lightweight |
| Data | Relational DB | PostgreSQL 16 on Neon | Source of truth for all structured data | Serverless Postgres with pooling and branching |
| Data | Cache / guard | Upstash Redis | Cache, rate limiting, sessions, Socket.io fan-out | HTTP-based Redis that works inside serverless functions |
| Data | Vector DB | Pinecone | Embeddings of documents and projects for RAG | Managed, filtered, low-latency vector search |
| Data | Object store | Vercel Blob | PDFs, images, Excel uploads | Signed URLs, same platform as the apps |
| Services | Email | Nodemailer + Gmail SMTP (App Password) | Alerts, invitations, digest mails | Zero-cost transactional volume, TLS-secured |
| Services | Realtime | Socket.io + Redis adapter | Live CRUD broadcast, presence | Battle-tested; Redis adapter scales across instances |
| Dev | Local parity | Docker Compose (postgres, redis, python-ml) | Identical local stack for the team | One-command onboarding, no cloud accounts needed |

### In Plain English

> Think of ProjectAssure as a government service centre with three specialised counters. The first counter (main app) is where files are opened, edited, and signed off. The second counter (analytics) prints statistics and summary booklets from the same records. The third counter (AI engine) is a smart assistant kiosk that answers questions and reads documents for you. Behind the counters, all three share one record room (PostgreSQL on Neon), one notice board for instant announcements (Socket.io + Redis), and one security guard who issued everyone their visitor badge (NextAuth v5 SSO). A citizen never needs to know how the counters are wired together - they experience one consistent office.

## 2. The Five-Layer Architecture Model

The deployment diagram above shows *where* code runs. It is equally useful to describe *what each part is responsible for*. ProjectAssure is organised into five logical layers, ordered from the user's screen down to permanent storage:

```
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 1 - CLIENT          React 19 UI, Tailwind 4 + shadcn/ui,      │
│                           React Query cache, Zustand state,         │
│                           Socket.io client, optimistic updates      │
├─────────────────────────────────────────────────────────────────────┤
│ LAYER 2 - EDGE            Vercel Edge Network CDN, edge middleware, │
│                           JWT presence check, Upstash rate limit,   │
│                           geographic routing                        │
├─────────────────────────────────────────────────────────────────────┤
│ LAYER 3 - APPLICATION     Next.js 15 route handlers in 3 apps,      │
│                           Zod validation, RBAC guards, Prisma 6,    │
│                           NextAuth v5, business rules, audit logs   │
├─────────────────────────────────────────────────────────────────────┤
│ LAYER 4 - INTELLIGENCE    GPT-4o + Gemini fallback, RAG over        │
│                           Pinecone, tool calling, XGBoost +         │
│                           Prophet ML service (FastAPI), cron        │
│                           prediction jobs                           │
├─────────────────────────────────────────────────────────────────────┤
│ LAYER 5 - DATA            PostgreSQL 16 (Neon) source of truth,     │
│                           Upstash Redis cache/sessions,             │
│                           Pinecone vectors, Vercel Blob files       │
└─────────────────────────────────────────────────────────────────────┘
```

**Layer responsibilities in detail:**

| Layer | What lives here | Key technologies | What it must never do | Scaling model |
|---|---|---|---|---|
| **1. Client** | Rendering, form state, optimistic updates, live subscriptions, offline-ish caching | React 19, React Query, Zustand, Socket.io client | Never hold secrets, never trust its own RBAC UI hiding as security | Free - scales with the user's own device |
| **2. Edge** | Cheap, global, per-request gating | Vercel middleware, Upstash Ratelimit | Never query the database or run business logic | Automatic; every Vercel region, no config |
| **3. Application** | All business rules: validation, permission checks, transactions, audit trails | Next.js Route Handlers, Zod, Prisma 6, NextAuth v5 | Never call ML models inline on a CRUD hot path | Serverless instances scale to zero and out per request |
| **4. Intelligence** | Anything that learns or reasons: predictions, RAG answers, document extraction | GPT-4o, Gemini fallback, Pinecone, FastAPI (XGBoost, Prophet) | Never become a hard dependency of core CRUD | Separate service; heavy jobs run on cron, not on user requests |
| **5. Data** | Durable state and truth | Neon PostgreSQL 16, Upstash Redis, Pinecone, Vercel Blob | Never contain business rules (no stored procedures with policy logic) | Each store scales independently (compute/storage split on Neon) |

**Rules that keep the layers clean:**

1. **A layer may only call the layer directly beneath it.** A client component talks to API routes; an API route talks to Prisma, Redis, or the ML service; Prisma talks only to PostgreSQL. No component reaches two layers down (a button never runs SQL).
2. **The data layer never calls upward.** PostgreSQL does not invoke application code. Events that need to trigger work (e.g. "document uploaded") are queued as explicit steps in the application layer, keeping the flow debuggable.
3. **Layer 4 is optional by design.** Every CRUD path must complete with the intelligence layer switched off. If OpenAI, Gemini, Pinecone, and the ML service all vanished simultaneously, ProjectAssure would still manage projects, tasks, milestones, and alerts perfectly - it would simply stop predicting and answering.
4. **Cross-cutting concerns live at the layer boundaries.** Authentication and rate limiting sit between Layers 2 and 3; audit logging sits between Layers 3 and 5. This gives one choke point per concern instead of scattering it through the codebase.

### In Plain English

> A layered architecture is like a restaurant. The dining room (client layer) takes your order and keeps your drinks topped up. The waiter (edge layer) screens who comes in and refuses anyone ordering too much too fast. The kitchen (application layer) actually cooks according to the recipes and hygiene rules. The head chef (intelligence layer) creates special dishes and guesses what you might want next. The storeroom (data layer) holds every ingredient and never forgets anything. You never walk into the storeroom yourself, and the storeroom does not care how many guests are seated tonight - each layer can be renovated without closing the whole restaurant.

## 3. Micro-Frontend Architecture

### 3.1 Why Micro-Frontends for a Government Platform

A single monolithic frontend is the default choice for most products, and it would work - at first. Three forces specific to ProjectAssure pushed the design toward micro-frontends:

1. **Different user populations with different rhythms.** Project managers live inside the main app all day, editing tasks and milestones. MoSPI officials mostly consume aggregate dashboards and exports. AI interactions are bursty and long-running (a chat answer streams for 5-20 seconds). Bundling all three into one JavaScript bundle means every user downloads code they never use, and one slow feature drags on every page load.
2. **Independent release cadence and blast-radius isolation.** AI features iterate weekly as prompts and models evolve; the main app must change carefully because it is the system of record for national project data. If a bad deploy breaks the AI domain, project management keeps working. If the analytics export engine hangs, nobody's task board freezes with it.
3. **Separate scaling and cost profiles.** Analytics exports are CPU- and memory-heavy; AI endpoints hold long-lived streaming connections; the main app is a high-volume of short requests. As independent Vercel projects, each domain scales its own serverless functions and can be rate-limited on its own budget.

### 3.2 Domain Separation Strategy

Each domain is a **separate Next.js 15 application** with its own `package.json`, deployed independently on Vercel. Domains communicate through:

- **Shared database**: All domains read/write to the same PostgreSQL (Neon) instance. Ownership is still strictly defined (see Section 6.4) so that only one domain is authoritative for each data type - sharing the database does *not* mean sharing write responsibility.
- **Shared authentication**: NextAuth v5 with JWT tokens, shared across domains. All three apps deploy the same `NEXTAUTH_SECRET`, so a token minted at login on the main app is verifiable by the analytics and AI apps without a network round-trip. Cross-domain navigation performs a short, silent handoff described in Section 4.2.
- **API calls**: Cross-domain API calls via environment-configured URLs (for example, the analytics app calls `ai.projectassure.vercel.app/api/predict/...` to embed model-backed risk widgets, and the AI engine reads project context through typed service calls).
- **Shared UI package**: A monorepo with shared components in `packages/ui`, so a `HealthScoreBadge` or `DataTable` looks and behaves identically in all three domains.

**The three domains at a glance:**

| Domain | URL | Purpose | Primary users | Distinctive technology |
|---|---|---|---|---|
| Main Application | `projectassure.vercel.app` | System of record: projects, tasks, milestones, alerts, users, login | ADMIN, PROJECT_MANAGER | NextAuth v5, Framer Motion 11, shadcn/ui, highest write traffic |
| Analytics Dashboard | `analytics.projectassure.vercel.app` | Portfolio analytics, budget burn, trends, exports | MoSPI officials, STAKEHOLDER | D3.js / Recharts, PDF/Excel export engine, long cache TTLs |
| AI Engine | `ai.projectassure.vercel.app` | Chat with RAG, document ingestion, predictions, summaries | All roles | SSE streaming, tool calling, GPT-4o + Gemini, FastAPI ML backend |

**How the domains talk to each other:**

| Channel | Mechanism | Concrete example |
|---|---|---|
| Identity | Shared `NEXTAUTH_SECRET`; JWT cookie + one-time SSO handoff (Section 4.2) | User logs in once on the main app, lands on analytics already signed in |
| Structured data | Direct Prisma reads over the shared Neon database | Analytics aggregates milestone completion from the same `tasks` table the main app writes |
| Cross-domain APIs | Environment-configured base URLs + JWT forwarded in the request | Analytics risk widgets call the AI engine's `/api/predict` endpoints |
| UI consistency | `packages/ui` components in all three bundles | Same `DelayRiskBadge` in the task board, the analytics table, and the AI citations |
| Live updates | Socket.io rooms keyed by project/department, fan-out via the Redis adapter | A task edit on the main app instantly refreshes an open analytics view of that project |

### 3.3 Monorepo Structure (Annotated)

All three apps live in **one repository** managed by pnpm workspaces and Turborepo. The rationale: one pull request can change a shared type and all three apps atomically; pnpm's content-addressable store makes a three-app install fast; Turborepo's task graph rebuilds only what changed and shares its cache across the team.

The tree below is annotated line by line - the `WHY` comments explain the *reason each folder exists*, not just what it contains:

```
projectassure/
├── apps/                            # The three deployable units. Each child is registered as a
│   │                                # separate Vercel project: own env vars, own deploy, own logs.
│   │                                # WHY separate apps: heavy exports or long AI streams can never
│   │                                # slow down or break the main project-management experience.
│   ├── web/                         # MAIN APPLICATION (projectassure.vercel.app)
│   │   │                            # WHY: the system of record. Projects, tasks, milestones,
│   │   │                            # alerts, users and login live here; the other two defer to it.
│   │   ├── app/                     # Next.js 15 App Router root. WHY: server components stream HTML
│   │   │                            # and colocate data fetching with UI, cutting request waterfalls.
│   │   │   ├── (auth)/              # Login / verify / forgot-password pages, in a route group so
│   │   │   │                        # they render WITHOUT the dashboard shell (users see them while
│   │   │   │                        # unauthenticated, so no sidebar must be shipped to them).
│   │   │   ├── (dashboard)/         # All protected pages. WHY grouped: middleware guards the whole
│   │   │   │                        # segment with a single JWT check instead of per-page logic.
│   │   │   │   ├── projects/        # Project management: list, detail, timeline, task board.
│   │   │   │   │                    # WHY first-class: this is the 80% daily surface for managers.
│   │   │   │   ├── analytics/       # Basic in-app analytics (sparklines, health badges). WHY here
│   │   │   │   │                    # too: managers need quick context without a domain switch;
│   │   │   │   │                    # deep analysis stays in the analytics domain.
│   │   │   │   ├── settings/        # User / organisation settings. WHY separate: RBAC gates this
│   │   │   │   │                    # segment to ADMIN only (enforced in middleware, Section 4.7).
│   │   │   │   └── layout.tsx       # Dashboard layout: sidebar, top bar, WebSocket provider. WHY a
│   │   │   │                        # shared layout: sockets and caches survive client navigation.
│   │   │   ├── api/                 # Route handlers = the API layer. WHY colocated: one deploy unit,
│   │   │   │                        # shared Zod types with the UI, no second backend to operate.
│   │   │   │   ├── auth/            # NextAuth v5 catch-all. WHY here: the main app is the identity
│   │   │   │   │                    # provider for all three domains (see Section 4.2).
│   │   │   │   ├── projects/        # Project CRUD + assignment + department scoping rules.
│   │   │   │   ├── tasks/           # Task CRUD: the highest-traffic write path (Section 5.1).
│   │   │   │   ├── milestones/      # Milestone tracking - feeds the 25% milestone weight of the
│   │   │   │   │                    # health score (schedule 30 + budget 25 + resources 20 + 25).
│   │   │   │   ├── alerts/          # Alert inbox, acknowledge + mute rules.
│   │   │   │   └── reports/         # Report generation jobs (PDF/Excel) on the main-app surface.
│   │   │   ├── components/          # App-specific components (forms, boards). Shared ones live in
│   │   │   │                        # packages/ui. WHY split: generic UI vs domain-specific UI.
│   │   │   ├── lib/                 # App utilities: fetchers, permission helpers, feature flags.
│   │   │   └── globals.css          # Tailwind CSS 4 entry + design tokens.
│   │   ├── prisma/
│   │   │   └── schema.prisma        # Shared database schema. WHY here: the main app owns migrations,
│   │   │                            # so schema changes ship with the system-of-record deploy.
│   │   ├── public/                  # Static assets (logos, icons) served straight from the CDN.
│   │   ├── next.config.ts           # Transpiles workspace packages, sets image domains + CSP.
│   │   ├── tailwind.config.ts       # Extends shared design tokens from packages/config.
│   │   ├── tsconfig.json            # Path aliases to packages/* - WHY: type-safe imports across apps.
│   │   ├── .env.local               # Local secrets, never committed (.env.example is the template).
│   │   └── package.json             # Own dependencies only; shared code comes from workspace packages.
│   │
│   ├── analytics/                   # ANALYTICS DASHBOARD (analytics.projectassure.vercel.app)
│   │   │                            # WHY a separate domain: heavy aggregation queries and chart
│   │   │                            # bundles never touch the main app's performance budget.
│   │   ├── app/
│   │   │   ├── (dashboard)/         # Analytics pages, same guard pattern as web.
│   │   │   │   ├── portfolio/       # Portfolio analytics: health distribution, delay-risk views.
│   │   │   │   ├── budget/          # Budget analytics: burn rate vs plan, anomaly flags.
│   │   │   │   ├── resources/       # Resource analytics: utilisation, allocation conflicts.
│   │   │   │   ├── trends/          # Trend analysis: velocity and slippage over time.
│   │   │   │   └── exports/         # Report export: PDF/Excel generation. WHY isolated: export is
│   │   │   │                        # CPU/memory heavy; isolating it protects page rendering.
│   │   │   └── api/                 # Aggregation endpoints with long Redis TTLs (read-mostly traffic).
│   │   ├── components/              # Chart wrappers (D3.js / Recharts) tuned for this domain.
│   │   └── package.json
│   │
│   └── ai-engine/                   # AI ENGINE DOMAIN (ai.projectassure.vercel.app)
│       │                            # WHY a separate domain: AI workloads (long streams, large
│       │                            # prompts, model latency) fail differently from CRUD. Isolation
│       │                            # caps the blast radius and lets AI be scaled/rate-limited alone.
│       ├── app/
│       │   ├── (dashboard)/
│       │   │   ├── chat/            # AI chat interface with streaming (SSE) rendering.
│       │   │   ├── documents/       # Document processing UI: upload, extraction status, review.
│       │   │   └── predictions/     # Prediction dashboard: delay risk, forecast charts, explanations.
│       │   └── api/
│       │       ├── chat/            # LLM chat endpoint: intent → tools → RAG → GPT-4o stream.
│       │       ├── ingest/          # Document ingestion pipeline entry point (Section 6.3).
│       │       ├── predict/         # ML prediction endpoints - proxy the Python FastAPI service.
│       │       └── summarize/       # Report summarisation (PDF/Excel/project history).
│       ├── python/                  # PYTHON ML SERVICE (Python 3.12 + FastAPI)
│       │   │                        # WHY Python: XGBoost and Prophet are first-class there. WHY a
│       │   │                        # separate service: models have their own memory profile and can
│       │   │                        # be retrained/redeployed without touching any UI code.
│       │   ├── models/              # Serialised XGBoost delay-classifier + Prophet forecast models.
│       │   ├── pipelines/           # Feature extraction, training and evaluation pipelines.
│       │   ├── services/            # FastAPI routers: /predict-delay, /forecast, /health.
│       │   └── requirements.txt     # Pinned dependencies for reproducible model environments.
│       └── package.json
│
├── packages/                        # Shared workspace code. WHY a packages layer: exactly one
│   │                                # implementation of each cross-cutting concern, consumed by
│   │                                # all three apps instead of three drifting copies.
│   ├── ui/                          # Shared UI component library
│   │   ├── src/
│   │   │   ├── components/          # shadcn/ui primitives + custom components (HealthScoreBadge,
│   │   │   │                        # DataTable). WHY shared: identical look/behaviour everywhere.
│   │   │   ├── hooks/               # Shared React hooks (useWebSocket, usePermission, useDebounce).
│   │   │   └── lib/                 # Shared utilities (formatters, date helpers, colour scales).
│   │   └── package.json
│   │
│   ├── db/                          # Shared database package
│   │   ├── src/
│   │   │   ├── client.ts            # Prisma client singleton. WHY centralised: one pooled client
│   │   │   │                        # per serverless instance instead of one per module, which
│   │   │   │                        # would exhaust Neon's connection pool (connection storms).
│   │   │   ├── seed.ts              # Database seeder for demo/dev environments.
│   │   │   └── migrations/          # Migration files - versioned, reviewable, reversible.
│   │   └── package.json
│   │
│   ├── types/                       # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── project.ts           # Project/Task/Milestone DTOs - the API↔UI contract.
│   │   │   ├── user.ts              # User, Role enum, session shape - the RBAC vocabulary.
│   │   │   ├── alert.ts             # Alert types and severity levels.
│   │   │   └── ai.ts                # AI request/response, tool definitions, citation shapes.
│   │   └── package.json             # WHY: renaming a field here breaks compile-time in all three
│   │                                # apps - the monorepo turns runtime surprises into compiler
│   │                                # errors caught in CI before any deploy.
│   │
│   └── config/                      # Shared configuration
│       ├── src/
│       │   ├── auth.ts              # NextAuth v5 config: providers, JWT callbacks, role claims.
│       │   ├── email.ts             # Nodemailer transport (Gmail SMTP + App Password) + templates.
│       │   └── ai.ts                # LLM model IDs, fallback order, token budgets, prompt constants.
│       └── package.json
│
├── docker-compose.yml               # Local development: postgres, redis, python-ml services. WHY:
│   │                                # every developer runs identical infrastructure with one command.
├── turbo.json                       # Turborepo config: task graph + build cache. WHY: builds only
│   │                                # what changed; remote cache shared across the whole team.
├── pnpm-workspace.yaml              # pnpm workspace config. WHY pnpm: content-addressable store
│   │                                # makes three-app installs fast and disk-friendly.
├── .env.example                     # Environment variable template - documents every required secret.
└── README.md
```

**What the monorepo buys us compared to three separate repositories:**

| Concern | Three separate repos | One Turborepo monorepo (chosen) |
|---|---|---|
| Shared type change | Edit in repo A, publish package, bump in B and C - three PRs, drift risk | One PR; TypeScript fails the build in any app that forgets to adapt |
| UI consistency | Copy-paste components; visual drift over months | Single `packages/ui`; one `HealthScoreBadge` everywhere |
| Onboarding a new teammate | Clone three repos, wire three toolchains | `pnpm install && docker compose up` - done |
| Cross-cutting fixes (auth config, email templates) | Repeated in each repo, easily forgotten in one | Fixed once in `packages/config`, picked up by all apps |
| CI cost | Every repo builds everything it vendored | Turborepo rebuilds only affected apps (cached task graph) |

### In Plain English

> Micro-frontends are like separate shop counters that share one warehouse: the grocery counter, the pharmacy counter, and the information kiosk each run independently - one can be repainted or restaffed without closing the others - but they all draw stock from the same warehouse and accept the same entry ticket. The monorepo is the mall management office sitting above all three counters: one set of keys (shared packages), one rulebook (shared types and config), and one maintenance crew (Turborepo) that only services the shops that actually changed.

## 4. Authentication & Authorization Architecture

### 4.1 Design Goals

1. **One login for three domains.** A user who signs in on the main app must never re-enter a password to use analytics or AI features.
2. **Stateless verification at the edge.** Checking "is this request authenticated?" must not query the database - the JWT is verified locally in ~1 ms using the shared secret.
3. **Roles travel with the token.** The user's role and department ride inside the JWT, so every request carries its own authorization context.
4. **The database remains the final authority.** JWT claims decide *routing* and *first-pass* authorization; sensitive operations re-check the user's current role in PostgreSQL, so a demoted user loses access as soon as their next DB-backed check runs, not weeks later when the token expires.

### 4.2 Cross-Domain SSO Login Flow

The compact view - one login, two verifiers, one source of truth:

```
User → Login Page → NextAuth.js → JWT Token → HttpOnly Cookie
                                                          ↓
                                    ┌─────────────────────┴────────────┐
                                    │                                    │
                              Main App                          Analytics App
                            (verifies JWT)                    (verifies JWT)
                                    │                                    │
                                    └─────────────────────┬────────────┘
                                                          ↓
                                              Prisma → PostgreSQL
                                              (user lookup + role check)
```

The full sequence, including the silent cross-domain handoff. All three apps share the same `NEXTAUTH_SECRET`, so anything the main app signs, the other domains trust:

```
   Browser              Main App (NextAuth v5)         PostgreSQL (Neon)        Analytics App
      │                          │                           │                      │
      │ 1. POST /api/auth/       │                           │                      │
      │    callback/credentials  │                           │                      │
      │    (email + password)    │                           │                      │
      │─────────────────────────>│                           │                      │
      │                          │ 2. Prisma: find user      │                      │
      │                          │    by email               │                      │
      │                          │──────────────────────────>│                      │
      │                          │ 3. user row: id, role,    │                      │
      │                          │    department, hash       │                      │
      │                          │<──────────────────────────│                      │
      │                          │ 4. bcrypt.compare()       │                      │
      │                          │ 5. Sign JWT (HS256) with  │                      │
      │                          │    shared NEXTAUTH_SECRET;│                      │
      │                          │    claims: sub, role, dept│                      │
      │ 6. Set-Cookie: session   │                           │                      │
      │    JWT (HttpOnly; Secure;│                           │                      │
      │    SameSite=Lax)         │                           │                      │
      │<─────────────────────────│                           │                      │
      │ 7. 302 → /dashboard      │                           │                      │
      │<─────────────────────────│                           │                      │
      │                                                                            │
      │ 8. Later: GET analytics.projectassure.vercel.app/dashboard  │
      │───────────────────────────────────────────────────────────────────────────>│
      │                          │                           │  9. middleware:       │
      │                          │                           │     getToken() finds  │
      │                          │                           │     no session cookie │
      │<── 10. 302 to main-app SSO handoff endpoint ──────────────────────────────│
      │                          │                           │                      │
      │ 11. GET /api/auth/sso    │                           │                      │
      │─────────────────────────>│ 12. Valid session cookie  │                      │
      │                          │     found → mint ONE-TIME │                      │
      │ 13. 302 redirect back    │     handoff token (signed │                      │
      │     with handoff token   │     with shared secret,   │                      │
      │<─────────────────────────│     30 s TTL, jti stored  │                      │
      │                          │     once in Upstash)      │                      │
      │                          │                           │                      │
      │ 14. GET /api/auth/sso/   │                           │                      │
      │     callback?token=...   │                           │                      │
      │───────────────────────────────────────────────────────────────────────────>│
      │                          │                           │ 15. Verify signature  │
      │                          │                           │     (shared secret) + │
      │                          │                           │     Redis one-use     │
      │                          │                           │     check → issue     │
      │ 16. Set-Cookie: analytics│                           │     local session JWT │
      │     session JWT;         │                           │                      │
      │     dashboard renders    │                           │                      │
      │<───────────────────────────────────────────────────────────────────────────│
```

**Step-by-step explanation:**

1. The user submits email and password to the NextAuth v5 credentials callback on the main app.
2-3. NextAuth's `authorize()` looks the user up through Prisma; PostgreSQL returns the row including the current role and department.
4. The password hash is compared with bcrypt; a mismatch aborts here (with generic error text, to avoid account enumeration).
5. NextAuth signs a JWT (HS256) with the shared `NEXTAUTH_SECRET`, embedding `sub`, `email`, `role`, and `department` claims.
6. The token is stored in an `HttpOnly; Secure; SameSite=Lax` cookie - JavaScript can never read it, which neutralises token theft via XSS.
7. The user is redirected into the dashboard; all subsequent main-app API calls are verified from the cookie alone, no DB hit.
8-10. Days later, the same browser opens the analytics domain. That host has no session cookie of its own, so its middleware redirects to the main app's SSO handoff endpoint instead of showing a login page.
11-13. The main app sees a valid session cookie, and mints a **one-time handoff token**: signed with the shared secret, valid for 30 seconds, with its ID recorded once in Upstash Redis.
14-15. The analytics callback verifies the token's signature *and* its single-use flag in Redis (a replayed token is rejected), then issues the analytics domain its own session JWT cookie.
16. The dashboard renders fully authenticated. The one-time token design means a leaked URL is useless after 30 seconds or one use, whichever comes first.

### 4.3 What Travels Inside the JWT

| Claim | Example | Purpose |
|---|---|---|
| `sub` | `usr_8f3k2` | Stable user ID - joined to the `users` table when a DB check is needed |
| `email` | `official@mospi.gov.in` | Display and audit trails |
| `role` | `STAKEHOLDER` | First-pass RBAC at the edge and in middleware |
| `department` | `transport` | Row scoping: stakeholders see their department's projects |
| `iat` / `exp` | `1735689600` / `1735776000` | Issued-at and 24 h expiry; refresh via silent re-handoff |
| `jti` | `sess_01hgx...` | Session ID - used for server-side revocation checks on sensitive routes |

### 4.4 Role-Based Access Control (RBAC)

| Role | Permissions |
|---|---|
| **Admin** | Full system access: user management, project creation, system configuration, all data access. Can promote/demote users and view audit logs. |
| **Project Manager** | Create/edit projects assigned to them, manage tasks/milestones, view predictions, generate reports for their own projects. Cannot touch other managers' projects or any system setting. |
| **Stakeholder** | View all projects in their department, receive alerts, generate department-level reports. No editing anywhere - the read-only oversight role for MoSPI officials. |
| **Viewer** | Read-only access to assigned projects only. The narrowest role, used for auditors, trainees, and external reviewers. |

### 4.5 RBAC Permission Matrix

CRUD letters: **C** = create, **R** = read, **U** = update, **D** = delete; `-` = no access. Parentheses show the scoping rule that narrows the permission.

| Resource | ADMIN | PROJECT_MANAGER | STAKEHOLDER | VIEWER |
|---|---|---|---|---|
| Projects | CRUD (all departments) | CRU (projects assigned to them) | R (their department) | R (assigned only) |
| Tasks | CRUD (all) | CRUD (own projects) | R (department) | R (assigned projects) |
| Milestones | CRUD (all) | CRU (own projects; delete only if no dependencies) | R (department) | R (assigned projects) |
| Budget entries | CRUD (all) | CRU (own projects) | R (department) | - |
| Documents / files | CRUD (all) | CRU (own projects) | R (department) | R (assigned projects) |
| Alerts | CRUD (all) | RU (acknowledge/mute own projects) | R (department) | R (assigned projects) |
| Reports / exports | Generate for all | Generate for own projects | Generate for department | - |
| AI chat | Full | Full (scoped to own projects) | Full (scoped to department) | Limited: status questions only |
| Delay predictions | View all | View own projects | View department | View assigned projects |
| Users & roles | CRUD | - | - | - |
| System settings | CRUD | - | - | - |
| Audit logs | R (all) | R (own actions) | - | - |

Two scoping notes: a PROJECT_MANAGER's write access is narrowed by an **ownership column** in the database (`projects.managerId`), and a STAKEHOLDER's read scope is narrowed by a **department column** - so the matrix above is enforced by SQL-level `WHERE` clauses, not just by hiding buttons.

### 4.6 Enforcement Points (Defense in Depth)

| # | Enforcement point | Mechanism | Blocks |
|---|---|---|---|
| 1 | Edge middleware | `getToken()` JWT check + route-pattern role rules | Unauthenticated page/API access, wrong-role routes (fast, ~1 ms) |
| 2 | API route handler | `requireRole('ADMIN')` guard + Zod body validation | Direct API calls that skip the UI; malformed payloads |
| 3 | Database query | Prisma `WHERE` clauses always scoped by role/department/ownership | Horizontal privilege escalation ("read someone else's project") even if layers 1-2 are bypassed |
| 4 | UI components | `usePermission()` hides/disables actions | Confusion and accidental misuse (never treated as security) |
| 5 | Audit log | Every mutating request writes an immutable `audit_logs` row | Silence after the fact - forensics and deterrence |

### 4.7 Implementation

```typescript
// middleware.ts - Next.js middleware for auth (runs at the edge, before any render)
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  // 1. Verify the JWT locally with the shared NEXTAUTH_SECRET.
  //    No database call - this whole function runs in ~1 ms at the edge.
  const token = await getToken({ req: request });

  if (!token) {
    // 2. No session: bounce to login, remembering where the user wanted to go.
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Role-based route protection (first pass - DB checks happen later per query).
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/admin') && token.role !== 'ADMIN') {
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }
  // 4. Example of scoping beyond roles: managers land on their own projects.
  // if (pathname.startsWith('/projects') && token.role === 'VIEWER') {
  //   return NextResponse.redirect(new URL('/projects/assigned', request.url));
  // }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

The second layer of defense, inside an API route handler:

```typescript
// app/api/users/route.ts - role guard + validation before any DB work
import { auth } from '@projectassure/config/auth';      // shared NextAuth v5 config
import { upstashLimit } from '@projectassure/config';   // shared Upstash ratelimit
import { createUserSchema } from '@projectassure/types';

export async function POST(req: Request) {
  const session = await auth();                 // verifies JWT, exposes role
  if (session?.user.role !== 'ADMIN') {         // second-pass RBAC
    return new Response('Forbidden', { status: 403 });
  }
  const body = createUserSchema.parse(await req.json());  // Zod validation

  const limited = await upstashLimit(`users:${session.user.sub}`);
  if (!limited.success) return new Response('Too Many Requests', { status: 429 });

  // Prisma insert; every read elsewhere is scoped by department/ownership.
  return Response.json(await db.user.create({ data: body }));
}
```

On top of both, **DB role checks** complete the chain: sensitive endpoints re-read the user's current role from PostgreSQL, and every list/detail query embeds its scoping predicate (`department = token.department`, or `managerId = token.sub` for managers). This is why demoting a user takes effect immediately, even before their 24-hour token expires.

### In Plain English

> Cross-domain SSO is like a wristband at a music festival with three stages. You show your ticket once at the main gate (the main app), and receive a tamper-proof wristband (the HttpOnly JWT cookie). All three stages accept that wristband because they share one rulebook for verifying it (the same NEXTAUTH_SECRET). The wristband's colour is your role: it decides which backstage areas you can enter, so a regular attendee (VIEWER) cannot wander into the control room (admin settings) no matter which stage they try. And if security revokes your colour mid-show, the guards at every stage check their list (the database) before letting you anywhere sensitive.

## 5. Request Lifecycle Walk-Throughs

Architecture diagrams hide latency, ordering, and failure behaviour. The best way to validate a design is to walk real requests through it. Three journeys were chosen because together they exercise every layer of the system:

- **Walk-Through A - the write path**: a project manager edits a task (validation, transactions, cache invalidation, WebSocket broadcast).
- **Walk-Through B - the read path**: a MoSPI official opens the portfolio dashboard (four cache layers, aggregation).
- **Walk-Through C - the AI path**: a user asks the assistant a question (auth, intent, tool calling, RAG, streaming).

### 5.1 Walk-Through A - Write Path: A Project Manager Edits a Task

**Scenario.** Priya, a PROJECT_MANAGER, changes the status of Task #4821 from "In Review" to "Done" inside Project 77. Three colleagues have the same project open right now. The edit must persist, every open screen must update live, and every cached number that depended on that task must become stale immediately.

```
 (1) Priya clicks "Save" on Task #4821
        │  React Query fires the mutation and applies an OPTIMISTIC update:
        │  the UI shows "Done" instantly, before the server has answered.
        ▼
 (2) PATCH /api/tasks/4821  ──►  Vercel Edge middleware
        │                        - verify JWT locally (shared NEXTAUTH_SECRET)
        ▼                        - Upstash rate-limit check (e.g. 60 writes/min/user)
 (3) Zod validation of the payload
        │   { status: "DONE", completedAt: "2026-01-17" } must match TaskUpdateSchema,
        ▼   else → 400 Bad Request before any business logic runs
 (4) Authorization + ownership check (Prisma)
        │   SELECT project.managerId FROM tasks JOIN projects ...
        ▼   → is it Priya? yes → allowed; no → 403 Forbidden + audit log entry
 (5) Prisma transaction (all-or-nothing):
        │   UPDATE tasks SET status='DONE', completedAt=now() WHERE id=4821
        ▼   INSERT INTO audit_logs (actor, action, before, after)
 (6) Cache invalidation (Upstash Redis):
        │   DEL  task:4821
        ▼   DEL  project:77:summary
            INCR portfolio:version        ← bumps the global list-version key
 (7) Socket.io publish: emit("task:updated", patch) to room "project:77"
        │
        ▼
 (8) The Socket.io Redis adapter fans the event out to every connected instance
        │
        ▼
 (9) Every client in project 77 reacts:
        - Priya's browser: mutation confirms → optimistic state is final
        - Colleague A (task board): React Query cache patched → row re-renders instantly
        - Colleague B (analytics tab of project 77): summary refetch triggered
```

**Why each step matters:**

1. **Optimistic update first.** The perceived latency of the edit becomes zero milliseconds. If the server later rejects the change (step 4 fails), React Query rolls the UI back and shows a toast - the user is never left guessing.
2. **Edge checks are cheap and global.** Authentication and rate limiting run before a single serverless instance is billed for compute.
3. **Zod validation before logic.** Malformed or malicious payloads never reach Prisma, so no code path downstream needs "what if the field is a 2 MB string?" branches.
4. **Ownership, not just role.** The RBAC matrix (Section 4.5) says a manager may edit *their own* projects; the database ownership column is what actually enforces "their own".
5. **A transaction, not two writes.** If the audit log insert fails, the task update rolls back too. An unlogged mutation is treated as a failed mutation.
6. **Cache invalidation is explicit, not hopeful.** Three precise keys are deleted/advanced the instant the write commits. The `portfolio:version` bump is what makes Walk-Through B's cached summary self-expiring without waiting for a TTL.
7-8. **Broadcast after commit.** The WebSocket event is only emitted once PostgreSQL has accepted the write - colleagues never see an update that later reverts.
9. **One event, three consumers.** The same `task:updated` message updates boards, summaries, and badges wherever that project's data is displayed - a single real-time contract for all surfaces.

### 5.2 Walk-Through B - Read Path: A MoSPI Official Opens the Portfolio Dashboard

**Scenario.** Secretary Rao opens `projectassure.vercel.app/dashboard` at 9:00 AM Monday, when 2,000 colleagues are doing the same. The dashboard shows portfolio health distribution, at-risk projects, and budget burn. Four cache layers stand between him and PostgreSQL, and the design goal is that PostgreSQL is hit by almost nobody.

```
 Secretary's browser
        │  GET /dashboard
        ▼
 [L3 - CDN]  Vercel Edge Network
        │    static JS/CSS chunks + prerendered shell: 24 h cache,
        ▼    served from the nearest region (~10-30 ms anywhere in India)
 Next.js server component renders the shell, then requests data
        │
        ▼
 [L1 - Client] React Query cache
        │    key "portfolio.summary" fresh? → render immediately (0 ms)
        ▼    (a miss on first visit of the day)
 [L2 - Redis] Upstash GET portfolio:summary:v{version}
        │    cached JSON, 10 min TTL, version-checked (see step 6 of Walk-Through A)
        ▼    hit rate ≈ 90%+ under normal load (~5 ms)
 [L4 - Database] (only on a Redis miss)
        │    Prisma → Neon pooled connection → aggregate SQL (~40-80 ms)
        ▼    SELECT health buckets, at-risk count, budget burn GROUP BY department
 Response written back into L2 (and L1 when it reaches the browser)
        │
        ▼
 Dashboard renders; every colleague who follows is served from L1/L2
```

**Step-by-step with typical latencies:**

| Step | Layer | What happens | Typical latency |
|---|---|---|---|
| 1 | Network | DNS + TLS to nearest Vercel edge | 10-30 ms |
| 2 | L3 CDN | Static shell + hashed assets served from edge cache; deploy changes filenames, so staleness is impossible | 0-5 ms (cache hit) |
| 3 | L1 client | React Query checks `staleTime` (5 min, stale-while-revalidate): a fresh copy renders instantly in the background | 0 ms on hit |
| 4 | L2 Redis | API route asks Upstash for the pre-computed summary keyed by portfolio version | ~5 ms on hit |
| 5 | L4 database | On a miss: aggregated SQL through Prisma over Neon's pooled connections; result written back to Redis | 40-80 ms |
| 6 | Render | Server component streams HTML; client hydrates; charts animate (Framer Motion 11) | 100-300 ms total |

**The subtle part - versioned cache keys.** The Redis key is `portfolio:summary:v{portfolio:version}`. Walk-Through A's `INCR portfolio:version` changes that key name, so the *old* cached value becomes unreachable instantly, and the next reader repopulates from the database exactly once. This gives us TTL-like simplicity with write-like freshness: no stale dashboards after an edit, and no thundering herd because only the first reader after each write pays for the aggregate query.

### 5.3 Walk-Through C - AI Path: A User Asks the AI Assistant a Question

**Scenario.** A stakeholder types into the chat on `ai.projectassure.vercel.app`: *"Which projects in the transport department are at risk of delay, and why?"* The answer must respect RBAC, cite its sources, and start streaming within a couple of seconds.

```
 (1)  User asks: "Which projects in the transport department are at risk of delay?"
        │
        ▼
 (2)  POST /api/chat (stream: true) → Edge middleware:
        │    JWT verified; Upstash rate limit (e.g. 20 questions/hour/user)
        ▼    department claim read from token → will scope every query below
 (3)  Intent classification + tool planning (GPT-4o with function calling):
        │    model chooses tools → [ fetchProjectsAtRisk(dept="transport"),
        ▼                             searchDocuments(query), getPredictionSummary() ]
 (4)  Tool execution (in parallel):
        │    a. RAG: embed the question → Pinecone top-k search over project
        ▼       documents, metadata filter department="transport"
        │    b. Structured: Prisma query → transport projects + latest
        │       delay predictions and health scores (schedule 30% / budget 25% /
        │       resources 20% / milestones 25%)
        │    c. Cache: Redis lookup for fresh prediction summaries
        ▼
 (5)  Context assembly: retrieved document chunks + DB rows + system prompt,
        │    hard-filtered by RBAC (only departments this user may see enter
        ▼    the context window - the AI cannot leak what the user cannot read)
 (6)  GPT-4o streams the answer token-by-token over SSE;
        │    the browser renders text progressively (perceived latency ≈ 1-2 s)
        ▼    on API error or timeout → automatic fallback to Gemini, same prompt
 (7)  Citations: each claim links to its source document or dashboard route
        │
        ▼
 (8)  Transcript + tool traces persisted for audit;
        follow-up questions reuse cached tool results within the conversation
```

**Step-by-step explanation:**

1. The question arrives like any other request - same JWT cookie, same middleware, same rate limiter. AI is not a security exception.
2. Rate limits for AI are stricter than for CRUD (a question costs GPU seconds somewhere); the department claim is extracted now so it can scope every downstream tool call.
3. Instead of hoping the LLM knows project data, the model is given **tools** and decides which to call. This is the difference between a chatbot that guesses and an assistant that looks things up.
4. Three kinds of knowledge are fetched in parallel: unstructured (document chunks from Pinecone via RAG), structured (rows and predictions from PostgreSQL), and pre-computed (cached summaries from Redis).
5. Context is assembled *after* RBAC filtering, not before. This ordering is what makes the AI safe: it never even sees a project the user is not allowed to read, so no prompt trickery can extract it.
6. Streaming converts a 5-15 second answer into a 1-2 second perceived response. The Gemini fallback shares the same tool results, so a provider outage degrades the prose quality, never the data quality.
7. Every factual claim links back to a document chunk or a live dashboard route - officials can verify, which is non-negotiable in a government context.
8. Persisting transcripts and tool traces gives auditors a full replay of *what the AI knew and where it got it* for any past answer.

### In Plain English

> The three walks are three visits to a restaurant. Ordering a dish (the write path): you tell the waiter, he repeats it back to confirm (validation), the kitchen checks you are allowed to modify that recipe (ownership), the dish is cooked and the order ticket filed (transaction + audit), the menu board is wiped of the old price (cache invalidation), and the kitchen shout of "order up!" (WebSocket) makes every waiter in the building update their tables at once. Being seated and reading the menu (the read path): the menu is printed once and handed to everyone (CDN), your phone remembers yesterday's menu (client cache), and the counter keeps one copy for the whole room (Redis) so the kitchen (database) is only disturbed when something actually changes. Asking the chef for a recommendation (the AI path): the chef asks clarifying questions, checks the pantry and the recipe book (tools + RAG), refuses to discuss dishes from the private dining room you are not allowed to enter (RBAC before context), and describes the dish course by course while it is being plated (streaming).

## 6. Data Flow Architecture

### 6.1 Real-Time Data Pipeline

Every create, update, and delete in ProjectAssure follows one pipeline, so there is exactly one real-time contract to learn and test:

```
User Action (CRUD)
       ↓
  Next.js API Route
       ↓
  Zod Validation
       ↓
  Prisma ORM → PostgreSQL (Neon)
       ↓
  Redis Cache Invalidation
       ↓
  WebSocket Broadcast (Socket.io)
       ↓
  All Connected Clients Update
```

**Stage-by-stage:**

1. **User action** - any mutating interaction, on any of the three domains.
2. **API route** - the single entry point; no client ever writes to the database directly.
3. **Zod validation** - shape and semantics checked before any logic (Section 5.1, step 3).
4. **Prisma transaction** - the write and its audit-log row commit atomically to Neon.
5. **Cache invalidation** - precise key deletions plus the portfolio version bump (Section 7).
6. **WebSocket broadcast** - a typed event is emitted to the relevant room (`project:{id}`, `department:{name}`, or `user:{id}`).
7. **Clients update** - React Query caches are patched by the event payload; UIs re-render without polling.

Room design: events are scoped to the narrowest room that needs them. A task edit goes to `project:77` only; a department-wide alert goes to `department:transport`; a personal notification goes to `user:usr_8f3k2`. This keeps event traffic proportional to actual interest, not to total users.

### 6.2 AI Prediction Pipeline

The prediction engine runs on a cron schedule every 6 hours, so no user ever waits for a model:

```
Cron Job (Every 6 hours)
       ↓
  Fetch all active projects (Prisma)
       ↓
  Calculate features:
    - Task completion velocity
    - Milestone adherence
    - Budget burn rate
    - Resource utilisation
    - Dependency chain health
    - Historical patterns
       ↓
  ML Model Inference (XGBoost classifier + Prophet forecasts,
                     via the Python 3.12 FastAPI service)
       ↓
  Store predictions in PostgreSQL
       ↓
  Compare with previous predictions
       ↓
  If risk level changed → Generate Alert
       ↓
  Send notification (Email via Nodemailer + In-App)
```

**How the health score is computed.** Each project receives a four-dimension health score on every run; the dimensions and weights are fixed by design so scores are comparable across the whole portfolio:

| Dimension | Weight | Signals used |
|---|---|---|
| Schedule | 30% | Task completion velocity vs plan, critical-path slippage, upcoming-milestone buffer |
| Budget | 25% | Burn rate vs planned expenditure curve, commitment vs actuals |
| Resources | 20% | Team utilisation, allocation conflicts, single-person dependencies |
| Milestones | 25% | Milestones met vs missed, forecast confidence of the next milestone date |

**Run mechanics:**

1. **Fetch (seconds).** The cron handler pulls active projects and their event history from Neon through Prisma - one connection-pooled batch, not thousands of round trips.
2. **Feature calculation.** Six feature families are computed per project (velocity, milestone adherence, budget burn, resource utilisation, dependency-chain health, historical seasonality). Features are deterministic and versioned, so a prediction can always be explained and reproduced.
3. **Inference.** The Node.js cron handler calls the Python FastAPI service: XGBoost classifies delay risk (including the 30-60-day early-warning window), Prophet produces per-signal forecasts. Inference is batched - roughly 10,000 projects over a 6-hour window is well under one prediction per second on average, so a single worker finishes in minutes with room to spare.
4. **Persistence.** Predictions are stored with their model version and feature snapshot - a prediction is evidence, not just a number.
5. **Diffing.** New predictions are compared with the previous run. Only *changes* in risk level create alerts - officials are notified about direction changes, not re-alerted on every stable project six times a day.
6. **Notification.** Changed-risk alerts go out in-app (WebSocket to the right rooms) and by email (Nodemailer via Gmail SMTP) to the project manager and department stakeholders.

### 6.3 Document Processing Pipeline

The ingestion pipeline turns an unstructured government document into validated structured data plus a searchable knowledge base:

```
User uploads PDF/Excel/Image
       ↓
  Upload to Vercel Blob Storage
       ↓
  Trigger webhook → AI Engine API
       ↓
  Extract text (OCR for images, pdfplumber for PDFs)
       ↓
  LLM Extraction (structured data from unstructured text)
       ↓
  Parse and validate extracted data (Zod schema)
       ↓
  Store in PostgreSQL (update project records)
       ↓
  Embed + index in Pinecone (RAG knowledge base)
       ↓
  Generate AI summary
       ↓
  Notify user of completion
```

**Stage-by-stage:**

1. **Upload** - the file goes to Vercel Blob via a pre-signed URL; the browser uploads directly, so a 50 MB PDF never transits a serverless function body.
2. **Webhook** - blob metadata lands in the AI engine's `/api/ingest` route, which records a `PROCESSING` status row so the UI can show progress.
3. **Extraction** - images (scanned letters, site photographs with tables) go through OCR; native PDFs through pdfplumber; Excel through a typed parser. The raw text is retained alongside the extracted fields.
4. **LLM extraction** - GPT-4o is asked to return *strict JSON* matching a schema: amounts, dates, vendor names, milestone references. The fallback to Gemini applies here too.
5. **Validation** - the extracted JSON is parsed with Zod against the same shared schemas the platform uses everywhere else. A document whose totals do not reconcile is flagged for human review instead of silently corrupting project records - extraction proposes, validation disposes.
6. **Structured storage** - validated fields update project records in PostgreSQL through the same audited write path as manual edits.
7. **Embedding + indexing** - text chunks are embedded and written to Pinecone with metadata (`projectId`, `department`, `documentId`), which is what later powers RAG answers and metadata-filtered retrieval (Section 5.3).
8. **Summary + notification** - a short AI summary is attached to the document record, and the uploading user is notified in-app and by email.

### 6.4 Data Flow Ownership Table

Sharing one database only works if every data domain has exactly one owner. This table is the contract each app codes against:

| Data domain | Owning app (sole writer) | Read by | Primary store | Notes |
|---|---|---|---|---|
| Users, roles, departments | **web** (admin routes + NextAuth) | analytics, ai-engine | PostgreSQL; session cache in Redis | JWT carries role/department; DB is the authority |
| Sessions / auth state | **web** (NextAuth v5) | all apps verify locally via shared secret | JWT cookies; Upstash for revocation lists | No session table reads on the hot path |
| Projects, tasks, milestones, budget | **web** | analytics, ai-engine | PostgreSQL | The system of record; audit-logged writes only |
| Alerts | **web** (user events) + **ai-engine** (prediction diffs) | web (inbox UI) | PostgreSQL; delivery via WebSocket + email | Both producers, one schema, one room format |
| Documents / files | **web** (uploads) | ai-engine (processing), all apps (download) | Vercel Blob + metadata in PostgreSQL | Pre-signed URLs; bytes never transit API functions |
| Document embeddings (RAG index) | **ai-engine** | ai-engine (chat, search) | Pinecone | Metadata filters: department, project, document |
| Delay predictions & health scores | **ai-engine** (cron + on-demand) | web, analytics | PostgreSQL (with model version + feature snapshot) | Written only by the prediction pipeline |
| Analytics aggregates & exports | **analytics** (computation + export) | officials, web embeds | Computed from PostgreSQL; cached in Redis | Never mutates source data |
| AI chat transcripts & tool traces | **ai-engine** | web (history), auditors | PostgreSQL | Replayable audit of AI answers |
| Notification emails | **web** + **ai-engine** (senders) | recipients | Gmail SMTP via Nodemailer | Templates centralised in `packages/config` |

Consequences of this contract: a bug in the analytics app cannot corrupt project data (it has no write path to it); the prediction pipeline cannot alter task records (it only writes its own tables); and onboarding a new developer means learning one ownership table instead of reverse-engineering three apps.

### In Plain English

> Data ownership works like departments in a municipal office. The records department (main app) is the only one allowed to write in the official register. The statistics cell (analytics) photocopies from the register all day but cannot write in it. The research wing (AI engine) keeps its own notebooks - predictions, summaries, indexes - and may paste register numbers into its notebooks but never edit the register itself. Because everyone knows exactly which department owns which book, when a number looks wrong you know precisely whose desk to visit.

## 7. Caching Strategy

ProjectAssure is a read-heavy platform: for every task edit there are hundreds of dashboard views, report exports, and AI lookups. Four cache layers, each with a distinct job, keep PostgreSQL load proportional to *change*, not to *traffic*:

| Cache Layer | Technology | Use Case | TTL | Invalidation trigger |
|-------------|-----------|----------|-----|----------------------|
| **L1 - In-Memory** | React Query | Client-side data caching, optimistic updates | 5 min (stale-while-revalidate) | Mutation success + WebSocket events patch the cache directly |
| **L2 - Redis** | Upstash Redis | Session storage, rate limiting, API response caching | 10-60 min | Explicit `DEL` of exact keys + `INCR` of version keys on write |
| **L3 - CDN** | Vercel Edge | Static assets, pre-rendered pages | 24 hours | Deploys (hashed filenames change); immutable otherwise |
| **L4 - Database** | PostgreSQL | Source of truth, persistent storage | Permanent | Never invalidated - it *is* the truth |

**How the layers cooperate:**

1. **L1 absorbs repeat navigation.** A stakeholder flipping between dashboard tabs re-renders from the React Query cache with zero network cost. Stale-while-revalidate means the user sees instant (possibly slightly old) data while a background fetch refreshes it - freshness where it matters, speed everywhere.
2. **L2 absorbs repeat users.** When 2,000 officials open the same dashboard at 9 AM, the first request after each write computes the aggregate; the next 1,999 hit Redis at ~5 ms. Rate limiting and session revocation live here too, sharing one well-understood dependency.
3. **L3 absorbs repeat bytes.** Fonts, scripts, images, and prerendered shells are immutable and hashed; a deployment changes filenames rather than contents, so staleness at the CDN is structurally impossible.
4. **L4 never negotiates.** Everything above it is an accelerator; only PostgreSQL is trusted for correctness. If every cache were deleted at once, the platform would slow down, not break.

**Invalidation rules (the hard part of caching):**

1. Write-path invalidation is *explicit and exhaustive* - each API route declares the cache keys its mutation affects (Section 5.1, step 6), reviewed like code.
2. Aggregates use **versioned keys** (`portfolio:summary:v{version}`), so a write makes old values unreachable instantly without scanning and deleting key families.
3. AI tool results are cached **within a conversation** but never across users - a stakeholder's transport-department context must never warm another department's answer.
4. Anything user-specific is keyed with the user or department ID; anything portfolio-wide is keyed with the version counter. No key is ever ambiguous about its scope.

### In Plain English

> Caching is how a busy library avoids fetching every book from the basement every time. You keep the bestseller on your desk (client cache), the floor keeps a copy on the shelf (Redis), the building keeps a rack of reprints at the entrance (CDN), and the basement archive (PostgreSQL) is only visited when something is not available anywhere else - or when a new edition arrives, at which point the shelf copy is pulled the same moment the new one is checked in (invalidation). Readers never queue at the basement door, and nobody ever reads yesterday's edition by mistake.

## 8. Security Architecture

### 8.1 Security Controls

| Control | Implementation | Why it matters |
|---|---|---|
| **Authentication** | NextAuth v5 with JWT in `HttpOnly; Secure; SameSite=Lax` cookies; bcrypt password hashing | Session tokens are unreadable to JavaScript and unusable cross-site; passwords never stored in clear text |
| **Authorization** | RBAC enforced at middleware, route-handler, and SQL level (Section 4.6) | Three independent gates; bypassing one still leaves two |
| **API Security** | Upstash rate limiting per user/IP/route, CORS configuration, Zod input validation on every endpoint | Abuse and malformed payloads are rejected before touching business logic or the database |
| **Data Security** | TLS 1.3 everywhere in transit; Prisma's parameterised queries prevent SQL injection; Neon encryption at rest | Intercepted traffic is unreadable; injection is structurally impossible, not merely filtered |
| **Environment Variables** | All secrets (DB URL, `NEXTAUTH_SECRET`, API keys) stored in Vercel environment variables; `.env.example` documents shape, never values | Secrets are never in git, logs, or client bundles |
| **Email Security** | Gmail App Password (not the account password), TLS for SMTP | A leaked app password cannot read mail or reset the account |
| **File handling** | Uploads via pre-signed URLs to Vercel Blob; type/size validation; documents processed in a sandboxed pipeline | A malicious file never executes inside the application process |
| **Audit logging** | Immutable `audit_logs` rows written in the same transaction as every mutation (Section 5.1) | Every change to national project data is attributable and replayable |
| **Dependency hygiene** | Pinned versions, `pnpm audit` / `pip-audit` in CI, Dependabot-style updates | Supply-chain risk is reduced continuously, not audited once |

### 8.2 Threat Model

| # | Threat | Likelihood | Impact | Mitigation |
|---|--------|-----------|--------|------------|
| 1 | Credential stuffing / brute-force login attempts | High | Medium (account takeover of one user) | Upstash rate limit per IP+account, bcrypt cost, generic error messages, optional lockout + email notice |
| 2 | Session theft via XSS | Low | High (full session hijack) | JWT in HttpOnly cookie (invisible to JS), strict Content-Security-Policy, React auto-escaping, no `dangerouslySetInnerHTML` on user data |
| 3 | CSRF against state-changing endpoints | Medium | High (unwanted writes as a victim) | `SameSite=Lax` cookies, CORS allow-list of the three known domains, Zod re-validation server-side |
| 4 | Privilege escalation (VIEWER acts as ADMIN) | Low | Critical (portfolio-wide data change) | Role checked in middleware AND route handler AND SQL scoping; DB re-check on sensitive routes; every mutation audit-logged |
| 5 | SQL injection | Low | Critical (data exfiltration/corruption) | Prisma parameterised queries only; no string-concatenated SQL anywhere in the codebase |
| 6 | Prompt injection via uploaded documents | Medium | High (AI manipulated into wrong output) | Extraction is schema-validated JSON (Zod), LLM answers only from RBAC-filtered retrieved context, citations mandatory, transcripts auditable |
| 7 | Data exfiltration through AI chat | Medium | Critical (cross-department leak) | RBAC filter applied *before* context assembly (Section 5.3, step 5); tool results scoped by token claims; per-user rate limits; transcripts retained for audit |
| 8 | DDoS / resource exhaustion of public endpoints | Medium | Medium (availability degradation) | Vercel Edge absorbs volumetric attacks; per-route Upstash limits; heavy operations (export, AI) on stricter budgets than reads |
| 9 | Secret leakage (repo, logs, or client bundle) | Low | Critical (full platform compromise) | Server-only env vars never shipped to client; `.env.local` git-ignored; log scrubbers for tokens/URLs; secrets rotatable independently |
| 10 | Supply-chain compromise (npm/Python packages) | Low | High (arbitrary code in builds) | Pinned lockfiles, audit steps in CI, minimal dependency surface in shared packages, Vercel immutable builds |

The unifying principle: **no single control is load-bearing**. An attacker must defeat edge validation, route-level guards, SQL scoping, and the audit trail simultaneously - and the audit trail means even a successful attack is discoverable and reversible.

### In Plain English

> Security here is layered like a bank. The guard at the door checks your ID (authentication), the teller checks what your account is allowed to do (authorization), the vault has its own combination independent of the teller (SQL scoping), the CCTV records every transaction (audit logs), and the alarm company is different from the bank itself (independent AI fallback, external rate limiting). A robber would have to beat every layer at once - and even then, the recording tells investigators exactly what happened.

## 9. Scalability Considerations & Capacity Math

### 9.1 Built-In Scaling Mechanisms

- **Horizontal Scaling**: Each Vercel domain scales automatically with serverless functions - concurrency is added per request, with no capacity planning and zero idle cost.
- **Database Scaling**: Neon PostgreSQL scales compute and storage independently; storage grows without downtime, and compute can be resized as the portfolio grows.
- **Connection Pooling**: Prisma uses connection pooling (PgBouncer built into Neon), so thousands of stateless serverless instances share a bounded number of database connections instead of exhausting them.
- **CDN Caching**: Vercel Edge Network caches static assets globally, so a surge of new users mostly adds CDN hits, not origin load.
- **WebSocket Scaling**: For real-time features, Socket.io with the Redis adapter means any number of Socket.io instances can serve sockets while events fan out through Redis - no sticky sessions, no single broadcast bottleneck.
- **Read/write shape**: The platform is deliberately read-heavy optimised (Section 7) - writes are few and audited; reads are cheap and cached. Systems scaled this way stay fast as audience grows even if data volume grows faster.

### 9.2 Capacity Math: 10,000 Projects, 5,000 Concurrent Users

The design target for the national deployment: a portfolio of **10,000 active projects** and **5,000 concurrent users** at peak (Monday-morning effect included). Working through the numbers:

**Step 1 - Data volume.** 10,000 projects with ~50 tasks and ~8 milestones each gives 500,000 tasks and 80,000 milestones. Add users, alerts, documents, and five years of audit logs and the entire dataset stays in the low tens of gigabytes - comfortably within a single Neon instance with standard indexes. PostgreSQL is nowhere near its limits; a database engine is happiest at this size.

**Step 2 - Request rate.** An actively working user generates roughly 12 requests per minute (navigations, saves, polls). At 5,000 concurrent users:

```
5,000 users x 12 req/min = 60,000 req/min = 1,000 req/s sustained
Monday 9 AM peak (3x)    = ~3,000 req/s peak
```

**Step 3 - What reaches the database.** With L2 (Redis) absorbing ~90% of dashboard reads and L3/L1 taking most asset and navigation load, only about 10% of requests need PostgreSQL:

```
Peak DB queries ≈ 300 queries/s x ~20 ms each ≈ 6 concurrent queries
Provisioned pool: 50-100 connections (20x headroom)
```

A handful of concurrent queries against a pooled Neon endpoint is a quiet Tuesday for PostgreSQL - the four cache layers are doing the heavy lifting.

**Step 4 - Real-time fan-out.** 5,000 concurrent WebSocket connections. Write events are far rarer than reads: assume 100 task/alert events per second portfolio-wide, each fanned out only to its project/department room (averaging tens of subscribers). The Socket.io Redis adapter handles this with a single small Redis instance; socket memory (~10-50 KB each) puts total socket memory in the 50-250 MB range.

**Step 5 - AI load.** If 5% of daily users ask the assistant something, on a heavy hour that is ~250 questions/hour ≈ 0.07 questions/s per second-scale - trivially absorbed by GPT-4o streaming, with Gemini as overflow. The 6-hour prediction cron is even lighter: 10,000 projects per run ≈ 0.5 predictions/s average, so XGBoost batch inference finishes in seconds per batch and the whole run, including Prophet forecasts, in minutes.

**Step 6 - Storage growth.** Assume 1,000 documents uploaded per month at ~2 MB average → ~2 GB/month to Vercel Blob, and ~100 embedding chunks per document → ~100,000 new Pinecone vectors per month. Both grow linearly with usage and neither pressures the relational database.

**Summary of the sizing:**

| Resource | Peak demand | Provisioned | Verdict |
|---|---|---|---|
| HTTP requests | ~3,000 req/s | Vercel serverless (auto) | Scales per request; no tuning |
| DB queries | ~300 q/s, ~6 concurrent | Pooled Neon compute + 50-100 connections | Large headroom |
| WebSocket connections | 5,000 sockets, ~100 events/s | Socket.io + Upstash Redis adapter | Single small Redis suffices |
| AI calls | ~0.07 questions/s + batch cron | GPT-4o + Gemini fallback; FastAPI ML worker | Trivial at peak; batch runs in minutes |
| Object storage | ~2 GB/month | Vercel Blob | Linear, cheap growth |
| Vector index | ~100k vectors/month (~1M+ per year) | Pinecone | Within typical managed capacity |

### 9.3 Why Serverless Scales (Without a DevOps Team)

1. **Stateless compute, stateful services.** Every Vercel function carries no state; all state lives in Neon, Upstash, Pinecone, and Blob. Adding capacity means adding function instances, which is automatic and instant.
2. **Concurrency, not servers.** Traffic spikes are absorbed by invoking more function instances in parallel; there is no VM to resize and no process to restart, so a Monday-morning 3x spike is a non-event.
3. **Scale to zero, pay per use.** Nights and weekends cost almost nothing - the bill tracks actual usage, which matters for a public-funded project.
4. **Regional resilience by default.** Vercel serves from the nearest healthy region; a regional problem shifts traffic rather than producing an outage page.
5. **Neon branching for safe change.** Every risky migration or experiment runs against a copy-on-write database branch first - scalability of *engineering*, not just of traffic.

### In Plain English

> A serverless platform is like a call centre that magically summons as many trained operators as the queue needs, and sends them home the moment the phones go quiet. You never buy desks in advance, nobody is ever idle on salary, and a sudden TV advert that triples your call volume just means more operators appear. The storerooms they consult (databases, caches) are shared and professionally managed, so ten operators and ten thousand operators ask the same storeroom the same way.

## 10. Reliability: Failure Modes & Recovery

No component is trusted to never fail. For each failure, the design defines detection, degraded behaviour, and recovery:

| # | Failure scenario | How it is detected | Graceful degradation (what users see) | Recovery path |
|---|------------------|-----------------------------------------------------------|----------------|
| 1 | Neon PostgreSQL unreachable | Prisma connection errors; health-check endpoint | Read paths serve last-known data from Redis/CDN caches; writes queue client-side and retry; clear "degraded" banner | Neon compute resumes or is restarted; caches repopulate from DB automatically |
| 2 | Upstash Redis down | Cache/ratelimit call timeouts | API falls through to direct DB queries (slower but correct); rate limits fall back to conservative in-memory limits | Upstash recovers or endpoint is swapped via env var; caches warm within minutes |
| 3 | OpenAI API down or slow | Streaming request errors/timeout | Chat shows a visible notice and **auto-falls back to Gemini** with the same tool results | Primary provider returns; fallback flag flips back automatically |
| 4 | Gemini also unavailable (both LLMs down) | Fallback call fails too | AI features disabled gracefully with an explanatory message; the rest of the platform is unaffected by design (Section 2, rule 3) | Any provider recovers → AI resumes; no data was lost, only answers deferred |
| 5 | Python ML service crash | FastAPI health check failing; cron errors | Prediction widgets show "last known prediction" with a timestamp; cron retries with exponential backoff | Container restart (Docker locally / service restart); models are versioned files, so restart is stateless |
| 6 | WebSocket disconnect (network flap) | Socket.io heartbeat/`disconnect` events | Clients auto-reconnect with backoff; on reconnect they refetch the query keys the missed events would have touched | Transparent; at worst a few seconds of stale UI, then a single refetch |
| 7 | Pinecone unavailable | Vector search errors in AI tools | Chat answers from structured DB context only, with a "documents index unavailable" note; ingestion pauses at the embedding step and resumes later | Pinecone returns; a re-index job backfills the gap; no data loss |
| 8 | Vercel Blob upload failure | Pre-signed upload error | User sees a retryable error with the file intact locally; metadata row stays `PENDING` and can be re-linked | Retry or re-upload; blob storage is the source of truth only after a successful upload is recorded |
| 9 | SMTP (Gmail) failure | Nodemailer send errors | In-app alerts (WebSocket) still deliver instantly; email sends retry from a queue | SMTP recovers and the queue drains; alert delivery is never lost, only delayed |
| 10 | Prediction cron overrun/miss | Cron supervisor notes a missed schedule | Predictions simply age; dashboards show prediction timestamps so staleness is explicit | Next scheduled run covers the gap; runs are idempotent, so double-execution is safe |

Two design rules emerge from this table. First, **core CRUD never depends on AI or email** - the worst AI-day is a platform without answers, never a platform without records. Second, **every cache miss has a fallback and every queue has a retry** - degraded modes are documented behaviour, not improvisation.

### In Plain English

> This is the way a well-run hospital thinks. If the lift (database) is being serviced, staff use the stairs and the last known files. If the intercom (WebSocket) crackles, runners (reconnect + refetch) carry the message. If the pharmacy's computer (AI provider) is down, prescriptions are still written - just without computer suggestions. Nothing that keeps patients alive depends on any single convenience; conveniences return without anyone re-doing fundamental work.

## 11. Architecture Decision Records

The five decisions that shaped everything above, recorded in problem → options → decision → consequence format.

### ADR-001: Adopt a micro-frontend architecture (three domains)

- **Problem.** One national platform must serve project managers (transactional work), officials (analytics), and everyone (AI features) - with different release cadences, scaling profiles, and risk tolerance for each.
- **Options considered.** (a) A single Next.js monolith - simplest to start, but AI latency and export batch jobs share the same deploy and performance budget; (b) micro-frontends at module level inside one app (federation) - flexibility without operational separation; (c) three independently deployed Next.js apps sharing one backend - real isolation with modest overhead.
- **Decision.** (c) Three separate Next.js 15 apps on Vercel (`projectassure`, `analytics`, `ai` subdomains), sharing code via a monorepo.
- **Consequences.** (+) A broken AI deploy cannot break project management; each domain scales and rate-limits independently; bundles stay small per user group. (-) Three deploys to coordinate and shared code discipline required via `packages/*` - mitigated by the monorepo's atomic type checking.

### ADR-002: Use Neon (serverless PostgreSQL) as the primary database

- **Problem.** The platform runs on serverless functions, which open many short-lived connections; a traditional self-managed Postgres would need a dedicated DBA, connection proxying, and capacity planning - all costly for a public-sector team.
- **Options considered.** (a) Self-hosted PostgreSQL on a VM; (b) a conventional managed RDS-style instance; (c) Neon serverless Postgres with built-in pooling and branching.
- **Decision.** (c) PostgreSQL 16 on Neon, accessed exclusively through Prisma 6 with pooled connections.
- **Consequences.** (+) Connection pooling solves the serverless connection storm natively; branching gives every migration and experiment a disposable database copy; storage/compute scale independently; zero-maintenance from the team's perspective. (-) Dependency on a single managed vendor - mitigated by the fact that Prisma keeps the data layer portable to any PostgreSQL if a migration were ever required.

### ADR-003: Manage all three apps in one Turborepo + pnpm monorepo

- **Problem.** Three apps sharing UI, types, and configuration would drift apart if kept in separate repositories: renames would break consumers at runtime, fixes would be applied inconsistently, onboarding would mean cloning and wiring three toolchains.
- **Options considered.** (a) Three repos with a published shared package - versioning discipline required for every shared change; (b) Git submodules - notoriously error-prone; (c) a pnpm workspace monorepo with Turborepo task caching.
- **Decision.** (c) Single repository, `apps/*` + `packages/*`, pnpm workspaces, Turborepo remote caching.
- **Consequences.** (+) One PR changes a type and all consumers atomically; compiler errors replace runtime surprises; CI rebuilds only what changed; new contributors run two commands. (-) The repository is the single point of coordination, and CI must be configured to test only affected apps - handled by Turborepo's dependency graph.

### ADR-004: Use stateless JWT sessions (shared secret) for cross-domain SSO

- **Problem.** Sessions must work across three different hostnames, be verifiable in ~1 ms at the edge without a database hit, and carry the user's role for first-pass authorization - while revocation must still be possible.
- **Options considered.** (a) Server-side sessions in Redis with a session ID cookie - easy revocation, but every verification is a network call and cross-domain requires a shared session service; (b) JWT with a shared `NEXTAUTH_SECRET` + Redis revocation list for sensitive routes; (c) an external identity provider (SSO vendor) - operationally heavy and costly for the prototype-to-production path.
- **Decision.** (b) NextAuth v5 issues HS256 JWTs in HttpOnly cookies; all three apps share the secret; sensitive routes re-check the DB role and consult a Redis revocation list; cross-domain entry uses a one-time, 30-second handoff token (Section 4.2).
- **Consequences.** (+) Zero-network authentication at the edge; roles travel with the request; revocation still possible where it matters. (-) Token contents are valid until expiry - mitigated by short expiry, DB re-checks on sensitive operations, and the fact that role *downgrades* take effect at the next DB-backed check.

### ADR-005: Use Socket.io with the Redis adapter for real-time updates

- **Problem.** Task boards, alerts, and dashboards must update live for thousands of concurrent users, across an infrastructure of stateless serverless functions that cannot hold in-memory pub/sub state.
- **Options considered.** (a) Client polling - simple but wasteful and laggy at national scale; (b) raw WebSockets with per-instance fan-out - no coordination between instances, events lost when users land on a different instance; (c) Server-Sent Events only - one-way, no presence/acknowledgement semantics; (d) Socket.io + Redis adapter.
- **Decision.** (d) Socket.io with the Upstash Redis adapter; typed events published to scoped rooms (`project:{id}`, `department:{name}`, `user:{id}`).
- **Consequences.** (+) Any instance can publish and all instances deliver; rooms keep fan-out proportional to interest; reconnection with backoff and query-key refetch closes any gap (Section 10, row 6); a single battle-tested real-time contract for all three domains. (-) One more stateful satellite (Redis) becomes part of the critical path for *liveness* (not correctness) - if Redis is down the platform still works, it just stops being instant.

## 12. Summary

ProjectAssure's architecture can be compressed into seven load-bearing ideas:

1. **Three independently deployable Next.js 15 domains** (main app, analytics, AI engine) give each user population its own performance budget and each feature area its own blast radius.
2. **Five logical layers** (Client, Edge, Application, Intelligence, Data) with strict talk-downward rules keep every concern in exactly one place - and keep core CRUD functional even with AI switched off entirely.
3. **One monorepo** (pnpm + Turborepo) turns cross-app consistency into a compiler guarantee instead of a review-time hope.
4. **Shared-secret JWT SSO via NextAuth v5**, backed by middleware guards, route guards, SQL scoping, and audit logs, delivers cross-domain login that is both fast (~1 ms checks) and revocable where it matters.
5. **Four cache layers with versioned invalidation** make the read-heavy national workload cheap: PostgreSQL load is proportional to change, not to traffic.
6. **Three pipelines** - real-time CRUD broadcast, the 6-hourly XGBoost/Prophet prediction cron with the 30/25/20/25 health score, and document ingestion into PostgreSQL + Pinecone - cover the platform's entire dynamic behaviour with one contract each.
7. **Documented failure modes and decisions** mean the system degrades by design, not by accident - and the reasoning behind every major choice is written down for the evaluators, the team, and the future.

Companion documents in this submission package cover the database schema, the API surface, the AI/ML design, and the deployment pipeline in the same depth.

### In Plain English

> The whole architecture is one sentence long: three specialised counters share one warehouse, one badge system, one notice board, and one record room - and if the smart assistant kiosk loses power tomorrow, the counters keep serving citizens exactly as before. Everything else in this document is the detail of how those sharing arrangements stay fast, fair, and auditable at the scale of a nation's projects.

---

*This document is part of the ProjectAssure SIH 2026 submission.*



