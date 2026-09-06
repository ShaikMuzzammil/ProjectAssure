# Workflow 01 · Create an account

**One line:** Register with your name, email and a strong password — you get a private, securely isolated workspace the moment you sign in.

**Who uses it:** any new user (officer, manager, stakeholder, viewer) who wants their own projects.

## Click path
1. Open the platform link → **Launch demo**.
2. On the sign-in card, click **Create a new account (free)**.
3. Fill name, email, pick a role (Project Manager is a good first role), department, and a password — the strength meter shows policy compliance.
4. Press **Create account**.

## What happens
- Your password is one-way encrypted (PBKDF2-SHA256, 100k iterations, per-user salt) before it is stored — it is never saved as plain text.
- You are signed in automatically and land on **your** dashboard: empty of other people's projects, with a friendly getting-started banner.
- A welcome notification and audit entry (`REGISTER`) are recorded.
- Each account keeps its **own projects, documents, predictions and exports** — nothing leaks between users.

## Verify it worked
- Reload the page — your session survives (deep links like `#/app/projects` restore correctly).
- Create a project (workflow 05) → sign out → sign back in → the project is still there, scoped to you.

## Under the hood (honesty)
Registered accounts are mirrored to the production database (Prisma, server-side scrypt) when it is connected; without keys the app runs the same flow fully in-browser so the demo can never break.
