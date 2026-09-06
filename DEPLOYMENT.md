# ProjectAssure — Deployment Guide (v22)

End-to-end deployment instructions for the **two-app** structure (main app + host-control).

> **Two separate Vercel projects.** Main app deploys from the repo root; host-control deploys from the `host-control/` subfolder.

---

## Option A · Vercel (recommended — zero DevOps)

### Step 1 — Push to GitHub

Push the **contents** of `prototype/` to a single GitHub repo's `main` branch:

```
my-repo/
├── src/                       # Main app source
├── prisma/
├── public/
├── package.json               # Main app deps
├── next.config.ts
├── tsconfig.json
├── ...
└── host-control/              # ← Subfolder — Host Control's own Next.js project
    ├── src/
    ├── prisma/
    ├── public/
    ├── package.json           # Host's own deps
    ├── next.config.ts
    └── ...
```

### Step 2 — Deploy Project 1 (Main app)

1. Go to [vercel.com/new](https://vercel.com/new), import the repo.
2. **Project Name**: `projectassure`
3. **Root Directory**: leave as `./` (repo root).
4. **Framework Preset**: Next.js (auto-detected).
5. **Build Command**: `next build` (default).
6. **Install Command**: `npm install --legacy-peer-deps`.
7. **Environment Variables**:
   | Variable | Required | Example |
   |----------|----------|---------|
   | `DATABASE_URL` | yes | `postgresql://...` (Vercel Postgres) |
   | `NEXTAUTH_SECRET` | yes | `openssl rand -base64 32` |
   | `NEXT_PUBLIC_HOST_URL` | yes (set after Step 3) | `https://projectassure-host.vercel.app` |
   | `SMTP_HOST` | no | `smtp.gmail.com` |
   | `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | no | |
8. Deploy → e.g., `https://projectassure.vercel.app`.

### Step 3 — Deploy Project 2 (Host Control)

1. On Vercel, **import the same GitHub repo** again.
2. **Project Name**: `projectassure-host`
3. **Root Directory**: set to `host-control/` (NOT `./`). Vercel will use only that subfolder.
4. **Framework Preset**: Next.js.
5. **Build Command**: `next build`.
6. **Install Command**: `npm install --legacy-peer-deps`.
7. **Environment Variables**:
   | Variable | Required | Example |
   |----------|----------|---------|
   | `DATABASE_URL` | yes | same Postgres URL as Project 1 |
   | `HOST_CONTROL_ADMIN_EMAIL` | yes | `admin@projectassure.gov.in` |
   | `HOST_CONTROL_ADMIN_PASSWORD_HASH` | yes | PBKDF2 hash (see below) |
   | `MAIN_APP_URL` | yes | `https://projectassure.vercel.app` |
   | `NEXTAUTH_SECRET` | yes | same as Project 1 |
   | `SMTP_*` | no | same as Project 1 if you want emails |
8. Deploy → e.g., `https://projectassure-host.vercel.app`.

### Step 4 — Wire them together

1. Back in **Project 1** (main app), update `NEXT_PUBLIC_HOST_URL` to the host-control URL from Step 3.
2. Redeploy Project 1.
3. Done — both apps share the same Postgres DB; the sync API (`/api/sync/*` on main, `/api/admin/sync` on host) keeps the host mirror warm.

### Generating the admin password hash

```bash
cd prototype/host-control
node -e "
  const { scryptSync, randomBytes } = require('crypto');
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync('changeme', salt, 64).toString('hex');
  console.log('pbkdf2\$sha256\$100000\$' + salt + '\$' + hash);
"
# Copy the output into HOST_CONTROL_ADMIN_PASSWORD_HASH
```

---

## Option B · Docker Compose (single VM)

```yaml
# docker-compose.yml
version: "3.9"
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: projectassure
      POSTGRES_USER: pa
      POSTGRES_PASSWORD: changeme
    volumes: [pa-pg:/var/lib/postgresql/data]
    ports: ["5432:5432"]

  main-app:
    build: ./prototype
    depends_on: [db]
    environment:
      DATABASE_URL: postgresql://pa:changeme@db:5432/projectassure
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXT_PUBLIC_HOST_URL: http://host-control:3001
    ports: ["3000:3000"]

  host-control:
    build: ./prototype/host-control
    depends_on: [db]
    environment:
      DATABASE_URL: postgresql://pa:changeme@db:5432/projectassure
      HOST_CONTROL_ADMIN_EMAIL: admin@projectassure.gov.in
      HOST_CONTROL_ADMIN_PASSWORD_HASH: ${HASH}
      MAIN_APP_URL: http://main-app:3000
    ports: ["3001:3001"]

volumes:
  pa-pg:
```

Run:

```bash
export NEXTAUTH_SECRET=$(openssl rand -base64 32)
export HASH=$(cd prototype/host-control && node -e "...")
docker compose up -d --build
```

---

## Option C · On-prem (PM2 + Nginx)

```bash
# 1. Install Node 20+, Postgres 14+, Nginx, PM2

# 2. Main app
cd /opt/projectassure/prototype
npm install --legacy-peer-deps
npx prisma db push --accept-data-loss
npm run build
pm2 start "node .next/standalone/server.js" --name pa-main
pm2 save && pm2 startup

# 3. Host Control
cd /opt/projectassure/prototype/host-control
npm install --legacy-peer-deps
npx prisma db push --accept-data-loss
npm run build
pm2 start "node .next/standalone/server.js" --name pa-host
pm2 save

# 4. Nginx reverse proxy (port 80 → 3000 main, 3001 host)
cat > /etc/nginx/sites-available/projectassure <<'EOF'
server {
    listen 80;
    server_name projectassure.gov.in;
    location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host $host; }
}
server {
    listen 80;
    server_name host.projectassure.gov.in;
    location / { proxy_pass http://127.0.0.1:3001; proxy_set_header Host $host; }
}
EOF
ln -s /etc/nginx/sites-available/projectassure /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## Smoke tests (post-deploy)

```bash
MAIN=https://projectassure.vercel.app
HOST=https://projectassure-host.vercel.app

# Main app health
curl -s $MAIN/api/health | jq .              # → { ok: true }

# Main app login (demo persona)
curl -s -X POST $MAIN/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ananya.k@nic.in","password":"demo1234"}' | jq .

# Main app → Host sync state
curl -s $MAIN/api/sync/state | jq . | head -30

# Host control health
curl -s $HOST/api/health | jq .               # → { ok: true }

# Host control admin login
curl -s -c /tmp/cookies -X POST $HOST/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@projectassure.gov.in","password":"changeme"}' | jq .

# Host control dashboard sync
curl -s -b /tmp/cookies $HOST/api/admin/sync | jq . | head -30

# Pages render
for path in "/" "/#/app/tracking" "/#/app/india-map" "/#/app/geo-audit"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$MAIN$path")
  echo "$MAIN$path → $code"
done
echo "$HOST/ → $(curl -s -o /dev/null -w '%{http_code}' $HOST/)"
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Build fails with `Module not found: xlsx` / `jspdf` | `npm install --legacy-peer-deps` (dynamic imports — must be installed) |
| `ENOENT: no such file or directory, open '.next/next-server.js.nft.json'` | This was a v21 bug; v22's `next.config.ts` removed the `output: 'standalone'` override that triggered it. Delete `.next/` and rebuild. |
| Host control 401 unauthorized | `HOST_CONTROL_ADMIN_PASSWORD_HASH` must be generated by `src/lib/host/auth.ts → hashPassword()` — plain text will not work. |
| India map blank | Leaflet is loaded client-side via CDN (`unpkg.com`). If your network blocks it, switch the URLs in `src/components/projectassure/views/india-map-view.tsx` to a self-hosted copy in `/public/leaflet/`. |
| Host control can't reach main app | Check `MAIN_APP_URL` env var points to the main app URL (not localhost in production). |
| Prisma client not generated | Add `"postinstall": "prisma generate"` to `package.json` (already in v22). On Vercel this runs automatically. |
| Login button hangs | `NEXTAUTH_SECRET` must be set and at least 32 chars. |
| Email not sending | Without `SMTP_HOST`, the app simulates sends (visible in host-control outbox). For real SMTP, set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. |

---

## Rollback

Vercel keeps every deployment. To roll back:
1. Vercel dashboard → your project → Deployments
2. Find the last known-good deployment
3. `⋯` → **Promote to Production**

For Docker / on-prem: keep the previous image tagged, `docker stop projectassure && docker run ... projectassure:v21`.
