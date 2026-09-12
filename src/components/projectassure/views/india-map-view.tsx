"use client";

// v22 · India Map View (Leaflet)
// ───────────────────────────────────────────────────────────────────────────
// Interactive Leaflet map of India with project pins colour-coded by status
// and delay-probability. Click a pin for a quick detail popup; live updates
// every 5s as the portfolio heartbeat refreshes the store.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/store/app-store";
import { motion } from "framer-motion";
import {
  AlertTriangle, MapPin, RefreshCw, Layers, Crosshair, Maximize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { shortDate, inrCompact } from "@/lib/projectassure/format";
import type { Project, ProjectStatus } from "@/lib/projectassure/types";

// Leaflet is loaded client-side via CDN to avoid SSR/build issues.
// We dynamically inject the script + CSS once, then render markers.

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

const INDIA_CENTER: [number, number] = [22.5, 80.0];
const INDIA_BOUNDS: [[number, number], [number, number]] = [[6.5, 68.0], [37.5, 97.5]];

let leafletReady = false;
function loadLeaflet(): Promise<typeof window.L> {
  if (leafletReady && (window as any).L) return Promise.resolve((window as any).L);
  return new Promise((resolve, reject) => {
    // CSS
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    // JS
    if ((window as any).L) {
      leafletReady = true;
      resolve((window as any).L);
      return;
    }
    const script = document.createElement("script");
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => { leafletReady = true; resolve((window as any).L); };
    script.onerror = () => reject(new Error("Leaflet failed to load"));
    document.head.appendChild(script);
  });
}

const STATUS_COLOR: Record<ProjectStatus, string> = {
  ACTIVE: "#10b981", PLANNING: "#0c93e7", ON_HOLD: "#f59e0b", COMPLETED: "#8b5cf6", CANCELLED: "#64748b",
};

export default function IndiaMapView() {
  const projects = useApp(s => s.scoped());
  const navigate = useApp(s => s.navigate);
  const applyNextEvent = useApp(s => s.applyNextEvent);
  const liveEventsEnabled = useApp(s => s.liveEventsEnabled);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<"all" | "at-risk" | "active" | "completed">("all");
  const [selected, setSelected] = useState<Project | null>(null);
  const [tick, setTick] = useState(0);

  // Live refresh
  useEffect(() => {
    const t = setInterval(() => {
      setTick(x => x + 1);
      if (liveEventsEnabled) applyNextEvent();
    }, 5000);
    return () => clearInterval(t);
  }, [liveEventsEnabled, applyNextEvent]);

  // Initialize Leaflet once
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !mapRef.current || mapInstance.current) return;
      const map = L.map(mapRef.current, {
        center: INDIA_CENTER,
        zoom: 5,
        minZoom: 4,
        maxZoom: 9,
        maxBounds: INDIA_BOUNDS,
        maxBoundsViscosity: 0.7,
        attributionControl: true,
        zoomControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.gov.in/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap · Government of India tiles",
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
      }).addTo(map);
      // Fallback to OSM standard tiles if gov.in fails
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
        subdomains: ["a", "b", "c"],
      }).addTo(map);
      mapInstance.current = map;
      setReady(true);
    }).catch(() => setReady(false));
    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Filtered projects
  const visible = useMemo(() => {
    if (filter === "all") return projects;
    if (filter === "at-risk") return projects.filter(p => (p.prediction?.probability ?? 0) > 0.5);
    if (filter === "active") return projects.filter(p => p.status === "ACTIVE");
    if (filter === "completed") return projects.filter(p => p.status === "COMPLETED");
    return projects;
  }, [projects, filter, tick]);

  // Render markers
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstance.current || !ready) return;
    // Clear previous markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    for (const p of visible) {
      const prob = p.prediction?.probability ?? 0;
      const color = prob > 0.7 ? "#dc2626"
        : prob > 0.5 ? "#f59e0b"
        : STATUS_COLOR[p.status] ?? "#64748b";
      const icon = L.divIcon({
        className: "pa-pin",
        html: `<div style="
          width:18px; height:18px; border-radius:50%;
          background:${color};
          border:2px solid #fff;
          box-shadow:0 0 0 2px ${color}55, 0 1px 4px rgba(0,0,0,0.4);
          cursor:pointer;
          animation: pa-pulse 2.5s ease-out infinite;
        "></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const marker = L.marker([p.latitude, p.longitude], { icon }).addTo(mapInstance.current);
      const probPct = Math.round(prob * 100);
      marker.bindPopup(`
        <div style="min-width:200px; font-family: Inter, system-ui, sans-serif;">
          <div style="font-size:10px; font-weight:700; color:#0c93e7; letter-spacing:0.08em; text-transform:uppercase;">${p.psId} · ${p.state}</div>
          <div style="font-size:13px; font-weight:700; margin:2px 0 4px;">${p.name}</div>
          <div style="font-size:11px; color:#64748b;">${p.district} · ${inrCompact(p.budgetL * 1e5)} · ${p.progress}% done</div>
          <div style="margin-top:6px; display:flex; gap:6px; align-items:center;">
            <span style="font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; background:${color}22; color:${color};">${p.status}</span>
            ${prob > 0 ? `<span style="font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; background:#f59e0b22; color:#d97706;">${probPct}% delay</span>` : ""}
          </div>
          <div style="margin-top:8px;"><a href="#/app/project-detail/${p.id}/overview" style="font-size:11px; color:#0284c7; font-weight:600; text-decoration:none;">Open detail →</a></div>
        </div>
      `);
      marker.on("click", () => setSelected(p));
      markersRef.current.push(marker);
    }
  }, [visible, ready, tick]);

  const counts = useMemo(() => {
    const total = projects.length;
    const atRisk = projects.filter(p => (p.prediction?.probability ?? 0) > 0.5).length;
    const active = projects.filter(p => p.status === "ACTIVE").length;
    const done = projects.filter(p => p.status === "COMPLETED").length;
    return { total, atRisk, active, done };
  }, [projects, tick]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-[#0c93e7]">
            <MapPin className="h-3.5 w-3.5" /> National project map · India
          </div>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight sm:text-[26px]">Real-Time India Map</h1>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            {counts.total} projects pinned · live status colours · predictive delay heat (red ≥70% · amber ≥50%) · refresh #{tick}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={`All (${counts.total})`} />
          <FilterChip active={filter === "at-risk"} onClick={() => setFilter("at-risk")} label={`At-risk (${counts.atRisk})`} tone="amber" />
          <FilterChip active={filter === "active"} onClick={() => setFilter("active")} label={`Active (${counts.active})`} tone="emerald" />
          <FilterChip active={filter === "completed"} onClick={() => setFilter("completed")} label={`Done (${counts.done})`} tone="violet" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Map */}
        <div className="relative overflow-hidden rounded-xl border bg-card">
          <div ref={mapRef} className="h-[460px] w-full sm:h-[540px]" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted/40">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {/* Legend */}
          <div className="absolute bottom-3 left-3 z-[1000] rounded-lg border bg-card/90 p-2.5 text-[10.5px] backdrop-blur">
            <div className="mb-1 font-bold uppercase tracking-widest text-muted-foreground">Status</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              <LegendDot color="#10b981" label="Active" />
              <LegendDot color="#dc2626" label="High risk (≥70%)" />
              <LegendDot color="#0c93e7" label="Planning" />
              <LegendDot color="#f59e0b" label="Medium risk (≥50%)" />
              <LegendDot color="#8b5cf6" label="Completed" />
              <LegendDot color="#64748b" label="On hold / cancelled" />
            </div>
          </div>
          {/* Zoom helper */}
          <button onClick={() => mapInstance.current?.setView(INDIA_CENTER, 5)}
            className="absolute right-3 top-3 z-[1000] rounded-lg border bg-card/90 p-2 text-muted-foreground backdrop-blur transition hover:text-foreground"
            title="Reset to India view">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Side panel — selected project + list */}
        <div className="space-y-3">
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border bg-card p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#0c93e7]">{selected.psId} · {selected.state}</div>
              <div className="mt-1 text-[13px] font-bold leading-tight">{selected.name}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {selected.district} · {inrCompact(selected.budgetL * 1e5)} · {selected.progress}% complete
              </div>
              <div className="mt-2 flex items-center gap-2 text-[10.5px]">
                <span className="rounded px-1.5 py-0.5 font-bold" style={{ background: STATUS_COLOR[selected.status] + "22", color: STATUS_COLOR[selected.status] }}>
                  {selected.status.replace("_", " ")}
                </span>
                {(selected.prediction?.probability ?? 0) > 0 && (
                  <span className="rounded bg-amber-100/70 px-1.5 py-0.5 font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                    {Math.round((selected.prediction!.probability ?? 0) * 100)}% delay
                  </span>
                )}
              </div>
              {selected.prediction?.factors?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selected.prediction.factors.slice(0, 3).map(f => (
                    <span key={f.label} className="rounded bg-muted px-1.5 py-0.5 text-[9.5px] font-medium text-muted-foreground">{f.label}</span>
                  ))}
                </div>
              ) : null}
              <button onClick={() => navigate("project-detail", { projectId: selected.id })}
                className="mt-3 w-full rounded-lg bg-[#0284c7] px-3 py-2 text-[12px] font-semibold text-white shadow-sm hover:bg-[#0369a1]">
                Open project detail →
              </button>
            </motion.div>
          )}

          <div className="rounded-xl border bg-card p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              <Layers className="h-3 w-3" /> Visible projects
            </div>
            <div className="max-h-[340px] space-y-1.5 overflow-y-auto pr-1">
              {visible.slice(0, 12).map(p => {
                const prob = p.prediction?.probability ?? 0;
                const color = prob > 0.7 ? "#dc2626" : prob > 0.5 ? "#f59e0b" : STATUS_COLOR[p.status] ?? "#64748b";
                return (
                  <button key={p.id} onClick={() => {
                    setSelected(p);
                    mapInstance.current?.setView([p.latitude, p.longitude], 7);
                  }}
                    className={cn("flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition",
                      selected?.id === p.id ? "border-[#0c93e7] bg-[#e0effe]/40 dark:bg-[#0c93e7]/10" : "hover:bg-muted")}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 0 2px ${color}33` }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11.5px] font-semibold">{p.psId} · {p.name.slice(0, 28)}{p.name.length > 28 ? "…" : ""}</div>
                      <div className="text-[9.5px] text-muted-foreground">{p.state} · {p.progress}% · {inrCompact(p.budgetL * 1e5)}</div>
                    </div>
                    {prob > 0 && <span className="text-[10px] font-bold text-amber-600">{Math.round(prob * 100)}%</span>}
                  </button>
                );
              })}
              {visible.length > 12 && <div className="text-center text-[10px] text-muted-foreground">+{visible.length - 12} more on the map</div>}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes pa-pulse { 0% { box-shadow:0 0 0 0 rgba(220,38,38,0.6); } 70% { box-shadow:0 0 0 10px rgba(220,38,38,0); } 100% { box-shadow:0 0 0 0 rgba(220,38,38,0); } }
        .pa-pin { background:transparent !important; border:none !important; }
        .leaflet-popup-content-wrapper { border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.12); }
      `}</style>
    </div>
  );
}

function FilterChip({ active, onClick, label, tone }: { active: boolean; onClick: () => void; label: string; tone?: "amber" | "emerald" | "violet" }) {
  const toneCls = tone === "amber" ? "text-amber-700 dark:text-amber-300"
    : tone === "emerald" ? "text-emerald-700 dark:text-emerald-300"
    : tone === "violet" ? "text-violet-700 dark:text-violet-300"
    : "text-foreground";
  return (
    <button onClick={onClick}
      className={cn("rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition",
        active ? "border-[#0c93e7] bg-[#e0effe]/60 dark:bg-[#0c93e7]/15" : "hover:bg-muted", toneCls)}>
      {label}
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 0 2px ${color}33` }} />
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}
