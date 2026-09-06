// ═══════════════════════════════════════════════════════════════════════════
// ProjectAssure — Geo-tagged photo verification engine (v21).
// REAL EXIF GPS parsing (JPEG APP1 + TIFF IFD0/GPS IFD, big/little endian),
// browser Geolocation fallback at capture time, haversine distance to the
// project site, timestamp freshness checks and a verification verdict.
// ═══════════════════════════════════════════════════════════════════════════

export interface ExifGps {
  latitude?: number;
  longitude?: number;
  timestamp?: string;       // DateTimeOriginal
  altitude?: number;
  source: "exif";
}

/** Parse EXIF from a JPEG File. Returns undefined when no usable EXIF exists. */
export async function parseExif(file: File | Blob): Promise<ExifGps | undefined> {
  const head = new DataView(await file.slice(0, 128 * 1024).arrayBuffer());
  if (head.byteLength < 4 || head.getUint16(0, false) !== 0xffd8) return undefined; // not JPEG
  let offset = 2;
  while (offset + 4 <= head.byteLength) {
    const marker = head.getUint16(offset, false);
    const size = head.getUint16(offset + 2, false);
    if (marker === 0xffe1 && offset + 4 + 6 <= head.byteLength) {
      // APP1 — check for "Exif\0\0"
      if (
        head.getUint32(offset + 4, false) === 0x45786966 &&
        head.getUint16(offset + 8, false) === 0x0000
      ) {
        const tiff = offset + 10;
        return parseTiff(head, tiff);
      }
    }
    if ((marker & 0xff00) !== 0xff00 || size <= 0) break;
    offset += 2 + size;
  }
  return undefined;
}

function parseTiff(view: DataView, tiff: number): ExifGps | undefined {
  const endian = view.getUint16(tiff, false);
  const le = endian === 0x4949; // II = little endian
  if (!le && endian !== 0x4d4d) return undefined;
  const u16 = (o: number) => view.getUint16(o, le);
  const u32 = (o: number) => view.getUint32(o, le);
  const ifd0 = tiff + u32(tiff + 4);
  const ifd0Entries = u16(ifd0);

  let gpsOffset = 0;
  let exifOffset = 0;
  for (let i = 0; i < ifd0Entries; i++) {
    const entry = ifd0 + 2 + i * 12;
    const tag = u16(entry);
    if (tag === 0x8825) gpsOffset = tiff + u32(entry + 8);
    if (tag === 0x8769) exifOffset = tiff + u32(entry + 8);
  }

  const gps: ExifGps = { source: "exif" };

  // DateTimeOriginal lives in the EXIF sub-IFD
  if (exifOffset) {
    const n = u16(exifOffset);
    for (let i = 0; i < n; i++) {
      const entry = exifOffset + 2 + i * 12;
      if (u16(entry) === 0x9003) {
        // ASCII string
        const count = u32(entry + 4);
        const valOff = count > 4 ? tiff + u32(entry + 8) : entry + 8;
        let s = "";
        for (let c = 0; c < count - 1 && valOff + c < view.byteLength; c++) s += String.fromCharCode(view.getUint8(valOff + c));
        // EXIF format "YYYY:MM:DD HH:MM:SS"
        const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ ](\d{2}):(\d{2}):(\d{2})/);
        if (m) gps.timestamp = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`).toISOString();
      }
    }
  }

  if (!gpsOffset) return gps.timestamp ? gps : undefined;
  const gn = u16(gpsOffset);
  let latRef = "N", lonRef = "E";
  const latVals: number[] = [];
  const lonVals: number[] = [];
  let altVal: number | undefined;
  let altRef = 0;
  let stampVals: number[] = [];
  let dateStamp = "";
  for (let i = 0; i < gn; i++) {
    const entry = gpsOffset + 2 + i * 12;
    const tag = u16(entry);
    const typ = u16(entry + 2);
    const count = u32(entry + 4);
    const valOff = count * typeSize(typ) > 4 ? tiff + u32(entry + 8) : entry + 8;
    const rationals = (o: number, n: number) =>
      Array.from({ length: n }, (_, k) => {
        const num = u32(o + k * 8);
        const den = u32(o + k * 8 + 4);
        return den === 0 ? 0 : num / den;
      });
    switch (tag) {
      case 0x0001: latRef = asciiAt(view, valOff); break;
      case 0x0002: latVals.push(...rationals(valOff, count)); break;
      case 0x0003: lonRef = asciiAt(view, valOff); break;
      case 0x0004: lonVals.push(...rationals(valOff, count)); break;
      case 0x0005: altRef = view.getUint8(valOff); break;
      case 0x0006: {
        const r = rationals(valOff, count);
        if (r[0] !== undefined) altVal = r[0] * (altRef === 1 ? -1 : 1);
        break;
      }
      case 0x0007: stampVals = rationals(valOff, count); break;
      case 0x001d: {
        let s = "";
        for (let c = 0; c < count - 1; c++) s += String.fromCharCode(view.getUint8(valOff + c));
        dateStamp = s;
        break;
      }
    }
  }
  const dms = (vals: number[]) => {
    if (vals.length < 3) return undefined;
    const [d, m, s] = vals;
    const base = d + m / 60 + s / 3600;
    return Number.isFinite(base) ? +base.toFixed(6) : undefined;
  };
  const lat = dms(latVals);
  const lon = dms(lonVals);
  if (lat !== undefined) gps.latitude = latRef === "S" ? -lat : lat;
  if (lon !== undefined) gps.longitude = lonRef === "W" ? -lon : lon;
  if (altVal !== undefined) gps.altitude = altVal;
  if (!gps.timestamp && dateStamp && stampVals.length >= 3) {
    const [h, mi, s] = stampVals;
    const parsed = new Date(`${dateStamp.replace(/:/g, "-")}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")}`);
    if (!Number.isNaN(parsed.getTime())) gps.timestamp = parsed.toISOString();
  }
  if (gps.latitude === undefined && gps.longitude === undefined && !gps.timestamp) return undefined;
  return gps;
}

function asciiAt(view: DataView, off: number): string {
  return String.fromCharCode(view.getUint8(off));
}

function typeSize(t: number): number {
  return [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8][t] ?? 1;
}

// ─── distance + verdict ─────────────────────────────────────────────────────
export function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return +(2 * R * Math.asin(Math.sqrt(h))).toFixed(2);
}

export interface VerifyInput {
  photoGps?: { latitude: number; longitude: number };
  photoTimestamp?: string;
  capturedAt?: string;           // browser geolocation time
  site: { latitude: number; longitude: number };
  projectEnd?: string;
}

export type Verdict = "VERIFIED" | "NEAR_SITE" | "GPS_MISMATCH" | "STALE" | "NO_GPS";

export interface VerifyResult {
  verdict: Verdict;
  distanceKm?: number;
  ageHours?: number;
  reason: string;
}

/** Site radius: 2 km strict / 10 km flagged (configurable by callers). */
export function verifyEvidence(input: VerifyInput, strictKm = 2, nearKm = 10): VerifyResult {
  const now = Date.now();
  const ts = input.photoTimestamp ?? input.capturedAt;
  if (!ts) {
    return { verdict: "STALE", reason: "No timestamp available — cannot prove recency. Ask the field officer to re-submit with camera timestamp or live GPS." };
  }
  const ageHours = (now - new Date(ts).getTime()) / 3600000;
  if (ageHours > 24 * 31) {
    return { verdict: "STALE", reason: `Photo is ${Math.round(ageHours / 24)} days old — evidence must be current (submitted within 31 days).` };
  }
  if (!input.photoGps) {
    return { verdict: "NO_GPS", reason: "No GPS coordinates found in the photo (EXIF) or the capture session. Location proof missing." };
  }
  const distanceKm = haversineKm(input.photoGps, input.site);
  if (distanceKm <= strictKm) {
    return { verdict: "VERIFIED", distanceKm, ageHours: +ageHours.toFixed(1), reason: `GPS lock ${distanceKm} km from the project site and timestamp within limits — genuine on-site evidence.` };
  }
  if (distanceKm <= nearKm) {
    return { verdict: "NEAR_SITE", distanceKm, ageHours: +ageHours.toFixed(1), reason: `Photo taken ${distanceKm} km from the site centre — within the ${nearKm} km tolerance band but outside the strict ${strictKm} km zone. Review manually.` };
  }
  return { verdict: "GPS_MISMATCH", distanceKm, ageHours: +ageHours.toFixed(1), reason: `Photo taken ${distanceKm} km away from the project site — GPS mismatch. Not acceptable as site evidence without explanation.` };
}

// ─── image downscale (keep storage sane) ───────────────────────────────────
export async function downscaleImage(file: File | Blob, maxDim = 900, quality = 0.72): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return "";
  }
}
