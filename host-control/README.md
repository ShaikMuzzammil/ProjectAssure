# ProjectAssure — Host Control

The administrator control tower for the ProjectAssure platform. Deploy as a **separate Vercel project** with this folder (`host-control/`) as the root directory. It syncs with the main app strictly server-to-server.

## Quick start

```bash
npm install
npm run dev          # → http://localhost:3001
```

Log in with `HOST_ADMIN_EMAIL` / `HOST_ADMIN_PASSWORD` (defaults: `admin@yourdomain.gov.in` / `change-me-please` — set your own via env).

## What it does

| View | What happens there |
|---|---|
| **Mission Dashboard** | Live KPIs, health bands, sync state, pending-approval strip |
| **User Management** | Every mirrored user — access control, roles, direct alerts |
| **Projects Control** | The full portfolio with approval state; the project drawer decides approvals directly |
| **Approvals Centre** | Real-time items: new projects, new accounts, budget breaches, document submissions, site evidence, intelligence requests. Every decision notifies the requester in their app within seconds |
| **Alerts & Broadcast** | Portfolio-wide or user-targeted broadcasts; command log |
| **Email Outbox** | Automated alert settings, provider status, manual composer **with real attachments** |
| **Audit** | Append-only trail of everything the host did |
| **Intelligence** | Grounded chat over the live mirror (provider status is aggregate-only — no key names) |
| **Integrations** | Main app URL + connection test + aggregate system status |

## Environment variables

| Variable | Effect |
|---|---|
| `MAIN_PROJECT_URL` | The main app URL to poll (e.g. `https://project-assure.vercel.app`) |
| `HOST_ADMIN_EMAIL` / `HOST_ADMIN_PASSWORD` | Host login credentials |
| `DATABASE_URL` | Optional — persists approvals/audit/outbox across cold starts (schema auto-picked) |
| `SYNC_TOKEN` | Optional shared secret; set the same value on the main app |
| `GEMINI_API_KEY` / `GROQ_API_KEY` / … | Optional live intelligence providers |
| `EMAIL_USER`+`EMAIL_PASS` / `BREVO_API_KEY` / `RESEND_API_KEY` | Real email delivery (attachments included) |

## The bridge (main ↔ host)

```
main app (browser, logged in)
  │  POST /api/sync/push        on login/actions + every 45s
  ▼
main app sync hub (server)
  │  GET  /api/sync/state       ← host polls every 5s (token-aware)
  │  POST /api/sync/webhook     ← host decisions & broadcasts
  ▼
host-control (this app)
  │  mirror → approvals → automated emails → UI (5s poll)
  └  main-app browsers poll /api/sync/commands every 8s
     → decisions land as notifications + project-state updates
```

With `DATABASE_URL` set, the host store (approvals, audit, outbox, mirror) persists in the database and survives serverless cold starts.
