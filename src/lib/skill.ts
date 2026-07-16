// Shared styling + ordering for skill levels, reused by the Hoopers directory
// (and available for skill-based matchmaking later).

export const SKILL_ORDER = ["Beginner", "Intermediate", "Advanced", "Hooper"] as const;
export type Skill = (typeof SKILL_ORDER)[number];

export const SKILL_BADGE: Record<string, string> = {
  Beginner: "bg-lime-500/15 text-lime-300 border-lime-500/30",
  Intermediate: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  Advanced: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  Hooper: "bg-red-500/15 text-red-300 border-red-500/30",
};

export function skillBadgeClass(skill: string | null): string {
  return SKILL_BADGE[skill ?? ""] ?? "bg-neutral-800 text-neutral-400 border-neutral-700";
}

/** Normalize a home-court name so "Rucker Park" and "rucker park " group together. */
export function normalizeCourt(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}
