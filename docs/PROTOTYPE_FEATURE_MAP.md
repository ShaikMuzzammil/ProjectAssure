# ProjectAssure — Prototype Feature Map (v4 ULTRA)

Every feature in the v9 prototype and exactly where to find it. Companion to the
15-feature catalogue in `reference-md/01_PROJECT_OVERVIEW.md` (spec) — this file maps
the spec to the shipped software. **v3 adds the decision layer** (recommended actions,
interventions, no-action impact, root cause), the **understandability layer**
(glossary, tooltips, tour, plain language), the **live map drill-down**, and
**email diagnostics**.

## 05. v5 additions — the Simple Monitoring Suite (teammate-facing layer) — 🟢
| v5 feature | Implementation | Where |
|---|---|---|
| Simple Overview (4 live big numbers + progress leaders + risk split + latest alerts) | `views/monitor-view.tsx` + `monitor.ts deriveSimpleOverview` | SIMPLE MONITORING → Simple Overview (`#/app/monitor`) |
| Risk Scores scoreboard (0–100 + ML delay probability + top-3 drivers + run-model inline) | `views/risk-score-view.tsx` + `deriveRiskScores` | `#/app/risk-score` |
| Budget Variance (approved/revised/spent/remaining + utilisation) | `views/budget-variance-view.tsx` + `deriveBudgetVariance` + `budgetUtilisation` | `#/app/budget-variance` |
| Cost Benchmark (sanctioned vs intelligence fair-cost vs live trajectory + anomaly callout) | `views/cost-benchmark-view.tsx` + `deriveCostBenchmarks` (COMPLETED/≥98% uses actual spend) | `#/app/cost-benchmark` |
| Progress Mismatch (physical vs financial dual bars + interpretations) | `views/progress-mismatch-view.tsx` + `deriveProgressMismatches` | `#/app/progress-mismatch` |
| Procurement anomaly screening (contracts vs fair-price benchmark + flags + vendor watchlist) | `views/procurement-view.tsx` + `deriveContracts` + `procurementSummary` | `#/app/procurement` |
| Change Orders register + decision queue | `views/change-orders-view.tsx` + `deriveChangeOrders` + `changeOrderSummary` | `#/app/change-orders` |
| Authority Review (escalation-filtered + one action each + briefing PDF) | `views/authority-review-view.tsx` + `deriveAuthorityReview` | `#/app/authority-review` |
| Project Search (multi-term, vendor-aware, quick chips) | `views/project-search-view.tsx` | `#/app/search` |
| CSV/Excel on every simple screen + Briefing PDF | `monitor.ts csvRows` + reports helpers | every simple screen header |
| Workflow Guide Stage START + SIMPLE domain | `views/workflow-view.tsx` | `#/app/workflow` |
| Sidebar SIMPLE MONITORING group (first) + palette entries | `app-shell.tsx NAV_META` + `permissions.ts VIEWS_BY_ROLE` | sidebar / ⌘K |

## 0a. v4 additions — the onboarding & AI-recommendation layer — 🟢
| v4 feature | Implementation | Where |
|---|---|---|
| Workflow Guide screen (10-stage in-app walkthrough) | `views/workflow-view.tsx` | INTELLIGENCE → Workflow Guide (`#/app/workflow`) |
| Team guide document (login → every feature) | `docs/TEAM_GUIDE.md` | zip docs |
| Project-scoped Intelligence recommended system | `agent.ts buildProjectActionPlan` + store `aiContextProjectId` | Ask AI inside any project (context chip) |
| action_plan intent ("what should I do") | `nlp.ts` + `agent.ts` | Assure Intelligence (any screen) |
| Baseline (pre-execution) prediction for PLANNING | `engine.ts` + `PredictionResult.isBaseline` | new project → Run prediction |
| New-project engine neutrality (day-0 = neutral, not At Risk) | `ml.ts extractFeatures/computeHealth` guards | every newly created project (health ~95) |
| Run-prediction visible feedback | store notification on every run | project header → Run prediction |
| Wizard project-stage choice (Planning / Execution) | `projects-view.tsx` step 2 + `ProjectForm.stage` | New project wizard |
| "How this works" pipeline strips (hover hints) | `ui-bits.tsx PipelineStrip` | dashboard / projects / detail / alerts / interventions / compare / email / model lab |
| Dashboard portfolio exports | `exportPortfolio(csv/xlsx/pdf)` | Command Centre header |
| Alerts exports (with actions/owners/deadlines) | `exportAlerts` | Early Warnings header |
| Interventions exports (lifecycle position) | `exportInterventions` | Interventions Centre header |
| Comparison PDF (side-by-side + verdict) | `exportComparison` | Compare Projects header |
| Email delivery-log CSV | `exportDeliveryLog` | Email Centre header |
| Model registry CSV (AUC/MAE/calibration) | `exportRegistry` | Prediction Engine header |
| Login left-panel 3-step explainer | `login-view.tsx` | login page (desktop left) |

## 0. v3 additions — the decision & understandability layer — 🟢
| v3 feature | Implementation | Where |
|---|---|---|
| "Requires attention today" list (plain reasons) | `recommendations.ts buildAttentionList` | Command Centre top panel |
| Executive summary (plain-language verdict) | `buildExecutiveSummary` | every Project → Overview |
| Recommended actions (What/Why/Do/Owner/Deadline/Impact) | `buildRecommendedActions` | Project → Plan of Action |
| "What happens if we do nothing?" 30/60/90 projection | `projectNoActionImpact` | Project → Plan of Action |
| Root-cause tree (schedule/resources/approvals) | `buildRootCauseTree` | Project → Plan of Action |
| 7-step intervention lifecycle (Detected→Closed) | store actions + view | Interventions Centre |
| Track-as-intervention one click from actions | `createIntervention` | Plan of Action / Compare |
| KPIs target vs actual (sector-specific) | `seedKpis` | Project → Overview |
| Cross-project comparison + verdict | compare-view | Compare Projects |
| Live map drill-down (national→state→district) | `geo.ts` + GeoMap | Projects → Map |
| Live tracking feed (40s, WebSocket contract) | events.ts + feed panel | Projects → Map |
| 30-term plain-language glossary + ? tooltips | glossary.ts + InfoTip | Help & Glossary (everywhere) |
| First-visit onboarding tour | onboarding-tour.tsx | first login |
| Email delivery diagnostics (GET /api/email/status) | API route + panel | Email Centre → Settings |
| Email provider chain SMTP→Brevo→Resend + hints | email route v3 | /api/email/send |
| FAILED vs SIMULATED honesty (reasons + hints) | email.ts sendEmail | Email Centre outbox |

## Legend
🟢 fully functional in-browser (deterministic, zero-setup) · 🔵 functional with an optional API key · ⚪ honest simulation of the production pipeline (badged)

## 1. Executive Dashboard & Portfolio Health — 🟢
| Spec feature | Implementation | Where |
|---|---|---|
| Summary cards + trends | 4 KPI cards (click-through) | Command Centre |
| Budget utilisation gauge | 270° gauge + overrun watchlist | Command Centre |
| Health distribution donut | 26/3/1 with avg-health centre | Command Centre |
| Portfolio analytics | sector bars, ranking, burn trend, bubble scatter | Command Centre + Analytics |
| Health formula 30/25/20/25 | `ml.ts computeHealth` + story bias; recomputed on EVERY mutation | lib + everywhere |

## 2. AI Delay Prediction — 🟢
| Feature | Where |
|---|---|
| 18-feature extraction (`ml.ts extractFeatures`) | every prediction + Prediction Engine |
| Probability (calibrated blend) + slip + 90% CI + confidence | Project detail header card |
| driving-factor-style factor waterfall + plain language | Risk & Intelligence tab |
| Global feature importance (live) | Prediction Engine |
| Retraining simulation → challenger promotion | Prediction Engine |
| Calibration curve, PSI drift, model card, fairness | Prediction Engine |

## 3. Budget Forecasting & Overrun Detection — 🟢
| Feature | Where |
|---|---|
| cost-forecast forecast + 80% CI + monsoon seasonality | Budget tab chart |
| Sanctioned-cost breach line + breach month | Budget tab |
| >10% WARNING / >20% CRITICAL rule engine | engine.ts → Budget tab panel + alerts |
| Post budget line → re-run rules | Budget tab dialog |

## 4. Resource Monitoring & Bottlenecks — 🟢
Utilisation sliders with >90% bottleneck re-classification (Resources tab), EARLY_WARNING rules, dependency-chain health in the ML features.

## 5. Milestone Tracking & Critical Path — 🟢
Milestone state machine with 409-style rejections (Milestones tab), critical-path diamonds, task-level Gantt with dependency edges (Overview tab).

## 6. Automated Risk Scoring — 🟢
Formal risk register + 4-dimension sub-scores (Risk tab), risk-level changes driving RISK_LEVEL_CHANGE alerts.

## 7. GenAI Document Intelligence — ⚪/🟢
Staged pipeline upload→OCR→GenAI→Zod→sync (Reports & Docs; Documents tab): TXT/CSV parsed for real 🟢; scans run the documented pipeline as an honest simulation with per-field confidence ⚪; production design in `reference-md/06`.

## 8. Grounded assistant engine Assistant — 🟢/🔵
7 executing tools with traces + citations + memory (Assure Intelligence + slide-over panel). Deterministic engine by default 🟢; live-LLM mode via `/api/ai/chat` (Gemini key / sandbox SDK) with R1–R12 system prompt 🔵.

## 9. Real-Time Alerts & Notifications — 🟢
Rule engine after every mutation + 6-hourly cron story; alert cards with action/owner/deadline; acknowledgement (R10); severity filters; simulate critical slip creates the full real chain; live event engine drives toasts/badge/feed; email channel 🔵 with keys.

## 10. RBAC & Cross-Domain SSO — 🟢/⚪
Enforced role scoping + gated mutations + denial audit (permissions.ts, all views); single-deployment switcher + shared-secret SSO design ⚪ (production: 30-second one-time handoff tokens per reference-md/02).

## 11. Audit Trail — 🟢
Append-only global + per-project logs with action filters; every CREATE/UPDATE/DELETE/LOGIN/EXPORT/AI_ACCEPT/ALERT_ACK/EMAIL_SEND/PREDICTION_RUN/MODEL_RETRAIN/UPLOAD/SETTINGS entry.

## 12. Interactive Gantt — 🟢
Task-level bars, dependency edges, critical-path highlighting, TODAY line, zoom levels, hover tooltips.

## 13. Automated Reports & Exports — 🟢
5 report kinds → branded PDF (jsPDF) · multi-sheet Excel (SheetJS) · CSV; email delivery 🔵; export history audit.

## 14. PWA & Field Access — 🟢 (partial)
Responsive layouts (mobile drawers, touch targets), works offline once loaded (deterministic client-side). Full PWA manifest/service-worker is a documented production item.

## 15. Multi-Department Views — 🟢
Department filters everywhere; department-comparison analytics; department-scoped RBAC.

## Platform extras (beyond the 15)
Landing page · About page · login with error states · **real account registration (PBKDF2-SHA256 client hash + scrypt server mirror to Neon via `/api/auth/register`) with per-user project ownership** · command palette (⌘K) · notification centre · dark mode · hash deep-links with session-aware reload · localStorage persistence + demo reset · kanban with drag-and-drop · what-if simulator · geo map view · **project wizard (6 steps incl. drag-and-drop document upload with real in-browser OCR parsing)** · **per-project PDF/Excel exports + email report delivery** · user management CRUD with registered/demo badges · threshold configurator with live preview · alert-rule editor · model lab governance surface · vector store browser with semantic search tester · email centre with outbox/compose/settings · deployment posture panel.

## Free-tier API keys (optional upgrades)
| Key | Unlocks |
|---|---|
| `DATABASE_URL` + `DIRECT_URL` (Neon) | connected mode: 16-model Prisma persistence, `/api/auth/register`, `/api/auth/login`, `/api/users` |
| `EMAIL_USER` + `EMAIL_PASS` (Gmail App Password) | real email delivery (`/api/email/send`) |
| `RESEND_API_KEY` | alternative email provider |
| `GEMINI_API_KEY` | live intelligence chat grounded with R1–R12 rules |
| `NEXTAUTH_SECRET` (shared across domains) | cross-domain SSO (production handoff design) |
| `NEXT_PUBLIC_PORTAL=main\|analytics\|ai` | portal skin for this deployment |
| `UPSTASH_REDIS_REST_URL/_TOKEN` | production cache/rate limiting |
| `PINECONE_API_KEY` | production vector namespace |
| `BLOB_READ_WRITE_TOKEN` | document storage |


---

## v6 — Compact release additions

| # | Change | Status |
|---|---|---|
| 1 | 7-feature flat sidebar (Dashboard · Projects · Assure Intelligence · Prediction Engine · Reports & Exports · Email Centre · Help & Guide) — domain groups removed | 🟢 shipped |
| 2 | Split login page: ministry-blue grid background, 4 demo personas (one per role) left, white sign-in/create-account card right | 🟢 shipped |
| 3 | Exactly one demo persona per role type (Arun/ADMIN, Priya/PM, Sneha/STAKEHOLDER, Meera/VIEWER) | 🟢 shipped |
| 4 | Sign-in lands on the Dashboard (Simple Overview) | 🟢 shipped |
| 5 | Domain switcher removed from topbar — 3 deployments set portal via `NEXT_PUBLIC_PORTAL` | 🟢 shipped |
| 6 | Screen intros trimmed to one line (text diet) | 🟢 shipped |
| 7 | Store v9: fresh world with 4-persona directory | 🟢 shipped |
| 8 | Zero special features removed — email, ML, grounded assistant engine, report extraction, wizard, demo all re-verified | 🟢 verified |


---

## v7 feature map delta

| Screen | v7 change |
|---|---|
| Landing | No technology names; "one secure web address" story; 7-feature grid replaces the 26-item wall |
| About | Team NEXGEN 6 members; persona credentials behind a Reveal toggle; hackathon-journey timeline removed |
| Create-project wizard | Step 5 opens with the "What documents should you upload?" guide; Department dropdown clipping fixed; dialog widened |
| Prediction Engine (was Model Lab) | Universal metric names; AssurePredict version labels; same retrain/drift/calibration behaviour |
| Email Centre | Provider setup guide removed from the UI; honest delivery-status card; universal channel labels |
| Administration → Deployment | Env-var matrix and domain tables replaced by system status + capacity posture |


## v9 additions

| # | Feature | Where | Notes |
|---|---|---|---|
| 1 | Live risk register (3-source: documents + engine + context) | Project → Risk & Intelligence | 45-pattern document scanner, 8 categories, impact/likelihood, evidence, mitigation; never empty, never 1 line |
| 2 | Auto-assembled new projects | Wizard | milestones + S-curve budget + resources + alerts + prediction + register + live event on creation |
| 3 | Real-time alert stream | Alerts Centre | 15s heartbeat, new-alert events with actions, live ticker, "⚡ new" pulses |
| 4 | Universal portal header | all surfaces | emblem, tricolour, GoI/MoSPI titling, secure badge, IST clock, live pulse |
| 5 | What-to-export multi-select | Reports & project pages | 9 topics, recommended set pre-checked, filtered PDF/Excel/CSV |
| 6 | About reveal toggle (full section) | About page | toggle beside heading reveals all demo users + role matrix |
| 7 | Documents upload-first + risk lists | Project → Documents | guidance on what to upload; per-doc risk list; ingest result prints all risks |
| 8 | Compact SIH deck slides 2–3 | PPT | 5-step flow + 3 layer bands (19/12 shapes) |

---

## v9 additions

| Feature | Where | Status |
|---|---|---|
| SIH/college identity band on every surface | Portal header (all screens) | 🟢 shipped |
| Universal terminology (no tech names in UI) | Whole interface | 🟢 shipped (147 string sites) |
| Workflow guides — one line per workflow | `docs/WORKFLOWS.md` + `docs/workflows/` (15 files) | 🟢 shipped |
| Prototype README | `prototype/README.md` | 🟢 shipped |
| Package contains only the current version | zip root | 🟢 shipped |
