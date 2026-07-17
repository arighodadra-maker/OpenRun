"use client";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import type { Court } from "@/lib/courts";
import { estimateBusyness } from "@/lib/busyness";

function Recenter({ lat, lon, zoom }: { lat: number; lon: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], zoom ?? map.getZoom(), { animate: true });
  }, [lat, lon, zoom, map]);
  return null;
}

// Once courts load, zoom/pan so you AND the nearest courts are all in view —
// otherwise nearby-but-spread-out courts can sit just off the initial screen.
function FitToCourts({
  center,
  courts,
}: {
  center: { lat: number; lon: number };
  courts: Court[];
}) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || courts.length === 0) return;
    const points: [number, number][] = [
      [center.lat, center.lon],
      ...courts.slice(0, 12).map((c) => [c.lat, c.lon] as [number, number]),
    ];
    map.fitBounds(points, { padding: [50, 50], maxZoom: 15 });
    fitted.current = true;
  }, [courts, center, map]);
  return null;
}

// Leaflet renders blank if the container's size wasn't known at mount (common
// inside flex/grid layouts). Recompute size once mounted and on resize.
function FixSize() {
  const map = useMap();
  useEffect(() => {
    const fix = () => map.invalidateSize();
    const t = setTimeout(fix, 0);
    window.addEventListener("resize", fix);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", fix);
    };
  }, [map]);
  return null;
}

function makeIcon(color: string, label: string) {
  return L.divIcon({
    className: "",
    html: `<div class="court-marker" style="background:${color}">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function MapView({
  center,
  courts,
  selectedId,
  onSelect,
}: {
  center: { lat: number; lon: number };
  courts: Court[];
  selectedId?: string | null;
  onSelect?: (c: Court) => void;
}) {
  const now = useMemo(() => new Date(), []);

  // Precompute markers so panning/selecting doesn't re-run busyness for each court.
  const markers = useMemo(
    () =>
      courts.map((c) => {
        const b = estimateBusyness(c, now);
        return { c, b, icon: makeIcon(b.color, String(b.mid)) };
      }),
    [courts, now]
  );

  return (
    <MapContainer
      center={[center.lat, center.lon]}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
      preferCanvas
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        keepBuffer={6}
        updateWhenZooming={false}
      />
      <FixSize />
      <Recenter lat={center.lat} lon={center.lon} />
      <FitToCourts center={center} courts={courts} />

      <CircleMarker
        center={[center.lat, center.lon]}
        radius={7}
        pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 1 }}
      >
        <Popup>You are here</Popup>
      </CircleMarker>

      {markers.map(({ c, b, icon }) => (
        <Marker
          key={c.id}
          position={[c.lat, c.lon]}
          icon={icon}
          eventHandlers={{ click: () => onSelect?.(c) }}
        >
          <Popup>
            <div className="text-sm">
              <div className="font-semibold text-base">{c.name}</div>
              {c.address && <div className="text-neutral-400 text-xs">{c.address}</div>}
              <div className="mt-1" style={{ color: b.color }}>
                {b.label.toUpperCase()} · ~{b.low}–{b.high} players
              </div>
              <div className="mt-1 text-neutral-400">
                {c.hoops ? `${c.hoops} hoops` : "hoops unknown"}
                {c.lit ? " · lit" : ""}
                {c.covered ? " · covered" : ""}
                {c.indoor ? " · indoor" : ""}
                {c.surface ? ` · ${c.surface}` : ""}
              </div>
              <a
                href={c.osmUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 underline text-xs"
              >
                view on OSM
              </a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
