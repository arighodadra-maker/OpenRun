// Pickup game types + option lists, shared by the host form and game list.

export const SKILL_REQ_OPTIONS = [
  "Any",
  "Beginner",
  "Intermediate",
  "Advanced",
  "Hooper",
] as const;

export const AGE_GROUP_OPTIONS = [
  "Any",
  "Under 18",
  "18+",
  "21+",
  "30+",
] as const;

export type Game = {
  id: number;
  host_id: string;
  court_osm_id: string;
  court_name: string;
  court_lat: number | null;
  court_lon: number | null;
  start_time: string;
  skill_req: string | null;
  age_group: string | null;
  max_slots: number;
  notes: string | null;
  created_at: string;
  status: string; // 'open' | 'teams_set' | 'finished'
  teams: { A: string[]; B: string[] } | null;
  winner: string | null; // 'A' | 'B'
};

export type TeamMember = { id: string; name: string; rating: number };

export type GameView = Game & {
  hostName: string;
  players: string[]; // display names of everyone joined
  joinedCount: number;
  isFull: boolean;
  youJoined: boolean;
  youHost: boolean;
  teamA: TeamMember[] | null; // resolved rosters when teams are set
  teamB: TeamMember[] | null;
};

/** "Sat, Jul 19 · 5:30 PM" */
export function formatGameTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
