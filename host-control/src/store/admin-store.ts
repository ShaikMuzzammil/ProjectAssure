"use client";
// ProjectAssure Host Control — Zustand client store.
// Hydrates from the server's /api/admin/sync payload on first load, then
// polls every 5s. Holds the entire portfolio in memory for instant UI.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PortfolioSnapshot } from "@/lib/host/seed";
import type {
  User, Project, ApprovalItem, AlertItem, AuditEntry, ActivityEvent,
  BudgetThresholds, IntegrationStatus, AiProviderStatus,
  HostViewId, ChatMessage,
} from "@/lib/host/types";

interface AdminState {
  // server-synced data
  snapshot: PortfolioSnapshot | null;
  users: User[];
  projects: Project[];
  approvals: ApprovalItem[];
  alerts: AlertItem[];
  activity: ActivityEvent[];
  audit: AuditEntry[];
  thresholds: BudgetThresholds;
  integration: IntegrationStatus | null;
  aiStatus: AiProviderStatus | null;
  lastResyncAt: string | null;
  admin: User | null;
  lastSyncAt: string | null;
  syncActive: boolean;

  // UI state
  currentView: HostViewId;
  theme: "light" | "dark";

  // intelligence console (transient, not persisted)
  chat: ChatMessage[];
  universalMode: boolean;
  aiTemperature: number;
  aiMaxTokens: number;
  aiModel: string;

  // actions
  setView: (v: HostViewId) => void;
  hydrate: (payload: any) => void;
  setSyncActive: (v: boolean) => void;
  setThresholds: (t: BudgetThresholds) => void;
  setIntegration: (patch: Partial<IntegrationStatus>) => void;
  setAiStatus: (s: AiProviderStatus) => void;
  pushAudit: (entry: AuditEntry) => void;
  pushActivity: (ev: ActivityEvent) => void;
  pushApproval: (a: ApprovalItem) => void;
  pushAlert: (a: AlertItem) => void;
  ackAlert: (id: string, ackBy: string) => void;
  pushUser: (u: User) => void;
  addChatMessage: (m: ChatMessage) => void;
  clearChat: () => void;
  setUniversalMode: (v: boolean) => void;
  setAiSettings: (patch: Partial<{ temperature: number; maxTokens: number; model: string }>) => void;
}

export const useAdminStore = create<AdminState>()(
  persist(
    (set, get) => ({
      snapshot: null,
      users: [],
      projects: [],
      approvals: [],
      alerts: [],
      activity: [],
      audit: [],
      thresholds: { amberPct: 10, redPct: 25, warnPct: 5 },
      integration: null,
      aiStatus: null,
      lastResyncAt: null,
      admin: null,
      lastSyncAt: null,
      syncActive: false,

      currentView: "dashboard",
      theme: "light",

      chat: [],
      universalMode: false,
      aiTemperature: 0.15,
      aiMaxTokens: 550,
      aiModel: "auto",

      setView: (v) => set({ currentView: v }),

      hydrate: (payload) => set({
        snapshot: payload.snapshot ?? null,
        users: payload.users ?? [],
        projects: payload.projects ?? [],
        approvals: payload.approvals ?? [],
        alerts: payload.alerts ?? [],
        activity: payload.activity ?? [],
        audit: payload.audit ?? [],
        thresholds: payload.thresholds ?? get().thresholds,
        integration: payload.integration ?? null,
        aiStatus: payload.aiStatus ?? null,
        lastResyncAt: payload.lastResyncAt ?? null,
        admin: payload.admin ?? null,
        lastSyncAt: payload.serverTime ?? new Date().toISOString(),
      }),

      setSyncActive: (v) => set({ syncActive: v }),

      setThresholds: (t) => set({ thresholds: t }),
      setIntegration: (patch) => set((s) => ({ integration: { ...(s.integration ?? ({} as any)), ...patch } })),
      setAiStatus: (s) => set({ aiStatus: s }),

      pushAudit: (entry) => set((s) => ({ audit: [entry, ...s.audit].slice(0, 500) })),
      pushActivity: (ev) => set((s) => ({ activity: [ev, ...s.activity].slice(0, 50) })),

      pushApproval: (a) => set((s) => {
        const idx = s.approvals.findIndex(x => x.id === a.id);
        const next = [...s.approvals];
        if (idx >= 0) next[idx] = a; else next.unshift(a);
        return { approvals: next };
      }),
      pushAlert: (al) => set((s) => ({ alerts: [al, ...s.alerts].slice(0, 200) })),
      ackAlert: (id, ackBy) => set((s) => ({
        alerts: s.alerts.map(a => a.id === id ? {
          ...a, isRead: true,
          acknowledgedBy: ackBy,
          acknowledgedAt: new Date().toISOString(),
        } : a),
      })),

      pushUser: (u) => set((s) => ({ users: [u, ...s.users] })),

      addChatMessage: (m) => set((s) => ({ chat: [...s.chat, m] })),
      clearChat: () => set({ chat: [] }),
      setUniversalMode: (v) => set({ universalMode: v }),
      setAiSettings: (patch) => set((s) => ({
        aiTemperature: patch.temperature ?? s.aiTemperature,
        aiMaxTokens: patch.maxTokens ?? s.aiMaxTokens,
        aiModel: patch.model ?? s.aiModel,
      })),
    }),
    {
      name: "pa-host-control-v1",
      // Only persist user preferences, not the mirrored portfolio data (which
      // gets re-hydrated from the server every load).
      partialize: (s) => ({
        currentView: s.currentView,
        theme: s.theme,
        universalMode: s.universalMode,
        aiTemperature: s.aiTemperature,
        aiMaxTokens: s.aiMaxTokens,
        aiModel: s.aiModel,
        chat: s.chat.slice(0, 50),
      } as any),
    },
  ),
);
