// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure Host Control — Deterministic seed world
// Frozen at the SIH pitch day (ANCHOR, 10 Sep 2026) so every number in the
// host-control dashboard matches the prototype's jury-script on every reload.
//
// Mirrors the prototype's seed (mulberry32(42)) at the portfolio level — every
// project, persona and alert here has a counterpart in the main ProjectAssure
// prototype, so the host-control can present an aggregated portfolio view
// without copying the full deterministic engine.
// ═══════════════════════════════════════════════════════════════════════════
import type {
  Project, Department, User, ApprovalItem, AlertItem, AuditEntry,
  ActivityEvent, BudgetThresholds, IntegrationStatus, AiProviderStatus,
} from "./types";

export const ANCHOR = new Date("2026-09-10T10:00:00+05:30");

// ─── Departments ─────────────────────────────────────────────────────────────
export const DEPARTMENTS: Department[] = [
  { id: "dept-ipmd", name: "Infrastructure & Project Monitoring Division", code: "IPMD", ministry: "MoSPI" },
  { id: "dept-nat", name: "National Accounts Division", code: "NASD", ministry: "MoSPI" },
  { id: "dept-soc", name: "Social Statistics Division", code: "SOSD", ministry: "MoSPI" },
  { id: "dept-eco", name: "Economic Statistics Division", code: "ECSD", ministry: "MoSPI" },
  { id: "dept-cb", name: "Capacity Building Division", code: "CAPB", ministry: "MoSPI" },
];

export function deptName(id: string): string {
  return DEPARTMENTS.find(d => d.id === id)?.name ?? id;
}
export function deptCode(id: string): string {
  return DEPARTMENTS.find(d => d.id === id)?.code ?? id;
}

// ─── Users (mirror the prototype's 4 personas) ────────────────────────────────
const MONTH = 30.4 * 86400000;
const shiftMonths = (d: Date, m: number) => new Date(d.getTime() + m * MONTH);
const shiftDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

export const ADMIN_PERSONA: User = {
  id: "u-cpo",
  name: "Arun Kulkarni",
  email: "arun.kulkarni@mospi.gov.in",
  role: "ADMIN",
  departmentId: "dept-ipmd",
  avatarInitials: "AK",
  designation: "Chief Programme Officer, MoSPI",
  persona: "Chief Programme Officer (Host)",
  personaDescription: "Watches 1,800+ central-sector projects from the host domain. Triage in seconds, sign off on every change order, broadcast alerts across the ministry.",
  phone: "+91 98200 11223",
  isActive: true,
  source: "DEMO",
  lastLoginAt: shiftDays(ANCHOR, -1).toISOString(),
  createdAt: shiftMonths(ANCHOR, -14).toISOString(),
};

export const USERS: User[] = [
  ADMIN_PERSONA,
  {
    id: "u-sec",
    name: "Arun Kulkarni",
    email: "arun.kulkarni@mospi.gov.in",
    role: "ADMIN",
    departmentId: "dept-ipmd",
    avatarInitials: "AK",
    designation: "Joint Secretary, MoSPI",
    persona: "The Portfolio Overseer",
    personaDescription: "Watches 1,800+ central-sector projects. Needs triage in seconds, not spreadsheets.",
    phone: "+91 98200 11223",
    isActive: true,
    source: "DEMO",
    lastLoginAt: shiftDays(ANCHOR, -1).toISOString(),
    createdAt: shiftMonths(ANCHOR, -14).toISOString(),
  },
  {
    id: "u-pm",
    name: "Priya Venkatesh",
    email: "priya.venkatesh@mospi.gov.in",
    role: "PROJECT_MANAGER",
    departmentId: "dept-ipmd",
    avatarInitials: "PV",
    designation: "Director (Projects), IPMD",
    persona: "The Ministry Project Manager",
    personaDescription: "Owns 10 transport & urban projects. Lives in milestones, burn charts and alerts.",
    phone: "+91 98400 44551",
    isActive: true,
    source: "DEMO",
    lastLoginAt: shiftDays(ANCHOR, -2).toISOString(),
    createdAt: shiftMonths(ANCHOR, -13).toISOString(),
  },
  {
    id: "u-analyst",
    name: "Sneha Iyer",
    email: "sneha.iyer@mospi.gov.in",
    role: "STAKEHOLDER",
    departmentId: "dept-ipmd",
    avatarInitials: "SI",
    designation: "Deputy Director (Analysis), IPMD",
    persona: "The MoSPI Data Analyst",
    personaDescription: "Converts 27,000 monthly pages into decisions; depends on exports & summaries.",
    phone: "+91 99400 33456",
    isActive: true,
    source: "DEMO",
    lastLoginAt: shiftDays(ANCHOR, -3).toISOString(),
    createdAt: shiftMonths(ANCHOR, -11).toISOString(),
  },
  {
    id: "u-pmo",
    name: "Meera Nair",
    email: "meera.nair@pmo.gov.in",
    role: "VIEWER",
    departmentId: "dept-ipmd",
    avatarInitials: "MN",
    designation: "Director, PMO Coordination",
    persona: "The Strategic Observer",
    personaDescription: "Read-only flagship view for PMO/Cabinet briefings; asks 'what changed this week?'.",
    phone: "+91 97110 55321",
    isActive: true,
    source: "DEMO",
    lastLoginAt: shiftDays(ANCHOR, -5).toISOString(),
    createdAt: shiftMonths(ANCHOR, -9).toISOString(),
  },
];

// ─── Portfolio — 30 demo projects (compact portfolio view) ───────────────────
interface PDef {
  id: string; name: string; status: Project["status"];
  h: number; hs: Project["healthStatus"];
  sched: number; bud: number; res: number; mil: number;
  startAgoM: number; dur: number; progress: number;
  budgetL: number; spentPct: number; projPct: number;
  state: string; district: string; sector: string; scheme: string;
  dept: string; pm: string; contractor: string;
  variancePct: number; delayDays: number; source?: "DEMO" | "FRESH_USER";
}

export const PROJECT_DEFS: PDef[] = [
  // 4 story projects (grounded in the prototype's seed numbers)
  { id: "p-bm4", name: "Bharatmala P-4 · TN-04 Corridor Upgrade (Karur–Dindigul)", status: "ACTIVE", h: 42, hs: "CRITICAL", sched: 35, bud: 48, res: 41, mil: 38, startAgoM: 22.4, dur: 28, progress: 58, budgetL: 145000, spentPct: 71, projPct: 78, state: "Tamil Nadu", district: "Karur", sector: "Roads", scheme: "Bharatmala Pariyojana", dept: "dept-ipmd", pm: "Priya Venkatesh", contractor: "L&T Infrastructure", variancePct: 13, delayDays: 44, source: "DEMO" },
  { id: "p-iccc2", name: "Integrated Command & Control Centre, Prayagraj (Phase 2)", status: "ACTIVE", h: 61, hs: "AT_RISK", sched: 58, bud: 52, res: 67, mil: 60, startAgoM: 17, dur: 24, progress: 55, budgetL: 42500, spentPct: 68, projPct: 76, state: "Uttar Pradesh", district: "Prayagraj", sector: "Urban", scheme: "Smart Cities Mission", dept: "dept-ipmd", pm: "Ananya Krishnan", contractor: "Tata Projects", variancePct: 12.7, delayDays: 21, source: "DEMO" },
  { id: "p-jj-bundelkhand", name: "Jal Jeevan Rural Water Grid, Bundelkhand Cluster (MP)", status: "ACTIVE", h: 33, hs: "CRITICAL", sched: 28, bud: 36, res: 32, mil: 30, startAgoM: 17.4, dur: 30, progress: 31, budgetL: 98000, spentPct: 42, projPct: 55, state: "Madhya Pradesh", district: "Chhatarpur", sector: "Water", scheme: "Jal Jeevan Mission", dept: "dept-soc", pm: "Ravi Menon", contractor: "Afcons Infrastructure", variancePct: 18, delayDays: 64, source: "DEMO" },
  { id: "p-nh44", name: "NH-44 Bypass, Krishnagiri (Package KRN-02)", status: "ACTIVE", h: 64, hs: "AT_RISK", sched: 60, bud: 58, res: 70, mil: 62, startAgoM: 21.6, dur: 30, progress: 58, budgetL: 31200, spentPct: 64, projPct: 70, state: "Tamil Nadu", district: "Krishnagiri", sector: "Roads", scheme: "NHAI Annual Plan", dept: "dept-ipmd", pm: "Rahul Sharma", contractor: "GR Infraprojects", variancePct: 8, delayDays: 18, source: "DEMO" },
  // 26 portfolio projects
  { id: "p-varanasi-stp", name: "Varanasi Sewage Treatment Plant (140 MLD)", status: "COMPLETED", h: 95, hs: "HEALTHY", sched: 96, bud: 98, res: 94, mil: 95, startAgoM: 24, dur: 22, progress: 100, budgetL: 18600, spentPct: 96, projPct: 96, state: "Uttar Pradesh", district: "Varanasi", sector: "Water", scheme: "Namami Gange", dept: "dept-soc", pm: "Ravi Menon", contractor: "NCC Ltd", variancePct: -2, delayDays: 0, source: "DEMO" },
  { id: "p-pmshri-chennai", name: "PM SHRI Schools Modernisation, Chennai Block", status: "ACTIVE", h: 82, hs: "HEALTHY", sched: 84, bud: 86, res: 80, mil: 82, startAgoM: 11, dur: 16, progress: 68, budgetL: 7800, spentPct: 60, projPct: 62, state: "Tamil Nadu", district: "Chennai", sector: "Education", scheme: "PM SHRI", dept: "dept-cb", pm: "Divya Pillai", contractor: "Dilip Buildcon", variancePct: -3, delayDays: 2, source: "DEMO" },
  { id: "p-aiims-madurai", name: "AIIMS Satellite Diagnostic Wing, Madurai", status: "ACTIVE", h: 74, hs: "HEALTHY", sched: 75, bud: 72, res: 76, mil: 74, startAgoM: 16, dur: 26, progress: 61, budgetL: 32500, spentPct: 58, projPct: 60, state: "Tamil Nadu", district: "Madurai", sector: "Health", scheme: "PM ABIM", dept: "dept-soc", pm: "Karthik Subramanian", contractor: "IRCON International", variancePct: -1, delayDays: 3, source: "DEMO" },
  { id: "p-mum-metro4", name: "Mumbai Metro Line-4 Depot, Ghatkopar", status: "ACTIVE", h: 68, hs: "AT_RISK", sched: 65, bud: 70, res: 68, mil: 66, startAgoM: 13, dur: 30, progress: 43, budgetL: 87400, spentPct: 51, projPct: 56, state: "Maharashtra", district: "Mumbai", sector: "Infrastructure", scheme: "MMRDA Urban Transport", dept: "dept-ipmd", pm: "Priya Venkatesh", contractor: "L&T Infrastructure", variancePct: 7, delayDays: 12, source: "DEMO" },
  { id: "p-blr-suburban", name: "Bengaluru Suburban Rail — Hebbal Flyover Package", status: "ACTIVE", h: 78, hs: "HEALTHY", sched: 80, bud: 76, res: 78, mil: 78, startAgoM: 17, dur: 28, progress: 58, budgetL: 52300, spentPct: 56, projPct: 58, state: "Karnataka", district: "Bengaluru", sector: "Infrastructure", scheme: "K-RIDE", dept: "dept-ipmd", pm: "Ravi Menon", contractor: "PNC Infratech", variancePct: 2, delayDays: 4, source: "DEMO" },
  { id: "p-cbe-bus", name: "Coimbatore Bus Terminal Redevelopment (Vellalore)", status: "ON_HOLD", h: 52, hs: "AT_RISK", sched: 50, bud: 56, res: 48, mil: 52, startAgoM: 15, dur: 20, progress: 52, budgetL: 15600, spentPct: 48, projPct: 52, state: "Tamil Nadu", district: "Coimbatore", sector: "Urban", scheme: "Smart Cities Mission", dept: "dept-eco", pm: "Ananya Krishnan", contractor: "Dilip Buildcon", variancePct: 4, delayDays: 8, source: "DEMO" },
  { id: "p-surat-flood", name: "Surat Flood Resilience Grid, Phase-1", status: "PLANNING", h: 88, hs: "HEALTHY", sched: 90, bud: 86, res: 88, mil: 90, startAgoM: 1.2, dur: 26, progress: 4, budgetL: 26900, spentPct: 4, projPct: 4, state: "Gujarat", district: "Surat", sector: "Water", scheme: "AMRUT 2.0", dept: "dept-eco", pm: "Divya Pillai", contractor: "Afcons Infrastructure", variancePct: 0, delayDays: 0, source: "DEMO" },
  { id: "p-tvm-class", name: "Smart Classrooms Rollout, Thiruvananthapuram", status: "ACTIVE", h: 85, hs: "HEALTHY", sched: 86, bud: 84, res: 86, mil: 85, startAgoM: 9, dur: 14, progress: 64, budgetL: 5400, spentPct: 62, projPct: 64, state: "Kerala", district: "Thiruvananthapuram", sector: "Education", scheme: "PM SHRI", dept: "dept-cb", pm: "Divya Pillai", contractor: "NCC Ltd", variancePct: -1, delayDays: 1, source: "DEMO" },
  { id: "p-warangal-hosp", name: "District Hospital Upgradation, Warangal", status: "ACTIVE", h: 79, hs: "HEALTHY", sched: 80, bud: 78, res: 80, mil: 79, startAgoM: 12, dur: 18, progress: 55, budgetL: 12900, spentPct: 54, projPct: 56, state: "Telangana", district: "Warangal", sector: "Health", scheme: "PM ABIM", dept: "dept-soc", pm: "Karthik Subramanian", contractor: "Tata Projects", variancePct: -2, delayDays: 2, source: "DEMO" },
  { id: "p-kol-storm", name: "Kolkata East-West Stormwater Drains", status: "ACTIVE", h: 76, hs: "HEALTHY", sched: 78, bud: 74, res: 76, mil: 76, startAgoM: 15, dur: 24, progress: 62, budgetL: 21300, spentPct: 60, projPct: 62, state: "West Bengal", district: "Kolkata", sector: "Water", scheme: "AMRUT 2.0", dept: "dept-eco", pm: "Ananya Krishnan", contractor: "GR Infraprojects", variancePct: 0, delayDays: 3, source: "DEMO" },
  { id: "p-del-waste", name: "Delhi SARAS Waste-to-Energy, Narela", status: "ACTIVE", h: 72, hs: "HEALTHY", sched: 74, bud: 70, res: 72, mil: 72, startAgoM: 18, dur: 28, progress: 66, budgetL: 38700, spentPct: 64, projPct: 66, state: "Delhi", district: "New Delhi", sector: "Urban", scheme: "Swachh Bharat 2.0", dept: "dept-eco", pm: "Priya Venkatesh", contractor: "PNC Infratech", variancePct: 3, delayDays: 5, source: "DEMO" },
  { id: "p-gq-safety", name: "Golden Quadrilateral Safety Package, Pune–Bengaluru", status: "ACTIVE", h: 84, hs: "HEALTHY", sched: 86, bud: 82, res: 84, mil: 84, startAgoM: 10, dur: 15, progress: 71, budgetL: 9600, spentPct: 70, projPct: 72, state: "Maharashtra", district: "Pune", sector: "Roads", scheme: "NHAI Safety Corpus", dept: "dept-ipmd", pm: "Rahul Sharma", contractor: "IRCON International", variancePct: -1, delayDays: 1, source: "DEMO" },
  { id: "p-imphal-water", name: "North Eastern District Water Supply, Imphal East", status: "ACTIVE", h: 80, hs: "HEALTHY", sched: 82, bud: 78, res: 80, mil: 80, startAgoM: 13, dur: 20, progress: 58, budgetL: 7400, spentPct: 56, projPct: 58, state: "Manipur", district: "Imphal", sector: "Water", scheme: "Jal Jeevan Mission", dept: "dept-soc", pm: "Ravi Menon", contractor: "Dilip Buildcon", variancePct: 0, delayDays: 2, source: "DEMO" },
  { id: "p-dantewada-schl", name: "Tribal School Infrastructure, Dantewada", status: "ACTIVE", h: 83, hs: "HEALTHY", sched: 84, bud: 82, res: 84, mil: 83, startAgoM: 11, dur: 18, progress: 60, budgetL: 6800, spentPct: 58, projPct: 60, state: "Chhattisgarh", district: "Dantewada", sector: "Education", scheme: "Eklavya Model Schools", dept: "dept-cb", pm: "Divya Pillai", contractor: "NCC Ltd", variancePct: -1, delayDays: 1, source: "DEMO" },
  { id: "p-jaipur-ring", name: "Jaipur Ring Road Signage & ITS Corridor", status: "ACTIVE", h: 77, hs: "HEALTHY", sched: 78, bud: 76, res: 78, mil: 77, startAgoM: 14, dur: 20, progress: 63, budgetL: 14200, spentPct: 62, projPct: 64, state: "Rajasthan", district: "Jaipur", sector: "Roads", scheme: "Bharatmala Pariyojana", dept: "dept-ipmd", pm: "Priya Venkatesh", contractor: "GR Infraprojects", variancePct: 1, delayDays: 2, source: "DEMO" },
  { id: "p-bhopal-poles", name: "Bhopal Smart Poles & City Wi-Fi Mesh", status: "ACTIVE", h: 81, hs: "HEALTHY", sched: 82, bud: 80, res: 82, mil: 81, startAgoM: 12, dur: 16, progress: 69, budgetL: 8900, spentPct: 64, projPct: 66, state: "Madhya Pradesh", district: "Bhopal", sector: "Urban", scheme: "Smart Cities Mission", dept: "dept-eco", pm: "Ananya Krishnan", contractor: "Tata Projects", variancePct: -1, delayDays: 1, source: "DEMO" },
  { id: "p-kochi-metro3", name: "Kochi Water Metro Terminal-3, Kakkanad", status: "ACTIVE", h: 78, hs: "HEALTHY", sched: 80, bud: 76, res: 78, mil: 78, startAgoM: 16, dur: 22, progress: 59, budgetL: 19800, spentPct: 58, projPct: 60, state: "Kerala", district: "Ernakulam", sector: "Infrastructure", scheme: "Kochi Water Metro", dept: "dept-ipmd", pm: "Rahul Sharma", contractor: "Afcons Infrastructure", variancePct: 0, delayDays: 2, source: "DEMO" },
  { id: "p-nagpur-depot", name: "Nagpur Metro Depot Electrification", status: "ACTIVE", h: 76, hs: "HEALTHY", sched: 78, bud: 74, res: 76, mil: 76, startAgoM: 19, dur: 26, progress: 64, budgetL: 44100, spentPct: 62, projPct: 64, state: "Maharashtra", district: "Nagpur", sector: "Infrastructure", scheme: "MAHA Metro", dept: "dept-ipmd", pm: "Priya Venkatesh", contractor: "L&T Infrastructure", variancePct: 1, delayDays: 3, source: "DEMO" },
  { id: "p-bbsr-awaas", name: "Bhubaneswar Affordable Housing Cluster, Patia", status: "ACTIVE", h: 79, hs: "HEALTHY", sched: 80, bud: 78, res: 80, mil: 79, startAgoM: 14, dur: 24, progress: 61, budgetL: 16700, spentPct: 58, projPct: 60, state: "Odisha", district: "Khordha", sector: "Urban", scheme: "PM Awas Yojana (U)", dept: "dept-eco", pm: "Ananya Krishnan", contractor: "PNC Infratech", variancePct: 0, delayDays: 2, source: "DEMO" },
  { id: "p-hyd-phc", name: "Hyderabad Primary Health Centres Digital Stack", status: "ACTIVE", h: 82, hs: "HEALTHY", sched: 84, bud: 80, res: 82, mil: 82, startAgoM: 12, dur: 18, progress: 66, budgetL: 9200, spentPct: 60, projPct: 62, state: "Telangana", district: "Hyderabad", sector: "Health", scheme: "Ayushman Bharat Digital", dept: "dept-soc", pm: "Karthik Subramanian", contractor: "Dilip Buildcon", variancePct: -1, delayDays: 1, source: "DEMO" },
  { id: "p-amritsar-lake", name: "Amritsar Green Belt & Lake Restoration", status: "ACTIVE", h: 84, hs: "HEALTHY", sched: 86, bud: 82, res: 84, mil: 84, startAgoM: 13, dur: 16, progress: 57, budgetL: 6100, spentPct: 56, projPct: 58, state: "Punjab", district: "Amritsar", sector: "Urban", scheme: "AMRUT 2.0", dept: "dept-eco", pm: "Divya Pillai", contractor: "NCC Ltd", variancePct: 0, delayDays: 1, source: "DEMO" },
  { id: "p-srinagar-spillway", name: "Srinagar Flood Spillway, Jhelum Basin", status: "ACTIVE", h: 71, hs: "HEALTHY", sched: 72, bud: 70, res: 72, mil: 71, startAgoM: 16, dur: 24, progress: 54, budgetL: 23400, spentPct: 52, projPct: 54, state: "Jammu & Kashmir", district: "Srinagar", sector: "Water", scheme: "PMDP Flood Management", dept: "dept-soc", pm: "Ravi Menon", contractor: "Afcons Infrastructure", variancePct: 1, delayDays: 3, source: "DEMO" },
  { id: "p-itanagar-air", name: "Itanagar Airport Link Road Package-2", status: "ACTIVE", h: 78, hs: "HEALTHY", sched: 80, bud: 76, res: 78, mil: 78, startAgoM: 12, dur: 22, progress: 56, budgetL: 11600, spentPct: 54, projPct: 56, state: "Arunachal Pradesh", district: "Papum Pare", sector: "Roads", scheme: "Special Assistance (SADS)", dept: "dept-ipmd", pm: "Rahul Sharma", contractor: "IRCON International", variancePct: 0, delayDays: 2, source: "DEMO" },
  { id: "p-patna-river", name: "Patna Ganga Riverfront Development, Phase-2", status: "ACTIVE", h: 77, hs: "HEALTHY", sched: 78, bud: 76, res: 78, mil: 77, startAgoM: 15, dur: 24, progress: 58, budgetL: 18300, spentPct: 56, projPct: 58, state: "Bihar", district: "Patna", sector: "Urban", scheme: "Namami Gange", dept: "dept-eco", pm: "Ananya Krishnan", contractor: "GR Infraprojects", variancePct: 0, delayDays: 2, source: "DEMO" },
  { id: "p-vadodara-iti", name: "Vadodara ITI Skill Labs Modernisation", status: "ACTIVE", h: 85, hs: "HEALTHY", sched: 86, bud: 84, res: 86, mil: 85, startAgoM: 10, dur: 14, progress: 72, budgetL: 4200, spentPct: 68, projPct: 70, state: "Gujarat", district: "Vadodara", sector: "Education", scheme: "Skill India Mission", dept: "dept-cb", pm: "Divya Pillai", contractor: "Tata Projects", variancePct: -1, delayDays: 0, source: "DEMO" },
  { id: "p-vizag-port", name: "Visakhapatnam Port Berth Automation, D-3", status: "ACTIVE", h: 75, hs: "HEALTHY", sched: 76, bud: 74, res: 76, mil: 75, startAgoM: 17, dur: 30, progress: 59, budgetL: 57300, spentPct: 56, projPct: 58, state: "Andhra Pradesh", district: "Visakhapatnam", sector: "Infrastructure", scheme: "Sagarmala", dept: "dept-ipmd", pm: "Priya Venkatesh", contractor: "L&T Infrastructure", variancePct: 1, delayDays: 4, source: "DEMO" },
];

export function buildProjects(): Project[] {
  return PROJECT_DEFS.map(d => {
    const start = shiftMonths(ANCHOR, -d.startAgoM);
    const target = shiftMonths(start, d.dur);
    return {
      id: d.id,
      psId: d.id.toUpperCase(),
      name: d.name,
      status: d.status,
      healthScore: d.h,
      healthStatus: d.hs,
      scheduleScore: d.sched,
      budgetScore: d.bud,
      resourceScore: d.res,
      milestoneScore: d.mil,
      startDate: start.toISOString(),
      targetDate: target.toISOString(),
      durationMonths: d.dur,
      progress: d.progress,
      totalBudgetL: d.budgetL,
      spentBudgetL: +(d.budgetL * d.spentPct / 100).toFixed(1),
      projectedBudgetL: +(d.budgetL * d.projPct / 100).toFixed(1),
      state: d.state,
      district: d.district,
      sector: d.sector,
      scheme: d.scheme,
      departmentId: d.dept,
      projectManager: d.pm,
      contractor: d.contractor,
      variancePct: d.variancePct,
      delayDays: d.delayDays,
      source: d.source ?? "DEMO",
    };
  });
}

// ─── Approval queue (pending change orders / budget / EoT / procurement) ─────
export const SEED_APPROVALS: ApprovalItem[] = [
  {
    id: "ap-1", type: "CHANGE_ORDER", projectId: "p-bm4", projectName: "Bharatmala P-4 · TN-04 Corridor Upgrade (Karur–Dindigul)",
    requester: "Priya Venkatesh", departmentId: "dept-ipmd", amountL: 4200,
    reason: "Design revision: 3.2 km extra service road + utility relocation after site survey by L&T — critical path impact 21 days.",
    riskScore: 78, recommendation: "approve_with_conditions", status: "PENDING",
    requestedAt: shiftDays(ANCHOR, -2).toISOString(), source: "DEMO",
  },
  {
    id: "ap-2", type: "BUDGET_INCREASE", projectId: "p-iccc2", projectName: "Integrated Command & Control Centre, Prayagraj (Phase 2)",
    requester: "Ananya Krishnan", departmentId: "dept-ipmd", amountL: 5400,
    reason: "UPS + precision cooling package 21 days late — alternative vendor at +12.7% over original bid; without it server racks stay dry.",
    riskScore: 64, recommendation: "approve", status: "PENDING",
    requestedAt: shiftDays(ANCHOR, -3).toISOString(), source: "DEMO",
  },
  {
    id: "ap-3", type: "EXTENSION_OF_TIME", projectId: "p-jj-bundelkhand", projectName: "Jal Jeevan Rural Water Grid, Bundelkhand Cluster (MP)",
    requester: "Ravi Menon", departmentId: "dept-soc", durationDays: 90,
    reason: "Ken-river source approval pending 5 months; DI-pipe supply 64 days late. Work fronts stalled. Need 90-day EoT for Ken clearance.",
    riskScore: 91, recommendation: "hold_for_evidence", status: "PENDING",
    requestedAt: shiftDays(ANCHOR, -5).toISOString(), source: "DEMO",
  },
  {
    id: "ap-4", type: "PROCUREMENT", projectId: "p-nh44", projectName: "NH-44 Bypass, Krishnagiri (Package KRN-02)",
    requester: "Rahul Sharma", departmentId: "dept-ipmd", procurementValueL: 2800,
    reason: "Bituminous concrete batch (4,200 MT) — vendor history flagged 2 prior slippages; price 4% above L1.",
    riskScore: 58, recommendation: "approve_with_conditions", status: "PENDING",
    requestedAt: shiftDays(ANCHOR, -1).toISOString(), source: "DEMO",
  },
  {
    id: "ap-5", type: "CHANGE_ORDER", projectId: "p-mum-metro4", projectName: "Mumbai Metro Line-4 Depot, Ghatkopar",
    requester: "Priya Venkatesh", departmentId: "dept-ipmd", amountL: 1800,
    reason: "Geotech re-survey suggests deeper piles (+3 m) at depot west block — L&T quote revised.",
    riskScore: 47, recommendation: "approve", status: "PENDING",
    requestedAt: shiftDays(ANCHOR, -1).toISOString(), source: "DEMO",
  },
  {
    id: "ap-6", type: "BUDGET_INCREASE", projectId: "p-cbe-bus", projectName: "Coimbatore Bus Terminal Redevelopment (Vellalore)",
    requester: "Ananya Krishnan", departmentId: "dept-eco", amountL: 950,
    reason: "Land acquisition cost revision after SC order; 4 extra plots now in scope.",
    riskScore: 42, recommendation: "approve", status: "PENDING",
    requestedAt: shiftDays(ANCHOR, -4).toISOString(), source: "DEMO",
  },
  {
    id: "ap-7", type: "EXTENSION_OF_TIME", projectId: "p-blr-suburban", projectName: "Bengaluru Suburban Rail — Hebbal Flyover Package",
    requester: "Ravi Menon", departmentId: "dept-ipmd", durationDays: 30,
    reason: "BBMP utility-shifting window deferred by 3 weeks; 30-day EoT keeps milestone M5 intact.",
    riskScore: 35, recommendation: "approve", status: "PENDING",
    requestedAt: shiftDays(ANCHOR, -2).toISOString(), source: "DEMO",
  },
  {
    id: "ap-8", type: "PROCUREMENT", projectId: "p-aiims-madurai", projectName: "AIIMS Satellite Diagnostic Wing, Madurai",
    requester: "Karthik Subramanian", departmentId: "dept-soc", procurementValueL: 1650,
    reason: "MRI 1.5T scanner — Siemens vs GE; GE 6% cheaper, SLA equivalent.",
    riskScore: 22, recommendation: "approve", status: "PENDING",
    requestedAt: shiftDays(ANCHOR, -3).toISOString(), source: "DEMO",
  },
];

// ─── Alerts — every alert across the portfolio ──────────────────────────────
export const SEED_ALERTS: AlertItem[] = [
  {
    id: "al-1", projectId: "p-bm4", projectName: "Bharatmala P-4 · TN-04 Corridor Upgrade (Karur–Dindigul)",
    title: "Delay probability crossed 75% threshold (44 days early)", description: "AssurePredict 2.3 fired on the steel procurement + monsoon + utility relocation signal set.",
    severity: "CRITICAL", type: "DELAY_PREDICTION",
    recommendedAction: "Approve CO ap-1 and confirm steel supply ETA with L&T", recommendedOwner: "Priya Venkatesh",
    recommendedDeadline: shiftDays(ANCHOR, 3).toISOString(),
    isRead: false, departmentId: "dept-ipmd", source: "DEMO",
    createdAt: shiftDays(ANCHOR, -1).toISOString(),
  },
  {
    id: "al-2", projectId: "p-jj-bundelkhand", projectName: "Jal Jeevan Rural Water Grid, Bundelkhand Cluster (MP)",
    title: "5-month statutory approval pending — Ken river source clearance", description: "Department of Water Resources, MP — file dormant since 12 Apr 2026.",
    severity: "CRITICAL", type: "DATA_STALENESS",
    recommendedAction: "Escalate to Secretary (DoWR, MP) via PMO coordination", recommendedOwner: "Ravi Menon",
    recommendedDeadline: shiftDays(ANCHOR, 5).toISOString(),
    isRead: false, departmentId: "dept-soc", source: "DEMO",
    createdAt: shiftDays(ANCHOR, -2).toISOString(),
  },
  {
    id: "al-3", projectId: "p-iccc2", projectName: "Integrated Command & Control Centre, Prayagraj (Phase 2)",
    title: "Budget variance +12.7% crossed WARNING band (10%)", description: "UPS + cooling package 21 days late; alternative vendor drives overrun.",
    severity: "HIGH", type: "BUDGET_OVERRUN",
    recommendedAction: "Approve budget increase ap-2 in Approval Centre", recommendedOwner: "Ananya Krishnan",
    recommendedDeadline: shiftDays(ANCHOR, 2).toISOString(),
    isRead: false, departmentId: "dept-ipmd", source: "DEMO",
    createdAt: shiftDays(ANCHOR, -1).toISOString(),
  },
  {
    id: "al-4", projectId: "p-nh44", projectName: "NH-44 Bypass, Krishnagiri (Package KRN-02)",
    title: "Permit pending + monsoon + vendor history → 70%+ delay probability", description: "18-feature delay model crossed the email-alert threshold.",
    severity: "HIGH", type: "DELAY_PREDICTION",
    recommendedAction: "Sign-off procurement ap-4 (bituminous concrete batch)", recommendedOwner: "Rahul Sharma",
    recommendedDeadline: shiftDays(ANCHOR, 2).toISOString(),
    isRead: false, departmentId: "dept-ipmd", source: "DEMO",
    createdAt: shiftDays(ANCHOR, -1).toISOString(),
  },
  {
    id: "al-5", projectId: "p-mum-metro4", projectName: "Mumbai Metro Line-4 Depot, Ghatkopar",
    title: "Milestone M3 (Substructure) slipped 12 days", description: "BBMP utility-shifting window deferred; pile foundation idle.",
    severity: "MEDIUM", type: "MILESTONE_SLIPPAGE",
    recommendedAction: "Approve change order ap-5 + sequence MEP crew early", recommendedOwner: "Priya Venkatesh",
    recommendedDeadline: shiftDays(ANCHOR, 4).toISOString(),
    isRead: true, departmentId: "dept-ipmd", source: "DEMO",
    createdAt: shiftDays(ANCHOR, -3).toISOString(),
  },
  {
    id: "al-6", projectId: "p-cbe-bus", projectName: "Coimbatore Bus Terminal Redevelopment (Vellalore)",
    title: "Project ON_HOLD — land acquisition cost revision pending", description: "SC order added 4 plots to scope; awaiting budget approval.",
    severity: "MEDIUM", type: "RESOURCE_BOTTLENECK",
    recommendedAction: "Approve budget increase ap-6", recommendedOwner: "Ananya Krishnan",
    recommendedDeadline: shiftDays(ANCHOR, 5).toISOString(),
    isRead: false, departmentId: "dept-eco", source: "DEMO",
    createdAt: shiftDays(ANCHOR, -2).toISOString(),
  },
  {
    id: "al-7", projectId: "p-varanasi-stp", projectName: "Varanasi Sewage Treatment Plant (140 MLD)",
    title: "Defect-liability window closes in 18 days", description: "Contractor performance review due.",
    severity: "LOW", type: "DATA_STALENESS",
    recommendedAction: "Issue contractor performance certificate", recommendedOwner: "Ravi Menon",
    recommendedDeadline: shiftDays(ANCHOR, 18).toISOString(),
    isRead: true, departmentId: "dept-soc", source: "DEMO",
    createdAt: shiftDays(ANCHOR, -4).toISOString(),
  },
  {
    id: "al-8", projectId: "p-surat-flood", projectName: "Surat Flood Resilience Grid, Phase-1",
    title: "DPR under review — no progress update in 11 days", description: "Planning stage project; baseline schedule not yet locked.",
    severity: "LOW", type: "DATA_STALENESS",
    recommendedAction: "Set baseline schedule + confirm contractor onboarding", recommendedOwner: "Divya Pillai",
    recommendedDeadline: shiftDays(ANCHOR, 7).toISOString(),
    isRead: false, departmentId: "dept-eco", source: "DEMO",
    createdAt: shiftDays(ANCHOR, -1).toISOString(),
  },
];

// ─── Activity ticker — last 10 events across portfolio ──────────────────────
export const SEED_ACTIVITY: ActivityEvent[] = [
  { id: "ev-1", timestamp: shiftDays(ANCHOR, -0.04).toISOString(), kind: "alert", message: "Delay prediction fired · Bharatmala P-4 (75% / 44d early)", projectName: "Bharatmala P-4 · TN-04 Corridor Upgrade (Karur–Dindigul)", severity: "CRITICAL" },
  { id: "ev-2", timestamp: shiftDays(ANCHOR, -0.12).toISOString(), kind: "approval", message: "Change order CO-1 raised · ₹42 Cr · Karur–Dindigul", projectName: "Bharatmala P-4 · TN-04 Corridor Upgrade (Karur–Dindigul)" },
  { id: "ev-3", timestamp: shiftDays(ANCHOR, -0.2).toISOString(), kind: "ai", message: "Assure Intelligence answered: 'forecast Q3 budget risk'", },
  { id: "ev-4", timestamp: shiftDays(ANCHOR, -0.6).toISOString(), kind: "budget", message: "Variance crossed 10% WARNING band · Prayagraj ICCC", projectName: "Integrated Command & Control Centre, Prayagraj (Phase 2)", severity: "HIGH" },
  { id: "ev-5", timestamp: shiftDays(ANCHOR, -0.9).toISOString(), kind: "milestone", message: "Milestone M3 slipped 12 days · Mumbai Metro-4 depot", projectName: "Mumbai Metro Line-4 Depot, Ghatkopar", severity: "MEDIUM" },
  { id: "ev-6", timestamp: shiftDays(ANCHOR, -1.2).toISOString(), kind: "sync", message: "Forced resync pulled 30 demo projects from main ProjectAssure", },
  { id: "ev-7", timestamp: shiftDays(ANCHOR, -1.5).toISOString(), kind: "user", message: "Sneha Iyer exported department analytics — IPMD", },
  { id: "ev-8", timestamp: shiftDays(ANCHOR, -2).toISOString(), kind: "alert", message: "5-month statutory approval stale · Bundelkhand JJ", projectName: "Jal Jeevan Rural Water Grid, Bundelkhand Cluster (MP)", severity: "CRITICAL" },
  { id: "ev-9", timestamp: shiftDays(ANCHOR, -2.4).toISOString(), kind: "approval", message: "Procurement sign-off requested · NH-44 Krishnagiri (₹28 Cr)", projectName: "NH-44 Bypass, Krishnagiri (Package KRN-02)" },
  { id: "ev-10", timestamp: shiftDays(ANCHOR, -3).toISOString(), kind: "ai", message: "CPO asked: 'Top 3 risks across portfolio?' — answer grounded in dossier", },
];

// ─── Budget thresholds ──────────────────────────────────────────────────────
export const DEFAULT_THRESHOLDS: BudgetThresholds = {
  amberPct: 10,
  redPct: 25,
  warnPct: 5,
};

// ─── Integration status (initial) ───────────────────────────────────────────
export const DEFAULT_INTEGRATION: IntegrationStatus = {
  mainProjectUrl: "https://project-assure.vercel.app",
  mainProjectReachable: null,
  lastHealthCheck: undefined,
  aiProviderConnected: false,
  emailServiceConnected: false,
  webhookUrl: "/api/admin/sync",
  webhookSecret: "",
  lastSyncAt: shiftDays(ANCHOR, -0.1).toISOString(),
  syncActive: true,
};

// ─── Built-in AI status (when no providers are configured) ───────────────────
export const BUILTIN_AI_STATUS: AiProviderStatus = {
  connected: false,
  tier: "built-in",
  label: "built-in engine",
  model: null,
  checkedAt: new Date().toISOString(),
};

// ─── Org-wide budget forecast (mock — recharts ready) ────────────────────────
export const BUDGET_FORECAST: { month: string; actual: number; forecast: number; }[] = [
  { month: "Apr", actual: 41200, forecast: 41000 },
  { month: "May", actual: 44800, forecast: 43500 },
  { month: "Jun", actual: 52100, forecast: 49000 },
  { month: "Jul", actual: 55800, forecast: 54000 },
  { month: "Aug", actual: 61400, forecast: 58500 },
  { month: "Sep", actual: 67300, forecast: 63000 },
  { month: "Oct", actual: 0, forecast: 68500 },
  { month: "Nov", actual: 0, forecast: 72800 },
  { month: "Dec", actual: 0, forecast: 77400 },
];

// ─── Per-department breakdown ───────────────────────────────────────────────
export interface DeptBudgetRow {
  deptId: string;
  sanctionedL: number;
  spentL: number;
  projectedL: number;
  projects: number;
  critical: number;
  variancePct: number;
}

export function buildDeptBudgetRows(projects: Project[]): DeptBudgetRow[] {
  const map = new Map<string, DeptBudgetRow>();
  for (const d of DEPARTMENTS) {
    map.set(d.id, { deptId: d.id, sanctionedL: 0, spentL: 0, projectedL: 0, projects: 0, critical: 0, variancePct: 0 });
  }
  for (const p of projects) {
    const row = map.get(p.departmentId);
    if (!row) continue;
    row.sanctionedL += p.totalBudgetL;
    row.spentL += p.spentBudgetL;
    row.projectedL += p.projectedBudgetL;
    row.projects += 1;
    if (p.healthStatus === "CRITICAL") row.critical += 1;
  }
  for (const row of map.values()) {
    const proportional = row.sanctionedL * 0.6; // approx expected spent by anchor
    row.variancePct = proportional > 0 ? ((row.spentL - proportional) / proportional) * 100 : 0;
  }
  return Array.from(map.values());
}

// ─── Aggregate portfolio snapshot ──────────────────────────────────────────
export interface PortfolioSnapshot {
  totalProjects: number;
  freshProjects: number;
  totalSanctionedL: number;
  totalSpentL: number;
  totalProjectedL: number;
  openAlerts: number;
  pendingApprovals: number;
  criticalProjects: number;
  atRiskProjects: number;
  healthyProjects: number;
  avgHealth: number;
  portfolioVariancePct: number;
  healthBand: { healthy: number; atRisk: number; critical: number };
  topRisky: Project[];
  topOverruns: Project[];
}

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
  return {
    totalProjects, freshProjects, totalSanctionedL, totalSpentL, totalProjectedL,
    openAlerts, pendingApprovals, criticalProjects, atRiskProjects, healthyProjects,
    avgHealth, portfolioVariancePct,
    healthBand: { healthy: healthyProjects, atRisk: atRiskProjects, critical: criticalProjects },
    topRisky, topOverruns,
  };
}

// ─── Demo-showcase cards (public-facing) ────────────────────────────────────
export interface DemoShowcaseCard {
  id: string;
  title: string;
  subtitle: string;
  ministry: string;
  value: string;
  description: string;
  accent: "blue" | "emerald" | "amber" | "rose";
  metric: string;
  mainProjectPath: string;
}

export const DEMO_CARDS: DemoShowcaseCard[] = [
  { id: "dc-1", title: "Bharatmala P-4", subtitle: "Karur–Dindigul corridor", ministry: "MoRTH / NHAI",
    value: "₹1,450 Cr", description: "Flagship at-risk corridor: monsoon + steel procurement + utility relocation. AssurePredict fires 44 days early.",
    accent: "rose", metric: "Health 42 / CRITICAL", mainProjectPath: "/?project=p-bm4" },
  { id: "dc-2", title: "Prayagraj ICCC", subtitle: "Smart City Mission — Phase 2", ministry: "MoHUA",
    value: "₹425 Cr", description: "Textbook worked example — budget variance +12.7% crossing the 10% WARNING band; UPS/cooling 21 days late.",
    accent: "amber", metric: "Health 61 / AT_RISK", mainProjectPath: "/?project=p-iccc2" },
  { id: "dc-3", title: "Bundelkhand Water Grid", subtitle: "Jal Jeevan Mission cluster", ministry: "DoWR, GoI",
    value: "₹980 Cr", description: "Critical case — Ken river source approval pending 5 months, DI-pipe supply 64 days late, 3 of 5 fronts idle.",
    accent: "rose", metric: "Health 33 / CRITICAL", mainProjectPath: "/?project=p-jj-bundelkhand" },
  { id: "dc-4", title: "Mumbai Coastal Road", subtitle: "Marine Drive–Bandra-Worli Sea Link extension", ministry: "MMRDA / MoRTH",
    value: "₹2,100 Cr", description: "Tunnel boring progress 67% — only M3 milestone at risk due to intertidal weather window.",
    accent: "blue", metric: "Health 81 / HEALTHY", mainProjectPath: "/?project=p-mum-metro4" },
];

export const SHOWCASE_STATS = [
  { label: "Projects monitored", value: "1,800+" },
  { label: "Risk signals per project", value: "18" },
  { label: "Time to first prediction", value: "<60s" },
  { label: "Departments onboard", value: "5" },
];
