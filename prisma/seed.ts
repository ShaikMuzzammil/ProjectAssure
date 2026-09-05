// ProjectAssure — Prisma seed (connected mode).
// Creates the MoSPI organisation, 5 divisions, the 6 demo personas (scrypt
// hashes) and one flagship project so the live-database mode boots complete.
// Run: bunx prisma db push && bunx prisma db seed  (or: bun prisma/seed.ts)

import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "crypto";

const db = new PrismaClient();

function hash(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

const DEPARTMENTS = [
  { name: "Infrastructure & Project Monitoring Division", code: "IPMD" },
  { name: "National Accounts Division", code: "NASD" },
  { name: "Social Statistics Division", code: "SOSD" },
  { name: "Economic Statistics Division", code: "ECSD" },
  { name: "Capacity Building Division", code: "CAPB" },
];

const USERS = [
  { name: "Arun Kulkarni", email: "arun.kulkarni@mospi.gov.in", password: "overseer", role: "ADMIN", dept: "IPMD", designation: "Joint Secretary, MoSPI", persona: "The Portfolio Overseer" },
  { name: "Priya Venkatesh", email: "priya.venkatesh@mospi.gov.in", password: "minister", role: "PROJECT_MANAGER", dept: "IPMD", designation: "Director (Projects), IPMD", persona: "The Ministry Project Manager" },
  { name: "Rahul Sharma", email: "rahul.sharma@rd.tn.gov.in", password: "field", role: "PROJECT_MANAGER", dept: "SOSD", designation: "Executive Engineer, TN PWD", persona: "The Field Reporting Officer" },
  { name: "Sneha Iyer", email: "sneha.iyer@mospi.gov.in", password: "analyst", role: "STAKEHOLDER", dept: "IPMD", designation: "Deputy Director (Analysis), IPMD", persona: "The MoSPI Data Analyst" },
  { name: "Vikram Desai", email: "vikram.desai@cag.gov.in", password: "audit", role: "STAKEHOLDER", dept: "ECSD", designation: "Senior Audit Officer, CAG", persona: "The Accountability Auditor" },
  { name: "Meera Nair", email: "meera.nair@pmo.gov.in", password: "observer", role: "VIEWER", dept: "IPMD", designation: "Director, PMO Coordination", persona: "The Strategic Observer" },
];

async function main() {
  const org = await db.organization.upsert({ where: { code: "MOSPI" }, update: {}, create: { name: "Ministry of Statistics and Programme Implementation", code: "MOSPI" } });
  const deptMap = new Map<string, string>();
  for (const d of DEPARTMENTS) {
    const dept = await db.department.upsert({ where: { code: d.code }, update: {}, create: { ...d, organizationId: org.id } });
    deptMap.set(d.code, dept.id);
  }
  for (const u of USERS) {
    await db.user.upsert({
      where: { email: u.email },
      update: { role: u.role },
      create: {
        name: u.name, email: u.email, passwordHash: hash(u.password), role: u.role,
        departmentId: deptMap.get(u.dept)!, designation: u.designation,
        avatarInitials: u.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      },
    });
  }
  const flagship = await db.project.upsert({
    where: { psId: "PRJ-2026-1071" },
    update: {},
    create: {
      psId: "PRJ-2026-1071",
      name: "Bharatmala P-4 · TN-04 Corridor Upgrade (Karur–Dindigul)",
      description: "Bharatmala Pariyojana corridor monitoring — roads sector, Tamil Nadu.",
      status: "ACTIVE", healthScore: 58, healthStatus: "AT_RISK",
      scheduleScore: 61, budgetScore: 52, resourceScore: 70, milestoneScore: 50,
      startDate: new Date("2024-10-25"), targetDate: new Date("2027-02-20"),
      estimatedEndDate: new Date("2027-04-04"), durationMonths: 28, progress: 58,
      totalBudget: 145000, spentBudget: 127600, projectedBudget: 152700,
      state: "Tamil Nadu", district: "Karur", latitude: 10.96, longitude: 78.08,
      sector: "Roads", scheme: "Bharatmala Pariyojana", departmentId: deptMap.get("IPMD")!,
    },
  });
  await db.auditLog.create({
    data: { action: "CREATE", entity: "Project", entityId: flagship.id, details: `Seeded flagship ${flagship.psId} (health 58, AT_RISK) for connected-mode demo` },
  }).catch(() => {});
  console.log("Seed complete:", { org: org.code, departments: DEPARTMENTS.length, users: USERS.length, flagship: flagship.psId });
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
