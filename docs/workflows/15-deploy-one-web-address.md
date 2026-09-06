# Workflow 15 · Deploy on one web address

**One line:** Put the whole platform on one free, secure web address in ~15 minutes with the step-by-step deployment guide.

**Who uses it:** the team member taking the prototype live for judges or pilots.

## Click path
1. Read [`DEPLOYMENT_GUIDE.md`](../DEPLOYMENT_GUIDE.md) top to bottom once (~10 minutes).
2. Push the `prototype/` folder to GitHub.
3. Import to the free hosting platform (guide §2) → add the free keys (guide §3, all optional) → deploy.
4. Run the **post-deploy checklist** (guide §7): health check, sign-up, upload, prediction, export, email.

## The one-address story
- **One deployment, one link** — landing, login, app, exports all behind it; no portals to juggle.
- All roles, all features, all devices on that link.
- Free tier end to end: **₹0 running cost**.

## Keys (all optional — the demo works without any)
| Key | Unlocks | Free tier |
|---|---|---|
| Database URL | production persistence & per-user accounts | generous free tier |
| Email provider | real outbound email | 300/day |
| Live intelligence service | live answers mode | free tier |

## Verify it worked
Open your link on a phone: sign in → create project → upload → export PDF → all flows behave exactly as on localhost.

## Under the hood (honesty)
The deployment guide documents every variable, every free tier limit, and the exact troubleshooting rows for each failure mode we actually encountered.
