/* ============================================================
 * ProjectAssure — Deterministic demo data engine
 * Implements the seeding strategy from md/04_DATABASE_SCHEMA.md:
 * 30 projects (27 HEALTHY / 2 AT_RISK / 1 CRITICAL), mulberry32(42),
 * milestones, tasks, budgets, resources, risks, alerts, documents,
 * audit trail. All data reproducible on every reload.
 * ============================================================ */

import type {
  Alert, AuditLogEntry, BudgetRecord, Department, DocumentItem, Milestone,
  Project, ProjectStatus, ResourceAllocation, RiskAssessment, Task, User,
} from "./types";

/* ── deterministic PRNG ─────────────────────────────────── */
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(42);
const rand = (min: number, max: number) => min + rnd() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

const DAY = 86400000;
const NOW = new Date();
const iso = (d: Date) => d.toISOString();
const monthsAgo = (m: number) => iso(new Date(NOW.getTime() - m * 30 * DAY));
const monthsAhead = (m: number) => iso(new Date(NOW.getTime() + m * 30 * DAY));

/* ── departments (MoSPI, from doc 04) ───────────────────── */
export const DEPARTMENTS: Department[] = [
  { id: "dept-ipmd", name: "Infrastructure & Project Monitoring", code: "IPMD" },
  { id: "dept-nat", name: "National Accounts", code: "NASD" },
  { id: "dept-soc", name: "Social Statistics", code: "SOSD" },
  { id: "dept-eco", name: "Economic Statistics", code: "ECSD" },
  { id: "dept-cb", name: "Capacity Building", code: "CAPB" },
];

/* ── users & personas (doc 01 §5) ───────────────────────── */
export const USERS: User[] = [
  {
    id: "u-sec", name: "Arun Kulkarni", email: "arun.kulkarni@mospi.gov.in", role: "ADMIN",
    departmentId: "dept-ipmd", avatarInitials: "AK", designation: "Joint Secretary, MoSPI",
    persona: "The Portfolio Overseer",
    personaDescription: "Watches 1,800+ projects on one screen. Needs the 10-second portfolio pulse and instant escalation paths.",
  },
  {
    id: "u-pm", name: "Priya Venkatesh", email: "priya.v@mospi.gov.in", role: "PROJECT_MANAGER",
    departmentId: "dept-ipmd", avatarInitials: "PV", designation: "Project Manager, IPMD",
    persona: "The Ministry Project Manager",
    personaDescription: "Manages 10-30 projects in one ministry. Lives in Gantt charts and milestone dependencies.",
  },
  {
    id: "u-field", name: "Rahul Sharma", email: "rahul.s@mospi.gov.in", role: "PROJECT_MANAGER",
    departmentId: "dept-nat", avatarInitials: "RS", designation: "Field Reporting Officer, District Cell",
    persona: "The Field Reporting Officer",
    personaDescription: "Uploads site reports from the field. PWA offline mode + photo captures are his lifeline.",
  },
  {
    id: "u-analyst", name: "Sneha Iyer", email: "sneha.iyer@mospi.gov.in", role: "STAKEHOLDER",
    departmentId: "dept-eco", avatarInitials: "SI", designation: "Data Analyst, Flash Report Cell",
    persona: "The MoSPI Data Analyst",
    personaDescription: "Compiles 27,000 pages of monthly reports. Document AI does the reading, she does the validation.",
  },
  {
    id: "u-auditor", name: "Vikram Desai", email: "vikram.desai@mospi.gov.in", role: "STAKEHOLDER",
    departmentId: "dept-soc", avatarInitials: "VD", designation: "Parliamentary Committee Support",
    persona: "The Accountability Auditor",
    personaDescription: "Needs full audit trails, cost-overrun histories and exportable evidence for standing committee reviews.",
  },
  {
    id: "u-pmo", name: "Meera Nair", email: "meera.nair@mospi.gov.in", role: "VIEWER",
    departmentId: "dept-cb", avatarInitials: "MN", designation: "Observer, Strategic Projects Cell",
    persona: "The Strategic Observer",
    personaDescription: "Tracks nationally critical flagship projects. Read-only, calm, exception-first dashboards.",
  },
];

export const ROLES_CONFIG = [
  { role: "ADMIN", label: "Administrator", users: "1", capabilities: ["Full platform control", "User & role management", "Threshold configuration", "Delete projects", "View audit trail"] },
  { role: "PROJECT_MANAGER", label: "Project Manager", users: "2", capabilities: ["Create / edit own projects", "Milestones & tasks", "Upload documents", "Run predictions", "Respond to alerts"] },
  { role: "STAKEHOLDER", label: "Stakeholder / Analyst", users: "2", capabilities: ["Read all dashboards", "Export reports", "Chat with AI assistant", "View audit trail", "No mutations"] },
  { role: "VIEWER", label: "Viewer / Observer", users: "1", capabilities: ["Read dashboards", "Flagship project views", "Export summary", "No mutations", "No audit access"] },
];

/* ── 30 project definitions ─────────────────────────────── */
interface ProjDef {
  name: string; sector: string; scheme: string; state: string; district: string;
  lat: number; lng: number; budget: number; // lakhs
  durMonths: number; startAgo: number; progress: number;
  status: ProjectStatus; dept: string; health?: "R" | "A" | "C";
  pm: string; contractor: string; story?: string;
}

const PMS = ["Priya Venkatesh", "Rahul Sharma", "Anand Rao", "Kavita Joshi", "Suresh Pillai", "Deepak Mehta"];
const CONTRACTORS = ["L&T Infra Ltd", "NCC Ltd", "IRCON Intl", "Tata Projects", "Afcons Infra", "GR Infraprojects", "PNC Infratech", "Dilip Buildcon"];

const DEFS: ProjDef[] = [
  /* ── THE 3 FLAGGED (demo story) ── */
  {
    name: "Bharatmala P-4 Corridor Monitoring", sector: "Roads", scheme: "Bharatmala Pariyojana",
    state: "Tamil Nadu", district: "Chennai", lat: 13.0827, lng: 80.2707,
    budget: 14500, durMonths: 30, startAgo: 16, progress: 47.5, status: "ACTIVE", dept: "dept-ipmd", health: "A",
    pm: "Priya Venkatesh", contractor: "L&T Infra Ltd",
    story: "Flagship corridor. Steel procurement pending 18 days has blocked pier casting on 3 critical milestones; monsoon window adds seasonal risk.",
  },
  {
    name: "ICCC Prayagraj Command Centre Phase-2", sector: "Urban", scheme: "Smart Cities Mission",
    state: "Uttar Pradesh", district: "Prayagraj", lat: 25.4358, lng: 81.8463,
    budget: 4250, durMonths: 18, startAgo: 13, progress: 62, status: "ACTIVE", dept: "dept-ipmd", health: "A",
    pm: "Anand Rao", contractor: "Tata Projects",
    story: "Burn rate running 28% ahead of plan while integration milestones slip — classic cost-pressure profile caught by the velocity deviation feature.",
  },
  {
    name: "Jal Jeevan Rural Grid Bundelkhand", sector: "Water", scheme: "Jal Jeevan Mission",
    state: "Madhya Pradesh", district: "Chhatarpur", lat: 24.9167, lng: 79.5833,
    budget: 9800, durMonths: 24, startAgo: 19, progress: 38, status: "ACTIVE", dept: "dept-nat", health: "C",
    pm: "Kavita Joshi", contractor: "Dilip Buildcon",
    story: "Permit stalemate on forest clearance plus 41% budget burn against 19% schedule progress. Critical-path exposure at 0.62 — worst in portfolio.",
  },
  /* ── 27 HEALTHY ── */
  { name: "NH-44 Krishnagiri Bypass Widening", sector: "Roads", scheme: "Bharatmala Pariyojana", state: "Tamil Nadu", district: "Krishnagiri", lat: 12.5186, lng: 78.2137, budget: 22000, durMonths: 30, startAgo: 18, progress: 76, status: "ACTIVE", dept: "dept-ipmd", pm: "Priya Venkatesh", contractor: "GR Infraprojects" },
  { name: "PM-ABHIM Critical Care Block Lucknow", sector: "Health", scheme: "PM-ABHIM", state: "Uttar Pradesh", district: "Lucknow", lat: 26.8467, lng: 80.9462, budget: 6800, durMonths: 20, startAgo: 10, progress: 58, status: "ACTIVE", dept: "dept-soc", pm: "Suresh Pillai", contractor: "NCC Ltd" },
  { name: "AIIMS Annexe Super-Speciality Madurai", sector: "Health", scheme: "PMSSY", state: "Tamil Nadu", district: "Madurai", lat: 9.9252, lng: 78.1198, budget: 8200, durMonths: 26, startAgo: 14, progress: 52, status: "ACTIVE", dept: "dept-soc", pm: "Kavita Joshi", contractor: "Afcons Infra" },
  { name: "Amrit Sarovar Restoration Phase-III", sector: "Water", scheme: "Amrit Sarovar", state: "Rajasthan", district: "Jaipur", lat: 26.9124, lng: 75.7873, budget: 2400, durMonths: 14, startAgo: 6, progress: 71, status: "ACTIVE", dept: "dept-nat", pm: "Deepak Mehta", contractor: "PNC Infratech" },
  { name: "Smart City ICC Bhopal Phase-2", sector: "Urban", scheme: "Smart Cities Mission", state: "Madhya Pradesh", district: "Bhopal", lat: 23.2599, lng: 77.4126, budget: 3100, durMonths: 16, startAgo: 5, progress: 44, status: "ACTIVE", dept: "dept-ipmd", pm: "Anand Rao", contractor: "Tata Projects" },
  { name: "Vidya Samiksha Kendra Gujarat", sector: "Education", scheme: "NEP 2020", state: "Gujarat", district: "Gandhinagar", lat: 23.2156, lng: 72.6369, budget: 1650, durMonths: 12, startAgo: 4, progress: 67, status: "ACTIVE", dept: "dept-soc", pm: "Deepak Mehta", contractor: "NCC Ltd" },
  { name: "AMRUT 2.0 Water Supply Kolhapur", sector: "Water", scheme: "AMRUT 2.0", state: "Maharashtra", district: "Kolhapur", lat: 16.7050, lng: 74.2433, budget: 5600, durMonths: 22, startAgo: 11, progress: 55, status: "ACTIVE", dept: "dept-nat", pm: "Suresh Pillai", contractor: "IRCON Intl" },
  { name: "Chardham Road Broadening Package-7", sector: "Roads", scheme: "Chardham Mahamarg", state: "Uttarakhand", district: "Rudraprayag", lat: 30.2839, lng: 78.9719, budget: 12700, durMonths: 28, startAgo: 15, progress: 69, status: "ACTIVE", dept: "dept-ipmd", pm: "Priya Venkatesh", contractor: "Afcons Infra" },
  { name: "Kolkata East-West Metro Extension", sector: "Urban", scheme: "Metro Rail Policy", state: "West Bengal", district: "Kolkata", lat: 22.5726, lng: 88.3639, budget: 18400, durMonths: 34, startAgo: 20, progress: 63, status: "ACTIVE", dept: "dept-ipmd", pm: "Anand Rao", contractor: "IRCON Intl" },
  { name: "Delhi-Meerut RRTS O&M Systems", sector: "Urban", scheme: "RRTS", state: "Uttar Pradesh", district: "Ghaziabad", lat: 28.6692, lng: 77.4538, budget: 9600, durMonths: 24, startAgo: 17, progress: 81, status: "ACTIVE", dept: "dept-ipmd", pm: "Suresh Pillai", contractor: "L&T Infra Ltd" },
  { name: "PM-ABHIM Urban Health Centre Hyderabad", sector: "Health", scheme: "PM-ABHIM", state: "Telangana", district: "Hyderabad", lat: 17.3850, lng: 78.4867, budget: 4400, durMonths: 18, startAgo: 8, progress: 61, status: "ACTIVE", dept: "dept-soc", pm: "Kavita Joshi", contractor: "NCC Ltd" },
  { name: "Jal Jeevan Scheme Cuddalore District", sector: "Water", scheme: "Jal Jeevan Mission", state: "Tamil Nadu", district: "Cuddalore", lat: 11.7480, lng: 79.7714, budget: 3900, durMonths: 20, startAgo: 9, progress: 48, status: "ACTIVE", dept: "dept-nat", pm: "Deepak Mehta", contractor: "PNC Infratech" },
  { name: "Bharatmala P-2 Telangana Stretch", sector: "Roads", scheme: "Bharatmala Pariyojana", state: "Telangana", district: "Nalgonda", lat: 17.0544, lng: 79.2670, budget: 15300, durMonths: 30, startAgo: 14, progress: 72, status: "ACTIVE", dept: "dept-ipmd", pm: "Priya Venkatesh", contractor: "GR Infraprojects" },
  { name: "IIT-Hyderabad Research Park Expansion", sector: "Education", scheme: "Higher Education Infra", state: "Telangana", district: "Sangareddy", lat: 17.5947, lng: 78.1237, budget: 2800, durMonths: 16, startAgo: 6, progress: 59, status: "ACTIVE", dept: "dept-soc", pm: "Deepak Mehta", contractor: "Tata Projects" },
  { name: "Chennai Peripheral Ring Road Phase-1", sector: "Roads", scheme: "TN Highway Dev", state: "Tamil Nadu", district: "Thiruvallur", lat: 13.2200, lng: 79.9100, budget: 16800, durMonths: 32, startAgo: 13, progress: 41, status: "ACTIVE", dept: "dept-ipmd", pm: "Anand Rao", contractor: "Dilip Buildcon" },
  { name: "Pune Metro Aqua Line Depot", sector: "Urban", scheme: "Metro Rail Policy", state: "Maharashtra", district: "Pune", lat: 18.5204, lng: 73.8567, budget: 7900, durMonths: 22, startAgo: 12, progress: 66, status: "ACTIVE", dept: "dept-ipmd", pm: "Suresh Pillai", contractor: "L&T Infra Ltd" },
  { name: "Ahmedabad Riverfront Storm Water", sector: "Urban", scheme: "AMRUT", state: "Gujarat", district: "Ahmedabad", lat: 23.0225, lng: 72.5714, budget: 3500, durMonths: 18, startAgo: 10, progress: 74, status: "ACTIVE", dept: "dept-nat", pm: "Deepak Mehta", contractor: "PNC Infratech" },
  { name: "Jaipur Smart Traffic Management", sector: "Urban", scheme: "Smart Cities Mission", state: "Rajasthan", district: "Jaipur", lat: 26.9124, lng: 75.7873, budget: 1900, durMonths: 14, startAgo: 7, progress: 83, status: "ACTIVE", dept: "dept-ipmd", pm: "Anand Rao", contractor: "NCC Ltd" },
  { name: "Kottayam Medical College Upgrade", sector: "Health", scheme: "PMSSY", state: "Kerala", district: "Kottayam", lat: 9.5916, lng: 76.5222, budget: 3100, durMonths: 16, startAgo: 8, progress: 57, status: "ACTIVE", dept: "dept-soc", pm: "Kavita Joshi", contractor: "Afcons Infra" },
  { name: "Narmada Canal Solarisation S-4", sector: "Water", scheme: "KKMP", state: "Gujarat", district: "Bharuch", lat: 21.7051, lng: 72.9956, budget: 4700, durMonths: 20, startAgo: 11, progress: 53, status: "ACTIVE", dept: "dept-nat", pm: "Suresh Pillai", contractor: "IRCON Intl" },
  { name: "Visakhapatnam Port Deepening Berth-6", sector: "Infrastructure", scheme: "Sagarmala", state: "Andhra Pradesh", district: "Visakhapatnam", lat: 17.6868, lng: 83.2185, budget: 11200, durMonths: 26, startAgo: 15, progress: 78, status: "ACTIVE", dept: "dept-ipmd", pm: "Priya Venkatesh", contractor: "Afcons Infra" },
  { name: "Patna Ganga Ghat Rejuvenation", sector: "Urban", scheme: "Namami Gange", state: "Bihar", district: "Patna", lat: 25.5941, lng: 85.1376, budget: 2800, durMonths: 16, startAgo: 7, progress: 64, status: "ACTIVE", dept: "dept-soc", pm: "Kavita Joshi", contractor: "PNC Infratech" },
  { name: "Nashik Gati Shakti Logistics Hub", sector: "Infrastructure", scheme: "PM Gati Shakti", state: "Maharashtra", district: "Nashik", lat: 19.9975, lng: 73.7898, budget: 5400, durMonths: 20, startAgo: 6, progress: 35, status: "ACTIVE", dept: "dept-eco", pm: "Anand Rao", contractor: "Tata Projects" },
  { name: "Srinagar All-Weather Road Link-3", sector: "Roads", scheme: "Bharatmala Pariyojana", state: "Jammu & Kashmir", district: "Srinagar", lat: 34.0837, lng: 74.7973, budget: 8900, durMonths: 24, startAgo: 16, progress: 79, status: "ACTIVE", dept: "dept-ipmd", pm: "Priya Venkatesh", contractor: "IRCON Intl" },
  { name: "Varanasi Sewage Treatment Phase-2", sector: "Water", scheme: "Namami Gange", state: "Uttar Pradesh", district: "Varanasi", lat: 25.3176, lng: 82.9739, budget: 4600, durMonths: 18, startAgo: 22, progress: 100, status: "COMPLETED", dept: "dept-nat", pm: "Suresh Pillai", contractor: "Afcons Infra" },
  { name: "Surat Flood Early Warning Grid", sector: "Urban", scheme: "Smart Cities Mission", state: "Gujarat", district: "Surat", lat: 21.1702, lng: 72.8311, budget: 800, durMonths: 9, startAgo: 1, progress: 8, status: "PLANNING", dept: "dept-eco", pm: "Anand Rao", contractor: "Tata Projects" },
  { name: "Coimbatore Bus Terminal Modernisation", sector: "Urban", scheme: "AMRUT", state: "Tamil Nadu", district: "Coimbatore", lat: 11.0168, lng: 76.9558, budget: 2100, durMonths: 14, startAgo: 9, progress: 44, status: "ON_HOLD", dept: "dept-ipmd", pm: "Kavita Joshi", contractor: "GR Infraprojects" },
];

/* ── milestone templates ────────────────────────────────── */
const MS_TEMPLATES = [
  "Site survey & geotech investigation", "Foundation work complete", "Structure / civil works 50%",
  "Equipment procurement awarded", "Structure / civil works 100%", "Systems integration complete",
  "Testing & commissioning", "Handover & documentation",
];

function buildMilestones(p: ProjDef, projectId: string): Milestone[] {
  const count = randInt(4, 7);
  const criticalIdx = new Set([1, count - 2 >= 1 ? count - 2 : 1]);
  const list: Milestone[] = [];
  const doneByNow = Math.floor((p.progress / 100) * count);
  for (let i = 0; i < count; i++) {
    const planned = new Date(NOW.getTime() - p.startAgo * 30 * DAY + (i * p.durMonths * 30 * DAY) / count);
    let status: Milestone["status"] = "PENDING";
    let progress = 0;
    let actualDate: string | undefined;
    if (i < doneByNow) {
      status = "COMPLETED"; progress = 100; actualDate = iso(planned);
    } else if (i === doneByNow) {
      /* the current milestone: flagged projects show it behind */
      if (p.health === "C" || (p.health === "A" && (i % 2 === 1 || i >= 1))) {
        status = rnd() > 0.5 ? "DELAYED" : "BLOCKED"; progress = randInt(20, 70);
      } else { status = "IN_PROGRESS"; progress = randInt(30, 85); }
    } else {
      /* further out: critical projects also block the next one */
      if (p.health === "C" && i === doneByNow + 1) { status = "BLOCKED"; progress = randInt(5, 25); }
      else if (p.health === "A" && i === doneByNow + 1 && rnd() > 0.5) { status = "DELAYED"; progress = randInt(10, 30); }
      else { status = "PENDING"; progress = 0; }
    }
    if (status === "COMPLETED" && rnd() > 0.75) {
      actualDate = iso(new Date(planned.getTime() + randInt(1, 6) * DAY));
    }
    list.push({
      id: `${projectId}-ms-${i + 1}`, projectId, name: MS_TEMPLATES[i % MS_TEMPLATES.length],
      status, plannedDate: iso(planned), actualDate,
      weight: criticalIdx.has(i) ? 2 : 1, isCritical: criticalIdx.has(i),
      order: i + 1, progress,
    });
  }
  return list;
}

const TASK_TEMPLATES = [
  "Cast pier footing P-{n}", "Procure TMT steel lot {n}", "Pour deck slab segment {n}",
  "Install monitoring sensors {n}", "Site mobilisation batch {n}", "Safety audit round {n}",
  "Quality inspection gate {n}", "Vendor payment milestone {n}",
];
const ASSIGNEES = ["A. Sharma", "V. Krishnan", "M. Bose", "S. Nair", "R. Gupta", "T. Reddy"];

function buildTasks(ms: Milestone[], projectId: string): Task[] {
  const tasks: Task[] = [];
  let n = 1;
  for (const m of ms) {
    const per = randInt(2, 3);
    for (let k = 0; k < per; k++) {
      const start = new Date(m.plannedDate);
      const end = new Date(start.getTime() + randInt(12, 40) * DAY);
      let status: Task["status"] = "NOT_STARTED";
      if (m.status === "COMPLETED") status = "COMPLETED";
      else if (m.status === "IN_PROGRESS") status = k === 0 ? "IN_PROGRESS" : "NOT_STARTED";
      else if (m.status === "DELAYED") status = k === 0 ? "BLOCKED" : k === 1 ? "IN_PROGRESS" : "NOT_STARTED";
      else if (m.status === "BLOCKED") status = k < 2 ? "BLOCKED" : "NOT_STARTED";
      const tStart = new Date(start.getTime() - randInt(5, 15) * DAY);
      tasks.push({
        id: `${projectId}-tk-${n}`, milestoneId: m.id,
        name: TASK_TEMPLATES[(n - 1) % TASK_TEMPLATES.length].replace("{n}", String(n)),
        status, plannedStart: iso(tStart), plannedEnd: iso(end),
        assignee: pick(ASSIGNEES),
        progress: status === "COMPLETED" ? 100 : status === "IN_PROGRESS" ? randInt(25, 80) : status === "BLOCKED" ? randInt(30, 60) : 0,
        isCritical: m.isCritical && k === 0,
      });
      n++;
    }
  }
  return tasks;
}

function buildBudgetRecords(p: ProjDef, projectId: string): BudgetRecord[] {
  const records: BudgetRecord[] = [];
  const elapsedMonths = p.startAgo;
  const plannedPerMonth = (p.budget / p.durMonths) * rand(0.9, 1.15);
  const atRisk = p.health === "A" || p.health === "C";
  const burnFactor = atRisk ? (p.health === "C" ? 1.35 : 1.22) : rand(0.85, 1.08);
  const start = new Date(NOW.getTime() - elapsedMonths * 30 * DAY);
  for (let i = 0; i < elapsedMonths; i++) {
    const d = new Date(start.getTime() + i * 30 * DAY);
    const season = 1 + 0.15 * Math.sin((i / elapsedMonths) * Math.PI * 2);
    const planned = Math.round(plannedPerMonth * season * rand(0.92, 1.08) * 100) / 100;
    const ramp = 0.55 + (i / elapsedMonths) * 0.6;
    const spent = Math.round(planned * burnFactor * ramp * rand(0.85, 1.12) * 100) / 100;
    records.push({ month: d.getMonth() + 1, year: d.getFullYear(), planned, spent });
  }
  return records;
}

const RES_HUMAN = ["Site Engineers", "Survey Crew", "QA/QC Team", "Safety Officers", "Equipment Operators"];
const RES_EQUIP = ["Tower Cranes", "Excavators", "Concrete Batching Plants", "Pavers", "Drilling Rigs"];
const RES_MAT = ["TMT Steel (Fe-500)", "Ready-Mix Concrete", "Bitumen Emulsion", "Cement OPC-53", "Copper Cabling"];

function buildResources(p: ProjDef, projectId: string): ResourceAllocation[] {
  const out: ResourceAllocation[] = [];
  const atRisk = p.health === "A" || p.health === "C";
  RES_HUMAN.slice(0, randInt(2, 3)).forEach((name, i) => out.push({
    id: `${projectId}-rs-h${i}`, category: "HUMAN", name, allocated: randInt(20, 120),
    utilised: Math.round(atRisk ? rand(92, 103) : rand(58, 86)), unit: "persons", status: "allocated",
  }));
  RES_EQUIP.slice(0, randInt(2, 3)).forEach((name, i) => out.push({
    id: `${projectId}-rs-e${i}`, category: "EQUIPMENT", name, allocated: randInt(3, 18),
    utilised: Math.round(atRisk ? rand(88, 99) : rand(50, 82)), unit: "units", status: "allocated",
  }));
  RES_MAT.slice(0, randInt(2, 3)).forEach((name, i) => out.push({
    id: `${projectId}-rs-m${i}`, category: "MATERIAL", name, allocated: randInt(100, 900),
    utilised: Math.round(atRisk ? rand(75, 96) : rand(45, 80)), unit: "tonnes", status: "allocated",
  }));
  return out;
}

const DOC_NAMES = [
  "Monthly Progress Report {m}", "Quarterly Financial Review Q{n}", "Site Inspection Photographs",
  "Quality Audit Certificate", "Environmental Clearance Letter", "Contractor Work Plan {m}",
];

function buildDocuments(p: ProjDef, projectId: string, pm: string): DocumentItem[] {
  const docs: DocumentItem[] = [];
  const count = randInt(2, 5);
  for (let i = 0; i < count; i++) {
    const t = DOC_NAMES[i % DOC_NAMES.length];
    const pages = randInt(8, 28);
    docs.push({
      id: `${projectId}-doc-${i + 1}`, projectId,
      fileName: t.replace("{m}", `${randInt(3, 8)}`).replace("{n}", String(randInt(1, 4))) + ".pdf",
      fileType: "pdf", fileSize: randInt(400, 2600) * 1024, uploadedAt: monthsAgo(rand(0.5, 4)),
      uploadedBy: pm, status: "PROCESSED",
      summary: "Auto-extracted by GPT-4o: progress figures reconciled with dashboard within ±2%; 3 cost lines flagged for review; no contractual deviations detected.",
      extractedData: { fieldsCaptured: randInt(14, 42), totalPages: pages, keyFindings: [
        "Physical progress matches reported figures",
        i % 2 === 0 ? "Minor variance in materials ledger (flagged)" : "All milestone certificates verified",
        "Contractor manpower counts within contractual limits",
      ] },
    });
  }
  return docs;
}

function buildAuditTrail(projectId: string, name: string): AuditLogEntry[] {
  const entries: AuditLogEntry[] = [
    { id: `${projectId}-al-1`, action: "CREATE", entity: "Project", entityId: projectId, details: `Project "${name}" created with ${randInt(4, 7)} milestones`, userName: "Priya Venkatesh", timestamp: monthsAgo(rand(10, 16)) },
    { id: `${projectId}-al-2`, action: "UPDATE", entity: "Milestone", entityId: `${projectId}-ms-2`, details: "Status changed IN_PROGRESS → COMPLETED; health score recomputed", userName: "Rahul Sharma", timestamp: monthsAgo(rand(4, 9)) },
    { id: `${projectId}-al-3`, action: "AI_ACCEPT", entity: "Prediction", entityId: projectId, details: "AI recommendation accepted: expedite steel procurement (owner: Project Manager)", userName: "Priya Venkatesh", timestamp: monthsAgo(rand(1, 3)) },
    { id: `${projectId}-al-4`, action: "UPDATE", entity: "BudgetRecord", entityId: projectId, details: "Monthly spend reconciled from contractor invoice upload", userName: "Sneha Iyer", timestamp: monthsAgo(rand(0.2, 1)) },
    { id: `${projectId}-al-5`, action: "EXPORT", entity: "Report", entityId: projectId, details: "PDF status report exported for review meeting", userName: "Vikram Desai", timestamp: monthsAgo(rand(0.1, 0.8)) },
  ];
  return entries;
}

export { iso, monthsAgo, monthsAhead, rand, randInt, pick, NOW, DAY };
export type { ProjDef };
export { DEFS, buildMilestones, buildTasks, buildBudgetRecords, buildResources, buildDocuments, buildAuditTrail, CONTRACTORS };
