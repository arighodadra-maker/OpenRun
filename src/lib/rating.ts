// Deterministic player rating + fair team balancing.
// Rating blends self-ranked skill, years of experience, and win/loss record.
// (Age is used for game age-groups + display, not skill — age doesn't equal skill.)

const SKILL_BASE: Record<string, number> = {
  Beginner: 25,
  Intermediate: 45,
  Advanced: 65,
  Hooper: 85,
};

export type RatingInput = {
  skill_level: string | null;
  years_experience: number | null;
  wins: number | null;
  losses: number | null;
};

/** A single number (~1–120) capturing how strong a player is. Higher = stronger. */
export function playerRating(p: RatingInput): number {
  let r = SKILL_BASE[p.skill_level ?? ""] ?? 35;
  r += Math.min(p.years_experience ?? 0, 15) * 1.5; // experience, capped at 15 yrs
  r += ((p.wins ?? 0) - (p.losses ?? 0)) * 2; // proven record nudges it
  return Math.max(1, Math.round(r));
}

export type TeamPlayer = { id: string; name: string; rating: number };

/**
 * Split players into two teams of near-equal total rating.
 * Strongest-first, each player goes to whichever team is currently weaker —
 * simple, deterministic, and reliably balanced.
 */
export function balanceTeams(players: TeamPlayer[]): {
  A: TeamPlayer[];
  B: TeamPlayer[];
  ratingA: number;
  ratingB: number;
} {
  const sorted = [...players].sort((a, b) => b.rating - a.rating);
  const A: TeamPlayer[] = [];
  const B: TeamPlayer[] = [];
  let ratingA = 0;
  let ratingB = 0;

  for (const p of sorted) {
    if (ratingA <= ratingB) {
      A.push(p);
      ratingA += p.rating;
    } else {
      B.push(p);
      ratingB += p.rating;
    }
  }
  return { A, B, ratingA, ratingB };
}
