# ProjectAssure - Build Prompts & Development Guide

## Overview

This document provides 20 structured, copy-paste-ready prompts for building ProjectAssure end to end. Each prompt is designed to be handed to an AI coding assistant (Cursor, GitHub Copilot Workspace, Claude Code, Windsurf, ChatGPT, or any agentic coding tool) to generate production-quality code for exactly one module at a time.

Prompts 1-13 cover the original build sequence: scaffolding, authentication, executive dashboard, project CRUD, milestones and tasks, budget and resources, alerts, AI chat, document processing, the ML prediction engine, analytics, database seeding, and production deployment. Prompts 14-20 are new hardening and demo-readiness prompts: automated testing, error handling and logging, environment variable validation, performance optimisation, accessibility, documentation, and the demo-day rehearsal script builder.

Every prompt follows the same template — Goal, Context to give the AI, The Prompt (copy-paste ready), Files this should create, Acceptance criteria, Verify by, and Depends on — so you can treat this file as a build queue: run Prompt 1, verify it, then run Prompt 2.

**Project identity (do not contradict in any prompt):**

- **Idea:** ProjectAssure — AI-powered government project portfolio monitoring and delay prediction
- **SIH 2026 Problem Statement:** SIH26103, Theme: Smart Automation, Category: Software, Organisation: MoSPI
- **Team college:** Amrita Vishwa Vidyapeetham, Chennai Campus
- **Stack:** Turborepo + pnpm monorepo; 3 Next.js 15 apps (`apps/web`, `apps/analytics`, `apps/ai-engine`) + shared packages (`ui`, `db`, `types`, `config`); TypeScript strict; Tailwind CSS 4 + shadcn/ui + Framer Motion; Prisma 6 + PostgreSQL 16 on Neon; Upstash Redis; Socket.io; Python 3.12 FastAPI ML service (XGBoost 18-feature delay model, Prophet forecasting, health score weights 0.30/0.25/0.20/0.25); OpenAI GPT-4o with Gemini fallback; Pinecone RAG; Vercel Blob; Gmail SMTP; NextAuth v5 JWT SSO; Docker Compose locally; Vercel deployment at `projectassure.vercel.app` with `analytics.` and `ai.` subdomains.

---

## How to Use These Prompts

1. **One prompt per conversation.** Start a fresh thread (or fresh Composer/Agent session) for each prompt. Long conversations accumulate context rot, and the AI will start repeating earlier mistakes. If your assistant supports project-level rules (Cursor `.cursorrules`, Claude `CLAUDE.md`), paste the "Project identity" block above into that file once and skip repeating it.
2. **Paste the context first, then the prompt.** Every prompt has a "Context to give the AI" paragraph. Paste that paragraph, wait for the AI to acknowledge the layout, then paste "The Prompt". This single habit prevents 80% of wrong-structure outputs.
3. **Iterate on the acceptance criteria, not on vibes.** After the AI writes code, read the acceptance criteria checklist. If any box fails, reply with the exact failing criterion verbatim, for example: "Criterion 3 fails: logged-out visit to /dashboard shows a blank page instead of redirecting to /login. Fix it." Precise failure reports get precise fixes.
4. **Verify each output before moving on.** Every prompt ends with a "Verify by" command or manual test. Run it. If you skip verification, a broken foundation silently poisons the next four prompts.
5. **Respect the dependency order.** Each prompt lists "Depends on" numbers. The hour-by-hour timeline at the bottom of this file sequences all 20 prompts across three realistic hackathon days.
6. **If the AI truncates, split the ask.** Long prompts sometimes produce cut-off code. Reply: "Implement requirements 1-4 only," then "Implement requirements 5-9 only." The numbered structure exists precisely for this.
7. **Keep the AI on the allowlisted stack.** If it imports a library outside the stack above (for example, Material UI or Axios when fetch exists), reject it: "Use only the approved stack: shadcn/ui, Recharts, Framer Motion, TanStack Table, @dnd-kit. Rewrite without X."

> ### In Plain English
> This file is a queue of 20 conversations you will have with an AI coding assistant over roughly three days. Each conversation builds one module. For every prompt: (a) copy the **Context** paragraph so the AI knows the monorepo layout, the Prisma models, and the design system; (b) copy **The Prompt** code block as-is; (c) when the AI finishes, run the **Verify by** check and tick the **Acceptance criteria** boxes; (d) only then move to the next prompt in the timeline. Never delete existing content between prompts — every later prompt assumes everything before it already works. If something breaks, fix it before proceeding, or you will be debugging two modules at once at 2 a.m.

---

## Troubleshooting Mini-FAQ

**Q: The AI generates one big Next.js app instead of the monorepo.**
A: It ignored the context. Reply: "Stop. ProjectAssure is a Turborepo + pnpm monorepo: `pnpm-workspace.yaml` with `apps/*` and `packages/*`. Three apps: apps/web, apps/analytics, apps/ai-engine. Four packages: ui, db, types, config. Create pnpm-workspace.yaml and turbo.json first, then scaffold the apps." Then re-paste the prompt.

**Q: Prisma errors — `P2002 unique constraint`, `Argument department is missing`, or `Property X does not exist on PrismaClient`.**
A: The schema and the generated client are out of sync. Run `cd packages/db && npx prisma migrate dev --name sync && npx prisma generate`, restart the TypeScript server in your editor, and re-run the failing command. If the error mentions a missing relation, the AI edited the schema inconsistently — ask it to re-read `packages/db/prisma/schema.prisma` before writing more code.

**Q: `Module not found: Can't resolve '@projectassure/db'` (or ui/types/config).**
A: Package boundary problem. Three checks: (1) the package is listed in the consuming app's `package.json` dependencies; (2) the package's `package.json` has a valid `main`/`exports` pointing at `src/index.ts`; (3) run `pnpm install` again so pnpm links the workspace. Never let the AI import across packages via relative paths like `../../packages/db/src` — that breaks Turborepo caching.

**Q: The AI invents dependencies that are not in the stack.**
A: Common offenders: Material UI, Chakra, Axios, React Query (we use server components + server actions), Moment.js (we use date-fns or native Intl). Reject with the allowlisted-stack sentence from "How to Use", item 7.

**Q: A shadcn/ui component import fails (`@/components/ui/table` not found).**
A: The component was never generated. Run `npx shadcn@latest add table card dialog badge button tabs toast` (adjust list) inside the app that needs it, and confirm `components.json` exists there.

**Q: Framer Motion hydration mismatch warnings.**
A: The component must start with `"use client"`, and anything using `Math.random()`, `Date.now()`, or window measurements must render after mount (`useEffect` + state) or be wrapped in `dynamic(..., { ssr: false })`.

**Q: Socket.io events do not arrive locally.**
A: Check three things: the Socket.io server port matches the client URL, CORS allows `http://localhost:3000`, and the Next.js dev server is not buffering the response. In production the Upstash Redis adapter must share the same `REDIS_URL` in every instance.

**Q: Styling looks unstyled (plain HTML).**
A: The shared Tailwind preset from `packages/config` is not applied. Each app's `globals.css` must `@import` the preset (Tailwind 4 CSS-first config) and the app's `tailwind.config`/CSS must include the component paths.

**Q: The AI "finished" but the acceptance criteria are half-met.**
A: Do not accept partial work. Reply with only the failing criteria, numbered, plus the output of the verify command. Repeat until all boxes are tickable — then tick them and move on.

---

### Prompt 1: Project Scaffolding & Monorepo Foundation

**Goal:** Bootstrap the complete Turborepo monorepo — three Next.js 15 apps, four shared packages, the full Prisma schema, and local Docker infrastructure — as the foundation every later prompt builds on.

**Context to give the AI:**
ProjectAssure is a government project portfolio monitoring platform built for Smart India Hackathon 2026 (PS ID SIH26103, MoSPI). It is a Turborepo + pnpm monorepo with three Next.js 15 App Router applications — `apps/web` (main product, port 3000), `apps/analytics` (port 3001), `apps/ai-engine` (port 3002) — and four shared packages: `packages/ui` (shadcn/ui components and design tokens), `packages/db` (owns `schema.prisma` and the Prisma client singleton), `packages/types` (shared Zod schemas and TypeScript types), `packages/config` (shared tsconfig, Tailwind preset, ESLint). The data layer is Prisma 6 with PostgreSQL 16 (Docker locally, Neon in production).

**The Prompt:**
```
Bootstrap ProjectAssure as a Turborepo + pnpm monorepo. Requirements:

1. Initialise pnpm workspaces (`pnpm-workspace.yaml` with apps/* and packages/*) and Turborepo (`turbo.json` with dev, build, lint, test pipelines and proper dependency caching).
2. Create three Next.js 15 App Router apps with TypeScript strict mode: apps/web (port 3000), apps/analytics (port 3001), apps/ai-engine (port 3002). Each must start with `next dev -p <port>`.
3. Create four shared packages with workspace names @projectassure/ui, @projectassure/db, @projectassure/types, @projectassure/config, each with a valid package.json "exports" field so apps can import them.
4. In packages/config create: a shared tsconfig.base.json, an ESLint config, and a shared Tailwind CSS 4 preset (CSS-first @theme) defining the design system: primary deep indigo #4F46E5, success #10B981, warning #F59E0B, danger #EF4444, neutral slate greys, Inter font, 8pt spacing scale, rounded-xl cards, subtle shadows.
5. In packages/ui set up shadcn/ui (components.json, cn util with clsx + tailwind-merge) and generate the base set: button, card, badge, table, dialog, input, label, select, tabs, toast/sonner, progress, avatar, dropdown-menu, skeleton.
6. In packages/db write the COMPLETE Prisma schema (PostgreSQL provider) with these models and enums:
   - Organisation (name, code) has many Departments
   - Department (name, code, organisationId)
   - User (name, email unique, passwordHash, role enum: ADMIN, PROJECT_MANAGER, STAKEHOLDER, VIEWER; departmentId optional)
   - Project (code unique like "P-104", name, description, departmentId, managerId, status enum: PLANNED, IN_PROGRESS, COMPLETED, ON_HOLD, CANCELLED; healthStatus enum: HEALTHY, AT_RISK, CRITICAL; healthScore Float; scheduleHealth, budgetHealth, resourceHealth, milestoneHealth Floats; totalBudget Float in lakhs; spentBudget Float; startDate, targetDate, actualEndDate; sector, state; progress Int)
   - Milestone (projectId, name, plannedStart, plannedEnd, actualStart, actualEnd, progress Int, status enum: PENDING, IN_PROGRESS, COMPLETED, DELAYED, BLOCKED)
   - Task (milestoneId, title, description, assigneeId, plannedStart, plannedEnd, progress Int, status enum: NOT_STARTED, IN_PROGRESS, COMPLETED, BLOCKED; self-relation dependsOn/dependentTasks many-to-many)
   - BudgetRecord (projectId, category, month DateTime, plannedAmount, actualAmount)
   - ResourceAllocation (projectId, name, type enum: HUMAN, EQUIPMENT, MATERIAL, quantity, capacity, utilisation Float, unit)
   - Alert (projectId, title, message, severity enum: LOW, MEDIUM, HIGH, CRITICAL, source enum: HEALTH_SCORE, PREDICTION, BUDGET, MILESTONE, MANUAL, acknowledged Boolean, acknowledgedById optional)
   - Notification (userId, title, body, type, read Boolean, link)
   - Document (projectId, name, blobUrl, mimeType, sizeBytes, status enum: UPLOADED, PROCESSING, PROCESSED, FAILED, extractedData Json?, confidence Float?)
   - Prediction (projectId, model String, type enum: DELAY, BUDGET, predictedDelayDays Int?, predictedFinalCost Float?, confidence Float, output Json, createdAt)
   - Conversation / Message (userId, projectId?, role, content) for AI chat history
   Add all necessary relations, onDelete cascade rules, and @@index on the frequently filtered columns (status, healthStatus, departmentId, projectId on child tables).
7. In packages/db create src/index.ts exporting a singleton PrismaClient (globalThis pattern to survive dev hot reload).
8. docker-compose.yml at repo root: postgres:16-alpine on 5432 (POSTGRES_USER: assure, POSTGRES_DB: projectassure) and redis:7-alpine on 6379, both with named volumes and healthchecks.
9. Root package.json scripts: dev, build, lint, test, db:migrate (prisma migrate dev), db:deploy (prisma migrate deploy), db:seed, db:studio, db:reset.
10. .env.example at root listing DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, REDIS_URL, SMTP_HOST, SMTP_USER, SMTP_PASSWORD, ALERT_EMAIL_FROM, OPENAI_API_KEY, GEMINI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX_URL, BLOB_READ_WRITE_TOKEN, ML_SERVICE_URL, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_ANALYTICS_URL, NEXT_PUBLIC_AI_URL — each with a one-line comment.
Do NOT build authentication, pages, or API routes in this prompt.
```

**Files this should create:**
- `pnpm-workspace.yaml`, `turbo.json`, root `package.json`, `.env.example`, `docker-compose.yml`, `.gitignore`
- `apps/web/`, `apps/analytics/`, `apps/ai-engine/` (each with `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `package.json`)
- `packages/db/prisma/schema.prisma`, `packages/db/src/index.ts`, `packages/db/package.json`
- `packages/types/src/index.ts` (shared enums and DTO types mirroring the schema)
- `packages/config/` (tsconfig.base.json, eslint config, tailwind preset)
- `packages/ui/` (components.json, `src/lib/utils.ts`, `src/components/ui/*`)

**Acceptance criteria:**
- [ ] `pnpm install` completes and `pnpm dev` serves all three apps on ports 3000, 3001, 3002
- [ ] `docker compose up -d` starts healthy postgres and redis containers
- [ ] `npx prisma validate` passes in packages/db and `pnpm db:migrate` creates every table
- [ ] Importing `@projectassure/db` and `@projectassure/ui` from `apps/web` compiles with no errors
- [ ] `turbo run build` succeeds for all three apps
- [ ] Every enum and Float health dimension from the table above exists in `schema.prisma`

**Verify by:** `pnpm dev` plus `docker compose ps` (both healthy), then `npx prisma studio` to confirm all tables exist.

**Depends on:** nothing — this is the first prompt.

---

### Prompt 2: Authentication System (NextAuth v5 + Role-Based Access Control)

**Goal:** Implement JWT authentication with a credentials provider, four-role RBAC, route protection middleware, and a session hook that the entire app relies on.

**Context to give the AI:**
ProjectAssure's main app is `apps/web` in a Turborepo monorepo; the Prisma client with a `User` model (email unique, passwordHash, role enum ADMIN/PROJECT_MANAGER/STAKEHOLDER/VIEWER) is imported from `@projectassure/db`. UI is shadcn/ui + Tailwind 4 in the deep-indigo design system, and forms use react-hook-form with Zod resolvers from `@projectassure/types`. Authentication must be NextAuth v5 (Auth.js) with the JWT strategy so sessions work across the web and analytics subdomains later.

**The Prompt:**
```
Implement authentication in apps/web using NextAuth v5 (Auth.js) with the JWT strategy. Requirements:

1. Create src/lib/auth.ts exporting the NextAuth config: CredentialsProvider that looks up the user by email in the User table and compares bcrypt hashes; on success attach id, role, departmentId, and name to the token. Session strategy: jwt, maxAge 7 days. Augment next-auth types so session.user includes role and departmentId.
2. Add auth callbacks (jwt and session) so the role travels token -> session. Export { handlers, auth, signIn, signOut } from src/lib/auth.ts and wire src/app/api/auth/[...nextauth]/route.ts.
3. Create src/middleware.ts protecting all /dashboard/* routes and all /api/* routes except /api/auth/*: unauthenticated users redirect to /login with a callbackUrl param; the middleware only checks token presence — fine-grained role checks live server-side.
4. Build three pages under src/app/(auth)/: /login, /register, /forgot-password. Use shadcn/ui Card, Input, Button, Label with react-hook-form + Zod. Login shows email/password with a generic "Invalid email or password" error (never reveal which failed). Register creates a user with bcrypt hash (12 rounds), default role VIEWER, then signs in. Forgot-password is a stub that always shows "If the email exists, a reset link has been sent" and logs the token server-side (no SMTP dependency yet).
5. Create src/hooks/use-auth.ts returning { user, role, isAdmin, isManager, isStakeholder, isViewer, can } where can(action, resource) implements the RBAC matrix:
   - ADMIN: full control of everything
   - PROJECT_MANAGER: create/update projects and child records only where managerId is their user id
   - STAKEHOLDER: read all + export reports
   - VIEWER: read-only, no create/edit/delete UI rendered
6. Create demo-friendly seed-aware behaviour: if a user with role ADMIN exists, show four one-click role buttons on /login (admin@demo.in / pm@demo.in / stakeholder@demo.in / viewer@demo.in, password Demo@1234) ONLY when NODE_ENV is development.
7. Add a sign-out route and a user avatar dropdown (shadcn dropdown-menu) showing name, role badge, and sign out.
8. On the JWT, also store the current project scope when provided (used by AI chat later) but keep it optional.
Do not use database sessions. Do not add OAuth providers.
```

**Files this should create:**
- `apps/web/src/lib/auth.ts`, `apps/web/src/app/api/auth/[...nextauth]/route.ts`
- `apps/web/src/middleware.ts`, `apps/web/src/types/next-auth.d.ts`
- `apps/web/src/app/(auth)/layout.tsx`, `login/page.tsx`, `register/page.tsx`, `forgot-password/page.tsx`
- `apps/web/src/hooks/use-auth.ts`
- `apps/web/src/components/auth/user-menu.tsx`, `role-badge.tsx`
- `apps/web/src/lib/password.ts` (bcrypt helpers shared with register route)

**Acceptance criteria:**
- [ ] Logging in with each of the four demo roles reaches /dashboard and the avatar shows the correct role badge
- [ ] Logged-out visit to /dashboard redirects to /login?callbackUrl=/dashboard and returns to the dashboard after sign-in
- [ ] A VIEWER sees no create/edit buttons anywhere; a PROJECT_MANAGER sees them only on assigned projects
- [ ] The JWT contains id, role, and departmentId (inspect via jwt decoder or a debug page)
- [ ] Registering a new user stores a bcrypt hash (never plaintext) and signs the user in
- [ ] Wrong password shows the generic error; there is no user-enumeration difference in response timing or copy
- [ ] Sign out clears the session and middleware blocks /api/projects afterwards

**Verify by:** Open an incognito window: visit `/dashboard` (must redirect), log in as admin@demo.in / Demo@1234, confirm the dashboard loads and the role badge reads ADMIN.

**Depends on:** 1.

---

### Prompt 3: Executive Dashboard

**Goal:** Build the command-centre dashboard at `/dashboard` with animated KPI cards, health donut, budget gauge, critical alerts panel, sortable project ranking table, and filters.

**Context to give the AI:**
`apps/web` is a Next.js 15 App Router app in the ProjectAssure monorepo, authenticated via NextAuth v5 (Prompt 2). Data comes from `@projectassure/db` Prisma models `Project` (healthScore, scheduleHealth/budgetHealth/resourceHealth/milestoneHealth, status, healthStatus enum HEALTHY/AT_RISK/CRITICAL), `Department`, and `Alert` (severity, acknowledged). The design system is Tailwind 4 + shadcn/ui + Framer Motion with colours: success #10B981, warning #F59E0B, danger #EF4444, primary #4F46E5. Charts use Recharts.

**The Prompt:**
```
Build the Executive Dashboard page at apps/web/src/app/dashboard/page.tsx. Requirements:

1. Top row: four KPI cards — Total Active Projects, On Track (green), At Risk (amber), Delayed (red). Each card: shadcn Card, label, big number animated with a Framer Motion count-up (useSpring/useMotionValue from 0 to value over 800ms), a small trend arrow versus last week, and a left accent border in its colour.
2. Second row: (a) health distribution donut chart (Recharts PieChart, innerRadius) with three segments HEALTHY/AT_RISK/CRITICAL, center label showing total count, legend with counts; (b) budget utilisation radial gauge (Recharts RadialBarChart) showing total spentBudget / totalBudget as a percentage with colour shifting green < 70, amber 70-90, red > 90; (c) critical alerts panel: the 5 most recent unacknowledged HIGH/CRITICAL alerts, each sliding in with a staggered Framer Motion animation, showing severity badge, project code, title, relative time, and an acknowledge button.
3. Third row: project ranking table (shadcn Table) listing every project with: code, name, department, healthScore (circular progress ring), progress bar, budget utilisation %, status badge, target date. Column headers sort ascending/descending on healthScore, progress, and budget utilisation. Rows are clickable and navigate to /dashboard/projects/[id]. Highlight AT_RISK rows with an amber left border and CRITICAL with red.
4. Filter bar above the table: department (select from Department table), status, and health category — implemented as URL search params (?dept=&status=&health=) so filters are shareable and survive refresh; the page reads searchParams and filters in the Prisma query where sensible, client-side within the table otherwise.
5. Data fetching: a server component queries via a functions-only module src/lib/queries/dashboard.ts using Prisma groupBy/aggregations (NOT per-project loops). Revalidate 60 seconds. All charts and animated numbers are client components ("use client") receiving plain serialisable props.
6. Add loading.tsx with shadcn skeletons matching the layout, and empty states when no projects match filters.
7. Fully responsive: 4 columns -> 2 -> 1 at lg/md/sm; the table becomes horizontally scrollable on mobile.
```

**Files this should create:**
- `apps/web/src/app/dashboard/page.tsx`, `loading.tsx`
- `apps/web/src/lib/queries/dashboard.ts`
- `apps/web/src/components/dashboard/kpi-card.tsx`, `health-donut-chart.tsx`, `budget-gauge.tsx`, `critical-alerts-panel.tsx`, `project-ranking-table.tsx`, `dashboard-filter-bar.tsx`, `health-ring.tsx`
- `apps/web/src/app/api/alerts/[id]/acknowledge/route.ts` (used by the acknowledge button)

**Acceptance criteria:**
- [ ] The four KPI numbers exactly match the seeded database counts (cross-check in Prisma Studio)
- [ ] KPI numbers animate from 0 on page load and the donut segment sizes match the counts
- [ ] Clicking each column header toggles ascending/descending sort on the correct field
- [ ] Changing the department filter updates the URL and the visible rows; copying the URL into a new tab preserves the filter
- [ ] The alerts panel shows only unacknowledged HIGH/CRITICAL alerts and acknowledging one removes it without a full reload
- [ ] The page renders correctly at 375px, 768px, and 1440px widths
- [ ] No client component fetches directly — all data enters as props from the server component

**Verify by:** `pnpm dev` with seeded data: compare the four KPI numbers and donut counts against `npx prisma studio`; then sort by health score and confirm order flips.

**Depends on:** 1, 2, 12 (seeding gives it data; build order still places dashboard before seed v2 — see timeline).

---

### Prompt 4: Project CRUD & Detail Page

**Goal:** Build the full project management module — a filterable data table, a multi-step create wizard, and a rich detail page with health cards, Gantt timeline, milestones, budget breakdown, resources, alerts, and documents.

**Context to give the AI:**
`apps/web` in the ProjectAssure Turborepo monorepo, NextAuth v5 RBAC in place (Prompt 2). Prisma models from `@projectassure/db`: `Project` (with four health dimension Floats, totalBudget/spentBudget in lakhs, status and healthStatus enums), `Milestone`, `Task`, `BudgetRecord`, `ResourceAllocation`, `Alert`, `Document` — all related to Project. UI: shadcn/ui + Tailwind 4 + Framer Motion; TanStack Table for data grids; forms are react-hook-form + Zod.

**The Prompt:**
```
Build the project management module in apps/web. Requirements:

1. LIST PAGE /dashboard/projects: shadcn DataTable (TanStack Table) with columns: project code, name, department, healthScore as a small circular progress ring (green >=70, amber 40-69, red <40), progress bar, budget utilisation %, status badge, target date. Features: debounced global search (name or code), column sorting, status/health filters, pagination (10 per page), row click -> detail page. ADMIN and PROJECT_MANAGER see a "New Project" button.
2. CREATE PAGE /dashboard/projects/new: multi-step wizard with four steps — (1) Project info: name, code (auto-suggested next P-number), description, department, sector, state, manager; (2) Budget: total budget in lakhs, category breakdown; (3) Milestones: dynamic list of at least one milestone with planned start/end; (4) Review + create. Each step validates with Zod before Next is enabled; progress indicator shows step 1/4; state persists across steps in a react-hook-form FormProvider; on submit, a server action creates Project + Milestones + initial BudgetRecords in one transaction, then redirects to the detail page.
3. DETAIL PAGE /dashboard/projects/[id]: 
   - Header: code, name, department, status badge, health badge, Edit (role-gated) and Delete (ADMIN only, confirm dialog) actions.
   - Four health dimension cards (Schedule, Budget, Resources, Milestones) each with a ring gauge, 0-100 score, and a one-line AI-style caption ("Budget burn is 22% ahead of plan").
   - Gantt chart timeline: milestones as horizontal bars (planned bar in grey, actual overlay in colour) on a month grid; overdue milestones tinted red; today marker line. Build with pure SVG/Framer Motion — no heavy Gantt library.
   - Milestone list with status indicators, planned vs actual dates, and delay in days.
   - Budget breakdown chart (Recharts PieChart by category) plus planned vs actual summary numbers.
   - Resource allocation table: name, type badge (Human/Equipment/Material), quantity, utilisation bar with green/amber/red grading.
   - Alert history: latest 10 alerts for this project with severity badges and timestamps.
   - Document upload area: drag-and-drop zone (visual only in this prompt — wiring comes in Prompt 9) listing existing documents with status chips.
4. Server actions in src/app/actions/project-actions.ts for create/update/delete with Zod validation, revalidatePath, and RBAC checks server-side (PM may only mutate projects where managerId = self; STAKEHOLDER/VIEWER get 403).
5. Framer Motion page transitions (fade/slide) and staggered list item entrances; detail sections animate in on scroll (whileInView, once).
6. All mutations optimistic where safe (status toggle, inline edit) with rollback + error toast on failure.
```

**Files this should create:**
- `apps/web/src/app/dashboard/projects/page.tsx`, `new/page.tsx`, `[id]/page.tsx`, `[id]/loading.tsx`
- `apps/web/src/app/actions/project-actions.ts`
- `apps/web/src/lib/queries/projects.ts`
- `apps/web/src/components/projects/project-table.tsx`, `project-filter-toolbar.tsx`
- `apps/web/src/components/projects/create-wizard/` (`index.tsx`, `step-project-info.tsx`, `step-budget.tsx`, `step-milestones.tsx`, `step-review.tsx`)
- `apps/web/src/components/projects/detail/` (`health-dimension-card.tsx`, `gantt-timeline.tsx`, `milestone-list.tsx`, `budget-breakdown-chart.tsx`, `resource-table.tsx`, `alert-history.tsx`, `document-uploader.tsx`)
- `apps/web/src/components/projects/delete-project-dialog.tsx`

**Acceptance criteria:**
- [ ] Creating a project through all four wizard steps lands on its detail page and the row appears in the list
- [ ] Submitting step 2 with a negative or empty budget is blocked with a field error and the Next button stays disabled
- [ ] The detail page renders all seven sections with correct data for a seeded project
- [ ] The Gantt shows planned vs actual bars and a red tint for milestones past their planned end
- [ ] A PROJECT_MANAGER gets 403 on a server action for an unassigned project, and sees no Edit button there
- [ ] Delete asks for confirmation and removes the project plus children (cascade) without orphan rows
- [ ] Table search, sort, and pagination all work and survive a page refresh via URL params

**Verify by:** Create project "P-TEST River Linking Survey" end-to-end via the wizard, then find it in `npx prisma studio` with milestones and budget rows created.

**Depends on:** 1, 2, 12.

---

### Prompt 5: Milestone & Task Management

**Goal:** Build milestone timelines, a drag-and-drop task Kanban, a task detail modal, a dependency graph, and critical path highlighting.

**Context to give the AI:**
`apps/web` in the ProjectAssure monorepo; Prisma models `Milestone` (plannedStart/plannedEnd, actualStart/actualEnd, progress, status enum PENDING/IN_PROGRESS/COMPLETED/DELAYED/BLOCKED) and `Task` (status enum NOT_STARTED/IN_PROGRESS/COMPLETED/BLOCKED, progress, self many-to-many dependsOn relation) from `@projectassure/db`. UI: shadcn/ui + Tailwind 4 + Framer Motion; drag-and-drop MUST use @dnd-kit; graph layout may use dagre with SVG edges.

**The Prompt:**
```
Build milestone and task management inside the project detail area. Requirements:

1. MILESTONE CRUD + TIMELINE: add/edit/delete milestones from the project detail page (dialog forms, role-gated). A visual timeline section shows each milestone as a horizontal bar: planned range in muted grey, actual range overlaid in colour (green completed, blue in-progress, red delayed, orange blocked), with a today marker. Status badges use the five-status enum with distinct colours; delayed milestones show "N days late".
2. TASK KANBAN BOARD at /dashboard/projects/[id]/board: four columns NOT_STARTED, IN_PROGRESS, COMPLETED, BLOCKED built with @dnd-kit/core and @dnd-kit/sortable. Dragging a card between columns performs an optimistic move (Framer Motion layout animation), calls PATCH /api/tasks/[id], and rolls back with an error toast if the API fails. Cards show title, assignee avatar, due date (red if < 3 days away), progress bar, and a dependency count icon.
3. TASK DETAIL MODAL: click a card opens a shadcn Dialog with title, description, assignee select (project team), planned/actual dates, progress slider (0-100), status select, and a multi-select "depends on" listing other tasks of the same project (preventing cycles). Save via server action with Zod validation.
4. DEPENDENCY GRAPH: /dashboard/projects/[id]/dependencies renders tasks as nodes and dependencies as arrows using dagre for layout and SVG for edges. Colour nodes by status; draw the critical path in red with a thicker stroke; clicking a node opens the task modal.
5. CRITICAL PATH: compute the longest dependency chain by planned duration in src/lib/critical-path.ts (topological sort + longest-path DP). Milestones containing critical tasks get a "Critical path" badge; the board shows a red left border on critical task cards.
6. API routes under /api/projects/[projectId]/milestones and /api/projects/[projectId]/tasks (GET list, POST create) plus /api/tasks/[id] (PATCH, DELETE), all RBAC-checked and returning the standard error envelope (Prompt 15 will formalise it — use { success, data } / { success: false, error } now).
7. Add a "Due soon" filter chip on the board for tasks due within 7 days.
```

**Files this should create:**
- `apps/web/src/app/dashboard/projects/[id]/board/page.tsx`, `dependencies/page.tsx`
- `apps/web/src/app/api/projects/[projectId]/milestones/route.ts`, `.../milestones/[milestoneId]/route.ts`, `.../tasks/route.ts`
- `apps/web/src/app/api/tasks/[id]/route.ts`
- `apps/web/src/components/milestones/milestone-dialog.tsx`, `milestone-timeline.tsx`
- `apps/web/src/components/tasks/kanban-board.tsx`, `kanban-column.tsx`, `task-card.tsx`, `task-detail-modal.tsx`, `dependency-graph.tsx`, `critical-path-badge.tsx`
- `apps/web/src/lib/critical-path.ts`

**Acceptance criteria:**
- [ ] Dragging a task to another column persists after a full page refresh
- [ ] Killing the network mid-drag rolls the card back to its original column with an error toast
- [ ] The dependency modal refuses to save a circular dependency and explains why
- [ ] On seeded data, the computed critical path matches a manual walk of the seeded dependency chain
- [ ] Milestone timeline shows delay in days for DELAYED milestones and the today marker is positioned correctly
- [ ] VIEWER/STAKEHOLDER roles cannot drag cards (drag disabled) or open edit mode
- [ ] Board and graph render at 375px width without horizontal page overflow (internal scroll allowed)

**Verify by:** Drag a seeded task from Not Started to In Progress, refresh the page, and confirm persistence; then open the dependency graph and confirm the red path matches `pnpm tsx scripts/check-critical-path.ts` output (ask the AI to add this 10-line script).

**Depends on:** 4.

---

### Prompt 6: Budget & Resource Management

**Goal:** Build budget tracking with planned-vs-actual charts, a validated budget record form, a resource allocation table, and a bottleneck analysis with delay estimation.

**Context to give the AI:**
`apps/web` in the ProjectAssure monorepo; Prisma models `BudgetRecord` (category, month, plannedAmount, actualAmount) and `ResourceAllocation` (type HUMAN/EQUIPMENT/MATERIAL, quantity, capacity, utilisation Float) from `@projectassure/db`, related to `Project`. UI: shadcn/ui + Recharts + Framer Motion; forms react-hook-form + Zod; budgets are in lakhs (Indian convention: 1 lakh = 100,000 INR).

**The Prompt:**
```
Build budget and resource management at /dashboard/projects/[id]/budget. Requirements:

1. SUMMARY CARDS: Total Budget, Spent, Remaining, and Burn Rate (avg monthly spend) — with Framer Motion count-up and colour states (Remaining red when burn rate projects a 15%+ overrun).
2. PLANNED VS ACTUAL BY CATEGORY: Recharts stacked BarChart with one bar per category (personnel, equipment, materials, overhead, contingency), planned and actual series, tooltip in the "₹X.XX L" format.
3. MONTHLY TREND: line chart of planned vs actual spend over the last 6+ months with a dashed projection line extending the current burn rate 6 months forward.
4. PROJECTED FINAL COST indicator: a prominent callout card showing projectedFinalCost = current burn rate x total planned months, delta versus totalBudget as a percentage, and a "Projected overrun: ₹X L (+Y%)" warning in red when > 100%.
5. BUDGET RECORD FORM: shadcn Dialog + react-hook-form + Zod — category select, month (month input), plannedAmount, actualAmount; Zod rejects negatives, non-numeric input, and months in the future beyond a 1-day tolerance. On submit, a server action upserts the record and revalidates the page. RBAC: ADMIN and the owning PROJECT_MANAGER only.
6. RESOURCE ALLOCATION TABLE: name, type badge (Human/Equipment/Material with icons), quantity/capacity, and utilisation as a colour-graded progress bar (green < 70%, amber 70-90%, red > 90%) plus a numeric %. Add/edit dialog with the same Zod discipline; utilisation must be 0-100.
7. BOTTLENECK ANALYSIS panel: lists every resource with utilisation > 90%, sorted descending, each row estimating the resulting delay with the heuristic delayDays = ceil((utilisation - 90) / 10) * 7 and a one-line recommendation ("Reassign 2 engineers from M-3 or accept ~2 weeks slip on Foundation work"). The panel header shows a count badge and links each row to the affected milestone.
8. All charts are client components; data fetched server-side in src/lib/queries/budget.ts with aggregations (no N+1 loops).
```

**Files this should create:**
- `apps/web/src/app/dashboard/projects/[id]/budget/page.tsx`, `loading.tsx`
- `apps/web/src/app/actions/budget-actions.ts`, `resource-actions.ts`
- `apps/web/src/lib/queries/budget.ts`, `apps/web/src/lib/bottleneck.ts`
- `apps/web/src/components/budget/budget-summary-cards.tsx`, `category-stacked-bar.tsx`, `monthly-trend-chart.tsx`, `projected-cost-callout.tsx`, `budget-record-dialog.tsx`
- `apps/web/src/components/resources/resource-table.tsx`, `resource-dialog.tsx`, `bottleneck-panel.tsx`
- `packages/types/src/budget.ts` (Zod schemas for BudgetRecord and ResourceAllocation)

**Acceptance criteria:**
- [ ] All four summary cards and both charts render correct numbers from seeded BudgetRecords
- [ ] Submitting the record form with a negative amount is blocked client-side AND server-side (test via curl too)
- [ ] Setting a resource to 95% utilisation makes it appear in the bottleneck panel with a 35-day estimate
- [ ] The projection line extends the actual burn rate, not the planned rate
- [ ] A STAKEHOLDER sees the charts but gets 403 on the create/update server actions
- [ ] Charts re-render after adding a record without a full page reload (router.refresh or revalidatePath)

**Verify by:** Add a budget record of actual 120 vs planned 100 for the current month and confirm the trend chart and projected-cost callout update; set one seeded resource to 95% and confirm the bottleneck row appears.

**Depends on:** 4.

---

### Prompt 7: Alert & Notification System

**Goal:** Build real-time alerts and notifications — bell with unread badge, grouped dropdown, mark-as-read, Gmail SMTP email for critical alerts, Socket.io push with Upstash Redis adapter, and automatic trigger rules.

**Context to give the AI:**
`apps/web` in the ProjectAssure monorepo; Prisma models `Alert` (severity LOW/MEDIUM/HIGH/CRITICAL, source, acknowledged) and `Notification` (userId, read) from `@projectassure/db`; `Project.healthScore` drives triggers. Stack pieces already available: Upstash Redis (REDIS_URL), Gmail SMTP creds (SMTP_*), NextAuth session. UI: shadcn/ui + Framer Motion. Real-time transport is Socket.io with @socket.io/redis-adapter (Upstash connection).

**The Prompt:**
```
Build the alert and notification system. Requirements:

1. NOTIFICATION BELL in the dashboard header: shadcn popover with an unread count badge (red dot with number, cap display at 99+). The count loads server-side initially and then updates live via Socket.io.
2. DROPDOWN PANEL: notifications grouped under sticky headers "Today", "This Week", "Earlier"; each row: type icon, title, body (2-line clamp), relative time, link target; unread rows have an indigo dot and tinted background; the panel animates in with a Framer Motion slide + fade; "Mark all read" button at the top; each row is individually clickable to mark read and navigate.
3. MARK AS READ: single and bulk; optimistic UI with rollback; server actions revalidate the bell count.
4. EMAIL ALERTS: Nodemailer transport over Gmail SMTP (host smtp.gmail.com, port 465 secure) using SMTP_USER + SMTP_PASSWORD. Branded HTML template (inline CSS, ProjectAssure header, alert details, deep link to the project page). Emails fire ONLY for HIGH and CRITICAL severity, and only to ADMIN + the project's manager. A mail:send failure must never break the API path — log and continue.
5. REAL-TIME PUSH: a Socket.io server (custom server or a Next.js route handler with the socket.io node server attached in development) using @socket.io/redis-adapter with REDIS_URL so multiple instances stay in sync. Rooms per userId; the client connects once after sign-in with the session token, joins its user room, and listens for notification:new events.
6. TRIGGER ENGINE in src/lib/alerts/triggers.ts — a function evaluateProjectTriggers(projectId) run after health recalculation, prediction ingestion, and milestone updates. Rules:
   - healthScore drops more than 10 points in one recalculation -> HIGH alert
   - healthScore crosses below 40 -> CRITICAL alert (healthStatus CRITICAL)
   - an ML prediction reports predictedDelayDays > 14 -> HIGH alert
   - a milestone passes plannedEnd while status != COMPLETED -> MEDIUM alert
   - spentBudget exceeds 110% of the pro-rata plan -> HIGH alert
   Each trigger writes the Alert and per-audience Notification rows in one transaction (idempotent: no duplicate open alert of the same source+rule for the same project within 24h), then emits over Socket.io and (if eligible) sends email.
7. MANUAL ALERTS: ADMIN/PM can create an alert from the project page (dialog with severity, title, message).
8. Add an /api/health/socket endpoint reporting the Socket.io server status for the deployment checklist.
```

**Files this should create:**
- `apps/web/src/components/notifications/notification-bell.tsx`, `notification-panel.tsx`, `notification-row.tsx`
- `apps/web/src/app/actions/notification-actions.ts`
- `apps/web/src/lib/alerts/triggers.ts`, `apps/web/src/lib/alerts/rules.ts`
- `apps/web/src/lib/email/mailer.ts`, `apps/web/src/lib/email/templates/alert-email.ts`
- `apps/web/src/lib/socket/server.ts`, `apps/web/src/lib/socket/client.tsx`, `apps/web/src/app/api/health/socket/route.ts`
- `apps/web/src/components/projects/create-alert-dialog.tsx`
- `server.ts` (Socket.io bootstrap if using a custom dev server) with `pnpm dev:socket` script

**Acceptance criteria:**
- [ ] With the app open in two browser tabs, triggering an alert in one updates the bell badge in the other without refresh
- [ ] A CRITICAL alert produces an email that arrives in the Gmail inbox with correct project deep link
- [ ] Dropdown groups are correct: a notification from 3 days ago appears under "This Week", not "Today"
- [ ] "Mark all read" zeroes the badge and survives refresh
- [ ] Triggering the same rule twice within 24 hours creates only one alert (idempotency check)
- [ ] Stopping the SMTP creds does not break alert creation (email failure logged, alert still saved)
- [ ] The health-score drop trigger fires exactly once when healthScore falls from 65 to 50

**Verify by:** Open two tabs, run `pnpm tsx scripts/trigger-test-alert.ts` (ask the AI for this 15-line script that calls evaluateProjectTriggers on a seeded project), and confirm the badge updates live and the email arrives.

**Depends on:** 3, 4.

> ### In Plain English
> Prompts 1-7 gave you the product shell: users sign in, projects exist, milestones move, budgets burn, and alerts fire. This is the point where the app already looks like something a jury can click through — but it is not yet intelligent. Resist the urge to polish visuals now; the differentiators (AI chat, predictions, document intelligence) come next, and they need the clean data layer you just built. If you are behind schedule at this point, cut visual polish, never cut the data integrity of Prompts 4-6.

---

### Prompt 8: AI Chat Interface (Agentic Assistant with Tool Calling)

**Goal:** Build the slide-in AI chat panel with message history, quick actions, GPT-4o tool-calling into the database/predictions/documents, Gemini fallback, streaming responses, and source citations.

**Context to give the AI:**
The ProjectAssure monorepo has `apps/ai-engine` (Next.js 15, port 3002) for AI endpoints and `apps/web` for the product UI. Available backends: OpenAI GPT-4o (primary), Gemini (fallback), Pinecone RAG over project documents (vectors added in Prompt 9), Prisma models Project/Milestone/Task/BudgetRecord/Alert/Prediction/Conversation/Message, and the ML service at ML_SERVICE_URL (Prompt 10) exposing /predict/delay and /calculate-health. Chat UI follows the Vercel AI SDK patterns; use the `ai` package with OpenAI and Google providers.

**The Prompt:**
```
Build the agentic AI chat experience. Requirements:

1. CHAT PANEL UI in apps/web: a floating action button (bottom-right, Pulse icon) that opens a slide-in panel (420px wide, full height, Framer Motion spring) — Vercel-v0 style. Includes: header with "ProjectAssure Assistant" + model badge, close button and Ctrl+Shift+K toggle; message list with user (right, indigo) and assistant (left, card) bubbles, a typing indicator (three bouncing dots), and auto-scroll to the newest message; input box with send button and Enter-to-send (Shift+Enter newline).
2. QUICK ACTION chips above the input: "Why is this project at risk?", "Show budget analysis", "Compare departments". When the panel opens on a project page, the project context (id, code, name, healthScore) is attached to the conversation automatically.
3. BACKEND at apps/ai-engine /api/chat: streaming route using the Vercel AI SDK. Primary model gpt-4o; on 429/5xx/timeout, automatically fall back to gemini-1.5-pro for the remainder of the turn and surface a small "answered by Gemini fallback" note. System prompt: concise analyst persona, always answers with data from tools, never invents numbers, SIH/MoSPI context.
4. TOOL CALLING (OpenAI function calling / AI SDK tools) — define exactly these tools:
   - getProjectSummary(projectCode): healthScore, dimension scores, status, progress, budget numbers
   - getBudgetRecords(projectCode, months): monthly planned vs actual series
   - getMilestones(projectCode): status list with delays
   - runDelayPrediction(projectCode): calls ML_SERVICE_URL /predict/delay with live features and returns predictedDelayDays + confidence + top factors
   - searchProjectDocuments(query, projectCode?): Pinecone similarity search returning chunk text + source document names
   - listAlerts(projectCode?, severity?): recent alerts
   - compareDepartments(metric): aggregated Prisma groupBy across departments
   Every tool validates inputs with Zod and is read-only (no mutations).
5. CITATIONS: after each assistant response, render the tools that were called as small source chips ("DB: Project", "ML: delay model", "Docs: DPR_v2.pdf p.4") so the jury can see grounded provenance. The stream must include tool-call metadata for this.
6. MULTI-TURN MEMORY: persist Conversation and Message rows (role, content, toolNames) after each turn; on panel open, resume the last conversation for that user+project; cap injected history at the last 10 messages plus a project context block.
7. Streaming must render partial tokens progressively; aborting the panel mid-stream cancels cleanly without corrupting history.
```

**Files this should create:**
- `apps/web/src/components/chat/chat-fab.tsx`, `chat-panel.tsx`, `message-bubble.tsx`, `typing-indicator.tsx`, `quick-actions.tsx`, `citation-chips.tsx`, `chat-provider.tsx`
- `apps/ai-engine/src/app/api/chat/route.ts`
- `apps/ai-engine/src/lib/ai/providers.ts` (OpenAI + Gemini with fallback wrapper)
- `apps/ai-engine/src/lib/tools/` (`get-project-summary.ts`, `get-budget-records.ts`, `get-milestones.ts`, `run-delay-prediction.ts`, `search-documents.ts`, `list-alerts.ts`, `compare-departments.ts`, `index.ts`)
- `apps/ai-engine/src/lib/tools/schemas.ts` (Zod schemas for every tool)
- `apps/ai-engine/src/lib/chat/persist.ts` (Conversation/Message writer)
- `packages/db/prisma/schema.prisma` additions if Conversation/Message are not yet present

**Acceptance criteria:**
- [ ] Each quick action visibly triggers the correct tool (verifiable in server logs) and returns a data-grounded answer
- [ ] Asking "Why is P-101 at risk?" about a seeded at-risk project cites its real milestone delays and budget numbers
- [ ] Citation chips appear under every tool-using answer and name the exact tables/documents used
- [ ] Responses stream token-by-token with the typing indicator before the first token
- [ ] Temporarily breaking the OpenAI key makes the route fall back to Gemini mid-request with the fallback note shown
- [ ] Reopening the panel restores the previous conversation for the same project
- [ ] No tool can mutate data (attempting "delete project P-101" via chat produces a refusal, not a deletion)

**Verify by:** Open a seeded CRITICAL project, click "Why is this project at risk?", and cross-check every number in the answer against Prisma Studio and the ML endpoint response.

**Depends on:** 2, 10 (ML service for predictions), 1; 9 adds document grounding.

---

### Prompt 9: Document Processing Pipeline

**Goal:** Build the ingestion pipeline — drag-and-drop upload to Vercel Blob, text extraction (PDF/Excel/OCR), LLM structured extraction, Zod validation, Postgres storage, Pinecone embeddings, and an extraction summary view.

**Context to give the AI:**
ProjectAssure monorepo: uploads happen in `apps/web`, heavy processing runs in the Python service (`services/ml-service` from Prompt 10) plus `apps/ai-engine` for LLM calls. Prisma model `Document` (blobUrl, status enum UPLOADED/PROCESSING/PROCESSED/FAILED, extractedData Json, confidence). Pinecone index is configured via PINECONE_API_KEY and PINECONE_INDEX_URL; embeddings use OpenAI text-embedding-3-small; structured extraction uses GPT-4o with a JSON schema.

**The Prompt:**
```
Build the document ingestion pipeline. Requirements:

1. UPLOAD UI: replace the placeholder in the project detail page with a real drag-and-drop uploader (react-dropzone or native): accepts PDF, XLSX/XLS, PNG/JPG; max 25MB; shows per-file progress bars (XMLHttpRequest onprogress against the upload API); on success the row flips to PROCESSING with a spinner.
2. UPLOAD API /api/documents/upload: authenticates, validates mime + size with Zod, uploads the buffer to Vercel Blob (BLOB_READ_WRITE_TOKEN) under a per-project prefix, creates a Document row with status UPLOADED, then enqueues processing (simple: fire-and-forget fetch to the process endpoint; reliable enough for demo scale) and returns the document id.
3. PROCESSING PIPELINE (orchestrated in apps/ai-engine, extraction in the Python service where noted):
   a. status -> PROCESSING
   b. text extraction: PDF via pdfplumber (Python), Excel via openpyxl (Python), images via Tesseract OCR (Python) — expose POST /extract on the ML service returning plain text; LLM route only for PDFs with no text layer
   c. structured extraction: send the text (chunked if > 30k chars) to GPT-4o with a strict JSON schema: { projectName, vendor, totalBudgetLakhs, currency, startDate, endDate, milestones: [{name, plannedEnd}], budgetLines: [{category, amount}], risks: [string] } — temperature 0.1
   d. validate with Zod (packages/types); on validation failure retry once with a "return only valid JSON" correction prompt; if it fails again, status FAILED with the reason
   e. persist: update the Document row (extractedData, confidence = model-reported, status PROCESSED) and upsert extracted entities where they match an existing project (budget lines append to BudgetRecord if confidently parsed)
   f. embeddings: chunk the raw text (~800 chars, 100 overlap), embed with text-embedding-3-small, upsert into Pinecone namespace project:<id> with metadata {documentId, name, chunkIndex}
4. STATUS + PROGRESS: a polling hook (or Socket.io event) updates the document row in the UI through UPLOADED -> PROCESSING -> PROCESSED/FAILED with a stepped progress indicator (Upload 100% -> Extract -> Extract data -> Index).
5. EXTRACTION SUMMARY view: clicking a processed document opens a dialog showing the structured JSON as human-readable cards (budget figures in lakh format, milestones as a mini list) plus an AI-generated 3-4 sentence narrative of the document, a confidence badge, and a "Reprocess" button (ADMIN/PM only).
6. Errors: unsupported/corrupt files must end as FAILED with a human-readable reason in the dialog — never a crashed UI. Storage: never keep secrets in Blob URLs (private access via signed fetch route).
```

**Files this should create:**
- `apps/web/src/components/documents/document-uploader.tsx` (upgrade of the placeholder), `document-list.tsx`, `document-status-chip.tsx`, `extraction-summary-dialog.tsx`
- `apps/web/src/app/api/documents/upload/route.ts`, `apps/web/src/app/api/documents/[id]/route.ts` (GET status, DELETE), `apps/web/src/app/api/documents/[id]/file/route.ts` (signed access)
- `apps/ai-engine/src/app/api/documents/process/route.ts`
- `apps/ai-engine/src/lib/documents/extract-llm.ts`, `validate.ts`, `embeddings.ts`, `pinecone.ts`
- `services/ml-service/app/routers/extract.py` (+ `services/extractors.py`: pdfplumber, openpyxl, pytesseract)
- `packages/types/src/document.ts` (ExtractionResult Zod schema)

**Acceptance criteria:**
- [ ] Uploading a sample DPR PDF ends with status PROCESSED and extractedData containing the correct budget figure printed in the PDF
- [ ] Uploading an XLSX budget sheet parses rows into budgetLines correctly
- [ ] Uploading a photo of a typed page runs OCR and extracts most of the text (>= 80% of visible words)
- [ ] A corrupt/renamed file ends FAILED with a readable reason and the UI stays fully functional
- [ ] After a PROCESSED document, the Pinecone namespace project:<id> contains vectors (verify via index stats)
- [ ] The extraction summary dialog renders the narrative and the "₹ L" formatted figures, and Reprocess re-runs the pipeline
- [ ] Documents are only readable through the signed route when signed in (direct Blob URL test fails)

**Verify by:** Upload `samples/sample-dpr.pdf` (ask the AI to generate a realistic 3-page sample DPR as part of this prompt), watch status transitions, then `curl "$PINECONE_INDEX_URL/describe_index_stats"` to confirm the vector count increased.

**Depends on:** 4 (project pages), 10 (Python service exists), 8 (LLM provider wrapper).

---

### Prompt 10: ML Prediction Engine (FastAPI, XGBoost, Prophet, Health Score)

**Goal:** Build the Python 3.12 FastAPI ML service with the 18-feature XGBoost delay model, budget forecasting, the weighted health score algorithm, synthetic training, a Dockerfile, and joblib packaging.

**Context to give the AI:**
ProjectAssure's intelligence layer is a standalone Python 3.12 FastAPI service living at `services/ml-service` in the monorepo (Docker Compose service `ml`, port 8000). The Next.js apps call it via ML_SERVICE_URL. Health score weights are fixed: schedule 0.30, budget 0.25, resources 0.20, milestones 0.25. This service must be fully independent of Node — pure Python, pydantic v2, deterministic seeds.

**The Prompt:**
```
Build the ML prediction service. Requirements:

1. FastAPI app (port 8000) with CORS allowing http://localhost:3000-3002 and the three *.vercel.app domains, pydantic v2 request/response models, and /health returning {status, model_version, features_expected: 18}.
2. POST /predict/delay — XGBoost regressor over EXACTLY these 18 features, in this order:
   taskCompletionRate, milestoneAdherence, daysBehindSchedule, budgetUtilisationRate, burnVelocity, resourceUtilisationAvg, milestoneOverdueCount, taskBlockedCount, scopeChangeCount, approvalDelayDays, materialDelayDays, weatherRiskDays, vendorCount, teamSize, dependentProjectCount, progressVelocity, budgetSpentRatio, projectAgeDays.
   Train on 5000 synthetic projects with realistic distributions: budgets log-normal across 10-5000 lakh, durations 6-36 months, delay target correlated with (low milestoneAdherence, high daysBehindSchedule, high burnVelocity) plus noise, some intentional outliers. Save the fitted model + feature order to models/delay_model.joblib via joblib. Print MAE and RMSE on a 20% holdout; require MAE < 15 days or warn loudly. Training script: scripts/train.py, reproducible with seed 42.
3. POST /predict/budget — given a project's monthly planned/actual series, forecast the next 6 months: use Prophet when available and a double-exponential-smoothing (statsmodels Holt) fallback that MUST be used when Prophet is not installed (so the service never 500s). Return the projected final cost, overrun %, and the monthly forecast series.
4. POST /calculate-health — weighted composite: schedule 0.30, budget 0.25, resources 0.20, milestones 0.25 where each dimension arrives as 0-100 and the composite is clipped to 0-100; return { healthScore, band: HEALTHY >= 70, AT_RISK 40-69, CRITICAL < 40, dimensions }.
5. GET /features/<projectId> style helper is NOT needed — the caller sends features; but provide GET /model-info returning feature names, importances, and training date.
6. Middleware: request logging with timing, a global exception handler returning {error}, and 422 responses from pydantic formatted cleanly.
7. Dockerfile: python:3.12-slim, non-root user, pip install -r requirements.txt (fastapi, uvicorn, xgboost, scikit-learn, pandas, numpy, joblib, prophet, statsmodels, httpx), COPY models, CMD uvicorn app.main:app --host 0.0.0.0 --port 8000. Add the ml service to the root docker-compose.yml with a healthcheck.
8. tests/test_health.py + tests/test_delay.py (pytest): health weights exact, delay endpoint returns numeric delay + confidence in [0,1], response time < 500ms for a single prediction (assert < 2s to stay CI-safe).
```

**Files this should create:**
- `services/ml-service/app/main.py`, `app/routers/predict.py`, `app/routers/health.py`, `app/core/config.py`, `app/core/logging.py`
- `services/ml-service/app/schemas/prediction.py` (pydantic models), `app/schemas/health.py`
- `services/ml-service/app/models/delay_model.py` (load/predict wrapper), `app/models/budget_forecast.py` (Prophet + Holt fallback)
- `services/ml-service/scripts/train.py`, `scripts/generate_synthetic.py`
- `services/ml-service/models/.gitkeep` (+ .joblib after training), `requirements.txt`, `Dockerfile`, `pytest.ini`, `tests/`
- root `docker-compose.yml` updated with the `ml` service

**Acceptance criteria:**
- [ ] `curl localhost:8000/health` returns status ok with features_expected: 18
- [ ] POST /predict/delay with a seeded project's features returns predictedDelayDays and confidence, and the same input always yields the same output (determinism)
- [ ] POST /calculate-health with dimensions (80, 50, 60, 70) returns exactly 0.30*80 + 0.25*50 + 0.20*60 + 0.25*70 = 65.5 and band AT_RISK
- [ ] Training prints MAE < 15 days on the holdout and the importances list is 18 items long
- [ ] /predict/budget returns a 6-month forecast and does NOT 500 when Prophet is uninstalled (Holt fallback path proven by temporarily commenting the import)
- [ ] `docker compose up ml` builds and serves with the healthcheck passing
- [ ] pytest suite is green

**Verify by:** `docker compose up ml -d`, then `curl -X POST localhost:8000/predict/delay -H "Content-Type: application/json" -d @services/ml-service/tests/fixtures/sample_features.json` (ask the AI to create the fixture) — response must include delay and confidence.

**Depends on:** 1.

---

### Prompt 11: Analytics Dashboard (Separate App)

**Goal:** Build the portfolio analytics app — department/sector/state views, budget analytics, trend analysis, and one-click CSV/PDF export — deployed separately at analytics.projectassure.vercel.app.

**Context to give the AI:**
`apps/analytics` is a standalone Next.js 15 App Router app (port 3001) in the ProjectAssure monorepo, sharing the same Prisma PostgreSQL database via `@projectassure/db` and the same NextAuth v5 secret for cross-domain SSO (session cookie domain configured for *.vercel.app in development of Prompt 13). It is strictly READ-ONLY: no mutations. Charts: Recharts for standard visuals, D3 for at least one custom visual; shadcn/ui chrome; Tailwind 4 design tokens.

**The Prompt:**
```
Build the analytics app. Requirements:

1. LAYOUT + NAV: shared header with app switcher links (Main app / Analytics), nav tabs: Portfolio, Budget, Trends. All pages are server components fetching via src/lib/queries/* with Prisma aggregations (groupBy, aggregate — no N+1). Revalidate 300s. Middleware requires a session (same NextAuth config as apps/web via a shared auth options module in packages/config or duplicated minimal config).
2. PORTFOLIO PAGE /portfolio:
   - Department comparison: horizontal grouped bar chart of average healthScore and total budget per department with count badges
   - Sector-wise distribution: treemap or donut of project count and budget share by sector
   - State-wise map: India choropleth using react-simple-maps with a topojson URL constant, colour scale on project count, tooltip with state name, project count, total budget; states without projects shown in neutral grey
   - Custom D3 visual: a bullet-style chart of top 10 projects by budget showing progress vs target
3. BUDGET PAGE /budget: planned vs actual monthly totals across the portfolio (composed chart: bars + lines), cost overrun analysis by category (diverging bar: negative overruns green, positive red), spending velocity chart (7-day rolling spend), and a table of the 10 highest-overrun projects with delta in lakhs.
4. TRENDS PAGE /trends: month-over-month average healthScore line with band shading, risk trajectory (count of AT_RISK + CRITICAL over time), and prediction accuracy chart comparing predictedDelayDays (Prediction rows) against actual delays where available.
5. EXPORT: every chart and table has an export menu — CSV generated by a reusable client util (correct headers, lakh formatting preserved) and PDF via the browser print pipeline (print stylesheet that hides chrome, sizes charts A4-landscape friendly) plus a server /api/export/pdf fallback using @react-pdf/renderer for the portfolio summary only.
6. Performance: charts are dynamically imported (next/dynamic, ssr false) to keep the initial bundle light; each page has loading.tsx skeletons.
7. Responsive to 768px; below that, the map degrades to a ranked state list.
```

**Files this should create:**
- `apps/analytics/src/app/layout.tsx`, `page.tsx` (redirect to /portfolio), `portfolio/page.tsx`, `budget/page.tsx`, `trends/page.tsx`, plus `loading.tsx` for each
- `apps/analytics/src/lib/queries/portfolio.ts`, `budget.ts`, `trends.ts`
- `apps/analytics/src/components/charts/department-comparison.tsx`, `sector-treemap.tsx`, `india-choropleth.tsx`, `project-bullets.tsx` (D3), `budget-composed.tsx`, `overrun-diverging.tsx`, `velocity-chart.tsx`, `health-trend.tsx`, `accuracy-chart.tsx`
- `apps/analytics/src/lib/export/csv.ts`, `apps/analytics/src/app/api/export/pdf/route.ts`
- `apps/analytics/src/middleware.ts`, `apps/analytics/src/auth.ts` (shared/parallel NextAuth config)
- `apps/analytics/src/app/print.css`

**Acceptance criteria:**
- [ ] All three pages render with correct numbers cross-checked against Prisma Studio aggregates
- [ ] The choropleth colours at least 10 states and tooltips show state, count, and budget
- [ ] CSV export downloads a file whose row count and totals match the visible table
- [ ] PDF export produces a clean A4-landscape document without nav chrome
- [ ] Signing in on apps/web gives a working session on apps/analytics (shared secret, same cookie domain locally via localhost)
- [ ] No write operations exist: grep confirms no mutation calls in apps/analytics
- [ ] Initial JS for /portfolio does not include chart libraries (dynamic import verified via build output)

**Verify by:** `pnpm dev --filter analytics`, open localhost:3001/portfolio, export the department table to CSV, and compare totals against `npx prisma studio`.

**Depends on:** 1, 2, 12.

> ### In Plain English
> You are halfway. Prompts 8-10 added the intelligence that separates ProjectAssure from a spreadsheet: a chat that queries real data through tools, documents that read themselves into the database, and a Python model that predicts delays and computes the health score. Rule of thumb from here: never build UI on top of an ML endpoint you have not curled successfully first. If the ML service is late, build the chat with getProjectSummary and getBudgetRecords tools only and add the prediction tool when the service is up — do not block the AI work on Python.

---

### Prompt 12: Database Seeding (Demo Story Data)

**Goal:** Create an idempotent, deterministic seeder that populates the database with a jury-ready demo story — 30 projects, milestones, tasks, budgets, resources, users, alerts — with deliberate at-risk and critical narratives.

**Context to give the AI:**
The ProjectAssure Prisma schema (packages/db) defines Organisation, Department, User (4 roles, bcrypt passwordHash), Project (healthScore plus four dimension scores), Milestone, Task (with dependsOn self-relation), BudgetRecord, ResourceAllocation, Alert, Notification, Document, Prediction. Seeding must produce data whose numbers are internally consistent — a CRITICAL project must genuinely have overdue milestones, high budget utilisation, and an over-allocated resource — because the AI chat and analytics will surface these links live on stage.

**The Prompt:**
```
Write packages/db/prisma/seed.ts (runnable via pnpm db:seed, tsx execution). Requirements:

1. ORGANISATION + DEPARTMENTS: 1 organisation "Ministry of Statistics and Programme Implementation (MoSPI)"; 5 departments: Infrastructure, Health, Education, Defence, Digital Governance — each with a code (INF, HLT, EDU, DEF, DIG).
2. USERS: exactly 4 — admin@demo.in (ADMIN), pm@demo.in (PROJECT_MANAGER), stakeholder@demo.in (STAKEHOLDER), viewer@demo.in (VIEWER), all password Demo@1234 with bcrypt hash 12 rounds, Indian names, distributed across departments.
3. PROJECTS: 30 total (6 per department) with realistic Indian government names ("National Highway Expansion Phase III", "District Hospital Modernisation - North Block", "PM eVIDYA Digital Classroom Rollout", "Border Fence Surveillance Upgrade", "National Single Window Portal v2"). Fields: code P-101..P-130, budgets log-normal 10-5000 lakhs, startDate spread over the last 24 months, durations 6-36 months, progress consistent with elapsed time, sector and state drawn from realistic lists. Status mix: ~18 IN_PROGRESS, ~5 PLANNED, ~4 COMPLETED, ~2 ON_HOLD, ~1 CANCELLED.
4. HEALTH STORY: exactly 5 AT_RISK (healthScore 40-69) and 3 CRITICAL (< 40) projects; the rest HEALTHY (>= 70). For every non-healthy project, make the four dimension scores consistent with reality: if scheduleHealth is 35, at least one milestone must be DELAYED by a matching margin; if budgetHealth is 30, spentBudget must exceed pro-rata plan; if resourceHealth is 40, include a resource above 90% utilisation. Pick one flagship CRITICAL project (P-104 recommended, "Smart City Integrated Command Centre") as the demo centrepiece: 68% budget used at 55% timeline, two BLOCKED tasks, one 95%-utilised equipment resource, and a 22-day predicted delay.
5. MILESTONES: 3-7 per project with statuses mixed to match the story; delayed ones have actualEnd beyond plannedEnd by 5-45 days.
6. TASKS: 5-15 per milestone with assignees (any of the 4 users plus 6 synthetic team users), statuses matching milestone progress, and dependency chains — at least 3 projects must have a 4+ task critical chain that the critical path algorithm will find.
7. BUDGET RECORDS: 6 months of history per active project, monthly planned rising smoothly, actuals deviating -10% to +35%; at-risk projects trend over plan, healthy ones under.
8. RESOURCES: 4-8 per project across HUMAN/EQUIPMENT/MATERIAL with utilisation 40-98%; include 2-3 resources above 90% (bottleneck demo).
9. ALERTS + PREDICTIONS: for each non-healthy project, 3-6 historical alerts (severity matching the story, some acknowledged) and one Prediction row from the delay model (predictedDelayDays consistent with the story: flagship CRITICAL ~22 days, confidence 0.7-0.92).
10. DETERMINISM + IDEMPOTENCE: fixed seed for any randomness (seeded PRNG, not Math.random), deleteMany in reverse dependency order before inserting, total runtime under 60 seconds, and console output summarising counts per table at the end.
11. Add npm script db:reset = prisma migrate reset --force && seed, used on demo day.
```

**Files this should create:**
- `packages/db/prisma/seed.ts`, `packages/db/prisma/factories/` (`project.factory.ts`, `milestone.factory.ts`, `task.factory.ts`, `budget.factory.ts`, `resource.factory.ts`, `alert.factory.ts`, `user.factory.ts`)
- `packages/db/prisma/story.ts` (the at-risk/critical narrative definitions)
- root `package.json` script additions (`db:seed`, `db:reset`)

**Acceptance criteria:**
- [ ] `pnpm db:reset` completes in under 60 seconds and ends with a counts summary (30 projects, 4 users)
- [ ] admin@demo.in / Demo@1234 logs in with ADMIN role
- [ ] The flagship CRITICAL project shows overdue milestones, > 60% budget used, and a > 90% resource on its detail page
- [ ] The executive dashboard shows 5 AT_RISK and 3 CRITICAL with a plausible distribution
- [ ] The bottleneck panel lists the seeded over-allocated resources with delay estimates
- [ ] Running the seeder twice in a row produces identical data (deterministic, no duplicates)
- [ ] The critical path algorithm finds the seeded 4+ task chain on at least 3 projects

**Verify by:** `pnpm db:reset`, then walk the flagship project page end to end and confirm the story numbers match `story.ts`.

**Depends on:** 1.

---

### Prompt 13: Production Deployment (Vercel + Neon + Upstash)

**Goal:** Deploy all three Next.js apps and the Python ML service — Vercel for the apps, Neon Postgres, Upstash Redis, Gmail SMTP — and verify cross-domain auth, migrations, and seeded data.

**Context to give the AI:**
ProjectAssure deploys as: three Vercel projects from one GitHub monorepo — web (projectassure.vercel.app), analytics (analytics.projectassure.vercel.app), ai-engine (ai.projectassure.vercel.app) — plus the Python ML service on a free container host (Render or Railway). Data: Neon PostgreSQL 16 (pooled connection string), Upstash Redis, Gmail SMTP App Password, NextAuth v5 JWT with a shared NEXTAUTH_SECRET so sessions work across the three domains. Environment validation from Prompt 16 must pass in production.

**The Prompt:**
```
Guide the production deployment step by step and generate every config file needed. Requirements:

1. VERCEL SETUP: instructions to create three projects from the monorepo, each with Root Directory apps/web | apps/analytics | apps/ai-engine and the pnpm + turborepo build command (turbo run build --filter=web... etc). Provide vercel.json per app if needed. Domain assignments: projectassure.vercel.app, analytics.projectassure.vercel.app, ai.projectassure.vercel.app.
2. NEON: create a project, copy BOTH connection strings (pooled with -pooler for the app, direct for migrations as DIRECT_URL), and run prisma migrate deploy from packages/db locally against production (never migrate dev on prod).
3. ENV MATRIX: produce a table mapping every variable from .env.example to the exact Vercel project(s) needing it:
   - All three: DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET (same value everywhere), NEXTAUTH_URL (per-domain), REDIS_URL, ML_SERVICE_URL
   - web: SMTP_HOST/USER/PASSWORD, ALERT_EMAIL_FROM, BLOB_READ_WRITE_TOKEN, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_ANALYTICS_URL, NEXT_PUBLIC_AI_URL
   - ai-engine: OPENAI_API_KEY, GEMINI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX_URL
   - analytics: NEXT_PUBLIC_APP_URL
4. UPSTASH: free Redis instance; copy the rediss:// URL to all three projects; confirm TLS (rediss) is used.
5. NEXTAUTH CROSS-DOMAIN: document the cookie reality — vercel.app subdomains share cookies only when set explicitly; provide the Auth.js trustedDomains + cookie domain configuration and a fallback note (if cross-domain cookies are blocked on vercel.app, sign in per-domain for the demo; custom domains would fix it). Each app gets its own NEXTAUTH_URL.
6. GMAIL SMTP: step-by-step App Password creation (2FA required) and the exact env values.
7. ML SERVICE on Render/Railway: Dockerfile deploy, ML_SERVICE_URL env on all Vercel apps pointing at the public service URL, /health check, and CORS updated to the three production domains.
8. SEED PROD: run the seeder against Neon (one command, explicit confirmation), or a restricted seed script variant that skips synthetic team users.
9. POST-DEPLOY CHECKLIST script scripts/verify-deployment.sh: curl each domain (expect 200), curl ML /health, attempt a login against each domain, and print a pass/fail table.
10. Rollback notes: how to promote a previous Vercel deployment instantly.
```

**Files this should create:**
- `vercel.json` (x3 or a root config), `apps/*/next.config.ts` updates (output, standalone if used)
- `docs/DEPLOYMENT.md` (the full runbook written from this prompt)
- `scripts/verify-deployment.sh`
- `.github/workflows/deploy.yml` (optional CI: lint + test + migrate deploy + vercel deploy hooks)

**Acceptance criteria:**
- [ ] All three domains return the app (200) and the ML /health endpoint passes
- [ ] Login works on every domain with the same credentials
- [ ] An alert fired in production produces both an in-app notification and an email
- [ ] The AI chat answers on production using GPT-4o with the ML prediction tool working
- [ ] Analytics pages show the seeded production data
- [ ] No secrets in the client bundle (check the built JS for OPENAI/PINECONE keys)
- [ ] scripts/verify-deployment.sh prints an all-pass table

**Verify by:** Run `bash scripts/verify-deployment.sh` and open all three domains in incognito, logging in on each.

**Depends on:** 12, 16, plus everything user-facing (2-11) being stable.

---

### Prompt 14: Automated Testing Suite (Vitest + RTL + Playwright)

**Goal:** Stand up a fast unit/component layer (Vitest + React Testing Library) and a Playwright smoke suite that proves login, dashboard, and the critical path work before every demo.

**Context to give the AI:**
ProjectAssure is a Turborepo monorepo with apps/web (Next.js 15 + shadcn/ui + Framer Motion) and packages/types (pure logic: health score weights, critical path, bottleneck heuristics — ideal unit-test targets). Tests run through turbo (`pnpm test`), Playwright runs against a locally seeded database (`pnpm db:reset && pnpm dev`). No Jest — Vitest everywhere for speed and ESM friendliness.

**The Prompt:**
```
Build the testing suite. Requirements:

1. VITEST setup: root vitest.workspace.ts; per-package configs. jsdom environment for component tests, node for logic. Scripts: pnpm test (watch), pnpm test:run (CI), pnpm test:coverage.
2. UNIT TESTS for pure logic (highest value):
   - packages/types: health score composite equals 0.30/0.25/0.20/0.25 weights exactly; band boundaries (69.9 -> AT_RISK, 70 -> HEALTHY); bottleneck delay heuristic at utilisation 91, 95, 100
   - src/lib/critical-path.ts: finds the longest chain on a fixture graph; returns empty on a cycle-free single task; tolerates disconnected components
   - src/lib/budget projections: burn-rate extrapolation matches a hand-computed case
   - date/relative-time utils used across the UI
3. COMPONENT TESTS (React Testing Library) in apps/web:
   - KPI card renders the value and formats large numbers (lakh formatting)
   - Project table sorts by health score and filters by status
   - Kanban card calls the API on drag (mock) and rolls back on failure
   - Notification bell shows the unread count and opens the panel
   Use shadcn components directly; mock Framer Motion with reduced motion to avoid jsdom animation issues.
4. API ROUTE TESTS: /api/projects GET (auth mocked per role: VIEWER 200 read, POST 403), budget record POST rejects negative amounts with 422 — hit real route handlers with NextRequest fixtures and a mocked Prisma (or a local test database; choose one and stay consistent).
5. PLAYWRIGHT smoke (tests/e2e/smoke.spec.ts) against a locally running seeded app:
   - login as admin@demo.in -> lands on /dashboard
   - KPI cards visible; click the first project row -> detail page renders the four health cards
   - open Kanban -> drag the first card (use page.dragAndDrop) -> reload -> state persisted
   - open AI chat FAB -> send "Why is this project at risk?" -> assistant message appears (stub the network route to a recorded response so the test needs no API keys)
   playwright.config.ts: baseURL localhost:3000, retries 1, trace on retry, webServer command that boots the dev server.
6. Wire everything into turbo.json (test pipeline depends on ^build) and add a pre-demo checklist script pnpm test:all = test:run + test:e2e.
```

**Files this should create:**
- `vitest.workspace.ts`, `packages/types/vitest.config.ts`, `apps/web/vitest.config.ts`, `apps/web/vitest.setup.ts`
- `packages/types/src/__tests__/health-score.test.ts`, `bottleneck.test.ts`
- `apps/web/src/lib/__tests__/critical-path.test.ts`, `budget-projection.test.ts`
- `apps/web/src/components/__tests__/kpi-card.test.tsx`, `project-table.test.tsx`, `kanban-card.test.tsx`, `notification-bell.test.tsx`
- `apps/web/src/app/api/__tests__/projects.route.test.ts`, `budget.route.test.ts`
- `tests/e2e/smoke.spec.ts`, `playwright.config.ts`, `tests/e2e/fixtures/chat-stub.json`
- `turbo.json` + root `package.json` script updates

**Acceptance criteria:**
- [ ] `pnpm test:run` is green with at least 20 unit/component tests
- [ ] The health score test pins the exact weights and would catch any accidental change
- [ ] `pnpm test:e2e` boots the server itself and the full smoke passes headless
- [ ] The chat e2e step works with no API keys present (recorded stub)
- [ ] Deliberately breaking the health weight (0.3 -> 0.5) makes the suite fail, proving the tests bite
- [ ] Full suite runs in under 2 minutes on a laptop

**Verify by:** `pnpm test:all` — unit + e2e all green locally after a fresh `pnpm db:reset`.

**Depends on:** 1, 2, 3, 4, 5, 12.

---

### Prompt 15: Error Handling & Structured Logging

**Goal:** Add a global error boundary system, a consistent API error envelope with codes, and structured request-scoped logging so no failure is ever a blank screen or an unexplained 500.

**Context to give the AI:**
`apps/web` and `apps/analytics` are Next.js 15 App Router apps in the ProjectAssure monorepo with server actions and route handlers; `@projectassure/db` Prisma can throw P2002/P2025 and Zod throws structured issues. The UI design system is shadcn/ui + Tailwind 4. Requirement: production users see friendly branded errors with a request id; developers see structured JSON logs they can grep.

**The Prompt:**
```
Implement app-wide error handling and logging. Requirements:

1. ERROR BOUNDARIES: app/error.tsx (route segment level) and app/global-error.tsx (root) with the ProjectAssure branding: icon, message, the error's request id (or digest), a Try again button calling reset(), and a Report issue mailto link. not-found.tsx with helpful links back to /dashboard. loading.tsx skeletons already exist — audit and add any missing ones.
2. API ERROR ENVELOPE: every route handler and server action returns { success: true, data } or { success: false, error: { code, message, details?, requestId } } with the code enum: VALIDATION_ERROR (422), UNAUTHENTICATED (401), FORBIDDEN (403), NOT_FOUND (404), CONFLICT (409, Prisma P2002), RATE_LIMITED (429), INTERNAL (500). Build src/lib/api/handler.ts with withApiHandler(fn) that: catches, maps Zod errors to VALIDATION_ERROR with field details, maps known Prisma errors, generates a requestId (crypto.randomUUID), logs structured JSON, and never leaks stack traces or DB error text to the client in production. Refactor ALL existing route handlers to use it.
3. SERVER ACTIONS: a wrapper withActionHandler with the same semantics that returns a serialisable result object instead of throwing, so client components can toast cleanly.
4. STRUCTURED LOGGING: src/lib/logger.ts — a pino-based (or zero-dependency wrapper) logger with levels, child loggers bound to { requestId, module, userId?, projectCode? }, and JSON output in production / pretty console output in development. Log every API request: method, path, status, duration_ms, requestId. Middleware sets the x-request-id header if absent and makes it available to handlers.
5. CLIENT TOASTS: map the error envelope to shadcn sonner toasts — validation errors show the first field message, FORBIDDEN shows a role hint, INTERNAL shows "Something went wrong — request <id>". A single fetchJson client helper does this everywhere (no raw fetch in components).
6. PRISMA RESILIENCE: wrap the singleton with retry-on-connection-error (3 attempts, exponential backoff) for cold starts on Neon.
7. Add a dev-only /error-test page with buttons that trigger each error type to demo the behaviour.
```

**Files this should create:**
- `apps/web/src/app/error.tsx`, `apps/web/src/app/global-error.tsx`, `apps/web/src/app/not-found.tsx`, `apps/web/src/app/error-test/page.tsx`
- `apps/web/src/lib/api/handler.ts`, `apps/web/src/lib/api/error-codes.ts`, `apps/web/src/lib/api/fetch-json.ts`
- `apps/web/src/app/actions/wrapper.ts`
- `apps/web/src/lib/logger.ts`, `apps/web/src/middleware.ts` (request id injection)
- `apps/web/src/lib/db-retry.ts` (or inside packages/db)
- mirrored handler/logger files in `apps/analytics` and `apps/ai-engine`

**Acceptance criteria:**
- [ ] Throwing in a page renders the branded boundary with a working Try again (verify on /error-test)
- [ ] Every API endpoint returns the envelope shape — no naked exceptions anywhere (spot-check 5 endpoints)
- [ ] A Zod failure returns 422 with per-field details and does not log the word "stack" in production mode
- [ ] Server logs show one JSON line per request with requestId, path, status, and duration
- [ ] The requestId from a failed API call appears in the UI error toast and matches the server log line
- [ ] A VIEWER hitting POST /api/projects receives FORBIDDEN with code FORBIDDEN and a role hint toast

**Verify by:** `curl -s localhost:3000/api/projects -X POST | jq` shows the envelope with code FORBIDDEN; visit /error-test, click each button, confirm branded screens and matching log lines.

**Depends on:** 2, 4 (retrofits existing routes and actions).

> ### In Plain English
> Prompts 14-16 are the ones nobody cheers for on stage and everybody thanks at 3 a.m. The test suite catches the edit you made at midnight that broke login; the error envelope turns random crashes into readable messages; the env validator stops the classic "works on my machine" deployment failure. Timebox each to its slot in the timeline and resist expanding scope — a 20-test suite that runs is worth more than an 80-test suite that is half-written when the demo starts.

---

### Prompt 16: Environment Variable Validation (Fail-Fast Zod Schema)

**Goal:** Validate every environment variable at startup with Zod per app, so a missing or malformed variable produces a readable named error instead of a mystery 500 in production.

**Context to give the AI:**
The ProjectAssure monorepo shares configuration through `packages/config`; three Next.js apps each need different subsets of DATABASE_URL, NEXTAUTH_*, REDIS_URL, SMTP_*, OPENAI_API_KEY, GEMINI_API_KEY, PINECONE_*, BLOB_READ_WRITE_TOKEN, ML_SERVICE_URL, and NEXT_PUBLIC_* URLs, and the Python service needs none of these but documents its own port. Next.js 15 supports `instrumentation.ts` for startup code. Vercel builds must fail loudly when a NEXT_PUBLIC variable is missing.

**The Prompt:**
```
Implement fail-fast environment validation. Requirements:

1. packages/config/src/env.ts: export a createEnv(schema, source) factory that parses the given record with the Zod schema and, on failure, prints a formatted table (variable, problem, expected example) and throws with process.exit(1) semantics. Never log actual secret values — names only.
2. Per-app schemas (apps/web/src/env.ts, apps/analytics/src/env.ts, apps/ai-engine/src/env.ts) with:
   - web: DATABASE_URL (url), DIRECT_URL (url), NEXTAUTH_SECRET (min 32 chars), NEXTAUTH_URL (url), REDIS_URL (url starting rediss:// or redis://), SMTP_HOST, SMTP_USER, SMTP_PASSWORD, ALERT_EMAIL_FROM (email), BLOB_READ_WRITE_TOKEN, ML_SERVICE_URL (url), NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_ANALYTICS_URL, NEXT_PUBLIC_AI_URL (urls); SMTP_* optional in development with a warning
   - analytics: DATABASE_URL, DIRECT_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, NEXT_PUBLIC_APP_URL
   - ai-engine: DATABASE_URL, OPENAI_API_KEY, GEMINI_API_KEY (optional with fallback warning), PINECONE_API_KEY, PINECONE_INDEX_URL, ML_SERVICE_URL
   Export a typed frozen env object per app; all code reads env.* instead of process.env.* (except next.config and instrumentation).
3. STARTUP CHECK: apps/*/src/instrumentation.ts calls the validation on server start so `pnpm dev` fails immediately with the readable table; next.config.ts validates NEXT_PUBLIC_* at build time so a Vercel build fails before deploy.
4. TYPE SAFETY: the env object's types are inferred from the Zod schema (z.infer) — no `as string` casts anywhere.
5. Update .env.example to mirror the schemas exactly (same names, same order, comments including which app needs what and where to obtain each value: Neon dashboard, Upstash console, Google AI Studio, Pinecone console, Vercel Blob storage tab, Gmail App Password).
6. Add a pnpm check:env script that validates all three schemas against the current environment and prints a green summary — used in the deployment checklist.
```

**Files this should create:**
- `packages/config/src/env.ts`, `packages/config/src/env-schemas.ts` (shared field definitions)
- `apps/web/src/env.ts`, `apps/analytics/src/env.ts`, `apps/ai-engine/src/env.ts`
- `apps/web/src/instrumentation.ts` (+ analytics, ai-engine)
- `apps/*/next.config.ts` build-time checks
- `.env.example` (updated), root `package.json` `check:env` script

**Acceptance criteria:**
- [ ] Renaming DATABASE_URL temporarily makes `pnpm dev` stop instantly with a table naming the variable and an example format
- [ ] A NEXTAUTH_SECRET shorter than 32 chars is rejected with a clear message
- [ ] With all variables present, startup is clean and a green summary prints via pnpm check:env
- [ ] All code accesses env.* with full TypeScript inference (grep: process.env only in env files, next.config, instrumentation)
- [ ] Removing a NEXT_PUBLIC_* variable fails the production build, not just runtime
- [ ] Optional variables (SMTP in dev, GEMINI) warn but do not crash local development

**Verify by:** `mv .env .env.bak && pnpm dev` (expect the readable failure table), then `mv .env.bak .env && pnpm check:env` (expect green).

**Depends on:** 1.

---

### Prompt 17: Performance Optimisation Pass

**Goal:** Cut initial payload and interaction cost — memoisation, code splitting, virtualised tables, and Prisma query optimisation — so the dashboard hits Lighthouse 80+ on a hackathon laptop.

**Context to give the AI:**
`apps/web` is a Next.js 15 App Router app whose heaviest pages are the executive dashboard (Recharts donut + radial gauge + Framer Motion counters) and the project detail page (Gantt SVG + several charts). Data flows through server components into `@projectassure/db` Prisma queries in `src/lib/queries/*`. Tables use TanStack Table; the Kanban uses @dnd-kit. Target: Lighthouse performance >= 80 mobile / 90 desktop on /dashboard with 30 seeded projects, and no visible jank when dragging tasks.

**The Prompt:**
```
Optimise apps/web performance. Requirements:

1. QUERY OPTIMISATION (do this first, biggest win):
   - Audit src/lib/queries/dashboard.ts: replace any loop-based fetching with ONE aggregate query set — prisma.project.groupBy for status/health counts plus a single aggregate for budget sums; prove the improvement by enabling Prisma query logging before/after and noting the count.
   - Add select clauses everywhere so only rendered fields cross the wire; add include only where child rows render.
   - Add @@index migrations for the hot filters: Project(status), Project(healthStatus), Project(departmentId), Task(milestoneId), BudgetRecord(projectId, month), Alert(projectId, severity).
   - Dashboard total query count must be <= 3 (log the proof).
2. CODE SPLITTING: next/dynamic (ssr: false) for Recharts wrappers, the Gantt timeline, the dependency graph, the Kanban board, and the chat panel so heavy libs never enter the initial bundle of pages that do not show them; verify via @next/bundle-analyzer that recharts/d3/dnd-kit are absent from routes that do not use them.
3. RENDER COST: React.memo on KPI card, table row, task card, notification row; useMemo for chart data transforms; useCallback for handlers passed into lists. Framer Motion: use `transform`-only animations, avoid animating layout-affecting properties in lists, and lazy-mount off-screen sections (whileInView already used — keep viewport: { once: true, margin }).
4. VIRTUALISATION: TanStack Virtual on any table/list that can exceed 100 rows (project list with search, alert history) — render only the visible window; keep pagination for the demo table so scroll position is stable on stage.
5. ASSETS + LOADING: next/image with explicit sizes for every image; next/font with Inter subsets latin only; consistent loading.tsx skeletons (already present) sized to final layout to avoid CLS; defer non-critical third-party scripts.
6. MEASUREMENT: add a scripts/lighthouse.mjs that runs Lighthouse against /dashboard and /dashboard/projects and fails under the thresholds (80 mobile / 90 desktop perf); record before/after numbers in docs/PERFORMANCE.md with the query-count evidence.
```

**Files this should create:**
- `apps/web/src/lib/queries/dashboard.ts` (optimised), migration files for the new indexes
- `apps/web/src/components/dashboard/*` (memo wrappers), `apps/web/src/components/projects/detail/gantt-timeline.tsx` (dynamic import wrapper)
- `apps/web/src/hooks/use-virtual-table.ts`
- `apps/web/next.config.ts` (bundle analyzer flag), `scripts/lighthouse.mjs`, `docs/PERFORMANCE.md`

**Acceptance criteria:**
- [ ] Dashboard page executes at most 3 Prisma queries per load (query log evidence saved)
- [ ] Lighthouse mobile performance on /dashboard is >= 80 with 30 seeded projects
- [ ] Recharts, d3, and dnd-kit do not appear in the initial JS of routes that do not render them
- [ ] Scrolling the project list stays smooth at 60fps with 100+ rows (virtualised or paginated)
- [ ] No layout shift when charts finish loading (CLS < 0.1 in the Lighthouse report)
- [ ] docs/PERFORMANCE.md contains before/after numbers for bundle size, query count, and Lighthouse

**Verify by:** `node scripts/lighthouse.mjs` (must pass thresholds) and inspect the Prisma query log during a dashboard load.

**Depends on:** 3, 4, 11 (optimising what exists).

---

### Prompt 18: Accessibility Pass (WCAG 2.1 AA)

**Goal:** Make every demo-critical surface keyboard navigable, screen-reader labelled, and contrast-correct so the accessibility portion of the jury rubric is defensible.

**Context to give the AI:**
`apps/web` pages that matter for the demo: /dashboard (KPI cards, charts, alerts panel, ranking table), project detail (Gantt, health rings, dialogs), Kanban board (@dnd-kit drag-and-drop), and the AI chat panel (slide-in, focus loss risk). Design system colours: #4F46E5 primary, #10B981 / #F59E0B / #EF4444 semantic, slate greys for text on white. Framer Motion animations are everywhere. Target: axe DevTools reports zero critical violations on all demo pages, and full keyboard operability.

**The Prompt:**
```
Perform an accessibility pass across apps/web. Requirements:

1. KEYBOARD NAVIGATION: add a skip-to-content link as the first focusable element on every page; verify a logical tab order on /dashboard and project detail (header -> filters -> main content -> table); all interactive elements have visible focus (focus-visible ring-2 ring-indigo-500 ring-offset-2); modals and dialogs (task modal, chat panel, alert dialogs) trap focus while open, restore focus to the trigger on close, and close on Escape.
2. CHART ACCESSIBILITY: every Recharts/D3/SVG visual gets role="img" and an aria-label that summarises the data in words ("Health distribution: 22 healthy, 5 at risk, 3 critical"); add visually-hidden data tables for the donut and gauge so screen readers get exact numbers; the Gantt timeline gets an accessible list alternative (a collapsed "Milestone schedule as list" details element).
3. KANBAN KEYBOARD ALTERNATIVE: dnd-kit's keyboard sensor enabled (Space to lift, arrows to move, Space to drop) AND a per-card overflow menu with explicit "Move to In Progress" actions for users who cannot drag; both paths produce the same API call.
4. ARIA STRUCTURE: notification bell is a button with aria-label ("Notifications, 3 unread") and aria-expanded on the panel; live region (aria-live="polite") announces new notifications and chat responses; status badges pair colour with text (never colour alone); the ranking table has proper <th scope> headers and aria-sort on the sorted column.
5. CONTRAST FIXES: audit and fix to WCAG AA (4.5:1 normal text, 3:1 large text/UI): badge text colours on tinted backgrounds (amber/red/green tints often fail — darken text or darken the badge), muted grey text on white cards, placeholder text, and the indigo primary on white for small text; document every change in the PR description.
6. FORMS: every input has a real <Label htmlFor>; errors use aria-describedby + aria-invalid; the multi-step wizard announces step changes ("Step 2 of 4: Budget").
7. MOTION: honour prefers-reduced-motion globally — a MotionConfig reducedMotion="user" wrapper plus CSS @media fallback that disables count-ups, slide-ins, and page transitions.
8. AUTOMATE: add eslint-plugin-jsx-a11y to the ESLint config and a vitest axe check (vitest-axe) on the dashboard and project detail components so regressions fail CI.
```

**Files this should create:**
- `apps/web/src/app/layout.tsx` (skip link + MotionConfig), `apps/web/src/components/a11y/skip-link.tsx`, `visually-hidden-table.tsx`
- `apps/web/src/components/tasks/kanban-board.tsx` (keyboard sensor + move menu), `task-card-menu.tsx`
- `apps/web/src/components/dashboard/*` (aria labels + hidden tables), `chat-panel.tsx` (focus trap + live region)
- `apps/web/src/lib/a11y/chart-summary.ts` (label text builders)
- `eslint.config.mjs` update, `apps/web/src/components/__tests__/a11y.test.tsx`
- `docs/ACCESSIBILITY.md` (audit results and fixes log)

**Acceptance criteria:**
- [ ] axe DevTools reports zero critical violations on /dashboard, project detail, board, and chat
- [ ] The entire demo path (login -> dashboard -> project -> Kanban -> chat) is completable with keyboard only
- [ ] All chart data is available to a screen reader via aria-labels or hidden tables
- [ ] Every badge passes 4.5:1 contrast (check amber and red tints specifically)
- [ ] Modals trap focus, close on Escape, and return focus to their trigger
- [ ] With reduced motion enabled, no count-ups or slide-ins animate
- [ ] The a11y vitest checks and eslint-plugin-jsx-a11y are wired into pnpm test and pnpm lint

**Verify by:** Tab through /dashboard and the Kanban with a screen reader (or at minimum axe + manual keyboard walk), and re-run axe until clean.

**Depends on:** 3, 4, 5, 8.

---

### Prompt 19: README & Documentation Generation

**Goal:** Generate a jury-grade repository README plus setup, architecture, and operations docs — written from the actual code, accurate enough that a fresh clone runs on the first try.

**Context to give the AI:**
The ProjectAssure monorepo is complete at this point: three Next.js 15 apps (web/analytics/ai-engine), packages (ui/db/types/config), services/ml-service (FastAPI), docker-compose with Postgres 16 + Redis 7 + ML, Prisma schema, pnpm scripts (dev, build, test, db:reset, check:env), and deployment documented in docs/DEPLOYMENT.md. The README is the first thing SIH evaluators open — it must show the PS ID, the stack, and a working quickstart in under 5 minutes.

**The Prompt:**
```
Generate the documentation set. Read the actual repository files first and document what EXISTS — do not invent scripts or features. Requirements:

1. ROOT README.md with these sections in order:
   - Title + one-line pitch: "ProjectAssure — AI-powered project portfolio monitoring and delay prediction for MoSPI (Smart India Hackathon 2026, PS ID SIH26103)"
   - Badges-style info block (no external badge images needed): Theme Smart Automation, Category Software, Organisation MoSPI
   - What it does: 5 bullets (executive dashboard, milestone/task tracking with critical path, budget + bottleneck analysis, ML delay prediction + health scoring, agentic AI assistant with document RAG)
   - Architecture: mermaid diagram — browser -> apps/web <-> packages/db -> Postgres; apps/ai-engine -> OpenAI/Gemini/Pinecone; services/ml-service (XGBoost/Prophet) called via ML_SERVICE_URL; Socket.io + Upstash Redis; Vercel Blob
   - Monorepo layout: the apps/ packages/ services/ tree with one-line descriptions
   - Quickstart (verified commands only): prerequisites (Node 20, pnpm 9, Docker); then: pnpm install; cp .env.example .env (fill list); docker compose up -d; pnpm db:migrate; pnpm db:seed; pnpm dev — with the three URLs and demo logins (admin@demo.in / Demo@1234)
   - Scripts table: every root package.json script with what it does
   - Environment variables table: name, app(s), required/optional, where to get it
   - Testing: pnpm test:all explanation
   - Demo: link to docs/DEMO_SCRIPT.md
   - License + team credit line (Amrita Vishwa Vidyapeetham, Chennai Campus)
2. docs/SETUP.md: deeper setup — troubleshooting for common failures (Docker not running, port conflicts, pnpm version, Neon connection pooling note, Gmail App Password steps), and the ML training step (how to run scripts/train.py and where the joblib file lands).
3. docs/ARCHITECTURE.md: data flow walkthrough of one user action (Kanban drag -> API -> Prisma -> Socket.io broadcast -> notification), the health score formula with weights, the 18 ML features list, the RAG flow, and the RBAC matrix.
4. Package-level README stubs (packages/ui, packages/db, packages/types, packages/config, services/ml-service): 5-10 lines each — purpose, how to import/use, key exports.
5. Consistency pass: every command in the docs must exist in package.json files; every env var in the tables must exist in .env.example; links between docs resolve.
```

**Files this should create:**
- `README.md` (root), `docs/SETUP.md`, `docs/ARCHITECTURE.md`
- `packages/ui/README.md`, `packages/db/README.md`, `packages/types/README.md`, `packages/config/README.md`, `services/ml-service/README.md`
- `docs/` cross-links (DEPLOYMENT.md and DEMO_SCRIPT.md referenced, created by Prompts 13 and 20)

**Acceptance criteria:**
- [ ] A teammate can go from clone to running app using ONLY the README quickstart (actually test this)
- [ ] The mermaid architecture diagram matches the real service topology and renders on github.com
- [ ] Every script in the README's table exists in package.json; every env var exists in .env.example
- [ ] The health score weights and 18 features in docs/ARCHITECTURE.md match the code exactly
- [ ] Demo logins documented work against a fresh seed
- [ ] No placeholder text ("TODO", "lorem") anywhere in the docs

**Verify by:** In a clean directory: `git clone <repo> && pnpm install && docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev` following only the README — all three apps must run.

**Depends on:** 1, 13, 16 (so scripts, deployment, and env docs are final).

---

### Prompt 20: Demo-Day Rehearsal Script Builder

**Goal:** Generate the complete 8-minute demo package — a beat-by-beat script with fallbacks, a backup video checklist, a dataset reset command, and jury Q&A prep — and pressure-test it.

**Context to give the AI:**
ProjectAssure is feature-complete and deployed (projectassure.vercel.app + analytics + ai subdomains) with the seeded story data from Prompt 12 (flagship CRITICAL project P-104 "Smart City Integrated Command Centre", 5 AT_RISK, 3 CRITICAL). SIH demo slots are tight: assume 8 minutes of talking plus jury questions. Every live action must have a fallback line if it loads slowly, and the team must be able to reset the dataset between rehearsals in under 2 minutes.

**The Prompt:**
```
Generate the demo-day package from the actual app. Requirements:

1. docs/DEMO_SCRIPT.md — an 8-minute script table with columns: Time, Beat, URL/Screen, Exact actions (click-level), Talking point (1-2 sentences, speaker-ready), Fallback if slow/fails. Beats:
   - 0:00-0:45 Problem + PS framing: MoSPI monitors thousands of central projects; delays cost crores; spreadsheets cannot predict. One sentence on what the judges are about to see.
   - 0:45-1:30 Login as admin@demo.in -> Executive Dashboard: narrate the four KPI cards, health donut, and the 5+3 risk split from the seed story.
   - 1:30-2:45 Drill into P-104 (flagship CRITICAL): health dimension cards, Gantt with the red overdue milestone, alert history.
   - 2:45-4:00 Kanban: drag the blocked task to In Progress, show the optimistic UI, then open the dependency graph and point at the red critical path.
   - 4:00-5:15 Budget page: stacked planned-vs-actual, the projected-overrun callout, and the bottleneck panel with the 95% equipment resource and its delay estimate.
   - 5:15-6:15 AI chat on P-104: click "Why is this project at risk?" — narrate the tool citations as they appear (DB -> ML -> docs) and read one grounded sentence of the answer.
   - 6:15-7:00 ML live: run a prediction for P-104 (or show the Prediction row + confidence) and explain the 18 features in one breath, weights 30/25/20/25.
   - 7:00-8:00 Analytics app switch: department comparison + state map, close with impact ("from hindsight to foresight") and the team line.
2. Fallback rules baked into the script: every live network action has a pre-loaded alternative tab or a narrated screenshot slide; if the ML service is down, show the stored Prediction row; if chat is slow, use the quick-action chip with the cached answer.
3. docs/BACKUP_VIDEO_CHECKLIST.md: a shot list for a screen-recorded backup video (same 8 beats, 8 minutes max, 1080p, mic check, no notifications visible, cursor highlighted), recording settings, file naming, offline storage on two devices + USB, and a "video recorded and verified" sign-off row per beat.
4. RESET COMMAND: document `pnpm db:reset` (migrate reset + seed) as the between-rehearsals reset with expected runtime (< 2 min), what it wipes, and a warning that it must NEVER run against production during the demo; add a `pnpm demo:preflight` script that checks: seeded counts correct, flagship project exists, ML /health ok, chat answers a canned question, all three domains reachable — prints a boarding-card style PASS table.
5. docs/QA_PREP.md: 10 likely jury questions with 30-second answers — data privacy of government records, model accuracy and validation, how it scales to real MoSPI volume, why XGBoost over deep learning, real-time mechanism, integration with existing MoSPI systems (OMMS), what is simulated vs real, security (RBAC, JWT, no secrets client-side), cost of running, and the 30-60-90 day roadmap.
6. DRY-RUN LOG: a table at the end of DEMO_SCRIPT.md to record two full timed run-throughs (time taken per beat, issues, fixes applied) — both must land in the 7:30-8:00 window before demo day.
```

**Files this should create:**
- `docs/DEMO_SCRIPT.md`, `docs/BACKUP_VIDEO_CHECKLIST.md`, `docs/QA_PREP.md`
- `scripts/demo-preflight.ts` + root `package.json` script `demo:preflight`
- Optional: `slides/demo-fallback-screens.pdf` placeholders referenced by the fallback column

**Acceptance criteria:**
- [ ] Two timed full run-throughs of the script land between 7:30 and 8:00 with the log filled in
- [ ] Every beat has a working fallback that was actually tested (turn off the ML service and try one)
- [ ] The backup video is recorded, watched end-to-end, and stored on two devices plus USB
- [ ] `pnpm demo:preflight` prints an all-pass table on the demo laptop
- [ ] `pnpm db:reset` restores the exact demo story in under 2 minutes (timed)
- [ ] The Q&A doc covers all 10 questions with answers a teammate can deliver without reading
- [ ] The script references only URLs and project codes that exist in the seeded data

**Verify by:** Run the full script twice with a stopwatch on the demo laptop after a fresh `pnpm db:reset` and one `pnpm demo:preflight`.

**Depends on:** 12, 13, and all demo-facing prompts (3-11).

> ### In Plain English
> You now hold all 20 prompts. The next section turns them into a schedule: an hour-by-hour timeline across three hackathon days, a buffer plan that says exactly what to sacrifice when you are behind, and a parallel-track table so two team members can build simultaneously without colliding. Read it once before writing any code, then keep it open during the build.

---

## Development Order: Hour-by-Hour Timeline (~33 Hours, 3 Days)

The original build order is preserved and upgraded. Main-track durations sum to **~33 hours** across three realistic hackathon days; Member B's parallel track (ML engine, AI chat, document processing, ~9 hours) overlaps main-track hours, so total effort is ~42 hours compressed into ~33 wall-clock hours. The table maps every module to its prompt numbers, the checkpoint that proves the block is done, and the pre-agreed cut if you are running late.

**Day 1 — Foundation (Hours 1-12)**

| Hours | Module | Prompts | Output Checkpoint | If Running Late, Cut This |
|-------|--------|---------|-------------------|---------------------------|
| H01-H02 | Monorepo scaffolding + full Prisma schema | 1 | `pnpm dev` serves all 3 apps; `docker compose ps` healthy; `prisma validate` passes | Skip analytics + ai-engine shells; scaffold them later by copying apps/web |
| H02-H02.5 | Environment validation layer | 16 | Renaming a var stops startup with a readable named error | Fold a minimal 5-variable schema into Prompt 1's env.ts; expand later |
| H02.5-H04.5 | Authentication + RBAC | 2 | Login works for all 4 roles; logged-out /dashboard redirects | Drop forgot-password page; stub the link |
| H04.5-H05.5 | Error boundaries + API error envelope | 15 | Forced throw shows branded screen; API returns JSON envelope with requestId | Keep console.error only; add structured logging on Day 3 buffer |
| H05.5-H06.5 | Database seeding v1 (raw data) | 12 | Prisma Studio shows 30 projects, 4 users; admin login works | Seed 12 projects instead of 30; keep the CRITICAL flagship story |
| H06.5-H09.5 | Project CRUD + detail page | 4 | Create wizard round-trip; detail page renders all sections | Multi-step form -> single page; defer Gantt to Day 3 polish |
| H09.5-H11.5 | Executive dashboard | 3 | KPI cards animate with counts matching seed; donut renders | Static KPI numbers; drop the budget gauge; keep donut + alerts panel |
| H11.5-H12 | Day 1 checkpoint | - | `git tag day-1`; full smoke walk of every built page; commit + push | Never cut this checkpoint |
| H03-H07 *(parallel — Member B)* | ML prediction engine | 10 | `curl /predict/delay` returns delay + confidence; `docker compose up ml` healthy | Precompute predictions at seed time and serve from the Prediction table |

**Day 2 — Core Modules + Intelligence (Hours 12-24)**

| Hours | Module | Prompts | Output Checkpoint | If Running Late, Cut This |
|-------|--------|---------|-------------------|---------------------------|
| H12-H15 | Milestones, Kanban, dependencies, critical path | 5 | Drag persists after refresh; critical path highlights on seeded chain | Drop dependency graph + critical path UI; keep Kanban + milestone timeline |
| H15-H17 | Budget + resources | 6 | Stacked bar + trend render; bottleneck panel flags the 95% resource | Drop projected-final-cost indicator; keep tables + one chart |
| H17-H19 | Alerts + notifications | 7 | Bell updates live in two tabs; email arrives for CRITICAL | Drop email (in-app + Socket.io only); wire SMTP back in Day 3 buffer |
| H19-H22 | Analytics dashboard | 11 | Portfolio + budget pages render with seeded aggregates; CSV export works | Two charts per page; drop the state map + PDF export |
| H22-H23.5 | Testing suite | 14 | `pnpm test:run` green (20+ tests); Playwright smoke passes | Unit tests on logic only (health, critical path); 1 Playwright spec (login->dashboard) |
| H23.5-H24 | Day 2 checkpoint | - | `git tag day-2`; joint review of both tracks; update the cut list | Never cut this checkpoint |
| H07-H10 *(parallel — Member B)* | AI chat interface | 8 | "Why is this project at risk?" answers with tool citations on the seeded CRITICAL project | Ship 3 quick actions with DB tools only; add the ML tool when Prompt 10 lands |
| H10-H12 *(parallel — Member B)* | Document processing | 9 | Sample PDF -> PROCESSED -> summary dialog; Pinecone count increases | PDF only (no Excel/OCR); extraction summary as plain JSON cards |

**Day 3 — Harden, Ship, Rehearse (Hours 24-33)**

| Hours | Module | Prompts | Output Checkpoint | If Running Late, Cut This |
|-------|--------|---------|-------------------|---------------------------|
| H24-H25.5 | Performance pass | 17 | Dashboard query count <= 3; Lighthouse mobile >= 80 | React.memo + dynamic imports only; skip virtualisation |
| H25.5-H26.5 | Accessibility pass | 18 | axe reports 0 critical violations on demo pages; keyboard walk works | Contrast fixes + form labels + focus rings only |
| H26.5-H27 | README + docs | 19 | Fresh clone follows README quickstart successfully | README quickstart + env table only; architecture recap later |
| H27-H28 | Seed v2 (demo story) + db:reset | 12 | `pnpm db:reset` rebuilds the flagship story in < 2 min; preflight passes | Never cut — this is the demo dataset |
| H28-H29.5 | Production deployment | 13 | All 3 Vercel domains live; login + alerts + ML work in production | Deploy apps/web only; demo analytics locally if Vercel fights back |
| H29.5-H31 | Demo rehearsal + backup video | 20 | Script timed twice at 7:30-8:00; backup video recorded + stored | Trim script to bullets — but NEVER cut the backup video |
| H31-H33 | Buffer: fixes, email re-wire, logging polish, final tag | 15, 7 | `git tag demo-ready`; `pnpm test:all` green; preflight all-pass on the demo laptop | This row IS the cut — consume it before touching earlier rows |

**Totals:** main track 33.0 h + parallel track 9.0 h (overlapped) = ~42 h of effort in ~33 wall-clock hours.

---

## Buffer Plan (What to Drop, What Never to Drop)

When any block overruns, drop items **in this exact order** — each drop is chosen so the jury-facing demo path stays intact:

1. **State-wise map + PDF export** (Prompt 11) — replace with a ranked bar list; CSV export stays.
2. **Dependency graph + critical path visual** (Prompt 5) — keep a plain milestone list; the Kanban is the star.
3. **Email alerts** (Prompt 7) — in-app + Socket.io demo perfectly; wire SMTP back in the Day 3 buffer.
4. **OCR + Excel ingestion** (Prompt 9) — PDF-only pipeline still demos document intelligence.
5. **Virtualised tables + full Lighthouse tuning** (Prompt 17) — memo + dynamic imports alone clear the bar.
6. **Forgot-password flow** (Prompt 2) — stub it; nobody demos password recovery.
7. **Structural JSON logging** (Prompt 15) — console with levels is acceptable for 3 days.

**Never drop — the demo dies without these:**

- Working end-to-end authentication with visible roles (Prompt 2)
- The seeded story dataset and a sub-2-minute `pnpm db:reset` (Prompt 12)
- The executive dashboard with real, consistent numbers (Prompt 3)
- One CRITICAL project whose detail page tells a coherent story (Prompts 4-6)
- One live AI chat answer with tool citations (Prompt 8)
- One working delay prediction, live or from the stored Prediction row (Prompt 10)
- The deployed app reachable at projectassure.vercel.app (Prompt 13)
- The recorded backup video (Prompt 20)

**Time-boxing rule:** if a checkpoint slips more than 45 minutes, execute the corresponding cut immediately, note it in the day's commit message, and move on. Recovering schedule beats recovering scope.

---

## Parallel Track Plan (Two Builders, No Collisions)

Split work by app boundary, not by feature: Member A owns `apps/web` + shared packages; Member B owns `services/ml-service`, `apps/ai-engine`, and later `apps/analytics`. They only share two contracts — the ML API and the seeded data — so sync on those explicitly.

| Window | Member A (Main Track) | Member B (Parallel Track) | Sync Point (Do Together) |
|--------|----------------------|---------------------------|--------------------------|
| H01-H03 | Prompt 1 scaffolding | Review the Prisma schema; write Prompt 16 env schemas | Agree the schema + .env.example at H02 |
| H03-H07 | Prompts 2, 15, 12 (auth, errors, seed v1) | Prompt 10 ML engine (FastAPI, XGBoost, training, Dockerfile) | Freeze the /predict/* request-response contract at H05 (pydantic + Zod mirrored) |
| H07-H12 | Prompts 4, 3 (CRUD, dashboard) | Prompt 8 AI chat (UI + DB tools; ML tool stubbed until H07) | B pulls seeded project codes; agree chat context payload shape |
| H12-H17 | Prompts 5, 6 (Kanban, budget) | Prompt 9 document processing + Pinecone wiring | B needs BLOB_READ_WRITE_TOKEN — A shares .env; joint 10-min standup at H12 |
| H17-H24 | Prompts 7, 11, 14 (alerts, analytics, tests) | Wire the live ML tool into chat; integration-test chat + ML + docs pipeline | Joint Playwright smoke at H22 on both machines |
| H24-H33 | Everything together: 17, 18, 19, 12 v2, 13, 20 | Pair on deployment (B drives Vercel/Render, A verifies app behaviour) | Full-team rehearsal at H30; both sign off the backup video |

**Collision rules:** each member commits only inside their app/package; shared files (root package.json, turbo.json, schema.prisma) are edited by A only after announcing in the team channel; rebase at every checkpoint tag (day-1, day-2).

---

## Prompt-to-Module Quick Reference

| # | Prompt | Track | Day | Original Prompt Mapping |
|---|--------|-------|-----|-------------------------|
| 1 | Project Scaffolding & Monorepo Foundation | A | 1 | Prompt 1 (upgraded with full schema) |
| 2 | Authentication System | A | 1 | Prompt 2 |
| 3 | Executive Dashboard | A | 1 | Prompt 3 |
| 4 | Project CRUD & Detail Page | A | 1 | Prompt 4 |
| 5 | Milestone & Task Management | A | 2 | Prompt 5 |
| 6 | Budget & Resource Management | A | 2 | Prompt 6 |
| 7 | Alert & Notification System | A | 2 | Prompt 7 |
| 8 | AI Chat Interface | B | 2 | Prompt 8 |
| 9 | Document Processing | B | 2 | Prompt 9 |
| 10 | ML Prediction Engine | B | 1 | Prompt 10 |
| 11 | Analytics Dashboard | A | 2 | Prompt 11 |
| 12 | Database Seeding | A | 1 + 3 | Prompt 12 (v1 raw, v2 story) |
| 13 | Production Deployment | A+B | 3 | Prompt 13 |
| 14 | Automated Testing Suite | A | 2 | New |
| 15 | Error Handling & Structured Logging | A | 1 + 3 | New |
| 16 | Environment Variable Validation | A | 1 | New |
| 17 | Performance Optimisation Pass | A | 3 | New (absorbs original "UI Polish" row) |
| 18 | Accessibility Pass | A | 3 | New (absorbs original "UI Polish" row) |
| 19 | README & Documentation Generation | A | 3 | New |
| 20 | Demo-Day Rehearsal Script Builder | A+B | 3 | New |

---

*This document is part of the ProjectAssure SIH 2026 submission.*
