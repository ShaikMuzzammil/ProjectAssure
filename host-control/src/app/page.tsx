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
  const { currentView, hydrate } = useAdminStore();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [syncRes, aiRes] = await Promise.all([fetch("/api/admin/sync", { cache: "no-store" }), fetch("/api/ai/status", { cache: "no-store" })]);
        const syncJson = await syncRes.json();
        if (active) hydrate(syncJson);
        const aiJson = await aiRes.json();
        if (active) useAdminStore.getState().setAiStatus(aiJson);
      } catch {}
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
      {currentView === "demo" && <DemoShowcase />}
      {currentView === "audit" && <AuditTrail />}
    </AppShell>
  );
}
