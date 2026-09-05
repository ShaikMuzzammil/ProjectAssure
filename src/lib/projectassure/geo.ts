// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — Geo utilities.
// Maps Indian states (and project districts) to real approximate coordinates
// so newly created projects land in the right place on the national map —
// instead of random coordinates.
// ═══════════════════════════════════════════════════════════════════════════

export interface StateGeo {
  lat: number;
  lng: number;
  /** deterministic district offsets so markers of one state don't overlap */
  spread: number;
}

/** Approximate geographic centres of Indian states / UTs. */
export const STATE_GEO: Record<string, StateGeo> = {
  "Andhra Pradesh": { lat: 15.91, lng: 79.74, spread: 1.4 },
  "Arunachal Pradesh": { lat: 28.22, lng: 94.72, spread: 1.2 },
  Assam: { lat: 26.2, lng: 92.94, spread: 1.0 },
  Bihar: { lat: 25.1, lng: 85.09, spread: 1.1 },
  Chhattisgarh: { lat: 21.27, lng: 81.6, spread: 1.2 },
  Goa: { lat: 15.3, lng: 74.08, spread: 0.3 },
  Gujarat: { lat: 22.26, lng: 71.77, spread: 1.5 },
  Haryana: { lat: 29.06, lng: 76.06, spread: 0.8 },
  "Himachal Pradesh": { lat: 31.1, lng: 77.17, spread: 0.8 },
  Jharkhand: { lat: 23.61, lng: 85.28, spread: 1.0 },
  Karnataka: { lat: 15.15, lng: 76.5, spread: 1.3 },
  Kerala: { lat: 10.45, lng: 76.26, spread: 0.7 },
  "Madhya Pradesh": { lat: 22.97, lng: 78.65, spread: 1.6 },
  Maharashtra: { lat: 19.76, lng: 75.36, spread: 1.6 },
  Manipur: { lat: 24.66, lng: 93.91, spread: 0.5 },
  Meghalaya: { lat: 25.47, lng: 91.36, spread: 0.5 },
  Mizoram: { lat: 23.47, lng: 92.82, spread: 0.5 },
  Nagaland: { lat: 26.16, lng: 94.62, spread: 0.5 },
  Odisha: { lat: 20.27, lng: 84.27, spread: 1.2 },
  Punjab: { lat: 31.15, lng: 75.34, spread: 0.8 },
  Rajasthan: { lat: 27.02, lng: 74.22, spread: 1.8 },
  Sikkim: { lat: 27.53, lng: 88.51, spread: 0.3 },
  "Tamil Nadu": { lat: 11.13, lng: 78.66, spread: 1.3 },
  Telangana: { lat: 17.98, lng: 79.59, spread: 1.0 },
  Tripura: { lat: 23.94, lng: 91.99, spread: 0.4 },
  "Uttar Pradesh": { lat: 26.85, lng: 80.95, spread: 1.8 },
  Uttarakhand: { lat: 30.07, lng: 79.19, spread: 0.8 },
  "West Bengal": { lat: 22.99, lng: 87.61, spread: 1.3 },
  Delhi: { lat: 28.61, lng: 77.21, spread: 0.35 },
  Jammu: { lat: 32.73, lng: 74.86, spread: 0.8 },
  Kashmir: { lat: 33.78, lng: 76.58, spread: 0.8 },
  Ladakh: { lat: 34.6, lng: 77.4, spread: 0.6 },
  Puducherry: { lat: 11.94, lng: 79.83, spread: 0.25 },
  Chandigarh: { lat: 30.73, lng: 76.78, spread: 0.2 },
};

/** Multi-level monitoring drill-down: national → state → district. */
export interface RegionLevel { id: string; label: string; kind: "NATIONAL" | "STATE" | "DISTRICT"; lat: number; lng: number; }

/**
 * Deterministic geocode for a project: state centre + hash jitter from the
 * district name, so the same district always lands on the same spot and
 * different districts inside one state spread apart.
 */
export function geocodeProject(state: string, district: string): { latitude: number; longitude: number } {
  const g = STATE_GEO[state] ?? STATE_GEO["Madhya Pradesh"]; // centre of India fallback
  const hash = (s: string): number => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 1000) / 1000; // 0…1
  };
  const jx = (hash(district) - 0.5) * 2;   // −1…1
  const jy = (hash(`${district}#y`) - 0.5) * 2;
  return {
    latitude: +(g.lat + jy * g.spread * 0.5).toFixed(4),
    longitude: +(g.lng + jx * g.spread * 0.6).toFixed(4),
  };
}

/** National → state → district hierarchy used by the drill-down map panel. */
export function regionFor(state: string, district: string): RegionLevel[] {
  const g = STATE_GEO[state] ?? STATE_GEO["Madhya Pradesh"];
  const d = geocodeProject(state, district);
  return [
    { id: "IN", label: "India (National)", kind: "NATIONAL", lat: 22.9, lng: 78.9 },
    { id: state.replace(/\s+/g, "-"), label: state, kind: "STATE", lat: g.lat, lng: g.lng },
    { id: `${state.replace(/\s+/g, "-")}-${district.replace(/\s+/g, "-")}`, label: district, kind: "DISTRICT", lat: d.latitude, lng: d.longitude },
  ];
}
