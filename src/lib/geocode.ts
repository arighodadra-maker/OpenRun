// Geocoding via OpenStreetMap's Nominatim.
//  - reverseGeocode: lat/lon -> street address (for court cards)
//  - forwardGeocode: "Brooklyn" / "123 Main St" -> lat/lon (for area search)
// Nominatim asks for <=1 request/sec and no bulk use, so reverse lookups run
// through a shared throttled queue and every result is cached in localStorage.

const ADDR_TTL = 30 * 24 * 60 * 60 * 1000; // addresses ~never change: cache a month

function addrKey(lat: number, lon: number) {
  return `openrun.addr.${lat.toFixed(4)},${lon.toFixed(4)}`;
}

function readAddr(lat: number, lon: number): string | null | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(addrKey(lat, lon));
    if (!raw) return undefined;
    const { t, a } = JSON.parse(raw);
    if (Date.now() - t > ADDR_TTL) return undefined;
    return a as string | null; // may be null = "looked up, no address"
  } catch {
    return undefined;
  }
}

function writeAddr(lat: number, lon: number, a: string | null) {
  try {
    localStorage.setItem(addrKey(lat, lon), JSON.stringify({ t: Date.now(), a }));
  } catch {
    /* ignore quota */
  }
}

// ---- throttled queue (1 request / 1.1s) ----
const queue: Array<() => Promise<void>> = [];
let pumping = false;

async function pump() {
  if (pumping) return;
  pumping = true;
  while (queue.length) {
    const job = queue.shift()!;
    await job();
    await new Promise((r) => setTimeout(r, 1100));
  }
  pumping = false;
}

function shortAddress(a: Record<string, string> | undefined): string | null {
  if (!a) return null;
  const road = a.road || a.pedestrian || a.footway || a.path || a.cycleway;
  const line1 = [a.house_number, road].filter(Boolean).join(" ");
  const area = a.neighbourhood || a.suburb || a.city || a.town || a.village || a.hamlet;
  const parts = [line1 || null, area || null].filter(Boolean);
  return parts.join(", ") || null;
}

export function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const cached = readAddr(lat, lon);
  if (cached !== undefined) return Promise.resolve(cached);

  // Avoid an unbounded backlog if someone scrolls a huge list fast.
  if (queue.length > 80) return Promise.resolve(null);

  return new Promise((resolve) => {
    queue.push(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const data = await res.json();
        const addr =
          shortAddress(data.address) ||
          (data.display_name ? data.display_name.split(",").slice(0, 2).join(",").trim() : null);
        writeAddr(lat, lon, addr);
        resolve(addr);
      } catch {
        resolve(null);
      }
    });
    pump();
  });
}

export async function forwardGeocode(
  query: string
): Promise<{ lat: number; lon: number; label: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
      query
    )}&limit=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const r = data[0];
    return { lat: parseFloat(r.lat), lon: parseFloat(r.lon), label: r.display_name };
  } catch {
    return null;
  }
}
