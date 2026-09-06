# ProjectAssure — Workflow & Implementation Guide

**How every capability in the v4 ULTRA prototype is actually implemented — file by file.**
This is the engineering map: the five-question workflow, where each feature lives, what
code powers it, and how the deterministic demo maps to the production architecture.

---

## 1. The core workflow — the heart of the platform

Every feature answers one link in this chain:

```
DATA → MONITOR → DETECT → PREDICT → EXPLAIN → RECOMMEND → ACT → VERIFY
```

| Link | Question it answers | Where it lives (click) | Code that powers it |
|---|---|---|---|
| **DATA** | What do we know? | Reports & Documents (upload) | `lib/ocr.ts` (extract → structure → validate), `lib/rag.ts` (embed → index) |
| **MONITOR** | What is the current state? | Command Centre / Project Overview | `lib/engine.ts` (recompute), `lib/ml.ts` (18 features) |
| **DETECT** | What is going wrong *right now*? | Early Warnings / attention panel | `lib/engine.ts` (rule evaluation R1–R12), `lib/recommendations.ts` (buildAttentionList) |
| `lib/projectassure/monitor.ts` | **v5**: live derivations for the Simple Monitoring Suite — cost benchmarks, budget variance, progress mismatch, risk scores, contracts, change orders, authority rollup, simple overview + shared CSV/Excel row builders |
| **PREDICT** | What will go wrong *next*? | Risk & Intelligence tab | `lib/ml.ts` (delay model + calibration + CI) |
| **EXPLAIN** | Why? | Risk factors / root-cause tree | `lib/ml.ts` (factor contributions), `lib/recommendations.ts` (buildRootCauseTree) |
| **RECOMMEND** | What should the authority do? | Plan of Action tab | `lib/recommendations.ts` (buildRecommendedActions) |
| **ACT** | Is anyone doing it? | Interventions Centre | `store/app-store.ts` (intervention lifecycle actions) |
| **VERIFY** | Did it actually get fixed? | Interventions → Verified/Closed | evidence counts + document vault + audit trail |

---

## 2. The intelligence engine (`src/lib/projectassure/`)

| Module | Lines | Responsibility | Key exports |
|---|---|---|---|
| `types.ts` | ~640 | Domain model — mirrors the 16-model Prisma schema 1:1. All v3 additions: Intervention lifecycle, RecommendedAction, ProjectKpi, RootCauseNode, NoActionProjection, ExecutiveSummary, GlossaryTerm | `INTERVENTION_FLOW`, `ACTION_AREA_META`, `DEFAULT_THRESHOLDS` |
| `seed.ts` | 455 | Deterministic demo world (30 projects frozen at 10 Sep 2026): 4 story projects + 26 healthy, 6 personas, departments, alerts, notifications, emails, audit history | `buildWorld`, `USERS`, `DEPARTMENTS` |
| `ml.ts` | 355 | 18-feature vector, predictive delay probability + estimated days + 90% CI, cost-forecast budget forecast with seasonality, champion/challenger registry, PSI drift; **v4 early-phase neutrality** (day-0 projects are neutral, not penalised) | `extractFeatures`, `computeDelayPrediction`, `computeBudgetForecast`, `MODEL_REGISTRY` |
| `engine.ts` | — | Health recompute (30/25/20/25 weights → band), RBAC scoping (ownership-aware), alert rule evaluation; **v4 baseline prediction for PLANNING projects** | `recomputeProject`, `scopedProjects`, `evaluateAlertRules` |
| `recommendations.ts` | 340 | **v3 decision layer**: recommended actions (What/Why/Do/Owner/Deadline/Impact), no-action 30/60/90 projection, root-cause tree, executive summary, KPI seeds, attention ranking, intervention factory | `buildRecommendedActions`, `projectNoActionImpact`, `buildRootCauseTree`, `buildExecutiveSummary`, `seedKpis`, `buildAttentionList` |
| `geo.ts` | 90 | 36-state coordinate table, deterministic district geocoding (same district → same map spot), drill hierarchy National→State→District | `geocodeProject`, `regionFor`, `STATE_GEO` |
| `glossary.ts` | 120 | 30 plain-language term explanations across 5 categories (metric/ml/process/security/platform) — rendered by Help view + InfoTips | `GLOSSARY`, `glossaryById` |
| `agent.ts` | ~330 | Deterministic grounded assistant engine: intent classification (7 intents incl. v4 `action_plan`) → 8 real tools → grounded, cited, markdown answers with R1–R12 compliance; **v4 `buildProjectActionPlan`** = the project-scoped Intelligence recommended system (verdict, ranked actions, root causes, KPIs, cost-of-inaction) | `answerQuestion`, `buildProjectActionPlan`, `QUICK_ACTIONS`, `AGENT_TOOLS` |
| `rag.ts` | 120 | Vector store: 256-dim hashing embeddings, cosine similarity, top-k retrieval with file+page citations | `buildIndex`, `search` |
| `ocr.ts` | 120 | Document pipeline: real TXT/CSV/MD/JSON parsing, staged OCR simulation for PDF/XLSX/images, field structuring with confidence | `extractRawText`, `structureFields`, `makeDocument` |
| `reports.ts` | 301 | Branded PDF (jsPDF), multi-sheet Excel (SheetJS), CSV — 5 report kinds | `buildReport`, `downloadPdf`, `downloadExcel`, `downloadCsv` |
| `email.ts` | 110 | 6 templates, compose + send chain (real API → honest status), provider-aware error surfacing | `composeEmail`, `sendEmail`, `EMAIL_TEMPLATES` |
| `events.ts` | 90 | Live portfolio heartbeat (every 40s): progress drift, milestone completions, alert firing — the WebSocket event contract | `nextPortfolioEvent` |
| `nlp.ts` | 59 | Intent classification, sentiment, keywords, extractive summaries | `classifyIntent` |
| `auth-crypto.ts` | — | PBKDF2-SHA256 (100k iterations, 128-bit salt) via Web Crypto, password policy + strength | `hashPassword`, `verifyPassword` |
| `permissions.ts` | 66 | RBAC matrix (26 permissions × 4 roles), view visibility per role, severity rank | `can`, `VIEWS_BY_ROLE` |
| `doc-corpus.ts` | — | Real RAG corpus (48 documents' text) frozen for reproducible citations | `DOCS` |

---

## 3. The application layer

**Store** — `src/store/app-store.ts` (~870 lines): Zustand + persisted. Every mutation
recomputes health, re-evaluates alert rules, appends an audit entry, and can trigger
email — nothing is a toast-only lie. v3 additions:

| Action | What it does |
|---|---|
| `askAi(question)` | Opens the AI side panel and runs the question. **v3 bug fix**: this action was referenced by 6 components but never defined — every Ask-AI button crashed. Now real, with error recovery. |
| `setAiOpen` / `clearAiSeed` | Panel visibility control (v3 fix — same class of bug) |
| `createIntervention` | Opens a tracked issue with recommended steps, assigns owner/deadline, notifies + audits |
| `advanceIntervention` | Moves one step along the 7-stage lifecycle with a note; requires resolution note to close |
| `reopenIntervention` | Reopens a closed issue with a reason |
| `toggleInterventionStep` | Checks off corrective steps |
| `createProject` | **v3**: unique PS-ID (max+1), geocoded from state/district (was random), KPI seeds, duplicate-name guard |
| `ask` | AI question runner — **v3**: RBAC-scoped portfolio (viewers only see their scope), live-mode chain |
| `applyNextEvent` | Live feed tick — **v3**: recomputes health through the engine so the status band can never desync from the score |
| `markTourSeen` | First-visit tour state |

**API routes** — `src/app/api/`:

| Route | Method | Provider chain | Notes |
|---|---|---|---|
| `/api/email/send` | POST | SMTP (Gmail 465 TLS / 587 STARTTLS auto) → Brevo v3 API → Resend API → honest outbox | From-address auto-fixed for Gmail; per-error actionable hints |
| `/api/email/send` + `/api/email/status` | GET | — | Live diagnostics: which provider is configured + a real SMTP `verify()` attempt |
| `/api/ai/chat` | POST | Gemini (`2.0-flash → 1.5-flash → 1.5-flash-8b`) → z-ai sandbox → 503 (client falls back to deterministic) | R1–R12 system prompt, grounded portfolio snapshot |
| `/api/auth/register` / `login` | POST | Prisma + scrypt against Neon (503 SIMULATION_MODE without DATABASE_URL) | Validation, audit, department resolution by code |
| `/api/health` | GET | — | Env posture (DB/AI/email flags) |
| `/api/users` | GET | Prisma | Admin user directory in connected mode |

---

## 4. The 27 screens (v5: +9 Simple Monitoring Suite)

| Screen | Route | Highlights (v3 additions in bold) |
|---|---|---|
| **Simple Overview** | `#/app/monitor` | **v5**: 4 live big numbers, clickable progress leaders, risk distribution, latest alerts |
| **Risk Scores** | `#/app/risk-score` | **v5**: 0–100 per project, band chips, ML delay probability, top-3 drivers, inline run-model |
| **Budget Variance** | `#/app/budget-variance` | **v5**: approved/revised/spent/remaining + utilisation + overrun callout |
| **Cost Benchmark** | `#/app/cost-benchmark` | **v5**: sanctioned vs intelligence fair-cost vs live trajectory, anomaly callout, CSV/Excel |
| **Progress Mismatch** | `#/app/progress-mismatch` | **v5**: dual bars physical vs financial, gap banding, interpretations |
| **Procurement** | `#/app/procurement` | **v5**: contract vs fair-price benchmark, flags, vendor watchlist |
| **Change Orders** | `#/app/change-orders` | **v5**: register + decision queue + pipeline value banner |
| **Authority Review** | `#/app/authority-review` | **v5**: escalation-filtered, one action each, briefing-PDF export |
| **Project Search** | `#/app/search` | **v5**: one box, vendor-aware, quick chips |
| Landing | `#/` | 26-capability wall, workflow chain, stack, KPIs, sign-up CTA |
| About | `#/about` | Mission, integrity, timeline |
| Login | `#/login` | Two-panel: left brand/security, right **plain-language description of both sign-in ways** |
| Command Centre | `#/app/dashboard` | **Requires-attention-today panel**, KPI cards, donut, burn trend, alerts, ranking |
| Projects | `#/app/projects` | Table+**live map** (drill-down, tracking feed), 6-step wizard (**validation, geocoding, per-file toasts**), exports |
| Project Detail | `#/app/project-detail/:id/:tab` | 11 tabs incl. **Plan of Action**; **Executive Summary**, **KPI strip** on Overview |
| Compare | `#/app/compare` | **New**: 4-project side-by-side, verdict |
| Early Warnings | `#/app/alerts` | Severity filters, acknowledge (R10), rules editor |
| Interventions | `#/app/interventions` | **New**: 7-step lifecycle, steps, updates, raise dialog |
| Reports & Docs | `#/app/reports` | Ingestion pipeline, report factory, export history |
| Email Centre | `#/app/email-center` | Outbox (**FAILED + hints**), compose, **diagnostics + setup guide** |
| Assure Intelligence | `#/app/ai-assistant` | Agentic chat (**fixed panel actions**), tools registry, live-mode toggle (persisted) |
| Prediction Engine | `#/app/model-lab` | Champion/challenger, calibration, PSI, retrain |
| Vector Store | `#/app/vector-store` | Corpus browser, search tester |
| Help & Glossary | `#/app/help` | **New**: 2-min tour, 30 terms, FAQ |
| **Workflow Guide** | `#/app/workflow` | **v4**: 10-stage platform walkthrough, 4-domain map, security summary — the in-app team guide |
| Admin | `#/app/admin` | Users, thresholds, rules, deployment, audit |
| Notifications / Audit | `#/app/notifications`, `#/app/audit` | **New standalone routes** (were dead links) |

Plus: the **AI slide-over panel** (every screen, `/` shortcut), **⌘K command palette**,
**onboarding tour** (first login), and the 40-second **live event heartbeat**.

---

## 5. Understandability layer (v3)

The single biggest v3 theme: *a first-time visitor must understand the platform.*

| Mechanism | Implementation |
|---|---|
| First-visit tour | `shared/onboarding-tour.tsx` — 4 steps, shows once (`tourSeen` persisted), quick-links |
| Glossary | `views/help-view.tsx` + `lib/glossary.ts` — searchable, 5 categories, "where it appears" |
| Inline tooltips | `InfoTip` in `shared/ui-bits.tsx` — a “?” chip on every metric label that could confuse |
| Plain-language actions | `lib/recommendations.ts` — What/Why/Do structure everywhere |
| Executive summaries | Sentences, not graphs: “spending is 28% ahead of work…” |
| Login descriptions | Right-panel explainer: demo personas vs registered accounts |
| Honest statuses | SIMULATED ≠ SENT; FAILED shows the reason + hint; predictions carry CIs |

---

## 5b. v4 additions — onboarding, scoping and export coverage

| Capability | Implementation | Where |
|---|---|---|
| 10-stage in-app workflow guide | `views/workflow-view.tsx` (10 STAGES + 4 DOMAINS + security panel) | `#/app/workflow`, all roles |
| Team guide document | `docs/TEAM_GUIDE.md` (login → every feature, click-paths, FAQ, 2-min demo script) | zip docs |
| Project-scoped AI | store `aiContextProjectId` + `setAiContext`; `askAi(question, projectId)`; `ask()` routes to `buildProjectActionPlan` when a context project exists; AI panel context chip with ✕ | Ask AI in project detail; Assure Intelligence |
| `action_plan` intent | `nlp.ts INTENT_PATTERNS` + `answerQuestion` branch → worst-or-named project plan | any "what should I do" question |
| Baseline prediction | `engine.ts` + `runPrediction` PLANNING branch → `PredictionResult.isBaseline`; UI badge "Baseline (pre-execution)" | new project → Run prediction |
| Visible prediction feedback | `pushNotification` on every run (success or honest "not available") | project header |
| Day-0 neutrality | `ml.ts earlyPhase` guards on `progressVsElapsed`, `daysBehind`, `burnRatio` | every new project |
| Wizard stage | `ProjectForm.stage` → createProject status | New project step 2 |
| Pipeline strips | `ui-bits.tsx PipelineStrip` (labels + hover hints) | 8 screens |
| Domain-wide exports | `exportPortfolio`, `exportAlerts`, `exportInterventions`, `exportComparison`, `exportDeliveryLog`, `exportRegistry` | screen headers |
| Login left explainer | 3-step how-it-works panel | login page |

## 6. Deterministic demo → production mapping

| Demo (in-browser, zero keys) | Production (env keys set) |
|---|---|
| localStorage persistence (quota-safe) | Neon PostgreSQL via Prisma (16 models) |
| 40s event engine heartbeat | Socket.io rooms + Redis adapter (same event contract) |
| Deterministic agent engine | Gemini live LLM (same R1–R12 prompt, grounded snapshot) |
| Outbox email previews | SMTP / Brevo / Resend real delivery via `/api/email/send` |
| Hash-based routing on one port | 3 Vercel deployments with `NEXT_PUBLIC_PORTAL` + shared-JWT SSO |
| In-browser OCR simulation | Tesseract (eng+hin) + pdfplumber FastAPI microservice |

Switching is **environment variables only** — no code changes. See
`docs/DEPLOYMENT_GUIDE.md` for the full key matrix.

---

## 7. Verification (what "everything works" is proven against)

- `npx tsc --noEmit` → **0 errors** (strict)
- `npx eslint src/` → **0 errors**
- Browser end-to-end (Playwright): login → tour → attention panel → intervention created
  (#A1024) and advanced → compare verdict → glossary search → AI panel answered with
  tool trace → project detail exec-summary/KPIs/plan-of-action → wizard created
  PRJ-2026-1212 with geocoded coordinates, 1 doc PROCESSED, 3 KPIs, 4 milestones →
  dark+light contrast audits → email diagnostics API → map drill-down → deep-link reload
- 12 screenshots in `screenshots/`


---

## v6 — Route/nav changes

- Sidebar = flat 7 features per role (`VIEWS_BY_ROLE` in `src/lib/projectassure/permissions.ts`); all other ViewIds remain routable (hash routes unchanged: `#/app/<view>`).
- Login = split screen; persona cards drive the prefilled sign-in; sign-up creates a per-user workspace (unchanged engine, new chrome).
- `goPage("app")` now routes to `monitor` (the Dashboard) instead of `dashboard` (Command Centre).
- `NAV_META` groups are cosmetic only (`""` = visible flat list, `_hidden` = deep screens reachable via links/⌘K).


## v9 — live-risk chain mapping

| Link | Implementation |
|---|---|
| Document → risks | `src/lib/projectassure/risks.ts` `scanDocumentRisks()` — 45 regex patterns across 8 categories; `ocr.ts structureFields()` surfaces them in the ingest result |
| Upload → register | `app-store.ingestDocument()` — re-derives the register from ALL documents + engine + context, syncs `riskAssessment`, re-runs the prediction, raises ≤4 high-severity alerts, notifies with counts |
| Create → full workspace | `app-store.createProject()` — `buildInitialBudgetRecords` (S-curve), `buildInitialResources`, `starterAlerts`, auto prediction, `riskAssessmentFromRegister`, live "onboarded" event |
| Heartbeat → real-time | `events.ts nextPortfolioEvent()` — 15s interval; kinds include `new-alert` (real alert + action) and `prediction-run` (genuine re-score); monitored set includes Planning (own) projects |
| Register → UI | `project-detail-view RiskTab` — always-on derived register with category filter chips; `OverviewTab` shows a summary card; `reports.ts` exports it as "Live risk register (faults)" |
| Topics → exports | `reports.ts REPORT_TOPICS/DEFAULT_TOPICS/filterReport()` — section-title topic matching; used by reports-view grid picker and per-project "What to export" popover |

---

## v9 note

Interface naming was universalised (assistant = **Assure Intelligence**, tab =
**Risk & Intelligence**, pipeline = **smart reading → structuring → validation**);
the code identifiers and the data→verify chain below are unchanged. The
user-facing workflow story is documented as one-liners in `docs/WORKFLOWS.md`.
