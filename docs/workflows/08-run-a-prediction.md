# Workflow 08 · Run a prediction

**One line:** Press one button to get the 30–60 day delay forecast: probability, expected slip, confidence range and the factors driving it.

**Who uses it:** managers and analysts who need warning *before* the slip happens.

## Click path
1. Open any project → **Risk & Intelligence** tab.
2. Press **Run prediction** (or use the inline button on the Risk Scores screen).
3. Read the result card.

## What you get
- **Delay probability** (e.g. 75 %) with **90 % confidence range**.
- **Expected slip** (e.g. 44 days) — and the dates it implies.
- **Top driving factors** with direction and weight — each factor shows its measured value, so the reasoning is auditable, never a black box.
- A notification toast the moment it completes; the project's health band updates.

## Understand the two modes
- **Planning-stage projects** get a *baseline* prediction (pre-execution) — labelled honestly.
- **Execution-stage projects** get full 18-signal scoring (permits, burn, milestones, vendor history, weather context…).

## Verify it worked
- Press **Run prediction** on *Bharatmala P-4* → probability ≈ 75 %, slip ≈ 44 days, CI 24–64 — deterministic and reproducible on every reload.
- The Prediction Engine screen shows the model's accuracy metrics and version.

## Under the hood (honesty)
Deterministic model by default (same input → same answer, no key needed); predictions are always advisory and name the human officer who must verify (rule R10).
