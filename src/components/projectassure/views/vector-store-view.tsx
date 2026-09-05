"use client";

import React, { useMemo, useState } from "react";
import { useApp } from "@/store/app-store";
import { search, EMBED_DIM } from "@/lib/projectassure/rag";
import { SectionTitle, EmptyState } from "../shared/ui-bits";
import { Md } from "../shared/ui-bits";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Database, Search, Braces, FileText, Cpu, Layers } from "lucide-react";

export default function VectorStoreView() {
  const vectorIndex = useApp(s => s.vectorIndex);
  const projects = useApp(s => s.projects);
  const openProject = useApp(s => s.openProject);
  const [q, setQ] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [topK, setTopK] = useState(5);
  const [hits, setHits] = useState<ReturnType<typeof search> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const run = () => {
    if (!vectorIndex || !q.trim()) return;
    const results = search(vectorIndex, q, { projectId: projectId === "all" ? undefined : projectId, topK });
    setHits(results);
    setSelected(results[0]?.chunk.id ?? null);
    toast.info(`${results.length} chunks above threshold`, { description: `cosine ≥ 0.045 · ${EMBED_DIM}-dim hashing embeddings · metadata-filtered (${projectId === "all" ? "no project filter" : projectId})` });
  };

  const byProject = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of vectorIndex?.chunks ?? []) m.set(c.projectId, (m.get(c.projectId) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [vectorIndex]);

  const sel = hits?.find(h => h.chunk.id === selected);
  const dim = useMemo(() => {
    if (!vectorIndex?.matrix.length) return [];
    const v = vectorIndex.matrix[0];
    const stride = Math.max(1, Math.floor(v.length / 64));
    return Array.from({ length: 64 }, (_, i) => v[i * stride]);
  }, [vectorIndex]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4">
      <div>
        <h1 className="text-[20px] font-bold tracking-tight">Vector Store</h1>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">The RAG corpus: {vectorIndex?.chunks.length ?? 0} chunks · {vectorIndex?.documents.size ?? 0} documents · {EMBED_DIM}-dim embeddings — browse, inspect and query just like production</p>
      </div>

      {/* search tester */}
      <div className="rounded-xl border bg-card p-5">
        <SectionTitle icon={Search} sub="query → embed → cosine rank → metadata filter → cited chunks">Semantic search tester</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === "Enter" && run()} placeholder="e.g., steel procurement pending monsoon utility relocation"
            className="h-10 min-w-[260px] flex-1 rounded-lg border bg-background px-3 text-[13px] outline-none transition focus:border-[#0c93e7]" />
          <select value={projectId} onChange={e => setProjectId(e.target.value)} className="h-10 rounded-lg border bg-background px-2 text-[12px]">
            <option value="all">All projects</option>
            {projects.filter(p => (vectorIndex?.chunks.some(c => c.projectId === p.id))).map(p => <option key={p.id} value={p.id}>{p.psId}</option>)}
          </select>
          <select value={topK} onChange={e => setTopK(+e.target.value)} className="h-10 rounded-lg border bg-background px-2 text-[12px]">
            {[3, 5, 8, 12].map(k => <option key={k} value={k}>top {k}</option>)}
          </select>
          <Button onClick={run} className="bg-gradient-to-r from-[#0b426e] to-[#0c93e7]"><Search className="h-4 w-4" />Search</Button>
        </div>

        {hits && (
          <div className="mt-4 grid gap-3 lg:grid-cols-[300px_1fr]">
            <div className="custom-scrollbar max-h-[380px] space-y-2 overflow-y-auto pr-1">
              {hits.length === 0 && <EmptyState icon={Search} title="No chunks above threshold" body="Try different phrasing — the corpus covers the seeded monthly reports, financial statements and inspection notes." />}
              {hits.map(h => (
                <button key={h.chunk.id} onClick={() => setSelected(h.chunk.id)}
                  className={cn("block w-full rounded-lg border p-3 text-left transition", selected === h.chunk.id ? "border-[#0c93e7] bg-[#e0effe]/40 dark:bg-[#0c93e7]/10" : "hover:border-[#0c93e7]/40")}>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#e0effe] px-1.5 text-[10px] font-bold text-[#015ca0] dark:bg-[#0c93e7]/15 dark:text-[#7cc8fb]">cos {h.score}</span>
                    <span className="truncate text-[11px] font-semibold">{h.document.fileName}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">{h.chunk.text.slice(0, 120)}…</div>
                </button>
              ))}
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              {sel ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-[#0c93e7]" />
                    <span className="text-[12.5px] font-bold">{sel.document.fileName}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">{sel.project?.psId}</span>
                    <span className="text-[10px] text-muted-foreground">pp. {sel.chunk.pageStart}–{sel.chunk.pageEnd} · {sel.chunk.tokens} tokens · chunk #{sel.chunk.chunkIndex} · {sel.chunk.docType}</span>
                    <button onClick={() => sel.project && openProject(sel.project.id, "documents")} className="ml-auto rounded-lg border px-2 py-1 text-[10.5px] font-semibold hover:bg-background">Open project →</button>
                  </div>
                  <div className="mt-2.5 rounded-lg border bg-background p-3 text-[11.5px] leading-relaxed text-muted-foreground">{sel.chunk.text}</div>
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Braces className="h-3 w-3" />chunk id <span className="font-mono">{sel.chunk.id}</span> · semantic vector · scope = ministry (production: one scope per ministry)
                  </div>
                </>
              ) : <div className="text-[12px] text-muted-foreground">Select a hit to inspect the chunk.</div>}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
          <SectionTitle icon={Database} sub="chunks per project (metadata: projectId · docType · pages · checksum)">Namespace distribution</SectionTitle>
          <div className="custom-scrollbar max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
            {byProject.map(([pid, count]) => {
              const p = projects.find(x => x.id === pid);
              return (
                <div key={pid} className="flex items-center gap-3">
                  <button onClick={() => p && openProject(pid, "documents")} className="w-24 shrink-0 text-left font-mono text-[10px] text-[#015ca0] hover:underline dark:text-[#7cc8fb]">{p?.psId ?? pid}</button>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-[#0b426e] to-[#0c93e7]" style={{ width: `${(count / (byProject[0]?.[1] ?? 1)) * 100}%` }} /></div>
                  <span className="w-8 text-right text-[11px] font-bold tabular">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <SectionTitle icon={Cpu} sub="first chunk, downsampled to 64 dims">Embedding preview</SectionTitle>
          <div className="grid grid-cols-16 gap-1">
            {dim.map((v, i) => (
              <div key={i} className="flex h-6 items-end justify-center rounded-sm" title={`dim ${i}: ${v.toFixed(3)}`}
                style={{ background: v > 0 ? `rgba(12,147,231,${Math.min(1, 0.15 + v * 2)})` : `rgba(148,163,184,0.25)` }}>
                <div className="w-1 rounded-sm" style={{ height: `${Math.max(8, Math.min(100, Math.abs(v) * 160))}%`, background: v > 0 ? "#0c93e7" : "#94a3b8" }} />
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1 text-[10.5px] text-muted-foreground">
            <div>Embedding: hashing-trick unigrams + bigrams, 3 salts, L2-normalised.</div>
            <div>Chunking: ~180-token target, paragraph-aware, 1-chunk overlap.</div>
            <div>Retrieval: cosine, min score 0.045, optional rerank 8→5.</div>
            <div>Production: text-embedding-3-small (1536d) → an index that scales per ministry.</div>
          </div>
          <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-muted/40 px-2.5 py-2 text-[10px] text-muted-foreground">
            <Layers className="h-3.5 w-3.5 shrink-0" />PII is masked pre-embedding (R8) — names, mobiles and IDs become [REDACTED] in every chunk.
          </div>
        </div>
      </div>
    </div>
  );
}
