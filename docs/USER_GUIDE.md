# ProjectAssure — User Guide (v9 one-link release)

Every screen, every button, the 2-minute feature sprint and the 8-minute jury demo
script. The demo world is **deterministic and frozen at 10 Sep 2026** (the pitch day) —
every number reproduces on every reload.

**Also included — the Simple Monitoring Suite:** a 9-screen "one idea per page" starter kit in
the FIRST sidebar group — Simple Overview, Risk Scores, Budget Variance, Cost Benchmark,
Progress Mismatch, Procurement, Change Orders, Authority Review and Project Search. Every
screen is derived live from the same engine the deep screens use (`lib/projectassure/monitor.ts`),
carries a "How this works" strip, plain-language interpretations, and CSV/Excel export
(the Authority view adds a one-click briefing PDF). Built for first-time users and
teammates — see §1b below.

**From v4:** the Workflow Guide screen, project-scoped Assure Intelligence, baseline predictions for
planning projects, visible run-prediction feedback, "How this works" strips, exports on
every domain, wizard stage choice, login-page explainer, and docs/TEAM_GUIDE.md for
onboarding your team. **From v3:** recommended actions, intervention lifecycle,
plain-language summaries, live map drill-down, comparison, glossary + tooltips,
onboarding tour, email diagnostics.

---

## 1. Getting in

1. **Landing page** (`/`) — the pitch: problem stats, six solution pillars, the 22-feature wall, the 5-step pipeline, the 16-tech stack, the 11 KPIs. Click **Create your free account**.
2. **Sign in — two ways**:
   - **Registered account** (default for new users): switch to the **Create account** tab — full name, email, password (8+ chars with letter + number, live strength meter), account type (Project Manager / Stakeholder / Observer), department, phone. The password is hashed with PBKDF2-SHA256 (100,000 iterations, 128-bit salt) — plaintext is never stored — and the account mirrors to Neon PostgreSQL via `/api/auth/register` (scrypt) when the database is configured. After registering you land in **your own workspace**: your projects carry `ownerId`, so only you (and ADMIN) see them. Sign out and back in any time with your password.
   - **Demo persona** (for the jury walkthrough): pick one of the **4 persona cards on the left** of the login page (one per role: Overseer / Project Manager / Analyst / Observer); the email + demo password prefill the white sign-in card on the right.

| Persona | Role | What they see |
|---|---|---|
| Arun Kulkarni — *The Portfolio Overseer* | ADMIN | everything: 30 projects, all views, user management, thresholds, audit |
| Priya Venkatesh — *Ministry Project Manager* | PROJECT_MANAGER | her 10 projects; can create/edit, run predictions, email reports |
| Rahul Sharma — *Field Reporting Officer* | PROJECT_MANAGER | his 6 district projects; uploads dominate |
| Sneha Iyer — *MoSPI Data Analyst* | STAKEHOLDER | read all IPMD projects, acknowledge alerts, generate reports |
| Vikram Desai — *Accountability Auditor* | STAKEHOLDER | read ECSD department scope, audit-first experience |
| Meera Nair — *Strategic Observer (PMO)* | VIEWER | 6 flagship projects, read-only |

Try an invalid email → a real error state. RBAC is enforced in the UI and in every mutation.

3. **First 30 seconds** — press `⌘K / Ctrl+K` (command palette: jump anywhere, search flagged projects, actions) and `/` (opens Assure Intelligence). Toggle the moon icon — a real dark mode.

---

## 1b. The Simple Monitoring Suite (v5) — 9 one-idea screens

The first sidebar group. One concept per page, plain language, live data — a first-time
user can run their whole monitoring day without leaving this group. Every screen has a
"How this works" strip, "?" tooltips, CSV/Excel export, and click-through into the full
project detail.

| Screen | Route | What it shows | Export |
|---|---|---|---|
| Simple Overview | `#/app/monitor` | 4 big numbers (projects, budget, high-risk, unread alerts), progress leaders (clickable), risk distribution, latest alerts (clickable) | — |
| Risk Scores | `#/app/risk-score` | One 0–100 risk number per project, band filter chips, ML delay probability + expected slip, top-3 plain-language drivers, inline "run the model" | CSV, Excel |
| Budget Variance | `#/app/budget-variance` | Approved / revised (model-projected) / spent / remaining per project, portfolio utilisation bar, overrun callout | CSV, Excel |
| Cost Benchmark | `#/app/cost-benchmark` | Sanctioned vs intelligence fair-cost benchmark vs live trajectory, variance-ranked table, anomaly callout | CSV, Excel |
| Progress Mismatch | `#/app/progress-mismatch` | Physical vs financial progress as dual bars + gap score + plain-language interpretation, ±10-point banding | CSV, Excel |
| Procurement | `#/app/procurement` | 2–4 contract packages per executing project vs fair-price benchmark, risk filters, behavioural flags, vendor watchlist | CSV, Excel |
| Change Orders | `#/app/change-orders` | Register with description, cost impact (₹ + %), schedule impact, status; awaiting-decision queue banner | CSV, Excel |
| Authority Review | `#/app/authority-review` | Only projects outside the healthy band; issues combined; ONE recommended action each; DECISION PENDING badges | CSV, Excel, **Briefing PDF** |
| Project Search | `#/app/search` | One box: name, PS-ID, state, district, sector, scheme, PM, contractor, vendor, risk terms; quick chips | — |

> All rows are **derived live** — `deriveCostBenchmarks / deriveBudgetVariance /
> deriveProgressMismatches / deriveRiskScores / deriveContracts / deriveChangeOrders /
> deriveAuthorityReview / deriveSimpleOverview` in `src/lib/projectassure/monitor.ts`
> run over your RBAC-scoped portfolio on render. No cached demo numbers: edit a budget
> entry in the deep screens and every simple screen moves immediately.

## 2. Command Centre (dashboard)

- **4 KPI cards** — 30 projects · 26 On-Track · 3 At-Risk · 1 Critical (cards click-through).
- **Health donut** — 26/3/1 distribution, average health in the centre; legend shows percentages.
- **Budget gauge** — portfolio utilisation (₹5,583 Cr of ₹8,937 Cr) with the overrun watchlist callout → *Analyse budget bands*.
- **Risk-ranked alerts** — top-5 unread (severity, then recency) → click to drill into the project.
- **Sanctioned by sector** bars + **project ranking** (worst-first, click any row) + **portfolio burn trend**.
- **AI chips** — one-click questions; **Export CSV** downloads a 23-column portfolio snapshot (audit-logged).
- **Live feed** — the portfolio heartbeat fires every 40 s: toasts (bottom-right), the bell badge, and the sidebar feed.

## 3. Projects

- **Search + 4 filters** (department / sector / health / status), column sorting, pagination, density toggle, and a clear-all chip.
- **Table ↔ Map** toggle — the geo view plots all projects by district coordinates on a stylised India map; exceptions pulse.
- **New project** (ADMIN/PM) — a 6-step wizard (Basics → Timeline → Budget → Resources → **Documents** → Review) that creates a REAL project owned by your account: PLANNING status, health 95, four starter milestones with dependency-chained tasks, full Gantt/Kanban support, audit CREATE entry. The **Documents step accepts drag-and-drop uploads** (PDF/XLSX/CSV/TXT/MD/JSON/images, up to 12 files × 25 MB) — every text-based file is parsed for real through the OCR pipeline (extract → structure → validate → vector-index → recompute), so dashboards, predictions and alerts update automatically the moment the project is created.
- Row actions: **edit** (progress/status/PM/budget → recompute), **ask AI**, **open**.
- **Exports** — CSV, Excel (multi-sheet: report + data), PDF (executive brief) — all reflect the current filters.

## 4. Project Detail (9 tabs)

| Tab | What works |
|---|---|
| **Overview** | story callout, key facts, sub-score cards, recent alerts, task-level Gantt (dependency edges, critical path, TODAY line, zoom, tooltips) |
| **Milestones** | state-machine transitions (dropdown per milestone — illegal moves are rejected 409-style), critical-path diamonds, add-milestone dialog |
| **Tasks (Kanban)** | drag cards between Backlog / In-progress / Blocked / Done (dnd-kit). Every move recomputes health, logs `task:moved`, and can trigger bottleneck alerts |
| **Budget** | planned vs actual vs cost-forecast projection with 80% CI band and the sanctioned red line; category table; **post budget line** dialog → overrun rules re-run immediately |
| **Resources** | utilisation sliders — >90% re-classifies as bottleneck live; category groups |
| **Documents** | vault cards with extracted fields + confidence; upload area with the live pipeline; delete (ADMIN, soft) |
| **Risk & Intelligence** | driving-factor factor waterfall (red raises / green lowers risk), plain-language explanations, formal risk register, **What-if simulator** (progress & spend sliders → preview recomputed health + prediction → *Apply to live data*), **Run prediction** button |
| **Alerts** | severity-ordered cards, recommended action/owner/deadline, **Acknowledge with action note** (R10 loop, audit-logged), mark read |
| **Audit** | the project's append-only history filtered from the global log (every mutation you just made is here) |

Header actions: **Run prediction** (re-scores with `AssurePredict 2.3`), **PDF / Excel** exports of the full status report, **Email report** (lands in the outbox or the recipient's inbox), **Ask AI**.

## 5. Analytics

- **Portfolio** — department comparison (sanction/spend bars + average-health line), budget-utilisation-vs-health bubble scatter with amber/red reference lines, bottom-10 review queue.
- **Budget bands** — the overrun watchlist with WARNING/CRITICAL band chips and counts.
- **Trends** — portfolio-level plan-vs-actual expenditure.
- **Report builder** — 5 report types (Executive, Weekly Digest, Risk Deep-Dive, Project Status, Portfolio Flash) × PDF/Excel/CSV + **Email**. Export history below (audit-backed).

## 6. Assure Intelligence (agentic assistant)

- Type or use the quick-action chips. Answers carry: **tool-call traces** (real executions with latency), **[n] citations** to documents, a **data-freshness stamp**, and the intent badge.
- **Live intelligence toggle** (top-right) routes through the connected AI service (grounded on a worst-10 snapshot with rules R1–R12); falls back to the built-in engine on any error.
- Threads are persisted; the right rail shows the tool registry, RAG index stats and the guardrails in force.
- Sample questions: *“Why is Bharatmala P-4 at risk?”* · *“Compare the three at-risk projects”* · *“What does the August report say about procurement?”* · *“Show budget overrun forecasts”*.

## 7. Prediction Engine & Vector Store

- **Prediction Engine** — champion/challenger cards (AUC 0.912, precision, recall, F1, MAE, Brier, ECE), live feature importance from portfolio predictions, calibration curve, PSI drift monitor (stable/watch/retrain bands), **Run retraining job** (promotes a challenger with new metrics — audit-logged), the production model card and the fairness check.
- **Vector Store** — the RAG corpus: 113 chunks / 48 documents / 256-dim embeddings. Use the **search tester**: try “steel procurement pending utility relocation” → the exact Bharatmala paragraphs ranked by cosine (0.327 top hit), with file + page metadata. Inspect chunks, the namespace distribution and the embedding preview.

## 8. Alerts Centre

- Severity filter pills with unread counts, show-read toggle, mark-one / mark-all.
- Each alert: description, **recommended action + owner + deadline**, acknowledge-with-action (R10), email-forward button.
- **Simulate critical slip** — injects a REAL event: milestone slips, alert created, notification pushed, critical email queued, health recomputed. This is the “live alert” demo moment.
- Rules reference panel with enable/channel toggles (ADMIN).

## 9. Reports & Documents

- **Ingestion pipeline** — pick a target project, drag-drop any file (TXT/CSV are parsed for real; PDF/XLSX/images run the staged simulation): Upload → OCR (Tesseract eng+hin) → GenSmart structuring (GPT-4o, temp 0.1) → Zod validation → dashboard sync, with per-field confidence, sentiment and key findings.
- **Report factory** — choose type + scope → PDF/Excel/CSV/Email.
- **Document vault** — the 14 most recent documents across the portfolio with extracted fields and project links.

## 10. Email Centre

- **Outbox** — every message with SENT / SIMULATED / QUEUED badges; click for the full preview (from, to, subject, reply-to, attachments, markdown-rendered body) exactly as the provider receives it.
- **Compose** — any recipient, 6 templates (critical alert, high alert, weekly digest, report delivery, document processed, welcome), optional custom subject/body, live project context.
- **Settings** — sender identity, provider (Gmail SMTP / Resend / outbox), alert & digest channel switches, critical-recipient list; **Send a test email** verifies the chain. With env keys set, the identical flow sends real email.

## 11. Administration (ADMIN only)

- **Users & roles** — directory with role selects (changes are audit-logged and jti-revocation documented), soft deactivate, add-user dialog. Role capability matrix below.
- **Thresholds** — amber/red health bands, budget WARNING/CRITICAL, email threshold, velocity rule — every drag **live-recomputes the portfolio bands** with the donut preview. Live-event engine toggle. Alert-rule channels.
- **Deployment** — one-platform status, subsystem health, capacity posture and ₹0 total. Environment internals are deliberately never shown in the UI.
- **Audit trail** — the global append-only log with action filters; every action you took during this session is here.

---

## 12. Interventions Centre (v3)

Every issue becomes a tracked intervention with an owner, a deadline and evidence,
moving through **7 steps: Detected → Reviewed → Action Assigned → Under Investigation →
Resolved → Verified → Closed**.

- Raise one via the button (project, title, what/why, severity) — or convert a
  recommended action from any project's **Plan of Action** tab in one click.
- Check off corrective steps, watch the updates timeline, advance the status
  (a resolution note is required to close), reopen if the problem returns.
- The lifecycle explainer at the bottom walks first-time users through every step.

## 13. Compare Projects (v3)

Pick up to 4 projects → side-by-side on 9 metrics (health, progress, financial vs
physical, cost variance, expected delay, critical milestones, evidence, alerts).
Worst value per row is highlighted; the verdict panel names the project needing
priority review and the benchmark to copy.

## 14. Help & Glossary (v3)

The 2-minute tour, a searchable glossary of every technical term in plain language
(driving-factor, RAG, RBAC, CI, outbox…), and an FAQ. Everywhere in the app, metric labels carry
a **? tooltip** — hover for a one-line plain-language explanation.

## 14b. Workflow Guide (v4)

`#/app/workflow` (sidebar → INTELLIGENCE → Workflow Guide, available to every role).
The entire platform as **10 expandable stages** — Login → Dashboard → Create project →
Upload evidence → Health + prediction → Alerts → AI plan → Intervention → Export →
Email — each with *what happens*, *where to click*, *what you'll see* and an
*under the hood* panel for the tech-curious. Plus the 4-domain sidebar map and the
security summary. This is the fastest way to onboard a teammate; the same content
ships as `docs/TEAM_GUIDE.md` in the zip.

**Project-scoped AI (v4):** press *Ask AI* inside any project — the panel opens with a
"Scoped to: <project>" chip and answers with that project's **Intelligence recommended system**:
verdict, delay outlook with factors, ranked actions (P1–P3, what/why/do/owner/deadline),
root-cause tree, KPI watch, 30/60/90 cost of doing nothing, and cited evidence. Remove
the scope any time with the ✕ on the chip.

**Run prediction (v4):** works on every Planning and Active project — Planning projects
get a *baseline (pre-execution)* score labelled as such; every run ends with a visible
notification (probability, slip, CI, top factors). Newly created projects start Green
(~95) — no-evidence-yet is neutral, not failing.

## The 2-minute feature sprint

When time is short, this path proves every headline claim in ~120 seconds:

| # | Time | Do this | What it proves |
|---|---|---|---|
| 1 | 0:00 | Landing → **Create your free account** → fill the form → Create | Real registration, PBKDF2-hashed password, auto-login into your own workspace |
| 2 | 0:20 | Projects → **New project** → wizard → **upload a TXT/CSV file** at the Documents step → Create | Per-user project creation with real in-browser document parsing (OCR pipeline) |
| 3 | 0:50 | Project detail → **PDF** → **Email report** | Branded PDF annexure download + email delivery with attachment to any address |
| 4 | 1:10 | **Assure Intelligence** → "Which of my projects need attention and why?" | Agentic tool traces on live data (live intelligence when the service is connected) |
| 5 | 1:25 | Project → **Plan of Action** tab → "Track as intervention" | Recommended actions with owner/deadline + 7-step lifecycle tracking |
| 6 | 1:40 | **Interventions** → advance the status | Governance: detected → … → closed, all audit-logged |
| 7 | 1:50 | Projects → **Map** → click a state | Live drill-down: national → state → district with tracking feed |
| 8 | (extra) | **Help & Glossary** / any **? tooltip** | First-time visitors understand every term in plain language |

The full 8-minute script below adds the health engine, prediction explainability, alert chains and governance surfaces.

## The 8-minute jury script

| # | Time | Beat | Do this | Say this |
|---|---|---|---|---|
| 1 | 0:00 | One login, real RBAC | Portfolio Overseer → Sign in | “Six government personas, one SSO — watch the views adapt when I switch roles.” |
| 2 | 1:00 | The 30-second pulse | Command Centre; hover donut & gauge | “Thirty projects, ₹8,937 Cr, 26-3-1 — the three exceptions surface themselves.” |
| 3 | 2:00 | The health score | Click the At-Risk KPI → Bharatmala detail | “58 isn't a feeling — Schedule 61, Budget 52, Resources 70, Milestones 50, weighted 30/25/20/25.” |
| 4 | 3:00 | The prediction | Prediction card → Risk tab → factor waterfall | “75% delay probability, 44-day slip, 90% CI 24–64 — and the model tells you WHY, in plain language.” |
| 5 | 4:00 | Paper → platform | Reports & Docs → ingest the sample PDF | “A field report becomes validated data before your eyes — OCR, GenAI, Zod, dashboard refresh.” |
| 6 | 5:00 | Ask the assistant | AI chip: “Why is Bharatmala P-4 at risk?” | “Not a bolt-on chatbot — an agent that calls tools on live data and cites its sources.” |
| 7 | 6:00 | The alert chain | Alerts → Simulate critical slip → watch toast + bell + email queued | “Alert, notification and email fired in one chain — and every red flag still requires a human officer (R10).” |
| 8 | 7:00 | Governance close | Audit trail (your whole session) → Email Centre preview → dark mode → ⌘K | “Every action audit-logged, exports and emails tracked, and it all costs the government ₹0 a month.” |

**Emergency fallbacks:** all numbers are deterministic (reload-safe); the AI falls back to the grounded engine offline; email previews work without keys; the whole app works offline once loaded.

---

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `⌘K / Ctrl+K` | command palette (navigate, search projects, run actions) |
| `/` | open the Assure Intelligence side panel |
| `Esc` | close palette / popovers |
| `Drag` | kanban cards; `hover` Gantt bars for task details |


---

## v6 — compact interface notes

- **Sign-in lands on the Dashboard** (the calm Simple-Overview page) — not the Command Centre.
- **7 flat sidebar features**: Dashboard · Projects · Assure Intelligence · Prediction Engine · Reports & Exports · Email Centre · Help & Guide (+ Administration for ADMIN).
- **One web address** — a single deployment serves every role; the workspace follows the signed-in account.
- Deep screens (alerts, interventions, compare, analytics, risk/cost/budget one-idea screens, search, vector store, workflow) open from **in-screen links, the bell, ⌘K and project cards** — nothing was removed, only decluttered.


---

## v7 addendum — what changed in this build

- **Prediction Engine** (formerly Model Lab): same functionality, universal language — the registry shows *Accuracy score / Correct rate / Precision / Recall / Balance / Avg. error / Reliability / Calibration*; the drift monitor and model card are unchanged in behaviour.
- **Create-project wizard, step 5 (Documents)**: opens with *"What documents should you upload?"* — a plain-language guide to the eight document types the platform checks, each with why it matters. Uploading is optional at creation; you can add documents from the project page anytime.
- **About page**: Team NEXGEN now lists the six members; demo persona sign-in details are hidden behind a **Reveal** toggle.
- **Email Centre Settings**: shows an honest *Email delivery status* card (connected / demo outbox). Provider setup moved to the deployment guide (administrators only).


---

## v9 addendum — live risks, real-time alerts, choose-your-exports

1. **Create a project and watch it come alive.** The moment the wizard finishes, the project detail opens with the live risk register (~6 risks), 2 onboarding alerts, a first prediction, milestone board, budget phasing and KPIs — nothing is empty.
2. **Upload a document (Documents tab → upload area is first).** TXT/CSV are parsed for real in-browser; other formats run the same 5-stage pipeline as a badged demo. One realistic report adds ~20 risks; high-severity items also raise alerts automatically.
3. **Read the register (Risk & Intelligence tab).** Filter by category chips (Time · Money · Purchases · People & Machines · Quality · Approvals · Outside factors · Safety). Each risk says what it means, what we saw, and what to do.
4. **Watch alerts arrive live (Alerts Centre).** A LIVE band confirms the 15-second heartbeat; new alerts pulse in with an emerald ring and a "⚡ N new alerts" chip.
5. **Export only what you need.** "What to export" checkboxes (Recommended = Summary + Faults & risks + Recommendations) appear on Reports & Exports and on every project page; the file contains exactly the selected sections.

---

## v9 — the one-link release (this version)

**Identity & terminology (what changed):**
- The portal is titled **Smart India Hackathon 2026 · SIH26103** with Team NEXGEN ·
  Amrita Vishwa Vidyapeetham, Chennai — a student-built platform, honestly labelled.
  No government titling anywhere in the interface.
- Universal terminology everywhere: **Assure Intelligence** (the assistant),
  **Prediction Engine**, **smart reading / smart structuring**, **Intelligence benchmark**.
  No technology, provider or environment-variable names appear in the UI.

**New in this package:**
- `docs/WORKFLOWS.md` — the entire platform as **one line per workflow**, with a
  60-second quickstart; each workflow has its own guide in `docs/workflows/`.
- `demo-walkthrough.webm` + `screenshots/` — this version only (no old versions).

**Everything from earlier releases still works:** per-user accounts, 6-step wizard
with uploads, live risk register, predictions with factors, intelligence recommended
systems, real-time alerts (15 s), topic-ticked exports, email diagnostics, interventions,
RBAC, audit trail, live map drill-down.

---

## v11 addendum — live intelligence, made obvious

- **Assure Intelligence** now shows a connection chip: the full view's header
  says *“Live intelligence mode · connected”* and the side panel shows a green
  **LIVE** badge. Live mode turns itself on when a service is detected; the
  toggle still lets you run the built-in engine deliberately (jury-safe,
  offline).
- **Shorter answers.** Every answer now leads with the conclusion in bold,
  shows at most four evidence bullets with real numbers, and closes with one
  recommended action (owner + deadline). Walls of text are gone.
- **Project-scoped deep analysis.** Ask from inside a project (or press *Ask
  Intelligence* on any project) and the assistant receives the entire project
  dossier — including every uploaded document's full text — so answers cite
  your actual files.
- **Approval help.** Ask *“Should I approve the pending change orders?”* and
  you get an explicit recommendation (approve / approve with conditions / hold
  for evidence) plus the single missing item that would settle it.
- **After every document upload**, a new button — *Ask Assure Intelligence
  about this document* — sends the document straight to the assistant for a
  summary, its risks, and the first action to take.
- A crash on the *Documents* tab (a malformed seeded policy document) was
  fixed; rendering is now defensive for any document shape.
