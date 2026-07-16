// Recommendation pairing: rank other hoopers by how well they match you —
// overlapping free hours (from the availability calendar) + same home court.
// Skill is carried through for display; skill-based matchmaking can layer on later.

import { decodeSlots, emptySlots, DAY_LABELS, type Slots } from "./availability";
import { normalizeCourt } from "./skill";

export type MatchInput = {
  id: string;
  full_name: string | null;
  username: string | null;
  home_court: string | null;
  skill_level: string | null;
  availability: string | null;
};

export type Match = MatchInput & {
  overlapHours: number;
  sameCourt: boolean;
  topWindow: string | null; // human label for the best shared window
  score: number;
  reasons: string[];
};

/** Count hours where both people are free, and find the single best shared block. */
function overlap(a: string | null, b: string | null): { count: number; best: string | null } {
  const ga: Slots = a ? decodeSlots(a) : emptySlots();
  const gb: Slots = b ? decodeSlots(b) : emptySlots();

  let count = 0;
  let bestDay = -1;
  let bestStart = -1;
  let bestLen = 0;

  for (let d = 0; d < 7; d++) {
    let runStart = -1;
    for (let h = 0; h <= 24; h++) {
      const both = h < 24 && ga[d][h] && gb[d][h];
      if (both) {
        count++;
        if (runStart === -1) runStart = h;
      } else if (runStart !== -1) {
        const len = h - runStart;
        if (len > bestLen) {
          bestLen = len;
          bestDay = d;
          bestStart = runStart;
        }
        runStart = -1;
      }
    }
  }

  if (bestDay === -1) return { count, best: null };
  const end = bestStart + bestLen;
  const fmt = (h: number) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;
  return { count, best: `${DAY_LABELS[bestDay]} ${fmt(bestStart)}–${fmt(end)}` };
}

export function rankMatches(me: MatchInput, others: MatchInput[]): Match[] {
  const myCourt = normalizeCourt(me.home_court);

  return others
    .map((o): Match => {
      const { count, best } = overlap(me.availability, o.availability);
      const sameCourt = !!myCourt && normalizeCourt(o.home_court) === myCourt;

      const reasons: string[] = [];
      if (count > 0) {
        reasons.push(`${count} overlapping free hour${count === 1 ? "" : "s"}`);
      }
      if (sameCourt) reasons.push(`Plays at ${o.home_court}`);

      // Same court is a strong signal (~5 hrs worth); overlapping hours add up.
      const score = count + (sameCourt ? 5 : 0);

      return { ...o, overlapHours: count, sameCourt, topWindow: best, score, reasons };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);
}
