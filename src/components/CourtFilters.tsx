"use client";

import { SKILL_ORDER } from "@/lib/skill";

export type CourtFilterState = {
  skill: string | null; // skill of the games/lobbies at a court
  lit: boolean;
  indoor: boolean;
  hasGames: boolean;
};

export const EMPTY_FILTERS: CourtFilterState = {
  skill: null,
  lit: false,
  indoor: false,
  hasGames: false,
};

export function activeFilterCount(f: CourtFilterState): number {
  return (f.skill ? 1 : 0) + (f.lit ? 1 : 0) + (f.indoor ? 1 : 0) + (f.hasGames ? 1 : 0);
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs border transition ${
        active
          ? "bg-court text-black border-court font-semibold"
          : "border-neutral-700 text-neutral-300 hover:bg-neutral-800"
      }`}
    >
      {label}
    </button>
  );
}

export default function CourtFilters({
  filters,
  setFilters,
}: {
  filters: CourtFilterState;
  setFilters: (updater: (f: CourtFilterState) => CourtFilterState) => void;
}) {
  const count = activeFilterCount(filters);

  return (
    <div className="mt-2 rounded-lg border border-neutral-800 bg-neutral-900 p-3 space-y-3">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">
          Lobby skill level
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip
            active={filters.skill === null}
            label="All"
            onClick={() => setFilters((f) => ({ ...f, skill: null }))}
          />
          {SKILL_ORDER.map((s) => (
            <Chip
              key={s}
              active={filters.skill === s}
              label={s}
              onClick={() => setFilters((f) => ({ ...f, skill: f.skill === s ? null : s }))}
            />
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">Court</div>
        <div className="flex flex-wrap gap-1.5">
          <Chip
            active={filters.hasGames}
            label="🏀 Has games"
            onClick={() => setFilters((f) => ({ ...f, hasGames: !f.hasGames }))}
          />
          <Chip
            active={filters.lit}
            label="⚡ Lit"
            onClick={() => setFilters((f) => ({ ...f, lit: !f.lit }))}
          />
          <Chip
            active={filters.indoor}
            label="🏠 Indoor"
            onClick={() => setFilters((f) => ({ ...f, indoor: !f.indoor }))}
          />
        </div>
      </div>

      {count > 0 && (
        <button
          onClick={() => setFilters(() => EMPTY_FILTERS)}
          className="text-[11px] text-neutral-400 hover:text-neutral-200 underline"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
