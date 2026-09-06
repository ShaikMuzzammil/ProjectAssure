# ProjectAssure - API Design & Endpoints

> Supporting technical document for the Smart India Hackathon 2026 submission of **ProjectAssure** — Problem Statement ID: SIH26103, Theme: Smart Automation, Category: Software, Organisation: MoSPI. Prepared by Team [TEAM NAME], Amrita Vishwa Vidyapeetham, Chennai Campus.

This document is the single contract for every HTTP and WebSocket interface exposed by the ProjectAssure platform: the three-domain REST architecture, global request/response conventions, a catalogue of **85 endpoints across 16 resource groups** (26 of them with full request/response JSON examples), the role-based access matrix, the real-time Socket.io event catalogue, rate limiting and security configuration, a typed TypeScript client SDK, a copy-paste curl testing cookbook, and the API test plan with Postman collection layout.

**Contents:** PART A — Architecture | PART B — Global Conventions | PART C — Endpoint Reference | PART D — RBAC Matrix | PART E — WebSocket Events | PART F — Rate Limiting & Security | PART G — Client SDK | PART H — curl Cookbook | PART I — Testing & Postman

## PART A — API Architecture Overview

### In Plain English
> Imagine ProjectAssure as a government office complex with three service wings: the main wing holds your files (projects, tasks, alerts), a statistics wing prints charts and exports, and a back-room analyst answers questions in plain language. Each wing has a fixed menu of counters — the endpoints. You arrive with a request slip in a standard format, show your ID card at the gate (the JWT token), and the clerk either hands you a file (JSON response) or a stamped rejection slip (the error envelope) that states exactly what went wrong. Because every counter follows the same paperwork rules, any visitor — the web dashboard, a mobile app, or an integration script — can be served without special treatment.

### A.1 Design Philosophy

ProjectAssure uses a **RESTful API** design with Next.js API Routes (App Router). Each domain exposes its own set of endpoints, all sharing a common authentication layer and database.

| # | Principle | How it shows up in ProjectAssure |
|---|-----------|----------------------------------|
| 1 | Resource-oriented URLs | Nouns in plural collections: `/api/projects`, `/api/milestones/:id`. Actions live in HTTP verbs, not in URL text |
| 2 | Stateless requests | Every request carries its own JWT; no server-side session affinity is needed across the three domains |
| 3 | JSON everywhere | `application/json` for bodies and errors; the single exception is the multipart upload to `/api/documents/ingest` |
| 4 | One error shape | Every failure on every domain returns `{ error: { code, message, details? } }` (PART B.6) |
| 5 | Validate at the door | Zod schemas parse query and body before business logic runs; failures return HTTP 422 |
| 6 | Audited by default | Every mutating call writes an `AuditLog` row asynchronously after the response is sent |
| 7 | Predictable scale limits | Upstash-based rate limiting with per-route budgets (PART F) |
| 8 | RBAC on every route | Roles ADMIN / PROJECT_MANAGER / STAKEHOLDER / VIEWER enforced in the route handler (PART D) |

### A.2 Base URLs

| Domain | Base URL | Purpose |
|--------|----------|---------|
| Main App | `https://projectassure.vercel.app/api` | Core CRUD, auth, alerts, users, reports |
| Analytics | `https://analytics.projectassure.vercel.app/api` | Portfolio/budget/resource/trend analytics, exports |
| AI Engine | `https://ai.projectassure.vercel.app/api` | Chat, document ingest, predictions, summaries |
| ML Service (internal) | Python FastAPI, reached only by AI Engine handlers | `/predict/delay`, `/predict/budget`, `/calculate-health` |

The ML Service is **not exposed publicly**. The AI Engine's Next.js route handlers (`/api/predict/*`, `/api/chat`, `/api/documents/ingest`, `/api/summarize`) act as orchestrators: they authenticate and rate-limit the external call, invoke the FastAPI ML microservice for model inference, call OpenAI GPT-4o / Google Gemini for generative steps, persist results as `PredictionResult` and `RiskAssessment` rows, and then return a single normalized JSON response to the caller.

### A.3 Middleware Pipeline

Every API request passes through the following middleware:

```
Request
  ↓
1. CORS Check
  ↓
2. Rate Limiting (Upstash Ratelimit)
  ↓
3. JWT Authentication (verify token)
  ↓
4. Role Authorization (check permissions)
  ↓
5. Request Validation (Zod schema)
  ↓
6. Business Logic (controller/service)
  ↓
7. Response (with pagination if applicable)
  ↓
8. Audit Log (async, non-blocking)
  ↓
Response
```

Steps 1-4 are implemented once in a shared `withAuth(handler, { roles, limit })` wrapper used by every route file, so no endpoint can accidentally skip authentication or authorization. Steps 5-7 are route-specific. Step 8 is fire-and-forget: an audit failure never fails the caller's request.

### A.4 Versioning Policy

| Topic | Policy |
|-------|--------|
| Current version | `/api` (unversioned) during the SIH 2026 build cycle; treated as **v1** |
| General availability | At GA the same surface is pinned as `/api/v1`; `/api` becomes an alias for one release cycle |
| Additive changes | New optional fields, new endpoints, new query parameters: **no version bump**. Clients must ignore unknown JSON fields |
| Breaking changes | Renaming/removing fields, changing semantics, removing enum values: **new version** (`/api/v2`) with a minimum 6-month overlap |
| Deprecation signalling | Retired routes return `Deprecation: true` and `Sunset: <HTTP-date>` headers plus a warning entry in the error `details` |
| Version discovery | `GET /api/meta/version` returns `{ "apiVersion": "v1", "minClientVersion": "1.4.0", "changelog": "https://projectassure.vercel.app/api-changelog" }` |

### A.5 Standard Request & Response Headers

| Header | Direction | Required | Notes |
|--------|-----------|----------|-------|
| `Authorization: Bearer <jwt>` | Request | Yes (all routes except `/auth/login`, `/auth/register`) | NextAuth-issued JWT; session cookie accepted for same-domain browser calls |
| `Content-Type: application/json` | Request | Yes (JSON routes) | `multipart/form-data` only for `/documents/ingest` |
| `Accept: application/json` | Request | Recommended | Export routes return `text/csv` or `application/pdf` instead |
| `X-Request-Id` | Request/Response | Optional | Client-generated UUID; echoed back and written to `AuditLog` for tracing |
| `X-Organization-Id` | Request | Optional | Only for ADMIN cross-organization views; must match the token's `orgId` claim or the call is rejected with 403 |
| `Idempotency-Key` | Request | Conditional | Required on retry for POST create routes (A.6) |
| `X-RateLimit-Limit` / `-Remaining` / `-Reset` | Response | Always | Mirrors the Upstash counters (PART F) |
| `Retry-After` | Response | With 429/503 | Seconds to wait before retrying |

```http
GET /api/projects?page=1&limit=20&sort=-healthScore HTTP/1.1
Host: projectassure.vercel.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
X-Request-Id: 7c9e6679-7425-40de-944b-e07fc1f90ae7
```

### A.6 Idempotency

Read methods are naturally idempotent, and `DELETE` performs a soft delete (status change), so repeating it is safe. The dangerous case is a **retried POST**: a dropped response after a successful create would cause a duplicate `BudgetRecord` if the client blindly retries. Therefore:

1. Every POST that creates a durable record (`/projects`, `/budget/records`, `/resources`, `/documents/ingest`, `/reports/generate`) accepts an optional `Idempotency-Key: <uuid>` header.
2. The server stores `key + request hash + response` in Upstash Redis for **24 hours**, scoped to the authenticated user.
3. A retry with the same key and same body returns the stored response with the extra header `Idempotent-Replay: true` and HTTP status of the original call.
4. The same key with a **different** body is rejected with `409 { "error": { "code": "IDEMPOTENCY_MISMATCH" } }`.

### A.7 CORS Policy

| Setting | Value |
|---------|-------|
| Allowed origins (prod) | `https://projectassure.vercel.app`, `https://analytics.projectassure.vercel.app`, `https://ai.projectassure.vercel.app` |
| Allowed origins (dev) | `http://localhost:3000`, `http://localhost:3001`, `http://localhost:3002` |
| Methods | `GET, POST, PATCH, DELETE, OPTIONS` |
| Allowed headers | `Authorization, Content-Type, X-Request-Id, Idempotency-Key, X-Organization-Id` |
| Credentials | `true` (needed for the same-site NextAuth session cookie) |
| Preflight cache | `Access-Control-Max-Age: 86400` |

Cross-domain browser calls (main app page calling the analytics or AI domain) prefer the **Bearer token** flow, because third-party cookie restrictions increasingly block cross-subdomain cookies.

### A.8 Real-Time Layer

REST handles all writes; pushes travel over Socket.io co-deployed with the main app (`wss://projectassure.vercel.app/socket.io`). Clients join rooms (`project:{id}`, `user:{id}`, `org:{id}`) after a JWT-authenticated handshake and receive alert broadcasts, project updates, and notification pushes without polling — full catalogue in PART E.

## PART B — Global Conventions

### In Plain English
> Every counter in the office accepts forms filled the same way: the same ID proof (auth header), the same page numbering (pagination), the same shorthand for "sort newest first" (query grammar), and the same rejection-slip layout (error envelope). Learn the format once and you can deal with any counter in the building — the auth counter, the projects counter, or the AI analyst in the back room — without re-learning paperwork at each window.

### B.1 Authentication Header Formats

Two schemes are accepted, in this priority order:

```http
# 1. Bearer token (required for cross-domain calls, CLIs, SDK, integrations)
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3JfMDEiLCJyb2xlIjoiUFJPSkVDVF9NQU5BR0VSIn9.xB4Y...

# 2. NextAuth session cookie (same-domain browser calls only)
Cookie: next-auth.session-token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**JWT claims** (HS256, issued by NextAuth at login/refresh):

| Claim | Example | Description |
|-------|---------|-------------|
| `sub` | `usr_018f3...` | User id (`User` model) |
| `email` | `rajesh@mospi.gov.in` | Login identifier |
| `role` | `PROJECT_MANAGER` | One of ADMIN / PROJECT_MANAGER / STAKEHOLDER / VIEWER |
| `orgId` | `org_mospi_001` | Organization (`Organization` model) |
| `departmentId` | `dept_001` | Home department (`Department` model) |
| `iat` / `exp` | `1770000000` | Issued-at / expiry; access token lives 24 h |

Token lifecycle: `POST /api/auth/login` issues the token; `POST /api/auth/refresh` rotates it up to 7 days from first login; an expired token yields `401 AUTH_TOKEN_EXPIRED` and the client must refresh rather than re-prompt for credentials.

**401 vs 403 in one line each:**

```json
// 401 — the gate could not identify you (missing/expired/garbled token)
{ "error": { "code": "AUTH_TOKEN_EXPIRED", "message": "Access token expired at 2026-03-01T09:14:00Z", "details": { "expiredAt": "2026-03-01T09:14:00Z" } } }

// 403 — the gate knows you, but this counter is not for your badge (role/ownership check failed)
{ "error": { "code": "AUTH_FORBIDDEN", "message": "Role VIEWER cannot create projects", "details": { "requiredRole": "PROJECT_MANAGER", "actualRole": "VIEWER" } } }
```

### B.2 Standard Response Envelope

| Endpoint kind | Shape | Example |
|---------------|-------|---------|
| List | `{ "data": [...], "meta": { page, limit, total, totalPages } }` | `GET /api/projects` |
| Single object | Bare resource object (no envelope) | `GET /api/projects/:id/health` |
| Action result | Bare object describing the effect | `PATCH /api/alerts/:id/read` |
| Error | `{ "error": { code, message, details? } }` | Any failure |

### B.3 Pagination

All list endpoints accept `?page=` (default 1) and `?limit=` (default 20, max 100). Responses always carry `meta.totalPages` so clients can render pager controls without guessing.

```json
// GET https://projectassure.vercel.app/api/projects?page=2&limit=3
{
  "data": [
    { "id": "proj_004", "name": "Rural Electrification - Wardha", "status": "ACTIVE", "healthScore": 67, "healthCategory": "AT_RISK" },
    { "id": "proj_005", "name": "Smart Water Metering - Indore", "status": "ACTIVE", "healthScore": 88, "healthCategory": "HEALTHY" },
    { "id": "proj_006", "name": "District Hospital Upgrade - Nashik", "status": "ON_HOLD", "healthScore": 55, "healthCategory": "AT_RISK" }
  ],
  "meta": { "page": 2, "limit": 3, "total": 128, "totalPages": 43 }
}
```

Rules: `page` beyond `totalPages` returns an empty `data: []` with correct `meta` (never a 404); `limit > 100` is clamped to 100; sort stability is guaranteed by a secondary `id` sort.

### B.4 Filtering, Sorting & Field Selection Grammar

Filtering and sorting use one grammar on every list endpoint:

```
?status=ACTIVE                       # equality
?status=ACTIVE,ON_HOLD               # IN-list (comma separated)
?totalBudget.gte=1000&totalBudget.lte=5000   # numeric range (lakhs)
?targetDate.before=2026-12-31        # date range (also .after)
?search=highway                      # case-insensitive contains (name/description)
?sort=-healthScore,progress          # sort: "-" prefix = descending; comma = multi-key
?sortBy=healthScore&sortOrder=desc   # legacy alias still accepted for compatibility
?fields=id,name,healthScore          # sparse fieldset
?include=department,milestones       # eager-load relations
```

| Operator | Applies to | Example | Meaning |
|----------|-----------|---------|---------|
| (bare) | enums, ids, strings | `status=ACTIVE` | equals |
| `,` | enums, ids | `status=ACTIVE,ON_HOLD` | IN |
| `.gte` / `.lte` | numbers, dates | `spentBudget.gte=1500` | greater/less-or-equal |
| `.before` / `.after` | dates | `targetDate.after=2026-06-30` | strict date comparison |
| `search` | text | `search=highway` | contains, case-insensitive |
| `sort=-x,y` | any sortable field | `sort=-healthScore,progress` | ORDER BY x DESC, y ASC |

Every filterable field is declared in the endpoint's Zod query schema; unknown query keys return `422 VALIDATION_ERROR` listing the offending key in `details` — the API never silently ignores typos like `healtScore=90`.

### B.5 Request Validation (Zod)

Every route handler parses `query` and `body` against a Zod schema before touching the database. Failure returns:

```json
// POST /api/projects with totalBudget: -5 and missing startDate
// HTTP 422
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body failed schema validation",
    "details": [
      { "path": ["totalBudget"], "message": "Number must be greater than or equal to 1", "code": "too_small" },
      { "path": ["startDate"], "message": "Required", "code": "invalid_type" }
    ]
  }
}
```

### B.6 Error Envelope & Error Code Dictionary

```json
{ "error": { "code": "RATE_LIMITED", "message": "Rate limit exceeded: 5 AI chat requests per minute", "details": { "limit": 5, "resetAt": "2026-03-01T10:00:42Z" } } }
```

Full dictionary (HTTP status in brackets):

| Code | HTTP | Meaning | Typical cause and next step |
|------|------|---------|------------------------------|
| `AUTH_REQUIRED` | 401 | No credentials supplied | Attach `Authorization: Bearer` header |
| `AUTH_INVALID_TOKEN` | 401 | Token malformed or signature invalid | Re-login; do not retry with same token |
| `AUTH_TOKEN_EXPIRED` | 401 | Token past `exp` | Call `POST /api/auth/refresh` |
| `AUTH_FORBIDDEN` | 403 | Role or ownership check failed | Check PART D matrix for required role |
| `NOT_FOUND` | 404 | Resource does not exist (or is soft-deleted) | Verify id; check you can access its organization |
| `METHOD_NOT_ALLOWED` | 405 | Verb not supported on route | Fix method |
| `VALIDATION_ERROR` | 422 | Zod schema rejected query/body | Read `details[].path` and fix payload |
| `INVALID_DATE_RANGE` | 422 | `startDate >= targetDate` or bad month window | Correct the range |
| `BUDGET_EXCEEDED` | 422 | Record pushes `spentBudget` beyond hard cap | Revise record or request budget revision |
| `CONFLICT_DUPLICATE` | 409 | Unique constraint hit (email, month+project) | Fetch existing record instead |
| `INVALID_STATE_TRANSITION` | 409 | Illegal status move (e.g. COMPLETED → IN_PROGRESS) | Follow the status state machine |
| `DEPENDENCY_CYCLE` | 409 | Task dependency would create a cycle | Remove the offending edge |
| `RESOURCE_LOCKED` | 409 | Concurrent edit conflict (row version mismatch) | Re-fetch, re-apply changes |
| `IDEMPOTENCY_MISMATCH` | 409 | Same `Idempotency-Key`, different body | Generate a fresh key |
| `PAYLOAD_TOO_LARGE` | 413 | Body/file above limit (documents: 25 MB) | Compress or split the file |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | File type not in allowlist (PDF/XLSX/CSV/PNG/JPG) | Convert the document |
| `RATE_LIMITED` | 429 | Route budget exhausted (PART F) | Honour `Retry-After` |
| `QUOTA_EXCEEDED` | 429 | Monthly AI/export quota exhausted | Wait for quota reset or raise plan |
| `PREDICTION_FAILED` | 502 | FastAPI ML service returned an error | Retry once; check model service health |
| `AI_TIMEOUT` | 504 | LLM/ML call exceeded 30 s | Retry with exponential backoff |
| `SERVICE_UNAVAILABLE` | 503 | Dependency (Redis/DB/ML) down | Back off; status page has details |
| `INTERNAL_ERROR` | 500 | Unhandled server fault | Report with `X-Request-Id`; do not retry blindly |

### B.7 Data Types & Units

| Type | Convention | Example |
|------|------------|---------|
| Timestamps | ISO 8601 UTC | `2026-03-01T10:00:00Z` |
| Dates | `YYYY-MM-DD` | `2027-06-30` |
| Money | Integer **lakhs of INR** (as in MoSPI data) | `totalBudget: 2500` = Rs. 25 crore |
| Scores | Integer 0-100 | `healthScore: 42` |
| Probabilities | Float 0-1, two decimals | `delayProbability: 0.78` |
| Percentages | Integer 0-100 | `utilisation: 71` |

Core enums: `Role` = ADMIN / PROJECT_MANAGER / STAKEHOLDER / VIEWER; `ProjectStatus` = PLANNED / ACTIVE / ON_HOLD / COMPLETED / CANCELLED; `HealthCategory` = HEALTHY / AT_RISK / CRITICAL; `MilestoneStatus` = NOT_STARTED / IN_PROGRESS / COMPLETED / DELAYED; `TaskStatus` = TODO / IN_PROGRESS / REVIEW / DONE / BLOCKED; `AlertSeverity` = INFO / WARNING / CRITICAL; `BudgetCategory` = CONSTRUCTION / EQUIPMENT / HUMAN_RESOURCES / MATERIALS / OTHER.

## PART C — Endpoint Reference

### In Plain English
> This part is the full menu: 85 dishes across 16 counters. Each dish card lists what you can order (method + path), who is allowed to order it (role), what toppings you may request (query/body parameters), and — for the 26 most-ordered dishes — a photographed example of exactly what arrives on your plate (request and response JSON). The remaining dishes share a one-line description because they follow the same house recipe.

Conventions applied throughout PART C: base domain is the **Main App** unless marked `AI` (ai.projectassure.vercel.app) or `AN` (analytics.projectassure.vercel.app); all mutating routes require `Content-Type: application/json`; all list routes support PART B.4 grammar; roles are ADMIN / PROJECT_MANAGER (PM) / STAKEHOLDER (ST) / VIEWER (VW).

### C.1 Authentication (6 endpoints)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | ADMIN | Register a new user (admin-only provisioning) |
| POST | `/api/auth/login` | Public | Exchange credentials for JWT |
| POST | `/api/auth/refresh` | Any | Rotate access token (valid 7 days from first login) |
| POST | `/api/auth/logout` | Any | Invalidate current session/token |
| GET | `/api/auth/me` | Any | Current user profile + permissions |
| POST | `/api/auth/change-password` | Any | Change own password (re-validates current one) |

**POST `/api/auth/register`** — Admin only; self-signup is intentionally disabled for a government deployment.

```json
// Request
{
  "name": "Rajesh Kumar",
  "email": "rajesh@mospi.gov.in",
  "password": "SecurePass123!",
  "role": "PROJECT_MANAGER",
  "departmentId": "dept_001"
}

// Response 201
{
  "user": { "id": "clx9f2k71m4qp0123abcd", "name": "Rajesh Kumar", "email": "rajesh@mospi.gov.in", "role": "PROJECT_MANAGER", "departmentId": "dept_001" },
  "token": "eyJ..."
}
```

**POST `/api/auth/login`** — Rate limited to 10/min/IP (see PART F); failed attempts are audit-logged.

```json
// Request
{ "email": "rajesh@mospi.gov.in", "password": "SecurePass123!" }

// Response 200
{
  "user": { "id": "clx9f2k71m4qp0123abcd", "name": "Rajesh Kumar", "role": "PROJECT_MANAGER", "organizationId": "org_mospi_001" },
  "token": "eyJ...",
  "expiresAt": "2026-03-02T10:00:00Z"
}
```

**GET `/api/auth/me`** — compact example: `{ "id": "clx9f2...", "name": "Rajesh Kumar", "email": "rajesh@mospi.gov.in", "role": "PROJECT_MANAGER", "department": { "id": "dept_001", "name": "Transport" }, "permissions": ["project:read", "project:write", "task:write"] }`

### C.2 Users & Directory (6 endpoints)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/users` | ADMIN, PM | List users; filters `role`, `departmentId`, `search`; paginated |
| POST | `/api/users` | ADMIN | Create user (same payload as register) |
| GET | `/api/users/:id` | ADMIN, PM | User detail with department and project count |
| PATCH | `/api/users/:id` | ADMIN | Update role, department, status |
| DELETE | `/api/users/:id` | ADMIN | Deactivate user (soft; audit-logged) |
| GET | `/api/users/:id/activity` | ADMIN, PM | Recent `AuditLog` entries for that user, paginated |

Role-change example (compact): `PATCH /api/users/usr_042` body `{ "role": "STAKEHOLDER" }` → `200 { "id": "usr_042", "role": "STAKEHOLDER", "updatedAt": "2026-03-01T10:02:11Z" }`. A user cannot demote themselves; the last ADMIN of an organization cannot be deactivated (`409 INVALID_STATE_TRANSITION`).

### C.3 Projects (8 endpoints)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/projects` | Any (scoped) | List projects with filtering, sorting, pagination |
| POST | `/api/projects` | ADMIN, PM | Create a new project |
| GET | `/api/projects/:id` | Any (scoped) | Full project detail: milestones, latest risk assessment, latest prediction |
| PATCH | `/api/projects/:id` | ADMIN, PM | Update project fields |
| DELETE | `/api/projects/:id` | ADMIN | Soft delete (set status CANCELLED) |
| GET | `/api/projects/:id/health` | Any (scoped) | Detailed health breakdown |
| GET | `/api/projects/:id/risk` | Any (scoped) | Latest `RiskAssessment` row |
| GET | `/api/projects/:id/timeline` | Any (scoped) | Chronological milestone/task/event feed |

**GET `/api/projects`** — Query parameters: `status`, `healthCategory` (HEALTHY/AT_RISK/CRITICAL), `departmentId`, `search`, `sort` (canonical: `-healthScore,progress,targetDate,name`; legacy `sortBy`+`sortOrder` also accepted), `page` (default 1), `limit` (default 20).

```json
// Response 200
{
  "data": [
    {
      "id": "proj_001",
      "name": "National Highway Extension - Phase 3",
      "status": "ACTIVE",
      "healthScore": 42,
      "healthCategory": "CRITICAL",
      "progress": 58,
      "totalBudget": 2500,
      "spentBudget": 1750,
      "targetDate": "2027-06-30",
      "department": { "name": "Ministry of Road Transport" }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 128, "totalPages": 7 }
}
```

**POST `/api/projects`** — Body validated by Zod; `Idempotency-Key` recommended.

```json
// Request
{
  "name": "New Government Hospital - Pune",
  "description": "Construction of a 200-bed hospital...",
  "startDate": "2026-06-01",
  "targetDate": "2027-06-30",
  "totalBudget": 2500,
  "departmentId": "dept_002",
  "state": "Maharashtra",
  "district": "Pune",
  "sector": "Health",
  "scheme": "PM Ayushman Bharat"
}

// Response 201
{
  "id": "proj_129",
  "name": "New Government Hospital - Pune",
  "status": "PLANNED",
  "healthScore": 100,
  "healthCategory": "HEALTHY",
  "progress": 0,
  "totalBudget": 2500,
  "spentBudget": 0,
  "startDate": "2026-06-01",
  "targetDate": "2027-06-30",
  "departmentId": "dept_002",
  "createdBy": "clx9f2k71m4qp0123abcd",
  "createdAt": "2026-03-01T10:05:00Z"
}
```

**GET `/api/projects/:id`** — compact example (relations truncated): `{ "id": "proj_001", "name": "National Highway Extension - Phase 3", "status": "ACTIVE", "healthScore": 42, "milestones": [ { "id": "mst_101", "name": "Structural Work", "status": "DELAYED" } ], "latestRiskAssessment": { "id": "risk_881", "overallScore": 42, "createdAt": "2026-02-28T06:00:00Z" }, "latestPrediction": { "delayProbability": 0.78, "estimatedDelayDays": 23 } }`

**GET `/api/projects/:id/health`** — computed by the ML `calculate-health` routine, cached 15 min:

```json
{
  "overall": { "score": 42, "category": "CRITICAL" },
  "schedule": { "score": 35, "risk": "HIGH", "daysBehind": 18 },
  "budget": { "score": 62, "risk": "MEDIUM", "utilisation": 71, "projectedOverrun": 12 },
  "resources": { "score": 28, "risk": "HIGH", "bottlenecks": ["Steel shortage - 18 days pending"] },
  "milestones": { "score": 45, "risk": "HIGH", "completed": 3, "total": 7, "criticalDelayed": 1 }
}
```

### C.4 Milestones (7 endpoints)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/projects/:id/milestones` | Any (scoped) | List all milestones for a project |
| POST | `/api/projects/:id/milestones` | ADMIN, PM | Create a milestone |
| GET | `/api/milestones/:id` | Any (scoped) | Milestone detail with tasks summary |
| PATCH | `/api/milestones/:id` | ADMIN, PM | Update milestone fields |
| DELETE | `/api/milestones/:id` | ADMIN, PM | Delete milestone (fails if tasks exist unless `?force=true`) |
| PATCH | `/api/milestones/:id/status` | ADMIN, PM | Update milestone status (state machine enforced) |
| GET | `/api/milestones/:id/critical-path` | Any (scoped) | Critical path analysis |

**POST `/api/projects/:id/milestones`**

```json
// Request
{
  "name": "Structural Work",
  "description": "RCC structure for all 3 blocks",
  "dueDate": "2026-11-30",
  "isCritical": true,
  "weight": 30,
  "ownerId": "usr_042"
}

// Response 201
{
  "id": "mst_101",
  "projectId": "proj_001",
  "name": "Structural Work",
  "status": "NOT_STARTED",
  "progress": 0,
  "dueDate": "2026-11-30",
  "isCritical": true,
  "weight": 30,
  "ownerId": "usr_042",
  "createdAt": "2026-03-01T10:08:00Z"
}
```

**PATCH `/api/milestones/:id/status`** — allowed transitions: NOT_STARTED→IN_PROGRESS→COMPLETED; any→DELAYED; DELAYED→IN_PROGRESS/COMPLETED. Illegal moves return `409 INVALID_STATE_TRANSITION`. Emits Socket.io `milestone:status-changed`.

```json
// Request
{ "status": "DELAYED", "reason": "Steel procurement pending 18 days" }

// Response 200
{
  "id": "mst_101",
  "status": "DELAYED",
  "delayDays": 12,
  "reason": "Steel procurement pending 18 days",
  "projectHealthImpact": { "previous": 47, "current": 42 },
  "updatedAt": "2026-03-01T10:10:00Z"
}
```

**GET `/api/milestones/:id/critical-path`** — compact example: `{ "milestoneId": "mst_101", "onCriticalPath": true, "slackDays": 0, "successorMilestones": [ { "id": "mst_102", "name": "Electrical Fitting", "slackDays": 4 } ], "projectEndImpactDays": 18, "bottleneckTasks": ["tsk_501", "tsk_507"] }`

### C.5 Tasks (6 endpoints)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/milestones/:id/tasks` | Any (scoped) | List tasks for a milestone |
| POST | `/api/milestones/:id/tasks` | ADMIN, PM | Create a task |
| GET | `/api/tasks/:id` | Any (scoped) | Task detail with dependencies |
| PATCH | `/api/tasks/:id` | ADMIN, PM | Update task (assignee, status, progress, dates) |
| DELETE | `/api/tasks/:id` | ADMIN, PM | Delete task and its dependency edges |
| GET | `/api/projects/:id/tasks/board` | Any (scoped) | Tasks grouped Kanban-style by status |

**POST `/api/milestones/:id/tasks`**

```json
// Request
{
  "title": "Steel reinforcement - Zone B",
  "description": "Reinforcement for columns ZB-1 to ZB-24",
  "assigneeId": "usr_055",
  "startDate": "2026-03-05",
  "dueDate": "2026-04-15",
  "priority": "HIGH",
  "estimatedHours": 320
}

// Response 201
{
  "id": "tsk_501",
  "milestoneId": "mst_101",
  "projectId": "proj_001",
  "title": "Steel reinforcement - Zone B",
  "status": "TODO",
  "progress": 0,
  "priority": "HIGH",
  "assigneeId": "usr_055",
  "startDate": "2026-03-05",
  "dueDate": "2026-04-15",
  "estimatedHours": 320,
  "createdAt": "2026-03-01T10:12:00Z"
}
```

**PATCH `/api/tasks/:id`** — Emits `task:moved` when `status` changes.

```json
// Request
{ "status": "IN_PROGRESS", "progress": 40, "blockerNote": "Awaiting TMT steel batch 3" }

// Response 200
{
  "id": "tsk_501",
  "status": "IN_PROGRESS",
  "progress": 40,
  "blockerNote": "Awaiting TMT steel batch 3",
  "dependencySummary": { "blockedBy": 0, "blocks": 2 },
  "updatedAt": "2026-03-01T10:15:00Z"
}
```

**GET `/api/projects/:id/tasks/board`** — compact example: `{ "projectId": "proj_001", "columns": { "TODO": [ { "id": "tsk_502", "title": "Electrical conduit layout", "assignee": "usr_056" } ], "IN_PROGRESS": [ { "id": "tsk_501", "title": "Steel reinforcement - Zone B", "progress": 40 } ], "REVIEW": [], "DONE": [ { "id": "tsk_498", "title": "Foundation pour - Block C", "completedAt": "2026-02-20" } ], "BLOCKED": [ { "id": "tsk_507", "title": "Roof truss assembly", "blocker": "Steel shortage" } ] } }`

### C.6 Task Dependencies (3 endpoints)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/tasks/:id/dependencies` | ADMIN, PM | Add a dependency edge (cycle-checked) |
| DELETE | `/api/dependencies/:id` | ADMIN, PM | Remove a dependency edge |
| GET | `/api/projects/:id/dependencies` | Any (scoped) | Full dependency graph (nodes + edges) |

**POST `/api/tasks/:id/dependencies`** — The server runs a DFS cycle check; introducing a cycle returns `409 DEPENDENCY_CYCLE`.

```json
// Request  (task tsk_507 cannot start until tsk_501 finishes)
{ "dependsOnTaskId": "tsk_501", "type": "FINISH_TO_START", "lagDays": 2 }

// Response 201
{
  "id": "dep_301",
  "taskId": "tsk_507",
  "dependsOnTaskId": "tsk_501",
  "type": "FINISH_TO_START",
  "lagDays": 2,
  "graphState": { "longestChainTasks": 9, "criticalPathAffected": true }
}
```

Graph example (compact): `GET /api/projects/:id/dependencies` → `{ "nodes": [ { "id": "tsk_501", "status": "IN_PROGRESS" }, { "id": "tsk_507", "status": "BLOCKED" } ], "edges": [ { "from": "tsk_501", "to": "tsk_507", "type": "FINISH_TO_START", "lagDays": 2 } ] }`

### C.7 Budget (5 endpoints)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/projects/:id/budget` | Any (scoped) | Budget summary with categories and monthly trend |
| POST | `/api/projects/:id/budget/records` | ADMIN, PM | Add a monthly budget record |
| GET | `/api/projects/:id/budget/records` | Any (scoped) | Paginated raw `BudgetRecord` rows |
| PATCH | `/api/budget-records/:id` | ADMIN | Correct a posted record (audit-logged) |
| GET | `/api/projects/:id/budget/variance` | Any (scoped) | Planned vs actual vs projected variance analysis |

**GET `/api/projects/:id/budget`**

```json
{
  "planned": 2500,
  "spent": 1750,
  "projected": 2800,
  "utilisation": 70,
  "projectedOverrun": 12,
  "categories": [
    { "category": "CONSTRUCTION", "planned": 1500, "spent": 1100 },
    { "category": "EQUIPMENT", "planned": 400, "spent": 350 },
    { "category": "HUMAN_RESOURCES", "planned": 300, "spent": 200 },
    { "category": "MATERIALS", "planned": 200, "spent": 75 },
    { "category": "OTHER", "planned": 100, "spent": 25 }
  ],
  "monthlyTrend": [
    { "month": "Jan 2026", "planned": 150, "actual": 120 },
    { "month": "Feb 2026", "planned": 180, "actual": 200 }
  ]
}
```

**POST `/api/projects/:id/budget/records`** — one record per project per month (`409 CONFLICT_DUPLICATE` on re-post); exceeding `totalBudget` returns `422 BUDGET_EXCEEDED`; emits `budget:updated`.

```json
// Request
{
  "month": "2026-03",
  "category": "MATERIALS",
  "plannedAmount": 25,
  "spentAmount": 31,
  "notes": "Emergency steel purchase at premium"
}

// Response 201
{
  "id": "bud_778",
  "projectId": "proj_001",
  "month": "2026-03",
  "category": "MATERIALS",
  "plannedAmount": 25,
  "spentAmount": 31,
  "variancePct": 24,
  "flagged": true,
  "flagReason": "Monthly spend 24% above plan",
  "createdAt": "2026-03-01T10:18:00Z"
}
```

### C.8 Resources (5 endpoints)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/projects/:id/resources` | Any (scoped) | List all `ResourceAllocation` rows for a project |
| POST | `/api/projects/:id/resources` | ADMIN, PM | Allocate a resource |
| PATCH | `/api/resources/:id` | ADMIN, PM | Update allocation (quantity, window, status) |
| DELETE | `/api/resources/:id` | ADMIN, PM | Release a resource allocation |
| GET | `/api/projects/:id/resources/bottlenecks` | Any (scoped) | Resource bottleneck analysis |

**POST `/api/projects/:id/resources`**

```json
// Request
{
  "resourceType": "EQUIPMENT",
  "name": "Tower Crane TC-4",
  "quantity": 1,
  "unit": "unit",
  "allocationWindow": { "from": "2026-03-10", "to": "2026-09-30" },
  "costPerMonth": 18,
  "allocatedFromProjectId": "proj_012"
}

// Response 201
{
  "id": "res_221",
  "projectId": "proj_001",
  "resourceType": "EQUIPMENT",
  "name": "Tower Crane TC-4",
  "quantity": 1,
  "status": "ALLOCATED",
  "allocationWindow": { "from": "2026-03-10", "to": "2026-09-30" },
  "costPerMonth": 18,
  "utilizationPct": 0,
  "createdAt": "2026-03-01T10:22:00Z"
}
```

**GET `/api/projects/:id/resources/bottlenecks`** — compact example: `{ "bottlenecks": [ { "resourceType": "MATERIAL", "name": "TMT Steel Fe550D", "pendingDays": 18, "affectedTasks": ["tsk_501", "tsk_507"], "riskLevel": "HIGH", "recommendation": "Expedite via alternate supplier; 2 suppliers within 200 km have stock" } ], "overallResourceScore": 28 }`

### C.9 Health, Predictions & Risk (5 endpoints)

All routes here are served by the **AI** domain and proxy to the Python FastAPI ML service (`/predict/delay`, `/predict/budget`, `/calculate-health`). Predictions are synchronous (p95 < 3 s) and persist a `PredictionResult` row before responding.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/predict/delay` | ADMIN, PM | Trigger delay prediction for a project |
| POST | `/api/predict/budget` | ADMIN, PM | Trigger budget overrun prediction |
| GET | `/api/projects/:id/predictions` | Any (scoped) | History of `PredictionResult` rows, newest first |
| POST | `/api/calculate-health` | ADMIN, PM | Force health recompute (normally every 6 h or on write) |
| GET | `/api/projects/:id/risk-assessments` | Any (scoped) | Paginated `RiskAssessment` history |

**POST `/api/predict/delay`** — AI domain.

```json
// Request
{ "projectId": "proj_018" }

// Response 200
{
  "projectId": "proj_018",
  "delayProbability": 0.78,
  "estimatedDelayDays": 23,
  "confidence": 0.85,
  "modelVersion": "delay-rf-v1.3",
  "factors": [
    { "factor": "Steel procurement pending", "weight": 0.35 },
    { "factor": "3 milestones delayed", "weight": 0.30 },
    { "factor": "Monsoon season approaching", "weight": 0.20 },
    { "factor": "Equipment utilisation at 92%", "weight": 0.15 }
  ],
  "predictionId": "prd_556",
  "generatedAt": "2026-03-01T10:30:00Z"
}
```

**POST `/api/predict/budget`** — compact example: request `{ "projectId": "proj_001", "horizonMonths": 6 }` → response `{ "overrunProbability": 0.64, "projectedFinalSpend": 2800, "plannedBudget": 2500, "projectedOverrunPct": 12, "projectedOverrunAmount": 300, "confidence": 0.81, "drivers": [ { "factor": "Material cost inflation", "weight": 0.42 }, { "factor": "Spend velocity 15% above plan", "weight": 0.33 }, { "factor": "Rework risk on structural work", "weight": 0.25 } ], "modelVersion": "budget-gbr-v1.1" }`

### C.10 Alerts (5 endpoints)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/alerts` | Any (scoped) | List alerts for user's projects; filters `severity`, `read`, `projectId` |
| GET | `/api/alerts/unread-count` | Any | Unread alert count (badge polling fallback) |
| PATCH | `/api/alerts/:id/read` | Any | Mark a single alert as read |
| PATCH | `/api/alerts/read-all` | Any | Mark all alerts as read |
| POST | `/api/alerts/test-email` | ADMIN, PM | Send test alert email (verifies SMTP + template) |

**GET `/api/alerts?severity=CRITICAL&read=false`** — CRITICAL alert creation also triggers Socket.io `alert:broadcast` and email digest.

```json
{
  "data": [
    {
      "id": "alr_902",
      "projectId": "proj_001",
      "projectName": "National Highway Extension - Phase 3",
      "severity": "CRITICAL",
      "type": "HEALTH_DROP",
      "title": "Health score dropped below 45",
      "message": "Overall health fell from 47 to 42 after milestone DELAYED event",
      "metadata": { "previousScore": 47, "currentScore": 42, "trigger": "milestone:status-changed" },
      "read": false,
      "channelsSent": ["IN_APP", "EMAIL"],
      "createdAt": "2026-03-01T10:10:05Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 34, "totalPages": 2 }
}
```

Compact: `GET /api/alerts/unread-count` → `{ "unread": 7, "critical": 2 }`; `PATCH /api/alerts/read-all` → `{ "updated": 7 }`.

### C.11 Notifications (4 endpoints)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/notifications` | Any | Personal notification feed; filter `read`, `type`; paginated |
| PATCH | `/api/notifications/:id/read` | Any | Mark one notification read |
| PATCH | `/api/notifications/read-all` | Any | Mark all notifications read |
| GET/PATCH | `/api/notifications/settings` | Any | Per-channel preferences (IN_APP / EMAIL / PUSH) per event type |

Settings example (compact): `PATCH /api/notifications/settings` body `{ "EMAIL": { "ALERT_CRITICAL": true, "ALERT_WARNING": false, "WEEKLY_DIGEST": true }, "PUSH": { "ALERT_CRITICAL": true } }` → `200 { "settings": { "...": "..." } }`. New notifications are pushed live via Socket.io `notification:push` (PART E).

### C.12 Documents (5 endpoints) — AI domain

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/documents/ingest` | ADMIN, PM | Upload and process a document (PDF/Excel/Image) |
| GET | `/api/projects/:id/documents` | Any (scoped) | List documents with extraction status |
| GET | `/api/documents/:id` | Any (scoped) | Document metadata + extracted data |
| GET | `/api/documents/:id/download` | Any (scoped) | Signed download stream (original file) |
| DELETE | `/api/documents/:id` | ADMIN | Soft delete document and embeddings |

**POST `/api/documents/ingest`** — `multipart/form-data`; max 25 MB; allowlist PDF/XLSX/CSV/PNG/JPG; async pipeline: OCR (images) → text extraction → GPT-4o structured extraction → embeddings to vector store → `document:processed` socket event.

```json
// Request (multipart/form-data)
// file: <binary> progress_report_sep.pdf (25 MB max)
// projectId: "proj_018"

// Response 200
{
  "document": { "id": "doc_123", "fileName": "progress_report_sep.pdf", "sizeBytes": 1843200, "status": "PROCESSED" },
  "extractedData": {
    "progress": 62,
    "completedWork": ["Foundation", "Structural work 80%"],
    "pendingTasks": ["Electrical work", "Interior work"],
    "risks": ["Steel shortage may delay completion"],
    "budgetUpdate": { "spent": 1775, "month": "September 2026" }
  },
  "summary": "Project is 62% complete. Structural work is delayed by 12 days due to material shortage. Budget utilisation is 71%. Immediate procurement action is recommended.",
  "processingMs": 8412
}
```

Compact list: `GET /api/projects/proj_018/documents?status=PROCESSED` → `{ "data": [ { "id": "doc_123", "fileName": "progress_report_sep.pdf", "status": "PROCESSED", "uploadedBy": "usr_042", "createdAt": "2026-10-02T09:00:00Z" } ], "meta": { "page": 1, "limit": 20, "total": 12, "totalPages": 1 } }`

### C.13 Reports & Exports (4 endpoints)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/reports/generate` | ADMIN, PM, ST | Generate a project status report (PDF) |
| GET | `/api/reports` | ADMIN, PM, ST | List generated reports; filter `projectId`, `type` |
| GET | `/api/reports/:id/download` | ADMIN, PM, ST | Download the generated PDF |
| GET | `/api/analytics/export/csv` | ADMIN, PM | Export datasets as CSV (AN domain) |

**POST `/api/reports/generate`** — AI domain orchestrates template + analytics aggregation; returns download URL valid 24 h.

```json
// Request
{
  "projectId": "proj_001",
  "type": "MONTHLY_STATUS",
  "sections": ["health", "milestones", "budget", "risks", "predictions"],
  "format": "PDF",
  "language": "EN"
}

// Response 202
{
  "reportId": "rpt_311",
  "status": "GENERATING",
  "estimatedSeconds": 20,
  "pollUrl": "/api/reports/rpt_311"
}
// GET /api/reports/rpt_311 when done:
{
  "reportId": "rpt_311",
  "status": "READY",
  "format": "PDF",
  "sizeBytes": 428544,
  "downloadUrl": "https://projectassure.vercel.app/api/reports/rpt_311/download",
  "expiresAt": "2026-03-02T10:35:00Z"
}
```

Compact: `GET /api/analytics/export/csv?type=projects&status=ACTIVE` (AN domain) → `200 text/csv` streaming attachment `projects_active_2026-03-01.csv`; add `?columns=id,name,healthScore,budgetUtilisation` to select fields.

### C.14 Analytics (7 endpoints) — AN domain

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/analytics/portfolio-summary` | Any (scoped) | Portfolio-wide KPIs |
| GET | `/api/analytics/health-distribution` | Any (scoped) | Projects by health category |
| GET | `/api/analytics/budget-trends` | Any (scoped) | Budget utilisation trends |
| GET | `/api/analytics/delay-predictions` | Any (scoped) | All delay predictions across portfolio |
| GET | `/api/analytics/department-comparison` | ADMIN, ST | Compare departments |
| GET | `/api/analytics/resource-utilisation` | ADMIN, PM | Cross-project resource load and idle time |
| GET | `/api/analytics/export/pdf` | ADMIN, PM | Generate PDF analytics report |

**GET `/api/analytics/portfolio-summary?departmentId=dept_001`**

```json
{
  "totalProjects": 128,
  "activeProjects": 97,
  "criticalProjects": 11,
  "averageHealth": 71,
  "totalBudget": 482000,
  "totalSpent": 311000,
  "budgetUtilisation": 65,
  "predictedOverruns": 14,
  "milestonesDueThisMonth": 42,
  "trend": [ { "week": "2026-W08", "averageHealth": 69 }, { "week": "2026-W09", "averageHealth": 71 } ]
}
```

Compact: `GET /api/analytics/health-distribution` → `{ "HEALTHY": 74, "AT_RISK": 43, "CRITICAL": 11 }`; `GET /api/analytics/budget-trends?months=6` → `{ "series": [ { "month": "Oct 2025", "planned": 3800, "actual": 3610 } ], "cumulativeVariancePct": -4.8 }`; `GET /api/analytics/department-comparison` → `{ "departments": [ { "id": "dept_001", "name": "Transport", "projects": 34, "avgHealth": 74, "budgetUtilisation": 61, "onTimeRate": 78 } ] }`

### C.15 AI Chat & Summaries (4 endpoints) — AI domain

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/api/chat` | Any (RBAC-scoped answers) | Agentic AI chat with project context (GPT-4o, Gemini fallback) |
| GET | `/api/chat/conversations` | Any | List user's conversations, newest first |
| GET | `/api/chat/conversations/:id` | Any | Full transcript of one conversation |
| POST | `/api/summarize` | Any | Summarize a project or document into executive brief |

**POST `/api/chat`** — The agent has tool access to project/budget/risk read APIs for the caller's permitted scope; answers outside scope are refused.

```json
// Request
{
  "message": "Why is Project 18 at risk?",
  "projectId": "proj_018",
  "conversationId": "conv_123"
}

// Response 200
{
  "conversationId": "conv_123",
  "response": "Project 18 (National Highway Extension) is at critical risk (score: 42/100) due to three main factors:\n\n1. **Schedule Risk (82%)**: 4 milestones are delayed, with the structural work milestone 18 days behind. The critical path analysis shows this directly impacts the project end date.\n\n2. **Resource Risk (75%)**: Steel procurement has been pending for 18 days, creating a bottleneck for structural work. Equipment utilisation is at 92%, leaving no buffer.\n\n3. **Budget Risk (64%)**: Current spending velocity (Rs. 2.9 Cr/month) is 15% above the planned rate. At this trajectory, the project will overshoot the budget by approximately Rs. 3.5 Cr.\n\n**Recommended Actions**:\n1. Immediately expedite steel procurement through alternative suppliers\n2. Reallocate equipment from completed Project 12\n3. Request budget revision or identify cost-saving measures",
  "sources": ["projects/proj_018", "risk_assessments/proj_018"],
  "confidence": 0.89,
  "model": "gpt-4o",
  "tokens": { "prompt": 2140, "completion": 412 }
}
```

Compact: `POST /api/summarize` body `{ "projectId": "proj_001", "length": "EXEC" }` → `{ "summary": "Highway Phase 3 is CRITICAL (42/100): 18 days behind, projected 12% budget overrun. Top action: expedite steel procurement.", "generatedAt": "2026-03-01T10:40:00Z" }`

### C.16 Admin, Audit & Meta (5 endpoints)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/api/admin/audit-logs` | ADMIN | Paginated `AuditLog` query; filters `userId`, `action`, `entity`, `from`, `to` |
| GET | `/api/admin/stats` | ADMIN | Platform stats: users, active sessions, API volume, ML jobs |
| GET | `/api/admin/departments` | Any | Department list with project counts |
| POST | `/api/admin/departments` | ADMIN | Create department |
| GET | `/api/meta/version` | Public | API version + changelog URL (A.4) |

**GET `/api/admin/audit-logs?entity=PROJECT&from=2026-02-01`**

```json
{
  "data": [
    {
      "id": "aud_5531",
      "userId": "usr_042",
      "userName": "Rajesh Kumar",
      "action": "UPDATE",
      "entity": "PROJECT",
      "entityId": "proj_001",
      "changes": { "healthScore": { "from": 47, "to": 42 } },
      "ip": "10.24.8.11",
      "requestId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "createdAt": "2026-03-01T10:10:06Z"
    }
  ],
  "meta": { "page": 1, "limit": 50, "total": 18204, "totalPages": 365 }
}
```

## PART D — RBAC Endpoint Matrix

### In Plain English
> Think of four visitor badges. ADMIN is the office director: every door opens. PROJECT_MANAGER is the site supervisor: full control over their own project files, read-only elsewhere. STAKEHOLDER is the inspecting officer: can look at everything and receive reports, but changes nothing. VIEWER is a trainee on an orientation walk: eyes only. The matrix below is the door-access chart pinned at the entrance — one glance tells you which badge opens which door.

Legend: **C** = Create, **R** = Read, **U** = Update, **D** = Delete, **S** = Special action (run predictions, generate reports, send test email), **-** = no access. "Own" = records inside projects the user manages; scoping is enforced at query level, not just at route level.

| Resource | ADMIN | PROJECT_MANAGER | STAKEHOLDER | VIEWER |
|----------|-------|-----------------|-------------|--------|
| Users (`/api/users`) | CRUD | R | R (own profile) | R (own profile) |
| Auth (register users) | C | - | - | - |
| Projects | CRUD | CRUD (own dept) | R | R |
| Project health / risk / timeline | R | R | R | R |
| Milestones | CRUD | CRUD (own) | R | R |
| Tasks | CRUD | CRUD (own) | R | R |
| Task dependencies | CUD | CUD (own) | R | R |
| Budget records | CRUD | CRU (own), D: - | R | R |
| Resource allocations | CRUD | CRU (own) | R | R |
| Predictions (`/predict/*`) | R+S | R+S (own) | R | - |
| Health recompute | S | S (own) | - | - |
| Alerts | CRUD | RU (own scope) | RU (own scope) | R |
| Alert test email | S | S | - | - |
| Notifications & settings | CRUD (own) | RU (own) | RU (own) | RU (own) |
| Documents (ingest/delete) | C, R, D | C, R (own), D (own) | R | R |
| Reports (generate/download) | CR | CR (own) | R (download) | - |
| Analytics (portfolio/budget/trends) | R | R (own scope) | R | R (summary only) |
| Analytics exports (CSV/PDF) | R | R (own scope) | - | - |
| AI chat | S | S | S | S (summary scope) |
| Audit logs | R | - | - | - |
| Departments / organization config | CRUD | R | R | - |

Enforcement notes: (1) The wrapper `withAuth(handler, { roles: ["ADMIN", "PROJECT_MANAGER"] })` rejects with `403 AUTH_FORBIDDEN` before the handler body executes. (2) Row-level scoping (PM sees only own department's projects) is applied in Prisma `where` clauses derived from the JWT claims, so a PM cannot read another department's project by guessing its id. (3) STAKEHOLDER write routes are limited to alert/notification acknowledgement — deliberate, so oversight roles cannot alter operational data. (4) All RBAC denials are audit-logged with the attempted route.

## PART E — WebSocket Events Catalogue

### In Plain English
> REST is like posting letters: reliable, but you only know the answer when the reply arrives. The Socket.io layer is the office loudspeaker: the moment something happens — an alert raised, a health score changed, a task card moved — everyone standing in the right room (the project room or the user's personal room) hears it instantly. This part lists every announcement the loudspeaker can make, what it sounds like (payload), when it fires, and who is listening.

**Connection & rooms.** Endpoint `wss://projectassure.vercel.app/socket.io`; handshake must include `auth: { token: "<jwt>" }`, rejected otherwise. On connect the server auto-joins: `user:{id}` (personal), `org:{orgId}` (broadcasts), and any `project:{id}` rooms the client explicitly joins for projects in scope. Server→client only, except the two client→server control events `project:join` / `project:leave`.

| Event | Emitted when | Audience (room) | Payload (JSON) |
|-------|--------------|-----------------|----------------|
| `alert:broadcast` | Risk engine or rule creates an alert (severity WARNING/CRITICAL) | `project:{id}` + `org:{orgId}` | see E.1 |
| `notification:push` | A `Notification` row is created for a user | `user:{id}` | see E.2 |
| `project:updated` | `PATCH /api/projects/:id` commits | `project:{id}` | see E.3 |
| `project:health-changed` | `calculate-health` produces a different score/category | `project:{id}` + `org:{orgId}` | see E.4 |
| `milestone:status-changed` | `PATCH /api/milestones/:id/status` commits | `project:{id}` | see E.5 |
| `task:moved` | Task `status` changes (Kanban drag or API) | `project:{id}` | see E.6 |
| `budget:updated` | Budget record created/corrected | `project:{id}` | see E.7 |
| `prediction:completed` | FastAPI prediction persisted | `project:{id}` | see E.8 |
| `document:processed` | Ingest pipeline finishes (success or failure) | `project:{id}` | see E.9 |

**E.1 `alert:broadcast`**

```json
{
  "alert": {
    "id": "alr_902",
    "projectId": "proj_001",
    "severity": "CRITICAL",
    "type": "HEALTH_DROP",
    "title": "Health score dropped below 45",
    "message": "Overall health fell from 47 to 42 after milestone DELAYED event",
    "createdAt": "2026-03-01T10:10:05Z"
  }
}
```

**E.2 `notification:push`**

```json
{
  "notification": {
    "id": "ntf_4410",
    "userId": "usr_042",
    "type": "ALERT_CRITICAL",
    "title": "Critical alert on National Highway Extension - Phase 3",
    "body": "Health score dropped to 42. Immediate attention recommended.",
    "link": "/projects/proj_001",
    "read": false,
    "createdAt": "2026-03-01T10:10:06Z"
  }
}
```

**E.3 `project:updated`** — `{ "projectId": "proj_001", "changedFields": ["targetDate"], "updatedBy": "usr_042", "at": "2026-03-01T10:45:00Z" }`

**E.4 `project:health-changed`** — `{ "projectId": "proj_001", "previous": { "score": 47, "category": "AT_RISK" }, "current": { "score": 42, "category": "CRITICAL" }, "driver": "MILESTONE_DELAY" }`

**E.5 `milestone:status-changed`** — `{ "milestoneId": "mst_101", "projectId": "proj_001", "from": "IN_PROGRESS", "to": "DELAYED", "delayDays": 12, "by": "usr_042" }`

**E.6 `task:moved`** — `{ "taskId": "tsk_501", "projectId": "proj_001", "from": "TODO", "to": "IN_PROGRESS", "assigneeId": "usr_055", "by": "usr_042" }`

**E.7 `budget:updated`** — `{ "projectId": "proj_001", "recordId": "bud_778", "month": "2026-03", "spentTotal": 1781, "flagged": true, "flagReason": "Monthly spend 24% above plan" }`

**E.8 `prediction:completed`** — `{ "projectId": "proj_018", "predictionId": "prd_556", "kind": "DELAY", "delayProbability": 0.78, "estimatedDelayDays": 23, "modelVersion": "delay-rf-v1.3" }`

**E.9 `document:processed`** — `{ "documentId": "doc_123", "projectId": "proj_018", "status": "PROCESSED", "summaryShort": "62% complete; steel shortage risk flagged" }`

Delivery guarantees: events are at-most-once per room connection; the REST API remains the source of truth and clients should re-fetch on reconnect (`socket.on("reconnect")`). Missed-alert safety is provided by `GET /api/alerts/unread-count` polling every 60 s as a fallback in low-trust networks.

## PART F — Rate Limiting & Security

### In Plain English
> Rate limiting is the queue barrier at the office gate: everyone gets up to 100 turns per minute, but the AI analyst's cabin — being expensive — allows only a handful of turns, and the login counter is extra strict because forged ID cards tend to appear there. Security headers, file checks, and audit trails are the CCTV cameras and seal stamps: nothing leaves the building unverified, and everything important leaves a record.

### F.1 Upstash Configuration

```ts
// lib/rate-limit.ts — shared by all three domains
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),                       // UPSTASH_REDIS_REST_URL / _TOKEN
  limiter: Ratelimit.slidingWindow(100, "60 s"), // default: 100 req/min/user
  prefix: "pa:rl",
  analytics: true,
});

export const routeLimits: Record<string, { limit: number; window: string }> = {
  "POST:/api/auth/login":        { limit: 10,  window: "60 s" },
  "POST:/api/auth/register":     { limit: 5,   window: "60 s" },
  "POST:/api/chat":              { limit: 20,  window: "60 s" },
  "POST:/api/predict/delay":     { limit: 30,  window: "60 s" },
  "POST:/api/predict/budget":    { limit: 30,  window: "60 s" },
  "POST:/api/documents/ingest":  { limit: 15,  window: "60 s" },
  "POST:/api/reports/generate":  { limit: 10,  window: "60 s" },
  "GET:/api/analytics/export/*": { limit: 10,  window: "60 s" },
  "POST:/api/alerts/test-email": { limit: 3,   window: "60 s" },
};
// Key = `${userId}` (or `ip:${ip}` before login). Exceeded -> 429 + Retry-After.
```

### F.2 Per-Route Limits

| Route group | Limit | Burst behaviour | Quota note |
|-------------|-------|-----------------|------------|
| Default (all routes) | 100 req/min/user | Sliding window, no burst allowance | — |
| `POST /auth/login`, `/auth/register` | 10/min per IP | Extra 403 lockout for 15 min after 20 failures/hour | Brute-force protection |
| AI chat (`/chat`, `/summarize`) | 20/min/user | — | 500 calls/day/user (LLM cost) |
| Predictions (`/predict/*`, `/calculate-health`) | 30/min/user | — | Background scheduler excluded |
| Document ingest | 15/min/user | Max 25 MB per file | 100 files/day/org |
| Reports & exports | 10/min/user | — | 200/month/org (heavy aggregation) |
| Test email | 3/min/user | — | Prevents SMTP abuse |
| Static reads (`/auth/me`, unread-count) | 300/min/user | Badge polling headroom | — |

Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; violations return `429 RATE_LIMITED` with `Retry-After`.

### F.3 Security Checklist

| Control | Implementation |
|---------|----------------|
| Transport | HTTPS only; HSTS `max-age=31536000; includeSubDomains` |
| Token storage | JWT never in localStorage for SSR pages; httpOnly cookie server-side, memory Bearer client-side |
| Input safety | Zod validation everywhere; Prisma parameterized queries (no string SQL); output encoding in report PDFs |
| File uploads | Extension + MIME allowlist, size cap 25 MB, filename sanitization, antivirus scan before OCR |
| Secrets | All keys (Upstash, OpenAI, Gemini, SMTP, DB) in Vercel encrypted env vars; never in client bundles |
| SQL/NoSQL injection | Prisma ORM layer; Zod rejects unexpected object keys |
| IDOR protection | Row-level scope from JWT claims (PART D note 2); ids are non-enumerable |
| Audit trail | Every mutating call -> `AuditLog` with userId, entity, diff, IP, `X-Request-Id` |
| Least privilege | Service-to-service ML calls use a scoped internal key, not user tokens |
| Dependency hygiene | `npm audit` + Dependabot in CI; lockfiles committed |

## PART G — Client SDK Pattern

### In Plain English
> Instead of every developer memorising 85 counters, the office hands out a single assistant card: `ApiClient`. Tell the assistant what you need in plain typed language — "list page 2 of projects", "ask the AI about project 18" — and it knows which wing of the building to walk to, which ID card to present, and how to translate a rejection slip into a thrown error. One object, three buildings, zero guesswork.

```ts
// lib/api-client.ts — ProjectAssure typed API client (SIH 2026)
const MAIN = "https://projectassure.vercel.app/api";
const ANALYTICS = "https://analytics.projectassure.vercel.app/api";
const AI = "https://ai.projectassure.vercel.app/api";

export interface PageMeta { page: number; limit: number; total: number; totalPages: number }
export interface ApiErrorBody { error: { code: string; message: string; details?: unknown } }

/** Cross-domain helper: routes a logical path to the correct ProjectAssure base URL. */
export function baseUrl(path: string): string {
  if (path.startsWith("/analytics/")) return ANALYTICS + path.replace("/analytics", "");
  if (path.startsWith("/chat") || path.startsWith("/summarize") ||
      path.startsWith("/predict") || path.startsWith("/documents")) return AI + path;
  return MAIN + path;
}

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number, public details?: unknown) {
    super(message);
  }
}

export class ApiClient {
  constructor(private token: string) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(baseUrl(path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token}`,
        "X-Request-Id": crypto.randomUUID(),
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
      throw new ApiError(body?.error.code ?? "INTERNAL_ERROR", body?.error.message ?? `HTTP ${res.status}`, res.status, body?.error.details);
    }
    return res.json() as Promise<T>;
  }

  get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const qs = params ? "?" + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])) : "";
    return this.request<T>(path + qs);
  }
  post<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body),
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {} });
  }
  patch<T>(path: string, body: unknown): Promise<T> { return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) }); }
  delete<T>(path: string): Promise<T> { return this.request<T>(path, { method: "DELETE" }); }

  // Typed convenience methods
  listProjects(params: { page?: number; status?: string; sort?: string } = {}) { return this.get<{ data: Project[]; meta: PageMeta }>("/projects", params); }
  getProject(id: string) { return this.get<Project>(`/projects/${id}`); }
  getProjectHealth(id: string) { return this.get<HealthBreakdown>(`/projects/${id}/health`); }
  createMilestone(projectId: string, body: Partial<Milestone>) { return this.post<Milestone>(`/projects/${projectId}/milestones`, body, crypto.randomUUID()); }
  predictDelay(projectId: string) { return this.post<DelayPrediction>("/predict/delay", { projectId }); }
  askAi(message: string, projectId?: string, conversationId?: string) { return this.post<ChatReply>("/chat", { message, projectId, conversationId }); }
  exportCsv(type: string) { return this.get<{ url: string }>(`/analytics/export/csv`, { type }); }
}
```

Usage: `const api = new ApiClient(token); const { data, meta } = await api.listProjects({ status: "ACTIVE", sort: "-healthScore" });` — the same instance works across all three domains because `baseUrl()` performs the routing, and a failing call always raises a typed `ApiError` carrying the PART B.6 code.

## PART H — curl Testing Cookbook

### In Plain English
> This is the demo-day script: eight numbered conversations with the API that together walk a project's whole life — sign in, open the file, add a milestone, add a task, attach the contractor's report, ask the AI what could go wrong, and print the summary for the secretary. Paste the blocks top to bottom in a terminal; each one keeps the IDs the next one needs in shell variables, like passing a token from counter to counter.

Setup once per terminal (demo uses the CRITICAL highway project):

```bash
export MAIN="https://projectassure.vercel.app/api"
export AI="https://ai.projectassure.vercel.app/api"
export AN="https://analytics.projectassure.vercel.app/api"
```

**1. Login and keep the token**

```bash
export TOKEN=$(curl -s -X POST "$MAIN/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"rajesh@mospi.gov.in","password":"SecurePass123!"}' | jq -r .token)
curl -s "$MAIN/auth/me" -H "Authorization: Bearer $TOKEN" | jq
```

**2. Create a project (idempotent)**

```bash
export PROJECT_ID=$(curl -s -X POST "$MAIN/projects" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"name":"New Government Hospital - Pune","description":"200-bed hospital","startDate":"2026-06-01","targetDate":"2027-06-30","totalBudget":2500,"departmentId":"dept_002","state":"Maharashtra","district":"Pune","sector":"Health","scheme":"PM Ayushman Bharat"}' | jq -r .id)
echo "Created $PROJECT_ID"
```

**3. Add a milestone**

```bash
export MILESTONE_ID=$(curl -s -X POST "$MAIN/projects/$PROJECT_ID/milestones" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Foundation Work","dueDate":"2026-09-30","isCritical":true,"weight":25,"ownerId":"usr_042"}' | jq -r .id)
```

**4. Add a task under the milestone**

```bash
export TASK_ID=$(curl -s -X POST "$MAIN/milestones/$MILESTONE_ID/tasks" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Soil testing - Block A","assigneeId":"usr_055","startDate":"2026-06-05","dueDate":"2026-07-15","priority":"HIGH","estimatedHours":120}' | jq -r .id)
curl -s -X PATCH "$MAIN/tasks/$TASK_ID" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"status":"IN_PROGRESS","progress":30}' | jq
```

**5. Upload a progress document (AI domain)**

```bash
curl -s -X POST "$AI/documents/ingest" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./progress_report_sep.pdf;type=application/pdf" \
  -F "projectId=$PROJECT_ID" | jq '{document, summary}'
```

**6. Run delay prediction**

```bash
curl -s -X POST "$AI/predict/delay" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\"}" | jq '{delayProbability, estimatedDelayDays, confidence}'
curl -s "$MAIN/projects/$PROJECT_ID/health" -H "Authorization: Bearer $TOKEN" | jq
```

**7. Query the AI assistant**

```bash
export CONV_ID=$(curl -s -X POST "$AI/chat" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"message\":\"Why is this project at risk?\",\"projectId\":\"$PROJECT_ID\"}" | jq -r .conversationId)
curl -s -X POST "$AI/chat" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"message\":\"Suggest the top 3 corrective actions\",\"projectId\":\"$PROJECT_ID\",\"conversationId\":\"$CONV_ID\"}" | jq -r .response
```

**8. Export the monthly status report and CSV**

```bash
export REPORT_ID=$(curl -s -X POST "$AI/reports/generate" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"type\":\"MONTHLY_STATUS\",\"sections\":[\"health\",\"milestones\",\"budget\",\"risks\",\"predictions\"],\"format\":\"PDF\"}" | jq -r .reportId)
sleep 20 && curl -s -o monthly_status.pdf "$MAIN/reports/$REPORT_ID/download" -H "Authorization: Bearer $TOKEN"
curl -s "$AN/analytics/export/csv?type=projects&status=ACTIVE" -H "Authorization: Bearer $TOKEN" -o projects_active.csv
```

Troubleshooting: a `jq: null` usually means the previous call returned an error envelope — re-run with `| jq .` instead of extracting a field; empty `TOKEN` means login failed (check PART F lockout); document upload larger than 25 MB returns `PAYLOAD_TOO_LARGE` (413).

## PART I — API Testing Checklist & Postman Collection

### In Plain English
> Before the demo, the whole office is rehearsed like a fire drill: every counter is visited once for the happy path, once with the wrong ID card, once with a badly filled form, and once with too many requests in a minute — and the clerk's reactions are compared against the manual (this document). The Postman collection is the rehearsal script, organised by wing so any judge or developer can replay the entire drill in one click.

### I.1 Testing Checklist

| # | Scenario | Expected result |
|---|----------|-----------------|
| 1 | Happy-path CRUD per resource group (PART C order) | 2xx with documented shapes |
| 2 | Request without `Authorization` header | 401 `AUTH_REQUIRED` |
| 3 | Request with expired token | 401 `AUTH_TOKEN_EXPIRED`; refresh succeeds |
| 4 | VIEWER calls `POST /projects` | 403 `AUTH_FORBIDDEN` (RBAC matrix PART D) |
| 5 | PM reads another department's project by id | 404 `NOT_FOUND` (row-level scoping hides it) |
| 6 | Body missing required field | 422 `VALIDATION_ERROR` with `details[].path` |
| 7 | Dependency edge creating a cycle | 409 `DEPENDENCY_CYCLE` |
| 8 | Milestone status COMPLETED → IN_PROGRESS | 409 `INVALID_STATE_TRANSITION` |
| 9 | Duplicate budget record for same month | 409 `CONFLICT_DUPLICATE` |
| 10 | Retry POST with same `Idempotency-Key` | Same response, header `Idempotent-Replay: true` |
| 11 | `?page=999` on list endpoints | 200 with empty `data: []` and correct `meta.totalPages` |
| 12 | `?sort=-healthScore` combined with `status=CRITICAL` | Sorted, filtered result set |
| 13 | 21st request/min to `/chat` | 429 `RATE_LIMITED` + `Retry-After` header |
| 14 | 30 MB PDF to `/documents/ingest` | 413 `PAYLOAD_TOO_LARGE` |
| 15 | `.exe` renamed to `.pdf` upload | 415 `UNSUPPORTED_MEDIA_TYPE` |
| 16 | Create CRITICAL alert, then listen on socket | `alert:broadcast` received in `project:{id}` room |
| 17 | `GET /analytics/export/csv?type=projects` | 200 `text/csv`, header count matches `meta.total` of list API |
| 18 | Cross-origin XHR from analytics domain with Bearer | Preflight passes, no CORS error in console |
| 19 | Any mutating call, then check audit-logs | New `AuditLog` row with `X-Request-Id` echoed |
| 20 | FastAPI ML service stopped, call `/predict/delay` | 502 `PREDICTION_FAILED`, alert raised, API stays up |

### I.2 Postman Collection Structure

```
ProjectAssure SIH 2026/
├── 00 Setup/
│   ├── 00 Health check            GET  {{MAIN}}/meta/version
│   └── 01 Login                   POST {{MAIN}}/auth/login   (test script: pm.environment.set("token", ...))
├── 01 Auth/                       register, refresh, logout, me, change-password
├── 02 Users/                      list, create, get, patch, deactivate, activity
├── 03 Projects/                   list (filters/sort), create, detail, patch, delete, health, risk, timeline
├── 04 Milestones/                 list, create, get, patch, status, critical-path, delete
├── 05 Tasks & Dependencies/       tasks CRUD, board, dependencies create/delete/graph
├── 06 Budget/                     summary, records CRUD, variance
├── 07 Resources/                  list, allocate, patch, release, bottlenecks
├── 08 Predictions & Risk/         predict delay, predict budget, history, calculate-health, risk-assessments
├── 09 Alerts & Notifications/     list, unread-count, read, read-all, test-email, notification settings
├── 10 Documents/                  ingest (form-data), list, detail, download, delete
├── 11 Reports & Exports/          generate, list, download, export csv, export pdf
├── 12 Analytics/                  portfolio-summary, health-distribution, budget-trends, delay-predictions, department-comparison, resource-utilisation
├── 13 AI Chat/                    chat, conversations, conversation detail, summarize
├── 14 Admin & Audit/              audit-logs, stats, departments
└── 15 Negative Tests/             401, 403, 404, 409, 413, 415, 422, 429 scenarios (checklist I.1 rows 2-15)
```

Collection variables: `MAIN`, `AI`, `AN` (base URLs), `token`, `projectId`, `milestoneId`, `taskId`, `reportId` — set automatically by test scripts in `00 Setup/01 Login` and chained requests, so "Run collection" replays the full PART H lifecycle without manual edits. CI integration:

```bash
npx newman run ProjectAssure_SIH2026.postman_collection.json \
  -e projectassure_dev_environment.json \
  --reporters cli,junit --reporter-junit-export results.xml
```

A run is green when all 20 checklist rows behave as documented; the JUnit report is attached to the SIH prototype evidence pack.

---

*This document is part of the ProjectAssure SIH 2026 submission.*
