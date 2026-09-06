# ProjectAssure — TEAM GUIDE
### From your first login to running the whole platform — a friendly, complete walkthrough

> **Who this is for:** team members seeing ProjectAssure for the first time (and anyone who has to demo it).
> **How to read it:** top to bottom = the exact order you'd click things in the real app.
> **Time needed:** 15 minutes to understand everything. 5 minutes if you only read the tables.
>
> The same walkthrough exists **inside the app**: sidebar → **Help & Guide** (workflow, glossary, tour).
> v6: the sidebar is now **7 flat features** — one list, nothing to be confused by.

---

## 0 · What is ProjectAssure in one paragraph

ProjectAssure is a monitoring platform for government infrastructure projects. You register a project, upload its real documents (DPR, field reports, budget sheets), and the platform **reads them itself**, computes a **0–100 health score** for every project, **predicts delays 30–60 days before the deadline is missed**, raises **alerts with recommended actions**, tracks the fix as an **intervention through a 7-step lifecycle**, and lets you **export or email everything**. It is built for MoSPI-style portfolio monitoring (SIH26103) and runs entirely on free-tier infrastructure.

**The one-line pipeline:**

```
Login → Dashboard (what needs attention?) → Create/upload project → Engine scores it
→ Alerts fire early → Assure Intelligence explains & recommends → Intervention tracked to closure
→ Export PDF/Excel/CSV → Email to anyone → Audit trail proves everything
```

---

## 1 · First login (2 minutes)

### Two ways in

| Way | When to use | How |
|---|---|---|
| **Demo persona** | Exploring / jury demo | Login page → click a persona card (e.g. *Arun Kulkarni, ADMIN*) → you're in |
| **Your own account** | Real work | Login page → *Create account* tab → name, email, password (≥8 chars, number + symbol), role → auto-login |

**What the left side of the login page tells you** — "How ProjectAssure works in 3 steps" (Upload evidence → AI scores & predicts → Act on recommendations) and the security panel: passwords are PBKDF2-hashed, each account only sees its own projects, accounts mirror to PostgreSQL when the database is configured.

**What the right side tells you** — a plain-language description of the platform and what each role can do.

### The 6 demo personas (which one should you pick?)

| Persona | Role | What they see | Use it to… |
|---|---|---|---|
| Arun Kulkarni | ADMIN | All 30 projects + Administration | See everything, manage users/thresholds/rules |
| Priya Venkatesh | PROJECT MANAGER | Her department's projects | The day-to-day project owner view |
| Rahul Sharma | PROJECT MANAGER | His projects | Second PM view |
| Sneha Iyer | STAKEHOLDER | Read + act on alerts | Ministry reviewer view |
| Vikram Desai | STAKEHOLDER | Read + act on alerts | Parliamentary/audit support view |
| Meera Nair | VIEWER | Read-only analytics | Observer view |

> **Your own account starts empty.** The getting-started banner on the dashboard walks you to *Create project*. Demo data belongs to the demo personas; your projects stay in your workspace.

### After login you land on the Command Centre
A 4-step onboarding tour offers itself (or *Skip the tour*). Keyboard shortcuts: **⌘K/Ctrl+K** = jump palette, **/** = open Assure Intelligence.

---

## 2 · The screen map — 7 features (v6 compact)

The v6 sidebar is **one flat list of 7 features** — no groups, no "domains", nothing to decode. If you can click 7 things, you can run the whole platform:

| # | Sidebar item | The job it does | Where the deep tools went |
|---|---|---|---|
| 1 | **Dashboard** | The whole portfolio on one calm page — 4 big numbers, who's ahead, where the risk sits, what just happened | Alert details live in the bell + attention panel |
| 2 | **Projects** | The portfolio table + **New project** (6-step wizard with document uploads) + every project's 9-tab detail page | Compare, interventions, alerts, map: all open from here |
| 3 | **Assure Intelligence** | The agentic assistant — portfolio answers **and** project-scoped action plans | Ask-AI button is also on every screen |
| 4 | **Prediction Engine** | The ML engine — 18 features, model registry, run predictions | Prediction also runs inline on Risk screens |
| 5 | **Reports & Exports** | Document ingestion, the report factory, PDF/Excel/CSV vault | Export buttons also sit on every screen |
| 6 | **Email Centre** | Compose, templates, outbox, delivery diagnostics | "Email report" button also on each project |
| 7 | **Help & Guide** | 2-minute tour, workflow guide, 30-term plain-language glossary, FAQ | — |

*(ADMIN sees one extra item: Administration.)*

> Every screen keeps its **"HOW THIS WORKS" strip** under the title — a one-line pipeline with hover hints. If you ever feel lost, read that strip first, then open **Help & Guide**.

> Every screen has a **"HOW THIS WORKS" strip** under its title — a one-line pipeline with hover hints. If you ever feel lost, read that strip first, then open **Workflow Guide** for the full walkthrough (now starting with the Simple Monitoring Suite as Stage START).

### The 9 Simple Monitoring screens — what each one answers

| Screen | The one question it answers | What to click next |
|---|---|---|
| **Simple Overview** | "What's the state of everything right now?" — 4 big numbers, who's ahead, risk split, latest alerts | Any progress bar or alert row → opens that project |
| **Risk Scores** | "Who is in trouble, how badly, and why?" — one 0–100 risk number per project + the ML delay probability + top 3 reasons in plain words | *Open project* for the full story, or *run the model* if a project has no prediction yet |
| **Budget Variance** | "How is the money doing?" — approved vs model-revised vs spent vs remaining, per project | *Open project* → Budget tab for the burn chart |
| **Cost Benchmark** | "Are we paying more than we should?" — sanctioned vs the AI's fair-cost estimate vs where the money is actually heading | The red anomaly banner → the project |
| **Progress Mismatch** | "Is money running ahead of work?" — physical % vs financial % side by side, with a plain-language interpretation per row | *Authority Review* for the action list |
| **Procurement** | "Are any contracts priced oddly?" — every contract vs its fair-price benchmark + behavioural flags (concentration, repeat vendors) | *Open the project* on any flagged contract |
| **Change Orders** | "What changed and what's it costing us?" — register with cost impact, schedule impact, and the awaiting-decision queue | *Authority Review* if a decision is pending |
| **Authority Review** | "What needs my signature today?" — only projects outside the healthy band, each with ONE recommended action | *Briefing PDF* (one click, audit-logged) or *Intelligence action plan* |
| **Project Search** | "Where is that project?" — one box searching name, PS-ID, state, sector, scheme, PM, vendor, even "at risk" | The result card → full project detail |

> **Why you can trust these numbers:** every simple screen is computed live from the same data store the deep screens use (a single engine — `src/lib/projectassure/monitor.ts` derives all rows on the fly). There is no demo copy of the numbers anywhere; change a budget entry in the deep screens and the simple screens move immediately.

---

## 3 · The full workflow, stage by stage

Each stage: **where to click → what happens → what you'll see**. (This mirrors the in-app Workflow Guide.)

### Stage 1 — Log in securely
- **Where:** Login page.
- **What happens:** Your password is verified against a salted hash (never stored readable). Your role decides which screens and projects you can access (RBAC).
- **You'll see:** The Command Centre with your name and persona description in the header.

### Stage 2 — See what needs attention today
- **Where:** Command Centre (first screen after login).
- **What happens:** The "Requires attention today" panel ranks projects needing intervention, each with a plain-language reason ("88% spent vs 58% built") and a *What to do* button.
- **You'll see:** 4 KPI cards (total / green / amber / red), health donut, budget gauge, critical alerts, sector budget bars, worst-8 ranking, live event feed.
- **Export here:** CSV / Excel / PDF (top-right).

### Stage 3 — Create your own project
- **Where:** Projects → *New project* (6-step wizard).
- **Steps:** 1 Basics (name, sector, department, state, district, scheme) → 2 Timeline + PM + contractor + **project stage** → 3 Budget (₹, with cost split preview) → 4 Team size → 5 Documents (drag-drop upload) → 6 Review → *Create project*.
- **Project stage matters:**
  - **Still in planning** → the project gets a **baseline (pre-execution) risk score** from day one.
  - **Execution underway** → the **full 18-feature model scores it immediately**.
- **What happens under the hood:** your district is geocoded onto the live map, a starter milestone set + task graph is seeded (so Gantt/Kanban work instantly), every uploaded file is parsed, and a unique PS-ID (e.g. PRJ-2026-1212) is allocated.
- **You'll see:** the project detail page opens, health ~95 (Green) — new projects are *not* punished for being new.

### Stage 4 — Upload evidence (the platform reads it itself)
- **Where:** Project detail → *Documents* tab (or step 5 of the wizard).
- **Formats:** PDF, XLSX, CSV, TXT, MD, JSON, PNG/JPG — up to 12 files × 25 MB.
- **What happens:** each file goes through the pipeline **Uploaded → Parsed → Chunked → Embedded → PROCESSED**, becomes searchable evidence, and feeds a GenSmart summary + the analytics.
- **You'll see:** per-file status chips and a summary extracted from the *real* file content.
- **Test it:** INTELLIGENCE → *Vector Store* — type "steel procurement delay" and watch the ranked chunks come back with file + page.

### Stage 5 — The engine scores and predicts
- **Where:** Project detail → header scores + *Risk & Intelligence* tab.
- **What happens:** the 18-feature model computes health (schedule 30% / budget 25% / resources 20% / milestones 25%) and a delay prediction: probability, estimated slip days, 90% confidence interval, driving-factor-style factor explanations in plain words.
- **Buttons that matter:**
  - **Run prediction** (header) → re-scores now, shows a notification with the result. Planning projects get a *baseline*; active projects get the full model.
  - **What-if simulator** (Risk & Intelligence tab) → drag progress/spend, watch health move, *Apply to live data* to commit.
- **You'll see:** a factor waterfall — green bars reduce risk, red bars raise it — plus the 90% CI.

### Stage 6 — Alerts fire before it's obvious
- **Where:** RESPOND → Early Warnings.
- **What happens:** 12 threshold rules (R1–R12) re-evaluate after every data change: projected overrun >10%/>20%, delay probability ≥70%, burn velocity spikes, health entering Red, report staleness >38 days. Every alert carries **an action, an owner and a deadline**.
- **Try it:** *Simulate critical slip* (admin) creates a real alert end-to-end.
- **Export here:** CSV / Excel.

### Stage 7 — Ask Assure Intelligence for the plan
- **Where:** the blue *Ask Assure Intelligence* button (any screen), **/** key, or the *Ask AI* button inside a project.
- **Scoped answers:** opening AI from inside a project shows a **"Scoped to: <project>"** chip — every answer becomes that project's **Intelligence recommended system**: verdict, delay outlook, ranked actions (what / why / do this / owner / deadline), root-cause tree, KPI watch, and the cost of doing nothing at 30/60/90 days.
- **Grounded answers:** every number comes from a real tool call (shown with latency) or a cited document chunk (file + page). Ask *“Why is Bharatmala P-4 at risk?”* to see the full trace.
- **Live mode:** Settings → toggle live intelligence → answers go through the connected live intelligence service (never displayed in the UI).

### Stage 8 — Track the fix as an intervention
- **Where:** RESPOND → Interventions Centre (or *Track as intervention* on any recommendation).
- **What happens:** the issue becomes a tracked card with an owner, a deadline and a 7-step lifecycle: **DETECTED → REVIEWED → ACTION ASSIGNED → UNDER INVESTIGATION → RESOLVED → VERIFIED → CLOSED**. Each step needs a note; closure needs verification evidence (rule R10, human-in-the-loop).
- **You'll see:** lifecycle stepper, tickable corrective steps, updates timeline.
- **Export here:** CSV / Excel.

### Stage 9 — Export anything
- **Where:** every screen (top-right buttons).
- **Formats:** **PDF** (branded, real typeset documents via jsPDF), **Excel** (multi-sheet workbooks via SheetJS), **CSV** (raw rows).
- **Everywhere it works:** Dashboard (portfolio), Projects (table), Project detail (per-project status report), Analytics (report builder — 6 report kinds), Alerts, Interventions, Compare (comparison PDF), Email Centre (delivery log), Prediction Engine (registry). Every export lands in the audit trail.

### Stage 10 — Email reports to anyone
- **Where:** Project detail → *Email report*, or RESPOND → Email Centre.
- **What happens:** the report is composed from a template, the PDF attaches, and the platform delivers through the provider chain **SMTP (Gmail App Password) → Brevo → Resend → demo outbox**.
- **Honesty by design:** delivery states are **SENT** (really delivered), **SIMULATED** (no provider configured — full preview only), **FAILED** (with the exact fix, e.g. "Gmail needs an App Password, not your login password"). Settings → *Run diagnostics* tells you exactly which key is missing.
- **You'll see:** the outbox with delivery states, and a full preview (message, headers, attachments) on selection.

---

## 4 · One deployment, one link (Vercel)

The platform is **a single deployment at a single web address** — no domain juggling:

1. **Everyone signs in at the same URL.** The app checks the account's role and renders the matching workspace (admin, project manager, stakeholder, viewer).
2. **All features live inside the one app** — dashboard, projects, AI, predictions, reports, email, help. Deep screens open via in-screen links, the bell and ⌘K.
3. **Admins see platform status, not internals.** Administration → Deployment shows system status and capacity — connection details stay in the server environment and the deployment guide.


## 5 · Role guide — who can do what

| Capability | ADMIN | PROJECT MANAGER | STAKEHOLDER | VIEWER |
|---|---|---|---|---|
| Create projects / upload documents | ✅ | ✅ | ❌ | ❌ |
| Edit milestones / tasks / budget | ✅ | ✅ (own projects) | ❌ | ❌ |
| Run predictions | ✅ | ✅ | ✅ | ❌ |
| Acknowledge alerts | ✅ | ✅ | ✅ | ❌ |
| Manage interventions | ✅ | ✅ | ✅ | ❌ |
| Exports (PDF/Excel/CSV) | ✅ | ✅ | ✅ | ✅ |
| Email reports | ✅ | ✅ | ✅ | ❌ |
| Assure Intelligence | ✅ | ✅ | ✅ | ✅ (scoped) |
| Administration (users/thresholds/rules) | ✅ | limited | ❌ | ❌ |
| See projects | all | own + department | shared scope | analytics scope |

---

## 6 · Ten tasks you'll actually do (click-paths)

1. **"What needs my attention today?"** → Command Centre → read the attention panel → click *What to do* on any row.
2. **Create a project** → Projects → New project → 6 steps (choose *Execution underway* if work has begun) → done.
3. **Upload a field report** → open your project → Documents tab → drop the file → watch it go PROCESSED.
4. **Run the delay model** → project header → *Run prediction* → notification shows probability + slip + CI.
5. **Ask why a project is at risk** → project → *Ask AI* → read the factor explanations and recommended actions.
6. **Turn a recommendation into action** → project → Plan of Action tab → *Track as intervention* → Interventions Centre.
7. **Export a status report** → project header → *PDF* (or Excel) → branded file downloads.
8. **Email that report** → project header → *Email report* → check the outbox state (SENT / SIMULATED / FAILED + fix).
9. **Compare projects** → Compare Projects → pick up to 4 → read the verdict → *Export PDF*.
10. **Prove what happened** → GOVERN → Audit Trail (append-only, every action with user + timestamp).

---

## 7 · Common questions (honest answers)

| Question | Answer |
|---|---|
| "Are the numbers real?" | In demo mode they come from a deterministic 30-project simulation world (frozen at 10 Sep 2026) — consistent, explainable, never random-per-click. Connect DATABASE_URL and real data flows through the same engine. |
| "Is the AI really AI?" | The built-in engine is a real agentic pipeline (intent → tools → cited answer) running on your data, deterministic and offline-safe. Toggle live mode to route through the connected AI service — the grounding stays identical. |
| "Why does email say SIMULATED?" | No provider configured yet. Settings → Run diagnostics → follow the 3-provider guide (Gmail App Password / Brevo / Resend). SIMULATED is honest, not broken. |
| "Where are API keys shown?" | Nowhere. Connection details live only in the server environment; the UI shows status and diagnostics, never values or variable names. |
| "Can two users see each other's projects?" | No. Projects carry an owner; RBAC scopes every list, answer and export. |
| "Is dark mode safe?" | Yes — every component has explicit light/dark tokens; badges consume CSS variables defined in both themes. |
| "What if I break something?" | You can't silently — every mutation is audit-logged, and Administration → Reset demo restores the world. |

---

## 8 · Glossary quick-reference (full 30-term list in-app: Help & Glossary)

| Term | Plain meaning |
|---|---|
| Health score | 0–100 report card: schedule 30% + budget 25% + resources 20% + milestones 25%. Green ≥75, Amber 50–74, Red <50. |
| Delay prediction | Probability the contractual date is missed, estimated slip days, 90% confidence interval. |
| driving-factor factors | Which signals pushed the prediction up (red) or down (green), in plain words. |
| Baseline prediction | Pre-execution risk score for projects still in planning. |
| R1–R12 | The 12 alert rules (overrun bands, delay probability, burn velocity, staleness…). |
| R10 | The human-verification rule: critical claims need officer confirmation before escalation. |
| Intervention | A tracked fix: owner + deadline + 7-step lifecycle from DETECTED to CLOSED. |
| RAG / vector store | How uploaded documents become searchable evidence (chunks → embeddings → cosine similarity). |
| Audit trail | Append-only log of every action — who, what, when, before/after. |
| RBAC | Role-based access control — your role decides what you see and can change. |

---

## 9 · 2-minute demo script (if you have to show it)

1. Login as **Arun Kulkarni** (one click).
2. **Simple Overview** (first sidebar item) — 30 projects, ₹8,937 Cr, 4 high-risk, 11 unread alerts, all live. "Everything a first-time user needs is this page."
3. **Risk Scores** — one 0–100 number per project; Jal Jeevan Bundelkhand worst (risk 67), top 3 reasons in plain words.
4. **Cost Benchmark** → the red anomaly banner; **Procurement** → 25 flagged contracts with behavioural flags; **Authority Review** → the 4 projects that need a decision → click **Briefing PDF** (real file, audit-logged).
5. Click **Jal Jeevan Bundelkhand** from any simple screen → health 33, Plan of Action tab → press **Ask AI** → full Intelligence recommended system answer with tool trace.
6. Press **Run prediction** → notification with probability + CI.
7. Alerts → *Simulate critical slip* → real alert appears → the Simple Overview alert list updates too (same data, one engine).
8. Project header → **PDF** → real branded file downloads; **Email report** → outbox.
9. Toggle **dark mode** — everything stays readable, simple screens included.

---

## 10 · Where to go deeper

| Want to… | Read |
|---|---|
| Deploy it (one deployment, one URL, cloud database + email + AI) | `docs/DEPLOYMENT_GUIDE.md` |
| Understand every screen in detail | `docs/USER_GUIDE.md` |
| See the DATA→VERIFY code chain per feature | `docs/WORKFLOW_IMPLEMENTATION.md` |
| Map spec → shipped feature | `docs/PROTOTYPE_FEATURE_MAP.md` |
| Set up the project locally | `README.md` (root of the zip) |


---

## v6 addendum — the new login page

The login page is now a **split screen on solid ministry blue**:

- **Left** — the pitch ("One dashboard for India's projects"), then **CHOOSE A DEMO PERSONA — 4 roles**: The Portfolio Overseer (ADMIN), The Ministry Project Manager (PM), The MoSPI Data Analyst (STAKEHOLDER), The Strategic Observer (VIEWER). Clicking a persona prefills the sign-in card.
- **Right** — a white card: *Sign in to ProjectAssure* (email + password) or, via **Create a new account (free)**, the registration form (name, email, password + strength meter, account type, department). Registered users get their **own workspace** — their projects, documents and exports are stored per user and survive reloads.

The 4 personas are exactly **one demo per role type** — no duplicates to wonder about. Demo passwords: `overseer` · `minister` · `analyst` · `observer`.


---

## v9 — what changed for the demo script

- **"Create project" is now the hero moment**: after the wizard, EVERY tab has content — open the project and walk Overview (executive summary + live risk register summary + KPIs) → Risk & Intelligence (full register, category chips) → Alerts (2 onboarding alerts) → Documents (upload here).
- **One upload = many risks**: upload any TXT report (or use `docs/SAMPLE_FIELD_REPORT.pdf` guidance) and say "the scanner just found **20 risks across 8 categories** — schedule, money, procurement, resources, quality, approvals, external, safety — each with a fix." High-severity items raise alerts on their own.
- **Real-time proof**: stay on Alerts for ~30 seconds — the LIVE band ticks and new alerts arrive from the 15-second heartbeat.
- **Exports**: tick/untick "What to export" options before pressing PDF/Excel/CSV — show the file contains only the chosen matter.
- **The government-style header** (emblem + भारत सरकार + secure badge + IST clock) is on every page — point at it once during the security story.

---

## v9 addendum (read this first)

- The sidebar's assistant feature is called **Assure Intelligence** (same chat,
  same grounding, same tool traces).
- New teammate starting point: `docs/WORKFLOWS.md` — every workflow in one line,
  then the per-workflow guides in `docs/workflows/`.
- The video is `demo-walkthrough.webm` and screenshots are in `screenshots/`
  (this version only).
