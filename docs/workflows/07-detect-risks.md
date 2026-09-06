# Workflow 07 · Detect risks

**One line:** Every upload feeds a live risk register — each risk shows what it means, what we saw, what to do, severity and evidence.

**Who uses it:** everyone who needs to know what is actually going wrong (not just "red").

## Click path
1. Open any project → **Risk & Intelligence** tab.
2. Read the four score cards (register size, high-severity count, category split, source split).
3. Filter by category chips (Schedule · Cost · Quality · Safety · Compliance · Supply · Land · External).
4. Open any risk.

## What each risk shows
- **What it means** — plain language.
- **What we saw** — the exact evidence line, with source (`from monthly-report.txt`).
- **What to do** — the recommended mitigation.
- **Severity** (High / Medium / Low) + **likelihood & impact bars**.

## Where risks come from (three honest sources)
1. **Documents** — 45 risk patterns × 8 categories scanned across every uploaded file.
2. **Engine signals** — burn vs progress, forecast overrun, bottleneck, stale data.
3. **Project context** — sector rules (monsoon for water works, land for roads), contractor TBD, large-project rules.

## Verify it worked
- Upload a report mentioning *"land acquisition pending"* and *"failed cube test"* → both appear as distinct risks with evidence, in the right categories.
- High-severity risks automatically raise alerts (workflow 11) — check the Alerts Centre.

## Under the hood (honesty)
The register is **derived live** on every render (not stored), so it can never drift from the underlying documents and engine state; duplicate findings across sources are merged.
