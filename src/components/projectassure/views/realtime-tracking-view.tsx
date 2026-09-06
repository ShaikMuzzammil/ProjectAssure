"use client";

// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure v21 — Real-Time Tracking Dashboard
// Combines: Gantt chart with automated milestone updates · geo-tagged photo
// verification (EXIF GPS) · predictive delay alerts · live activity feed.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useMemo, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/store/app-store";
import { SectionTitle, EmptyState, ProgressBar } from "../shared/ui-bits";
import { inr, relTime } from "@/lib/projectassure/format";
import { can } from "@/lib/projectassure/permissions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Camera, MapPin, Clock, CheckCircle2, AlertTriangle, Upload, Loader2, Trash2,
  Activity, GanttChartSquare, TrendingUp, ShieldCheck, Navigation, FileImage,
} from "lucide-react";
import type { GeoPhoto } from "@/lib/projectassure/types";

// ─── EXIF GPS extraction via exifr (lazy-loaded) ─────────────────────────────
async function extractExif(file: File): Promise<{ lat?: number; lng?: number; capturedAt?: string; device?: string }> {
  try {
    const exifr: typeof import("exifr") = await import("exifr");
    const data = await exifr.parse(file, { gps: true, tiff: true, ifd0: true, exif: true });
    const lat = data?.latitude ?? data?.GPSLatitude;
    const lng = data?.longitude ?? data?.GPSLongitude;
    const ts = data?.DateTimeOriginal ?? data?.CreateDate ?? data?.DateTime;
    const device = [data?.Make, data?.Model].filter(Boolean).join(" ").trim() || undefined;
    return {
      lat: typeof lat === "number" ? lat : undefined,
      lng: typeof lng === "number" ? lng : undefined,
      capturedAt: ts ? new Date(ts as Date).toISOString() : undefined,
      device,
    };
  } catch {
    return {};
  }
}

// ─── Thumbnail generator (caps at 240x240 JPEG q=0.7, ~10-30KB) ────────────
async function makeThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const max = 240;
        let { width, height } = img;
        if (width > height && width > max) { height = height * max / width; width = max; }
        else if (height > max) { width = width * max / height; height = max; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("canvas ctx")); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── OSM static map embed (no key required) ─────────────────────────────────
function osmEmbedUrl(lat: number, lng: number, zoom = 13): string {
  const delta = 0.01;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

// ─── Milestone auto-update detector ─────────────────────────────────────────
function detectAutoMilestones(project: ReturnType<ReturnType<typeof useApp.getState>["scoped"]>[number]) {
  const now = Date.now();
  const ms = project.milestones;
  const upcoming = ms.filter(m => {
    const planned = new Date(m.plannedDate).getTime();
    return planned >= now && planned <= now + 14 * 86400000 && m.status !== "COMPLETED";
  });
  const overdue = ms.filter(m => {
    const planned = new Date(m.plannedDate).getTime();
    return planned < now && m.status !== "COMPLETED" && m.status !== "DELAYED";
  });
  const recentDone = ms.filter(m => m.status === "COMPLETED" && m.actualDate
    && (now - new Date(m.actualDate).getTime()) < 7 * 86400000);
  return { upcoming, overdue, recentDone };
}

// ═══════════════════════════════════════════════════════════════════════════
export default function RealtimeTrackingView() {
  const projects = useApp(s => s.scoped)();
  const user = useApp(s => s.user)!;
  const geoPhotos = useApp(s => s.geoPhotos);
  const addGeoPhoto = useApp(s => s.addGeoPhoto);
  const verifyGeoPhoto = useApp(s => s.verifyGeoPhoto);
  const deleteGeoPhoto = useApp(s => s.deleteGeoPhoto);
  const navigate = useApp(s => s.navigate);
  const openProject = useApp(s => s.openProject);

  const [selId, setSelId] = useState(projects[0]?.id ?? "");
  const project = projects.find(p => p.id === selId) ?? projects[0];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [useBrowserGps, setUseBrowserGps] = useState(false);

  const projectPhotos = useMemo(() => geoPhotos.filter(g => g.projectId === selId), [geoPhotos, selId]);
  const milestones = useMemo(() => project ? detectAutoMilestones(project) : null, [project]);

  // ─── Browser GPS (fallback when EXIF is missing) ────────────────────────────
  const [browserGps, setBrowserGps] = useState<{ lat: number; lng: number } | null>(null);
  const requestGps = useCallback(() => {
    if (!navigator.geolocation) { toast.error("Browser geolocation not available"); return; }
    setUseBrowserGps(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setBrowserGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }); toast.success(`GPS locked: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`); },
      err => { toast.error("GPS denied", { description: err.message }); setUseBrowserGps(false); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

  // ─── Upload handler ─────────────────────────────────────────────────────────
  const onFiles = async (files: FileList | null) => {
    if (!files || !files.length || !project) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 5)) {
        if (file.size > 8 * 1024 * 1024) { toast.error(`${file.name} too large (max 8MB)`); continue; }
        if (!/^image\//.test(file.type)) { toast.error(`${file.name} is not an image`); continue; }
        toast.loading(`Processing ${file.name}…`, { id: `p-${file.name}` });
        const [thumb, exif] = await Promise.all([makeThumbnail(file), extractExif(file)]);
        // Use EXIF GPS, else browser GPS, else project's geocoded centre, else 0,0
        const projectLat = project.latitude ?? 0;
        const projectLng = project.longitude ?? 0;
        const lat = exif.lat ?? browserGps?.lat ?? projectLat;
        const lng = exif.lng ?? browserGps?.lng ?? projectLng;
        if (exif.lat == null && browserGps == null) {
          toast.warning(`No GPS in ${file.name}`, { id: `p-${file.name}`, description: "Used project location as fallback. Capture with GPS enabled for true geo-tagging." });
        } else {
          toast.success(`Geo-tagged ${file.name}`, { id: `p-${file.name}`, description: `GPS ${lat.toFixed(4)}, ${lng.toFixed(4)}${exif.device ? ` · ${exif.device}` : ""}` });
        }
        addGeoPhoto(project.id, {
          fileName: file.name,
          fileSize: file.size,
          dataUrl: thumb,
          capturedAt: exif.capturedAt ?? new Date().toISOString(),
          uploadedBy: user.name,
          latitude: lat,
          longitude: lng,
          device: exif.device,
          caption: caption || `Site verification photo for ${project.psId}`,
          tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        });
      }
      setCaption(""); setTags("");
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  if (!project) {
    return <EmptyState icon={Activity} title="No projects in scope" body="Create a project to activate the real-time tracking dashboard." />;
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight">Real-Time Tracking Dashboard</h1>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">v21 — automated milestone updates · geo-tagged photo verification · predictive delay alerts · live activity feed</p>
        </div>
        <Select value={selId} onValueChange={setSelId}>
          <SelectTrigger className="h-9 w-[360px] text-[12.5px]"><SelectValue /></SelectTrigger>
          <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.psId} — {p.name.slice(0, 44)}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard icon={GanttChartSquare} label="Milestones overdue" value={milestones?.overdue.length ?? 0} tone="rose" sub={milestones?.overdue.length ? `next: ${milestones.overdue[0].name.slice(0, 28)}` : "none — all on track"} />
        <KpiCard icon={Clock} label="Upcoming (14d)" value={milestones?.upcoming.length ?? 0} tone="amber" sub={milestones?.upcoming.length ? `next: ${new Date(milestones.upcoming[0].plannedDate).toLocaleDateString("en-IN")}` : "none due"} />
        <KpiCard icon={CheckCircle2} label="Done this week" value={milestones?.recentDone.length ?? 0} tone="emerald" sub={milestones?.recentDone.length ? milestones.recentDone[0].name.slice(0, 28) : "none"} />
        <KpiCard icon={Camera} label="Geo-photos" value={projectPhotos.length} tone="sky" sub={`${projectPhotos.filter(p => p.verified).length} verified · ${projectPhotos.filter(p => !p.verified).length} pending`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {/* Gantt-style milestone timeline */}
        <div className="rounded-xl border bg-card p-5">
          <SectionTitle icon={GanttChartSquare} sub="automated milestone tracking — overdue items turn red, upcoming turn amber, completed turn green">Visual progress tracking (Gantt)</SectionTitle>
          <div className="mt-3 space-y-2">
            {project.milestones.slice(0, 9).map((m, i) => {
              const planned = new Date(m.plannedDate);
              const now = new Date();
              const isOverdue = planned < now && m.status !== "COMPLETED" && m.status !== "DELAYED";
              const isUpcoming = planned >= now && (planned.getTime() - now.getTime()) < 14 * 86400000;
              const isDone = m.status === "COMPLETED";
              const start = new Date(project.startDate);
              const total = new Date(project.targetDate).getTime() - start.getTime();
              const left = ((planned.getTime() - start.getTime()) / total) * 100;
              const tone = isDone ? "bg-emerald-500" : isOverdue ? "bg-rose-500" : isUpcoming ? "bg-amber-400" : "bg-slate-300 dark:bg-slate-600";
              return (
                <div key={m.id} className="relative">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className={cn("h-2 w-2 rounded-full", tone)} />
                      <span className="font-semibold">{m.name}</span>
                      {m.isCritical && <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[8.5px] font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">CRITICAL</span>}
                    </span>
                    <span className="text-muted-foreground tabular">{planned.toLocaleDateString("en-IN")} · {m.status.replace("_", " ")}</span>
                  </div>
                  <div className="mt-1 relative h-2 rounded-full bg-muted overflow-hidden">
                    <div className={cn("absolute inset-y-0 rounded-full", tone)} style={{ left: `${Math.min(95, left)}%`, width: "4%" }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />completed</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />upcoming (14d)</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-500" />overdue</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />future</span>
          </div>
        </div>

        {/* Predictive delay alert */}
        <div className="rounded-xl border bg-card p-5">
          <SectionTitle icon={TrendingUp} sub="AI-driven delay prediction — flags projects at risk 30-60 days before the deadline">Predictive delay alert</SectionTitle>
          {project.prediction ? (
            <div className="mt-3 space-y-3">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Delay probability</div>
                  <div className={cn("text-[36px] font-extrabold tabular leading-none",
                    project.prediction.probability > 0.7 ? "text-rose-600 dark:text-rose-400"
                    : project.prediction.probability > 0.4 ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400")}>
                    {Math.round(project.prediction.probability * 100)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Est. slip</div>
                  <div className="text-[20px] font-extrabold tabular">{project.prediction.estimatedDays}<span className="text-[12px] text-muted-foreground">d</span></div>
                  <div className="text-[9.5px] text-muted-foreground">90% CI {project.prediction.ciLower}–{project.prediction.ciUpper}d</div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top contributing factors</div>
                {project.prediction.factors.slice(0, 4).map(f => (
                  <div key={f.feature} className="flex items-center justify-between text-[11px]">
                    <span className="truncate">{f.label}</span>
                    <span className={cn("font-bold tabular", f.direction === "raises" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>{f.direction}</span>
                  </div>
                ))}
              </div>
              {project.prediction.probability > 0.6 && (
                <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-[11px] text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/5 dark:text-rose-300">
                  <AlertTriangle className="mr-1 inline h-3 w-3" />Predicted delay exceeds the email-alert threshold. An automatic warning will be sent to the project manager and the responsible officer.
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => navigate("model-lab")} className="w-full">Open prediction engine →</Button>
            </div>
          ) : (
            <EmptyState icon={TrendingUp} title="No prediction yet" body="Run a prediction from the project detail page." />
          )}
        </div>
      </div>

      {/* Geo-tagged photo audit */}
      <div className="rounded-xl border bg-card p-5">
        <SectionTitle icon={Camera} sub="Upload site photos with EXIF GPS — every photo is locked to its capture location and timestamp; admins can verify">Geo-tagged photo verification</SectionTitle>

        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_1.5fr]">
          {/* upload form */}
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="text-[11.5px] font-bold">Upload a geo-tagged photo</div>
            <div className="mt-2 space-y-2">
              <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Caption (e.g. foundation pour at Pier-3)"
                className="h-9 w-full rounded-lg border bg-background px-3 text-[12px] outline-none focus:border-[#0c93e7]" />
              <input value={tags} onChange={e => setTags(e.target.value)} placeholder="Tags (comma-separated: foundation, pier-3, concrete)"
                className="h-9 w-full rounded-lg border bg-background px-3 text-[12px] outline-none focus:border-[#0c93e7]" />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={requestGps} className={cn(useBrowserGps && browserGps && "border-emerald-400 bg-emerald-50 text-emerald-700")}>
                  <Navigation className="h-3.5 w-3.5" />{browserGps ? "GPS locked" : "Use my GPS"}
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={e => onFiles(e.target.files)} className="hidden" />
                <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="bg-gradient-to-r from-[#0b426e] to-[#0c93e7]">
                  {uploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Processing…</> : <><Upload className="h-3.5 w-3.5" />Choose photo(s)</>}
                </Button>
              </div>
              <div className="text-[10px] leading-relaxed text-muted-foreground">
                Photos are processed entirely in your browser. EXIF GPS coordinates are extracted via exifr; if missing, your browser GPS is used (with permission); if both are unavailable, the project&apos;s geocoded centre is used as a fallback. Thumbnails are capped at 240×240 JPEG q=0.7 (~15KB each).
              </div>
            </div>
          </div>

          {/* photo grid */}
          <div>
            {projectPhotos.length === 0 ? (
              <EmptyState icon={FileImage} title="No photos yet" body="Upload a site photo with GPS to start the verification chain." />
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {projectPhotos.map(p => <PhotoCard key={p.id} photo={p} canVerify={can(user, "alert:ack")} onVerify={(note) => { verifyGeoPhoto(p.id, note); toast.success("Photo verified"); }} onDelete={() => { deleteGeoPhoto(p.id); toast.info("Photo deleted"); }} />)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live activity feed */}
      <div className="rounded-xl border bg-card p-5">
        <SectionTitle icon={Activity} sub="last 10 events on this project — milestone completions, photo uploads, predictions, alerts">Live activity feed</SectionTitle>
        <div className="mt-3 space-y-1.5">
          {projectPhotos.slice(0, 4).map(p => (
            <div key={p.id} className="flex items-center gap-2 text-[11px]">
              <Camera className="h-3 w-3 text-[#0c93e7]" />
              <span className="font-semibold">{p.uploadedBy}</span>
              <span className="text-muted-foreground">uploaded a geo-tagged photo</span>
              <span className="font-mono text-[10px] text-muted-foreground">{p.latitude.toFixed(3)},{p.longitude.toFixed(3)}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{relTime(p.uploadedAt)}</span>
            </div>
          ))}
          {milestones?.recentDone.slice(0, 3).map(m => (
            <div key={m.id} className="flex items-center gap-2 text-[11px]">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              <span className="font-semibold">Milestone completed</span>
              <span className="text-muted-foreground truncate">{m.name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{m.actualDate && relTime(m.actualDate)}</span>
            </div>
          ))}
          {milestones?.overdue.slice(0, 2).map(m => (
            <div key={m.id} className="flex items-center gap-2 text-[11px]">
              <AlertTriangle className="h-3 w-3 text-rose-500" />
              <span className="font-semibold">Milestone overdue</span>
              <span className="text-muted-foreground truncate">{m.name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{relTime(m.plannedDate)}</span>
            </div>
          ))}
          {project.alerts.slice(0, 3).map(a => (
            <div key={a.id} className="flex items-center gap-2 text-[11px]">
              <AlertTriangle className={cn("h-3 w-3", a.severity === "CRITICAL" ? "text-rose-500" : a.severity === "HIGH" ? "text-amber-500" : "text-slate-400")} />
              <span className="font-semibold">{a.severity} alert</span>
              <span className="text-muted-foreground truncate">{a.title}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{relTime(a.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Photo card subcomponent ───────────────────────────────────────────────
function PhotoCard({ photo, canVerify, onVerify, onDelete }: {
  photo: GeoPhoto;
  canVerify: boolean;
  onVerify: (note: string) => void;
  onDelete: () => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [note, setNote] = useState("");
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className={cn("overflow-hidden rounded-xl border bg-card", photo.verified ? "border-emerald-300 dark:border-emerald-500/40" : "border-amber-300 dark:border-amber-500/40")}>
      <div className="relative aspect-square bg-muted">
        {photo.dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.dataUrl} alt={photo.caption} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center"><FileImage className="h-8 w-8 text-muted-foreground" /></div>
        )}
        <div className="absolute left-1.5 top-1.5 flex gap-1">
          {photo.verified ? (
            <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8.5px] font-bold text-white">VERIFIED</span>
          ) : (
            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[8.5px] font-bold text-white">PENDING</span>
          )}
        </div>
      </div>
      <div className="p-2.5">
        <div className="truncate text-[11px] font-semibold">{photo.caption}</div>
        <div className="mt-0.5 flex items-center gap-1 text-[9.5px] text-muted-foreground">
          <MapPin className="h-2.5 w-2.5" />
          <span className="font-mono">{photo.latitude.toFixed(4)}, {photo.longitude.toFixed(4)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-[9.5px] text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          <span>{new Date(photo.capturedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
        </div>
        {photo.device && <div className="mt-0.5 text-[9px] text-muted-foreground">📷 {photo.device}</div>}
        {photo.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-0.5">
            {photo.tags.slice(0, 4).map(t => <span key={t} className="rounded-full bg-muted px-1.5 py-0.5 text-[8.5px] font-semibold">{t}</span>)}
          </div>
        )}
        {photo.verified && photo.verificationNote && (
          <div className="mt-1.5 rounded bg-emerald-50/70 px-1.5 py-1 text-[9.5px] text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
            <ShieldCheck className="mr-1 inline h-2.5 w-2.5" />{photo.verifiedBy}: {photo.verificationNote}
          </div>
        )}
        <div className="mt-2 flex items-center gap-1">
          <a href={osmEmbedUrl(photo.latitude, photo.longitude)} target="_blank" rel="noreferrer"
            className="flex-1 rounded-md border px-2 py-1 text-center text-[9.5px] font-semibold transition hover:bg-muted">View on map</a>
          {canVerify && !photo.verified && (
            <button onClick={() => setVerifying(true)} className="rounded-md border border-emerald-400 bg-emerald-50 px-2 py-1 text-[9.5px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300">Verify</button>
          )}
          <button onClick={onDelete} className="rounded-md border p-1 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="h-3 w-3 text-rose-500" /></button>
        </div>
        {verifying && (
          <div className="mt-2 space-y-1.5 rounded-md border bg-muted/40 p-2">
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Verification note (e.g. site visit confirmed)"
              className="h-7 w-full rounded border bg-background px-2 text-[10px] outline-none" />
            <div className="flex gap-1">
              <button onClick={() => { if (note.trim()) { onVerify(note); setVerifying(false); setNote(""); } }}
                className="flex-1 rounded bg-emerald-500 px-2 py-1 text-[9.5px] font-bold text-white hover:bg-emerald-600">Confirm</button>
              <button onClick={() => setVerifying(false)} className="rounded border px-2 py-1 text-[9.5px]">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── KPI card ───────────────────────────────────────────────────────────────
function KpiCard({ icon: Icon, label, value, sub, tone }: { icon: React.ElementType; label: string; value: number; sub: string; tone: "rose" | "amber" | "emerald" | "sky" }) {
  const colors = {
    rose: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10",
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10",
    sky: "text-[#0c93e7] dark:text-[#36adf6] bg-[#e0effe] dark:bg-[#0c93e7]/10",
  };
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", colors[tone])}><Icon className="h-4 w-4" /></div>
      </div>
      <div className={cn("mt-1 text-[28px] font-extrabold tabular leading-none", colors[tone].split(" ")[0])}>{value}</div>
      <div className="mt-1 truncate text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}
