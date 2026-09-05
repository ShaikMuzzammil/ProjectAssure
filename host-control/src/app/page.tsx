"use client";

import { useEffect } from "react";
import { AppShell } from "@/components/host/app-shell";
import { MissionDashboard } from "@/components/host/mission-dashboard";
import { ApprovalCentre } from "@/components/host/approval-centre";
import { BudgetRisk } from "@/components/host/budget-risk";
import { AlertsFeed } from "@/components/host/alerts-feed";
import { UserManagement } from "@/components/host/user-management";
import { IntelligenceConsole } from "@/components/host/intelligence-console";
import { Integrations } from "@/components/host/integrations";
import { DemoShowcase } from "@/components/host/demo-showcase";
import { AuditTrail } from "@/components/host/audit-trail";
import { useAdminStore } from "@/store/admin-store";

export default function HomePage() {
  const { currentView, hydrate, aiStatus } = useAdminStore();

  // ─── One-shot AI status probe on first load ─────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/ai/status", { cache: "no-store" });
        const json = await res.json();
        if (active) useAdminStore.getState().setAiStatus(json);
      } catch {
        /* silent */
      }
    })();
    return () => { active = false; };
  }, []);

  // ─── Initial sync hydrate (the AppShell polls every 5s after this) ──────
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/sync", { cache: "no-store" });
        const json = await res.json();
        if (active) hydrate(json);
      } catch {
        /* silent — AppShell retry loop will pick it up */
      }
    })();
    return () => { active = false; };
  }, [hydrate]);

  return (
    <AppShell>
      {currentView === "dashboard" && <MissionDashboard />}
      {currentView === "approvals" && <ApprovalCentre />}
      {currentView === "budget-risk" && <BudgetRisk />}
      {currentView === "alerts" && <AlertsFeed />}
      {currentView === "users" && <UserManagement />}
      {currentView === "intelligence" && <IntelligenceConsole />}
      {currentView === "integrations" && <Integrations />}
      {currentView === "audit" && <AuditTrail />}
      {currentView === "demo" && <DemoShowcase />}
    </AppShell>
  );
}
