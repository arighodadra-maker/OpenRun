"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCourts, haversineMeters, type Court } from "@/lib/courts";
import { forwardGeocode } from "@/lib/geocode";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import CourtCard from "@/components/CourtCard";
import AvailabilityGrid from "@/components/AvailabilityGrid";
import CourtGamesModal from "@/components/CourtGamesModal";
import QuestsCard from "@/components/QuestsCard";
import CourtFilters, {
  EMPTY_FILTERS,
  activeFilterCount,
  type CourtFilterState,
} from "@/components/CourtFilters";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type Loc = { lat: number; lon: number; label?: string };

const DEFAULT_LOC: Loc = { lat: 40.7128, lon: -74.006, label: "New York, NY" };

export default function Home() {
  const [loc, setLoc] = useState<Loc | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gamesCourt, setGamesCourt] = useState<Court | null>(null);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [areaLabel, setAreaLabel] = useState<string | null>(null);
  const [filters, setFilters] = useState<CourtFilterState>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  // court_osm_id -> upcoming games there (skill levels + count), for filtering
  const [gamesByCourt, setGamesByCourt] = useState<
    Record<string, { skills: string[]; count: number }>
  >({});

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError("Geolocation isn't supported here — showing NYC. You can still search.");
      setLoc((cur) => cur ?? DEFAULT_LOC);
      return;
    }
    setLocating(true);
    setLocError(null);

    const onOk = (pos: GeolocationPosition) => {
      setLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      setLocError(null);
      setLocating(false);
    };
    const onFail = (err: GeolocationPositionError) => {
      setLocating(false);
      const reason =
        err.code === err.PERMISSION_DENIED
          ? "Location is blocked — allow it in your browser's site settings"
          : err.code === err.POSITION_UNAVAILABLE
          ? "Couldn't determine your location"
          : "Location timed out";
      setLocError(`${reason} — showing NYC. Tap “📍 my location” to retry, or just search here.`);
      setLoc((cur) => cur ?? DEFAULT_LOC);
    };

    // 1) Fast attempt that will happily reuse a recent cached fix (often instant).
    navigator.geolocation.getCurrentPosition(
      onOk,
      () =>
        // 2) If that fails, retry once with high accuracy and a longer window
        //    before falling back to NYC.
        navigator.geolocation.getCurrentPosition(onOk, onFail, {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  useEffect(() => {
    if (!loc) return;
    setLoading(true);
    setCourts([]); // drop the previous area's courts so the map doesn't span both
    setSelectedId(null);
    fetchCourts(loc.lat, loc.lon, 10000)
      .then((cs) => {
        cs.sort(
          (a, b) =>
            haversineMeters(loc, { lat: a.lat, lon: a.lon }) -
            haversineMeters(loc, { lat: b.lat, lon: b.lon })
        );
        setCourts(cs);
      })
      .catch((e) => setLocError(e?.message ?? "Couldn't load courts. Tap “📍 my location” to retry."))
      .finally(() => setLoading(false));
  }, [loc]);

  // Load upcoming games once, grouped by court, to power the skill/has-games filters.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    supabase
      .from("games")
      .select("court_osm_id, skill_req, start_time")
      .gte("start_time", new Date().toISOString())
      .then(({ data }) => {
        const map: Record<string, { skills: Set<string>; count: number }> = {};
        (data ?? []).forEach((g) => {
          const e = (map[g.court_osm_id] ??= { skills: new Set(), count: 0 });
          e.count++;
          if (g.skill_req && g.skill_req !== "Any") e.skills.add(g.skill_req);
        });
        setGamesByCourt(
          Object.fromEntries(
            Object.entries(map).map(([k, v]) => [k, { skills: [...v.skills], count: v.count }])
          )
        );
      });
  }, []);

  const selected = useMemo(
    () => courts.find((c) => c.id === selectedId) ?? null,
    [courts, selectedId]
  );

  // Courts are sorted nearest-first; only render a slice so we don't mount
  // hundreds of cards + map markers (the main cause of slow loads).
  const LIST_CAP = 60;
  const MAP_CAP = 150;
  const filteredCourts = useMemo(() => {
    const q = query.trim().toLowerCase();
    let base = q
      ? courts.filter(
          (c) => c.name.toLowerCase().includes(q) || (c.address ?? "").toLowerCase().includes(q)
        )
      : courts;
    if (filters.skill) base = base.filter((c) => gamesByCourt[c.id]?.skills.includes(filters.skill!));
    if (filters.hasGames) base = base.filter((c) => (gamesByCourt[c.id]?.count ?? 0) > 0);
    if (filters.lit) base = base.filter((c) => c.lit);
    if (filters.indoor) base = base.filter((c) => c.indoor);
    return base;
  }, [courts, query, filters, gamesByCourt]);
  const listCourts = useMemo(() => filteredCourts.slice(0, LIST_CAP), [filteredCourts]);
  const mapCourts = useMemo(() => courts.slice(0, MAP_CAP), [courts]);

  // Enter in the search box jumps the map to a place / address.
  const searchArea = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const q = query.trim();
      if (!q) return;
      setSearching(true);
      const result = await forwardGeocode(q);
      setSearching(false);
      if (result) {
        setSelectedId(null);
        setQuery("");
        setLocError(null);
        setAreaLabel(result.label.split(",").slice(0, 3).join(",").trim());
        setLoc({ lat: result.lat, lon: result.lon, label: result.label });
      } else {
        setLocError(`Couldn't find “${q}”. Try a city, neighborhood, or address.`);
      }
    },
    [query]
  );

  const fitKey = loc ? `${loc.lat.toFixed(4)},${loc.lon.toFixed(4)}` : "";

  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex flex-col">
      {locError && (
        <div className="px-4 py-2 text-xs bg-yellow-900/40 text-yellow-200 border-b border-yellow-900">
          {locError}
        </div>
      )}

      <div className="flex-1 grid md:grid-cols-[380px_1fr] min-h-0">
        <aside className="border-r border-neutral-900 flex flex-col min-h-0">
          <div className="p-3 border-b border-neutral-900">
            <div className="flex items-center justify-between mb-1 gap-2">
              <div className="text-xs uppercase tracking-wider text-neutral-500">
                Courts near you
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {courts.length > 0 && (
                  <button
                    onClick={() => setShowFilters((s) => !s)}
                    className={`text-xs px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                      activeFilterCount(filters) > 0 || showFilters
                        ? "bg-court/20 text-court"
                        : "bg-neutral-800 hover:bg-neutral-700"
                    }`}
                  >
                    ⚙︎ Filters
                    {activeFilterCount(filters) > 0 && (
                      <span className="bg-court text-black rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                        {activeFilterCount(filters)}
                      </span>
                    )}
                  </button>
                )}
                <button
                  onClick={locate}
                  disabled={locating}
                  className="text-xs px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-60"
                >
                  {locating ? "📍…" : "📍"}
                </button>
              </div>
            </div>
            <div className="text-sm text-neutral-300">
              {loading
                ? "Scanning OpenStreetMap…"
                : query.trim()
                ? `${filteredCourts.length} match “${query.trim()}”`
                : activeFilterCount(filters) > 0
                ? `${filteredCourts.length} filtered · of ${courts.length} nearby`
                : courts.length
                ? courts.length > LIST_CAP
                  ? `Nearest ${LIST_CAP} of ${courts.length} within ~6 mi`
                  : `${courts.length} within ~6 mi`
                : "No courts found in this radius."}
            </div>
            {areaLabel && !query.trim() && (
              <div className="text-[11px] text-court mt-1 truncate">📍 {areaLabel}</div>
            )}
            <form onSubmit={searchArea} className="mt-2 relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search courts · ⏎ to find a place"
                className="w-full rounded-lg bg-neutral-900 border border-neutral-800 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-court"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">
                {searching ? "…" : "🔍"}
              </span>
            </form>
            {showFilters && courts.length > 0 && (
              <CourtFilters filters={filters} setFilters={setFilters} />
            )}
          </div>
          <div className="p-3 border-b border-neutral-900">
            <QuestsCard />
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loc &&
              listCourts.map((c) => (
                <CourtCard
                  key={c.id}
                  court={c}
                  origin={loc}
                  selected={selectedId === c.id}
                  onClick={() => setSelectedId(c.id)}
                  onOpenGames={() => setGamesCourt(c)}
                />
              ))}
            {loc && query.trim() && listCourts.length === 0 && (
              <p className="text-xs text-neutral-500 p-2">
                No courts here match “{query.trim()}”. Press ⏎ to search that as a place instead.
              </p>
            )}
          </div>
          <div className="border-t border-neutral-900 p-3">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
              Your availability
            </div>
            <AvailabilityGrid />
          </div>
        </aside>

        <section className="min-h-[400px] md:min-h-0">
          {loc ? (
            <MapView
              center={selected ? { lat: selected.lat, lon: selected.lon } : loc}
              courts={mapCourts}
              fitKey={fitKey}
              selectedId={selectedId}
              onSelect={(c) => setSelectedId(c.id)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-neutral-500 text-sm">
              Getting your location…
            </div>
          )}
        </section>
      </div>

      <footer className="text-[11px] text-neutral-600 px-4 py-2 border-t border-neutral-900">
        Court data © OpenStreetMap contributors · Busyness values are heuristic estimates, not
        real-time occupancy.
      </footer>

      {gamesCourt && (
        <CourtGamesModal court={gamesCourt} onClose={() => setGamesCourt(null)} />
      )}
    </main>
  );
}
