import { requireHost } from "@/lib/host/auth";
import { getStore } from "@/lib/host/store";
import { budgetOverrunPct } from "@/lib/host/sync";
import { csvEscape } from "@/lib/host/format";

export const dynamic = "force-dynamic";

// GET /api/admin/export — CSV export of ALL mirrored projects (real data).
export async function GET(req: Request) {
  const gate = requireHost(req);
  if (!gate.ok) return gate.res;

  const projects = getStore().data.mirror.projects;
  const header = [
    "psId", "name", "department", "state", "district", "sector", "status",
    "progressPct", "health", "delayRisk", "budgetTotalCr", "budgetSpentCr",
    "budgetOverrunPct", "ownerName", "milestonesTotal", "milestonesCompleted",
    "milestonesDelayed", "lastActivityAt",
  ];
  const rows = projects.map((p) =>
    [
      p.psId, p.name, p.department, p.state, p.district ?? "", p.sector, p.status,
      p.progress, p.health, p.delayRisk, p.budgetTotalCr, p.budgetSpentCr,
      budgetOverrunPct(p).toFixed(1), p.ownerName, p.milestonesTotal,
      p.milestonesCompleted, p.milestonesDelayed, p.lastActivityAt ?? "",
    ].map(csvEscape).join(","),
  );

  const csv = [header.join(","), ...rows].join("\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="projectassure-projects-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
