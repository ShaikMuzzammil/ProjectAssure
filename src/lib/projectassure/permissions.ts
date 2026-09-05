// ProjectAssure — RBAC permission matrix (enforced in UI + API layers)
import type { User, UserRole, ViewId } from "./types";

export type Permission =
  | "project:create" | "project:edit" | "project:cancel" | "project:delete"
  | "milestone:edit" | "task:edit" | "budget:edit" | "resource:edit"
  | "document:upload" | "document:delete"
  | "alert:ack" | "alert:simulate" | "alerts:manage-rules"
  | "intervention:manage" | "intervention:advance"
  | "report:generate" | "report:export-portfolio" | "email:send"
  | "user:manage" | "settings:thresholds" | "audit:view-all" | "model:retrain"
  | "prediction:run" | "chat:full" | "data:reset";

const MATRIX: Record<Permission, UserRole[]> = {
  "project:create": ["ADMIN", "PROJECT_MANAGER"],
  "project:edit": ["ADMIN", "PROJECT_MANAGER"],
  "project:cancel": ["ADMIN"],
  "project:delete": ["ADMIN"],
  "milestone:edit": ["ADMIN", "PROJECT_MANAGER"],
  "task:edit": ["ADMIN", "PROJECT_MANAGER"],
  "budget:edit": ["ADMIN", "PROJECT_MANAGER"],
  "resource:edit": ["ADMIN", "PROJECT_MANAGER"],
  "document:upload": ["ADMIN", "PROJECT_MANAGER"],
  "document:delete": ["ADMIN"],
  "alert:ack": ["ADMIN", "PROJECT_MANAGER", "STAKEHOLDER"],
  "alert:simulate": ["ADMIN", "PROJECT_MANAGER"],
  "alerts:manage-rules": ["ADMIN"],
  "intervention:manage": ["ADMIN", "PROJECT_MANAGER"],
  "intervention:advance": ["ADMIN", "PROJECT_MANAGER", "STAKEHOLDER"],
  "report:generate": ["ADMIN", "PROJECT_MANAGER", "STAKEHOLDER"],
  "report:export-portfolio": ["ADMIN", "STAKEHOLDER"],
  "email:send": ["ADMIN", "PROJECT_MANAGER"],
  "user:manage": ["ADMIN"],
  "settings:thresholds": ["ADMIN"],
  "audit:view-all": ["ADMIN"],
  "model:retrain": ["ADMIN"],
  "prediction:run": ["ADMIN", "PROJECT_MANAGER"],
  "chat:full": ["ADMIN", "PROJECT_MANAGER", "STAKEHOLDER"],
  "data:reset": ["ADMIN"],
};

export function can(user: User | null, permission: Permission): boolean {
  if (!user) return false;
  return MATRIX[permission].includes(user.role);
}

export function canTouchProject(user: User | null, projectManager: string): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.role === "PROJECT_MANAGER") return projectManager === user.name;
  return false; // stakeholders/viewers never mutate
}

// Views visible per role (sidebar adapts).
// v6 COMPACT: one flat sidebar of ~7 core features — no domain groups.
// Deep screens (alerts, interventions, compare, analytics, simple-suite extras)
// stay routable via in-screen links, the bell, ⌘K and the project cards.
export const VIEWS_BY_ROLE: Record<UserRole, ViewId[]> = {
  ADMIN: ["monitor", "projects", "ai-assistant", "model-lab", "reports", "email-center", "help", "admin"],
  PROJECT_MANAGER: ["monitor", "projects", "ai-assistant", "model-lab", "reports", "email-center", "help"],
  STAKEHOLDER: ["monitor", "projects", "ai-assistant", "reports", "help"],
  VIEWER: ["monitor", "projects", "ai-assistant", "help"],
};

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Administrator", PROJECT_MANAGER: "Project Manager", STAKEHOLDER: "Stakeholder", VIEWER: "Viewer",
};

export const SEVERITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;
