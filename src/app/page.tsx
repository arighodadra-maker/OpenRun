"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCourts, haversineMeters, type Court } from "@/lib/courts";
import CourtCard from "@/components/CourtCard";
import AvailabilityGrid from "@/components/AvailabilityGrid";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type Loc = { lat: number; lon: number; label?: string };

const DEFAULT_LOC: Loc = { lat: 40.7128, lon: -74.006, label: "New York, NY" };

export default function Home() {
  const [loc, setLoc] = useState<Loc | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setLocError("Geolocation not supported — showing NYC");
      setLoc(DEFAULT_LOC);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => {
        setLocError(err.message + " — showing NYC. You can still search.");
        setLoc(DEFAULT_LOC);
      },
      { enableHighAccuracy: false, timeout: 8000 }
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
      .catch((e) => setLocError(String(e)))
      .finally(() => setLoading(false));
  }, [loc]);

  const selected = useMemo(
    () => courts.find((c) => c.id === selectedId) ?? null,
    [courts, selectedId]
  );

  return (
    <main className="min-h-screen flex flex-col">
      <header className="px-4 py-3 border-b border-neutral-900 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-court flex items-center justify-center text-black font-black">
            ▲
          </div>
          <div>
            <div className="font-bold tracking-tight">OpenRun</div>
            <div className="text-[11px] text-neutral-500 -mt-0.5">find a hoop near you</div>
          </div>
        </div>
        <button
          onClick={locate}
          className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700"
        >
          use my location
        </button>
      </header>

      {locError && (
        <div className="px-4 py-2 text-xs bg-yellow-900/40 text-yellow-200 border-b border-yellow-900">
          {locError}
        </div>
      )}

      <div className="flex-1 grid md:grid-cols-[380px_1fr] min-h-0">
        <aside className="border-r border-neutral-900 flex flex-col min-h-0">
          <div className="p-3 border-b border-neutral-900">
            <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
              Courts near you
            </div>
            <div className="text-sm text-neutral-300">
              {loading
                ? "Scanning OpenStreetMap…"
                : courts.length
                ? `${courts.length} within ~6 mi`
                : "No courts found in this radius."}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loc &&
              courts.map((c) => (
                <CourtCard
                  key={c.id}
                  court={c}
                  origin={loc}
                  selected={selectedId === c.id}
                  onClick={() => setSelectedId(c.id)}
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
              courts={courts}
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
    </main>
  );
}
