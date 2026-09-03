# HOW IT WORKS — The Complete ProjectAssure Guide

> **Smart India Hackathon 2026 · Problem Statement SIH26103 (MoSPI)**
> AI-Powered Predictive Project Monitoring & Early Warning Platform
>
> This guide explains **how the platform actually works internally** — step by step,
> with workflows, diagrams and formulas. Read it once and you will be able to explain
> every screen, every score and every AI answer during a demo or judging round.

---

## Table of Contents

1. [What is ProjectAssure?](#1-what-is-projectassure)
2. [The Big Picture — System Architecture](#2-the-big-picture--system-architecture)
3. [Workflow 1 — App Start & Login](#3-workflow-1--app-start--login)
4. [Workflow 2 — Demo Data Generation](#4-workflow-2--demo-data-generation)
5. [Workflow 3 — Health Score Engine](#5-workflow-3--health-score-engine)
6. [Workflow 4 — AI Delay Prediction (ML)](#6-workflow-4--ai-delay-prediction-ml)
7. [Workflow 5 — Budget Forecast Engine](#7-workflow-5--budget-forecast-engine)
8. [Workflow 6 — Alert Generation](#8-workflow-6--alert-generation)
9. [Workflow 7 — Assure AI Assistant (Agentic ReAct)](#9-workflow-7--assure-ai-assistant-agentic-react)
10. [Workflow 8 — Screen Navigation](#10-workflow-8--screen-navigation)
11. [Persona Journeys](#11-persona-journeys)
12. [Complete File Map](#12-complete-file-map)
13. [Key Formulas Cheat-Sheet](#13-key-formulas-cheat-sheet)
14. [Glossary](#14-glossary)

---

## 1. What is ProjectAssure?

Government infrastructure projects in India routinely overrun their budgets and
timelines — the average central-sector project slips by **33+ months and 20%+ cost**.
MoSPI currently discovers these overruns **months after they happen**, through
scattered Excel sheets and PDF reports.

**ProjectAssure flips the model from "reporting the past" to "predicting the future":**

| Traditional monitoring | ProjectAssure |
|---|---|
| Monthly PDF progress reports | Live health score recomputed from 18 ML features |
| Delays discovered after months | Delay **probability + estimated slip days** predicted *before* they happen |
| Budget overruns found at year-end | Prophet-style forecast projects the final cost **months ahead** |
| Manual reconciliation of reports | Document AI extracts and reconciles uploaded PDFs automatically |
| Escalation by email chains | Alerts carry **recommended action + owner + deadline** |

The result: a single Command Centre where an officer sees the pulse of 30 projects
in 10 seconds, knows exactly *which* 3 projects need attention *today*, and gets a
factor-level, cited explanation of *why* each one is at risk.

---

## 2. The Big Picture — System Architecture

Everything runs **client-side** (in the browser) for the demo — no database or API
keys are needed, and every reload produces the same deterministic data.

```
┌─────────────────────────────────────────────────────────────────────┐
│                          BROWSER (client-side)                       │
│                                                                      │
│  ┌────────────┐     ┌──────────────────────────────────────────┐    │
│  │  Login      │     │        Zustand Store (app-store.ts)      │    │
│  │  6 personas ├────►│  user · view · projects · AI panel state │    │
│  └────────────┘     └───────┬───────────────────▲──────────────┘    │
│                             │ view + projects   │ actions            │
│                    ┌────────▼───────────┐       │                    │
│                    │     App Shell       │───────┘                    │
│                    │  (sidebar + topbar) │                            │
│                    └────────┬───────────┘                            │
│                             │ renders one of 8 views                 │
│   ┌─────────┬─────────┬────┴──────┬─────────┬────────┬──────────┐    │
│   ▼         ▼         ▼           ▼         ▼        ▼          ▼    │
│ Command   Projects  Project     Analytics  Alerts  Reports     Admin │
│ Centre    list      Detail      charts     view    & Docs      view  │
│                                                          │           │
│                             ┌────────────────────────────┼────────┐  │
│                             │      INTELLIGENCE LAYER    │        │  │
│  ┌──────────────────────┐   │  ┌────────────┐ ┌────────▼──────┐  │  │
│  │ seed-data.ts         │   │  │ ml.ts      │ │ ai.ts         │  │  │
│  │ mulberry32(42) PRNG  ├──►│  │ health +   │ │ agentic AI    │  │  │
│  │ 30 projects + all    │   │  │ prediction │ │ 6 tools +     │  │  │
│  │ milestones/tasks/    │   │  │ + forecast │ │ citations     │  │  │
│  │ budgets/resources    │   │  └────────────┘ └───────────────┘  │  │
│  └──────────────────────┘   │  ┌────────────┐                    │  │
│         engine.ts           │  │ format.ts  │  Indian ₹/lakh     │  │
│         assembles all       │  └────────────┘  formatting       │  │
│                             └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**Why deterministic simulation?** For SIH judging, the demo must always show the
same compelling story (2 amber + 1 red project) with zero backend setup. The same
code architecture maps 1:1 to a production backend (see DEPLOYMENT.md for the
Vercel + Neon + Upstash ₹0-cost stack).

---

## 3. Workflow 1 — App Start & Login

```
 User opens site
       │
       ▼
 ┌──────────────┐   user === null     ┌─────────────────────────┐
 │   page.tsx   ├────────────────────►│  LoginView              │
 │  (AppShell)  │                     │  6 persona cards shown  │
 └──────────────┘                     └───────────┬─────────────┘
                                                  │ click a persona
                                                  ▼
                                     ┌─────────────────────────┐
                                     │  store.login(user)      │
                                     │  1. user = persona      │
                                     │  2. projects = getProjects()
                                     │     (engine builds ALL  │
                                     │      30 projects once,  │
                                     │      cached in memory)  │
                                     └───────────┬─────────────┘
                                                 │
                                                 ▼
                                     ┌─────────────────────────┐
                                     │  Dashboard (Command     │
                                     │  Centre) renders with   │
                                     │  portfolio stats        │
                                     └─────────────────────────┘
```

**Step by step:**

1. `src/app/page.tsx` renders `<AppShell/>`.
2. `AppShell` reads `user` from the Zustand store. If no user is logged in, it
   shows the **Login view** — no password needed for the demo, 6 persona cards
   (see [Persona Journeys](#11-persona-journeys)).
3. Clicking a persona calls `login(user)`, which triggers `getProjects()` from the
   engine — this builds the entire 30-project portfolio **once** and caches it.
4. The shell switches to the authenticated layout: dark/light theme toggle,
   sidebar with 7 navigation items, global search (Cmd+K command palette),
   notification bell and the floating Assure AI panel.

---

## 4. Workflow 2 — Demo Data Generation

File: `src/lib/projectassure/seed-data.ts` (315 lines) + `engine.ts` (assembly).

```
 mulberry32(42)  ── deterministic PRNG ──►  same numbers on EVERY reload
       │
       ▼
 30 hardcoded project definitions (DEFS)
 27 HEALTHY · 2 AT_RISK · 1 CRITICAL  ← the demo story
       │
       ▼  for each definition, the engine builds:
 ┌────────────────────────────────────────────────────────┐
 │ 1. Milestones  (4-7 per project, critical ones weight 2)│
 │ 2. Tasks       (2-3 per milestone, critical chain)      │
 │ 3. BudgetRecords (monthly planned vs spent, burn factor)│
 │ 4. Resources   (human / equipment / material)           │
 │ 5. Documents   (2-5 PDFs with AI-extracted summaries)   │
 │ 6. AuditTrail  (create/update/AI-accept/export events)  │
 └────────────────────────────────────────────────────────┘
       │
       ▼
 Health scores computed (Workflow 3)
       │
       ▼
 Delay predictions for every ACTIVE/ON_HOLD project (Workflow 4)
       │
       ▼
 Alerts attached (Workflow 6)  ──►  Portfolio ready
```

**The 3 flagged "story" projects** (this is the demo narrative):

| Project | Tier | Story |
|---|---|---|
| **Bharatmala P-4 Corridor Monitoring** | AMBER | Steel procurement pending 18 days has blocked pier casting on 3 critical milestones; monsoon window adds risk |
| **ICCC Prayagraj Command Centre Phase-2** | AMBER | Burn rate running 28% ahead of plan while integration milestones slip — classic cost-pressure profile |
| **Jal Jeevan Rural Grid Bundelkhand** | RED | Forest-clearance permit stalemate + 41% budget burn against 19% schedule progress; worst in portfolio |

**Key trick — `mulberry32(42)`:** a tiny seeded PRNG. Every random choice (milestone
count, task names, budget jitter) draws from it, so `mulberry32(42)` always produces
the identical dataset. Judges can reload 100 times — the story never changes.

---

## 5. Workflow 3 — Health Score Engine

Files: `ml.ts → computeHealth()` and `engine.ts → computeHealthFor()`.

Every project gets a **0–100 health score** from four weighted sub-scores:

```
                    ┌────────────────────────────────────┐
                    │        HEALTH SCORE (0-100)        │
                    │                                    │
                    │  = 0.30 × Schedule                 │
                    │  + 0.25 × Budget                   │
                    │  + 0.20 × Resources                │
                    │  + 0.25 × Milestones               │
                    └───────┬──────────┬─────────┬───────┘
                            │          │         │
              score ≥ 75    │          │         │
              ──────────────┤          │         │
              HEALTHY (green)           │         │
                            │          │         │
              50 ≤ score < 75          │         │
              ─────────────────────────┤         │
              AT_RISK (amber)                    │
                                       │         │
              score < 50                         │
              ───────────────────────────────────┤
              CRITICAL (red)
```

**How each sub-score is derived** (all features come from `extractFeatures()`):

| Sub-score | Built from | Formula idea |
|---|---|---|
| **Schedule (0.30)** | `progress_vs_elapsed` (progress ÷ elapsed time), `days_behind_schedule` | 50% progress-pacing + 50% days-late penalty (90 days = 0) |
| **Budget (0.25)** | burn ratio (spend% ÷ elapsed%), velocity deviation (last-3-month burn vs plan), projected overrun % | 35% burn ratio + 25% velocity + 40% overrun |
| **Resources (0.20)** | utilisation sweet spot (60–85%), bottleneck count (>90% utilised), team adequacy | 45% utilisation band + 30% bottlenecks + 25% staffing |
| **Milestones (0.25)** | on-time completion of due milestones, slip count, critical-path delays | 45% adherence + 35% slips + 20% critical delays |

**Worked example (from the design doc, ICCC Prayagraj):**

```
Schedule 70.4 × 0.30 = 21.12
Budget   35.3 × 0.25 =  8.83
Resources 82.5 × 0.20 = 16.50
Milestones 59.6 × 0.25 = 14.90
─────────────────────────────────
Health score          = 61.3  →  AT_RISK (amber)
```

The flagged projects use these fixed exemplar sub-scores so the demo numbers
always match the design documentation.

---

## 6. Workflow 4 — AI Delay Prediction (ML)

File: `ml.ts → computeDelayPrediction()`. Model badge: `sim:xgboost-v2.1-18f`.

This is the heart of "predictive monitoring". For **every active project**:

```
 Step 1: FEATURE EXTRACTION (18 features from live project data)
 ┌───────────────────────────────────────────────────────────┐
 │ Schedule group                                            │
 │   task_completion_rate      milestone_adherence           │
 │   days_behind_schedule      progress_vs_elapsed           │
 │   elapsed_ratio             days_to_deadline              │
 │ Budget group                                              │
 │   budget_utilisation_rate   budget_burn_velocity          │
 │   budget_velocity_deviation                               │
 │ Milestone group                                           │
 │   critical_milestones_delayed  total_milestones_delayed   │
 │   dependency_chain_health                                 │
 │ Resource group                                            │
 │   resource_utilisation      resource_bottleneck_count     │
 │   team_size_adequacy                                      │
 │ Context group                                             │
 │   weather_seasonality (Jun-Sep monsoon = 1)               │
 │   procurement_delay_days     project_duration_months      │
 └───────────────────────────────────────────────────────────┘
                    │
                    ▼
 Step 2: LOG-ODDS MARGIN
   margin = -2.35 (healthy baseline)
          + (100 - healthScore)/55        ← health prior pulls the needle
          + Σ contributions from "bad" features
            (each feature has a weight; magnitude scales with severity,
             e.g. days_behind_schedule adds up to +2.2 log-odds,
             procurement delay adds 0.042 per pending day)
                    │
                    ▼
 Step 3: SIGMOID + CALIBRATION BLEND
   p_model  = sigmoid(margin)                    ← feature-driven
   p_health = sigmoid((62 - healthScore)/7)      ← health-score prior
   probability = clamp(0.3 × p_model + 0.7 × p_health)
   (calibrated: health 90 ≈ 3% · health 75 ≈ 17% · health 58 ≈ 78%)
                    │
                    ▼
 Step 4: SLIP ESTIMATE + CONFIDENCE INTERVAL
   deficit        = (1 - progress_vs_elapsed) × days_to_deadline
   estimatedDays  = clamp(deficit, 4..240) × (0.5 + 0.6 × probability)
   90% CI         = estimated ± (32% + 6 days)
                    │
                    ▼
 Step 5: TOP-6 FACTORS (pseudo-SHAP), sorted by |contribution|
   every factor carries a PLAIN-LANGUAGE explanation, e.g.
   "Procurement pending 18 days — procurement is the most common
    hard blocker in public projects"  (+1.2 log-odds)
```

**Why judges love this:** the prediction is not a black-box percentage. The UI
shows each factor's contribution in log-odds with a human sentence, so an officer
can see *exactly why* the model says 78% — and act on the top factor.

---

## 7. Workflow 5 — Budget Forecast Engine

File: `ml.ts → computeBudgetForecast()`. Shown in **Project Detail → Budget tab**.

```
 Monthly budget records (planned vs spent, cumulative)
       │
       ▼
 ┌─ HISTORY ────────────────┐   ┌─ FUTURE (6+ months) ─────────────┐
 │ plot cumulative planned   │   │ projected = last cumulative      │
 │ and cumulative actual     │   │   + avgBurn(last 4 months)       │
 │                           │   │   + trend × i × 0.35             │
 │                           │   │ upper/lower bands widen          │
 │                           │   │   ±(3% + 0.9% per month ahead)   │
 └───────────────────────────┘   └──────────────────────────────────┘
       │                               │
       └───────────┬───────────────────┘
                   ▼
   projectedFinal cost  →  overrun% = (projected - sanctioned)/sanctioned
                   │
                   ▼
   overrun > 10%  → WARNING threshold
   overrun > 20%  → CRITICAL threshold (mandatory review note, rule-based)
   upper band crossing sanctioned cost before completion → BUDGET_STRESS alert
```

This is a **Prophet-style extrapolation** (trend + widening uncertainty bands).
The chart renders three series: actual, planned, projected — with the shaded
confidence cone making "we will overrun by month X" visually obvious.

---

## 8. Workflow 6 — Alert Generation

File: `engine.ts → buildAlerts()`. Alerts are **not** just noise — each carries a
recommended action, a named owner and a deadline, so they are directly actionable.

```
 Project tier?
   │
   ├─ CRITICAL (Jal Jeevan Bundelkhand)
   │    ├─ CRITICAL: projected budget overrun crosses 20%
   │    │     → action: verify burn-rate ledger, freeze non-critical
   │    │       procurement · owner: Project Manager · within 24 hours
   │    ├─ CRITICAL: 3 critical-path milestones delayed
   │    │     → action: convene escalation review with contractor
   │    │       · owner: Project Manager · this week
   │    └─ HIGH: risk level change AMBER → RED
   │          → action: human officer verification (rule R10 — AI
   │            never escalates alone, human-in-the-loop by design)
   │
   ├─ AT_RISK (Bharatmala P-4, ICCC Prayagraj)
   │    ├─ HIGH: budget overrun > 10% (or BUDGET_STRESS if only the
   │    │         forecast upper band breaches the sanctioned cost)
   │    ├─ MEDIUM: milestone slippage on critical path
   │    └─ MEDIUM: resource bottleneck (cranes at 96% utilisation)
   │
   └─ HEALTHY: at most a LOW "data freshness" notice (deterministic,
        every 8th project past 40% progress) — keeps the feed honest
```

**Human-in-the-loop principle (rule R10):** when the model changes a risk band,
the alert explicitly says *"human-officer verification required before
escalation"*. This is a deliberate governance feature — AI advises, humans decide.

Alerts surface in three places: the bell icon in the topbar, the **Alerts view**
(risk-ranked, unread-first), and inside each project's detail page.

---

## 9. Workflow 7 — Assure AI Assistant (Agentic ReAct)

File: `ai.ts` (182 lines). The AI answers every question **grounded in the live
data with numbered citations** — no hallucinated numbers.

```
 User question ("Why is Bharatmala P-4 at risk?")
       │
       ▼
 STEP 1 — INTENT CLASSIFICATION (7 intents)
   smalltalk │ risk_query │ comparison │ report_request
   budget_query │ doc_query │ status_query
       │
       ▼
 STEP 2 — ENTITY RESOLUTION
   findProjects() matches project names, aliases
   ("Bharatmala", "Bundelkhand", "NH-44"), states and sectors
       │
       ▼
 STEP 3 — ReAct-STYLE TOOL CALLS (visible trace in the UI)
   ┌─────────────────────────────────────────────────────┐
   │ get_project_detail   {"projectId":"prj-01"}          │
   │   → health=61.3, status=AT_RISK          (~240 ms)   │
   │ run_delay_prediction {"projectId":"prj-01"}          │
   │   → probability=78%, days=46             (~180 ms)   │
   │ query_projects      {"filters":{...}}                │
   │   → 3 projects returned                  (~150 ms)   │
   └─────────────────────────────────────────────────────┘
   Tools available: get_project_detail · run_delay_prediction ·
   forecast/budget · query_projects · compare_portfolio ·
   search_documents · generate_report
       │
       ▼
 STEP 4 — GROUNDED ANSWER SYNTHESIS
   • health breakdown (Schedule · Budget · Resources · Milestones)
   • delay probability + estimated slip + 90% CI
   • top-3 risk factors with SHAP-style citations [1][2][3]
   • one mitigating factor (always — balanced reporting)
   • recommended single highest-leverage action + owner + deadline
   • "verify next" line (what data to double-check)
       │
       ▼
 STEP 5 — PROVENANCE STAMP
   "Based on data as of 14:32 IST · model sim:xgboost-v2.1-18f"
```

**The 6 quick actions** (shown as one-click chips): *Why is Bharatmala P-4 at
risk?* · *Which projects need my attention today?* · *Show the budget analysis
for Jal Jeevan Bundelkhand* · *Compare Bharatmala P-4 vs NH-44 Krishnagiri* ·
*Which projects in Tamil Nadu are delayed?* · *Generate an executive summary*.

The AI works both as a **full-page view** (AI Assistant in the sidebar) and as a
**floating side panel** available on every screen via the sparkle button or `askAi()`
context links on project cards.

---

## 10. Workflow 8 — Screen Navigation

Navigation state lives in the Zustand store — single source of truth:

```
 store.view ──► what renders inside the shell
   │
   ├─ "dashboard"      → DashboardView    (portfolio pulse, 4 KPI rings,
   │                                      risk map, budget chart, alerts feed)
   ├─ "projects"       → ProjectsView     (30 projects, filter by health/sector/
   │                                      state, sort, search)
   ├─ "project-detail" → ProjectDetailView (opens when openProject(id) is called;
   │                                      8 tabs: Overview · Milestones · Gantt ·
   │                                      Budget · Resources · Documents ·
   │                                      Risk & Prediction · Audit Trail)
   ├─ "analytics"      → AnalyticsView    (portfolio deep dive: sector/state/
   │                                      scheme breakdowns, scatter plots,
   │                                      burn analysis)
   ├─ "ai-assistant"   → AiAssistantView  (full-page chat)
   ├─ "alerts"         → AlertsView       (risk-ranked feed, mark read)
   ├─ "reports"        → ReportsView      (report builder + document AI demo)
   └─ "settings"       → SettingsView     (RBAC matrix, thresholds, audit log)
```

**Global interactions:**
- `Cmd/Ctrl + K` → command palette (jump to any project/view)
- Bell icon → unread alert count (live from store)
- `openProject(id, tab)` → deep-links into a specific project tab
- `askAi(question, projectContext)` → opens AI panel pre-seeded with a question

---

## 11. Persona Journeys

The login screen offers 6 personas. Each one is a **user story** from the MoSPI
design docs, so judges can instantly see role-based value:

| # | Persona | Role | Their journey in 30 seconds |
|---|---|---|---|
| 1 | **Arun Kulkarni** — *Portfolio Overseer* (Joint Secretary) | ADMIN | Logs in → Command Centre shows 30-project pulse → sees 3 flagged → drills into the RED project → escalates with one click |
| 2 | **Priya Venkatesh** — *Ministry Project Manager* | PROJECT_MANAGER | Opens her projects → opens Bharatmala P-4 → Gantt shows the blocked milestone → reads prediction factors → expedites steel procurement |
| 3 | **Rahul Sharma** — *Field Reporting Officer* | PROJECT_MANAGER | Field perspective: uploads site reports, sees data-freshness alerts, responds to permit-status requests |
| 4 | **Sneha Iyer** — *MoSPI Data Analyst* | STAKEHOLDER | Reports & Docs: document AI has already extracted and reconciled PDFs; she validates flags instead of reading 27,000 pages |
| 5 | **Vikram Desai** — *Accountability Auditor* | STAKEHOLDER | Opens Audit Trail on any project — full CREATE/UPDATE/AI_ACCEPT/EXPORT history, exportable evidence |
| 6 | **Meera Nair** — *Strategic Observer* | VIEWER | Read-only flagship view: calm, exception-first, no mutation buttons anywhere |

**RBAC matrix** (visible in Administration view): ADMIN (full control) →
PROJECT_MANAGER (own projects, run predictions) → STAKEHOLDER (read + export + AI)
→ VIEWER (read only). The UI adapts to the persona.

---

## 12. Complete File Map

```
src/
├── app/
│   ├── layout.tsx                  Root layout, fonts, theme provider
│   ├── page.tsx                    Renders <AppShell/> (single-page app)
│   └── api/route.ts                Health-check API (returns Hello JSON)
├── store/
│   └── app-store.ts                Zustand: user · view · projects ·
│                                   AI panel · alert read-state · addProject
├── components/projectassure/
│   ├── app-shell.tsx               Login gate + sidebar + topbar + routing
│   ├── shared/
│   │   ├── ai-chat-panel.tsx       Floating AI panel (used on every screen)
│   │   ├── colors.ts               Health/status colour tokens
│   │   ├── gantt.tsx               Custom Gantt timeline renderer
│   │   └── ui-bits.tsx             Badges, KPI cards, progress rings
│   └── views/
│       ├── login-view.tsx          6 persona cards
│       ├── dashboard-view.tsx      Command Centre (KPIs, charts, feeds)
│       ├── projects-view.tsx       Portfolio table + filters
│       ├── project-detail-view.tsx 8 tabs incl. Budget forecast + Risk
│       ├── analytics-view.tsx      Cross-portfolio analytics
│       ├── ai-assistant-view.tsx   Full-page AI chat
│       ├── alerts-view.tsx         Risk-ranked alert feed
│       ├── reports-view.tsx        Report builder + document AI
│       └── settings-view.tsx       RBAC + thresholds + audit
├── lib/projectassure/
│   ├── types.ts                    All TypeScript interfaces (Project, ...)
│   ├── seed-data.ts                Deterministic data generator (mulberry32)
│   ├── engine.ts                   Assembles portfolio + alerts + stats
│   ├── ml.ts                       Health · 18-feature prediction · forecast
│   ├── ai.ts                       Intent classifier + tool-calling agent
│   └── format.ts                   Indian number formatting (₹ lakh / crore)
└── components/ui/                  shadcn/ui primitives (27 Radix-based)
```

---

## 13. Key Formulas Cheat-Sheet

| What | Formula | Where |
|---|---|---|
| Health score | `0.30·S + 0.25·B + 0.20·R + 0.25·M` | ml.ts `HEALTH_WEIGHTS` |
| Health band | `≥75 HEALTHY · 50–75 AT_RISK · <50 CRITICAL` | engine.ts |
| Delay probability | `0.3·sigmoid(margin) + 0.7·sigmoid((62−health)/7)` | ml.ts |
| Log-odds margin | `−2.35 + (100−health)/55 + Σ feature contributions` | ml.ts |
| Estimated slip | `clamp(deficit, 4..240) · (0.5 + 0.6·p)` days | ml.ts |
| 90% CI | `±(0.32·estimate + 6)` days | ml.ts |
| Budget overrun | `(projectedFinal − sanctioned)/sanctioned` | ml.ts |
| Forecast band | `±(3% + 0.9%·monthsAhead)` widening cone | ml.ts |
| Bottleneck | resource `utilised > 90%` | ml.ts |
| Monsoon flag | month in `Jun–Sep` → `weather_seasonality = 1` | ml.ts |

---

## 14. Glossary

| Term | Meaning |
|---|---|
| **PS ID** | Project Serial ID, e.g. `PRJ-2026-0101` (MoSPI-style registry number) |
| **Health score** | Composite 0–100 wellbeing of a project (schedule/budget/resources/milestones) |
| **AT_RISK / CRITICAL** | Amber (50–74) / Red (<50) health bands requiring attention |
| **Delay probability** | Model-estimated chance the project misses its target date |
| **SHAP factor** | Per-feature contribution (in log-odds) explaining the prediction |
| **Burn velocity** | Average monthly spend of the last 3 months vs the plan |
| **BUDGET_STRESS** | Alert fired when the forecast *upper band* crosses sanctioned cost |
| **ReAct** | Reason + Act agent pattern: think → call tool → observe → answer |
| **mulberry32** | Tiny seeded PRNG that makes demo data fully deterministic |
| **Rule R10** | Governance rule: AI risk-band changes need human-officer verification |
| **Document AI** | OCR → GPT-4o extraction → vector search over uploaded PDFs (simulated) |
| **IPMD / NASD / SOSD / ECSD / CAPB** | The five MoSPI departments modelled |

---

*Related docs: `README.md` (features & quick start) · `DEPLOYMENT.md` (Vercel
deployment guide) · source: `src/lib/projectassure/` (all intelligence lives in
~1,400 lines of readable TypeScript).*
