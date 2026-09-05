import type { User, Project, ApprovalItem, AlertItem, AuditEntry, ActivityEvent, PortfolioSnapshot } from "./types";

export const ADMIN_PERSONA: User = {
  id: "u-admin", name: "Chief Programme Officer", email: "cpo@mospi.gov.in", role: "ADMIN", source: "DEMO",
  avatarInitials: "CP", designation: "Chief Programme Officer, MoSPI", department: "IPMD", isActive: true,
  createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
};

export const USERS: User[] = [
  ADMIN_PERSONA,
  { id: "u-pm", name: "Priya Venkatesh", email: "priya.venkatesh@mospi.gov.in", role: "PROJECT_MANAGER", source: "DEMO", avatarInitials: "PV", designation: "Director (Projects), IPMD", department: "IPMD", isActive: true, lastLoginAt: new Date(Date.now() - 3600000).toISOString(), createdAt: new Date(Date.now() - 80 * 86400000).toISOString() },
  { id: "u-analyst", name: "Sneha Iyer", email: "sneha.iyer@mospi.gov.in", role: "STAKEHOLDER", source: "DEMO", avatarInitials: "SI", designation: "Deputy Director (Analysis), IPMD", department: "IPMD", isActive: true, lastLoginAt: new Date(Date.now() - 7200000).toISOString(), createdAt: new Date(Date.now() - 70 * 86400000).toISOString() },
  { id: "u-pmo", name: "Meera Nair", email: "meera.nair@pmo.gov.in", role: "VIEWER", source: "DEMO", avatarInitials: "MN", designation: "Director, PMO Coordination", department: "IPMD", isActive: true, lastLoginAt: new Date(Date.now() - 86400000).toISOString(), createdAt: new Date(Date.now() - 60 * 86400000).toISOString() },
];

const PROJECT_DATA: Array<Partial<Project> & { name: string; psId: string; state: string; sector: string }> = [
  { name: "Bharatmala P-4, Karur–Dindigul Corridor", psId: "BM-P4-KDR", state: "Tamil Nadu", sector: "Transport" },
  { name: "NH-44 Vijayawada–Hyderabad Corridor", psId: "NH-44-VH", state: "Andhra Pradesh", sector: "Transport" },
  { name: "Mumbai Coastal Road Phase 2", psId: "MCR-P2", state: "Maharashtra", sector: "Urban" },
  { name: "Bundelkhand Water Grid", psId: "BWG-BL", state: "Uttar Pradesh", sector: "Water" },
  { name: "Prayagraj ICCC Phase-2", psId: "PICCC-P2", state: "Uttar Pradesh", sector: "Urban" },
  { name: "Delhi-Mumbai Industrial Corridor", psId: "DMIC-CD", state: "Maharashtra", sector: "Industry" },
  { name: "Chenab River Bridge Project", psId: "CRB-JK", state: "Jammu & Kashmir", sector: "Transport" },
  { name: "Kerala Coastal Protection Works", psId: "KCP-KL", state: "Kerala", sector: "Water" },
];

export function buildProjects(): Project[] {
  return PROJECT_DATA.map((d, i) => {
    const sanction = 800 + Math.floor(Math.random() * 1200);
    const spent = Math.floor(sanction * (0.4 + Math.random() * 0.4));
    const projected = Math.floor(spent * (1.05 + Math.random() * 0.2));
    const variance = ((projected - sanction) / sanction) * 100;
    const health = 30 + Math.floor(Math.random() * 60);
    return {
      id: `prj-${String(i + 1).padStart(2, "0")}`,
      psId: d.psId!, name: d.name!, status: "ACTIVE",
      healthScore: health,
      healthStatus: health >= 75 ? "HEALTHY" : health >= 50 ? "AT_RISK" : "CRITICAL",
      totalBudgetL: sanction, spentBudgetL: spent, projectedBudgetL: projected, variancePct: variance,
      progress: 30 + Math.floor(Math.random() * 60),
      department: "IPMD", state: d.state!, sector: d.sector!,
      source: i === 0 ? "FRESH_USER" : "DEMO",
    };
  });
}

export const SEED_APPROVALS: ApprovalItem[] = [
  { id: "ap-1", type: "CHANGE_ORDER", title: "Steel specification upgrade for T-3 viaduct", description: "Replace IS 2062 with high-strength Cor-ten steel for 14 spans. Net cost impact: +₹42 Cr (4.2%).", projectName: "Bharatmala P-4, Karur–Dindigul Corridor", projectPsId: "BM-P4-KDR", raisedBy: "Priya Venkatesh", raisedAt: new Date(Date.now() - 2 * 86400000).toISOString(), status: "PENDING" },
  { id: "ap-2", type: "BUDGET_INCREASE", title: "Land acquisition cost escalation (+18%)", description: "Revenue department revised land rates; ₹87 Cr additional sanction required for Phase-2 acquisition.", projectName: "Bundelkhand Water Grid", projectPsId: "BWG-BL", raisedBy: "Director (Projects)", raisedAt: new Date(Date.now() - 5 * 86400000).toISOString(), status: "PENDING" },
  { id: "ap-3", type: "EXTENSION_OF_TIME", title: "EoT request — 6 months for monsoon recovery", description: "July–Sep 2025 monsoon caused 47 lost working days. Requesting 6-month extension to original target date.", projectName: "Mumbai Coastal Road Phase 2", projectPsId: "MCR-P2", raisedBy: "Project Manager", raisedAt: new Date(Date.now() - 86400000).toISOString(), status: "PENDING" },
  { id: "ap-4", type: "PROCUREMENT", title: "Single-source procurement — tunnel boring machine", description: "TBM model Herrenknecht M-1665 specified by design consultant; request approval for single-source procurement.", projectName: "Chenab River Bridge Project", projectPsId: "CRB-JK", raisedBy: "Procurement Officer", raisedAt: new Date(Date.now() - 3 * 86400000).toISOString(), status: "PENDING" },
];

export const SEED_ALERTS: AlertItem[] = [
  { id: "al-1", severity: "CRITICAL", title: "75% delay probability — 44 days early", description: "AssurePredict 2.3 flags 75% delay probability on Bharatmala P-4. Top factor: steel dispatch stalled (32% weight).", projectName: "Bharatmala P-4, Karur–Dindigul Corridor", projectPsId: "BM-P4-KDR", pathway: "fresh", isRead: false, createdAt: new Date(Date.now() - 3600000).toISOString(), recommendedAction: "Verify steel dispatch with JSW; submit recovery plan.", recommendedOwner: "Director (Projects)", recommendedDeadline: "7 days" },
  { id: "al-2", severity: "HIGH", title: "Budget variance +12.7% over warning threshold", description: "Projected outturn ₹1,012 Cr against sanctioned ₹898 Cr — exceeds 10% warn band.", projectName: "Prayagraj ICCC Phase-2", projectPsId: "PICCC-P2", pathway: "demo", isRead: false, createdAt: new Date(Date.now() - 7200000).toISOString(), recommendedAction: "Review cost breakdown with executive engineer.", recommendedOwner: "Project Manager", recommendedDeadline: "5 days" },
  { id: "al-3", severity: "MEDIUM", title: "5-month statutory approval stale", description: "Environment clearance pending 152 days; statutory SLA is 120 days.", projectName: "Bundelkhand Water Grid", projectPsId: "BWG-BL", pathway: "demo", isRead: false, createdAt: new Date(Date.now() - 18000000).toISOString(), recommendedAction: "Escalate to MoEFCC regional office.", recommendedOwner: "Director (Projects)", recommendedDeadline: "10 days" },
  { id: "al-4", severity: "LOW", title: "Report staleness — 28 days since last field report", description: "Last progress report received 28 days ago; SLA is 14 days.", projectName: "Kerala Coastal Protection Works", projectPsId: "KCP-KL", pathway: "demo", isRead: true, createdAt: new Date(Date.now() - 86400000).toISOString(), recommendedAction: "Email field engineer for update.", recommendedOwner: "Project Manager", recommendedDeadline: "3 days" },
];

export const SEED_ACTIVITY: ActivityEvent[] = [
  { id: "ev-1", kind: "new-alert", title: "Critical delay alert raised on BM-P4-KDR", at: new Date(Date.now() - 3600000).toISOString(), projectId: "prj-01" },
  { id: "ev-2", kind: "prediction-run", title: "AssurePredict 2.3 re-scored portfolio", at: new Date(Date.now() - 7200000).toISOString() },
  { id: "ev-3", kind: "budget-update", title: "Budget variance crossed 10% on PICCC-P2", at: new Date(Date.now() - 10800000).toISOString(), projectId: "prj-05" },
  { id: "ev-4", kind: "document-processed", title: "Field report processed for BWG-BL", at: new Date(Date.now() - 86400000).toISOString(), projectId: "prj-04" },
];

export const SEED_AUDIT: AuditEntry[] = [
  { id: "au-1", action: "LOGIN", entityType: "Session", note: "CPO session established · JWT HS256 · 24h TTL", by: "Chief Programme Officer", at: new Date(Date.now() - 3600000).toISOString() },
  { id: "au-2", action: "PREDICTION_RUN", entityType: "Portfolio", note: "Portfolio re-scored · 8 projects · 18 signals each", by: "system", at: new Date(Date.now() - 7200000).toISOString() },
  { id: "au-3", action: "AI_ACCEPT", entityType: "Alert", note: "Critical alert acknowledged with action note on BM-P4-KDR", by: "Chief Programme Officer", at: new Date(Date.now() - 10800000).toISOString() },
];

export const DEFAULT_THRESHOLDS = { amberAt: 50, redAt: 30, budgetWarnPct: 10, budgetCriticalPct: 20, delayProbEmailAt: 60 };
export const DEFAULT_INTEGRATION = { mainProjectUrl: "https://project-assure.vercel.app", mainProjectReachable: null, aiProviderConnected: false, emailServiceConnected: false, webhookUrl: "", webhookSecret: "", syncActive: true };
export const BUILTIN_AI_STATUS = { connected: false, tier: "built-in", label: "built-in engine · add GEMINI_API_KEY for live answers", model: null };

export function computeSnapshot(projects: Project[], alerts: AlertItem[], approvals: ApprovalItem[]): PortfolioSnapshot {
  const totalProjects = projects.length;
  const freshProjects = projects.filter(p => p.source === "FRESH_USER").length;
  const totalSanctionedL = projects.reduce((s, p) => s + p.totalBudgetL, 0);
  const totalSpentL = projects.reduce((s, p) => s + p.spentBudgetL, 0);
  const totalProjectedL = projects.reduce((s, p) => s + p.projectedBudgetL, 0);
  const openAlerts = alerts.filter(a => !a.isRead).length;
  const pendingApprovals = approvals.filter(a => a.status === "PENDING").length;
  const criticalProjects = projects.filter(p => p.healthStatus === "CRITICAL").length;
  const atRiskProjects = projects.filter(p => p.healthStatus === "AT_RISK").length;
  const healthyProjects = projects.filter(p => p.healthStatus === "HEALTHY").length;
  const avgHealth = totalProjects ? projects.reduce((s, p) => s + p.healthScore, 0) / totalProjects : 0;
  const proportional = totalSanctionedL * 0.6;
  const portfolioVariancePct = proportional > 0 ? ((totalSpentL - proportional) / proportional) * 100 : 0;
  const topRisky = [...projects].sort((a, b) => a.healthScore - b.healthScore).slice(0, 5);
  const topOverruns = [...projects].sort((a, b) => b.variancePct - a.variancePct).slice(0, 5);
  return { totalProjects, freshProjects, totalSanctionedL, totalSpentL, totalProjectedL, openAlerts, pendingApprovals, criticalProjects, atRiskProjects, healthyProjects, avgHealth, portfolioVariancePct, healthBand: { healthy: healthyProjects, atRisk: atRiskProjects, critical: criticalProjects }, topRisky, topOverruns };
}
