# Workflow 10 · Ask Assure Intelligence

**One line:** Ask any question in plain English and get an answer grounded in your live data, with tool traces and citations.

**Who uses it:** everyone — press `/` anywhere, or the blue button (bottom right), or open the **Assure Intelligence** screen.

## Click path
1. Press `/` (or click **Ask Assure Intelligence**) — the panel opens on any screen.
2. Type naturally: *"Why is Bharatmala P-4 at risk?"*, *"Which project should I prioritise?"*, *"What did the August report say about land?"*
3. Press Enter → watch the tool trace while it works.

## What you get
- A direct answer with **bold key figures** and a recommended action.
- The **tools that ran** (query projects · run prediction · search documents · build action plan) with timings — you see the work, not just words.
- **Citations** to the exact document + page when the answer uses uploaded evidence.
- A scope chip when you are inside a project — questions are answered about *that* project.

## Verify it worked
Ask *"Why is Bharatmala P-4 at risk?"* → the answer quotes the real probability and factors from the Risk & Intelligence tab — cross-check them, they match.

## Under the hood (honesty)
The built-in engine answers offline by executing real tools over your portfolio (never inventing numbers); when a live intelligence service is connected, the same grounding rules apply (R1–R12: ground every number, cite documents, officer verification, mask personal identifiers).

---

## v11 — what changed

- The assistant tries the **live intelligence service first** (free Gemini key
  when configured; then Groq → OpenRouter → OpenAI → sandbox) and only falls
  back to the built-in engine if none answer. The panel shows a **LIVE** chip
  when connected.
- Answers are **short by design**: bold answer first, at most four evidence
  bullets with real numbers, exactly one recommended action (owner + deadline).
- Asked from inside a project, the question travels with the **full project
  dossier** — including every document's real text — so the answer can cite
  your files and cross-check them against each other.
- **Approval questions** (change orders, budget increases, extensions of time)
  end with a clear recommendation and the one missing item that would settle it.
- After uploading a document, press **Ask Assure Intelligence about this
  document** to get its summary, risks and first action in one step.
