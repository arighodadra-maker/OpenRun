"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DAILY_QUESTS, utcToday } from "@/lib/quests";
import { CheckIcon } from "./icons";

type State = {
  done: Record<string, boolean>;
  claimed: Record<string, boolean>;
};

export default function QuestsCard() {
  const router = useRouter();
  const [me, setMe] = useState<string | null>(null);
  const [state, setState] = useState<State>({ done: {}, claimed: {} });
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMe(null);
      setLoading(false);
      return;
    }
    setMe(user.id);
    const today = utcToday();

    const [{ data: signups }, { data: msgs }, { data: claims }] = await Promise.all([
      supabase.from("game_signups").select("joined_at").eq("user_id", user.id),
      supabase.from("messages").select("recipient_id, created_at").eq("sender_id", user.id),
      supabase.from("quest_claims").select("quest_key").eq("user_id", user.id).eq("quest_date", today),
    ]);

    const joinedToday = (signups ?? []).some((s) => (s.joined_at ?? "").slice(0, 10) === today);
    const sentToday = (msgs ?? []).some((m) => (m.created_at ?? "").slice(0, 10) === today);
    const recipientsBefore = new Set(
      (msgs ?? []).filter((m) => (m.created_at ?? "").slice(0, 10) < today).map((m) => m.recipient_id)
    );
    const metNew = (msgs ?? []).some(
      (m) => (m.created_at ?? "").slice(0, 10) === today && !recipientsBefore.has(m.recipient_id)
    );

    setState({
      done: { join_game: joinedToday, send_message: sentToday, meet_new: metNew },
      claimed: Object.fromEntries((claims ?? []).map((c) => [c.quest_key, true])),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function claim(key: string) {
    setClaiming(key);
    const supabase = createClient();
    const { error } = await supabase.rpc("claim_quest", { p_quest_key: key });
    if (!error) {
      setState((s) => ({ ...s, claimed: { ...s.claimed, [key]: true } }));
      router.refresh(); // reflect new points in the nav/leaderboard
    }
    setClaiming(null);
  }

  if (!isSupabaseConfigured || (!loading && !me)) return null;

  const completed = DAILY_QUESTS.filter((q) => state.claimed[q.key]).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs uppercase tracking-wider text-neutral-500">Daily quests</div>
        <div className="text-[10px] text-neutral-500">{completed}/{DAILY_QUESTS.length} done</div>
      </div>
      <div className="space-y-1.5">
        {DAILY_QUESTS.map((q) => {
          const done = state.done[q.key];
          const claimed = state.claimed[q.key];
          return (
            <div
              key={q.key}
              className={`flex items-center gap-2.5 rounded-lg border p-2 ${
                claimed ? "border-neutral-800 bg-neutral-900/50 opacity-60" : "border-neutral-800 bg-neutral-900"
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center text-sm shrink-0">
                {q.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{q.title}</div>
                <div className="text-[11px] text-neutral-500 truncate">{q.desc}</div>
              </div>
              {claimed ? (
                <span className="flex items-center gap-1 text-[11px] text-neutral-500 shrink-0">
                  <CheckIcon size={13} /> +{q.reward}
                </span>
              ) : done ? (
                <button
                  onClick={() => claim(q.key)}
                  disabled={claiming === q.key}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-court text-black font-semibold hover:opacity-90 disabled:opacity-50 shrink-0"
                >
                  {claiming === q.key ? "…" : `Claim +${q.reward}`}
                </button>
              ) : (
                <span className="text-[11px] text-neutral-600 shrink-0">+{q.reward}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
