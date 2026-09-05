// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — Email service.
// Demo mode: full outbox with realistic previews (honest SIMULATED badge).
// Production: POST /api/email/send → Nodemailer (Gmail App Password) or
// Resend — identical payload, real delivery. Zero config difference.
// ═══════════════════════════════════════════════════════════════════════════
import type { EmailMessage, EmailTemplateId, Project, PortfolioStats, User, EmailAttachment } from "./types";
import { inr, shortDate } from "./format";
import { uid } from "./format";

export const EMAIL_TEMPLATES: { id: EmailTemplateId; title: string; desc: string; subjectPattern: string }[] = [
  { id: "critical_alert", title: "Critical Alert", desc: "Fires when health enters the Red band (0–49). Immediate delivery.", subjectPattern: "🔴 CRITICAL — {project} entered Red band (health {health})" },
  { id: "high_alert", title: "High Alert", desc: "Delay probability crossing the email threshold (≥70%). Immediate.", subjectPattern: "⚠️ HIGH — {project} delay probability {prob}%" },
  { id: "weekly_digest", title: "Weekly Digest", desc: "Monday 08:00 IST portfolio pulse with exception list.", subjectPattern: "Weekly Portfolio Digest — {count} projects" },
  { id: "report_delivery", title: "Report Delivery", desc: "Delivers generated PDF/Excel reports to any recipient.", subjectPattern: "📊 {report} — ProjectAssure" },
  { id: "document_processed", title: "Document Processed", desc: "Confirms smart-reading → structuring → validation completion with field counts.", subjectPattern: "Document processed — {doc}" },
  { id: "welcome", title: "Welcome", desc: "Onboarding for new users with RBAC scope summary.", subjectPattern: "Welcome to ProjectAssure, {name}" },
];

export function buildEmail(template: EmailTemplateId, ctx: Partial<{ project: Project; stats: PortfolioStats; user: User; reportName: string; docName: string; customSubject: string; customBody: string; to: string }>): { subject: string; body: string } {
  const p = ctx.project;
  switch (template) {
    case "critical_alert":
      return {
        subject: `🔴 CRITICAL — ${p?.name ?? "Project"} entered the Red band (health ${p?.healthScore ?? "—"})`,
        body: `**${p?.name}** has crossed into the CRITICAL band.\n\n* Health score: **${p?.healthScore}/100** (${p?.healthStatus})\n* Schedule ${p?.scheduleScore} · Budget ${p?.budgetScore} · Resources ${p?.resourceScore} · Milestones ${p?.milestoneScore}\n* Progress: ${p?.progress}% · spent ${inr(p?.spentBudget ?? 0)} of ${inr(p?.totalBudget ?? 0)}\n* Prediction: ${p?.prediction ? `${Math.round(p.prediction.probability * 100)}% delay probability, ${p.prediction.estimatedDays}-day slip (90% CI ${p.prediction.ciLower}–${p.prediction.ciUpper})` : "n/a"}\n\n**Recommended action:** ${p?.alerts[0]?.recommendedAction ?? "Verify field data with the executive engineer."}\n**Owner:** ${p?.alerts[0]?.recommendedOwner ?? p?.projectManager}\n**Deadline:** ${p?.alerts[0]?.recommendedDeadline ?? "48 hours"}\n\nRule R10: this alert requires verification by the responsible human officer before escalation.\n\n— ProjectAssure Alert Engine · ${new Date().toLocaleString("en-IN")}`,
      };
    case "high_alert":
      return {
        subject: `⚠️ HIGH — ${p?.name}: delay probability ${p?.prediction ? Math.round(p.prediction.probability * 100) : "—"}%`,
        body: `The 18-signal delay model (${p?.prediction?.modelVersion}) flags **${p?.name}**:\n\n* Probability: **${p?.prediction ? Math.round(p.prediction.probability * 100) : "—"}%**\n* Estimated slip: ${p?.prediction?.estimatedDays ?? "—"} days (90% CI ${p?.prediction?.ciLower}–${p?.prediction?.ciUpper})\n* Top factor: ${p?.prediction?.factors[0]?.label} — ${p?.prediction?.factors[0]?.plainLanguage}\n\nAdvisory probability; verify with the field officer (rule R10).\n\n— ProjectAssure Alert Engine`,
      };
    case "weekly_digest":
      return {
        subject: `Weekly Portfolio Digest — ${ctx.stats?.totalProjects ?? 30} projects`,
        body: `**Portfolio Pulse**\n* ${ctx.stats?.totalProjects ?? 0} projects · ${ctx.stats?.healthy ?? 0} Healthy · ${ctx.stats?.atRisk ?? 0} At-Risk · ${ctx.stats?.critical ?? 0} Critical\n* Sanctioned ${inr(ctx.stats?.totalBudget ?? 0)} · spent ${inr(ctx.stats?.totalSpent ?? 0)}\n* Average health ${ctx.stats?.avgHealth ?? "—"}/100 · ${ctx.stats?.alertsUnread ?? 0} unread alerts\n\n**Requiring attention (worst first):**\n${(ctx.project ? [ctx.project] : []).map(x => `* ${x.name} — health ${x.healthScore}: ${(x.alerts[0] ?? { title: "monitor" }).title}`).join("\n")}\n\nOpen the Command Centre for the full ranking and factor explanations.\n\n— ProjectAssure weekly cron · Monday 08:00 IST`,
      };
    case "report_delivery":
      return {
        subject: `📊 ${ctx.reportName ?? "Report"} — ProjectAssure`,
        body: `Please find attached: **${ctx.reportName ?? "report"}**.\n\nGenerated from live portfolio data and audit-logged. Figures are grounded in the current data-freshness stamp; predictions carry model version and confidence.\n\nReply to this email with questions, or open the project in ProjectAssure for the full drill-down.\n\n— ProjectAssure Reports`,
      };
    case "document_processed":
      return {
        subject: `Document processed — ${ctx.docName ?? "upload"}`,
        body: `**${ctx.docName ?? "Document"}** completed the ingestion pipeline.\n\nStages: secure upload → smart text reading (English + Hindi) → Smart structuring → strict validation → dashboard sync.\n\nThe affected project's dashboards and predictions were refreshed automatically.\n\n— ProjectAssure Document Engine`,
      };
    case "welcome":
      return {
        subject: `Welcome to ProjectAssure, ${ctx.user?.name ?? "colleague"}`,
        body: `Namaste ${ctx.user?.name ?? ""},\n\nYour **${ctx.user?.role}** account is active with scope *${ctx.user?.designation}*.\n\n* Command Centre: 30 seeded demo projects, live health rings\n* Assure Intelligence: ask "Why is Bharatmala P-4 at risk?" for grounded answers\n* Reports: one-click PDF/Excel exports (audit-logged)\n\nYour session SSO is valid across the main, analytics and intelligence domains.\n\n— Team NEXGEN · SIH 2026`,
      };
    default:
      return { subject: ctx.customSubject ?? "ProjectAssure message", body: ctx.customBody ?? "" };
  }
}

export function composeEmail(opts: {
  to: string; toName?: string; template: EmailTemplateId; subject?: string; body?: string;
  attachments?: EmailAttachment[]; projectId?: string; project?: Project; stats?: PortfolioStats; reportName?: string; docName?: string; user?: User;
}): EmailMessage {
  const built = buildEmail(opts.template, { project: opts.project, stats: opts.stats, reportName: opts.reportName, docName: opts.docName, user: opts.user, customSubject: opts.subject, customBody: opts.body });
  return {
    id: uid("em"), to: opts.to, toName: opts.toName,
    subject: opts.subject ?? built.subject, body: opts.body ?? built.body,
    template: opts.template, status: "QUEUED", createdAt: new Date().toISOString(),
    attachments: opts.attachments ?? [], projectId: opts.projectId,
  };
}

/** Send through the real API when provider keys exist; otherwise outbox-simulate.
 *  v3: HTTP 502 (provider rejected / unreachable) → honest FAILED status with
 *  the reason + hint, so email service misconfigurations no longer masquerade as
 *  "demo outbox". Outbox mode (200 + sent:false without provider error) stays
 *  SIMULATED. Returns the updated message with provider + status. */
export async function sendEmail(msg: EmailMessage): Promise<EmailMessage> {
  try {
    const res = await fetch("/api/email/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: msg.to, toName: msg.toName, subject: msg.subject, body: msg.body, template: msg.template, attachments: msg.attachments }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.sent) return { ...msg, status: "SENT", sentAt: new Date().toISOString(), provider: data.provider ?? "smtp-gmail" };
    const providerError = typeof data.provider === "string" && data.provider !== "demo-outbox";
    if (res.status === 502 || providerError) {
      return { ...msg, status: "FAILED", sentAt: new Date().toISOString(), provider: String(data.provider ?? "unknown"), error: String(data.reason ?? "delivery failed"), hint: data.hint ? String(data.hint) : undefined };
    }
    return { ...msg, status: "SIMULATED", sentAt: new Date().toISOString(), provider: "demo-outbox", error: data.reason ? String(data.reason) : undefined, hint: data.hint ? String(data.hint) : undefined };
  } catch {
    return { ...msg, status: "FAILED", sentAt: new Date().toISOString(), provider: "network", error: "network_error: could not reach /api/email/send — is the server running?", hint: "Retry in a moment; if this persists the dev server may have restarted." };
  }
}

export function emailPreviewText(msg: EmailMessage): string {
  return msg.body.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").slice(0, 260);
}

export function alertEmailTargets(p: Project): string[] {
  // neutral demo domain — never a real address (configurable via email settings)
  return [`${p.projectManager.toLowerCase().replace(/[^a-z]+/g, ".")}@projectassure.demo`, "critical-alerts@projectassure.demo"];
}

export function reportAttachment(name: string, kind: EmailAttachment["kind"], sizeKb: number): EmailAttachment {
  return { name, kind, sizeKb };
}
