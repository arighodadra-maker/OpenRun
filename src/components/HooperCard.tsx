import { skillBadgeClass } from "@/lib/skill";

export type Hooper = {
  id: string;
  username: string | null;
  full_name: string | null;
  home_court: string | null;
  skill_level: string | null;
};

function initials(h: Hooper): string {
  const base = h.full_name || h.username || "?";
  return base.trim().slice(0, 1).toUpperCase();
}

/** A single hooper row: avatar, name, home court, skill badge. */
export default function HooperCard({ hooper, isYou }: { hooper: Hooper; isYou?: boolean }) {
  const displayName = hooper.full_name || hooper.username || "Anonymous hooper";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-3">
      <div className="w-9 h-9 shrink-0 rounded-full bg-court/20 text-court flex items-center justify-center font-bold">
        {initials(hooper)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{displayName}</span>
          {isYou && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
              you
            </span>
          )}
        </div>
        <div className="text-xs text-neutral-500 truncate">
          {hooper.username ? `@${hooper.username}` : "no username yet"}
          {hooper.home_court ? ` · 🏀 ${hooper.home_court}` : ""}
        </div>
      </div>
      {hooper.skill_level && (
        <span
          className={`text-[11px] px-2 py-1 rounded-full border shrink-0 ${skillBadgeClass(
            hooper.skill_level
          )}`}
        >
          {hooper.skill_level}
        </span>
      )}
    </div>
  );
}
