// Heuristic estimator: no real people data available for random OSM courts,
// so we synthesize a defensible "expected players" count from:
//   - hour-of-day curve (empty overnight, peak early evening)
//   - day-of-week factor (weekends busier)
//   - court capacity proxy (# of hoops if tagged, else default)
//   - amenity boosts (lit -> longer evenings; covered -> weather-independent)
//   - deterministic per-court jitter so identical courts don't look identical
// Output is a range { low, mid, high } of estimated players currently on-site.

import type { Court } from "./courts";

// Prominence score 0..~10 — used to hide obscure courts at low zooms.
// Signals: has a real name, more hoops, lit, indoor/covered (implies real facility),
// public access. Untagged random pitches score lowest.
export function prominence(c: Court): number {
  let s = 0;
  if (c.name && c.name !== "Basketball court") s += 3;
  if (c.hoops) s += Math.min(3, c.hoops); // 1..3
  if (c.lit) s += 1.5;
  if (c.indoor) s += 2;
  else if (c.covered) s += 1;
  if (c.surface && c.surface !== "dirt" && c.surface !== "grass") s += 0.5;
  if (c.access === "private") s -= 1;
  return s;
}

// Given a Leaflet zoom level, return the minimum prominence a court needs to be visible.
// zoom ~16 (street): show everything. zoom ~10 (metro): only marquee courts.
export function minProminenceForZoom(zoom: number): number {
  if (zoom >= 15) return -Infinity;
  if (zoom >= 14) return 1;
  if (zoom >= 13) return 2.5;
  if (zoom >= 12) return 4;
  if (zoom >= 11) return 6;
  return 8;
}

// Base hourly demand curve (0-23), normalized 0..1. Rough shape of pickup runs.
const HOUR_CURVE = [
  0.02, 0.01, 0.01, 0.01, 0.01, 0.02, // 0-5 dead
  0.08, 0.15, 0.20, 0.22, 0.25, 0.30, // 6-11 morning ramp
  0.35, 0.35, 0.32, 0.38, 0.55, 0.80, // 12-17 lunch dip -> after-school/work spike
  0.95, 0.90, 0.70, 0.45, 0.22, 0.08, // 18-23 evening peak fading
];

// Day of week factor. 0 = Sun ... 6 = Sat
const DOW_FACTOR = [1.15, 0.85, 0.85, 0.90, 0.95, 1.05, 1.25];

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

export type Busyness = {
  low: number;
  mid: number;
  high: number;
  label: "empty" | "light" | "moderate" | "busy" | "packed";
  color: string;
  score: number; // 0..1
};

export function estimateBusyness(court: Court, now: Date = new Date()): Busyness {
  const hour = now.getHours() + now.getMinutes() / 60;
  const h0 = Math.floor(hour) % 24;
  const h1 = (h0 + 1) % 24;
  const t = hour - Math.floor(hour);
  const hourWeight = HOUR_CURVE[h0] * (1 - t) + HOUR_CURVE[h1] * t;

  const dowWeight = DOW_FACTOR[now.getDay()];

  const hoops = court.hoops ?? 2;
  // Capacity: ~3 players per hoop is a comfortable half-court run.
  const capacity = Math.max(2, hoops * 3);

  // Amenity multipliers
  let amenityMult = 1.0;
  if (court.lit) {
    // Lit courts hold their crowd later into the night
    if (hour >= 19) amenityMult *= 1.25;
  }
  if (court.covered || court.indoor) {
    amenityMult *= 1.10; // less weather sensitive
  }
  if (court.access === "private") amenityMult *= 0.35;

  // Deterministic jitter per court so two identical parks don't read identical
  const jitter = 0.75 + hashStr(court.id) * 0.6; // 0.75..1.35

  const score = Math.min(1, hourWeight * dowWeight * amenityMult * jitter);
  const mid = Math.round(capacity * score);
  const low = Math.max(0, Math.round(mid * 0.6));
  const high = Math.round(mid * 1.5);

  let label: Busyness["label"];
  let color: string;
  if (score < 0.08) { label = "empty"; color = "#22c55e"; }
  else if (score < 0.25) { label = "light"; color = "#84cc16"; }
  else if (score < 0.5) { label = "moderate"; color = "#eab308"; }
  else if (score < 0.8) { label = "busy"; color = "#f97316"; }
  else { label = "packed"; color = "#ef4444"; }

  return { low, mid, high, label, color, score };
}

export function hourlyForecast(court: Court, now: Date = new Date()): Busyness[] {
  const out: Busyness[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getTime() + i * 60 * 60 * 1000);
    out.push(estimateBusyness(court, d));
  }
  return out;
}
