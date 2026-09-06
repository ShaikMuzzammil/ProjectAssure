# Workflow 02 · Sign in

**One line:** Sign in as a demo persona (one per role) or with your own account — each role lands on a correctly scoped dashboard.

**Who uses it:** everyone, every session.

## Click path
1. Open the platform link.
2. **Demo path:** on the left panel, click one of the four persona cards (Portfolio Overseer / Ministry Project Manager / Data Analyst / Strategic Observer) — the card pre-fills the email; press **Sign in**.
3. **Own account path:** type your registered email + password → **Sign in**.

## What happens
- The password is verified against the stored hash (demo personas use the demo directory; registered users use PBKDF2 verification).
- Role-based access control (RBAC) scopes everything you can see: admins see the whole portfolio, managers their own + department projects, stakeholders review scope, viewers read-only.
- You land on the **Dashboard** with the sidebar already set to the 7-feature compact list.

## The four demo personas (exactly one per role)
| Persona | Role | What they see |
|---|---|---|
| The Portfolio Overseer | ADMIN | Everything + Administration |
| The Ministry Project Manager | PROJECT_MANAGER | Own projects + full tools |
| The Data Analyst | STAKEHOLDER | Department review + exports |
| The Strategic Observer | VIEWER | Read-only briefings |

## Verify it worked
- Sign in as two different personas in turn — the dashboard numbers change per role scope.
- A viewer persona cannot see mutation buttons; an admin can.

## Under the hood (honesty)
Sessions are signed tokens (JWT, 24 h) in production; the prototype keeps the same role scoping in-browser so behaviour is identical.
