"use client";

import { create } from "zustand";
import type { Project, User, ViewId } from "@/lib/projectassure/types";
import { getProjects } from "@/lib/projectassure/engine";

interface AppState {
  /* auth / role */
  user: User | null;
  login: (u: User) => void;
  logout: () => void;
  /* navigation */
  view: ViewId;
  selectedProjectId: string | null;
  detailTab: string;
  navigate: (v: ViewId) => void;
  openProject: (id: string, tab?: string) => void;
  setDetailTab: (t: string) => void;

  /* data */
  projects: Project[];
  markAlertRead: (projectId: string, alertId: string) => void;
  markAllRead: () => void;
  addProject: (name: string, departmentId: string, sector: string, budget: number) => Project;

  /* ui */
  aiOpen: boolean;
  setAiOpen: (v: boolean) => void;
  aiProjectContext: string | null;
  askAi: (question: string) => void;
  aiSeedQuestion: string | null;
  clearAiSeed: () => void;

  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  login: (u) => set({ user: u, projects: getProjects() }),
  logout: () => set({ user: null, view: "dashboard" }),

  view: "dashboard",
  selectedProjectId: null,
  detailTab: "overview",
  navigate: (v) => set({ view: v, selectedProjectId: v === "project-detail" ? get().selectedProjectId : null }),
  openProject: (id, tab) => set({ view: "project-detail", selectedProjectId: id, detailTab: tab ?? "overview" }),
  setDetailTab: (t) => set({ detailTab: t }),

  projects: [],
  markAlertRead: (projectId, alertId) =>
    set({
      projects: get().projects.map((p) =>
        p.id === projectId
          ? { ...p, alerts: p.alerts.map((a) => (a.id === alertId ? { ...a, isRead: true } : a)) }
          : p
      ),
    }),
  markAllRead: () =>
    set({
      projects: get().projects.map((p) => ({
        ...p,
        alerts: p.alerts.map((a) => ({ ...a, isRead: true })),
      })),
    }),
  addProject: (name, departmentId, sector, budget) => {
    const p: Project = {
      id: `prj-new-${Date.now()}`,
      psId: `PRJ-2026-${String(900 + Math.floor(Math.random() * 99))}`,
      name,
      description: `${sector} project registered via ProjectAssure quick-create wizard.`,
      status: "PLANNING",
      departmentId,
      sector,
      scheme: "New Scheme",
      state: "Delhi",
      district: "New Delhi",
      latitude: 28.6139,
      longitude: 77.209,
      startDate: new Date().toISOString(),
      targetDate: new Date(Date.now() + 365 * 86400000).toISOString(),
      progress: 0,
      totalBudget: budget,
      spentBudget: 0,
      projectedBudget: budget,
      healthScore: 95,
      healthStatus: "HEALTHY",
      scheduleScore: 95, budgetScore: 95, resourceScore: 95, milestoneScore: 95,
      healthComputedAt: new Date().toISOString(),
      projectManager: get().user?.name ?? "Unassigned",
      contractor: "TBD",
      milestones: [], tasks: [], budgetRecords: [], resources: [], documents: [], alerts: [], auditTrail: [],
    };
    set({ projects: [p, ...get().projects] });
    return p;
  },

  aiOpen: false,
  setAiOpen: (v) => set({ aiOpen: v }),
  aiProjectContext: null,
  askAi: (question) => set({ aiOpen: true, aiSeedQuestion: question }),
  aiSeedQuestion: null,
  clearAiSeed: () => set({ aiSeedQuestion: null }),

  paletteOpen: false,
  setPaletteOpen: (v) => set({ paletteOpen: v }),
}));
