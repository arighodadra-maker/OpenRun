// Heuristic busyness estimator, calibrated against real-world observation data.
//
// Research basis:
//  - Direct-observation park studies (SOPARC; RAND LA parks study; National Study
//    of Neighborhood Parks) find park target areas EMPTY in 57-77% of daytime
//    observations. The median neighborhood court should therefore read empty or
//    near-empty most of the day — busyness is the exception, not the default.
//  - Pickup demand peaks weekday evenings (after work/school) and weekend late
//    morning through afternoon; weekday mid-morning/early-afternoon is dead.
//  - Weather dominates outdoor play: rain ~kills it, sub-freezing temps cut park
//    visits >20%, extreme heat suppresses midday play, strong wind ruins shooting.
//  - Outdoor play concentrates late spring -> early fall; unlit courts die at dark.
//
// Factors combined (each 0..~1.2):
//   hour-of-day curve (separate weekday/weekend shapes) x day-of-week
//   x daylight (sunrise/sunset model; lit courts extend evenings; indoor exempt)
//   x weather (live Open-Meteo temp/rain/snow/wind when available, else seasonal proxy)
//   x school lockout (school courts inaccessible during class hours)
//   x access (private/customers courts rarely host runs)
//   x popularity (prominence-derived: named, multi-hoop, lit facilities draw runs;
//     anonymous single-hoop pitches rarely do) x deterministic per-court jitter
//
// Output is expected players { low, mid, high }; sub-1 expectations floor to 0
// since pickup runs are threshold events (a run materializes or it doesn't).

import type { Court } from "./courts";
import { weatherAt, type HourlyWeather, type Weather } from "./weather";

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

// Hourly demand shape 0..1. Weekdays: dead until after school (~15h), ramp to an
// evening peak ~19h. Weekends: late-morning ramp, peak early afternoon, long tail.
const WEEKDAY_CURVE = [
  0.01, 0.0, 0.0, 0.0, 0.0, 0.02, // 0-5 dead
  0.05, 0.08, 0.10, 0.12, 0.15, 0.18, // 6-11 sparse morning shooters
  0.22, 0.20, 0.22, 0.35, 0.55, 0.75, // 12-17 lunch blip -> after-school ramp
  0.90, 1.00, 0.85, 0.55, 0.25, 0.08, // 18-23 evening peak, fade
];
const WEEKEND_CURVE = [
  0.02, 0.0, 0.0, 0.0, 0.0, 0.01, // 0-5 dead
  0.03, 0.08, 0.20, 0.40, 0.65, 0.85, // 6-11 morning ramp
  0.95, 1.00, 0.95, 0.90, 0.85, 0.80, // 12-17 afternoon peak plateau
  0.72, 0.60, 0.45, 0.28, 0.12, 0.04, // 18-23 evening fade
];

// Day-of-week multiplier. 0 = Sun ... 6 = Sat. Saturday is the biggest hoops day.
const DOW_FACTOR = [0.92, 1.0, 1.0, 1.0, 1.0, 0.95, 1.05];

// Monthly outdoor-season proxy (northern hemisphere), used only when live
// weather is unavailable. Flipped for southern latitudes.
const SEASON_NORTH = [0.35, 0.4, 0.6, 0.8, 0.95, 1.0, 1.0, 1.0, 0.95, 0.75, 0.5, 0.35];

// Global calibration: scales expected players so the median court's daily
// profile matches observed 57-77% empty rates. Tuned, not physical.
const BASE_RATE = 0.8;

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Piecewise-linear interpolation over sorted [x, y] control points.
function piecewise(points: [number, number][], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i][0]) {
      const [x0, y0] = points[i - 1];
      const [x1, y1] = points[i];
      return lerp(y0, y1, (x - x0) / (x1 - x0));
    }
  }
  return points[points.length - 1][1];
}

function isDST(d: Date): boolean {
  const jan = new Date(d.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(d.getFullYear(), 6, 1).getTimezoneOffset();
  return d.getTimezoneOffset() < Math.max(jan, jul);
}

// Approximate local sunrise/sunset (decimal hours) from latitude + date.
// Ignores longitude-within-timezone and equation of time (~±30 min error),
// which is fine for a demand curve.
function sunTimes(lat: number, date: Date): { sunrise: number; sunset: number } {
  const start = new Date(date.getFullYear(), 0, 0);
  const doy = Math.floor((date.getTime() - start.getTime()) / 86400000);
  const decl = ((23.45 * Math.PI) / 180) * Math.sin((2 * Math.PI * (284 + doy)) / 365);
  const latR = (lat * Math.PI) / 180;
  const cosH = Math.min(1, Math.max(-1, -Math.tan(latR) * Math.tan(decl)));
  const halfDay = (Math.acos(cosH) * 12) / Math.PI; // hours from solar noon
  const noon = 12 + (isDST(date) ? 1 : 0);
  return { sunrise: noon - halfDay, sunset: noon + halfDay };
}

// 0..1 playability by available light. Unlit outdoor courts ramp to zero shortly
// after sunset; lit courts keep a high floor (overnight deadness comes from the
// hour curve, not this factor). Indoor courts are exempt.
function daylightFactor(court: Court, hour: number, date: Date): number {
  if (court.indoor) return 1;
  const { sunrise, sunset } = sunTimes(court.lat, date);
  const up = smoothstep(sunrise - 0.5, sunrise + 0.5, hour);
  const down = 1 - smoothstep(sunset - 0.25, sunset + 1.0, hour);
  const base = Math.min(up, down);
  return court.lit ? Math.max(base, 0.8) : base;
}

// Temperature comfort curve for outdoor basketball (°C -> 0..1).
// Grounded in park-visitation studies: <0C ~-20%+ visits (worse for a sport
// needing bare-hand ball control), >35C strongly suppressed.
const TEMP_CURVE: [number, number][] = [
  [-10, 0.03], [0, 0.12], [5, 0.3], [10, 0.6], [15, 0.85],
  [18, 1.0], [28, 1.0], [32, 0.85], [36, 0.6], [42, 0.3],
];

// 0..1 from a live weather sample. Covered courts shrug off rain but not cold.
function weatherFactor(court: Court, w: HourlyWeather): number {
  if (court.indoor) return 1;
  let f = piecewise(TEMP_CURVE, w.tempC);
  if (w.snowDepthM > 0.01 || w.snowCm > 0.1) {
    f *= court.covered ? 0.4 : 0.05; // snow on the court = no run
  } else if (w.precipMm >= 0.2) {
    f *= court.covered ? 0.7 : 0.08; // active rain
  } else if (w.precipMm > 0) {
    f *= court.covered ? 0.85 : 0.5; // drizzle / wet court
  }
  if (w.windKmh > 35) f *= court.covered ? 0.8 : 0.6; // shooting ruined
  else if (w.windKmh > 22) f *= 0.85;
  return f;
}

// Seasonal proxy used when live weather is unavailable. Hemisphere-aware.
function seasonFactor(court: Court, date: Date): number {
  if (court.indoor) return 1;
  let m = date.getMonth();
  if (court.lat < 0) m = (m + 6) % 12;
  return SEASON_NORTH[m];
}

// School courts are locked/in-use during class hours, then spike right after
// the bell. Weekends they're often gated. Jul/Aug approximates summer break.
function schoolFactor(court: Court, hour: number, date: Date): number {
  if (!court.school || court.indoor) return 1;
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return 0.75;
  const m = date.getMonth();
  const inSession = m !== 6 && m !== 7;
  if (inSession) {
    if (hour >= 7.5 && hour < 15) return 0.05;
    if (hour >= 15 && hour < 17.5) return 1.2;
  }
  return 1;
}

function accessFactor(court: Court): number {
  switch (court.access) {
    case "private": return 0.15;
    case "no": return 0.05;
    case "customers":
    case "members": return 0.4;
    default: return 1;
  }
}

export type Busyness = {
  low: number;
  mid: number;
  high: number;
  label: "empty" | "light" | "moderate" | "busy" | "packed";
  color: string;
  score: number; // 0..1, expected players / capacity
};

export function estimateBusyness(
  court: Court,
  now: Date = new Date(),
  weather?: HourlyWeather | null
): Busyness {
  const hour = now.getHours() + now.getMinutes() / 60;
  const h0 = Math.floor(hour) % 24;
  const h1 = (h0 + 1) % 24;
  const t = hour - Math.floor(hour);
  const dow = now.getDay();
  const curve = dow === 0 || dow === 6 ? WEEKEND_CURVE : WEEKDAY_CURVE;
  const hourWeight = curve[h0] * (1 - t) + curve[h1] * t;

  // Live weather when we have it; monthly seasonal proxy otherwise.
  const conditions = weather ? weatherFactor(court, weather) : seasonFactor(court, now);

  // Popularity: prominent facilities host runs; anonymous pitches rarely do.
  const popularity = 0.35 + (Math.min(prominence(court), 10) / 10) * 0.85;
  const jitter = 0.85 + hashStr(court.id) * 0.3; // deterministic per court

  const demand =
    hourWeight *
    DOW_FACTOR[dow] *
    daylightFactor(court, hour, now) *
    conditions *
    schoolFactor(court, hour, now) *
    accessFactor(court) *
    popularity *
    jitter *
    BASE_RATE;

  const hoops = court.hoops ?? 2;
  const capacity = Math.max(4, hoops * 4); // ~4 on-court+waiting per hoop = "packed"
  const expected = Math.min(capacity * 1.2, capacity * demand);

  // Pickup runs are threshold events — a sub-1 expectation means the modal
  // observation is an empty court, so report 0 rather than "~1 everywhere".
  const mid = expected < 0.75 ? 0 : Math.round(expected);
  const low = Math.max(0, Math.floor(expected * 0.5));
  const high =
    mid === 0
      ? demand > 0.05 ? 2 : 0 // an occasional lone shooter is still possible
      : Math.min(Math.round(capacity * 1.5), Math.ceil(expected * 1.6));

  const score = Math.min(1, expected / capacity);

  let label: Busyness["label"];
  let color: string;
  if (mid === 0) { label = "empty"; color = "#22c55e"; }
  else if (score < 0.3) { label = "light"; color = "#84cc16"; }
  else if (score < 0.55) { label = "moderate"; color = "#eab308"; }
  else if (score < 0.85) { label = "busy"; color = "#f97316"; }
  else { label = "packed"; color = "#ef4444"; }

  return { low, mid, high, label, color, score };
}

export function hourlyForecast(
  court: Court,
  now: Date = new Date(),
  weather?: Weather | null
): Busyness[] {
  const out: Busyness[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getTime() + i * 60 * 60 * 1000);
    out.push(estimateBusyness(court, d, weatherAt(weather, d)));
  }
  return out;
}
