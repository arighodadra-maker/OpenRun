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
  address?: string;
  osmUrl: string;
};

// Multiple mirrors, raced in parallel — individual Overpass servers are often
// rate-limited or down, so relying on one or two leaves users with no courts.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];

// Thrown when a mirror responds successfully but with zero courts — so a mirror
// that DOES have data wins the race instead of a spurious empty response.
class EmptyResult extends Error {}

const CACHE_TTL_MS = 60 * 60 * 1000; // courts barely change — cache for an hour

function cacheKey(lat: number, lon: number, r: number) {
  // Round to ~100m so tiny GPS jitter still hits the cache.
  // v3 = never cache empty results anymore; bump clears any poisoned empties.
  return `openrun.courts.v3.${lat.toFixed(3)},${lon.toFixed(3)},${r}`;
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
  const body = "data=" + encodeURIComponent(q);

  // Query one endpoint, giving up after 18s (long enough for a big first query).
  // An empty response is treated as a failure so a mirror WITH courts wins.
  async function hit(url: string): Promise<Court[]> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 18000);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error("Overpass " + res.status);
      const data = await res.json();
      const courts = normalize(data.elements ?? []);
      if (courts.length === 0) throw new EmptyResult();
      return courts;
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    // Race all mirrors — first one with actual courts wins, so a slow or
    // rate-limited server doesn't hold everything up.
    const courts = await Promise.any(OVERPASS_ENDPOINTS.map(hit));
    writeCache(key, courts); // only ever caches non-empty results
    return courts;
  } catch (agg) {
    const errors: unknown[] = (agg as AggregateError)?.errors ?? [];
    // If every mirror answered but with zero courts, this area genuinely has
    // none — return empty (don't cache, so it retries later). Otherwise the
    // service failed, so surface a friendly retry message.
    const allEmpty = errors.length > 0 && errors.every((e) => e instanceof EmptyResult);
    if (allEmpty) return [];
    throw new Error("Court search is slow right now. Tap “📍 my location” to try again.");
  }
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
      address: buildAddress(tags),
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

/** Best available human-readable location from OSM tags (street/city or operator). */
function buildAddress(tags: Record<string, string>): string | undefined {
  const line1 = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const parts = [line1, tags["addr:city"] || tags["addr:suburb"]].filter(Boolean);
  const addr = parts.join(", ");
  return addr || tags.operator || undefined;
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
