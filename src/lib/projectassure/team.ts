// ═══════════════════════════════════════════════════════════════════════════
// Team NEXGEN — the six members behind ProjectAssure (SIH 2026 · SIH26103).
// Updated v13 with the official team roster.
// ═══════════════════════════════════════════════════════════════════════════

export interface TeamMember {
  name: string;
  initials: string;
  role: string;          // e.g. "Team Lead · Full-Stack Engineering"
  focus: string;         // one-line what they own in the project
}

export const TEAM_MEMBERS: TeamMember[] = [
  { name: "Harshavardhan", initials: "HV", role: "Team Lead · Platform Architecture", focus: "Owns the overall architecture, the secure sign-in system, the deployment pipeline and the host-control integration layer." },
  { name: "Shaik Muzzammil", initials: "SM", role: "Intelligence Assistant · Multi-Provider AI Chain", focus: "Built the Gemini-first provider chain, the ReAct agent loop, document grounding and the universal-mode intelligence centre." },
  { name: "Kalathuru Varshitha", initials: "KV", role: "Prediction Engine · ML & Risk Modelling", focus: "Designed the 18-signal risk engine, the delay/cost prediction models with explainable factors and the health-score composite." },
  { name: "Keerthana Varapradha NB", initials: "KP", role: "Document Intelligence · OCR & RAG", focus: "Built the in-browser document reader, the 45-pattern risk scanner, the vector index and the citation pipeline." },
  { name: "Nishitha Penagaluru", initials: "NP", role: "UI/UX · Design System & Workflows", focus: "Designed the seven-feature cockpit, the guided workflows, the light/dark themes and the responsive design system." },
  { name: "A. Gandhimathi", initials: "GM", role: "Quality · Testing, Reports & Documentation", focus: "Runs end-to-end verification, owns the PDF/Excel/CSV export pipeline, the email delivery centre and the audit trail." },
];
