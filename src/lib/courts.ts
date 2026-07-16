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
  osmUrl: string;
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const CACHE_TTL_MS = 60 * 60 * 1000; // courts barely change — cache for an hour

function cacheKey(lat: number, lon: number, r: number) {
  // Round to ~100m so tiny GPS jitter still hits the cache.
  return `openrun.courts.${lat.toFixed(3)},${lon.toFixed(3)},${r}`;
}

function readCache(key: string): Court[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { t, data } = JSON.parse(raw);
    if (Date.now() - t > CACHE_TTL_MS) return null;
    return data as Court[];
  } catch {
    return null;
  }
}

function writeCache(key: string, data: Court[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify({ t: Date.now(), data }));
  } catch {
    /* quota / private mode — ignore */
  }
}

export async function fetchCourts(
  lat: number,
  lon: number,
  radiusMeters = 8000
): Promise<Court[]> {
  // Instant on repeat visits within the hour.
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
      // Abort a slow endpoint after 12s so we fail over instead of hanging.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(q),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
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
