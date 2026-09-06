"use client";
// ═══════════════════════════════════════════════════════════════════════════
// Geo-tagged site evidence — submit & verify photos with REAL GPS proof.
//   • photo → EXIF GPS + DateTimeOriginal parsed in-browser (real TIFF IFD)
//   • fallback: browser Geolocation captured at submit time
//   • haversine distance to the project site → verdict with reason
//   • PM/ADMIN review (accept / reject with note) — fully audit-logged
// ═══════════════════════════════════════════════════════════════════════════
import { useRef, useState } from "react";
import { useApp } from "@/store/app-store";
import type { Project, SiteEvidence } from "@/lib/projectassure/types";
import { parseExif, verifyEvidence, downscaleImage } from "@/lib/projectassure/verify";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Camera, MapPin, ShieldCheck, ShieldAlert, Clock, Check, X, Loader2, Radar, Navigation,
} from "lucide-react";

const VERDICT_STYLE: Record<SiteEvidence["verdict"], { cls: string; icon: typeof ShieldCheck }> = {
  VERIFIED: { cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300", icon: ShieldCheck },
  NEAR_SITE: { cls: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300", icon: Radar },
  GPS_MISMATCH: { cls: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300", icon: ShieldAlert },
  STALE: { cls: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300", icon: Clock },
  NO_GPS: { cls: "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300", icon: MapPin },
};

export function GeoEvidencePanel({ p, canReview }: { p: Project; canReview: boolean }) {
  const submitEvidence = useApp(s => s.submitEvidence);
  const reviewEvidence = useApp(s => s.reviewEvidence);
  const [busy, setBusy] = useState(false);
  const [geoLive, setGeoLive] = useState<{ lat: number; lng: number; at: string } | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [milestoneId, setMilestoneId] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const evidence = p.evidence ?? [];

  // capture browser geolocation before submit (fallback when EXIF has no GPS)
  const captureGeo = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation unavailable", { description: "This browser cannot share GPS — EXIF in the photo will be used instead." });
      return;
    }
    setCapturing(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLive({
          lat: +pos.coords.latitude.toFixed(6),
          lng: +pos.coords.longitude.toFixed(6),
          at: new Date(pos.timestamp).toISOString(),
        });
        setCapturing(false);
        toast.success("Live GPS captured", { description: `±${Math.round(pos.coords.accuracy)} m accuracy — will be stamped on the next photo you submit.` });
      },
      () => {
        setCapturing(false);
        toast.warning("GPS permission denied", { description: "The photo's own EXIF GPS will be checked instead (if the camera adds it)." });
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const onPhoto = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Not a photo", { description: "Site evidence must be a JPG/PNG photo taken at the site." });
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Photo too large", { description: "Max 12 MB — modern phones produce ~3-6 MB." });
      return;
    }
    setBusy(true);
    try {
      const exif = await parseExif(file);
      const photoGps = exif?.latitude !== undefined && exif?.longitude !== undefined
        ? { latitude: exif.latitude, longitude: exif.longitude }
        : geoLive
          ? { latitude: geoLive.lat, longitude: geoLive.lng }
          : undefined;
      const gpsSource: SiteEvidence["gpsSource"] = exif?.latitude !== undefined
        ? "exif"
        : geoLive ? "browser" : "none";
      const capturedAt = exif?.timestamp ?? geoLive?.at ?? new Date().toISOString();
      const result = verifyEvidence(
        { photoGps, photoTimestamp: exif?.timestamp, capturedAt, site: { latitude: p.latitude, longitude: p.longitude } }
      );
      const photoDataUrl = await downscaleImage(file);
      if (!photoDataUrl) {
        toast.error("Could not process image", { description: "The browser could not decode this photo." });
        return;
      }
      const ms = p.milestones.find(m => m.id === milestoneId);
      const ev = submitEvidence({
        projectId: p.id,
        milestoneId: ms?.id,
        milestoneName: ms?.name,
        fileName: file.name,
        photoDataUrl,
        gps: photoGps,
        gpsSource,
        capturedAt,
        verdict: result.verdict,
        distanceKm: result.distanceKm,
        reason: result.reason,
      });
      if (ev) {
        if (result.verdict === "VERIFIED") {
          toast.success("Evidence VERIFIED", { description: result.reason });
        } else if (result.verdict === "NEAR_SITE") {
          toast.warning("Near-site — needs review", { description: result.reason });
        } else {
          toast.error(`Verification failed: ${result.verdict}`, { description: result.reason });
        }
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const review = (ev: SiteEvidence, accept: boolean) => {
    const note = accept ? undefined : window.prompt("Rejection note (what failed)?", "Location does not match site") ?? "Rejected after manual review";
    if (!note && !accept) return;
    const r = reviewEvidence(p.id, ev.id, accept, note ?? undefined);
    if (r.ok) toast.success(accept ? "Evidence accepted" : "Evidence rejected", { description: "Decision audit-logged and synced to Host Control." });
  };

  return (
    <div className="space-y-4">
      {/* how it works strip */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 dark:border-sky-900 dark:bg-sky-950/40">
        <div className="flex items-start gap-2 text-[11.5px] leading-relaxed text-sky-900 dark:text-sky-200">
          <Camera className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <b>How proof works:</b> the photo&apos;s own EXIF GPS + timestamp are parsed in your
            browser (no upload needed) — the distance to this project&apos;s site coordinates is
            measured with the haversine formula. ≤2 km = verified · ≤10 km = near-site review ·
            beyond = GPS mismatch. If the camera has no GPS, capture a live browser location first.
          </div>
        </div>
      </div>

      {/* submit bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <select value={milestoneId} onChange={e => setMilestoneId(e.target.value)} className="max-w-[220px] rounded-lg border bg-background px-2.5 py-2 text-[12px]">
          <option value="">No milestone link</option>
          {p.milestones.map(m => <option key={m.id} value={m.id}>{m.name}{m.status === "COMPLETED" ? " ✓" : ""}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={captureGeo} disabled={capturing} className="gap-1.5">
          {capturing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation className="h-3.5 w-3.5" />}
          {geoLive ? `GPS ${geoLive.lat}, ${geoLive.lng}` : "Capture live GPS"}
        </Button>
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy} className="gap-1.5 bg-gradient-to-r from-[#0b426e] to-[#0c93e7] text-white">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          Submit site photo
        </Button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={e => void onPhoto(e.target.files)} />
        <span className="ml-auto text-[10.5px] text-muted-foreground">
          site: {p.latitude.toFixed(3)}, {p.longitude.toFixed(3)} · {p.district}, {p.state}
        </span>
      </div>

      {/* gallery */}
      {evidence.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Camera className="mx-auto h-7 w-7 text-muted-foreground/40" />
          <p className="mt-2 text-[12.5px] font-medium">No site evidence yet</p>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">Field officers submit photos here — each one is GPS-verified automatically.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {evidence.map(ev => {
            const v = VERDICT_STYLE[ev.verdict];
            const VIcon = v.icon;
            return (
              <div key={ev.id} className="overflow-hidden rounded-xl border bg-card">
                <div className="relative h-[150px] bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ev.photoDataUrl} alt={ev.fileName} className="h-full w-full object-cover" />
                  <span className={cn("absolute left-2 top-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase backdrop-blur", v.cls)}>
                    <VIcon className="h-3 w-3" /> {ev.verdict.replace("_", " ")}
                  </span>
                  {ev.reviewStatus !== "pending" && (
                    <span className={cn("absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-white", ev.reviewStatus === "accepted" ? "bg-emerald-600" : "bg-rose-600")}>
                      {ev.reviewStatus}
                    </span>
                  )}
                </div>
                <div className="space-y-1.5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-semibold">{ev.fileName}</span>
                    <span className="shrink-0 text-[9.5px] tabular text-muted-foreground">{new Date(ev.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><MapPin className="h-2.5 w-2.5" />{ev.gps ? `${ev.gps.latitude.toFixed(3)}, ${ev.gps.longitude.toFixed(3)} (${ev.gpsSource})` : "no GPS"}</span>
                    {ev.distanceKm !== undefined && <span className="inline-flex items-center gap-1"><Radar className="h-2.5 w-2.5" />{ev.distanceKm} km from site</span>}
                    <span className="inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{new Date(ev.capturedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  {ev.milestoneName && <div className="text-[10.5px] font-medium text-muted-foreground">milestone: {ev.milestoneName}</div>}
                  <p className="text-[10.5px] leading-snug text-muted-foreground">{ev.reason}</p>
                  {ev.reviewStatus === "pending" && canReview && (
                    <div className="flex gap-1.5 pt-1">
                      <Button size="sm" variant="outline" className="h-7 flex-1 gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300" onClick={() => review(ev, true)}>
                        <Check className="h-3 w-3" /> Accept
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 flex-1 gap-1 border-rose-300 text-rose-700 hover:bg-rose-50 dark:text-rose-300" onClick={() => review(ev, false)}>
                        <X className="h-3 w-3" /> Reject
                      </Button>
                    </div>
                  )}
                  {ev.reviewNote && <p className="rounded bg-muted/60 px-2 py-1 text-[10px] italic text-muted-foreground">“{ev.reviewNote}” — {ev.reviewedBy}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
