/** Shared sync types (safe for both client and server imports — no node builtins). */

export interface SyncUser {
  id: string;
  name: string;
  email: string;
  role: string;
  source: string; // "demo" | "registered"
  designation?: string;
  department?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  projectCount: number;
  notificationCount: number;
  unreadAlerts: number;
}

export interface SyncProject {
  id: string;
  psId: string;
  name: string;
  department: string;
  state: string;
  district?: string;
  sector: string;
  status: string;
  progress: number;
  health: number;
  budgetTotalCr: number;
  budgetSpentCr: number;
  delayRisk: number; // 0-100
  ownerId: string;
  ownerName: string;
  milestonesTotal: number;
  milestonesCompleted: number;
  milestonesDelayed: number;
  lastActivityAt?: string;
}

export interface SyncAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  projectName?: string;
  projectPsId?: string;
  pathway: string;
  createdAt: string;
  status: string;
}

export interface SyncEvent {
  id: string;
  kind: string;
  title: string;
  at: string;
  projectId?: string;
}

export interface SyncEmail {
  id: string;
  to: string;
  subject: string;
  status: string;
  at: string;
}

export interface SyncSnapshot {
  pushedAt: string;
  stats: {
    users: number;
    registeredUsers: number;
    demoUsers: number;
    projects: number;
    activeProjects: number;
    criticalProjects: number;
    openAlerts: number;
    budgetTotalCr: number;
    budgetSpentCr: number;
    avgHealth: number;
  };
  users: SyncUser[];
  projects: SyncProject[];
  alerts: SyncAlert[];
  events: SyncEvent[];
  emails: SyncEmail[];
  loginFeed: { id: string; userId: string; userName: string; at: string; ip?: string }[];
}

export interface SyncCommand {
  id: string;
  kind: "broadcast" | "user-alert" | "request-sync" | "announce" | "host-message";
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  linkView?: string;
  audience: "all" | string;
  createdAt: string;
  createdBy: string;
  deliveredTo: string[];
}
