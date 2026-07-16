// Daily quests: small goals that reset each day and pay out points on completion.
// Progress is derived from real activity (games joined, messages sent) — the
// claim_quest() DB function re-verifies before awarding, so points can't be faked.

export type QuestDef = {
  key: string;
  title: string;
  desc: string;
  reward: number;
  emoji: string;
};

export const DAILY_QUESTS: QuestDef[] = [
  { key: "join_game", title: "Run it back", desc: "Join a pickup game today", reward: 15, emoji: "🏀" },
  { key: "send_message", title: "Link up", desc: "Message any hooper today", reward: 10, emoji: "💬" },
  { key: "meet_new", title: "New connections", desc: "Message someone you never have", reward: 20, emoji: "🤝" },
];

/** UTC date string (YYYY-MM-DD) — matches the SQL function's day boundary. */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}
