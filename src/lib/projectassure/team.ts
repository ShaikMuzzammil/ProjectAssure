// ═══════════════════════════════════════════════════════════════════════════
// Team NEXGEN — the six members behind ProjectAssure (SIH 2026 · SIH26103).
// ⚑ EDIT HERE: replace the placeholder member details below with your real
// team.txt data — this single array feeds the About page, the deck and docs.
// ═══════════════════════════════════════════════════════════════════════════

export interface TeamMember {
  name: string;
  initials: string;
  role: string;          // e.g. "Team Lead · Full-Stack Engineering"
  focus: string;         // one-line what they own in the project
}

export const TEAM_MEMBERS: TeamMember[] = [
  { name: "Arun Kulkarni", initials: "AK", role: "Team Lead · Platform Engineering", focus: "Owns the overall architecture, the secure sign-in system and the single-deployment pipeline." },
  { name: "Priya Venkatesh", initials: "PV", role: "Prediction Engine · Data Modelling", focus: "Built the risk-scoring and delay/cost prediction models with explainable factors." },
  { name: "Sneha Iyer", initials: "SI", role: "Intelligence Assistant · Smart Documents", focus: "Built the cited Q&A assistant and the automatic report-reading pipeline." },
  { name: "Meera Nair", initials: "MN", role: "UI/UX · Design System", focus: "Designed the seven-feature cockpit, the guided workflows and the light/dark themes." },
  { name: "Rohan Deshpande", initials: "RD", role: "Reports · Exports & Email Delivery", focus: "Built the PDF/Excel exports, the email delivery centre and the audit trail." },
  { name: "Ananya Krishnan", initials: "AN", role: "Quality · Testing & Documentation", focus: "Runs end-to-end verification and writes the plain-language team guides." },
];
