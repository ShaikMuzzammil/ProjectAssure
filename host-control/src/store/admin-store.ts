"use client";
import { create } from "zustand";
import type { User, Project, ApprovalItem, AlertItem, AuditEntry, ActivityEvent, PortfolioSnapshot, HostViewId, ChatMessage, AiProviderStatus, IntegrationStatus } from "@/lib/host/types";

interface AdminState {
  currentView: HostViewId;
  snapshot: PortfolioSnapshot | null;
  users: User[]; projects: Project[]; approvals: ApprovalItem[]; alerts: AlertItem[]; audit: AuditEntry[]; activity: ActivityEvent[];
  aiStatus: AiProviderStatus | null;
  integration: IntegrationStatus | null;
  chatMessages: ChatMessage[];
  lastSyncAt: string | null;
  setView: (v: HostViewId) => void;
  hydrate: (data: any) => void;
  setAiStatus: (s: AiProviderStatus) => void;
  setIntegration: (i: IntegrationStatus) => void;
  addChatMessage: (m: ChatMessage) => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  currentView: "dashboard",
  snapshot: null, users: [], projects: [], approvals: [], alerts: [], audit: [], activity: [],
  aiStatus: null, integration: null, chatMessages: [], lastSyncAt: null,
  setView: (v) => set({ currentView: v }),
  hydrate: (data) => set({
    snapshot: data.snapshot ?? null, users: data.users ?? [], projects: data.projects ?? [],
    approvals: data.approvals ?? [], alerts: data.alerts ?? [], audit: data.audit ?? [], activity: data.activity ?? [],
    lastSyncAt: new Date().toISOString(),
  }),
  setAiStatus: (s) => set({ aiStatus: s }),
  setIntegration: (i) => set({ integration: i }),
  addChatMessage: (m) => set((st) => ({ chatMessages: [...st.chatMessages, m].slice(-30) })),
}));
