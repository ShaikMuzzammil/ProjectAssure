# Workflow 13 · Export evidence

**One line:** Tick exactly what you want — faults, recommendations, predictions — and export a polished PDF, Excel or CSV.

**Who uses it:** analysts, auditors, and anyone who must send proof.

## Click path
1. Open **Reports & Exports** (sidebar) — or any screen's export buttons.
2. In **What to export**, tick the topics you want:
   - ✅ *Recommended*: Risk register (faults) · Plan of action (recommendations) · Predictions.
   - Optional: Alerts · Interventions · Budget · Milestones · Documents · Audit.
   - Shortcuts: **Recommended only** / **Everything**.
3. Press **PDF** / **Excel** / **CSV**.
4. Per-project version: open the project → **What to export** popover → same topics, scoped to that project.

## What you get
- A **professional PDF with a stamped secure-platform header** (portal band, classification, generated-by/at, reference) — every page.
- **Understandable content**: plain-language sections, only the matter you selected.
- Excel with **one sheet per section**; CSV per topic.
- Every export is **audit-logged** and listed in export history.

## Verify it worked
Tick exactly *Risk register + Plan of action* → export → open the PDF → it contains **only those sections** (cross-check with the ticked list — no filler, no raw dumps).

## Under the hood (honesty)
Exports are generated in-browser from the same live data (no server round-trip in the demo); production uses the identical document factory.
