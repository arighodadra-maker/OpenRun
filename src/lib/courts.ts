// Basketball court discovery via the Overpass API (OpenStreetMap).
// We query for nodes/ways/relations tagged sport=basketball within a radius.

export type Court = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  hoops?: number;
  lit?: boolean;
  covered?: boolean;
  indoor?: boolean;
  surface?: string;
  access?: string;
  school?: boolean;
  osmUrl: string;
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// Court data changes rarely — cache per rounded location so revisits render
// instantly instead of waiting out a 5-20s Overpass round trip.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function cacheKey(lat: number, lon: number, radius: number): string {
  return `openrun:courts:${lat.toFixed(3)},${lon.toFixed(3)},${radius}`;
}

function readCache(key: string): Court[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { at, courts } = JSON.parse(raw);
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return courts;
  } catch {
    return null;
  }
}

function writeCache(key: string, courts: Court[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), courts }));
  } catch {
    // storage full/unavailable — not fatal
  }
}

export async function fetchCourts(
  lat: number,
  lon: number,
  radiusMeters = 8000
): Promise<Court[]> {
  const key = cacheKey(lat, lon, radiusMeters);
  const cached = readCache(key);
  if (cached) return cached;
  const q = `
    [out:json][timeout:20];
    (
      node["sport"="basketball"](around:${radiusMeters},${lat},${lon});
      way["sport"="basketball"](around:${radiusMeters},${lat},${lon});
      relation["sport"="basketball"](around:${radiusMeters},${lat},${lon});
      node["leisure"="pitch"]["sport"="basketball"](around:${radiusMeters},${lat},${lon});
      way["leisure"="pitch"]["sport"="basketball"](around:${radiusMeters},${lat},${lon});
    );
    out center tags;
  `.trim();

  let lastErr: unknown;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(q),
        // Public mirrors sometimes hang for minutes — fail fast and move on.
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) throw new Error("Overpass " + res.status);
      const data = await res.json();
      const courts = normalize(data.elements ?? []);
      writeCache(key, courts);
      return courts;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Overpass unavailable");
}

function normalize(elements: any[]): Court[] {
  const out: Court[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    out.push({
      id: `${el.type}/${el.id}`,
      name: tags.name || tags["name:en"] || defaultName(tags),
      lat,
      lon,
      hoops: parseInt(tags.hoops) || undefined,
      lit: tags.lit === "yes",
      covered: tags.covered === "yes",
      indoor: tags.indoor === "yes" || tags.sport_indoor === "yes",
      surface: tags.surface,
      access: tags.access,
      school:
        tags.amenity === "school" ||
        /\bschool\b/i.test(tags.name ?? "") ||
        /\bschool\b/i.test(tags.operator ?? ""),
      osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    });
  }
  // Deduplicate by rounded lat/lon (Overpass sometimes returns node+way for same court)
  const seen = new Set<string>();
  return out.filter((c) => {
    const k = `${c.lat.toFixed(4)},${c.lon.toFixed(4)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function defaultName(tags: Record<string, string>): string {
  if (tags.leisure === "pitch") return "Basketball court";
  if (tags.amenity === "school") return "School court";
  if (tags.amenity === "community_centre") return "Community court";
  return "Basketball court";
}

export function haversineMeters(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
