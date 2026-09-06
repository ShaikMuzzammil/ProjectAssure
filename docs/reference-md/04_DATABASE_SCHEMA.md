# ProjectAssure - Database Schema & Data Models

**ProjectAssure** | SIH 2026 | Problem Statement ID: SIH26103 | Theme: Smart Automation | Category: Software | Organisation: MoSPI
Team: Amrita Vishwa Vidyapeetham, Chennai Campus
Data layer: PostgreSQL 16 on Neon serverless (free tier) with the Prisma 6 ORM

This document is the single source of truth for ProjectAssure's persistence layer. It is organised into ten parts:

| Part | Contents |
|------|----------|
| A | Entity-relationship overview and the full ER diagram |
| B | Complete, production-quality `schema.prisma` |
| C | Model-by-model field reference with example values |
| D | Relationship map, join tables, and cascade rules |
| E | Indexing strategy, six hot queries, and anti-patterns |
| F | Neon PostgreSQL playbook (pooling, branching, scale-to-zero) |
| G | Prisma migrations workflow with commands |
| H | Demo seed data strategy and `seed.ts` outline |
| I | Data integrity, soft-delete policy, and audit design |
| J | Backup and disaster recovery on Neon |

## PART A — Entity-Relationship Overview

ProjectAssure's data model is designed around the core entity of a **Project**, which has multiple associated entities: Milestones, Tasks, Resources, Budget Records, Risk Assessments, AI Predictions, Alerts, and Audit Logs. Every feature in the product — the portfolio dashboard, the composite health-score engine, the delay-prediction pipeline, and the alert fan-out — reads from and writes to the graph shown below, so the schema is deliberately kept in third normal form with Project as the single hub entity.

In total, the schema defines **15 core models plus one join table** (`ProjectMember`), which becomes 16 physical tables in PostgreSQL. Prisma maps each model to a snake_case plural table via `@@map` (for example, `Project` maps to `projects`), so the database reads like conventional SQL while the application code stays idiomatic TypeScript.

### A.1 The Hub: Project

```
+------------------------------------------------------------------------+
|                        PROJECT - THE HUB ENTITY                        |
|                                                                        |
|  1:N --> Milestone --------> 1:N --> Task --> M:N --> Task (self-join   |
|                                                 via TaskDependency)    |
|  1:N --> BudgetRecord        (monthly planned vs spent, 6 months)      |
|  1:N --> ResourceAllocation  (HUMAN / EQUIPMENT / MATERIAL)            |
|  1:1 --> RiskAssessment      (one live risk snapshot per project)      |
|  1:N --> PredictionResult    (delay / budget_overrun / risk_level)     |
|  1:N --> Alert               (severity-ranked warnings)                |
|  1:N --> Document            (uploads with AI-generated summaries)     |
|  1:N --> AuditLog            (append-only activity trail)              |
|  M:N --> User                (via the ProjectMember join table)        |
+------------------------------------------------------------------------+
```

### A.2 Full Entity-Relationship Diagram (cardinality labels)

The original draft overview is preserved below and expanded to cover all 15 models:

```
Organization (1) ──── (N) Department
                          │
                          ├── (1:N) User        [staff directory]
                          └── (1:N) Project     [portfolio]
                                     │
User (1) ──── (N) Project ───────── via ProjectMember (M:N join, carries role)
  │                │
  │                ├── (1:N) Milestone
  │                │         └── (1:N) Task
  │                │                ├── (M:N) TaskDependency ← task-to-task edges
  │                │                └── (N:1) User          ← assignee
  │                ├── (1:N) BudgetRecord
  │                ├── (1:N) ResourceAllocation
  │                ├── (1:1) RiskAssessment
  │                ├── (1:N) PredictionResult
  │                ├── (1:N) Alert
  │                ├── (1:N) Document
  │                └── (1:N) AuditLog
  │
  ├── (1:N) Task           [as assignee]
  ├── (1:N) Notification   [bell feed]
  ├── (1:N) Document       [as uploader]
  └── (1:N) AuditLog       [as actor]

Department (1) ──── (N) Project
Organization (1) ──── (N) Department
```

### A.3 Entity Inventory (with demo seed volumes)

| # | Model | Table (`@@map`) | Role in the system | Seed volume (demo) |
|---|-------|-----------------|--------------------|--------------------|
| 1 | Organization | `organizations` | Single tenant: MoSPI | 1 |
| 2 | Department | `departments` | Divisions that own projects | 5 |
| 3 | User | `users` | Admins, PMs, stakeholders, viewers | 4+ |
| 4 | Project | `projects` | The hub entity | 30 |
| 5 | ProjectMember | `project_members` | M:N user-project link, carries role | ~90 |
| 6 | Milestone | `milestones` | Stakeholder-level checkpoints | 90–210 |
| 7 | Task | `tasks` | Granular work items | 450–1,500 |
| 8 | TaskDependency | `task_dependencies` | Directed edges forming critical paths | ~800 |
| 9 | BudgetRecord | `budget_records` | Monthly planned vs spent rows | ~540 |
| 10 | ResourceAllocation | `resource_allocations` | People, equipment, materials | ~120 |
| 11 | RiskAssessment | `risk_assessments` | Latest risk snapshot per project | 30 (1:1) |
| 12 | PredictionResult | `prediction_results` | AI/ML prediction history | 60–90 |
| 13 | Alert | `alerts` | Severity-ranked warnings | ~150 |
| 14 | Notification | `notifications` | Per-user notification feed | ~80 |
| 15 | Document | `documents` | Uploads with AI summaries | ~45 |
| 16 | AuditLog | `audit_logs` | Append-only activity trail | ~500+ |

### In Plain English

> Think of the whole database as one Excel workbook. Each model is a sheet: `projects` is the master sheet, and sheets like `milestones`, `tasks`, and `budget_records` each carry a `project_id` column that behaves like a permanent link back to the master row. Unlike Excel, the database refuses to save a milestone whose `project_id` points at nothing — that "enforced relationship" is what keeps 30 demo projects perfectly consistent no matter who edits them during the judging demo.

## PART B — Complete Prisma Schema

The schema below is the production contract for all 16 tables. It runs against PostgreSQL 16 on Neon and is generated with Prisma 6.

### B.1 Conventions used throughout

| Convention | Choice | Reason |
|------------|--------|--------|
| Primary keys | `String @id @default(cuid())` | Sortable, URL-safe, collision-free across seeds |
| Money | `Decimal @db.Decimal(18, 2)` | Never store money in `Float`; avoids rounding drift |
| Semi-structured data | `Json` (maps to PostgreSQL `JSONB`) | Variable-shape factor lists, AI extractions |
| Table names | `@@map("snake_case_plural")` | Conventional SQL naming; Prisma models stay PascalCase |
| Foreign keys | Every FK has an explicit `@@index` | Every relation column is a query column |
| Deletes | Explicit `onDelete` on every relation | No silent default behaviour in production |
| Timestamps | `createdAt @default(now())`, `updatedAt @updatedAt` | Full traceability of row age |
| Closed value sets | PostgreSQL enums | Invalid states cannot be stored |

### B.2 What changed from the original draft (and why)

| Original draft | Final schema | Reason |
|----------------|--------------|--------|
| `HealthCategory` enum | `HealthStatus` | Canonical name per project standard |
| `AlertPriority` enum | `AlertSeverity` | Canonical name per project standard |
| `ResourceType` / `type` field | `ResourceCategory` / `category` | Canonical name per project standard |
| `Float` money fields | `Decimal(18,2)` | Exact arithmetic for lakhs/crores |
| `Jsonb` type | `Json` | Prisma's `Json` maps to `JSONB` in PostgreSQL |
| `TaskDependency.type` as `String` | `DependencyType` enum | The four dependency kinds are a closed set |
| `healthCategory` on Project | `healthStatus` + 4 component scores + `healthComputedAt` | Stores the schedule 30 / budget 25 / resources 20 / milestones 25 breakdown for drill-down |
| No `directUrl` in datasource | `directUrl = env("DIRECT_URL")` | Required for migrations against Neon pooled endpoints |
| Implicit delete behaviour | Explicit `onDelete` everywhere | Deterministic cascades |

```prisma
// prisma/schema.prisma
// ProjectAssure - SIH 2026 (PS ID: SIH26103)
// PostgreSQL 16 on Neon (serverless) | Prisma 6

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL") // Neon POOLED endpoint (PgBouncer) - runtime queries
  directUrl = env("DIRECT_URL")   // Neon DIRECT endpoint - migrations, introspection, seed
}

// ============================= ENUMS =============================

/// Lifecycle of a government project
enum ProjectStatus {
  PLANNING
  ACTIVE
  ON_HOLD
  COMPLETED
  CANCELLED
}

/// Derived from healthScore:
///   75-100 = HEALTHY (green), 50-74 = AT_RISK (amber), 0-49 = CRITICAL (red)
enum HealthStatus {
  HEALTHY
  AT_RISK
  CRITICAL
}

enum TaskStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  BLOCKED
  CANCELLED
}

enum MilestoneStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  DELAYED
  BLOCKED
}

/// Alert severity, ordered CRITICAL > HIGH > MEDIUM > LOW
enum AlertSeverity {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum ResourceCategory {
  HUMAN
  EQUIPMENT
  MATERIAL
}

enum UserRole {
  ADMIN
  PROJECT_MANAGER
  STAKEHOLDER
  VIEWER
}

enum BudgetCategory {
  CONSTRUCTION
  EQUIPMENT
  HUMAN_RESOURCES
  MATERIALS
  CONSULTANCY
  CONTINGENCY
  LAND_ACQUISITION
  OTHER
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

/// FS = finish-to-start, SS = start-to-start,
/// FF = finish-to-finish, SF = start-to-finish
enum DependencyType {
  FINISH_TO_START
  START_TO_START
  FINISH_TO_FINISH
  START_TO_FINISH
}

// ==================== ORGANISATION HIERARCHY ====================

model Organization {
  id          String       @id @default(cuid())
  name        String
  code        String?      @unique // e.g. "MOSPI"
  logoUrl     String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  departments Department[]
  users       User[]

  @@map("organizations")
}

model Department {
  id             String       @id @default(cuid())
  name           String
  code           String? // e.g. "IPMD"
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  users          User[]
  projects       Project[]
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([organizationId])
  @@map("departments")
}

model User {
  id            String          @id @default(cuid())
  name          String
  email         String          @unique
  passwordHash  String?
  role          UserRole        @default(VIEWER)
  avatar        String?
  phone         String?
  isActive      Boolean         @default(true) // soft-delete flag, see Part I
  departmentId  String?
  department    Department?     @relation(fields: [departmentId], references: [id], onDelete: SetNull)

  projects      ProjectMember[]
  assignedTasks Task[]
  notifications Notification[]
  documents     Document[] // documents uploaded by this user
  auditLogs     AuditLog[]

  createdAt     DateTime        @default(now())
  updatedAt     DateTime        @updatedAt

  @@index([departmentId])
  @@index([role])
  @@map("users")
}

// ============================= PROJECT =============================

model Project {
  id               String         @id @default(cuid())
  name             String
  description      String         @db.Text
  status           ProjectStatus  @default(PLANNING)

  // ---- Composite health score (0-100) ----
  // healthScore = 0.30*schedule + 0.25*budget + 0.20*resources + 0.25*milestones
  // Recomputed after every write to Project / Milestone / Task / BudgetRecord /
  // ResourceAllocation, and by a 6-hour cron job (see Part I and API doc).
  healthScore      Float          @default(100)
  healthStatus     HealthStatus   @default(HEALTHY)
  scheduleScore    Float          @default(100) // weight 0.30
  budgetScore      Float          @default(100) // weight 0.25
  resourceScore    Float          @default(100) // weight 0.20
  milestoneScore   Float          @default(100) // weight 0.25
  healthComputedAt DateTime?

  // ---- Timeline ----
  startDate        DateTime
  targetDate       DateTime
  estimatedEndDate DateTime?
  actualEndDate    DateTime?
  progress         Float          @default(0) // 0-100

  // ---- Money (in lakhs of INR) ----
  totalBudget      Decimal        @default(0) @db.Decimal(18, 2)
  spentBudget      Decimal        @default(0) @db.Decimal(18, 2)
  projectedBudget  Decimal?       @db.Decimal(18, 2)

  // ---- Location ----
  state            String?
  district         String?
  latitude         Float?
  longitude        Float?

  // ---- Classification ----
  sector           String? // Infrastructure, Health, Education, ...
  scheme           String? // Government scheme name
  psId             String? // SIH Problem Statement ID

  // ---- Relations ----
  departmentId     String
  department       Department     @relation(fields: [departmentId], references: [id], onDelete: Restrict)
  members          ProjectMember[]
  milestones       Milestone[]
  budgetRecords    BudgetRecord[]
  resources        ResourceAllocation[]
  riskAssessment   RiskAssessment?
  predictions      PredictionResult[]
  alerts           Alert[]
  documents        Document[]
  auditLogs        AuditLog[]

  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@index([departmentId, status]) // leftmost prefix also serves departmentId filters
  @@index([status, healthStatus]) // leftmost prefix also serves status filters
  @@index([healthStatus])
  @@index([sector])
  @@index([targetDate])
  @@map("projects")
}

/// Join table for the User <-> Project many-to-many relation.
/// It carries the member's role inside the project (Lead / Member / Observer),
/// which is why an implicit Prisma M:N relation is not enough.
model ProjectMember {
  id        String   @id @default(cuid())
  projectId String
  userId    String
  role      String // "Lead" | "Member" | "Observer"
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  joinedAt  DateTime @default(now())

  @@unique([projectId, userId]) // a user joins a project once; also serves project->members
  @@index([userId]) // "projects of this user" lookups
  @@map("project_members")
}

// ======================= MILESTONES & TASKS =======================

model Milestone {
  id          String          @id @default(cuid())
  name        String
  description String?         @db.Text
  status      MilestoneStatus @default(PENDING)
  plannedDate DateTime
  actualDate  DateTime?
  weight      Float           @default(1) // weight in the milestone health component
  isCritical  Boolean         @default(false)
  order       Int // display / dependency ordering within the project

  projectId   String
  project     Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tasks       Task[]

  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([projectId])
  @@index([projectId, status])
  @@index([plannedDate])
  @@map("milestones")
}

model Task {
  id             String     @id @default(cuid())
  name           String
  description    String?    @db.Text
  status         TaskStatus @default(NOT_STARTED)
  plannedStart   DateTime
  plannedEnd     DateTime
  actualStart    DateTime?
  actualEnd      DateTime?
  progress       Float      @default(0) // 0-100
  estimatedHours Float?
  actualHours    Float?

  milestoneId    String
  milestone      Milestone  @relation(fields: [milestoneId], references: [id], onDelete: Cascade)
  assigneeId     String?
  assignee       User?      @relation(fields: [assigneeId], references: [id], onDelete: SetNull)

  // Self-referencing M:N: dependency edges between tasks
  dependsOn      TaskDependency[] @relation("TaskDependsOn")
  dependedBy     TaskDependency[] @relation("TaskDependedBy")

  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  @@index([milestoneId])
  @@index([milestoneId, status])
  @@index([status])
  @@index([assigneeId])
  @@map("tasks")
}

/// Directed edge: `task` cannot finish before `dependsOnTask` finishes.
/// The @@unique pair prevents duplicate edges between the same two tasks.
model TaskDependency {
  id              String         @id @default(cuid())
  taskId          String
  dependsOnTaskId String
  type            DependencyType @default(FINISH_TO_START)
  task            Task           @relation("TaskDependsOn", fields: [taskId], references: [id], onDelete: Cascade)
  dependsOnTask   Task           @relation("TaskDependedBy", fields: [dependsOnTaskId], references: [id], onDelete: Cascade)

  @@unique([taskId, dependsOnTaskId])
  @@index([dependsOnTaskId]) // reverse lookup: what is blocked by task X
  @@map("task_dependencies")
}

// ============================= BUDGET =============================

model BudgetRecord {
  id          String         @id @default(cuid())
  category    BudgetCategory
  description String?        @db.Text
  planned     Decimal        @db.Decimal(18, 2)
  spent       Decimal        @default(0) @db.Decimal(18, 2)
  month       Int // 1-12
  year        Int

  projectId   String
  project     Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdAt   DateTime       @default(now())

  @@unique([projectId, category, month, year]) // one row per project/category/month
  @@index([projectId])
  @@index([projectId, year, month]) // burn-down chart queries
  @@index([category])
  @@map("budget_records")
}

// ============================ RESOURCES ============================

model ResourceAllocation {
  id        String           @id @default(cuid())
  category  ResourceCategory
  name      String
  quantity  Float
  allocated Float // how many are allocated to this project
  utilised  Float            @default(0)
  unit      String? // persons, tonnes, machines, ...
  status    String           @default("available")

  projectId String
  project   Project          @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  @@index([projectId])
  @@index([projectId, category])
  @@index([category])
  @@map("resource_allocations")
}

// ======================= RISK & PREDICTIONS =======================

model RiskAssessment {
  id           String    @id @default(cuid())
  scheduleRisk Float // 0-100
  budgetRisk   Float // 0-100
  resourceRisk Float // 0-100
  overallRisk  Float // 0-100 composite
  riskLevel    RiskLevel @default(LOW)
  factors      Json // [{ factor, impact, description }]
  assessedAt   DateTime  @default(now())

  projectId    String    @unique // 1:1 with Project
  project      Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([riskLevel])
  @@map("risk_assessments")
}

model PredictionResult {
  id             String   @id @default(cuid())
  predictionType String // "delay" | "budget_overrun" | "risk_level"
  predictedValue Float // 23 (days) | 1.3 (crore) | 0.78 (probability)
  confidence     Float // 0-1
  factors        Json // contributing factors with weights
  modelVersion   String // e.g. "xgboost_v2.1"

  projectId      String
  project        Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdAt      DateTime @default(now())

  @@index([projectId, predictionType])
  @@index([createdAt])
  @@map("prediction_results")
}

// ===================== ALERTS & NOTIFICATIONS =====================

model Alert {
  id          String        @id @default(cuid())
  title       String
  description String        @db.Text
  severity    AlertSeverity @default(MEDIUM)
  type        String // "delay" | "budget" | "resource" | "milestone" | "system"
  isRead      Boolean       @default(false)
  actionTaken Boolean       @default(false)

  projectId   String
  project     Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)

  createdAt   DateTime      @default(now())

  @@index([projectId, isRead])
  @@index([severity])
  @@index([createdAt])
  @@map("alerts")
}

model Notification {
  id        String   @id @default(cuid())
  title     String
  message   String   @db.Text
  type      String
  isRead    Boolean  @default(false)

  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())

  @@index([userId, isRead])
  @@index([createdAt])
  @@map("notifications")
}

// ============================ DOCUMENTS ============================

model Document {
  id            String   @id @default(cuid())
  fileName      String
  fileType      String // pdf | xlsx | png | jpg
  fileUrl       String // object storage URL
  fileSize      Int // bytes
  summary       String?  @db.Text // AI-generated summary (GPT-4o)
  extractedData Json? // structured data extracted by AI
  projectId     String
  project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  uploadedBy    String
  uploader      User     @relation(fields: [uploadedBy], references: [id], onDelete: Restrict)

  createdAt     DateTime @default(now())

  @@index([projectId])
  @@index([uploadedBy])
  @@index([fileType])
  @@map("documents")
}

// ============================== AUDIT ==============================

/// Append-only: the application never updates or deletes audit rows,
/// so there is intentionally no updatedAt field here.
model AuditLog {
  id        String   @id @default(cuid())
  action    String // "create" | "update" | "delete" | "login" | "export"
  entity    String // "project" | "task" | "milestone" | ...
  entityId  String?
  details   Json? // before/after values
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Restrict)
  ipAddress String?

  createdAt DateTime @default(now())

  @@index([userId])
  @@index([entity, entityId])
  @@index([createdAt]) // retention-window queries
  @@map("audit_logs")
}
```

### In Plain English

> The `schema.prisma` file is the architectural blueprint of a building: the rooms (tables), the doorways between them (relations), and the fire rules (what gets removed when a room is demolished). Prisma reads this blueprint and does three jobs at once — it builds the actual building in PostgreSQL, and it hands the developers typed TypeScript classes so a misspelled field fails at compile time instead of at the demo. Judges only ever see the finished building; the blueprint is why it went up in days, not months.

## PART C — Model-by-Model Explanation

Each model is documented as a field reference: name, type, purpose, and a realistic example value drawn from the demo seed data (Part H). Money values are in lakhs of INR.

### C.1 Organization — `organizations`

| Field | Type | Purpose | Example value |
|-------|------|---------|---------------|
| id | String (cuid) | Primary key | `org_2xk91fma0` |
| name | String | Full organisation name | `Ministry of Statistics and Programme Implementation` |
| code | String?, unique | Short code for badges/URLs | `MOSPI` |
| logoUrl | String? | Logo asset URL | `/assets/orgs/mospi.png` |
| createdAt | DateTime | Row created | `2026-01-05T09:00:00Z` |
| updatedAt | DateTime | Row last touched | `2026-01-05T09:00:00Z` |

### C.2 Department — `departments`

| Field | Type | Purpose | Example value |
|-------|------|---------|---------------|
| id | String (cuid) | Primary key | `dep_8fj30dka2` |
| name | String | Division name | `Infrastructure & Project Monitoring Division` |
| code | String? | Short code | `IPMD` |
| organizationId | String (FK) | Owning organisation | `org_2xk91fma0` |
| createdAt / updatedAt | DateTime | Timestamps | `2026-01-05T09:05:00Z` |

### C.3 User — `users`

| Field | Type | Purpose | Example value |
|-------|------|---------|---------------|
| id | String (cuid) | Primary key | `usr_1a2b3c4d5e` |
| name | String | Display name | `Kavya Iyer` |
| email | String, unique | Login + notification address | `kavya.iyer@projectassure.in` |
| passwordHash | String? | bcrypt hash (null for SSO) | `$2b$12$9Xk...` |
| role | UserRole | ADMIN / PROJECT_MANAGER / STAKEHOLDER / VIEWER | `PROJECT_MANAGER` |
| avatar | String? | Profile image URL | `/avatars/kavya.png` |
| phone | String? | SMS alerts (future scope) | `+91 98400 12345` |
| isActive | Boolean | Soft-delete flag | `true` |
| departmentId | String? (FK) | Home department (nullable) | `dep_8fj30dka2` |
| createdAt / updatedAt | DateTime | Timestamps | `2026-01-06T10:12:00Z` |

### C.4 Project — `projects`

| Field | Type | Purpose | Example value |
|-------|------|---------|---------------|
| id | String (cuid) | Primary key | `prj_9m4x7q2v8` |
| name | String | Project title | `Bharatmala P-4 Corridor Monitoring` |
| description | String (Text) | Long-form scope note | `Digitised progress tracking for...` |
| status | ProjectStatus | Lifecycle state | `ACTIVE` |
| healthScore | Float | Composite 0-100 | `58.4` |
| healthStatus | HealthStatus | Derived bucket | `AT_RISK` |
| scheduleScore | Float | Component (weight 0.30) | `61.0` |
| budgetScore | Float | Component (weight 0.25) | `52.0` |
| resourceScore | Float | Component (weight 0.20) | `70.0` |
| milestoneScore | Float | Component (weight 0.25) | `50.0` |
| healthComputedAt | DateTime? | Last recompute | `2026-02-01T06:00:04Z` |
| startDate | DateTime | Planned start | `2025-08-01T00:00:00Z` |
| targetDate | DateTime | Planned finish | `2026-09-30T00:00:00Z` |
| estimatedEndDate | DateTime? | Engine's revised estimate | `2026-11-12T00:00:00Z` |
| actualEndDate | DateTime? | Set on completion | `null` |
| progress | Float | 0-100 physical progress | `47.5` |
| totalBudget | Decimal(18,2) | Sanctioned outlay (lakhs) | `14500.00` |
| spentBudget | Decimal(18,2) | Booked expenditure (lakhs) | `7830.50` |
| projectedBudget | Decimal(18,2)? | Predicted final cost | `15260.00` |
| state / district | String? | Geographic location | `Tamil Nadu` / `Chennai` |
| latitude / longitude | Float? | Map pin | `13.0827` / `80.2707` |
| sector | String? | Sector tag | `Infrastructure` |
| scheme | String? | Parent scheme | `Bharatmala Pariyojana` |
| psId | String? | SIH problem-statement link | `SIH26103` |
| departmentId | String (FK) | Owning department | `dep_8fj30dka2` |
| createdAt / updatedAt | DateTime | Timestamps | `2026-01-10T08:00:00Z` |

### C.5 ProjectMember — `project_members`

| Field | Type | Purpose | Example value |
|-------|------|---------|---------------|
| id | String (cuid) | Primary key | `pm_5t6y7u8i9o` |
| projectId | String (FK) | The project | `prj_9m4x7q2v8` |
| userId | String (FK) | The member | `usr_1a2b3c4d5e` |
| role | String | Role inside this project | `Lead` |
| joinedAt | DateTime | Membership start | `2026-01-12T11:00:00Z` |

### C.6 Milestone — `milestones`

| Field | Type | Purpose | Example value |
|-------|------|---------|---------------|
| id | String (cuid) | Primary key | `mls_2b3c4d5e6f` |
| name | String | Checkpoint title | `Foundation work complete` |
| description | String? (Text) | Acceptance criteria | `All 14 pier footings cast` |
| status | MilestoneStatus | PENDING / IN_PROGRESS / COMPLETED / DELAYED / BLOCKED | `DELAYED` |
| plannedDate | DateTime | Target date | `2026-03-15T00:00:00Z` |
| actualDate | DateTime? | Real completion date | `null` |
| weight | Float | Importance in health math | `2.0` |
| isCritical | Boolean | On the critical path | `true` |
| order | Int | Sort position | `3` |
| projectId | String (FK) | Owning project | `prj_9m4x7q2v8` |

### C.7 Task — `tasks`

| Field | Type | Purpose | Example value |
|-------|------|---------|---------------|
| id | String (cuid) | Primary key | `tsk_7g8h9i0j1k` |
| name | String | Work item title | `Cast pier footing P-07` |
| description | String? (Text) | Execution detail | `M30 concrete, 42 cu m` |
| status | TaskStatus | NOT_STARTED / IN_PROGRESS / COMPLETED / BLOCKED / CANCELLED | `BLOCKED` |
| plannedStart / plannedEnd | DateTime | Schedule window | `2026-02-10` / `2026-02-24` |
| actualStart / actualEnd | DateTime? | Real window | `2026-02-12` / `null` |
| progress | Float | 0-100 | `35.0` |
| estimatedHours / actualHours | Float? | Effort tracking | `120` / `96` |
| milestoneId | String (FK) | Parent milestone | `mls_2b3c4d5e6f` |
| assigneeId | String? (FK) | Responsible user | `usr_1a2b3c4d5e` |

### C.8 TaskDependency — `task_dependencies`

| Field | Type | Purpose | Example value |
|-------|------|---------|---------------|
| id | String (cuid) | Primary key | `tde_1k2l3m4n5o` |
| taskId | String (FK) | The dependent task (the "successor") | `tsk_7g8h9i0j1k` |
| dependsOnTaskId | String (FK) | The prerequisite task (the "predecessor") | `tsk_0p1q2r3s4t` |
| type | DependencyType | FS / SS / FF / SF | `FINISH_TO_START` |

### C.9 BudgetRecord — `budget_records`

| Field | Type | Purpose | Example value |
|-------|------|---------|---------------|
| id | String (cuid) | Primary key | `bud_3n4o5p6q7r` |
| category | BudgetCategory | CONSTRUCTION, EQUIPMENT, HUMAN_RESOURCES, MATERIALS, CONSULTANCY, CONTINGENCY, LAND_ACQUISITION, OTHER | `CONSTRUCTION` |
| description | String? (Text) | Line-item note | `Pier and deck works, Q4` |
| planned | Decimal(18,2) | Budgeted amount for the month | `1200.00` |
| spent | Decimal(18,2) | Actual spend booked | `1385.40` |
| month | Int | Calendar month | `2` |
| year | Int | Calendar year | `2026` |
| projectId | String (FK) | Owning project | `prj_9m4x7q2v8` |

### C.10 ResourceAllocation — `resource_allocations`

| Field | Type | Purpose | Example value |
|-------|------|---------|---------------|
| id | String (cuid) | Primary key | `res_8s9t0u1v2w` |
| category | ResourceCategory | HUMAN / EQUIPMENT / MATERIAL | `EQUIPMENT` |
| name | String | What the resource is | `Tower cranes` |
| quantity | Float | Total available pool | `6` |
| allocated | Float | Committed to this project | `3` |
| utilised | Float | Actually consumed so far | `2.5` |
| unit | String? | Unit of measure | `machines` |
| status | String | Availability status | `in-use` |
| projectId | String (FK) | Owning project | `prj_9m4x7q2v8` |

### C.11 RiskAssessment — `risk_assessments`

| Field | Type | Purpose | Example value |
|-------|------|---------|---------------|
| id | String (cuid) | Primary key | `rsk_4x5y6z7a8b` |
| scheduleRisk | Float | 0-100 schedule risk | `72.0` |
| budgetRisk | Float | 0-100 budget risk | `65.0` |
| resourceRisk | Float | 0-100 resource risk | `40.0` |
| overallRisk | Float | 0-100 composite | `62.3` |
| riskLevel | RiskLevel | LOW / MEDIUM / HIGH / CRITICAL | `HIGH` |
| factors | Json (JSONB) | Factor list with impacts | `[{"factor":"monsoon delay","impact":18}]` |
| assessedAt | DateTime | Snapshot time | `2026-02-01T06:00:10Z` |
| projectId | String (FK, unique) | 1:1 with Project | `prj_9m4x7q2v8` |

### C.12 PredictionResult — `prediction_results`

| Field | Type | Purpose | Example value |
|-------|------|---------|---------------|
| id | String (cuid) | Primary key | `prd_9c0d1e2f3g` |
| predictionType | String | "delay" / "budget_overrun" / "risk_level" | `delay` |
| predictedValue | Float | Model output in natural units | `23` (days late) |
| confidence | Float | 0-1 model confidence | `0.82` |
| factors | Json (JSONB) | Contributing factors + weights | `[{"name":"blocked_tasks","weight":0.41}]` |
| modelVersion | String | Model tag for reproducibility | `xgboost_v2.1` |
| projectId | String (FK) | Owning project | `prj_9m4x7q2v8` |
| createdAt | DateTime | Prediction time | `2026-02-01T06:00:20Z` |

### C.13 Alert — `alerts`

| Field | Type | Purpose | Example value |
|-------|------|---------|---------------|
| id | String (cuid) | Primary key | `alr_5h6i7j8k9l` |
| title | String | Headline | `Budget overrun projected: +5.2%` |
| description | String (Text) | Detail body | `Projected final cost exceeds...` |
| severity | AlertSeverity | CRITICAL / HIGH / MEDIUM / LOW | `HIGH` |
| type | String | delay / budget / resource / milestone / system | `budget` |
| isRead | Boolean | Seen by anyone yet | `false` |
| actionTaken | Boolean | Mitigation recorded | `false` |
| projectId | String (FK) | Related project | `prj_9m4x7q2v8` |
| createdAt | DateTime | Raised at | `2026-02-01T06:00:25Z` |

### C.14 Notification — `notifications`

| Field | Type | Purpose | Example value |
|-------|------|---------|---------------|
| id | String (cuid) | Primary key | `ntf_6j7k8l9m0n` |
| title | String | Short headline | `Task blocked on your project` |
| message | String (Text) | Full message | `Cast pier footing P-07 is blocked...` |
| type | String | Notification kind | `task_blocked` |
| isRead | Boolean | Read by this user | `false` |
| userId | String (FK) | Recipient | `usr_1a2b3c4d5e` |
| createdAt | DateTime | Sent at | `2026-02-02T14:10:00Z` |

### C.15 Document — `documents`

| Field | Type | Purpose | Example value |
|-------|------|---------|---------------|
| id | String (cuid) | Primary key | `doc_0m1n2o3p4q` |
| fileName | String | Original file name | `progress_report_feb.xlsx` |
| fileType | String | pdf / xlsx / png / jpg | `xlsx` |
| fileUrl | String | Object storage URL | `https://cdn.../doc_0m1n...xlsx` |
| fileSize | Int | Bytes | `184320` |
| summary | String? (Text) | GPT-4o generated summary | `Spends 8% above plan in Feb...` |
| extractedData | Json? (JSONB) | AI-extracted structured fields | `{"planned":1200,"spent":1385.4}` |
| projectId | String (FK) | Owning project | `prj_9m4x7q2v8` |
| uploadedBy | String (FK) | Uploading user | `usr_1a2b3c4d5e` |
| createdAt | DateTime | Upload time | `2026-02-03T09:41:00Z` |

### C.16 AuditLog — `audit_logs`

| Field | Type | Purpose | Example value |
|-------|------|---------|---------------|
| id | String (cuid) | Primary key | `aud_1p2q3r4s5t` |
| action | String | create / update / delete / login / export | `update` |
| entity | String | Entity type touched | `project` |
| entityId | String? | Specific row id | `prj_9m4x7q2v8` |
| details | Json? (JSONB) | Before/after diff | `{"progress":{"from":44.0,"to":47.5}}` |
| userId | String (FK) | Acting user | `usr_1a2b3c4d5e` |
| ipAddress | String? | Request origin | `10.24.8.117` |
| createdAt | DateTime | Event time | `2026-02-03T10:02:33Z` |

### In Plain English

> Each model is like a printed government form: fixed labelled boxes, each box accepting only one kind of information. Part C is the "how to fill this form" guide — including a filled-in example so nobody guesses whether the budget box wants rupees or lakhs (it wants lakhs, always with two decimal places). When every form in the office is filled the same way, the filing clerks (our queries) never get surprised.

## PART D — Relationship Map & Cascade Rules

### D.1 One-to-One (1:1)

| Relation | Implementation | Why 1:1 |
|----------|----------------|---------|
| Project ↔ RiskAssessment | `RiskAssessment.projectId @unique` | One live risk snapshot per project; heavy JSON factors are kept off the hot `projects` row so dashboard reads stay narrow |

### D.2 One-to-Many (1:N)

| Parent (1) | Child (N) | Foreign key | Notes |
|------------|-----------|-------------|-------|
| Organization | Department | `departments.organizationId` | Tenant hierarchy root |
| Department | User | `users.departmentId` (nullable) | Users can exist without a department |
| Department | Project | `projects.departmentId` | Owning division |
| Project | Milestone | `milestones.projectId` | 3-7 per project in seed |
| Milestone | Task | `tasks.milestoneId` | 5-15 per milestone in seed |
| Project | BudgetRecord | `budget_records.projectId` | Monthly rows, 6 months of history |
| Project | ResourceAllocation | `resource_allocations.projectId` | HUMAN / EQUIPMENT / MATERIAL |
| Project | PredictionResult | `prediction_results.projectId` | Append-only history |
| Project | Alert | `alerts.projectId` | Severity-ranked |
| Project | Document | `documents.projectId` | Uploads |
| Project | AuditLog | via `entity`/`entityId` | Polymorphic reference (no hard FK) |
| User | Task | `tasks.assigneeId` (nullable) | Assignee |
| User | Notification | `notifications.userId` | Bell feed |
| User | Document | `documents.uploadedBy` | Upload provenance |
| User | AuditLog | `audit_logs.userId` | Actor trail |

### D.3 Many-to-Many (M:N) via join tables

| Pair | Join table | Extra payload | Why an explicit join table |
|------|------------|---------------|----------------------------|
| User ↔ Project | `project_members` | `role` (Lead/Member/Observer), `joinedAt` | The relationship itself has attributes, so Prisma's implicit M:N cannot model it |
| Task ↔ Task | `task_dependencies` | `type` (FS/SS/FF/SF) | Self-referential, **directed** edges: A depends-on B is not the same as B depends-on A; `@@unique([taskId, dependsOnTaskId])` blocks duplicate edges |

### D.4 Cascade rules (every FK, explicit)

| Child relation | `onDelete` | Rationale |
|----------------|------------|-----------|
| Department → Organization | `Cascade` | An organisation's divisions cannot outlive it (single-tenant: effectively never fires) |
| User → Department | `SetNull` | Dissolving a division should not delete staff |
| Project → Department | `Restrict` | A project must always have an owner; move it, never orphan it |
| ProjectMember → Project / User | `Cascade` | Membership is meaningless without both sides |
| Milestone → Project | `Cascade` | Deleting a project removes its milestones |
| Task → Milestone | `Cascade` | Same logic one level down |
| Task → User (assignee) | `SetNull` | Offboarding a user unassigns their tasks, does not delete them |
| TaskDependency → Task (both sides) | `Cascade` | An edge cannot exist if either endpoint is gone |
| BudgetRecord / ResourceAllocation / RiskAssessment / PredictionResult / Alert / Document → Project | `Cascade` | One project delete clears the whole subtree in a single transaction (demo reset = one `deleteMany`) |
| Notification → User | `Cascade` | Personal feed dies with the account |
| Document → User (uploader) | `Restrict` | Keep provenance: delete or reassign the uploader's identity first |
| AuditLog → User | `Restrict` | The audit trail must never be silently orphaned or deleted |

**Soft-delete override:** even though cascades are defined, Part I forbids hard-deleting `projects` and `users` in application code — deletion of a Project is expressed as `status = CANCELLED`, and user deactivation as `isActive = false`. Cascades exist for the seed reset path and for truly transient child rows.

### D.5 Key design decisions (preserved and expanded from the original draft)

**Why JSONB for risk factors and predictions?** The `factors` field in `RiskAssessment` and `PredictionResult` uses PostgreSQL's `JSONB` type (Prisma `Json`) because:
- The structure varies by prediction type — delay factors differ from budget factors
- JSONB supports efficient querying with GIN indexes
- It avoids creating a separate table for every factor shape
- Prisma supports JSONB with TypeScript type safety

**Why separate Tasks from Milestones?** They serve different audiences:
- **Milestones** are high-level checkpoints visible to stakeholders
- **Tasks** are granular work items visible to project managers
- One milestone contains multiple tasks
- The health-score calculation uses milestone-level data, not task-level, keeping the formula explainable to MoSPI leadership

### In Plain English

> Relationships in the database are like emergency-contact cards clipped to each employee file: every child row carries the id of its parent, so anyone can trace a task all the way up to its ministry. The cascade rules are the office's demolition policy — knock down a project and the paperwork inside (tasks, alerts, budgets) goes too, but the security archive (audit logs) and the personnel files (users) are protected by law and are never dragged down with it.

## PART E — Indexing & Query Performance

### E.1 Strategy table

| Table | Index | Serves |
|-------|-------|--------|
| projects | `(departmentId, status)` | Department dashboards; leftmost prefix covers department-only filters |
| projects | `(status, healthStatus)` | Portfolio filters ("all ACTIVE"); prefix covers status-only |
| projects | `(healthStatus)` | "Show all CRITICAL projects" red board |
| projects | `(sector)`, `(targetDate)` | Sector drill-down; deadline-sorted timelines |
| users | `(departmentId)`, `(role)` | Staff lists by division / role |
| project_members | `UNIQUE(projectId, userId)` + `(userId)` | Member lists and "my projects" |
| milestones | `(projectId)`, `(projectId, status)`, `(plannedDate)` | Gantt and milestone boards |
| tasks | `(milestoneId, status)`, `(assigneeId)` | Task boards, "my tasks" |
| task_dependencies | `UNIQUE(taskId, dependsOnTaskId)` + `(dependsOnTaskId)` | Forward edge lookup + reverse "what is blocked by X" |
| budget_records | `UNIQUE(projectId, category, month, year)` + `(projectId, year, month)` | Burn-down charts per year |
| resource_allocations | `(projectId, category)`, `(category)` | Resource heatmaps |
| risk_assessments | `UNIQUE(projectId)`, `(riskLevel)` | 1:1 fetch; risk-ranked list |
| prediction_results | `(projectId, predictionType)`, `(createdAt)` | Prediction history per model type |
| alerts | `(projectId, isRead)`, `(severity)`, `(createdAt)` | Unread badge counts, severity feeds |
| notifications | `(userId, isRead)`, `(createdAt)` | Per-user unread counts |
| audit_logs | `(userId)`, `(entity, entityId)`, `(createdAt)` | User trails, entity history, retention jobs |

Rule applied: **every foreign key is indexed**, plus one composite index per documented hot query. Composites are ordered filter-equality-first, sort-last.

### E.2 Six hot queries and the indexes they hit

**1. Department dashboard — active projects, worst health first**

```sql
SELECT id, name, health_score, health_status, progress
FROM projects
WHERE department_id = $1 AND status = 'ACTIVE'
ORDER BY health_score ASC;
```
Hits `projects(departmentId, status)` for the filter; the small per-department result set makes the sort cheap.

**2. Unread alert feed for a project**

```sql
SELECT * FROM alerts
WHERE project_id = $1 AND is_read = false
ORDER BY created_at DESC
LIMIT 20;
```
Hits `alerts(projectId, isRead)`; 20-row sort is trivial.

**3. Milestone task board**

```sql
SELECT * FROM tasks
WHERE milestone_id = $1 AND status = 'IN_PROGRESS';
```
Hits `tasks(milestoneId, status)` — a pure index-range scan.

**4. Budget burn-down chart (one project, one year)**

```sql
SELECT month, SUM(planned) AS planned, SUM(spent) AS spent
FROM budget_records
WHERE project_id = $1 AND year = $2
GROUP BY month
ORDER BY month;
```
Hits `budget_records(projectId, year, month)`; the chart endpoint runs on every project page load.

**5. Notification badge count**

```sql
SELECT COUNT(*) FROM notifications
WHERE user_id = $1 AND is_read = false;
```
Hits `notifications(userId, isRead)` — and because both columns are in the index, PostgreSQL can satisfy it as an index-only scan.

**6. Full entity history for the audit viewer**

```sql
SELECT * FROM audit_logs
WHERE entity = 'project' AND entity_id = $1
ORDER BY created_at DESC
LIMIT 50;
```
Hits `audit_logs(entity, entityId)`.

Every schema change should be validated with `EXPLAIN ANALYZE` before merge; if a `Seq Scan` appears on a hot path, either an index is missing or the query shape fights the index order.

### E.3 Anti-patterns (what we deliberately avoid)

1. **N+1 queries** — fetching 30 projects then one query per project for milestones. Always use Prisma `include` / `select` with a single nested query, or a join.
2. **`SELECT *` on wide tables** — `projects` carries 30+ columns; dashboards `select` only what the card renders.
3. **Missing pagination** — every list endpoint uses `take`/`skip` (or cursor) with a hard cap of 100 rows.
4. **Filtering inside JSONB without a GIN index** — ad-hoc `factors->>'name'` filters are restricted to admin screens, and GIN indexes are added only when a JSONB filter becomes hot.
5. **Over-indexing write-heavy tables** — `audit_logs` and `budget_records` get inserts constantly; three indexes each is the ceiling, no more.
6. **`Float` for money** — the original draft used `Float`; the final schema uses `Decimal(18,2)` everywhere money appears.
7. **Deep nested `include` (3+ levels)** — prefer two shallow queries over one four-level monster that Neon's pooled endpoint must stream back in one response.
8. **Raw connections in serverless** — every serverless function must use the pooled endpoint (Part F) or connection counts explode after cold starts.

### In Plain English

> An index is the tabbed divider section of a thick phone book: instead of flipping every page to find "Iyer", you jump straight to the I tab. The six hot queries above are the six questions judges and users ask most often, so we built a tab for each. The anti-pattern list is the fine print — like printing a full index for a 10-page pamphlet, extra tabs sound nice but slow down every rewrite of the book.

## PART F — Neon PostgreSQL Playbook

ProjectAssure runs on PostgreSQL 16 hosted on Neon's free serverless tier. Three Neon capabilities shape the schema workflow: pooled connections, database branching, and scale-to-zero.

### F.1 Pooled vs direct connection strings

Neon exposes two endpoints for the same database. Using the wrong one for the wrong job is the single most common Neon misconfiguration:

| Property | `DATABASE_URL` (pooled) | `DIRECT_URL` (direct) |
|----------|--------------------------|------------------------|
| Endpoint | PgBouncer in front of compute | Straight to the compute node |
| Typical port | 6543 | 5432 |
| Used by | Application runtime, serverless functions, Prisma Client queries | `prisma migrate`, `prisma db push`, `prisma db pull`, seeding, `pg_dump` |
| Why | Serverless functions open many short-lived connections; PgBouncer multiplexes them so the free-tier connection cap is never hit | Migrations need session-level features (prepared statements, advisory locks) that pooled mode does not guarantee |

```dotenv
# .env  (Neon project: projectassure)
DATABASE_URL="postgresql://app_user:****@ep-cool-sun-123456.ap-southeast-1.aws.neon.tech/projectassure?sslmode=require&pgbouncer=true&connect_timeout=15"
DIRECT_URL="postgresql://app_user:****@ep-cool-sun-123456.ap-southeast-1.aws.neon.tech/projectassure?sslmode=require"
```

And the matching Prisma datasource block (already present in Part B):

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL") // pooled - runtime queries
  directUrl = env("DIRECT_URL")   // direct - migrations, introspection, seed
}
```

Prisma Client uses `url` for all runtime queries and automatically switches to `directUrl` for `migrate` and `studio` commands. The same pattern is mirrored in Docker Compose for local development (`postgres:16-alpine` on localhost, no pooling needed there).

### F.2 Branching workflow (main / dev)

Neon branches are copy-on-write clones of the database — creating one is instant and costs almost nothing on the free tier.

**Via the Neon UI:**
1. Open the project → **Branches** → **Create branch**.
2. Name it `dev`, select parent `main`, keep the smallest compute size.
3. Copy the new branch's connection strings into the dev `.env`.

**Via the Neon CLI:**

```bash
npm install -g neonctl
neonctl auth                                          # browser login
neonctl branches create --name dev --parent main --project projectassure
neonctl connection-string dev --project projectassure --pooled   # pooled URL for .env
neonctl branches list --project projectassure
```

**Team workflow:**
1. `main` branch = production data; only `prisma migrate deploy` and the app ever touch it.
2. `dev` branch = shared integration database for the team; schema changes land here first.
3. For risky migrations, cut a throwaway branch (`neonctl branches create --name feat-health-recompute`), test `migrate dev` against it, delete it after merge.
4. Application deploys to Vercel read `DATABASE_URL`/`DIRECT_URL` from environment variables per environment (preview deployments can point at a Neon branch too).

### F.3 Scale-to-zero implications

- The free-tier compute suspends after roughly five minutes of inactivity; the next request pays a cold start of a few hundred milliseconds to about a second.
- The 6-hour health cron and any API traffic keep the database warm during working hours; overnight the database sleeps and compute hours stay within the free allowance.
- Demo protocol: two minutes before judging, hit the dashboard endpoint once (or run `curl https://projectassure.vercel.app/api/health`) to pre-warm the compute so the first judge interaction is instant.
- Pooled connections matter more, not less, at wake-up: after a cold start, every serverless instance reconnects simultaneously, and PgBouncer absorbs the burst.

### F.4 Monitoring

- **Neon console**: compute hours used, storage size, branch count, and per-branch activity — checked weekly against the free-tier limits.
- **Query health**: run `EXPLAIN ANALYZE` on the six hot queries in Part E after every schema change; watch for plans flipping from `Index Scan` to `Seq Scan`.
- **Prisma logging**: enable `log: [{ emit: "event", level: "warn" }, "error"]` and alert on queries over 500 ms.
- **Connection count**: on the pooled endpoint, watch PgBouncer saturation if Vercel function count grows.

### In Plain English

> Neon is like a self-storage facility that switches the lights off and stops charging you when nobody opens a unit. The pooled connection is the shared loading dock that lets hundreds of small deliveries use one door; the direct connection is the private staff entrance reserved for the renovation crew (migrations). Branching is photocopying an entire storage unit in one second so the team can experiment without ever touching the originals.

## PART G — Migrations Workflow

Prisma Migrate keeps every schema change as a numbered SQL file under `prisma/migrations/`, so all environments (local Docker, Neon dev branch, Neon main) replay the identical history.

### G.1 Procedures

**1. First baseline (once per fresh database):**

```bash
npx prisma migrate dev --name init
# creates prisma/migrations/<timestamp>_init/migration.sql, applies it via DIRECT_URL,
# and regenerates the Prisma Client
```

**2. Iterative change while developing:**

```bash
# edit prisma/schema.prisma first, then:
npx prisma migrate dev --name add_health_component_scores
```

**3. Ship to a shared/prod database (never edits SQL, only applies existing files):**

```bash
npx prisma migrate deploy    # run against the Neon dev branch in CI, then main in prod
```

**4. Check drift / status:**

```bash
npx prisma migrate status    # which migrations has this database applied?
npx prisma migrate diff --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma --script   # preview SQL without applying
```

**5. Nuclear reset for local development:**

```bash
npx prisma migrate reset     # drops schema, replays all migrations, runs the seed
npx prisma db seed           # (re)load demo data only
```

**6. Inspect data while building the demo:**

```bash
npx prisma studio            # browser GUI over the local or dev-branch database
```

### G.2 When-to-use table

| Situation | Command | Target database |
|-----------|---------|-----------------|
| New model or field during development | `prisma migrate dev --name <x>` | Local Docker Postgres |
| Teammate pulled new migrations | `prisma migrate dev` (replays anything pending) | Local Docker Postgres |
| Schema ready for the team | `prisma migrate deploy` | Neon `dev` branch |
| Release to production | `prisma migrate deploy` (CI step) | Neon `main` branch |
| Suspicious drift between schema and database | `prisma migrate status` + `prisma migrate diff` | Any |
| Corrupted local state | `prisma migrate reset` | Local Docker Postgres |
| Risky migration, unsure of impact | run `migrate dev` against a throwaway Neon branch first (Part F.2) | Neon scratch branch |

### G.3 Notes for the Neon setup

- `migrate dev` needs a **shadow database** to detect drift. Point `SHADOW_DATABASE_URL` in the datasource at a dedicated Neon `shadow` branch so development machines never need superuser privileges.
- Only `migrate deploy` runs in CI/production; `migrate dev` is a developer-laptop command because it can reset databases.
- Every migration file is committed to Git, so the `migrations/` folder doubles as the schema's changelog for the SIH report.

### In Plain English

> Migrations are renovation permits for a building: each one is a numbered, dated instruction ("add a window to room 12") kept in a shared logbook. Every copy of the building — a teammate's laptop, the dev branch, the production data centre — sends a contractor through the logbook in the same order, so no two copies ever drift apart. `migrate reset` is the one destructive permit that is only ever issued for the model apartment, never for the occupied building.

## PART H — Seeding Strategy

An empty dashboard impresses nobody. The seed script builds a miniature-but-believable MoSPI portfolio so every screen, chart, and alert has something true-shaped to show within 90 seconds of the demo starting.

### H.1 Demo data narrative (matches project facts)

| Seeded item | Volume | Story it tells |
|-------------|--------|----------------|
| Organization | 1 — MoSPI | Single-tenant deployment |
| Departments | 5 | National Accounts, Social Statistics, Infrastructure & Project Monitoring, Economic Statistics, Capacity Building |
| Users | 4+ | One per role: ADMIN, PROJECT_MANAGER, STAKEHOLDER, VIEWER |
| Projects | 30 | Spread across 5 departments and sectors (roads, health, education, urban, water); mixed statuses |
| Milestones | 3-7 per project | Checkpoints with realistic planned dates, some DELAYED |
| Tasks | 5-15 per milestone | Boards with progress, some BLOCKED |
| Task dependencies | Chains forming critical paths | Makes the dependency graph and delay propagation visible |
| Budget records | 6 months per project | Planned vs spent curves, some months overshooting |
| Resource allocations | Per project | HUMAN, EQUIPMENT, MATERIAL mix |
| Health distribution | ~27 HEALTHY, 2 AT_RISK, 1 CRITICAL | Deliberately skewed so the red/amber boards have content |
| RiskAssessment + PredictionResult + Alerts | On the sick projects | The prediction and alert pipeline has data to display from the first click |

### H.2 `seed.ts` structure outline

```ts
// prisma/seed.ts  —  run with: npx prisma db seed
import { PrismaClient } from "@prisma/client";

// 1. Deterministic RNG: same seed -> same data on every laptop
function mulberry32(seed: number) { /* tiny PRNG */ }
const rand = mulberry32(42);
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const int  = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const prisma = new PrismaClient();

// 2. Factories: pure functions, no I/O
const makeUser    = (deptId: string, role: UserRole) => ({ ... });
const makeProject = (deptId: string, i: number) => ({ ... });
const makeMilestone = (projectId: string, order: number) => ({ ... });
const makeTask    = (milestoneId: string, window: Date[]) => ({ ... });

// 3. Orchestration: insert in FK-safe order
async function main() {
  await wipeAll();                                  // deleteMany in reverse-FK order
  const org         = await seedOrganization();     // 1 org
  const departments = await seedDepartments(org.id);// 5 departments
  const users       = await seedUsers(departments); // 4+ roles
  const projects    = await seedProjects(departments); // 30 projects

  for (const project of projects) {
    const milestones = await seedMilestones(project, int(3, 7));
    for (const m of milestones) {
      const tasks = await seedTasks(m, int(5, 15));
      await seedDependencies(tasks);                // chains -> critical path
    }
    await seedBudgetHistory(project, /* months */ 6);
    await seedResources(project);
    await seedRiskAndPredictions(project);          // AT_RISK / CRITICAL only
    await seedAlerts(project);
  }
  await seedProjectMembers(users, projects);
  await seedNotifications(users);
}
```

Key properties of the seed:
- **Deterministic** — seeded PRNG means every team member and every demo machine sees identical data; a screenshot taken last week matches the live demo today.
- **Idempotent** — `wipeAll()` deletes in reverse-FK order, so `prisma migrate reset && prisma db seed` always yields the same clean state.
- **FK-safe ordering** — organisations before departments, departments before projects, and so on; no retry logic needed.
- **Fast** — batched `createMany` calls where relations allow; the full 30-project world seeds in a couple of seconds against Neon.

### H.3 Why story-driven data matters for the demo

1. The critical-path dependencies make the Gantt view and the "delay propagation" story real: blocking one task visibly cascades downstream.
2. The two AT_RISK and one CRITICAL project let the health engine show its weights (schedule 30 / budget 25 / resources 20 / milestones 25) with visibly different component scores.
3. Alerts and predictions exist only where the story says they should — the jury never sees a barren notifications panel.
4. Realistic names, lakh-denominated budgets, and Indian states ground the prototype in the MoSPI context of SIH26103.

### In Plain English

> Seeding is furnishing a showroom apartment. Nobody can judge a flat with bare walls, so the builder stages it: sofa here, lamp there, one deliberately scuffed wall to show how repairs are handled. Our seed data is that furniture — 30 believable projects, a few of them intentionally "damaged" (CRITICAL) so the judges can watch ProjectAssure diagnose and prescribe, not just display empty perfection.

## PART I — Data Integrity & Auditing

### I.1 AuditLog design

- **Append-only**: the application exposes no update or delete path for `audit_logs`; the model deliberately has no `updatedAt`. PostgreSQL's `onDelete: Restrict` to `users` prevents accidental orphaning.
- **What is captured**: `action` (create/update/delete/login/export), `entity` + `entityId`, a `details` JSONB before/after diff, the acting `userId`, and `ipAddress`.
- **How it is written**: a service-layer helper `recordAudit(tx, { actor, action, entity, entityId, diff })` is always called inside the same Prisma transaction as the mutation it describes — the audit row either lands with the change or not at all.
- **Retention**: a monthly job archives rows older than 180 days via the `createdAt` index, keeping the working table lean without losing history.
- **Viewer**: an admin-only audit screen paginates by `(entity, entityId)` and `(userId)` — both indexed in Part E.

### I.2 Soft delete vs hard delete

| Entity | Policy | Mechanism | Reason |
|--------|--------|-----------|--------|
| Project | **Soft** | `status = CANCELLED` (or ON_HOLD) | The FK graph, history, and audit trail must survive; "deleted" projects remain reportable |
| User | **Soft** | `isActive = false` | Task history, documents, and audit rows keep their actor |
| Milestone / Task / BudgetRecord / ResourceAllocation / Alert / Notification | **Hard** | Cascade delete with the parent | Operational children without independent legal value |
| Document | **Hard row, blob first** | Delete object-storage file, then the row | Avoid orphaned blobs |
| AuditLog | **Never deleted** | No delete path exists | The trail is the point |

### I.3 Validation layers (defence in depth)

| Layer | Tool | Example rule | Catches |
|-------|------|--------------|---------|
| API boundary | Zod | `z.object({ name: z.string().min(3), totalBudget: z.number().positive() })` | Malformed or hostile request bodies before they reach business logic |
| Business rules | Service layer | `spentBudget <= totalBudget`; no circular task dependencies | Cross-field and cross-entity invariants |
| Database | Prisma + PostgreSQL | Types, enums, `@unique`, FKs, `onDelete`, `Decimal(18,2)` precision | Whatever slips past the API — including hand-written SQL |
| Custom constraints | Raw SQL in migrations | `ALTER TABLE projects ADD CONSTRAINT health_score_range CHECK (health_score BETWEEN 0 AND 100);` | Range rules Prisma cannot express natively |

Prisma validates types and relations at the database boundary, but CHECK constraints must be added through a custom migration (Prisma Migrate preserves hand-edited SQL files). Together the layers mirror the schema principle: **the API is polite, the service is strict, the database is final**.

### In Plain English

> Picture a bank: the receptionist (Zod) checks that your form is filled and signed before you pass the rope; the clerk (service layer) confirms you actually have the funds; and the vault door (PostgreSQL) has its own steel rules that no clerk can override. Meanwhile a security camera (the AuditLog) records every single transaction and cannot be switched off by anyone — even the manager's deletions are on tape.

## PART J — Backup & Disaster Recovery on Neon

### J.1 Point-in-time restore (PITR)

Neon continuously archives write-ahead logs, letting you restore the database to any timestamp inside your plan's restore window (hours on the free tier; days on paid plans).

**Via the Neon UI:** Project → **Restore** → pick the timestamp → Neon creates a new branch holding the database exactly as it was.

**Via the CLI:**

```bash
neonctl branches create --name restore-pre-migration \
  --from-timestamp "2026-02-01T08:30:00Z" \
  --project projectassure
neonctl connection-string restore-pre-migration --project projectassure
```

Recovery point objective (RPO) is effectively seconds; recovery time is the seconds it takes to spin the branch plus a redeploy pointing `DATABASE_URL` at it.

### J.2 Branching as a free backup

- Before any risky migration or bulk data operation on `main`, snapshot first:

```bash
neonctl branches create --name backup-before-budget-refactor --parent main --project projectassure
```

- If the operation corrupts data, re-point the app at the backup branch — full rollback in under a minute — then delete the branch once verified.
- Branches are copy-on-write, so keeping a pre-release backup branch costs almost no storage.

### J.3 Logical export with pg_dump

For off-platform backups (kept during the SIH demo period), dump through the **direct** endpoint:

```bash
# 1. Copy the DIRECT (unpooled) connection string from the Neon console
export DIRECT_URL="postgresql://app_user:****@ep-cool-sun-123456.ap-southeast-1.aws.neon.tech/projectassure?sslmode=require"

# 2. Full logical backup, custom compressed format
pg_dump "$DIRECT_URL" --format=custom --file=projectassure_$(date +%F).dump

# 3. Schema-only snapshot for documentation / review
pg_dump "$DIRECT_URL" --schema-only --file=schema_snapshot.sql

# 4. Restore into a fresh database (e.g. a scratch Neon branch or local Docker)
pg_restore --dbname="$TARGET_URL" --no-owner --no-privileges projectassure_2026-02-01.dump
```

A nightly GitHub Action can schedule the dump and upload it as a build artifact:

```yaml
on:
  schedule:
    - cron: "0 2 * * *"   # 02:00 UTC daily
```

### J.4 DR drill checklist (run before the demo)

1. Dump: `pg_dump` completes without warnings; file size is plausible (a few MB).
2. Restore: `pg_restore` into a scratch branch; run `npx prisma migrate status` against it — expected answer: "Database schema is up to date".
3. Verify: row counts match (`projects = 30`, `departments = 5`, `users >= 4`).
4. Record the measured recovery time; the target for the SIH prototype is under five minutes end-to-end.

### In Plain English

> Backups are a photo album of the building taken every few hours: Neon's point-in-time restore is a camera so sharp that you can rebuild any room exactly as it looked at any chosen minute. Branching is taking an extra full photograph before the renovation crew arrives, and `pg_dump` is mailing a printed copy of the album to a locker across town — if the whole gallery burns down, the album survives and the building can be rebuilt from it.

---

*This document is part of the ProjectAssure SIH 2026 submission.*