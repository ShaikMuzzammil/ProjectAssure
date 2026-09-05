import { NextResponse } from "next/server";
import { runChat } from "@/lib/host/ai";
import { getState } from "@/lib/host/store";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  const { question } = await req.json();
  const s = getState();
  const ctx = s.projects.slice(0, 10).map(p => `${p.psId} "${p.name}" | health ${p.healthScore} (${p.healthStatus}) | ₹${p.totalBudgetL}L spent ₹${p.spentBudgetL}L projected ₹${p.projectedBudgetL}L | variance ${p.variancePct.toFixed(1)}%`).join("\n");
  const answer = await runChat(String(question).slice(0, 800), ctx);
  return NextResponse.json({ answer, freshness: `Live · ${new Date().toLocaleTimeString("en-IN")} IST` });
}
