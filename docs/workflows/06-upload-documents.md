# Workflow 06 · Upload documents

**One line:** Drop monthly reports, budget sheets or scans and watch the pipeline read, structure and validate each file live.

**Who uses it:** project managers feeding the platform its evidence.

## What to upload (the wizard and Documents tab both explain this)
| Document type | Why it helps |
|---|---|
| Monthly progress reports | physical progress %, delays, issues |
| Flash reports | exceptions, escalations |
| Budget / expenditure sheets | burn rate, variance |
| Tender & contract papers | contract values, dates, obligations |
| Site photos & scans | evidence for issues (staged reading) |
| Milestone certificates | schedule verification |

Formats: **PDF · Excel · CSV · TXT · MD · JSON · images** (up to 12 files × 25 MB).

## Click path
1. Open any project → **Documents** tab (upload panel is first).
2. Drag-drop or browse to select files.
3. Watch the live pipeline per file: **Uploaded → Parsed → Chunked → Embedded → PROCESSED**.
4. During project creation: step 5 of the wizard accepts the same files.

## What you see
- Each document card: page count, size, PROCESSED badge, **smart summary**, extracted fields (progress %, spend, …) with confidence.
- The **risk scan block** — every risk found in that document, listed.
- A toast per ingested file; the register and prediction re-score automatically.

## Verify it worked
Upload `docs/SAMPLE_FIELD_REPORT.pdf` (or any TXT report) → the risk register count on Overview rises immediately and high-severity items raise alerts.

## Under the hood (honesty)
TXT/CSV/MD/JSON are parsed **for real** in-browser; PDFs and images run the same staged pipeline with clearly labelled simulated reading (honest badges, no silent fakes). Every upload updates the vector store so the assistant can cite it.
