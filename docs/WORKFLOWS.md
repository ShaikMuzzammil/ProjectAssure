# ProjectAssure — The Entire Workflow, One Line Each

> **How to read this file.** ProjectAssure is one pipeline: you register a project,
> upload its paper, and the platform reads, scores, predicts, recommends and alerts —
> then you export and email the evidence. Below, **every workflow in the platform is
> described in exactly one line**, in the order a real user meets them.
> Each workflow also has its own short guide in [`docs/workflows/`](workflows/) with
> the click-path, what you will see, and how to verify it worked.

**Platform:** ProjectAssure — Intelligence-Powered Predictive Project Monitoring Platform
**Built for:** Smart India Hackathon 2026 · Problem SIH26103 · Theme: Smart Automation · Team NEXGEN
**Sign-in page:** one link, one login, works on any device · demo personas included

---

## The whole platform in one picture

```
 SIGN UP ─→ SIGN IN ─→ CREATE PROJECT ─→ UPLOAD DOCUMENTS ─→ RISKS DETECTED
                                                              │
   EMAIL ◄─ EXPORTS ◄─ ALERTS (live, 15 s) ◄─ PREDICTION ◄───┘
                │                          │
                └── INTERVENTION (tracked to closure) ◄── RECOMMENDED ACTIONS
                                             │
                ASK ASSURE INTELLIGENCE (any screen, grounded answers)
```

---

## Every workflow — one line each

### Getting in (accounts & access)

| # | Workflow | One-line description |
|---|----------|----------------------|
| 1 | [Create an account](workflows/01-create-an-account.md) | Register with your name, email and a strong password — you get a private, securely isolated workspace the moment you sign in. |
| 2 | [Sign in](workflows/02-sign-in.md) | Sign in as a demo persona (one per role) or with your own account — each role lands on a correctly scoped dashboard. |

### Watching the portfolio (dashboards)

| # | Workflow | One-line description |
|---|----------|----------------------|
| 3 | [Explore the dashboard](workflows/03-explore-the-dashboard.md) | Open the Dashboard and see, in one screen, what needs attention today, why, and what to do about it. |
| 4 | [Compare projects](workflows/04-compare-projects.md) | Put up to four projects side by side on nine metrics and get an honest verdict on which needs review first. |

### Registering work (projects & documents)

| # | Workflow | One-line description |
|---|----------|----------------------|
| 5 | [Create a project](workflows/05-create-a-project.md) | Register a new project through a guided 6-step wizard that explains every field — and comes alive the moment it is created. |
| 6 | [Upload documents](workflows/06-upload-documents.md) | Drop monthly reports, budget sheets or scans and watch the pipeline read, structure and validate each file live. |
| 7 | [Detect risks](workflows/07-detect-risks.md) | Every upload feeds a live risk register — each risk shows what it means, what we saw, what to do, severity and evidence. |

### Understanding the future (prediction & recommendation)

| # | Workflow | One-line description |
|---|----------|----------------------|
| 8 | [Run a prediction](workflows/08-run-a-prediction.md) | Press one button to get the 30–60 day delay forecast: probability, expected slip, confidence range and the factors driving it. |
| 9 | [Get recommended actions](workflows/09-get-recommended-actions.md) | Open the plan of action: ranked what-to-do steps with owner, deadline, expected impact — and the cost of doing nothing. |
| 10 | [Ask Assure Intelligence](workflows/10-ask-assure-intelligence.md) | Ask anything in plain English — the live service answers in one short shape (answer → evidence → action), grounded on the full project dossier with document citations. |

### Acting (alerts, interventions, exports)

| # | Workflow | One-line description |
|---|----------|----------------------|
| 11 | [Track alerts live](workflows/11-track-alerts-live.md) | Watch the Alerts Centre: high-severity risks raise alerts automatically and the feed refreshes on a 15-second live heartbeat. |
| 12 | [Raise an intervention](workflows/12-raise-an-intervention.md) | Convert any issue into a tracked 7-step intervention — detected to closed, with owners, deadlines and evidence. |
| 13 | [Export evidence](workflows/13-export-evidence.md) | Tick exactly what you want — faults, recommendations, predictions — and export a polished PDF, Excel or CSV. |
| 14 | [Send email reports](workflows/14-send-email-reports.md) | Email any report to any address, with live delivery diagnostics and an honest outbox. |

### Going live (deployment)

| # | Workflow | One-line description |
|---|----------|----------------------|
| 15 | [Deploy on one web address](workflows/15-deploy-one-web-address.md) | Put the whole platform on one free, secure web address in ~15 minutes with the step-by-step deployment guide. |

---

## The 60-second version (jury / teammate quickstart)

1. Open the link → **Sign in** as *The Ministry Project Manager* (or create an account).
2. **Dashboard** → read "Requires attention today" — three plain-language cards.
3. **Projects** → open *Bharatmala P-4* → **Risk & Intelligence** tab → press **Run prediction**.
4. Press **Ask Intelligence** → type *"Why is Bharatmala P-4 at risk?"* → read the grounded answer.
5. **New project** → 6-step wizard → upload `docs/SAMPLE_FIELD_REPORT.pdf` → watch ~20 risks appear.
6. **Reports & Exports** → choose *Recommended only* → **PDF** → open it: professional, stamped, exactly what you ticked.
7. **Email Centre** → send it anywhere.

Every step above is browser-verified and reproducible — see `screenshots/` and `demo-walkthrough.webm`.

---

## Where everything lives

| Screen (sidebar) | What it is for |
|---|---|
| **Dashboard** | What needs attention today — big numbers, attention cards, live feed |
| **Projects** | Grid + map of every project; the 6-step create wizard; per-project 9-tab detail |
| **Assure Intelligence** | The grounded assistant — full-screen chat with tool traces |
| **Prediction Engine** | Model metrics, versions, drift — the honest scoreboard |
| **Reports & Exports** | What-to-export checkboxes → PDF / Excel / CSV, history |
| **Email Centre** | Compose, send, outbox, delivery diagnostics |
| **Help & Guide** | 2-minute tour, 30-term glossary, FAQ, the in-app workflow guide |

Deep screens (Interventions, Compare, Vector Store, Notifications, Audit, Admin) stay
reachable through in-screen links, the bell, ⌘K search and project cards.
