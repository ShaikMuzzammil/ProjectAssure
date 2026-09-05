// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — Deterministic world generator (mulberry32(42))
// The demo world is frozen at the SIH pitch day (ANCHOR, 10 Sep 2026) so every
// score, probability and alert matches the jury script on every reload.
// ═══════════════════════════════════════════════════════════════════════════
import type {
  Project, Department, User, Milestone, Task, BudgetRecord, ResourceAllocation,
  RiskAssessment, Alert, DocumentItem, AuditLogEntry, Notification, EmailMessage, BudgetCategory,
} from "./types";
import { ANCHOR, BHARATMALA_REPORT_M4, BHARATMALA_REPORT_M3, ICCC_REPORT_M4, BUNDELKHAND_REPORT_M3, NH44_REPORT_M4, TEMPLATE_REPORT, POLICY_NOTE } from "./doc-corpus";
import { computeDelayPrediction } from "./ml";
import { monthName } from "./format";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(42);
const rand = (lo: number, hi: number) => lo + rnd() * (hi - lo);
const randInt = (lo: number, hi: number) => Math.floor(rand(lo, hi + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

const MONTH = 30.4; // average days per month used across the seed
const shiftMonths = (d: Date, m: number) => new Date(d.getTime() + m * MONTH * 86400000);
const shiftDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);

export const DEPARTMENTS: Department[] = [
  { id: "dept-ipmd", name: "Infrastructure & Project Monitoring Division", code: "IPMD", ministry: "MoSPI" },
  { id: "dept-nat", name: "National Accounts Division", code: "NASD", ministry: "MoSPI" },
  { id: "dept-soc", name: "Social Statistics Division", code: "SOSD", ministry: "MoSPI" },
  { id: "dept-eco", name: "Economic Statistics Division", code: "ECSD", ministry: "MoSPI" },
  { id: "dept-cb", name: "Capacity Building Division", code: "CAPB", ministry: "MoSPI" },
];

export const USERS: User[] = [
  // v6 COMPACT: exactly ONE demo persona per role type (4 roles) — nothing to be confused by.
  { id: "u-sec", name: "Arun Kulkarni", email: "arun.kulkarni@mospi.gov.in", password: "overseer", role: "ADMIN", departmentId: "dept-ipmd", avatarInitials: "AK", designation: "Joint Secretary, MoSPI", persona: "The Portfolio Overseer", personaDescription: "Watches 1,800+ central-sector projects. Needs triage in seconds, not spreadsheets.", phone: "+91 98200 11223", isActive: true, createdAt: shiftMonths(ANCHOR, -14).toISOString() },
  { id: "u-pm", name: "Priya Venkatesh", email: "priya.venkatesh@mospi.gov.in", password: "minister", role: "PROJECT_MANAGER", departmentId: "dept-ipmd", avatarInitials: "PV", designation: "Director (Projects), IPMD", persona: "The Ministry Project Manager", personaDescription: "Owns 10 transport & urban projects. Lives in milestones, burn charts and alerts.", phone: "+91 98400 44551", isActive: true, createdAt: shiftMonths(ANCHOR, -13).toISOString() },
  { id: "u-analyst", name: "Sneha Iyer", email: "sneha.iyer@mospi.gov.in", password: "analyst", role: "STAKEHOLDER", departmentId: "dept-ipmd", avatarInitials: "SI", designation: "Deputy Director (Analysis), IPMD", persona: "The MoSPI Data Analyst", personaDescription: "Converts 27,000 monthly pages into decisions; depends on exports & summaries.", phone: "+91 99400 33456", isActive: true, createdAt: shiftMonths(ANCHOR, -11).toISOString() },
  { id: "u-pmo", name: "Meera Nair", email: "meera.nair@pmo.gov.in", password: "observer", role: "VIEWER", departmentId: "dept-ipmd", avatarInitials: "MN", designation: "Director, PMO Coordination", persona: "The Strategic Observer", personaDescription: "Read-only flagship view for PMO/Cabinet briefings; asks 'what changed this week?'.", phone: "+91 97110 55321", isActive: true, createdAt: shiftMonths(ANCHOR, -9).toISOString() },
];

export const ROLES_CONFIG = [
  { role: "ADMIN", title: "Administrator", capabilities: ["Full system access, all departments", "User management & role assignment", "Create / edit / cancel any project", "Thresholds, alert rules & system config", "Audit log access", "Exports & reports"] },
  { role: "PROJECT_MANAGER", title: "Project Manager", capabilities: ["Create / edit assigned projects", "Milestones, tasks, budget & resources", "Run predictions on own projects", "Generate own-project reports", "View department analytics", "Cannot change system settings"] },
  { role: "STAKEHOLDER", title: "Stakeholder", capabilities: ["Read all projects in own department", "Receive alerts & digests", "Generate department-level reports", "Acknowledge alerts", "No data mutations", "Intelligence chat with citations"] },
  { role: "VIEWER", title: "Viewer", capabilities: ["Read-only on assigned projects", "Status questions in intelligence chat", "Personal exports of visible data", "No alerts configuration", "No mutations at all"] },
] as const;

const PMS = ["Priya Venkatesh", "Rahul Sharma", "Ravi Menon", "Ananya Krishnan", "Karthik Subramanian", "Divya Pillai"];
const CONTRACTORS = ["L&T Infrastructure", "NCC Ltd", "IRCON International", "Tata Projects", "Afcons Infrastructure", "GR Infraprojects", "PNC Infratech", "Dilip Buildcon"];

interface ProjDef {
  name: string; sector: string; scheme: string; state: string; district: string;
  lat: number; lng: number; budgetL: number; dur: number; startAgoM: number; progress: number;
  status: Project["status"]; dept: string; pm: string; tier?: "A" | "C"; story?: string; team?: number;
}

export const DEFS: ProjDef[] = [
  // ─── the 4 story projects (exact jury-script numbers) ─────────────────────
  { name: "Bharatmala P-4 · TN-04 Corridor Upgrade (Karur–Dindigul)", sector: "Roads", scheme: "Bharatmala Pariyojana", state: "Tamil Nadu", district: "Karur", lat: 10.96, lng: 78.08, budgetL: 145000, dur: 28, startAgoM: 22.4, progress: 58, status: "ACTIVE", dept: "dept-ipmd", pm: "Priya Venkatesh", tier: "A", story: "Flagship at-risk corridor: monsoon + steel procurement pending 19 days + utility relocation on the critical path. The model says 75% delay probability 44 days early.", team: 218 },
  { name: "Integrated Command & Control Centre, Prayagraj (Phase 2)", sector: "Urban", scheme: "Smart Cities Mission", state: "Uttar Pradesh", district: "Prayagraj", lat: 25.44, lng: 81.85, budgetL: 42500, dur: 24, startAgoM: 17, progress: 55, status: "ACTIVE", dept: "dept-ipmd", pm: "Ananya Krishnan", tier: "A", story: "The textbook worked example: health 61.3 with budget overrun +12.7% crossing the 10% WARNING band; UPS/cooling package 21 days late blocks server racks.", team: 118 },
  { name: "Jal Jeevan Rural Water Grid, Bundelkhand Cluster (MP)", sector: "Water", scheme: "Jal Jeevan Mission", state: "Madhya Pradesh", district: "Chhatarpur", lat: 25.09, lng: 79.61, budgetL: 98000, dur: 30, startAgoM: 17.4, progress: 31, status: "ACTIVE", dept: "dept-soc", pm: "Ravi Menon", tier: "C", story: "The critical case: Ken-river source approval pending 5 months, DI-pipe supply 64 days late, 3 of 5 work fronts idle. Health 33 — needs officer verification before escalation (rule R10).", team: 96 },
  { name: "NH-44 Bypass, Krishnagiri (Package KRN-02)", sector: "Roads", scheme: "NHAI Annual Plan", state: "Tamil Nadu", district: "Krishnagiri", lat: 12.52, lng: 78.21, budgetL: 31200, dur: 30, startAgoM: 21.6, progress: 58, status: "ACTIVE", dept: "dept-ipmd", pm: "Rahul Sharma", tier: "A", story: "The delay-model worked example from the reference spec: 18 features, permits pending + monsoon + vendor history push probability past the 70% email threshold.", team: 88 },
  // ─── 26 healthy portfolio projects ────────────────────────────────────────
  { name: "Varanasi Sewage Treatment Plant (140 MLD)", sector: "Water", scheme: "Namami Gange", state: "Uttar Pradesh", district: "Varanasi", lat: 25.32, lng: 82.99, budgetL: 18600, dur: 22, startAgoM: 24, progress: 100, status: "COMPLETED", dept: "dept-soc", pm: "Ravi Menon" },
  { name: "PM SHRI Schools Modernisation, Chennai Block", sector: "Education", scheme: "PM SHRI", state: "Tamil Nadu", district: "Chennai", lat: 13.08, lng: 80.27, budgetL: 7800, dur: 16, startAgoM: 11, progress: 68, status: "ACTIVE", dept: "dept-cb", pm: "Divya Pillai" },
  { name: "AIIMS Satellite Diagnostic Wing, Madurai", sector: "Health", scheme: "PM ABIM", state: "Tamil Nadu", district: "Madurai", lat: 9.93, lng: 78.12, budgetL: 32500, dur: 26, startAgoM: 16, progress: 61, status: "ACTIVE", dept: "dept-soc", pm: "Karthik Subramanian" },
  { name: "Mumbai Metro Line-4 Depot, Ghatkopar", sector: "Infrastructure", scheme: "MMRDA Urban Transport", state: "Maharashtra", district: "Mumbai", lat: 19.11, lng: 72.91, budgetL: 87400, dur: 30, startAgoM: 13, progress: 43, status: "ACTIVE", dept: "dept-ipmd", pm: "Priya Venkatesh" },
  { name: "Bengaluru Suburban Rail — Hebbal Flyover Package", sector: "Infrastructure", scheme: "K-RIDE", state: "Karnataka", district: "Bengaluru", lat: 13.04, lng: 77.59, budgetL: 52300, dur: 28, startAgoM: 17, progress: 58, status: "ACTIVE", dept: "dept-ipmd", pm: "Ravi Menon" },
  { name: "Coimbatore Bus Terminal Redevelopment (Vellalore)", sector: "Urban", scheme: "Smart Cities Mission", state: "Tamil Nadu", district: "Coimbatore", lat: 10.96, lng: 76.95, budgetL: 15600, dur: 20, startAgoM: 15, progress: 52, status: "ON_HOLD", dept: "dept-eco", pm: "Ananya Krishnan" },
  { name: "Surat Flood Resilience Grid, Phase-1", sector: "Water", scheme: "AMRUT 2.0", state: "Gujarat", district: "Surat", lat: 21.17, lng: 72.83, budgetL: 26900, dur: 26, startAgoM: 1.2, progress: 4, status: "PLANNING", dept: "dept-eco", pm: "Divya Pillai" },
  { name: "Smart Classrooms Rollout, Thiruvananthapuram", sector: "Education", scheme: "PM SHRI", state: "Kerala", district: "Thiruvananthapuram", lat: 8.52, lng: 76.94, budgetL: 5400, dur: 14, startAgoM: 9, progress: 64, status: "ACTIVE", dept: "dept-cb", pm: "Divya Pillai" },
  { name: "District Hospital Upgradation, Warangal", sector: "Health", scheme: "PM ABIM", state: "Telangana", district: "Warangal", lat: 17.97, lng: 79.59, budgetL: 12900, dur: 18, startAgoM: 12, progress: 55, status: "ACTIVE", dept: "dept-soc", pm: "Karthik Subramanian" },
  { name: "Kolkata East-West Stormwater Drains", sector: "Water", scheme: "AMRUT 2.0", state: "West Bengal", district: "Kolkata", lat: 22.57, lng: 88.36, budgetL: 21300, dur: 24, startAgoM: 15, progress: 62, status: "ACTIVE", dept: "dept-eco", pm: "Ananya Krishnan" },
  { name: "Delhi SARAS Waste-to-Energy, Narela", sector: "Urban", scheme: "Swachh Bharat 2.0", state: "Delhi", district: "New Delhi", lat: 28.85, lng: 77.09, budgetL: 38700, dur: 28, startAgoM: 18, progress: 66, status: "ACTIVE", dept: "dept-eco", pm: "Priya Venkatesh" },
  { name: "Golden Quadrilateral Safety Package, Pune–Bengaluru", sector: "Roads", scheme: "NHAI Safety Corpus", state: "Maharashtra", district: "Pune", lat: 18.52, lng: 73.86, budgetL: 9600, dur: 15, startAgoM: 10, progress: 71, status: "ACTIVE", dept: "dept-ipmd", pm: "Rahul Sharma" },
  { name: "North Eastern District Water Supply, Imphal East", sector: "Water", scheme: "Jal Jeevan Mission", state: "Manipur", district: "Imphal", lat: 24.82, lng: 93.94, budgetL: 7400, dur: 20, startAgoM: 13, progress: 58, status: "ACTIVE", dept: "dept-soc", pm: "Ravi Menon" },
  { name: "Tribal School Infrastructure, Dantewada", sector: "Education", scheme: "Eklavya Model Schools", state: "Chhattisgarh", district: "Dantewada", lat: 19.0, lng: 81.35, budgetL: 6800, dur: 18, startAgoM: 11, progress: 60, status: "ACTIVE", dept: "dept-cb", pm: "Divya Pillai" },
  { name: "Jaipur Ring Road Signage & ITS Corridor", sector: "Roads", scheme: "Bharatmala Pariyojana", state: "Rajasthan", district: "Jaipur", lat: 26.91, lng: 75.79, budgetL: 14200, dur: 20, startAgoM: 14, progress: 63, status: "ACTIVE", dept: "dept-ipmd", pm: "Priya Venkatesh" },
  { name: "Bhopal Smart Poles & City Wi-Fi Mesh", sector: "Urban", scheme: "Smart Cities Mission", state: "Madhya Pradesh", district: "Bhopal", lat: 23.26, lng: 77.41, budgetL: 8900, dur: 16, startAgoM: 12, progress: 69, status: "ACTIVE", dept: "dept-eco", pm: "Ananya Krishnan" },
  { name: "Kochi Water Metro Terminal-3, Kakkanad", sector: "Infrastructure", scheme: "Kochi Water Metro", state: "Kerala", district: "Ernakulam", lat: 9.98, lng: 76.34, budgetL: 19800, dur: 22, startAgoM: 16, progress: 59, status: "ACTIVE", dept: "dept-ipmd", pm: "Rahul Sharma" },
  { name: "Nagpur Metro Depot Electrification", sector: "Infrastructure", scheme: "MAHA Metro", state: "Maharashtra", district: "Nagpur", lat: 21.15, lng: 79.09, budgetL: 44100, dur: 26, startAgoM: 19, progress: 64, status: "ACTIVE", dept: "dept-ipmd", pm: "Priya Venkatesh" },
  { name: "Bhubaneswar Affordable Housing Cluster, Patia", sector: "Urban", scheme: "PM Awas Yojana (U)", state: "Odisha", district: "Khordha", lat: 20.3, lng: 85.82, budgetL: 16700, dur: 24, startAgoM: 14, progress: 61, status: "ACTIVE", dept: "dept-eco", pm: "Ananya Krishnan" },
  { name: "Hyderabad Primary Health Centres Digital Stack", sector: "Health", scheme: "Ayushman Bharat Digital", state: "Telangana", district: "Hyderabad", lat: 17.39, lng: 78.49, budgetL: 9200, dur: 18, startAgoM: 12, progress: 66, status: "ACTIVE", dept: "dept-soc", pm: "Karthik Subramanian" },
  { name: "Amritsar Green Belt & Lake Restoration", sector: "Urban", scheme: "AMRUT 2.0", state: "Punjab", district: "Amritsar", lat: 31.63, lng: 74.87, budgetL: 6100, dur: 16, startAgoM: 13, progress: 57, status: "ACTIVE", dept: "dept-eco", pm: "Divya Pillai" },
  { name: "Srinagar Flood Spillway, Jhelum Basin", sector: "Water", scheme: "PMDP Flood Management", state: "Jammu & Kashmir", district: "Srinagar", lat: 34.08, lng: 74.8, budgetL: 23400, dur: 24, startAgoM: 16, progress: 54, status: "ACTIVE", dept: "dept-soc", pm: "Ravi Menon" },
  { name: "Itanagar Airport Link Road Package-2", sector: "Roads", scheme: "Special Assistance (SADS)", state: "Arunachal Pradesh", district: "Papum Pare", lat: 27.1, lng: 93.62, budgetL: 11600, dur: 22, startAgoM: 12, progress: 56, status: "ACTIVE", dept: "dept-ipmd", pm: "Rahul Sharma" },
  { name: "Patna Ganga Riverfront Development, Phase-2", sector: "Urban", scheme: "Namami Gange", state: "Bihar", district: "Patna", lat: 25.62, lng: 85.14, budgetL: 18300, dur: 24, startAgoM: 15, progress: 58, status: "ACTIVE", dept: "dept-eco", pm: "Ananya Krishnan" },
  { name: "Vadodara ITI Skill Labs Modernisation", sector: "Education", scheme: "Skill India Mission", state: "Gujarat", district: "Vadodara", lat: 22.31, lng: 73.18, budgetL: 4200, dur: 14, startAgoM: 10, progress: 72, status: "ACTIVE", dept: "dept-cb", pm: "Divya Pillai" },
  { name: "Visakhapatnam Port Berth Automation, D-3", sector: "Infrastructure", scheme: "Sagarmala", state: "Andhra Pradesh", district: "Visakhapatnam", lat: 17.69, lng: 83.22, budgetL: 57300, dur: 30, startAgoM: 17, progress: 59, status: "ACTIVE", dept: "dept-ipmd", pm: "Priya Venkatesh" },
];

// ─── Milestone / task templates ─────────────────────────────────────────────
const MS_TEMPLATES = [
  "Detailed Project Report Approval", "Land Acquisition & Statutory Clearances", "Foundation & Substructure",
  "Main Structural Works", "MEP / Services Installation", "Equipment Procurement & Delivery",
  "Testing, Commissioning & Handover", "Safety Audit & Defect Liability", "Community Utilities Integration",
];
const TASK_TEMPLATES = ["Survey & layout — {n}", "Material indent & approval — {n}", "Execution batch — {n}", "Quality assurance round — {n}", "Supervision & billing — {n}", "Safety compliance check — {n}"];
const ASSIGNEES = ["Rahul S.", "Meena K.", "Arjun P.", "Fatima Z.", "Vikas R.", "Lakshmi N.", "Imran M.", "Deepa V."];

function buildMilestones(p: Project, def: ProjDef): Milestone[] {
  const count = def.tier === "C" ? 11 : def.tier === "A" ? 9 : randInt(4, 7);
  const start = new Date(p.startDate);
  const step = (p.durationMonths * MONTH) / count;
  const ms: Milestone[] = [];
  const doneByNow = Math.floor((p.progress / 100) * count);
  for (let i = 0; i < count; i++) {
    const planned = new Date(start.getTime() + step * (i + 1) * 86400000);
    const isCritical = i === 1 || i === count - 2;
    let status: Milestone["status"] = "PENDING";
    let progress = 0;
    let actual: string | undefined;
    if (i < doneByNow) {
      status = "COMPLETED";
      progress = 100;
      actual = shiftDays(planned, rnd() < 0.25 ? randInt(1, 6) : 0).toISOString();
    } else if (i === doneByNow) {
      status = "IN_PROGRESS";
      progress = Math.round((p.progress % 20) * 4.5);
    }
    ms.push({
      id: `${p.id}-ms-${i + 1}`, projectId: p.id,
      name: MS_TEMPLATES[i % MS_TEMPLATES.length],
      description: isCritical ? "Critical-path milestone — zero float; slip moves the end date directly." : undefined,
      status, plannedDate: planned.toISOString(), actualDate: actual,
      weight: isCritical ? 1.5 : 1, isCritical, order: i, progress,
    });
  }
  if (def.tier === "A") {
    const cur = ms[doneByNow]; if (cur) { cur.status = "DELAYED"; cur.progress = Math.min(70, 20 + randInt(0, 40)); }
    const next = ms[doneByNow + 1]; if (next) next.status = "BLOCKED";
    const prev = ms[doneByNow - 1]; if (prev && prev.status === "COMPLETED" && !prev.actualDate) prev.actualDate = shiftDays(new Date(prev.plannedDate), 4).toISOString();
  }
  if (def.tier === "C") {
    const cur = ms[doneByNow]; if (cur) { cur.status = "DELAYED"; cur.progress = 24; }
    const next = ms[doneByNow + 1]; if (next) { next.status = "DELAYED"; next.progress = 12; }
    const next2 = ms[doneByNow + 2]; if (next2) next2.status = "BLOCKED";
    if (ms[1]) ms[1].status = "DELAYED";
  }
  return ms;
}

function buildTasks(p: Project, def: ProjDef): Task[] {
  const tasks: Task[] = [];
  const msList = [...p.milestones].sort((a, b) => a.order - b.order);
  let k = 0;
  for (const m of msList) {
    const n = randInt(2, 3);
    const mStart = new Date(m.plannedDate);
    const prevIds: string[] = [];
    for (let i = 0; i < n; i++, k++) {
      const id = `${p.id}-tk-${k + 1}`;
      const plannedStart = shiftDays(mStart, -(n - i) * 14);
      const plannedEnd = shiftDays(plannedStart, randInt(12, 40));
      let status: Task["status"] = "NOT_STARTED";
      let progress = 0;
      if (m.status === "COMPLETED") { status = "COMPLETED"; progress = 100; }
      else if (m.status === "IN_PROGRESS") { status = i === 0 ? "IN_PROGRESS" : rnd() < 0.4 ? "IN_PROGRESS" : "NOT_STARTED"; progress = status === "IN_PROGRESS" ? randInt(25, 80) : 0; }
      else if (m.status === "DELAYED") { status = i === 0 ? "BLOCKED" : rnd() < 0.5 ? "IN_PROGRESS" : "NOT_STARTED"; progress = status === "IN_PROGRESS" ? randInt(10, 55) : 0; }
      else if (m.status === "BLOCKED") { status = "BLOCKED"; }
      const deps: string[] = [];
      if (prevIds.length && rnd() < 0.8) deps.push(prevIds[prevIds.length - 1]);
      if (k > 0 && rnd() < 0.12) deps.push(`${p.id}-tk-${k}`); // cross-milestone chain
      tasks.push({
        id, projectId: p.id, milestoneId: m.id,
        name: TASK_TEMPLATES[k % TASK_TEMPLATES.length].replace("{n}", `${m.order + 1}.${i + 1}`),
        status, plannedStart: plannedStart.toISOString(), plannedEnd: plannedEnd.toISOString(),
        assignee: ASSIGNEES[k % ASSIGNEES.length], progress, isCritical: m.isCritical, dependsOn: deps,
      });
      prevIds.push(id);
    }
  }
  return tasks;
}

const BUDGET_SPLIT: { cat: BudgetCategory; share: number }[] = [
  { cat: "CONSTRUCTION", share: 0.55 }, { cat: "MATERIALS", share: 0.25 },
  { cat: "HUMAN_RESOURCES", share: 0.12 }, { cat: "EQUIPMENT", share: 0.08 },
];

function buildBudgetRecords(p: Project, def: ProjDef): BudgetRecord[] {
  const recs: BudgetRecord[] = [];
  const elapsedM = Math.max(2, Math.floor((def.startAgoM / def.dur) * def.dur));
  const monthsToEmit = Math.min(elapsedM, 14);
  const baseMonthly = p.totalBudget / p.durationMonths;
  const burnFactor = def.tier === "A" ? 1.46 : def.tier === "C" ? 0.34 : rand(0.85, 1.08);
  let k = 0;
  for (let i = monthsToEmit; i >= 1; i--, k++) {
    const d = shiftMonths(ANCHOR, -i);
    const month = d.getMonth() + 1, year = d.getFullYear();
    const ramp = 0.55 + (1 - i / monthsToEmit) * 0.6;
    const season = 1 + Math.sin(month / 12 * Math.PI * 2) * 0.15;
    for (const s of BUDGET_SPLIT) {
      const planned = Math.round(baseMonthly * s.share * ramp * season * rand(0.92, 1.12));
      const spent = Math.round(planned * burnFactor * rand(0.94, 1.09));
      recs.push({ id: `${p.id}-br-${year}${month}-${s.cat.slice(0, 3)}`, projectId: p.id, category: s.cat, month, year, planned, spent });
    }
  }
  return recs;
}

function buildResources(p: Project, def: ProjDef): ResourceAllocation[] {
  const res: ResourceAllocation[] = [];
  const push = (category: ResourceAllocation["category"], name: string, quantity: number, allocated: number, utilised: number, unit: string) =>
    res.push({ id: `${p.id}-rs-${res.length + 1}`, projectId: p.id, category, name, quantity, allocated, utilised, unit, status: utilised > 90 ? "bottleneck" : utilised > 78 ? "constrained" : "available" });
  const humans = def.team ?? randInt(45, 160);
  const utilHuman = def.tier === "A" ? 88 : def.tier === "C" ? 44 : rand(62, 82);
  push("HUMAN", "Skilled workforce", humans, humans, Math.round(utilHuman), "persons");
  push("HUMAN", "Supervisory staff", Math.max(4, Math.round(humans / 12)), Math.max(4, Math.round(humans / 12)), Math.round(utilHuman + rand(-6, 4)), "persons");
  const cranes = randInt(3, 18);
  push("EQUIPMENT", "Tower cranes / batching", cranes, cranes, def.tier === "A" ? 96 : def.tier === "C" ? 30 : Math.round(rand(45, 86)), "units");
  push("EQUIPMENT", "Earthmoving fleet", randInt(4, 22), randInt(4, 22), Math.round(def.tier === "C" ? 28 : rand(50, 84)), "units");
  push("MATERIAL", "Structural steel", randInt(100, 900), randInt(100, 900), Math.round(def.tier === "A" ? 74 : rand(40, 70)), "tonnes");
  push("MATERIAL", "Cement & aggregates", randInt(200, 1200), randInt(200, 1200), Math.round(rand(48, 78)), "tonnes");
  return res;
}

function buildDocuments(p: Project, def: ProjDef): DocumentItem[] {
  const docs: DocumentItem[] = [];
  const addDoc = (fileName: string, fileType: DocumentItem["fileType"], pages: number, text: string, daysAgo: number, summary: string, fields: [string, string, number, number][], findings: string[], risks: string[]) => {
    const id = `${p.id}-doc-${docs.length + 1}`;
    docs.push({
      id, projectId: p.id, fileName, fileType, fileSize: Math.round(pages * rand(80, 160) * 1024),
      uploadedAt: shiftDays(ANCHOR, -daysAgo).toISOString(), uploadedBy: "Rahul Sharma",
      status: "PROCESSED", totalPages: pages, ocrConfidence: +rand(0.86, 0.97).toFixed(2),
      summary,
      extractedData: {
        fields: fields.map(([field, value, confidence, sourcePage]) => ({ field, value, confidence: +confidence.toFixed(2), sourcePage })),
        keyFindings: findings, risks,
        sentiment: { score: +(risks.length / 10).toFixed(2), label: risks.length > 4 ? "negative" : risks.length > 2 ? "neutral" : "positive" },
      },
      text, processingMs: Math.round(rand(24, 58) * 1000),
    });
  };

  if (def.tier === "A" || def.tier === "C") {
    const text = p.name.includes("Bharatmala") ? BHARATMALA_REPORT_M4 : p.name.includes("Command") ? ICCC_REPORT_M4 : p.name.includes("Jal Jeevan") ? BUNDELKHAND_REPORT_M3 : NH44_REPORT_M4;
    addDoc(
      `${p.name.split(",")[0]} — Monthly Report Aug 2026.pdf`, "pdf", p.name.includes("Bharatmala") ? 15 : 16, text, 9,
      `Smart summary: ${p.name} — physical progress ${p.progress}% against plan; ${risksFor(def).length} active risks including ${risksFor(def)[0]?.toLowerCase() ?? "schedule pressure"}. All ${Math.round(rand(18, 42))} extracted fields passed strict validation; read confidenceidence ${rand(0.91, 0.96).toFixed(2)}.`,
      [
        ["physical_progress", `${p.progress}%`, 0.96, 1], ["expenditure_to_date", `${(p.totalBudget * (def.tier === "C" ? 0.426 : 0.88) / 100).toFixed(0)} Cr`, 0.94, 2],
        ["milestones_delayed", `${def.tier === "C" ? 6 : 3}`, 0.97, 3], ["procurement_pending", `${def.tier === "C" ? 64 : 19} days`, 0.92, 4],
        ["projected_overrun", `${((p.projectedBudget - p.totalBudget) / p.totalBudget * 100).toFixed(1)}%`, 0.9, 5],
      ],
      findingsFor(def), risksFor(def),
    );
    if (p.name.includes("Bharatmala")) {
      addDoc(`${p.name.split(",")[0]} — Monthly Report Jul 2026.pdf`, "pdf", 14, BHARATMALA_REPORT_M3, 39,
        "Smart summary: July was monsoon-affected with 11 lost working days; burn velocity deviation +38%; M-03 completed 6 days late. 24 fields captured.",
        [["physical_progress", "51%", 0.95, 1], ["lost_working_days", "11", 0.93, 1], ["milestone_M03", "6 days late", 0.95, 3]],
        ["Monsoon activity above LPA", "Steel indent pending since 8 Jul"], ["Rainfall +22% over LPA", "RoW issue at ch 22/100"]);
    }
    addDoc(`${p.name.split(",")[0]} — Financial Statement Aug 2026.xlsx`, "xlsx", 6,
      `Financial statement (extracted): cumulative expenditure ₹${(p.spentBudget / 100).toFixed(1)} Cr against sanction ₹${(p.totalBudget / 100).toFixed(0)} Cr; category split construction/materials/HR/equipment; vendor-wise certification status.`, 7,
      "Smart summary: category burn table extracted (openpyxl); construction 55%, materials 25%; certification current; no disputed bills.",
      [["cumulative_expenditure", `₹${(p.spentBudget / 100).toFixed(1)} Cr`, 0.97, 1], ["sanctioned_cost", `₹${(p.totalBudget / 100).toFixed(0)} Cr`, 0.99, 1], ["burn_velocity_dev", def.tier === "C" ? "-15%" : "+46%", 0.9, 2]],
      ["Category split captured", "Certification current"], ["Burn velocity beyond +30% band"]);
  } else {
    const m = ["Aug", "Jul"][docs.length % 2];
    const text = TEMPLATE_REPORT({ name: p.name, psId: p.psId, sector: p.sector, state: p.state, district: p.district, progress: p.progress, budgetCr: Math.round(p.totalBudget / 100), spentPct: Math.min(99, Math.round(p.progress * 0.96)), monthLabel: m });
    addDoc(`${p.name.split(",")[0]} — Monthly Report ${m} 2026.pdf`, "pdf", randInt(8, 14), text, docs.length === 0 ? 8 : 36,
      `Smart summary: ${p.name} tracking to programme at ${p.progress}% physical progress; expenditure aligned; milestones on baseline; ${randInt(14, 42)} fields auto-captured with read confidenceidence ${rand(0.9, 0.97).toFixed(2)}.`,
      [["physical_progress", `${p.progress}%`, 0.96, 1], ["expenditure", `₹${(p.spentBudget / 100).toFixed(1)} Cr`, 0.95, 2], ["milestones_on_time", "yes", 0.93, 3]],
      ["Programme on track", "QA pass rate 98%"], []);
    if (rnd() < 0.5) {
      addDoc(`${p.name.split(",")[0]} — Site Inspection Note ${m} 2026.pdf`, "pdf", 4,
        `Site inspection note: work fronts in ${p.district} operating to programme; environmental compliance filed; labour attendance ${randInt(82, 97)}% of plan; plant availability normal.`, 5,
        "Smart summary: inspection note structured; compliance clean; no material observations requiring escalation.",
        [["labour_attendance", `${randInt(82, 97)}%`, 0.94, 2], ["compliance", "clean", 0.96, 3]], ["Inspection closed without observations"], []);
    }
  }
  return docs;
}

function risksFor(def: ProjDef): string[] {
  if (def.tier === "A") return ["Utility relocation on critical path", "Steel procurement pending 19 days", "Burn velocity +46% vs plan", "Monsoon 22% above LPA"];
  if (def.tier === "C") return ["Ken-river source approval pending 5 months", "DI-pipe supply 64 days late", "3 of 5 work fronts idle", "Land acquisition 60% complete"];
  return ["ROB girder approval pending with Railway", "Vendor historical overrun ratio high"];
}
function findingsFor(def: ProjDef): string[] {
  if (def.tier === "A") return ["Progress gap 14 pp vs plan", "Projected final cost within 10% band but trending adverse", "Crane utilisation 96% — bottleneck"];
  if (def.tier === "C") return ["Progress gap 27 pp vs plan", "Projected overrun +11.8% crosses WARNING band", "Labour utilisation 44%"];
  return ["Progress gap 14 pp", "Model advisory: verify ROB approval with divisional engineer"];
}

function buildRiskAssessment(p: Project, def: ProjDef): RiskAssessment {
  const rs = p.resourceScore, bs = p.budgetScore, ss = p.scheduleScore;
  const overall = Math.round((100 - p.healthScore) * 0.92);
  const level = overall > 70 ? "CRITICAL" : overall > 45 ? "HIGH" : overall > 25 ? "MEDIUM" : "LOW";
  return {
    scheduleRisk: Math.round(100 - ss), budgetRisk: Math.round(100 - bs), resourceRisk: Math.round(100 - rs),
    overallRisk: overall, riskLevel: level as RiskAssessment["riskLevel"],
    factors: risksFor(def).map(r => ({ factor: r.split(" ").slice(0, 4).join(" "), impact: randInt(35, 92), description: r })),
    assessedAt: shiftDays(ANCHOR, -2).toISOString(),
  };
}

function buildAlerts(p: Project, def: ProjDef): Alert[] {
  const alerts: Alert[] = [];
  const A = (title: string, description: string, severity: Alert["severity"], type: Alert["type"], daysAgo: number, action: string, owner: string, deadline: string, read = false) =>
    alerts.push({ id: `${p.id}-al-${alerts.length + 1}`, projectId: p.id, title, description, severity, type, isRead: read, createdAt: shiftDays(ANCHOR, -daysAgo).toISOString(), recommendedAction: action, recommendedOwner: owner, recommendedDeadline: deadline });

  if (def.tier === "C") {
    A("Portfolio-critical: project health entered the Red band", "Health score 33 (Red). Rule R10 applies — a human officer must verify before escalation to the administrative ministry.", "CRITICAL", "RISK_LEVEL_CHANGE", 2, "Verify field data with the executive engineer (video call) and confirm the 150-day re-baseline claim before Cabinet-note escalation.", "Arun Kulkarni (JS, MoSPI)", "within 48 hours");
    A("Milestone M-02 (intake well) 89 days behind baseline", "Three critical-path milestones are delayed simultaneously; the intake well at the Ken river source is the binding constraint after 5 months of pending irrigation-department approval.", "CRITICAL", "MILESTONE_SLIPPAGE", 4, "Escalate the Ken-river approval to the irrigation secretary with a joint-site-visit request; consider re-phasing the Mahoba ring to Q4.", "Ravi Menon (PM)", "before 20 Sep 2026");
    A("Projected overrun +11.8% — WARNING band crossed", "cost forecast projects final cost ₹1,096 Cr vs sanction ₹980 Cr. Above the 10% WARNING threshold; approaching the 20% CRITICAL escalation band. Weekly re-forecast is now mandatory.", "HIGH", "BUDGET_OVERRUN", 5, "Issue liquidated-damages notice on the DI-pipe vendor and re-baseline the cash-flow with the finance division.", "Finance Division (ECSD)", "weekly until stabilised");
    A("3 of 5 work fronts idle — resource bottleneck", "Labour utilisation 44%; single JCB operational at Mahoba against a planned three; work fronts starved for want of ductile-iron pipe.", "HIGH", "RESOURCE_BOTTLENECK", 6, "Re-deploy two idle fronts to Chhatarpur reservoir finishing works; hire short-term plant from the district pool.", "Rahul Sharma (Field Officer)", "before 25 Sep 2026", true);
  } else if (def.tier === "A") {
    A(`Delay probability ${Math.round(p.prediction!.probability * 100)}% — email threshold crossed`, `The 18-signal model estimates a ${p.prediction!.estimatedDays}-day slip (90% CI ${p.prediction!.ciLower}–${p.prediction!.ciUpper}) with ${Math.round(p.prediction!.confidence * 100)}% confidence. Advisory only — requires officer verification per rule R10.`, "HIGH", "DELAY_PREDICTION", 1, p.name.includes("Bharatmala") ? "Expedite the written steel dispatch confirmation and re-sequence drainage parallel to sub-grade to recover ~6 days." : "Close the UPS/precision-cooling package and begin video-wall dry-run to hold the cold-commissioning date.", p.name.includes("Bharatmala") ? "Priya Venkatesh (PM)" : "Ananya Krishnan (PM)", "within 5 working days");
    A("Budget burn velocity +46% — EARLY_WARNING rule", "Burn velocity deviation exceeded +30% for the second consecutive month (rule: 2-month sustained breach). Fires before an overrun materialises.", "HIGH", "BUDGET_OVERRUN", 3, "Review rate-approval pipeline for the utility package; withhold next milestone payment until re-sequencing plan is submitted.", "Priya Venkatesh (PM)", "before 30 Sep 2026");
    A("M-04 (utility relocation, Karur) 34 days behind — critical path", "The utility relocation package at Karur is now 34 days beyond baseline and has zero float; tower cranes at 96% utilisation leave no catch-up capacity.", "MEDIUM", "MILESTONE_SLIPPAGE", 4, "Invoke the survey-of-India boundary re-demarcation fast-track; approve two batching plants to parallel the Dindigul drainage.", "Priya Venkatesh (PM)", "before 5 Oct 2026", true);
  } else {
    if (def.status === "ACTIVE" && parseInt(p.id.slice(-2), 10) % 8 === 3) {
      A("Data staleness: last report 38 days old", "Field report overdue by 8 days beyond the 7-working-day flash-report window; portfolio freshness depends on timely submission.", "LOW", "DATA_STALENESS", 2, "Send an automated reminder to the field reporting officer; enable SMS fallback if the next cycle is missed.", "Rahul Sharma (Field Officer)", "before next flash report");
    }
  }
  return alerts;
}

function buildAuditTrail(p: Project, def: ProjDef): AuditLogEntry[] {
  const e: AuditLogEntry[] = [];
  const add = (action: AuditLogEntry["action"], entity: string, details: string, daysAgo: number, user = "system", role: AuditLogEntry["userRole"] = "ADMIN") =>
    e.push({ id: `${p.id}-au-${e.length + 1}`, action, entity, entityId: p.id, details, userName: user, userRole: role, timestamp: shiftDays(ANCHOR, -daysAgo).toISOString() });
  add("CREATE", "Project", `Project ${p.psId} created from the ${p.scheme} sanction order`, def.startAgoM * 1.5);
  add("UPDATE", "Milestone", `Milestone M-01 status PENDING → COMPLETED`, Math.floor(def.startAgoM * 0.6));
  add("PREDICTION_RUN", "PredictionResult", `6-hour scoring run completed · model ${"AssurePredict 2.3"}`, def.tier ? 1 : 3);
  if (def.tier) add("AI_ACCEPT", "PredictionResult", `Delay advisory accepted by officer; verification checklist 4/4 complete`, 1, p.projectManager, "PROJECT_MANAGER");
  add("EXPORT", "Report", `Monthly status report exported (PDF) for ministry review`, def.tier ? 5 : 7, "Sneha Iyer", "STAKEHOLDER");
  return e;
}

// ─── Documented story sub-scores (jury script) ──────────────────────────────
export const STORY_TARGETS: Record<string, { schedule: number; budget: number; resources: number; milestones: number }> = {
  "prj-01": { schedule: 61, budget: 52, resources: 70, milestones: 50 },   // Bharatmala → health 58.35
  "prj-02": { schedule: 70.4, budget: 35.3, resources: 82.5, milestones: 59.6 }, // ICCC → 61.29
  "prj-03": { schedule: 28.5, budget: 31.2, resources: 44, milestones: 30.5 },  // Bundelkhand → 33.06
  "prj-04": { schedule: 58, budget: 54, resources: 74, milestones: 55 },   // NH-44 → ~59
};

// Story psIds — align with the document corpus (monthly reports cite these IDs)
const STORY_PS_IDS: Record<string, string> = {
  "prj-01": "PRJ-2026-1071", // Bharatmala P-4 TN-04
  "prj-02": "PRJ-2026-1148", // ICCC Prayagraj Phase-2
  "prj-03": "PRJ-2026-1211", // Jal Jeevan Bundelkhand
  "prj-04": "PRJ-2026-1142", // NH-44 Krishnagiri
};

export function buildWorld(): { projects: Project[]; globalAudit: AuditLogEntry[]; notifications: Notification[]; emails: EmailMessage[]; users: User[]; departments: Department[] } {
  const projects: Project[] = [];
  DEFS.forEach((def, idx) => {
    const id = `prj-${String(idx + 1).padStart(2, "0")}`;
    const startDate = shiftMonths(ANCHOR, -def.startAgoM);
    const targetDate = shiftMonths(startDate, def.dur);
    const isStory = !!def.tier;
    const spentFactor = def.tier === "C" ? 0.426 : def.tier === "A" ? 0.88 : Math.min(0.99, (def.progress / 100) * (0.96 + (idx % 7) * 0.01));
    const spent = Math.round(def.budgetL * spentFactor);
    const projected = def.tier === "A" ? Math.round(def.budgetL * (def.name.includes("ICCC") ? 1.127 : 1.053)) : def.tier === "C" ? Math.round(def.budgetL * 1.118) : Math.round(def.budgetL * (0.985 + ((idx * 7) % 11) / 400));
    const target = STORY_TARGETS[id];

    const p: Project = {
      id, psId: STORY_PS_IDS[id] ?? `PRJ-2026-${String(101 + idx * 7).padStart(4, "0")}`,
      name: def.name,
      description: `${def.scheme} project monitored for ${DEPARTMENTS.find(d => d.id === def.dept)!.code}. ${def.sector}-sector work in ${def.district}, ${def.state}, executed by ${pick(CONTRACTORS)} under ${pick(["EPC", "Item-rate", "Hybrid EPC"])} contract.`,
      status: def.status, departmentId: def.dept, sector: def.sector, scheme: def.scheme,
      state: def.state, district: def.district, latitude: def.lat, longitude: def.lng,
      startDate: startDate.toISOString(), targetDate: targetDate.toISOString(),
      estimatedEndDate: def.tier === "C" ? shiftDays(targetDate, 150).toISOString() : def.tier === "A" ? shiftDays(targetDate, 44).toISOString() : undefined,
      actualEndDate: def.status === "COMPLETED" ? shiftDays(targetDate, -3).toISOString() : undefined,
      durationMonths: def.dur, progress: def.progress,
      totalBudget: def.budgetL, spentBudget: spent, projectedBudget: projected,
      healthScore: 100, healthStatus: "HEALTHY",
      scheduleScore: 100, budgetScore: 100, resourceScore: 100, milestoneScore: 100,
      healthComputedAt: shiftHours(ANCHOR, -3).toISOString(),
      projectManager: def.pm, contractor: pick(CONTRACTORS), teamSize: def.team ?? randInt(45, 160),
      story: def.tier ? { tier: def.tier, narrative: def.story! } : undefined,
      createdAt: shiftMonths(startDate, -2).toISOString(),
      milestones: [], tasks: [], budgetRecords: [], resources: [], documents: [], alerts: [],
    };

    p.milestones = buildMilestones(p, def);
    p.tasks = buildTasks(p, def);
    p.budgetRecords = buildBudgetRecords(p, def);
    p.resources = buildResources(p, def);
    p.documents = buildDocuments(p, def);

    // Health: documented story numbers for the 4 narrative projects, formula elsewhere
    const seed = (idx + 3) * 37 + def.name.length * 13;
    const base = 80 + (seed % 15);
    const clampNum = (v: number) => Math.max(56, Math.min(97, v));
    p.scheduleScore = target ? target.schedule : clampNum(base + ((seed * 3) % 11) - 5);
    p.budgetScore = target ? target.budget : clampNum(base + ((seed * 5) % 11) - 5);
    p.resourceScore = target ? target.resources : clampNum(base + ((seed * 7) % 11) - 5);
    p.milestoneScore = target ? target.milestones : clampNum(base + ((seed * 9) % 11) - 5);
    p.healthScore = Math.round(0.3 * p.scheduleScore + 0.25 * p.budgetScore + 0.2 * p.resourceScore + 0.25 * p.milestoneScore);
    p.healthStatus = p.healthScore >= 75 ? "HEALTHY" : p.healthScore >= 50 ? "AT_RISK" : "CRITICAL";

    if (p.status === "ACTIVE" || p.status === "ON_HOLD") {
      p.prediction = computeDelayPrediction(p);
    }
    p.alerts = buildAlerts(p, def);
    p.riskAssessment = buildRiskAssessment(p, def);
    projects.push(p);
  });

  // Extra policy document attached to portfolio (searchable corpus)
  const policy: DocumentItem = {
    id: "doc-policy-flash", projectId: "prj-01", fileName: "MoSPI Flash Report Guidance Note.pdf", fileType: "pdf",
    fileSize: 219 * 1024, uploadedAt: shiftDays(ANCHOR, -120).toISOString(), uploadedBy: "Arun Kulkarni",
    status: "PROCESSED", totalPages: 6, ocrConfidence: 0.97,
    summary: "Policy extract: flash-report SLAs, 10%/20% overrun escalation bands, time-overrun reporting rules — the source of the platform's alert thresholds.",
    extractedData: {
      fields: [
        { field: "flash_report_sla", value: "7 working days", confidence: 0.97, sourcePage: 1 },
        { field: "overrun_watch_band", value: ">10%", confidence: 0.96, sourcePage: 2 },
        { field: "escalation_band", value: ">20% to CCEA", confidence: 0.96, sourcePage: 2 },
      ],
      keyFindings: ["10% OVERUN-WATCH", "20% Cabinet escalation"], risks: ["Accountability remains with the officer"],
      sentiment: { score: 0.2, label: "neutral" },
    },
    text: POLICY_NOTE, processingMs: 21000,
  };
  projects[0].documents.push(policy);

  // Global audit (cross-portfolio)
  const globalAudit: AuditLogEntry[] = [
    { id: "ga-1", action: "LOGIN", entity: "Session", details: "SSO session established (HS256 JWT · 24h) · 3-domain handoff token issued", userName: "Arun Kulkarni", userRole: "ADMIN", timestamp: shiftHours(new Date(), -5).toISOString() },
    { id: "ga-2", action: "PREDICTION_RUN", entity: "CronJob", details: "6-hourly batch scoring: 26 ACTIVE projects scored · 3 level-change alerts suppressed (no level change)", userName: "scheduler", userRole: "ADMIN", timestamp: shiftHours(new Date(), -3).toISOString() },
    { id: "ga-3", action: "UPLOAD", entity: "Document", details: "Bharatmala Aug-2026 monthly report ingested → read → structured → 27 fields validated → dashboard updated", userName: "Rahul Sharma", userRole: "PROJECT_MANAGER", timestamp: shiftDays(ANCHOR, -9).toISOString() },
    { id: "ga-4", action: "EMAIL_SEND", entity: "Email", details: "Critical alert email dispatched to alert-critical@mospi.gov.in (Gmail email service) · template critical_alert", userName: "system", userRole: "ADMIN", timestamp: shiftDays(ANCHOR, -2).toISOString() },
  ];
  projects.forEach(p => globalAudit.push(...buildAuditTrail(p, DEFS[projects.indexOf(p)])));

  const now = new Date();
  const notifications: Notification[] = [
    { id: "nt-1", userId: "all", title: "🔴 Critical: Bundelkhand health entered Red", message: "Jal Jeevan Water Grid health 33 — R10 verification required before escalation.", type: "ALERT", isRead: false, createdAt: new Date(now.getTime() - 34 * 60000).toISOString(), linkView: "alerts", linkProjectId: "prj-03" },
    { id: "nt-2", userId: "all", title: "Prediction run completed", message: "26 active projects re-scored · Bharatmala delay probability 75% (↑2 pts) · model AssurePredict 2.3.", type: "PREDICTION", isRead: false, createdAt: new Date(now.getTime() - 3 * 3600000).toISOString(), linkView: "ai-assistant" },
    { id: "nt-3", userId: "all", title: "Document processed", message: "Bharatmala Aug-2026 report: 27 fields auto-populated from 15 pages in 41s.", type: "DOCUMENT", isRead: false, createdAt: new Date(now.getTime() - 26 * 3600000).toISOString(), linkView: "reports", linkProjectId: "prj-01" },
    { id: "nt-4", userId: "all", title: "Weekly digest delivered", message: "Portfolio pulse: 26 Healthy · 3 At-Risk · 1 Critical · ₹42.6k Cr sanctioned.", type: "EMAIL", isRead: true, createdAt: new Date(now.getTime() - 30 * 3600000).toISOString(), linkView: "email-center" },
    { id: "nt-5", userId: "u-sec", title: "Welcome to ProjectAssure", message: "Your Portfolio Overseer console is ready. 30 projects are being monitored. Try ⌘K.", type: "SYSTEM", isRead: true, createdAt: shiftDays(ANCHOR, -30).toISOString() },
  ];

  const emails: EmailMessage[] = [
    { id: "em-1", to: "alert-critical@mospi.gov.in", toName: "MoSPI Critical Alerts", subject: "🔴 CRITICAL — Jal Jeevan Bundelkhand entered Red band (health 33)", body: "Rule R10 verification required...", template: "critical_alert", status: "SIMULATED", createdAt: shiftDays(ANCHOR, -2).toISOString(), sentAt: shiftDays(ANCHOR, -2).toISOString(), provider: "demo-outbox", attachments: [], projectId: "prj-03" },
    { id: "em-2", to: "arun.kulkarni@mospi.gov.in", subject: "Weekly Portfolio Digest — 30 projects", body: "Portfolio pulse: 26/3/1...", template: "weekly_digest", status: "SENT", createdAt: new Date(now.getTime() - 30 * 3600000).toISOString(), sentAt: new Date(now.getTime() - 30 * 3600000).toISOString(), provider: "smtp-gmail", attachments: [{ name: "portfolio-digest-2026-09-07.pdf", kind: "pdf", sizeKb: 312 }], replyTo: "noreply@projectassure.in" },
    { id: "em-3", to: "meera.nair@pmo.gov.in", subject: "Executive Status Report — Bharatmala P-4", body: "Attached: 4-page executive report...", template: "report_delivery", status: "SENT", createdAt: new Date(now.getTime() - 22 * 3600000).toISOString(), sentAt: new Date(now.getTime() - 22 * 3600000).toISOString(), provider: "smtp-gmail", attachments: [{ name: "PRJ-2026-1071-executive.pdf", kind: "pdf", sizeKb: 268 }], projectId: "prj-01" },
  ];

  return { projects, globalAudit, notifications, emails, users: USERS.map(u => ({ ...u, lastLoginAt: shiftHours(new Date(), -5).toISOString() })), departments: DEPARTMENTS };
}

function shiftHours(d: Date, h: number) { return new Date(d.getTime() + h * 3600000); }
