"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { playerRating } from "@/lib/rating";
import { Field } from "@/components/AuthUI";

type ProfileData = {
  username: string;
  full_name: string;
  home_court: string;
  skill_level: string;
  age: string;
  years_experience: string;
};

type Stats = { points: number; wins: number; losses: number };

const SKILL_LEVELS = ["", "Beginner", "Intermediate", "Advanced", "Hooper"];

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
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat label="Points" value={stats.points} accent />
        <Stat label="Rating" value={rating} />
        <Stat label="Wins" value={stats.wins} />
        <Stat label="Losses" value={stats.losses} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Display name" value={data.full_name}
          onChange={(v) => set("full_name", v)} type="text" placeholder="e.g. Alex" />
        <Field label="Username" value={data.username}
          onChange={(v) => set("username", v)} type="text" placeholder="e.g. alex_hoops" />
        <Field label="Home court" value={data.home_court}
          onChange={(v) => set("home_court", v)} type="text" placeholder="e.g. West 4th St Courts" />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Age" value={data.age}
            onChange={(v) => set("age", v)} type="number" placeholder="e.g. 17" />
          <Field label="Years playing" value={data.years_experience}
            onChange={(v) => set("years_experience", v)} type="number" placeholder="e.g. 5" />
        </div>

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

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={status === "saving"}
          className="w-full py-2.5 rounded bg-court text-black font-semibold hover:opacity-90 disabled:opacity-50"
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
