"use client";
import { create } from "zustand";
import type {
  User,
  Project,
  ApprovalItem,
  AlertItem,
  AuditEntry,
  ActivityEvent,
  EmailItem,
  WebhookReceipt,
  PortfolioSnapshot,
  HostViewId,
  ChatMessage,
  AiProviderStatus,
  IntegrationStatus,
} from "@/lib/host/types";

// v21: expanded store — includes emails + webhooks slices for the Email Centre
// and Security & Audit views. hydrate() pulls everything from /api/admin/sync.
interface AdminState {
  currentView: HostViewId;
  snapshot: PortfolioSnapshot | null;
  users: User[];
  projects: Project[];
  approvals: ApprovalItem[];
  alerts: AlertItem[];
  audit: AuditEntry[];
  activity: ActivityEvent[];
  emails: EmailItem[];
  webhooks: WebhookReceipt[];
  aiStatus: AiProviderStatus | null;
  integration: IntegrationStatus | null;
  chatMessages: ChatMessage[];
  lastSyncAt: string | null;
  // v21: detail panel state (used by User Management + Project Vault)
  selectedUserId: string | null;
  selectedProjectId: string | null;
  setView: (v: HostViewId) => void;
  hydrate: (data: any) => void;
  setAiStatus: (s: AiProviderStatus) => void;
  setIntegration: (i: IntegrationStatus) => void;
  addChatMessage: (m: ChatMessage) => void;
  setSelectedUser: (id: string | null) => void;
  setSelectedProject: (id: string | null) => void;
  forceSync: () => Promise<void>;
}

export const useAdminStore = create<AdminState>((set, get) => ({
  currentView: "dashboard",
  snapshot: null,
  users: [],
  projects: [],
  approvals: [],
  alerts: [],
  audit: [],
  activity: [],
  emails: [],
  webhooks: [],
  aiStatus: null,
  integration: null,
  chatMessages: [],
  lastSyncAt: null,
  selectedUserId: null,
  selectedProjectId: null,
  setView: (v) => set({ currentView: v }),
  hydrate: (data) =>
    set({
      snapshot: data.snapshot ?? null,
      users: data.users ?? [],
      projects: data.projects ?? [],
      approvals: data.approvals ?? [],
      alerts: data.alerts ?? [],
      audit: data.audit ?? [],
      activity: data.activity ?? [],
      emails: data.emails ?? [],
      webhooks: data.webhooks ?? [],
      integration: data.integration ?? get().integration,
      aiStatus: data.aiStatus ?? get().aiStatus,
      lastSyncAt: new Date().toISOString(),
    }),
  setAiStatus: (s) => set({ aiStatus: s }),
  setIntegration: (i) => set({ integration: i }),
  addChatMessage: (m) => set((st) => ({ chatMessages: [...st.chatMessages, m].slice(-30) })),
  setSelectedUser: (id) => set({ selectedUserId: id }),
  setSelectedProject: (id) => set({ selectedProjectId: id }),
  forceSync: async () => {
    try {
      // Fire-and-forget the force-sync call so the server polls the main app
      fetch("/api/admin/force-sync", { method: "POST" }).catch(() => {});
      const r = await fetch("/api/admin/sync", { cache: "no-store" });
      const j = await r.json();
      get().hydrate(j);
    } catch {
      /* best effort */
    }
  },
}));
