"use client";

import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import type { Court } from "@/lib/courts";
import { estimateBusyness, hourlyForecast, prominence, minProminenceForZoom } from "@/lib/busyness";

function Recenter({ lat, lon, zoom }: { lat: number; lon: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lon], zoom ?? map.getZoom(), { animate: true });
  }, [lat, lon, zoom, map]);
  return null;
}

function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap();
  useEffect(() => {
    onZoom(map.getZoom());
  }, [map, onZoom]);
  useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
  });
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
  const [zoom, setZoom] = useState(13);
  const minProm = minProminenceForZoom(zoom);
  const visible = useMemo(
    () => courts.filter((c) => c.id === selectedId || prominence(c) >= minProm),
    [courts, minProm, selectedId]
  );

  return (
    <MapContainer
      center={[center.lat, center.lon]}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
      fadeAnimation={false}
      preferCanvas
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        keepBuffer={4}
      />
      <Recenter lat={center.lat} lon={center.lon} />
      <ZoomTracker onZoom={setZoom} />

      <CircleMarker
        center={[center.lat, center.lon]}
        radius={7}
        pathOptions={{ color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 1 }}
      >
        <Popup>You are here</Popup>
      </CircleMarker>

      {visible.map((c) => {
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
