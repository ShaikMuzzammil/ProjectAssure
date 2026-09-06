# ProjectAssure - Tech Stack Deep-Dive

**Project:** ProjectAssure — AI-Powered Integrated Project Monitoring Platform
**SIH 2026:** PS ID SIH26103 | Theme: Smart Automation | Category: Software | Organisation: MoSPI
**Team:** [TEAM ID] / [TEAM NAME] — Amrita Vishwa Vidyapeetham, Chennai Campus

Every technology in ProjectAssure was selected against three hard constraints:

1. **INR 0 total cost.** Every service must live on a free tier — the platform runs on Vercel Hobby, Neon Free, Upstash Free, Pinecone Starter and open-source software alone.
2. **A 33-hour build window.** Every tool had to be productive within its first hour of use: no licence negotiation, no procurement, no DevOps archaeology.
3. **Jury credibility.** Each choice must survive the viva question "why not X?" — which is exactly why PART F exists.

This document is the evidence file for those choices. PART A lists every technology in one matrix. PART B defends each stack decision in a five-question chapter (what it is / why chosen / what we rejected / how we use it / what the free tier gives). PART C wires all technologies into one integration map. PART D pins exact versions. PART E quantifies free-tier consumption. PART F answers the eight hardest "why not X?" questions honestly.

## Document Map

| Part | Contents | Read it when you want to know... |
|---|---|---|
| PART A | Complete Technology Matrix | what we use, at which version, for what purpose |
| PART B | Technology Chapters (4 groups) | why each tool beat its alternatives, concretely |
| PART C | Integration Map | how the technologies connect, as a numbered flow |
| PART D | Version Pinning | the exact package.json / requirements.txt we ship |
| PART E | Free-Tier Budget Table | how much of each free limit we actually consume |
| PART F | "Why not X?" FAQ | the eight hardest alternatives, answered honestly |

## PART A: Complete Technology Matrix

The matrix is the complete inventory of the platform, ordered roughly by request lifecycle — what the user touches first, down to what runs last at build time. The three rows added for this submission are marked **(added)**.

| Layer | Technology | Version | Purpose | Why Chosen |
|-------|-----------|---------|---------|------------|
| **Frontend Framework** | Next.js | 15.x | React meta-framework with App Router | Server components, API routes, edge functions, SSR/SSG in one framework |
| **Language (Frontend)** | TypeScript | 5.x | Type-safe JavaScript | Catches bugs at compile time, better IDE support, self-documenting code |
| **Language (Backend)** | TypeScript + Python | 5.x / 3.12 | API layer + ML models | TypeScript for API consistency, Python for ML ecosystem |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS framework | Rapid UI development, consistent design system, tree-shakeable |
| **UI Components** | shadcn/ui | latest | Accessible component library | Customisable, not a dependency (copied into project), built on Radix UI |
| **Animation** | Framer Motion | 11.x | Production-ready animation library | Declarative animations, layout transitions, gesture support |
| **State Management** | Zustand + React Query | 5.x / 5.x | Client state + server state | Lightweight, TypeScript-first, excellent caching/invalidation |
| **Forms** | React Hook Form + Zod | 7.x / 3.x | Form handling + validation | Minimal re-renders, schema validation, type inference |
| **Charts** | Recharts + D3.js | 2.x / 7.x | Data visualisation | Recharts for standard charts, D3 for custom visualisations |
| **Backend Runtime** | Node.js | 20.x LTS | JavaScript runtime | Non-blocking I/O, Vercel native, massive ecosystem |
| **Backend Framework** | Express.js | 4.x | API server | Mature, middleware-rich, well-documented |
| **ORM** | Prisma | 6.x | Database ORM | Type-safe queries, auto-generated types, migration management |
| **Database** | PostgreSQL | 16.x | Relational database | ACID compliance, JSON support, vector extensions, free on Neon |
| **Database Hosting** | Neon | - | Serverless PostgreSQL | Free tier, branching, auto-scaling, Vercel integration |
| **Caching** | Redis (Upstash) | - | In-memory cache | Serverless Redis, Vercel integration, rate limiting |
| **Authentication** | NextAuth.js | 5.x (Auth.js) | Authentication | JWT sessions, OAuth providers, route protection |
| **Vector Database** | Pinecone | - | Embeddings storage | Serverless, fast similarity search, free tier |
| **Email** | Nodemailer + Gmail SMTP | 6.x | Email notifications | Free via Gmail App Password, no domain required |
| **Object Storage** | Vercel Blob | - | File uploads | Native Vercel integration, S3-compatible API |
| **Real-time** | Socket.io | 4.x | WebSocket communication | Real-time updates, rooms, fallback to long-polling |
| **AI/ML (Python)** | scikit-learn, XGBoost, PyTorch | latest | ML models | XGBoost for tabular prediction, PyTorch for deep learning |
| **LLM** | OpenAI GPT-4o / Google Gemini | - | Text generation, summarization | GPT-4o for quality, Gemini for cost efficiency |
| **OCR** | Tesseract OCR | 5.x | Image text extraction | Open-source, multi-language support |
| **PDF Processing** | pdfplumber, PyMuPDF | latest | PDF text extraction | Accurate table extraction, layout preservation |
| **PDF Rendering** | PyMuPDF | 1.24.x **(added)** | Fast page rendering + text layer extraction | Order-of-magnitude faster than pdfplumber for page-level work; powers thumbnails and OCR pre-processing |
| **Containerisation** | Docker + Docker Compose | 27.x | Local development environment | Reproducible dev environment, Python service container |
| **Monorepo** | Turborepo + pnpm | latest | Build system | Fast builds, task orchestration, shared caching |
| **Deployment** | Vercel | - | Hosting & deployment | Git-based deploys, preview deployments, edge functions, free tier |
| **Edge Delivery** | Vercel Edge Network | - **(added)** | Global CDN, edge middleware, TLS | Sub-100ms TTFB for Indian users, zero config, shared by all 3 apps |
| **Version Control** | Git + GitHub | - | Source control | Industry standard, CI/CD integration |
| **CI/CD** | GitHub Actions | - **(added)** | Lint + typecheck + test on every push | Free minutes on our plan, runs before Vercel deploy, blocks broken merges |
| **Package Manager** | pnpm | 9.x | Package manager | Fast, disk-efficient, workspace support |

**How to read this matrix:**

- **Prophet** (time-series forecasting, chapter B15) runs inside the same Python AI/ML service as the AI/ML row above; **PyTorch** is retained for offline deep-learning experiments only — production prediction is XGBoost + Prophet + scikit-learn.
- **PyMuPDF** earns its own row because it sits on the hot upload path (page rendering and text-layer extraction before OCR), distinct from pdfplumber's table-extraction strength.
- **Vercel Edge Network** and **GitHub Actions** were implicit before; they are now explicit because delivery and CI are graded parts of the architecture.
- All "latest" pins are locked to exact versions in PART D; all free-tier limits are quantified with expected usage and headroom in PART E.

### In Plain English

> Think of this matrix as the materials list for building a house: before buying a single brick, you write down every door, window and pipe you need, which brand you chose, and why that brand beat the cheaper one. Anyone auditing the build — or joining it late — can see in one table that nothing was chosen by accident, and that every line item on the bill adds up to zero rupees.

## PART B: Technology Chapters

Each chapter answers the same five questions: **What it is** (plain sentences), **Why chosen** (bullets), **Alternatives** (an honest table), **How ProjectAssure uses it** (concrete), and the **free-tier note**. Chapters are grouped into four families: Frontend, Backend and Data, AI/ML, and Infrastructure. Per the document's snippet policy, code appears only twice: the Prisma datasource (B8) and the NextAuth configuration (B.21).

### Frontend Group

#### B1. Next.js 15 (App Router)

**What it is.** Next.js is a React meta-framework from Vercel. It adds routing, server-side rendering, React Server Components, API route handlers and deployment tooling on top of plain React, so one codebase covers both the UI and backend endpoints.

**Why chosen.**

- Server Components render data-heavy pages on the server and ship almost no JavaScript for them — a portfolio dashboard with 40 project cards stays fast.
- Route handlers under `app/api/` give a typed backend colocated with the UI; no separate CRUD server to deploy and monitor.
- Zero-config Vercel deployment, with a live preview URL for every push — the jury link is permanent and per-feature.
- File-based routing with nested layouts mirrors our domain (one project layout with tabs for milestones, budget, documents, predictions).
- Edge middleware executes auth checks before any page code runs.

**Alternatives considered.**

| Criterion | Next.js 15 | React (Vite) |
|-----------|-----------|--------------|
| **Server Components** | Native RSC support | Not available (client-only) |
| **API Routes** | Built-in API routes | Requires separate backend (Express/Fastify) |
| **SSR/SSG** | Built-in | Requires setup (Vite SSR plugin) |
| **File-based Routing** | App Router with layouts | Requires React Router |
| **Vercel Deployment** | Zero-config | Requires configuration |
| **SEO** | Built-in metadata API | Manual setup |
| **Image Optimization** | Built-in `<Image>` component | Requires external library |
| **Middleware** | Edge middleware | N/A |

Next.js 15 provides everything we need in a single framework — API routes for our backend, server components for performance, and zero-config Vercel deployment. Remix was also evaluated: while Remix is excellent, Next.js has a larger ecosystem, better Vercel integration, and the App Router in v15 provides equivalent or better features than Remix's loader/action pattern. The honest Remix trade-off: slightly simpler data-loading conventions, offset by a smaller plugin ecosystem.

**How ProjectAssure uses it.**

- `apps/web` — the officer-facing console (projects, milestones, Kanban, budgets, alerts, documents).
- `apps/analytics` — analytics.projectassure.vercel.app, read-mostly portfolio dashboards for executives.
- `apps/ai` — ai.projectassure.vercel.app, the conversational AI console with streaming responses.
- Server Components fetch via Prisma directly; interactive islands (Kanban board, chat) hydrate with React Query.
- Route groups keep RBAC layouts separate (officer vs admin shells) without duplicating providers.

**Free-tier note.** Next.js is MIT-licensed; hosting is covered under Vercel Hobby (chapter B19 and PART E). Zero framework cost.

#### B2. TypeScript 5 (strict mode)

**What it is.** TypeScript is JavaScript with a static type layer that is compiled away at build time. Data shapes are described once and enforced everywhere the data travels.

**Why chosen.**

- Compile-time catching of null/undefined and shape bugs before they can appear in a jury demo.
- One shared `@projectassure/types` package means all three apps and the ML HTTP clients describe a `Project` identically.
- Prisma generates database types; Zod validates runtime input into those types — a single source of truth from Postgres to pixel.
- Refactors (renaming a health-score field) become mechanical compiler work instead of prayer.
- Acts as living documentation: a teammate on the analytics domain reads the interface, not the schema, to understand the data.

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| Plain JavaScript | Fastest to start; no build step | Runtime crashes surface in demos; no contracts between 3 apps |
| JSDoc annotations | No compile step, still typed in editor | Weaker inference, no generics discipline, drifts from reality |
| Flow | Solid type system | Shrinking ecosystem and tooling; React community moved to TS |

**How ProjectAssure uses it.** The core domain type (rendered here as a field table; the interface itself lives in `packages/types/src/project.ts`):

| Field | Type | Meaning |
|---|---|---|
| `id` | string | UUID primary key |
| `name` | string | Project title |
| `description` | string | Scope summary |
| `status` | ProjectStatus | Lifecycle enum (planned / active / delayed / completed) |
| `healthScore` | number | 0-100 composite: schedule 30%, budget 25%, resources 25%, milestones 20% |
| `startDate` / `targetDate` | Date | Planned execution window |
| `budget` | { planned, spent, projected } | INR, Decimal(18,2) in the database |
| `progress` | number | 0-100 percent complete |
| `department` | Department | Owning department |
| `milestones` | Milestone[] | Tracked checkpoints |
| `risks` | RiskAssessment | Latest risk assessment |
| `predictions` | PredictionResult \| null | Latest XGBoost delay prediction |

Strict mode is on; `any` is banned by an ESLint rule in CI; Zod schemas call `.infer` so React Query generics and route handlers share the same types.

**Free-tier note.** Open-source (Apache-2.0). Zero cost.

#### B3. Tailwind CSS 4 + shadcn/ui

**What it is.** Tailwind CSS is a utility-first styling engine; version 4 moves configuration into CSS (`@theme`) and compiles through a Rust-based engine. shadcn/ui is not an npm dependency — it copies accessible, Radix-UI-based component source into your repo so you own every line.

**Why chosen.**

- Design tokens (colours, spacing, radii, shadows) are declared once in `@theme` and consumed everywhere — the single source behind our design-system document.
- No runtime CSS-in-JS cost; unused utilities are tree-shaken out of the production bundle.
- shadcn delivers the hard accessibility work (focus traps, ARIA wiring, keyboard nav) that we could not rebuild inside 33 hours.
- Because components are copied in, custom domain components (HealthScoreCard, RiskBadge, GanttRow) are trivially derived from base ones.

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| Material UI | Huge component set, mature theming | Google-look defaults, heavier bundle, harder to look bespoke |
| Ant Design | Best-in-class tables for enterprise | Opinionated enterprise feel; theming beyond defaults is painful |
| styled-components | Familiar CSS-in-JS ergonomics | Runtime cost, style drift without token enforcement |
| Chakra UI | Pleasant DX, good a11y | Slower v3 migration cycle, more bundle than needed |

**How ProjectAssure uses it.** The full shadcn base set (button, dialog, table, command palette, toast) plus 30+ custom components; the Green/Amber/Red status palette and dark theme are CSS variables mapped in `@theme`; the design tokens mirror the SIH design-system document one-to-one.

**Free-tier note.** Both MIT-licensed. Zero cost, and no vendor can revoke anything because the component code is in our repository.

#### B4. Framer Motion 11

**What it is.** Framer Motion is a declarative animation library for React: you describe visual states and it interpolates between them with physics-based springs.

**Why chosen.**

- Spring physics (stiffness/damping) makes interfaces feel alive rather than linearly tweened.
- Layout animations: when the project list re-sorts by health score, cards glide to their new positions automatically.
- `AnimatePresence` orchestrates enter/exit for page transitions, toasts and alerts.
- Drag and gesture support powers the Kanban board out of the box.
- First-class `prefers-reduced-motion` support makes our accessibility commitment one prop deep.

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| CSS transitions | Zero JS, perfect for hover states | No layout animation, no orchestration, no gestures |
| react-spring | Excellent physics engine | Smaller ecosystem; more manual for shared-layout cases |
| GSAP | Most powerful timelines | Imperative style fights React; some plugins need a licence |

**How ProjectAssure uses it.** The health-score ring springs from 0 to its value (spring stiffness 200, damping 20 — the original snippet's exact parameters); page transitions between routes; staggered reveal of dashboard cards on load; alert slide-ins from the notification tray; progress bars animating when scrolled into view; drag-and-drop on the Kanban board. All motion is disabled under reduced-motion preferences.

**Free-tier note.** MIT-licensed. Zero cost.

#### B5. React Query 5 + Zustand 5

**What it is.** TanStack React Query manages server state — fetching, caching, deduplication, background refresh and invalidation. Zustand is a ~1KB store for client state — UI preferences and selections. Two tools, because server data and UI state have different lifecycles and deserve different machinery.

**Why chosen.**

- React Query removes roughly 90% of data-fetching boilerplate; caching and retries become declarations, not code.
- Optimistic updates: moving a Kanban card updates the UI instantly and rolls back on server error — demo-critical snappiness.
- Zustand needs no provider tree and re-renders only components whose selected slice changed.
- Both are TypeScript-first with excellent generics.

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| Redux Toolkit | Best devtools, predictable flux | Heavy boilerplate for our app size; no fetch caching story |
| SWR | Very light fetch cache | Weaker mutation/invalidation model than React Query |
| Context API / Jotai | Fine for UI state | No cache semantics for server data; prop-drilling or atom sprawl |

**How ProjectAssure uses it.** Query keys like `['projects', { department, status, page }]` drive the entire filter system; Socket.io events (`task:moved`, `health:updated`) call `queryClient.setQueryData` to patch caches on every open dashboard without refetch; Zustand stores sidebar collapse, active filters, selected Gantt cell and chat drafts.

**Free-tier note.** Both MIT-licensed. Zero cost.

#### B6. Recharts 2 + D3 7

**What it is.** Recharts provides composable React chart components built on D3. D3 itself is the low-level data-visualisation toolkit. Standard charts come from Recharts; bespoke visuals are hand-built in D3.

**Why chosen.**

- Recharts is declarative, responsive and themable — an executive portfolio bar chart is fifteen lines.
- No chart library ships a Gantt with dependency arrows; D3 builds ours exactly.
- Both share the SVG and tooltip mental model, so the team moves between them without context-switching.
- Recharts formatters handle INR lakh/crore axis labelling cleanly.

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| Chart.js | Fast, canvas-based, light | Canvas model is less React-idiomatic; weaker React integration |
| Apache ECharts | Enormous feature set | Larger bundle; configuration objects instead of components |
| Highcharts | Polished and complete | Commercial licence — violates the INR 0 constraint outright |

**How ProjectAssure uses it.** Recharts: health-score trend area chart, budget burn line (planned vs spent vs Prophet-projected), department comparison bars, delay-probability distributions. D3: the portfolio Gantt with milestone diamonds and dependency arcs, custom burndown visuals, and the resource-loading heatmap.

**Free-tier note.** Recharts is MIT; D3 is ISC/BSD-family. Zero cost.

### Backend & Data Group

#### B7. Node.js 20 + Express 4

**What it is.** Node.js is a JavaScript runtime built on non-blocking I/O — one process can hold thousands of concurrent connections. Express is its most mature, middleware-based HTTP framework. Together they host the long-running services that do not fit inside serverless functions.

**Why chosen.**

- Same language on the frontend and the services: shared types and utilities come straight from `packages/`.
- Express's middleware chain (helmet, cors, rate-limit, auth) is battle-tested and readable in one file.
- Socket.io needs a persistent process to hold WebSocket state — serverless functions cannot, Express hosts it cleanly.
- Node 20 LTS is supported into 2026, has native fetch, and is Vercel-native.

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| Fastify | Faster raw throughput, schema-first | We are not throughput-bound; Express docs and middleware win |
| NestJS | Enforced architecture, DI | Steep learning curve disproportionate to a 33-hour build |
| Koa / Hapi | Cleaner minimal cores | Smaller middleware ecosystems, fewer batteries |

**How ProjectAssure uses it.** `services/realtime` is an Express app that mounts the Socket.io gateway (JWT-verified handshake, rooms per project and department), health endpoints, and webhook receivers for email bounces. It runs as a Docker container in development and on a free container host for the always-on online demo (see B19's honest limit and PART E).

**Free-tier note.** Open-source (MIT/Node.js license). The one always-on process is the platform's only hosting nuance, and it is handled on free container compute — total cost still INR 0.

#### B8. Prisma 6

**What it is.** Prisma is a TypeScript ORM: models are declared in a schema file, from which Prisma generates a fully typed client and manages SQL migrations. The database becomes a compiled, versioned artefact rather than tribal knowledge.

**Why chosen.**

- Types flow from the database to the UI with zero hand-written mapping layers.
- `prisma migrate dev` produces reviewable, versioned SQL migrations — the schema's history is in git.
- Nested relation includes (a project with milestones, risks and predictions in one call) eliminate N+1 patterns.
- First-class JSONB, Decimal money, composite uniques and index declarations in the schema itself.
- Neon-aware: separate pooled and direct URLs, so migrations never fight the connection pooler.

This is the one datasource snippet in the document:

```prisma
// packages/db/prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")   // pooled (PgBouncer) — runtime queries
  directUrl = env("DIRECT_URL")     // direct — migrations and introspection
}
```

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| Drizzle | Lighter, SQL-flavoured, edge-friendly | Younger ecosystem; fewer migration ergonomics at our deadline |
| TypeORM | Long-established, decorators | Weaker type inference; historically buggy migration diffs |
| Raw pg + SQL | Total control, zero abstraction | No type generation; every query is hand-validated boilerplate |
| Mongoose | Fast for document stores | Wrong data model — our domain is deeply relational |

**How ProjectAssure uses it.** `packages/db` owns `schema.prisma` with 16 models (Project, ProjectMember, Milestone, Task, TaskDependency, BudgetRecord, ResourceAllocation, RiskAssessment, PredictionResult, Alert, Notification, Document, AuditLog, User, Organization, Department); `seed.ts` builds the SIH demo portfolio; every server component and route handler imports the generated client through a singleton that survives hot reloads.

**Free-tier note.** MIT-licensed. Prisma's paid Data Platform (Accelerate/Pulse) is deliberately NOT used — the free Postgres connection path is enough.

#### B9. PostgreSQL 16 on Neon

**What it is.** PostgreSQL is the reference open-source relational database: full ACID transactions, real joins, JSONB, and an extension ecosystem. Neon is serverless Postgres that autosuspends to zero between requests, branches like git, and integrates natively with Vercel.

**Why chosen.** The comparison that decided it:

| Criterion | PostgreSQL (Neon) | MongoDB (Atlas) | Supabase |
|-----------|-------------------|-----------------|----------|
| **ACID Compliance** | Full | Limited | Full (PostgreSQL) |
| **Relational Data** | Excellent (joins, FKs) | Poor (no joins) | Excellent |
| **JSON Support** | JSONB columns | Native | JSONB |
| **Vector Search** | pgvector extension | Atlas Vector Search | pgvector |
| **Free Tier** | 0.5 GB, always-on | 512 MB, shared cluster | 500 MB, paused after inactivity |
| **Vercel Integration** | Native `@neondatabase/serverless` | Manual | Native |
| **Connection Pooling** | Built-in (PgBouncer) | Built-in | Built-in |
| **Branching** | Database branching for dev | N/A | Database branching |
| **Scaling** | Serverless scale-to-zero | Auto-scaling | Auto-scaling |

PostgreSQL's relational model is essential for ProjectAssure's complex data relationships (projects → milestones → tasks → resources → budgets). Neon's free tier and Vercel integration make it the ideal choice for a hackathon prototype. The honest Supabase note: Supabase would also have worked; Neon won on Vercel integration tightness and pooled-connection ergonomics for serverless functions.

**How ProjectAssure uses it.** The relational core carries the domain: project → milestone → task → dependency → budget → resource chains with real foreign keys and explicit cascades; JSONB holds flexible document-extraction payloads and audit diffs; `Decimal(18,2)` holds INR amounts; the pooled endpoint serves serverless fan-out; every feature branch can get an isolated database branch for free.

**Free-tier note.** 0.5 GB storage and roughly 190 compute hours per month on the free plan, autosuspending between requests. Consumption is quantified in PART E.

#### B10. Upstash Redis

**What it is.** Upstash is serverless Redis accessed over HTTP REST — pay per command, no persistent connections, with a Vercel-native SDK and a rate-limiting library on top.

**Why chosen.**

- Serverless functions cannot hold persistent TCP pools to a traditional Redis; Upstash's REST model is designed exactly for that world.
- Sliding-window rate limiting via `@upstash/ratelimit` in a few lines.
- Pub/sub doubles as the Socket.io multi-instance adapter.
- 256 MB and 10,000 commands/day on the free plan are ample for cache, counters and chat memory.

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| Redis Cloud | Full Redis, generous RAM | Persistent-connection pricing mismatches serverless bursts |
| In-memory Map | Free and instant | Dies with each invocation; wrong across instances |
| Vercel KV | One-click setup | Literally Upstash underneath, with less surface control |

**How ProjectAssure uses it.** The L2 cache in front of Prisma (versioned keys such as `projects:list:v3:dept=roads:page=1`); per-IP and per-user rate limits (100 req/min API, 20 req/min AI chat); pub/sub channel for Socket.io fan-out; AI-chat conversation memory as per-session JSON with a 30-minute TTL; health-score recompute job queue.

**Free-tier note.** Free plan: 10,000 commands/day, 256 MB. Headroom math is in PART E.

#### B11. Socket.io 4

**What it is.** Socket.io is a WebSocket library with rooms, acknowledgements, automatic reconnection, and a long-polling fallback when WebSockets are blocked.

**Why chosen.**

- Alerts must land in under a second; polling wastes requests and feels dead on stage.
- Rooms map perfectly onto our domain: one room per project, per department, per role broadcast.
- Long-polling fallback survives flaky jury-hall Wi-Fi without any client changes.
- The Redis adapter enables horizontal scale past one gateway instance.
- Acknowledgement callbacks give delivery confirmation for critical alert events.

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| Raw WebSocket | Minimal protocol overhead | No rooms, reconnect, or fallback — you rebuild Socket.io badly |
| Pusher / Ably | Managed, polished, global | Metered paid pricing — violates INR 0 |
| Server-Sent Events | Trivial one-way push | No client-to-server channel, no acks, no rooms |
| Firebase Realtime DB | Managed sync | Vendor lock-in; schema and query limits fight our model |

**How ProjectAssure uses it.** Events: `alert:new` (red/amber threshold breach), `task:moved` (Kanban sync across tabs), `health:updated` (after recompute), `milestone:slipped`, `prediction:ready`, `notification:push`. The handshake verifies the NextAuth JWT; rooms are joined server-side only after a membership check — clients cannot self-join a project room.

**Free-tier note.** Open-source (MIT). The gateway is the Express service from B7; free container hosting keeps the cost at zero.

#### B12. Vercel Blob

**What it is.** Vercel Blob is managed object storage for files, with a three-function SDK (`put`, `get`, `del`), signed upload URLs, and the same dashboard and team as our hosting.

**Why chosen.**

- Zero new vendor: same Vercel account, same environment variables, same bill (still zero).
- Signed URLs keep file access secret-free on the client; the SDK is three lines from a route handler.
- Uploads return metadata (size, MIME, checksum) in the same call for instant validation records.
- Edge-cacheable reads make document previews fast without a CDN setup.

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| AWS S3 | Infinite scale, ecosystem | IAM and bucket setup is hours we do not have |
| Cloudinary | Excellent image pipeline | Our load is PDF-first; mismatch |
| Supabase Storage | Good DX | Drags in a second backend vendor for one feature |
| UploadThing | Neat DX | Tighter free tier for our document volume |

**How ProjectAssure uses it.** Stores uploaded progress reports, site photos, OCR outputs and generated report PDFs. A route handler validates MIME type and the 10 MB cap with Zod, writes the Blob, and inserts the `Document` row (Blob URL + scan status) in one transaction; the embedding pipeline reads documents back from Blob.

**Free-tier note.** The Vercel Hobby plan includes roughly 1 GB of Blob storage and 10 GB of egress; PART E shows we use about a quarter of it.

### AI/ML Group

#### B13. Python 3.12 + FastAPI

**What it is.** FastAPI is a modern async Python web framework where type hints declare request and response shapes; Pydantic validates them and OpenAPI (Swagger) docs are generated automatically. Python 3.12 is the runtime with the mature ML ecosystem.

**Why chosen.**

- The ML stack (XGBoost, Prophet, scikit-learn, SHAP) is Python-native; any other language adds glue and loses libraries.
- Async endpoints keep delay prediction and forecasting concurrent under load.
- The auto-generated `/docs` page lets the jury inspect and even call the ML API live.
- Pydantic is the same validation philosophy as Zod on the TypeScript side — one mental model, two languages.
- Containers cleanly: one Dockerfile carries Tesseract binaries and plotting libraries.

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| Flask | Tiny, familiar | Weak async story; validation and docs are manual |
| Django + DRF | Batteries included | ORM/admin weight is pointless for a stateless model service |
| BentoML / LitServe | Model-serving focused | Less general API surface; another framework to learn |

**How ProjectAssure uses it.** The ML service exposes `POST /predict/delay` (18-feature vector → delay probability, expected delay days, top-5 SHAP factors), `POST /forecast/budget` and `POST /forecast/progress` (Prophet with Indian fiscal-year-end and monsoon regressors), and `GET /health` (model version + feature-schema hash). The TypeScript backend calls it over `ML_SERVICE_URL`; models load once at startup — the XGBoost artefact is roughly 200 KB.

**Free-tier note.** Open-source (MIT/BSD). Runs in the Docker container locally and on free container compute for the online demo.

#### B14. XGBoost

**What it is.** XGBoost is a gradient-boosted decision-tree library — the long-standing state of the art for tabular prediction, and the algorithm behind a large share of winning tabular competition solutions.

**Why chosen.**

- Best-in-class accuracy on structured data; our delay task is exactly structured data.
- Millisecond CPU inference — fits a free-tier container with no GPU.
- SHAP integration explains every prediction as weighted feature contributions — the explainability that a MoSPI jury will ask for.
- The trained model is a tiny `.json` file, versioned in git, reloadable without any retraining infrastructure.

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| LightGBM | Comparable speed and accuracy | Honest: either works; XGBoost's SHAP maturity and team familiarity won |
| Random Forest | Simpler to tune | Lower accuracy ceiling; weaker probability calibration |
| Tabular deep nets (TabNet) | Handle raw complexity | GPU-dependent, opaque, overkill for 18 engineered features |
| LSTM | Models sequences | Loses to XGBoost on tabular snapshots; kept as a v2 experiment |

**How ProjectAssure uses it.** A binary classifier — "will this project breach its target date?" — over an 18-feature vector (task_completion_rate, budget_burn_ratio, milestone_adherence, resource_utilisation, progress_velocity_trend, and 13 more). Holdout results: AUC-ROC 0.91, MAE 18.4 days. Predictions surface 30-60 days before projected slippage and feed the 30/25/20/25 health-score model; SHAP values are stored with each prediction for UI drill-down.

**Free-tier note.** Apache-2.0 licence; CPU-only inference keeps it inside free compute.

#### B15. Prophet

**What it is.** Prophet is Meta's decomposable time-series forecasting library: trend + seasonality + holidays + custom regressors, with uncertainty intervals built in.

**Why chosen.**

- Handles weekly and yearly seasonality plus Indian fiscal-year-end (March) spikes via the holidays interface.
- Custom regressors let us add monsoon months (Jun-Sep) as an explicit effect — a chart, not a mystery.
- Robust to missing data and outliers, which government progress reports reliably contain.
- Produces `yhat`, `yhat_lower` and `yhat_upper` that drive our amber/red threshold logic directly.

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| ARIMA / SARIMA | Classical, interpretable | Brittle with multiple seasonalities and extra regressors |
| LSTM / N-BEATS | Learns complex patterns | Data-hungry; we have ~5,000 synthetic plus limited real series |
| Statsforecast / AutoARIMA | Very fast | Weaker holiday handling and decomposition plots out of the box |

**How ProjectAssure uses it.** Weekly budget-burn and progress-velocity forecasts per project; fiscal-year-end modelled as a holiday effect, monsoon as an additive regressor; interval bands feed the overrun rules (>10% above plan = warning, >20% = critical), which feed the health score and the alert engine.

**Free-tier note.** MIT-licensed; runs on the same free container as B13.

#### B16. OpenAI GPT-4o + Gemini fallback

**What it is.** Frontier LLM APIs: GPT-4o is the primary model for extraction, explanation and tool-calling; Google Gemini is the automatic fallback and cost absorber. A circuit-breaker chain — GPT-4o → Gemini → cached response → deterministic template — means the AI surface never dies on stage.

**Why chosen.**

- GPT-4o has the strongest instruction-following and tool-calling fidelity for our six-tool agent and PDF-to-JSON extraction.
- Gemini's free tier and independent failure domain make the ideal second provider; a budget cap routes overflow automatically.
- Both handle long contexts — a 60-page detailed project report fits with chunking.
- Dual-vendor is resilience plus negotiating leverage, at INR 0 when combined with caching.

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| Claude 3.5 | Excellent quality and long context | Gemini won the fallback slot on free-tier volume; Claude remains an easy swap |
| Self-hosted Llama / Mistral | No per-token cost | GPU cost we cannot afford; slower iteration |
| Groq-served OSS | Extremely fast, cheap | Weaker tool-calling for structured extraction |
| Single vendor only | Simpler code | One outage or one empty credit balance ends the demo |

**How ProjectAssure uses it.** Document pipeline (chunk → extract structured JSON at temperature 0.2 → validate with Zod/Pydantic); agentic chat with six tools (query_projects, get_project_detail, run_delay_prediction, search_documents, compare_portfolio, generate_report); weekly digest and executive summary generation; PII masking before any prompt leaves our boundary; temperature 0.2-0.4 depending on task.

**Free-tier note.** OpenAI grants small trial credits (then pay-as-you-go); Gemini's AI Studio free tier absorbs overflow. Numbers are quantified in PART E.

#### B17. Pinecone + RAG

**What it is.** Pinecone is a managed, serverless vector database: embeddings in, nearest-neighbours out, with metadata filtering. Retrieval-Augmented Generation means the LLM answers from real retrieved document chunks instead of memory — with citations.

**Why chosen.**

- Serverless: zero cluster operations, scales to zero, one free starter index.
- Metadata filters (`project_id`, `department`, `doc_type`) enforce per-project retrieval scope — a field officer cannot RAG into another department's files.
- Millisecond filtered search keeps chat round-trips near the 2-second budget.
- Keeps vectors out of Neon so the 0.5 GB free Postgres stays relational (pgvector analysed in PART F).

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| pgvector | One less vendor; SQL joins on vectors | Consumes Neon's 0.5 GB; index tuning becomes our job |
| Qdrant Cloud | Strong filtering, good perf | Smaller free tier for our corpus growth |
| Weaviate | Rich hybrid search | Heavier setup and operations |
| Chroma | Perfect for local dev | Weak managed free tier for a deployed demo |

**How ProjectAssure uses it.** Documents are chunked at 800 tokens with 100-token overlap; `text-embedding-3-small` embeds each chunk; upserts carry project/department metadata. Chat retrieval is filtered by project scope with a 0.78 similarity threshold, and answers carry `[source: document, page]` citations. Semantic search across the portfolio ("find all projects mentioning steel shortage") and duplicate-report clustering ride the same index.

**Free-tier note.** Pinecone starter plan: one serverless index, roughly 100K vector capacity. Our corpus is ~20K vectors — PART E shows the headroom.

### Infrastructure Group

#### B18. Docker 27 + Docker Compose

**What it is.** Docker packages an application and its system dependencies into a container image; Compose declares and runs multi-container stacks from one YAML file. One command stands up the full local environment with pinned versions.

**Why chosen.**

- The ML service needs system packages (Tesseract binaries, plotting libraries) — a Dockerfile makes that reproducible on every laptop.
- Kills "works on my machine" during a 33-hour build with multiple contributors.
- Compose is orchestration without learning Kubernetes.
- Mirrors how the Express gateway and ML service are hosted in production containers.

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| Raw venv + pip | Fastest to start | System deps unresolved; environments drift per machine |
| Conda | Solves Python deps well | Heavy; does nothing for non-Python services |
| Devcontainers | Great editor integration | Still Docker underneath, plus editor coupling |
| Podman | Daemonless, compatible | Smaller Compose-parity ecosystem |

**How ProjectAssure uses it.** `docker-compose.yml` defines `ml-service` (Python 3.12-slim + Tesseract + a mounted model volume) and `realtime` (Express + Socket.io), each with healthchecks; the Next.js apps run on the host via pnpm for hot reload; CI builds the same images before deployment.

**Free-tier note.** Docker Engine is free and open-source; Docker Desktop is free for personal and small-business use. Pulls from Docker Hub are unmetered at our scale.

#### B19. Vercel

**What it is.** Vercel is the frontend cloud: git-connected builds, a global CDN, serverless and edge functions, cron jobs, preview deployments and analytics — built by the makers of Next.js.

**Why chosen.**

- Zero-config Next.js deploys from the monorepo (root-directory detection plus turbo filtering).
- A permanent preview URL per pull request: every feature is demo-able before merge, and reviewers click a link instead of cloning.
- The Hobby plan hosts all three apps, serverless API routes, cron triggers and analytics — INR 0.
- Edge Network, Blob and the remote build cache live in the same account — one vendor, one dashboard.

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| Railway | Great for long-running services | No free tier anymore (trial credit only) — fails INR 0 |
| Render | Solid all-rounder | Slower builds; free web services spin down awkwardly |
| Netlify | Excellent static + edge | Weaker Next.js API/ISR parity |
| AWS Amplify | More control | Far more configuration for the same result |

**How ProjectAssure uses it.** Three Vercel projects (web, analytics, ai) from one repository, each with its own environment variables (the PART D template); production domains projectassure.vercel.app plus the two subdomains; nightly cron hits `/api/jobs/predictions`; preview deployments host SIH reviewers.

**Free-tier note.** Hobby: 100 GB bandwidth/month and generous function limits — quantified in PART E. The honest limit: no always-on WebSocket process on serverless, which is why B7's Express gateway runs on free container compute.

#### B20. Turborepo + pnpm 9

**What it is.** Turborepo is a task orchestrator for monorepos: it runs build/test/lint as a dependency graph and caches results. pnpm is a fast, disk-efficient package manager with first-class workspace support. Together they make three apps plus four shared packages feel like one codebase.

**Why chosen.**

- Turbo builds only what changed; unchanged apps are cache hits.
- Remote cache: a teammate's second build of `apps/web` can drop from minutes to seconds.
- pnpm's content-addressable store shrinks `node_modules` from gigabytes to megabytes and blocks phantom dependencies.
- One pull request can update a shared type and all three consumers atomically.

**Alternatives considered.**

| Alternative | Where it wins | Where it loses to our pick |
|---|---|---|
| Nx | Powerful generators and plugins | More machinery than a 3-app hackathon repo needs |
| Lerna | Publishing workflows | Legacy for our use case; no build graph |
| Yarn / npm workspaces | Built-in, familiar | Slower installs; phantom-dependency risk |
| Polyrepo (3 repos) | Independent deploys | Type drift, tripled CI config, cross-repo PRs |

**How ProjectAssure uses it.** `pnpm-workspace.yaml` covers `apps/*` and `packages/*`; the `turbo.json` pipeline orders lint → typecheck → test → build with input hashing; packages are `@projectassure/ui` (shadcn-based kit), `@projectassure/db` (Prisma client), `@projectassure/types` (shared domain types) and `@projectassure/config` (eslint/tailwind/next presets); `turbo build --filter=web...` builds exactly the web app and its dependencies.

**Free-tier note.** Both open-source; Vercel's remote cache is free with the account.

### B.21. Glue Services: NextAuth v5 (Auth.js) + Nodemailer

Two stack members are small enough that they ride along inside the apps, but they hold the doors closed — so they get a chapter too.

**NextAuth v5 (Auth.js).** JWT session strategy means every request carries a signed token and no session table exists. All three apps share one `NEXTAUTH_SECRET`, so a login on the main app is valid on analytics and ai — that shared-secret JWT is the entire SSO mechanism, with a one-time 30-second handoff token for the first cross-domain jump. The configuration (the document's second and last snippet):

```typescript
// apps/web/src/auth.ts (NextAuth v5 / Auth.js)
export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,   // shared by all 3 apps -> SSO
  session: { strategy: "jwt" },          // stateless, no session table
  trustHost: true,
  providers: [Credentials, Google],      // demo accounts + OAuth ready
  callbacks: {
    jwt: ({ token, user }) =>            // embed role claim for RBAC
      user ? { ...token, role: user.role } : token,
  },
});
```

Role claims drive the RBAC middleware; provider addition (Google OAuth) is one array entry when a real domain exists.

**Nodemailer + Gmail SMTP.** For the prototype, alerts and digests are email over Gmail SMTP via Nodemailer — free, and no custom domain is required. Setup: (1) create the dedicated account `projectassure.mail@gmail.com`; (2) enable 2-Step Verification; (3) generate a 16-character App Password from Google Account settings; (4) add `EMAIL_USER` and `EMAIL_PASS` to Vercel's environment variables. The app builds one transporter (`service: "gmail"` with the two env credentials) and a single `sendAlertEmail({ to, subject, html })` helper that the alert engine calls for red-threshold breaches and the weekly digest. Production upgrade path, in order of likely adoption: Resend (with a verified domain, developer-friendly), Amazon SES (highest volume, lowest cost), SendGrid (enterprise deliverability).

### In Plain English

> PART B was the showroom tour: for each tool we told you what it does, why we picked it over the other brands on the shelf, which room of the house it works in, and what the free sample pack covers. Two tools — the lock (NextAuth) and the mailbox (Nodemailer) — were small enough to describe on the way out. The rule we followed everywhere: never choose a part because it is fashionable; choose it because it survives the questions a jury asks.

## PART C: Integration Map

The diagram below shows every technology from PART A wired together. Three vertical bands: build/CI at the top, the three deployed apps under the Edge Network, and the runtime data and service plane below.

```
                         +------------------------------------------+
                         |            BUILD & CI PIPELINE           |
                         |   GitHub repo -> GitHub Actions          |
                         |   (turbo lint / typecheck / test)        |
                         |   Turborepo + pnpm 9 build graph         |
                         +---------------------+--------------------+
                                               | deploy only what changed
                                               v
+====================================================================================+
|                  VERCEL EDGE NETWORK (global CDN + TLS + edge middleware)          |
+==============+================================+================================+===+
               |                                |                                |
               v                                v                                v
    +---------------------+    +---------------------------+    +--------------------+
    |      MAIN APP       |SSO |      ANALYTICS APP        |SSO |       AI APP       |
    | projectassure.      |--->| analytics.projectassure.  |--->| ai.projectassure.  |
    | vercel.app (Next 15)|30s | vercel.app (Next 15)      |30s | vercel.app (Next15)|
    +----------+----------+    +-------------+-------------+    +---------+----------+
               |                             |                            |
               +-------------+---------------+----------------------------+
                             | NextAuth v5 JWT (shared secret) on every request
 ============================| RUNTIME DATA & SERVICE PLANE =========================
                             v
   +----------------------------------------------------+   +----------------------+
   |            NEXT.JS ROUTE HANDLERS (API)            |-->|    UPSTASH REDIS     |
   |    Zod validation * RBAC * business logic          |   | L2 cache, rate limits|
   +----+-------------+--------------+-------------+----+   | Socket.io pub-sub,   |
        |             |              |             |        | chat memory (REST)   |
        v             v              v             v        +----------------------+
+---------------+ +-------------+ +--------------+ +------------------+
|   PRISMA 6    | | VERCEL BLOB | | EXPRESS 4 +  | | NODEMAILER  ->   |
|   typed ORM   | | (documents) | | SOCKET.IO 4  | | GMAIL SMTP       |
+------+--------+ +-------------+ | alerts,rooms | | red alerts +     |
       |                          +------+-------+ | weekly digest    |
       v                                 |        +------------------+
+----------------------+                 | fan-out via Redis adapter
| POSTGRESQL 16 @ NEON |                 v
| pooled + direct URL  |       +--------------------+
| 16 models, JSONB,    |       | CONNECTED CLIENTS  |
| Decimal INR, PITR    |       | (other officers')  |
+----------+-----------+       +--------------------+
           |  features / model artefacts
           v
   +----------------------------------------------------+
   |         FASTAPI ML SERVICE (Python 3.12)           |
   |  /predict/delay  -> XGBoost + SHAP explanation     |
   |  /forecast/*     -> Prophet (fiscal + monsoon)     |
   |  utility models  -> scikit-learn                   |
   |  Docker 27 locally; free container host online     |
   +----------+--------------------+-------------------+
              |                    |
              v                    v
   +---------------------+   +---------------------------------------+
   | LLM LAYER           |   | DOC EXTRACTION PIPELINE               |
   | GPT-4o -> Gemini -> |<--| pdfplumber (tables) + PyMuPDF (pages) |
   | cache -> template   |   | + Tesseract OCR (scans)               |
   +----------+----------+   +-------------------+-------------------+
              |                                  |
              v                                  v
   +---------------------+        +--------------------------+
   | PINECONE (RAG)      |<-------| text-embedding-3-small   |
   | 800/100 chunks,     |  upsert| vectors + metadata       |
   | metadata filter,    |        +--------------------------+
   | 0.78 threshold      |
   +---------------------+
```

**Numbered flow — what actually happens, step by step:**

1. **Build.** A push to GitHub triggers Actions (turbo lint, typecheck, test); Vercel then rebuilds only the apps the turbo graph marks dirty and deploys them to the Edge Network.
2. **First visit.** The browser hits projectassure.vercel.app; Edge middleware checks the NextAuth JWT cookie before any page code runs; unauthenticated traffic is redirected to `/login`.
3. **Login and SSO.** NextAuth verifies credentials and issues a signed JWT; the first jump to analytics or ai uses a one-time 30-second handoff token — after that, all three apps accept the same session.
4. **Read path.** Server component → React Query cache (L1) → Upstash versioned key (L2) → Prisma over the pooled URL → Neon; misses are filled and the page streams.
5. **Write path.** Route handler validates with Zod, enforces RBAC, commits a Prisma transaction, bumps the cache version, and emits `task:moved` to the project room through the Redis adapter — every open Kanban patches instantly.
6. **Alerts.** The alert engine evaluates thresholds: an `Alert` row, a Socket.io `alert:new` broadcast, and — for red breaches — a Nodemailer email via Gmail SMTP; the weekly digest rides the same transporter.
7. **Upload.** A document passes Zod validation (MIME + 10 MB), lands in Vercel Blob, and gets a `Document` row; extraction fans out to pdfplumber (tables), PyMuPDF (pages/text), Tesseract (scans), then GPT-4o produces validated structured JSON.
8. **Indexing.** Chunks of 800 tokens with 100 overlap are embedded by text-embedding-3-small and upserted to Pinecone with project and department metadata for scoped retrieval.
9. **Prediction.** The nightly cron hits `/api/jobs/predictions`; the FastAPI service runs XGBoost (18 features + SHAP) and Prophet forecasts; results land in `PredictionResult`, recompute the 30/25/20/25 health score, and raise alerts when thresholds breach.
10. **AI chat.** The ai app checks RBAC, then calls GPT-4o with six tools (database via Prisma, predictions via FastAPI, retrieval via Pinecone); on failure or budget cap the chain falls back to Gemini, then cache, then a deterministic template.
11. **Protection.** Every API path passes Upstash rate limits (100 req/min API, 20 req/min chat); secrets exist only as environment variables, never in the repo.
12. **Operations.** Vercel analytics and logs watch the apps; a nightly Actions job triggers the retrain hook and a Postgres backup branch on Neon.

### In Plain English

> PART A was the parts list and PART B the room-by-room tour; PART C is the wiring diagram — how water from the tank actually reaches the kitchen tap. Follow the numbered steps like tracing one drop: it enters at the tank (GitHub), is filtered (Actions), flows through the main pipe (Edge Network) into the right room (one of three apps), draws from the right store (Postgres, Redis, Blob, Pinecone), gets processed where the heavy machinery lives (FastAPI, LLMs), and a receipt is emailed on the way out. Nothing is connected by hope; every pipe is labelled.

## PART D: Version Pinning

A stack is only reproducible if versions are pinned. Policy: npm packages use caret ranges **plus a committed `pnpm-lock.yaml`** (the lockfile, not the manifest, is the truth); Python uses exact `==` pins; Node is pinned by `engines` and `.nvmrc`; pnpm is pinned by the `packageManager` field (Corepack enforces it). This is what the jury would clone and run.

**Root `package.json`** (monorepo; `pnpm-workspace.yaml` declares `apps/*` and `packages/*`):

```json
{
  "name": "projectassure",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": { "node": ">=20.11.0 <21" },
  "scripts": {
    "dev": "turbo run dev --parallel",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "db:migrate": "pnpm --filter @projectassure/db migrate",
    "db:seed": "pnpm --filter @projectassure/db seed"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.6.2",
    "eslint": "^9.13.0",
    "prettier": "^3.3.3",
    "husky": "^9.1.6"
  }
}
```

**`apps/web/package.json`** (the officer-facing app; the other two apps are subsets of this):

```json
{
  "name": "@projectassure/web",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next-auth": "^5.0.0-beta.25",
    "@prisma/client": "^6.2.0",
    "@tanstack/react-query": "^5.62.0",
    "zustand": "^5.0.2",
    "react-hook-form": "^7.54.0",
    "zod": "^3.24.0",
    "framer-motion": "^11.15.0",
    "recharts": "^2.15.0",
    "d3": "^7.9.0",
    "socket.io-client": "^4.8.1",
    "@vercel/blob": "^0.26.0",
    "@upstash/redis": "^1.34.0",
    "@upstash/ratelimit": "^2.0.4",
    "nodemailer": "^6.9.16",
    "@projectassure/ui": "workspace:*",
    "@projectassure/db": "workspace:*",
    "@projectassure/types": "workspace:*",
    "@projectassure/config": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.6.2",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/node": "^20.17.0",
    "@types/d3": "^7.4.3",
    "@types/nodemailer": "^6.4.17"
  }
}
```

**`services/ml/requirements.txt`** (Python ML service; exact pins by policy):

```text
fastapi==0.115.5
uvicorn[standard]==0.32.1
pydantic==2.10.2
xgboost==2.1.3
prophet==1.1.6
scikit-learn==1.5.2
shap==0.46.0
pandas==2.2.3
numpy==1.26.4
joblib==1.4.2
pdfplumber==0.11.4
PyMuPDF==1.24.14
pytesseract==0.3.13
Pillow==11.0.0
openpyxl==3.1.5
httpx==0.28.0
python-multipart==0.0.17
```

A `.nvmrc` containing `20.18.0` sits at the repo root so every shell and CI runner picks the same Node.

**`.env.example`** — preserved verbatim from the original document; every variable is set per-project in the Vercel dashboard:

```env
# === DATABASE ===
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/projectassure?sslmode=require
DIRECT_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/projectassure?sslmode=require

# === AUTHENTICATION ===
NEXTAUTH_URL=https://projectassure.vercel.app
NEXTAUTH_SECRET=your-random-256-bit-secret

# === EMAIL (Gmail SMTP) ===
EMAIL_USER=projectassure.mail@gmail.com
EMAIL_PASS=your-16-char-app-password

# === AI / LLM ===
OPENAI_API_KEY=sk-xxx
GEMINI_API_KEY=AIzaXXX

# === VECTOR DATABASE ===
PINECONE_API_KEY=xxx-xxx-xxx

# === REDIS (Upstash) ===
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# === OBJECT STORAGE ===
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

# === CROSS-DOMAIN URLS ===
MAIN_APP_URL=https://projectassure.vercel.app
ANALYTICS_APP_URL=https://analytics.projectassure.vercel.app
AI_ENGINE_URL=https://ai.projectassure.vercel.app

# === PYTHON ML SERVICE ===
ML_SERVICE_URL=http://localhost:8000  # Local dev only
```

### In Plain English

> Version pinning is the difference between a recipe that says "two cups of rice, exactly" and one that says "some rice". Write "some rice" and every cook gets a different dish depending on their mood and their cup; write "two cups" and a teammate on another laptop, or a jury re-running your repo six months later, cooks the identical meal. The lockfile, the `==` pins and the `.nvmrc` are simply the "two cups" of software.

## PART E: Free-Tier Budget Table

The INR 0 claim is not a slogan; it is a set of quotas we track. Limits are as published by each provider for their free/starter tiers (subject to change; re-verified before submission). "Expected usage" is our own build-plus-demo-month estimate.

| # | Service | Free Limit | Expected Usage | Headroom |
|---|---------|-----------|----------------|----------|
| 1 | Vercel Hobby | 100 GB bandwidth/mo; generous serverless invocation limits | ~10-12 GB across 3 apps in the heaviest month | ~8x |
| 2 | Neon (PostgreSQL) Free | 0.5 GB storage; ~190 compute hrs/mo; autosuspend | ~120 MB data; ~30 active hrs during build/demo | ~4x storage, ~6x compute |
| 3 | Upstash Redis Free | 10,000 commands/day; 256 MB | ~2,500 commands/day (cache + rate limits + pub-sub + chat memory) | ~4x |
| 4 | Pinecone Starter | 1 serverless index; ~100K vector capacity | ~20,000 vectors (~600 doc chunks + margin) | ~5x |
| 5 | OpenAI GPT-4o | Small trial credit, then pay-as-you-go | ~USD 2 equivalent via aggressive caching + short prompts | Circuit breaker caps worst case well under INR 200 |
| 6 | Google Gemini (AI Studio) | Free tier: ~15 RPM, ~1,500 req/day (model-dependent) | ~250 req/day at peak (fallback + overflow traffic) | ~6x |
| 7 | GitHub + Actions | Unlimited repos; 2,000 Actions min/mo (private) | ~150 CI minutes/month | ~13x |
| 8 | Vercel Blob (Hobby) | ~1 GB stored; ~10 GB egress | ~250 MB of project PDFs, photos and OCR outputs | ~4x |
| 9 | Gmail SMTP (App Password) | ~500 recipients/day (consumer account limit) | ~30 alert/digest emails/day | ~16x |
| 10 | Docker Desktop + Docker Hub | Free for personal/small teams; unmetered pulls at our scale | 1 ML image (~1.2 GB local) + realtime image | No metered cost |
| 11 | Turborepo Remote Cache | Free with a Vercel account | ~400 MB cached build artefacts | Effectively unlimited |
| 12 | OSS core (Next.js, Prisma, FastAPI, XGBoost, Prophet, shadcn/ui, Socket.io, D3) | MIT/Apache — INR 0 forever | Full framework use | No ceiling |

**Reading the table honestly.** Rows 1-4 are the only quotas that could theoretically bind during judging week, and each carries 4x or better headroom. Row 5 is the only line with a nonzero worst case: the OpenAI credit is spent on quality-critical paths (extraction, agent tools) while Gemini (row 6) absorbs bulk traffic — that division is exactly what keeps the worst case under the cost of a movie ticket.

### In Plain English

> This table is our prepaid mobile plan check. Every service gives a free pack — data, minutes, SMS — and we logged how much of each pack we actually burn in the heaviest month. The "headroom" column is the remaining balance: even if the demo week goes viral inside the campus, we are drawing on a pack that is at least four times larger than our usage. The one pack that can run dry (OpenAI) has a duplicate SIM (Gemini) that takes over automatically.

## PART F: "Why not X?" FAQ

The eight questions we expect in the viva, answered with the trade-offs included — because a stack that cannot state its own weaknesses is a stack nobody trusts.

**Q1. Why not MongoDB?**
Our domain is deeply relational: projects, milestones, tasks, dependencies, budgets and resources reference each other with integrity constraints that money and audit trails demand. MongoDB would push join logic into application code and give up ACID guarantees across those references — exactly where budget figures must never drift. JSONB already gives us document-style flexibility inside Postgres where it helps (extraction payloads, audit diffs). MongoDB also needs a second vendor for vectors, while Postgres and Pinecone already cover our needs. Honest trade-off: Mongo's flexible schema speeds up the first week; we pay that back with interest by week two, when relationships arrive.

**Q2. Why not AWS?**
AWS is the right answer for a dedicated platform team, not a 33-hour build. The free tier is fragmented across dozens of services with 12-month expiries, IAM policy setup consumes hours, and one misconfigured autoscaling group can produce a bill — an unacceptable risk at INR 0. Vercel gives us deploys, CDN, serverless, cron and previews with zero configuration and zero billing surface. The migration path is honest and explicit: S3, SES and RDS appear throughout this document as production upgrade targets, so AWS is where we grow into, not where we start.

**Q3. Why not Django for everything?**
Django would actually cover the CRUD side respectably — but our backend is deliberately two languages with a seam. TypeScript (Next.js route handlers) owns the API because it shares types with the frontend through one package; Python (FastAPI) owns the models because XGBoost, Prophet, scikit-learn and SHAP are Python-native. Django for everything would mean either a heavier monolith that drags the ORM into a stateless model service, or Django templates fighting our React frontend. FastAPI's async endpoints, Pydantic validation and auto-docs fit a model service far better than Django's batteries — which are aimed at batteries-needing apps.

**Q4. Why TypeScript everywhere (on the web side)?**
Because three apps share data, and shared data without shared types is a rumour mill. One `@projectassure/types` package means a field renamed in the schema breaks the build in every consumer at compile time, not in the demo at runtime. Zod schemas validate API input and generate the same types, Prisma generates database types, and React Query generics carry them to components. JavaScript would let all of that drift silently. The cost is a compile step and stricter discipline — cheap compared to one undefined-property crash during judging.

**Q5. Why two LLM providers?**
Resilience and economics. A single vendor is one outage, one rate limit, or one empty credit balance away from a dead demo; our circuit-breaker chain (GPT-4o → Gemini → cache → deterministic template) makes that path survivable at every link. Cost-wise, GPT-4o handles quality-critical work (extraction, tool-calling) while Gemini's free tier absorbs bulk traffic, keeping worst-case spend under INR 200. Dual-vendor also prevents lock-in: prompts are provider-agnostic, and swapping either provider is a configuration change, not a rewrite.

**Q6. Why Pinecone over pgvector?**
Three reasons, one honest concession. Serverless operations: Pinecone needs zero infrastructure management, pgvector makes index tuning our job. Quota protection: vectors would consume Neon's 0.5 GB free storage — our relational data needs every megabyte of it. Filtering maturity: Pinecone's metadata filters (project, department, doc type) are central to our per-project security model. The concession: pgvector means one fewer vendor and SQL joins between vectors and rows, and it is our designated fallback if Pinecone's free tier changes — the abstraction layer at the retrieval boundary keeps that swap cheap.

**Q7. Why Vercel over Railway (or Render)?**
Vercel is made by the makers of Next.js: our three apps deploy with zero configuration, get a permanent preview URL per pull request, and run on a Hobby plan that covers bandwidth, functions, cron and the Edge Network at INR 0. Railway no longer has a free tier (trial credit only), which fails our first constraint outright; Render is solid but its free web services spin down awkwardly. The honest exception we state openly: the Express + Socket.io gateway needs an always-on process, so it runs in a container on free container compute — the one workload Vercel's serverless model cannot host natively.

**Q8. Why a monorepo?**
Because our unit of change crosses app boundaries constantly: a health-score tweak touches the shared types package, two apps' components, and the API layer — as one atomic pull request, or as three drifting repositories. The monorepo gives us one dependency lockfile, one CI pipeline (turbo runs only what changed), and instant imports of `@projectassure/ui`, `/db`, `/types` and `/config`. The costs are real and managed: a bigger clone (pnpm's store keeps it small), and turbo configuration discipline. Polyrepo would trade those costs for version skew — three apps quietly disagreeing about what a "project" is.

### In Plain English

> PART F is the doctor's consultation, not the advertisement. A good doctor never just prescribes; she explains why she chose this medicine, what the cheaper alternative would and would not treat, and what side effects to watch. That is what these eight answers do: each one names the rival, concedes what the rival does better, and then explains why those strengths matter less for ProjectAssure than the strengths of what we shipped. Juries do not trust teams with no doubts — they trust teams that examined theirs.

---

*This document is part of the ProjectAssure SIH 2026 submission.*
