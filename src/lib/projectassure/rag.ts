// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — RAG-lite vector store.
// A genuine in-browser vector database: 256-dim hashing embeddings + cosine
// similarity + metadata filtering (projectId / docType). This is the same
// retrieval contract as the production search index design, executed
// deterministically client-side so citations are real, not canned.
// ═══════════════════════════════════════════════════════════════════════════
import type { Project, VectorChunk, DocumentItem } from "./types";

export const EMBED_DIM = 256;
const TOKEN_RE = /[a-z0-9%₹]+/g;

function hashToken(tok: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < tok.length; i++) {
    h ^= tok.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Hashing trick embedding with 3-gram features; L2-normalised. */
export function embed(text: string): Float32Array {
  const v = new Float32Array(EMBED_DIM);
  const toks = (text.toLowerCase().match(TOKEN_RE) ?? []).filter(t => t.length > 2);
  for (let i = 0; i < toks.length; i++) {
    for (const salt of [1, 2, 3]) v[hashToken(toks[i], salt) % EMBED_DIM] += 1;
    if (i + 1 < toks.length) v[hashToken(toks[i] + "_" + toks[i + 1], 7) % EMBED_DIM] += 0.6;
  }
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

// ─── Chunking: heading/paragraph aware, ~800 tokens target with overlap ─────
export function chunkDocument(doc: DocumentItem, projectId: string): VectorChunk[] {
  const text = doc.text ?? "";
  if (!text) return [];
  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks: VectorChunk[] = [];
  let current: string[] = [];
  let currentPage = 1;
  const approxTokens = (s: string) => Math.ceil(s.length / 4);

  for (const para of paras) {
    const pageGuess = /Pages?:\s*(\d+)/i.exec(text.slice(0, 400))?.[1];
    current.push(para);
    const joined = current.join("\n\n");
    if (approxTokens(joined) >= 180) { // demo scale: ~180 "tokens" per chunk
      chunks.push({
        id: `${doc.id}-ch-${chunks.length}`, documentId: doc.id, projectId,
        chunkIndex: chunks.length, text: joined, tokens: approxTokens(joined),
        pageStart: currentPage, pageEnd: Math.min(currentPage + 2, doc.totalPages),
        docType: doc.fileName.includes("Financial") ? "budget_note" : doc.fileName.includes("Inspection") ? "correspondence" : "progress_report",
      });
      currentPage = Math.min(currentPage + 1, doc.totalPages);
      current = current.length ? [current[current.length - 1]] : []; // overlap
    }
  }
  if (current.length) {
    const joined = current.join("\n\n");
    chunks.push({ id: `${doc.id}-ch-${chunks.length}`, documentId: doc.id, projectId, chunkIndex: chunks.length, text: joined, tokens: approxTokens(joined), pageStart: currentPage, pageEnd: doc.totalPages, docType: "progress_report" });
  }
  return chunks;
}

export interface SearchHit {
  chunk: VectorChunk;
  score: number;
  document: DocumentItem;
  project?: Project;
}

export interface VectorIndex {
  chunks: VectorChunk[];
  matrix: Float32Array[];   // aligned with chunks
  documents: Map<string, DocumentItem>;
  projects: Map<string, Project>;
  builtAt: string;
}

export function buildIndex(projects: Project[]): VectorIndex {
  const chunks: VectorChunk[] = [];
  const documents = new Map<string, DocumentItem>();
  const projectMap = new Map<string, Project>();
  for (const p of projects) {
    projectMap.set(p.id, p);
    for (const d of p.documents) {
      if (d.text) {
        documents.set(d.id, d);
        chunks.push(...chunkDocument(d, p.id));
      }
    }
  }
  return { chunks, matrix: chunks.map(c => embed(c.text)), documents, projects: projectMap, builtAt: new Date().toISOString() };
}

export function search(index: VectorIndex, query: string, opts: { projectId?: string; topK?: number; minScore?: number } = {}): SearchHit[] {
  const q = embed(query);
  const topK = opts.topK ?? 5;
  const minScore = opts.minScore ?? 0.045;
  const hits: SearchHit[] = [];
  for (let i = 0; i < index.chunks.length; i++) {
    if (opts.projectId && index.chunks[i].projectId !== opts.projectId) continue;
    const score = cosine(q, index.matrix[i]);
    if (score >= minScore) {
      const doc = index.documents.get(index.chunks[i].documentId);
      if (doc) hits.push({ chunk: index.chunks[i], score: +score.toFixed(3), document: doc, project: index.projects.get(index.chunks[i].projectId) });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, topK);
}
