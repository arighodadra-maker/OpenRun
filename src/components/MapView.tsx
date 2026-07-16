"use client";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import type { Court } from "@/lib/courts";
import { estimateBusyness, hourlyForecast } from "@/lib/busyness";

function Recenter({ lat, lon, zoom }: { lat: number; lon: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], zoom ?? map.getZoom(), { animate: true });
  }, [lat, lon, zoom, map]);
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

  return (
    <MapContainer center={[center.lat, center.lon]} zoom={13} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter lat={center.lat} lon={center.lon} />

      <CircleMarker
        center={[center.lat, center.lon]}
        radius={7}
        pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 1 }}
      >
        <Popup>You are here</Popup>
      </CircleMarker>

      {courts.map((c) => {
        const b = estimateBusyness(c, now);
        const icon = makeIcon(b.color, String(b.mid));
        return (
          <Marker
            key={c.id}
            position={[c.lat, c.lon]}
            icon={icon}
            eventHandlers={{ click: () => onSelect?.(c) }}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-semibold text-base">{c.name}</div>
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
        );
      })}
    </MapContainer>
  );
}
