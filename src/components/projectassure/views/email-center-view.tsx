"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useApp } from "@/store/app-store";
import { SectionTitle, EmptyState, Md, PipelineStrip } from "../shared/ui-bits";
import { EMAIL_TEMPLATES, emailPreviewText } from "@/lib/projectassure/email";
import type { EmailTemplateId, EmailStatus } from "@/lib/projectassure/types";
import { relTime, dateTime } from "@/lib/projectassure/format";
import { downloadCsv } from "@/lib/projectassure/reports";
import { can } from "@/lib/projectassure/permissions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mail, Send, Inbox, Paperclip, Check, Clock, FlaskConical, Settings2, RefreshCw, AlertTriangle, Stethoscope, BookOpenCheck, FileDown } from "lucide-react";

const STATUS_STYLE: Record<EmailStatus, { cls: string; icon: React.ElementType }> = {
  SENT: { cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300", icon: Check },
  SIMULATED: { cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300", icon: Clock },
  QUEUED: { cls: "bg-muted text-muted-foreground", icon: Clock },
  FAILED: { cls: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300", icon: AlertTriangle },
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// universal channel label (never exposes the underlying service brand)
const friendlyProvider = (p?: string) =>
  p === "smtp-gmail" || p === "smtp" ? "email service" :
  p === "resend" ? "backup service" :
  p === "brevo" ? "backup service" :
  p === "outbox" || p === "outbox-only" ? "demo outbox" : (p ?? "");

interface EmailDiagnostics {
  provider: string;
  smtp: { configured: boolean; host: string; port: number; from: string | null; verify: { ok: boolean; detail: string } | null };
  brevo: { configured: boolean };
  resend: { configured: boolean };
  checkedAt: string;
}

export default function EmailCenterView() {
  const user = useApp(s => s.user)!;
  const emails = useApp(s => s.emails);
  const queueEmail = useApp(s => s.queueEmail);
  const emailSettings = useApp(s => s.emailSettings);
  const updateEmailSettings = useApp(s => s.updateEmailSettings);
  const projects = useApp(s => s.scoped)();
  type EmailTab = "outbox" | "compose" | "settings";
  const [tab, setTab] = useState<EmailTab>("outbox");
  const [selected, setSelected] = useState<string | null>(null);
  const [testTo, setTestTo] = useState(user.email);
  const [testBusy, setTestBusy] = useState(false);
  const [diag, setDiag] = useState<EmailDiagnostics | null>(null);
  const [diagBusy, setDiagBusy] = useState(false);

  const runDiagnostics = async () => {
    setDiagBusy(true);
    try {
      const res = await fetch("/api/email/status");
      const data = await res.json();
      setDiag(data as EmailDiagnostics);
      toast.info(`Delivery channel: ${data.provider}`, { description: data.smtp?.verify ? (data.smtp.verify.ok ? "email service verified — real delivery is live" : `email service check failed: ${String(data.smtp.verify.detail).slice(0, 90)}`) : "Email service not connected — messages are recorded in the demo outbox (see the deployment guide to connect one)" });
    } catch {
      toast.error("Could not reach /api/email/status — is the server running?");
    } finally {
      setDiagBusy(false);
    }
  };

  // compose state
  const [to, setTo] = useState(user.email);
  const [template, setTemplate] = useState<EmailTemplateId>("critical_alert");
  const [project, setProject] = useState(projects.find(p => p.healthStatus === "CRITICAL")?.id ?? projects[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const sel = emails.find(e => e.id === selected);

  const counts = { SENT: emails.filter(e => e.status === "SENT").length, SIMULATED: emails.filter(e => e.status === "SIMULATED").length, QUEUED: emails.filter(e => e.status === "QUEUED").length };

  const recordExport = useApp(s => s.recordExport);
  const exportDeliveryLog = () => {
    const rows: (string | number)[][] = [[
      "Sent at", "To", "To name", "Subject", "Template", "Status", "Provider", "Attachments", "Project PS-ID", "Error / hint",
    ], ...emails.map(e => [
      new Date(e.sentAt ?? e.createdAt).toLocaleString("en-IN"), e.to, e.toName ?? "", e.subject, e.template, e.status,
      e.provider ?? "", e.attachments.length, e.projectId ?? "", (e.error ?? "").slice(0, 140),
    ])];
    downloadCsv(rows, `projectassure-email-delivery-log-${new Date().toISOString().slice(0, 10)}.csv`);
    recordExport("Email delivery log", "csv", `${emails.length} deliveries`);
    toast.success("Delivery log exported", { description: `${rows.length - 1} deliveries with status, channel and attachments · audit-logged` });
  };

  const sendTest = async () => {
    if (!EMAIL_RE.test(testTo)) { toast.error("Enter a valid recipient address"); return; }
    setTestBusy(true);
    let msg;
    try { msg = await queueEmail({ to: testTo, toName: "email service test recipient", template: "welcome", send: true }); }
    finally { setTestBusy(false); }
    if (!msg) return;
    if (msg.status === "SENT") toast.success("Test email SENT", { description: `Delivered via the ${friendlyProvider(msg.provider)} to ${msg.to}` });
    else if (msg.status === "FAILED") toast.error("Delivery failed — run diagnostics in Settings", { description: (msg.error ?? "").slice(0, 120) });
    else toast.info("Recorded in the demo outbox (email service not connected)", { description: "Every message is stored with a full preview — connect a real service any time to deliver for real." });
  };

  const composeSend = async () => {
    if (!EMAIL_RE.test(to)) { toast.error("Enter a valid recipient address"); return; }
    const p = projects.find(x => x.id === project);
    const msg = await queueEmail({ to, toName: to.split("@")[0], template, subject: subject || undefined, body: body || undefined, project: p, projectId: p?.id, send: true });
    setSelected(msg.id);
    toast.success(msg.status === "SENT" ? `Sent to ${msg.to} via the ${friendlyProvider(msg.provider)}` : `Queued to outbox (demo mode) — full preview on the right`, { description: `Template: ${msg.template} · ${msg.attachments.length} attachment(s)` });
    setTab("outbox");
  };

  return (
    <div className="mx-auto max-w-[1300px] space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Email Centre</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Universal email delivery: alerts, digests, reports and custom messages · {counts.SENT} sent · {counts.SIMULATED} in demo outbox · channel: {friendlyProvider(emailSettings.provider)}
          </p>
          <div className="mt-2"><PipelineStrip steps={[
            { label: "Compose or template", hint: "Pick a template (alert, digest, report) or write a custom message to any address." },
            { label: "Attach reports", hint: "PDF/Excel exports attach automatically when sending from a project or the report builder." },
            { label: "Delivery chain", hint: "Connected email service → backup service → demo outbox. The strongest connected option wins — never a silent failure." },
            { label: "Honest delivery log", hint: "SENT means really delivered; SIMULATED means demo mode; FAILED shows the exact fix." },
          ]} /></div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportDeliveryLog}><FileDown className="h-3.5 w-3.5" />Delivery CSV</Button>
          <div className="flex gap-1 rounded-xl border bg-card p-1.5">
          {([["outbox", "Outbox", Inbox], ["compose", "Compose", Send], ["settings", "Settings", Settings2]] as [string, string, React.ElementType][]).map(([id, label, Icon]) => (
            <button key={id as string} onClick={() => setTab(id as typeof tab)}
              className={cn("flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold transition", tab === id ? "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]" : "text-muted-foreground hover:bg-muted")}>
              <Icon className="h-3.5 w-3.5" />{label}
            </button>
          ))}
          </div>
        </div>
      </div>

      {tab === "outbox" && (
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <div className="rounded-xl border bg-card p-4">
            <SectionTitle icon={Inbox} sub="newest first">Delivery log</SectionTitle>
            <div className="custom-scrollbar max-h-[560px] space-y-1.5 overflow-y-auto pr-1">
              {emails.length === 0 && <EmptyState icon={Mail} title="No emails yet" body="Send a test email, forward an alert or email a report." />}
              {emails.map(e => {
                const st = STATUS_STYLE[e.status];
                return (
                  <button key={e.id} onClick={() => setSelected(e.id)}
                    className={cn("block w-full rounded-lg border p-3 text-left transition", selected === e.id ? "border-[#0c93e7] bg-[#e0effe]/40 dark:bg-[#0c93e7]/10" : "hover:border-[#0c93e7]/40")}>
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-bold", st.cls)}>{e.status}</span>
                      <span className="truncate text-[11px] text-muted-foreground">{e.to}</span>
                      <span className="ml-auto shrink-0 text-[9.5px] tabular text-muted-foreground">{relTime(e.createdAt)}</span>
                    </div>
                    <div className="mt-1 line-clamp-1 text-[12px] font-semibold">{e.subject}</div>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-semibold">{e.template}</span>
                      {e.attachments.length > 0 && <span className="flex items-center gap-1 text-[9.5px] text-muted-foreground"><Paperclip className="h-3 w-3" />{e.attachments.length}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            {sel ? (
              <motion.div key={sel.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", STATUS_STYLE[sel.status].cls)}>{sel.status}{sel.provider ? ` · ${friendlyProvider(sel.provider)}` : ""}</span>
                  <span className="ml-auto text-[10.5px] text-muted-foreground">{dateTime(sel.createdAt)}{sel.sentAt ? ` → ${dateTime(sel.sentAt)}` : ""}</span>
                </div>
                <div className="mt-3 rounded-xl border-2 border-dashed border-border p-5" style={{ background: "#f8fafc11" }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email preview</div>
                  <table className="mt-2 w-full text-[11.5px]">
                    <tbody>
                      {[["From", `${emailSettings.fromName} <${emailSettings.fromAddress}>`], ["To", `${sel.toName ? sel.toName + " " : ""}<${sel.to}>`], ["Reply-To", sel.replyTo ?? "noreply@projectassure.in"], ["Subject", sel.subject], ["Template", sel.template]].map(([k, v]) => (
                        <tr key={k} className="border-b"><td className="w-24 py-1.5 pr-2 text-right text-muted-foreground">{k}:</td><td className="py-1.5 font-medium">{v}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  {sel.attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sel.attachments.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-[11px]">
                          <FileIcon kind={a.kind} /><span className="font-semibold">{a.name}</span><span className="text-muted-foreground">{a.sizeKb} KB</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 rounded-lg border bg-background p-4">
                    <Md text={sel.body} />
                  </div>
                  {(sel.status === "FAILED" || sel.status === "SIMULATED") && (sel.error || sel.hint) && (
                    <div className={cn("mt-3 rounded-lg border p-3 text-[11px] leading-relaxed",
                      sel.status === "FAILED" ? "border-rose-200 bg-rose-50/60 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300" : "border-amber-200 bg-amber-50/60 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300")}>
                      <div className="font-bold">{sel.status === "FAILED" ? "Delivery failed" : "Demo outbox — not sent"}</div>
                      {sel.error && <div className="mt-0.5 font-mono text-[10px] opacity-80">{sel.error}</div>}
                      {sel.hint && <div className="mt-1">{sel.hint}</div>}
                      {sel.status === "FAILED" && <button onClick={() => setTab("settings")} className="mt-1.5 font-bold underline">Open diagnostics →</button>}
                    </div>
                  )}
                  <div className="mt-3 text-[10px] text-muted-foreground">
                    {sel.status === "SIMULATED"
                      ? "Demo mode: no real message left this browser. When your administrator connects the email service (see the deployment guide), this exact message is delivered for real."
                      : "Delivered via the connected email service. Delivery, open and retry telemetry feeds the notification centre."}
                  </div>
                </div>
              </motion.div>
            ) : (
              <EmptyState icon={Mail} title="Select an email" body="Pick a delivery from the log to preview the exact message, headers and attachments. Or compose one from a template." action={<Button size="sm" onClick={() => setTab("compose")}>Compose an email</Button>} />
            )}
          </div>
        </div>
      )}

      {tab === "compose" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border bg-card p-5">
            <SectionTitle icon={Send} sub="template-driven, personalised, attachable">Compose</SectionTitle>
            <div className="space-y-3.5">
              <div><Label className="text-[11.5px]">To (any address — universal delivery)</Label><Input value={to} onChange={e => setTo(e.target.value)} placeholder="name@mospi.gov.in" className="text-[13px]" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-[11.5px]">Template</Label><Select value={template} onValueChange={v => setTemplate(v as EmailTemplateId)}><SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{EMAIL_TEMPLATES.map(t => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-[11.5px]">Context project</Label><Select value={project} onValueChange={setProject}><SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.psId}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div><Label className="text-[11.5px]">Subject (optional — template default if blank)</Label><Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Template subject pattern applies" className="text-[13px]" /></div>
              <div><Label className="text-[11.5px]">Body (optional — template body with live project data if blank)</Label><Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Leave blank to use the template filled with live project numbers…" className="min-h-28 text-[13px]" /></div>
              <div className="rounded-lg bg-muted/40 p-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
                Markdown supported (**bold**, bullets). Report attachments are added from the Reports page or Report Builder (“Email” action). CRITICAL/HIGH alerts auto-attach the alert context.
              </div>
              <Button onClick={composeSend} className="w-full bg-gradient-to-r from-[#0b426e] to-[#0c93e7]"><Send className="h-4 w-4" />Generate & send</Button>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <SectionTitle icon={Mail} sub="what each template produces">Template library</SectionTitle>
            <div className="space-y-2">
              {EMAIL_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setTemplate(t.id)} className={cn("block w-full rounded-lg border p-3 text-left transition", template === t.id ? "border-[#0c93e7] bg-[#e0effe]/40 dark:bg-[#0c93e7]/10" : "hover:border-[#0c93e7]/40")}>
                  <div className="flex items-center gap-2"><span className="text-[12.5px] font-bold">{t.title}</span>{template === t.id && <span className="rounded-full bg-[#0c93e7] px-1.5 py-0.5 text-[9px] font-bold text-white">SELECTED</span>}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{t.desc}</div>
                  <div className="mt-1 rounded bg-muted/60 px-2 py-1 font-mono text-[10px] text-muted-foreground">{t.subjectPattern}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {/* diagnostics */}
            <div className="rounded-xl border bg-card p-5">
              <SectionTitle icon={Stethoscope} sub="live check of the delivery chain — one click">Delivery diagnostics</SectionTitle>
              <div className="space-y-2.5">
                <Button onClick={runDiagnostics} disabled={diagBusy} className="w-full bg-gradient-to-r from-[#0b426e] to-[#0c93e7]">
                  {diagBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}Run diagnostics
                </Button>
                {diag && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-1.5 rounded-lg border p-3 text-[11.5px]">
                    <div className="flex justify-between"><span className="text-muted-foreground">Delivery channel</span><strong className={cn(diag.provider === "outbox" ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>{diag.provider === "outbox" ? "Demo outbox" : "Live email service"}</strong></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Email service</span><strong>{diag.smtp.configured || diag.brevo.configured || diag.resend.configured ? "Connected" : "Not connected (demo mode)"}</strong></div>
                    {diag.smtp.verify && (
                      <div className={cn("mt-1.5 rounded-lg p-2.5 text-[11px] leading-relaxed", diag.smtp.verify.ok
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300")}>
                        <strong>{diag.smtp.verify.ok ? "Email service verified — real delivery is live" : "Email service check failed"}</strong> — {diag.smtp.verify.detail}
                      </div>
                    )}
                    <div className="pt-1 text-[9.5px] text-muted-foreground">checked {new Date(diag.checkedAt).toLocaleTimeString("en-IN")}</div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* settings */}
            <div className="rounded-xl border bg-card p-5">
              <SectionTitle icon={Settings2} sub="identities, channels and the critical-alert list">Delivery settings</SectionTitle>
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-[11.5px]">From name</Label><Input value={emailSettings.fromName} onChange={e => updateEmailSettings({ fromName: e.target.value })} className="text-[13px]" /></div>
                  <div><Label className="text-[11.5px]">From address (display)</Label><Input value={emailSettings.fromAddress} onChange={e => updateEmailSettings({ fromAddress: e.target.value })} className="text-[13px]" /></div>
                </div>
                <div><Label className="text-[11.5px]">Delivery mode</Label><Select value={emailSettings.provider} onValueChange={v => updateEmailSettings({ provider: v as typeof emailSettings.provider })}><SelectTrigger className="text-[13px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="smtp-gmail">Email service (automatic)</SelectItem><SelectItem value="resend">Backup email service</SelectItem><SelectItem value="outbox-only">Outbox only (demo)</SelectItem></SelectContent></Select></div>
                <div className="flex items-center justify-between rounded-lg border p-3"><div><div className="text-[12.5px] font-semibold">Alert emails</div><div className="text-[10.5px] text-muted-foreground">CRITICAL/HIGH alerts dispatch email automatically</div></div><Switch checked={emailSettings.alertEmailsEnabled} onCheckedChange={v => updateEmailSettings({ alertEmailsEnabled: v })} /></div>
                <div className="flex items-center justify-between rounded-lg border p-3"><div><div className="text-[12.5px] font-semibold">Weekly digest</div><div className="text-[10.5px] text-muted-foreground">Monday 08:00 IST portfolio pulse</div></div><Switch checked={emailSettings.digestEmailsEnabled} onCheckedChange={v => updateEmailSettings({ digestEmailsEnabled: v })} /></div>
                <div><Label className="text-[11.5px]">Critical-alert recipients (comma separated)</Label><Input value={emailSettings.criticalTo.join(", ")} onChange={e => updateEmailSettings({ criticalTo: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} className="text-[13px]" /></div>
              </div>
            </div>
          </div>

          {/* email service status + test */}
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-5">
              <SectionTitle icon={BookOpenCheck} sub="how sending works — plain and honest">Email delivery status</SectionTitle>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 rounded-lg border p-3.5">
                  <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", (diag?.smtp.configured || diag?.brevo.configured || diag?.resend.configured) ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400")}>
                    <Mail className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-bold">{(diag?.smtp.configured || diag?.brevo.configured || diag?.resend.configured) ? "Email service connected" : "Demo outbox mode"}</div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {(diag?.smtp.configured || diag?.brevo.configured || diag?.resend.configured)
                        ? "Messages are delivered for real to any address you send to."
                        : "Every message you send is stored with its full preview and marked SIMULATED — the app never pretends a demo send was delivered."}
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
                  To switch on real delivery, your administrator connects the organisation's email service once — the step-by-step is in the deployment guide shipped with the project package. Until then, everything else (templates, attachments, previews, the delivery log) works exactly the same.
                </div>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-5">
              <SectionTitle icon={FlaskConical} sub="verify the chain end-to-end">Send a test email</SectionTitle>
              <div className="space-y-3">
                <div><Label className="text-[11.5px]">Recipient</Label><Input value={testTo} onChange={e => setTestTo(e.target.value)} className="text-[13px]" /></div>
                <Button onClick={sendTest} disabled={testBusy} className="w-full bg-gradient-to-r from-[#0b426e] to-[#0c93e7]">{testBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send test (welcome template)</Button>
                <div className="rounded-lg border p-3.5 text-[11px] leading-relaxed text-muted-foreground">
                  <div className="mb-1.5 font-bold text-foreground">How delivery works</div>
                  <ol className="space-y-1.5">
                    <li><strong>1.</strong> You compose or pick a template; attachments (PDF/Excel reports) are added automatically.</li>
                    <li><strong>2.</strong> The platform routes it through the connected email service, with an honest outbox fallback.</li>
                    <li><strong>3.</strong> The result, channel and any error reason are recorded with the message; the audit trail gets an entry.</li>
                    <li><strong>4.</strong> Failures show an actionable hint right here — no silent "not sending".</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FileIcon({ kind }: { kind: "pdf" | "xlsx" | "csv" | "txt" }) {
  return <span className="rounded bg-[#0b426e] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">{kind.toUpperCase()}</span>;
}
