# Workflow 14 · Send email reports

**One line:** Email any report to any address, with live delivery diagnostics and an honest outbox.

**Who uses it:** officers distributing evidence; the platform's automatic alert emails.

## Click path
1. Open **Email Centre** (sidebar).
2. **Compose** — pick a template (project status, risk digest, critical alert…) or attach a freshly exported report.
3. Press **Send**.
4. Check the **outbox** (delivery status per message) and the **delivery status card**.

## What you get
- Real HTML emails with the report attached (PDF) where produced.
- **Honest statuses**: `QUEUED` (no email service connected — the demo's safe fallback, still previewable) vs `SENT` / `FAILED` (a real provider connected).
- **Delivery diagnostics**: whether an email service is connected, last error (if any) with a plain-language hint — no silent failures.

## Connecting real delivery (production)
Follow [`DEPLOYMENT_GUIDE.md`](../DEPLOYMENT_GUIDE.md) §5: any one of the free providers (Gmail App Password / Brevo / Resend) — 2-minute setup, ~300 emails/day free.

## Verify it worked
Send a project report to your own address with a provider connected → receive it (stamped header, attached PDF); without a provider, the message sits in the outbox as QUEUED with a full preview — still demonstrable.

## Under the hood (honesty)
Provider chain: SMTP (auto-TLS 465/587) → Brevo → Resend → outbox fallback; every send attempt is audit-logged.
