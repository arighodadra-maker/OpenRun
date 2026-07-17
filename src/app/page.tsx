"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCourts, haversineMeters, type Court } from "@/lib/courts";
import CourtCard from "@/components/CourtCard";
import AvailabilityGrid from "@/components/AvailabilityGrid";
import CourtGamesModal from "@/components/CourtGamesModal";
import QuestsCard from "@/components/QuestsCard";

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

  const selected = useMemo(
    () => courts.find((c) => c.id === selectedId) ?? null,
    [courts, selectedId]
  );

  // Courts are sorted nearest-first; only render a slice so we don't mount
  // hundreds of cards + map markers (the main cause of slow loads).
  const LIST_CAP = 60;
  const MAP_CAP = 150;
  const listCourts = useMemo(() => courts.slice(0, LIST_CAP), [courts]);
  const mapCourts = useMemo(() => courts.slice(0, MAP_CAP), [courts]);

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
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs uppercase tracking-wider text-neutral-500">
                Courts near you
              </div>
              <button
                onClick={locate}
                disabled={locating}
                className="text-xs px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:opacity-60"
              >
                {locating ? "📍 locating…" : "📍 my location"}
              </button>
            </div>
            <div className="text-sm text-neutral-300">
              {loading
                ? "Scanning OpenStreetMap…"
                : courts.length
                ? courts.length > LIST_CAP
                  ? `Nearest ${LIST_CAP} of ${courts.length} within ~6 mi`
                  : `${courts.length} within ~6 mi`
                : "No courts found in this radius."}
            </div>
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
