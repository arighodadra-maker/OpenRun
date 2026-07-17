"use client";

import type { Court } from "@/lib/courts";
import { estimateBusyness, hourlyForecast } from "@/lib/busyness";
import { haversineMeters } from "@/lib/courts";

export default function CourtCard({
  court,
  origin,
  onClick,
  onOpenGames,
  selected,
}: {
  court: Court;
  origin: { lat: number; lon: number };
  onClick?: () => void;
  onOpenGames?: () => void;
  selected?: boolean;
}) {
  const b = estimateBusyness(court);
  const forecast = hourlyForecast(court);
  const distMi = haversineMeters(origin, { lat: court.lat, lon: court.lon }) / 1609.34;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.();
      }}
      className={`w-full text-left p-3 rounded-lg border transition cursor-pointer ${
        selected
          ? "border-orange-500 bg-neutral-900"
          : "border-neutral-800 bg-neutral-950 hover:bg-neutral-900"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold truncate">{court.name}</div>
          <div className="text-[10px] text-neutral-500 truncate">
            {court.address ?? `${court.lat.toFixed(4)}, ${court.lon.toFixed(4)}`}
          </div>
          <div className="text-xs text-neutral-400 mt-0.5">
            {distMi.toFixed(1)} mi
            {court.hoops ? ` · ${court.hoops} hoops` : ""}
            {court.lit ? " · lit" : ""}
            {court.indoor ? " · indoor" : court.covered ? " · covered" : ""}
          </div>
        </div>
        <div
          className="px-2 py-1 rounded text-xs font-bold whitespace-nowrap"
          style={{ background: b.color, color: "#0a0a0a" }}
        >
          {b.label} · ~{b.mid}
        </div>
      </div>

      <div className="mt-2 flex items-end gap-[2px] h-8">
        {forecast.map((f, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{
              height: `${Math.max(6, f.score * 100)}%`,
              background: f.color,
              opacity: i === 0 ? 1 : 0.7,
            }}
            title={`+${i}h · ${f.label} (~${f.mid})`}
          />
        ))}
      </div>
      <div className="mt-1 text-[10px] text-neutral-500 flex justify-between">
        <span>now</span>
        <span>+12h</span>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenGames?.();
        }}
        className="mt-2 w-full text-xs py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 font-medium"
      >
        🏀 Host / join a game
      </button>
    </div>
  );
}
