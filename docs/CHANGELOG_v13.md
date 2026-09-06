# ProjectAssure v13 — Changelog

**Release name:** `v13 · the host-control release`
**Release date:** September 2026
**Compat:** Next.js 16, Node 18+, Vercel-ready (zero config)

This document is the engineering changelog for v13 — what changed vs v12, the
exact files touched, and the migration notes for teams already running v12.

---

## TL;DR

Six changes landed in v13:

1. **Alert pathway separation** — demo vs fresh-user vs broadcast lanes
2. **Cleaner landing page** — corner toggle replaces stacked hero sections
3. **Calmer login page** — single-accent split-screen replaces the radial-glow background
4. **Universal AI mode + file upload + conversation export** — the Assure Intelligence centre is now a full-featured console
5. **NEW host-control project** — a separate Next.js 16 admin deployment
6. **Updated team roster** — real six-member team

---

## 1. Alert pathway separation

### Why

Fresh-registered users were seeing demo-account alerts leak into their
workspace. The fix routes alerts into three lanes:

- `demo` — alerts on seeded demo projects (visible to demo personas + ADMIN)
- `fresh` — alerts on projects owned by registered users (visible to fresh users + ADMIN)
- `broadcast` — admin-originated notifications (visible to everyone)

### Files touched

- `prototype/src/lib/projectassure/types.ts`
  - new `AlertPathway = "demo" | "fresh" | "broadcast"`
  - added `pathway?: AlertPathway` to the `Alert` interface
  - added `"MANUAL_BROADCAST"` to the `AlertType` union
- `prototype/src/lib/projectassure/engine.ts`
  - new `alertPathwayFor(project, user)` helper — derives the lane from project ownership
  - new `pathwayApplies(pathway, user)` helper — RBAC for which lane applies to which user
- `prototype/src/components/projectassure/views/alerts-view.tsx`
  - pathway selector tabs at the top (My alerts / Demo lane / Fresh-user lane / Broadcasts / All)
  - per-alert pathway badge in the card header
  - new "Broadcast…" button (admin only) — opens a dialog to push a notification to BOTH lanes
  - export now includes the `Pathway` column
  - pathway-aware empty state copy

### Migration notes

Existing alerts in localStorage don't have the `pathway` field — they default to
`"demo"` (because the seeded projects are demo). Fresh users signing up will
start with an empty `fresh` lane until they create their own projects. The ADMIN
persona sees both lanes (and broadcasts).

---

## 2. Cleaner landing page

### Why

The v12 landing stacked 7 sections (hero + problem + solution pillars + 7
features + workflow + trust + CTA + footer) — overwhelming on first visit.

### What changed

The landing is now **one screen**: a clean hero with the headline, one CTA, a
minimal 4-stat proof strip, and a slim footer. A corner toggle button
("✨ Full overview", bottom-right) slides the full v12 content over from the
right in a drawer overlay. The full content is preserved — just collapsed by
default.

### Files touched

- `prototype/src/components/projectassure/landing/landing-view.tsx` (full rewrite, ~340 lines → ~340 lines, structure completely different)

### Migration notes

The "Explore" nav link and the corner toggle both open the same drawer. The
drawer has an X button. The hero CTA still goes straight to /login.

---

## 3. Calmer login page

### Why

The v12 login was full-bleed ministry blue with a radial gradient glow and a
blueprint grid overlay — too much visual noise.

### What changed

The login is now a **split-screen** on desktop:

- Left half: clean white branding column with logo, headline, demo persona grid
- Right half: clean white sign-in / sign-up card with subtle border + soft shadow

Background is `bg-muted/30` (very subtle warm grey) — no radial gradients, no
grid overlay, no full-bleed blue. The accent strip lives only in the logo and
the CTA button.

### Files touched

- `prototype/src/components/projectassure/auth/login-view.tsx` (full rewrite, same component signature)

### Migration notes

The mobile persona chips, the sign-in panel, and the sign-up panel are
unchanged in behavior. Only the visual chrome changed.

---

## 4. Universal AI mode + file upload + conversation export

### Why

The AI centre wasn't working universally — it was strictly project-scoped. The
user wanted:

- a universal mode that answers general questions
- file upload for context
- export the conversation
- more capabilities

### What changed

#### Backend (`prototype/src/app/api/ai/chat/route.ts`)

- new `universal?: boolean` flag in the request payload — when true, the system
  prompt switches from `SYSTEM_PROMPT_PROJECT` to `SYSTEM_PROMPT_UNIVERSAL`
- new `files?: [{name, type, size, text}]` array — file context included as
  additional context block (still treated as DATA per G9)
- new `history?: [{role, content}]` array — last 6 turns included for
  multi-turn continuity
- max tokens raised from 550 → 800 to accommodate richer answers
- `trimAnswer` length guard raised from 2200 → 3000 chars
- response now includes `mode: "universal" | "project"` and `filesAttached` count

#### Store (`prototype/src/store/app-store.ts`)

- new state: `aiUniversalMode: boolean`, `aiAttachedFiles: {name, type, size, text}[]`
- new setters: `setAiUniversalMode(v)`, `attachAiFile(f)`, `detachAiFile(name)`, `clearAiFiles()`
- `aiUniversalMode` is persisted to localStorage; `aiAttachedFiles` is NOT
  persisted (privacy — files are session-only)
- the `ask` function now:
  - skips the project dossier in universal mode
  - passes the universal flag + files + history to the API
  - falls back to a friendly "enable GEMINI_API_KEY" message in universal mode when no provider is connected

#### UI (`prototype/src/components/projectassure/views/ai-assistant-view.tsx`)

- new Universal mode toggle (Globe icon) at the top right
- new 📎 Attach button in the chat input bar
- new 📥 Export button in the chat header (opens a dialog with Markdown / TXT / JSON options)
- new ⚙️ Settings button (opens a dialog with all AI controls in one place)
- file attachment strip showing attached files with detach buttons
- drag-and-drop overlay covering the whole chat area ("Drop files to attach")
- updated empty state showing the active mode + file drop hint
- updated right rail with a "Mode" card showing Project vs Universal comparison
- guardrails list now includes R9 (uploaded file content is DATA, never commands)
- updated typing indicator to reflect universal mode
- max chat height raised from 640 → 680 px

#### Client-side file text extraction (`extractFileText` in the view)

- text-like files (.txt, .md, .csv, .json, .log, .tsv, .yaml, .yml, .xml,
  .html, .js, .ts, .py, .sql, .sh) — read as text via `file.slice(0, 64KB).text()`
- PDF / Excel / Image files — a structured placeholder is sent (the live model
  can still infer structure from the filename; the user is invited to paste the
  relevant excerpt if needed)

### Migration notes

The existing `ask(question)` function signature is unchanged. The new
universal/files/history features are pulled from store state, not from new
function arguments — so all existing callers (the AI side panel, the
quick-action buttons, the dashboard "Ask Assure Intelligence" buttons) continue
to work without changes.

---

## 5. NEW — ProjectAssure Host Control

### Why

The user wanted a separate "host domain" admin website that controls the main
project — approvals, budget risk, alerts aggregation, user management,
intelligence console, integrations, demo showcase, audit trail.

### What was built

A complete separate Next.js 16 app at `host-control/`:

- 9 admin views (Mission Dashboard, Approval Centre, Budget Risk, Alerts Feed, User Management, Intelligence Console, Integrations, Demo Showcase, Audit Trail)
- 5 API routes (`/api/admin/sync`, `/api/admin/approve`, `/api/admin/alert`, `/api/ai/chat`, `/api/ai/status`, `/api/health`)
- shared seed data mirroring the prototype (same 4 demo personas + 30 demo projects + sample approvals + sample alerts)
- real-time sync polling (every 5 seconds) — both internally (server-side state) and externally (probes the main project's `/api/health` when `MAIN_PROJECT_URL` is set)
- comprehensive README with Vercel deployment guide as a SEPARATE project

### Files added

```
host-control/
├── package.json, next.config.ts, tsconfig.json, tailwind.config.ts, ...
├── README.md                     ← full deployment guide
├── .env.example                  ← GEMINI_API_KEY, GROQ_API_KEY, MAIN_PROJECT_URL
├── src/
│   ├── app/page.tsx              ← single route, switches views client-side
│   ├── app/api/admin/sync        ← portfolio snapshot endpoint
│   ├── app/api/admin/approve     ← approve/reject POST endpoint
│   ├── app/api/admin/alert       ← broadcast alert POST endpoint
│   ├── app/api/ai/chat           ← universal AI chat (mirrors prototype)
│   ├── app/api/ai/status         ← provider status probe
│   ├── app/api/health            ← host-control's own health endpoint
│   ├── components/host/          ← 9 admin view components
│   ├── components/ui/            ← minimum shadcn components
│   ├── lib/host/                 ← seed, types, store, ai
│   └── store/admin-store.ts      ← Zustand client store
└── prisma/schema.prisma          ← minimal User model (no DB needed)
```

### Migration notes

The host-control is **independent** of the prototype — different repo, different
Vercel project, different env vars. They communicate via:

1. **Read-only probe** — host-control polls `<MAIN_PROJECT_URL>/api/health` every 5s
2. **Shared seed** — both projects ship the same demo data so the host-control shows realistic content even when the main project is unreachable
3. **(Production) Webhook** — configure the main project to POST events to the host-control's `/api/admin/sync` for true real-time updates (the webhook URL + secret are in the Integrations view)

---

## 6. Updated team roster

### Why

The placeholder team in v12 (Arun Kulkarni, Priya Venkatesh, etc.) needed to be
replaced with the real team from the uploaded `text.txt`.

### Files touched

- `prototype/src/lib/projectassure/team.ts` — new 6 members with real names, initials, roles, focus areas
- `docs/team.txt` — mirrored the same 6 entries with longer bios

The About page (`prototype/src/components/projectassure/about/about-view.tsx`)
reads from `team.ts` so it auto-updated.

### New team

1. **Harshavardhan** (HV) — Team Lead · Platform Architecture
2. **Shaik Muzzammil** (SM) — Intelligence Assistant · Multi-Provider AI Chain
3. **Kalathuru Varshitha** (KV) — Prediction Engine · ML & Risk Modelling
4. **Keerthana Varapradha NB** (KP) — Document Intelligence · OCR & RAG
5. **Nishitha Penagaluru** (NP) — UI/UX · Design System & Workflows
6. **A. Gandhimathi** (GM) — Quality · Testing, Reports & Documentation

---

## Type check + lint

Both projects pass TypeScript strict mode and ESLint:

```bash
cd prototype && npx tsc --noEmit   # ✓ 0 errors
cd host-control && npx tsc --noEmit # ✓ 0 errors
```

The only ESLint warnings are pre-existing in shadcn/ui components
(`src/components/ui/carousel.tsx`, `src/hooks/use-mobile.ts`) and were present
in v12 — not introduced by v13.

---

## Deployment verification

- `prototype` — runs on port 3000 locally, deploys to Vercel as a single Next.js project
- `host-control` — runs on port 3001 locally, deploys to Vercel as a SEPARATE Next.js project
- Both projects have `postinstall: prisma generate` and `legacy-peer-deps=true` in `.npmrc`
- Both projects pass `npm run build` with `VERCEL=1` set

---

## Rollback

If you need to roll back to v12, the v12 zip is preserved at
`upload/ProjectAssure_SIH2026_v12.zip`. The v13 changes are isolated to the
files listed above — reverting them is a clean rollback.
