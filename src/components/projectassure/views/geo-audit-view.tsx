"use client";

// v23 · Geo-Tagged Site Audits — per-project evidence workspace
// ───────────────────────────────────────────────────────────────────────────
// LEFT: the project list (choose which project's site you are auditing).
// RIGHT: that project's evidence gallery + upload. Every submission is
// GPS-verified, PERSISTS in the project record, and raises a live approval
// request in Host Control. Preview expands full-size with a close mark;
// download and CSV export work per project.

import React, { useMemo, useRef, useState } from "react";
import { useApp } from "@/store/app-store";
import { motion } from "framer-motion";
import {
  Camera, CheckCircle2, Crosshair, Download, FileImage, MapPin, ShieldCheck,
  Timer, Upload, X, XCircle, AlertCircle, Expand, FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/projectassure/format";
import { parseExif, verifyEvidence, downscaleImage } from "@/lib/projectassure/verify";
import { toast } from "sonner";
import type { SiteEvidence } from "@/lib/projectassure/types";

// Haversine distance (meters)
function distance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export default function GeoAuditView() {
  const projects = useApp(s => s.projects);
  const user = useApp(s => s.user)!;
  const navigate = useApp(s => s.navigate);
  const submitEvidence = useApp(s => s.submitEvidence);
  const reviewEvidence = useApp(s => s.reviewEvidence);

  // the selected project drives everything on the right side
  const [activeProjectId, setActiveProjectId] = useState(projects[0]?.id ?? "");
  const activeProject = projects.find(p => p.id === activeProjectId) ?? projects[0];

  // upload state (bound to the active project)
  const [openUpload, setOpenUpload] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState("");
  const [pendingFile, setPendingFile] = useState<{ name: string; dataUrl: string; capturedAt: string } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "scanning" | "ok" | "fail">("idle");
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // full-size preview with close mark
  const [preview, setPreview] = useState<SiteEvidence | null>(null);

  const projectEvidence = useMemo(
    () => (activeProject?.evidence ?? []),
    [activeProject],
  );
  const verified = projectEvidence.filter(e => e.verdict === "VERIFIED" || e.verdict === "NEAR_SITE").length;
  const pendingReview = projectEvidence.filter(e => e.reviewStatus === "pending").length;

  // project stats for the left list
  const projectStats = useMemo(() => projects.map(p => ({
    id: p.id,
    count: (p.evidence ?? []).length,
    pending: (p.evidence ?? []).filter(e => e.reviewStatus === "pending").length,
  })), [projects]);
  const statsMap = new Map(projectStats.map(s => [s.id, s]));

  const onPickFile = async (file: File) => {
    setGpsStatus("scanning");
    // 1) EXIF GPS from the photo itself (field cameras stamp it)
    const exif = await parseExif(file).catch(() => undefined);
    if (exif?.latitude !== undefined && exif?.longitude !== undefined) {
      setGpsCoords({ lat: exif.latitude, lng: exif.longitude });
      setGpsStatus("ok");
    } else if (typeof navigator !== "undefined" && navigator.geolocation) {
      // 2) live browser GPS as fallback
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsStatus("ok");
        },
        () => {
          setGpsCoords(null);
          setGpsStatus("fail");
        },
        { timeout: 6000, enableHighAccuracy: true },
      );
    } else {
      setGpsCoords(null);
      setGpsStatus("fail");
    }
    // 3) store a downscaled copy (≤900px) so the project record stays light
    const photoDataUrl = await downscaleImage(file);
    if (!photoDataUrl) {
      toast.error("Could not process image", { description: "The browser could not decode this photo." });
      setPendingFile(null);
      return;
    }
    setPendingFile({
      name: file.name,
      dataUrl: photoDataUrl,
      capturedAt: exif?.timestamp ?? new Date().toISOString(),
    });
  };

  const submit = () => {
    if (!pendingFile || !activeProject) {
      toast.error("Pick a photo first.");
      return;
    }
    const proj = activeProject;
    const ms = proj.milestones.find(m => m.id === selectedMilestone);
    // GPS verdict from the real verification engine (haversine + staleness)
    const result = verifyEvidence({
      photoGps: gpsCoords ? { latitude: gpsCoords.lat, longitude: gpsCoords.lng } : undefined,
      photoTimestamp: pendingFile.capturedAt,
      capturedAt: pendingFile.capturedAt,
      site: { latitude: proj.latitude, longitude: proj.longitude },
    });
    const ev = submitEvidence({
      projectId: proj.id,
      milestoneId: ms?.id,
      milestoneName: ms?.name,
      fileName: pendingFile.name,
      photoDataUrl: pendingFile.dataUrl,
      gps: gpsCoords ? { latitude: gpsCoords.lat, longitude: gpsCoords.lng } : undefined,
      gpsSource: gpsCoords ? "browser" : "none",
      capturedAt: pendingFile.capturedAt,
      verdict: result.verdict,
      distanceKm: result.distanceKm,
      reason: result.reason,
    });
    if (!ev) {
      toast.error("Could not submit evidence — try again.");
      return;
    }
    setPendingFile(null);
    setGpsStatus("idle");
    setGpsCoords(null);
    setSelectedMilestone("");
    setOpenUpload(false);
    toast.success(ev.verdict === "VERIFIED" ? "Evidence submitted · GPS-verified" : `Submitted · verdict ${ev.verdict}`, {
      description: `${proj.psId} · ${ev.distanceKm !== undefined ? `${(ev.distanceKm * 1000).toFixed(0)}m from site` : "no GPS"} · sent for host review`,
    });
  };

  function downloadEvidence(ev: SiteEvidence) {
    const a = document.createElement("a");
    a.href = ev.photoDataUrl;
    a.download = ev.fileName || `evidence-${ev.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function exportProjectEvidenceCsv() {
    if (!projectEvidence.length) {
      toast.error("Nothing to export yet", { description: "Upload site photos for this project first." });
      return;
    }
    const rows = [
      ["file", "milestone", "verdict", "distance_km", "captured_at", "submitted_by", "review_status", "note"],
      ...projectEvidence.map(e => [
        e.fileName,
        e.milestoneName ?? "",
        e.verdict,
        e.distanceKm !== undefined ? e.distanceKm.toFixed(3) : "",
        e.capturedAt,
        e.submittedBy,
        e.reviewStatus,
        (e.reviewNote ?? "").replace(/"/g, "'"),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `site-evidence-${activeProject?.psId ?? "project"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Evidence exported", { description: `${projectEvidence.length} records · ${activeProject?.psId}` });
  }

  if (!projects.length) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-dashed p-12 text-center">
          <Crosshair className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-[15px] font-bold">No projects to audit yet</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">Create a project first — its site evidence workspace appears here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#0c93e7]">
            <Crosshair className="h-3.5 w-3.5" /> Geo-tagged site audits
          </div>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight sm:text-[26px]">Site Evidence, per project</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Choose a project on the left, upload GPS-locked photos on the right. Every submission persists in the project, notifies the owner and raises a live verification request in Host Control.
          </p>
        </div>
        <button onClick={() => { if (activeProject) setOpenUpload(true); }}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#0b426e] to-[#0c93e7] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:shadow-md hover:shadow-[#0c93e7]/25">
          <Upload className="h-4 w-4" /> Upload for {activeProject?.psId ?? "project"}
        </button>
      </div>

      {/* Side-by-side: project list | evidence detail */}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* LEFT — project chooser */}
        <div className="rounded-xl border bg-card">
          <div className="border-b px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
            Projects · {projects.length}
          </div>
          <div className="custom-scrollbar max-h-[560px] overflow-y-auto p-2">
            {projects.map(p => {
              const s = statsMap.get(p.id);
              const active = p.id === activeProject?.id;
              return (
                <button key={p.id}
                  onClick={() => setActiveProjectId(p.id)}
                  className={cn("mb-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
                    active ? "bg-[#e0effe] text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]" : "hover:bg-muted")}>
                  <MapPin className={cn("h-3.5 w-3.5 shrink-0", active ? "text-[#0c93e7]" : "text-muted-foreground")} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold">{p.psId} · {p.name.slice(0, 24)}{p.name.length > 24 ? "…" : ""}</div>
                    <div className="text-[9.5px] text-muted-foreground">{p.district}, {p.state}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[11px] font-bold tabular">{s?.count ?? 0}</div>
                    {(s?.pending ?? 0) > 0 && <div className="text-[8.5px] font-bold text-amber-600">{s?.pending} pending</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT — evidence for the selected project */}
        <div className="rounded-xl border bg-card p-4">
          {activeProject && (
            <>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-bold tracking-tight">{activeProject.psId} · {activeProject.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {activeProject.state} · {activeProject.district} · site @ {activeProject.latitude.toFixed(4)}°N, {activeProject.longitude.toFixed(4)}°E
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => navigate("project-detail", { projectId: activeProject.id, detailTab: "evidence" })}
                    className="text-[11.5px] font-semibold text-[#0c93e7] hover:underline">Open project →</button>
                  <button onClick={exportProjectEvidenceCsv}
                    className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition hover:border-[#0c93e7]/50 hover:text-[#0c93e7]">
                    <FileSpreadsheet className="h-3.5 w-3.5" /> Export CSV
                  </button>
                </div>
              </div>

              {/* per-project stats */}
              <div className="mb-4 grid grid-cols-3 gap-2.5">
                <MiniStat icon={FileImage} label="Evidence" value={projectEvidence.length} tone="text-[#0c93e7]" />
                <MiniStat icon={CheckCircle2} label="GPS-verified" value={verified} tone="text-emerald-600" />
                <MiniStat icon={AlertCircle} label="Awaiting review" value={pendingReview} tone="text-amber-600" />
              </div>

              {/* gallery */}
              {projectEvidence.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-[12.5px] text-muted-foreground">
                  No evidence for this project yet — click <strong>Upload</strong> to capture the first GPS-locked site photo.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {projectEvidence.map(e => (
                    <motion.div key={e.id}
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.22 }}
                      className={cn("overflow-hidden rounded-lg border",
                        e.verdict === "VERIFIED" ? "border-emerald-300/50" : e.verdict === "NEAR_SITE" ? "border-amber-300/50" : "border-rose-300/50")}>
                      <div className="relative aspect-[4/3] bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={e.photoDataUrl} alt={e.fileName} className="h-full w-full object-cover" />
                        <div className={cn("absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold",
                          e.verdict === "VERIFIED" ? "bg-emerald-500/90 text-white" : e.verdict === "NEAR_SITE" ? "bg-amber-500/90 text-white" : "bg-rose-500/90 text-white")}>
                          {e.verdict.replace("_", " ")}
                        </div>
                        {/* expand preview */}
                        <button onClick={() => setPreview(e)}
                          className="absolute right-1.5 top-1.5 rounded-md bg-black/50 p-1 text-white transition hover:bg-black/70" aria-label="Preview full size">
                          <Expand className="h-3 w-3" />
                        </button>
                        {/* download original */}
                        <button onClick={() => downloadEvidence(e)}
                          className="absolute right-1.5 bottom-1.5 rounded-md bg-black/50 p-1 text-white transition hover:bg-black/70" aria-label="Download photo">
                          <Download className="h-3 w-3" />
                        </button>
                        {e.reviewStatus === "pending" && (
                          <div className="absolute bottom-1.5 left-1.5 rounded-md bg-[#0c93e7]/90 px-1.5 py-0.5 text-[8.5px] font-bold text-white">HOST REVIEW</div>
                        )}
                        {e.reviewStatus === "accepted" && (
                          <div className="absolute bottom-1.5 left-1.5 rounded-md bg-emerald-600/90 px-1.5 py-0.5 text-[8.5px] font-bold text-white">ACCEPTED</div>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="truncate text-[11px] font-semibold">{e.milestoneName ?? "Site progress"}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-[9.5px] text-muted-foreground">
                          <Timer className="h-3 w-3" />{shortDate(e.capturedAt)}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[9.5px] text-muted-foreground">
                          <MapPin className="h-3 w-3" />{e.distanceKm !== undefined ? `${(e.distanceKm * 1000).toFixed(0)}m from site` : e.gpsSource === "none" ? "no GPS" : "—"}
                        </div>
                        <div className="truncate text-[9.5px] text-muted-foreground">{e.submittedBy}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Upload modal (bound to the active project) */}
      {openUpload && activeProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={() => setOpenUpload(false)}>
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.22 }}
            className="w-full max-w-lg rounded-2xl border bg-card p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-bold">Upload site photo</h3>
                <p className="text-[11px] text-muted-foreground">for {activeProject.psId} · {activeProject.name.slice(0, 40)}</p>
              </div>
              <button onClick={() => setOpenUpload(false)} className="text-muted-foreground hover:text-foreground"><XCircle className="h-4 w-4" /></button>
            </div>

            {/* milestone */}
            <div>
              <label className="mb-1 block text-[10.5px] font-semibold text-muted-foreground">Milestone (optional)</label>
              <select value={selectedMilestone} onChange={e => setSelectedMilestone(e.target.value)}
                className="h-9 w-full rounded-lg border bg-background px-2 text-[12px] outline-none focus:border-[#0c93e7]">
                <option value="">— None —</option>
                {activeProject.milestones.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* file picker */}
            <div className="mt-3">
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) onPickFile(f); }} />
              <button onClick={() => fileRef.current?.click()}
                className="flex h-32 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed bg-muted/30 transition hover:border-[#0c93e7]/60 hover:bg-muted/50">
                {pendingFile ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pendingFile.dataUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
                    <div className="text-[11px] text-muted-foreground">
                      <div className="font-semibold text-foreground">{pendingFile.name}</div>
                      <div>Captured {shortDate(pendingFile.capturedAt)}</div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Camera className="h-7 w-7 text-muted-foreground" />
                    <div className="mt-2 text-[12px] font-semibold">Click to capture or browse</div>
                    <div className="text-[10.5px] text-muted-foreground">JPG / PNG · camera or upload</div>
                  </>
                )}
              </button>
            </div>

            {/* GPS status */}
            <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-[11.5px]">
              {gpsStatus === "idle" && <><Crosshair className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Awaiting photo capture…</span></>}
              {gpsStatus === "scanning" && <><Crosshair className="h-4 w-4 animate-pulse text-[#0c93e7]" /><span>Locking GPS coordinates…</span></>}
              {gpsStatus === "ok" && gpsCoords && (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">GPS locked:</span>
                  <span className="font-mono">{gpsCoords.lat.toFixed(5)}°N, {gpsCoords.lng.toFixed(5)}°E</span>
                  {(() => {
                    const dist = distance(gpsCoords.lat, gpsCoords.lng, activeProject.latitude, activeProject.longitude);
                    return <span className={cn("font-bold", dist <= 500 ? "text-emerald-600" : "text-amber-600")}>· {dist}m from site</span>;
                  })()}
                </>
              )}
              {gpsStatus === "fail" && (
                <>
                  <XCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-amber-700 dark:text-amber-300">GPS unavailable — the photo will be recorded without coordinates (flagged for manual review).</span>
                </>
              )}
            </div>

            <button onClick={submit} disabled={!pendingFile}
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0284c7] text-[13px] font-semibold text-white shadow-md shadow-[#0284c7]/25 transition hover:bg-[#0369a1] disabled:opacity-60">
              <ShieldCheck className="h-4 w-4" /> Submit evidence · raise host review
            </button>
            <p className="mt-2 text-center text-[10px] text-muted-foreground">
              Saved to this project permanently · the host verification request appears in the Approvals Centre within seconds.
            </p>
          </motion.div>
        </div>
      )}

      {/* Full-size preview with close mark */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18 }}
            className="relative max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border bg-card shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreview(null)}
              className="absolute right-2.5 top-2.5 z-10 rounded-full bg-black/60 p-1.5 text-white transition hover:bg-black/80" aria-label="Close preview">
              <X className="h-4 w-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.photoDataUrl} alt={preview.fileName} className="max-h-[62vh] w-full object-contain bg-black" />
            <div className="space-y-1.5 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[13px] font-bold">{preview.fileName}</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => downloadEvidence(preview)} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold hover:border-[#0c93e7]/50 hover:text-[#0c93e7]">
                    <Download className="h-3.5 w-3.5" /> Download
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
                <div><span className="font-semibold text-foreground">{preview.milestoneName ?? "Site progress"}</span></div>
                <div>GPS {preview.gps ? `${preview.gps.latitude.toFixed(4)}, ${preview.gps.longitude.toFixed(4)}` : "not captured"}</div>
                <div>{preview.distanceKm !== undefined ? `${(preview.distanceKm * 1000).toFixed(0)}m from site` : "—"}</div>
                <div>{shortDate(preview.capturedAt)} · {preview.submittedBy}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold",
                  preview.verdict === "VERIFIED" ? "bg-emerald-500/15 text-emerald-700" : preview.verdict === "NEAR_SITE" ? "bg-amber-500/15 text-amber-700" : "bg-rose-500/15 text-rose-700")}>
                  {preview.verdict.replace("_", " ")}
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">review: {preview.reviewStatus}</span>
                {user.role === "ADMIN" && preview.reviewStatus === "pending" && (
                  <span className="flex items-center gap-1.5">
                    <button onClick={() => { reviewEvidence(preview.projectId, preview.id, true, "Verified in preview"); setPreview(null); }}
                      className="rounded bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">accept</button>
                    <button onClick={() => { reviewEvidence(preview.projectId, preview.id, false, "Rejected in preview"); setPreview(null); }}
                      className="rounded bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">reject</button>
                  </span>
                )}
              </div>
              {preview.reviewNote && <p className="text-[10.5px] italic text-muted-foreground">“{preview.reviewNote}”</p>}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center justify-between">
        <Icon className={cn("h-3.5 w-3.5", tone)} />
        <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      </div>
      <div className={cn("mt-1 text-[18px] font-extrabold tabular leading-none", tone)}>{value}</div>
    </div>
  );
}
