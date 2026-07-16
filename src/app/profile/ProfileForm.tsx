"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { playerRating } from "@/lib/rating";
import { Field } from "@/components/AuthUI";
import Avatar from "@/components/Avatar";

type ProfileData = {
  username: string;
  full_name: string;
  home_court: string;
  skill_level: string;
  age: string;
  years_experience: string;
  avatar_emoji: string;
  accent_color: string;
  bio: string;
  fav_position: string;
};

type Stats = { points: number; wins: number; losses: number };

const SKILL_LEVELS = ["", "Beginner", "Intermediate", "Advanced", "Hooper"];
const POSITIONS = ["", "Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center"];
const EMOJIS = ["🏀", "🔥", "⚡", "🐐", "💪", "🎯", "👟", "🏆", "😎", "🚀", "🦅", "👑"];
const COLORS = ["#f97316", "#ef4444", "#22c55e", "#3b82f6", "#a855f7", "#eab308", "#ec4899", "#14b8a6"];

export default function ProfileForm({
  initial,
  stats,
}: {
  initial: ProfileData;
  stats: Stats;
}) {
  const router = useRouter();
  const [data, setData] = useState<ProfileData>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ProfileData>(key: K, value: string) {
    setData((d) => ({ ...d, [key]: value }));
    setStatus("idle");
  }

  const rating = playerRating({
    skill_level: data.skill_level || null,
    years_experience: data.years_experience ? Number(data.years_experience) : null,
    wins: stats.wins,
    losses: stats.losses,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("saving");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      username: data.username || null,
      full_name: data.full_name || null,
      home_court: data.home_court || null,
      skill_level: data.skill_level || null,
      age: data.age ? Number(data.age) : null,
      years_experience: data.years_experience ? Number(data.years_experience) : null,
      avatar_emoji: data.avatar_emoji || null,
      accent_color: data.accent_color || null,
      bio: data.bio || null,
      fav_position: data.fav_position || null,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setError(error.message);
      setStatus("idle");
      return;
    }
    setStatus("saved");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Live avatar preview + identity */}
      <div className="flex items-center gap-4 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
        <Avatar
          user={{
            full_name: data.full_name,
            username: data.username,
            avatar_emoji: data.avatar_emoji,
            accent_color: data.accent_color,
          }}
          size={64}
          ring
        />
        <div className="min-w-0">
          <div className="font-semibold truncate">{data.full_name || "Your name"}</div>
          <div className="text-xs text-neutral-500 truncate">
            {data.username ? `@${data.username}` : "set a username"}
            {data.fav_position ? ` · ${data.fav_position}` : ""}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat label="Points" value={stats.points} accent />
        <Stat label="Rating" value={rating} />
        <Stat label="Wins" value={stats.wins} />
        <Stat label="Losses" value={stats.losses} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Avatar picker */}
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 space-y-3">
          <div className="text-xs uppercase tracking-wider text-neutral-500">Personalize</div>
          <div>
            <div className="text-xs text-neutral-400 mb-1.5">Avatar</div>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((e) => (
                <button
                  type="button"
                  key={e}
                  onClick={() => set("avatar_emoji", data.avatar_emoji === e ? "" : e)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition ${
                    data.avatar_emoji === e
                      ? "bg-court/20 ring-2 ring-court"
                      : "bg-neutral-900 hover:bg-neutral-800"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-neutral-400 mb-1.5">Color</div>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => set("accent_color", c)}
                  aria-label={`color ${c}`}
                  className={`w-7 h-7 rounded-full transition ${
                    data.accent_color === c ? "ring-2 ring-offset-2 ring-offset-neutral-950 ring-white" : ""
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <Field label="Display name" value={data.full_name}
          onChange={(v) => set("full_name", v)} type="text" placeholder="e.g. Alex" />
        <Field label="Username" value={data.username}
          onChange={(v) => set("username", v)} type="text" placeholder="e.g. alex_hoops" />

        <label className="block">
          <span className="text-xs text-neutral-400">Bio</span>
          <textarea
            value={data.bio}
            onChange={(e) => set("bio", e.target.value)}
            maxLength={160}
            rows={2}
            placeholder="Streaky shooter, lockdown defender, always down to run…"
            className="mt-1 w-full rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-court resize-none"
          />
        </label>

        <Field label="Home court" value={data.home_court}
          onChange={(v) => set("home_court", v)} type="text" placeholder="e.g. West 4th St Courts" />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Age" value={data.age}
            onChange={(v) => set("age", v)} type="number" placeholder="e.g. 17" />
          <Field label="Years playing" value={data.years_experience}
            onChange={(v) => set("years_experience", v)} type="number" placeholder="e.g. 5" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-neutral-400">Skill level</span>
            <select
              value={data.skill_level}
              onChange={(e) => set("skill_level", e.target.value)}
              className="mt-1 w-full rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-court"
            >
              {SKILL_LEVELS.map((s) => (
                <option key={s} value={s}>{s || "— select —"}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-neutral-400">Position</span>
            <select
              value={data.fav_position}
              onChange={(e) => set("fav_position", e.target.value)}
              className="mt-1 w-full rounded bg-neutral-900 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-court"
            >
              {POSITIONS.map((s) => (
                <option key={s} value={s}>{s || "— select —"}</option>
              ))}
            </select>
          </label>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={status === "saving"}
          className="w-full py-2.5 rounded-lg bg-court text-black font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : "Save profile"}
        </button>
      </form>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 py-2">
      <div className={`text-lg font-bold ${accent ? "text-court" : "text-neutral-100"}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
    </div>
  );
}
