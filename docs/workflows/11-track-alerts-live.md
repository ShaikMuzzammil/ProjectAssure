# Workflow 11 · Track alerts live

**One line:** Watch the Alerts Centre: high-severity risks raise alerts automatically and the feed refreshes on a 15-second live heartbeat.

**Who uses it:** officers and managers who cannot watch dashboards all day.

## Click path
1. Open **Alerts** via the bell (top bar) or ⌘K → **Alerts Centre**.
2. Read the real-time band: **LIVE** pulse, heartbeat note, live event ticker, feed-refresh counter.
3. Watch the "⚡ N new alerts arrived just now" chip when the engine raises something.

## What you get
- **Alerts with recommended action, owner and deadline** — never just a severity colour.
- **Live feed** — portfolio events (predictions re-run, slips detected, documents processed) arriving on a 15-second cycle.
- **Acknowledge** action — rule R10: a human officer verifies before escalation; every acknowledgement is audit-logged.

## What raises an alert
- High-severity risks found in newly uploaded documents.
- Health band changes (Amber → Red).
- Prediction crossings (delay probability above threshold).
- Simulated real-world slips (use the simulate control to see one arrive live).

## Verify it worked
Upload a report with serious issues (workflow 06) → within moments the Alerts Centre shows the new alerts ring-highlighted, each with an action and owner.

## Under the hood (honesty)
The prototype drives the documented real-time event contract in-browser (15 s heartbeat); production wires the same contract to a real-time channel — the screens do not change.
