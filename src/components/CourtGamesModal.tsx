"use client";

import { useCallback, useEffect, useState } from "react";
import type { Court } from "@/lib/courts";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { playerRating, balanceTeams, type TeamPlayer } from "@/lib/rating";
import {
  AGE_GROUP_OPTIONS,
  SKILL_REQ_OPTIONS,
  formatGameTime,
  type Game,
  type GameView,
  type TeamMember,
} from "@/lib/games";

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  skill_level: string | null;
  years_experience: number | null;
  wins: number | null;
  losses: number | null;
};

export default function CourtGamesModal({
  court,
  onClose,
}: {
  court: Court;
  onClose: () => void;
}) {
  const [games, setGames] = useState<GameView[]>([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    setMe(user?.id ?? null);
    setNeedsLogin(!user);

    const nowIso = new Date().toISOString();
    const { data: rows } = await supabase
      .from("games")
      .select("*")
      .eq("court_osm_id", court.id)
      .gte("start_time", nowIso)
      .order("start_time", { ascending: true });

    const list = (rows ?? []) as Game[];
    if (list.length === 0) {
      setGames([]);
      setLoading(false);
      return;
    }

    const ids = list.map((g) => g.id);
    const { data: signups } = await supabase
      .from("game_signups")
      .select("game_id, user_id")
      .in("game_id", ids);

    // Gather every referenced user (hosts, joiners, team members) and fetch their
    // rating-relevant profile fields in one query.
    const userIds = new Set<string>();
    list.forEach((g) => {
      userIds.add(g.host_id);
      g.teams?.A?.forEach((u) => userIds.add(u));
      g.teams?.B?.forEach((u) => userIds.add(u));
    });
    (signups ?? []).forEach((s) => userIds.add(s.user_id));

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, username, skill_level, years_experience, wins, losses")
      .in("id", [...userIds]);
    const profMap = new Map<string, ProfileRow>(
      (profiles ?? []).map((p) => [p.id, p as ProfileRow])
    );
    const nameOf = (id: string) => {
      const p = profMap.get(id);
      return p?.full_name || p?.username || "Hooper";
    };
    const memberOf = (id: string): TeamMember => {
      const p = profMap.get(id);
      return { id, name: nameOf(id), rating: p ? playerRating(p) : 35 };
    };

    const views: GameView[] = list.map((g) => {
      const joined = (signups ?? []).filter((s) => s.game_id === g.id);
      return {
        ...g,
        hostName: nameOf(g.host_id),
        players: joined.map((s) => nameOf(s.user_id)),
        joinedCount: joined.length,
        isFull: joined.length >= g.max_slots,
        youJoined: !!user && joined.some((s) => s.user_id === user.id),
        youHost: !!user && g.host_id === user.id,
        teamA: g.teams?.A ? g.teams.A.map(memberOf) : null,
        teamB: g.teams?.B ? g.teams.B.map(memberOf) : null,
      };
    });

    setGames(views);
    setLoading(false);
  }, [court.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function join(gameId: number) {
    if (!me) return;
    const supabase = createClient();
    await supabase.from("game_signups").insert({ game_id: gameId, user_id: me });
    load();
  }

  async function leave(gameId: number) {
    if (!me) return;
    const supabase = createClient();
    await supabase.from("game_signups").delete().eq("game_id", gameId).eq("user_id", me);
    load();
  }

  async function cancelGame(gameId: number) {
    const supabase = createClient();
    await supabase.from("games").delete().eq("id", gameId);
    load();
  }

  // Host generates balanced teams from the joined players' ratings.
  async function generateTeams(game: GameView) {
    const supabase = createClient();
    const { data: signups } = await supabase
      .from("game_signups")
      .select("user_id")
      .eq("game_id", game.id);
    const ids = (signups ?? []).map((s) => s.user_id);
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name, username, skill_level, years_experience, wins, losses")
      .in("id", ids);

    const players: TeamPlayer[] = (profs ?? []).map((p) => ({
      id: p.id,
      name: (p as ProfileRow).full_name || (p as ProfileRow).username || "Hooper",
      rating: playerRating(p as ProfileRow),
    }));
    const { A, B } = balanceTeams(players);
    const teams = { A: A.map((p) => p.id), B: B.map((p) => p.id) };
    await supabase.from("games").update({ teams, status: "teams_set" }).eq("id", game.id);
    load();
  }

  async function recordResult(gameId: number, winner: "A" | "B") {
    const supabase = createClient();
    const { error } = await supabase.rpc("finish_game", {
      p_game_id: gameId,
      p_winner: winner,
    });
    if (error) alert(error.message);
    load();
  }

  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-neutral-950 border border-neutral-800 w-full sm:max-w-md sm:rounded-xl rounded-t-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-neutral-950 border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-semibold">{court.name}</div>
            <div className="text-xs text-neutral-500">Pickup games</div>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200 text-xl leading-none">
            ×
          </button>
        </div>

        <div className="p-4 space-y-3">
          {needsLogin && (
            <p className="text-sm text-neutral-400">
              <a href="/login" className="text-court hover:underline">Log in</a> to host or join games.
            </p>
          )}

          {loading ? (
            <p className="text-sm text-neutral-500">Loading games…</p>
          ) : games.length ? (
            games.map((g) => (
              <GameRow
                key={g.id}
                game={g}
                canAct={!!me}
                onJoin={() => join(g.id)}
                onLeave={() => leave(g.id)}
                onCancel={() => cancelGame(g.id)}
                onGenerateTeams={() => generateTeams(g)}
                onRecord={(w) => recordResult(g.id, w)}
              />
            ))
          ) : (
            <p className="text-sm text-neutral-500">
              No games scheduled here yet. Be the first to host one! 🏀
            </p>
          )}

          {me && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="w-full py-2.5 rounded bg-court text-black font-semibold hover:opacity-90"
            >
              + Host a game
            </button>
          )}

          {me && showForm && (
            <HostForm
              court={court}
              hostId={me}
              onDone={() => {
                setShowForm(false);
                load();
              }}
              onCancel={() => setShowForm(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function TeamPanel({ label, members, won }: { label: string; members: TeamMember[]; won?: boolean }) {
  const total = members.reduce((s, m) => s + m.rating, 0);
  return (
    <div className={`flex-1 rounded-lg border p-2 ${won ? "border-court bg-court/10" : "border-neutral-800 bg-neutral-950"}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold">{label}{won ? " 🏆" : ""}</span>
        <span className="text-[10px] text-neutral-500">str {total}</span>
      </div>
      <ul className="space-y-0.5">
        {members.map((m) => (
          <li key={m.id} className="text-xs text-neutral-300 flex justify-between">
            <span className="truncate">{m.name}</span>
            <span className="text-neutral-600 ml-2">{m.rating}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GameRow({
  game,
  canAct,
  onJoin,
  onLeave,
  onCancel,
  onGenerateTeams,
  onRecord,
}: {
  game: GameView;
  canAct: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onCancel: () => void;
  onGenerateTeams: () => void;
  onRecord: (winner: "A" | "B") => void;
}) {
  const hasTeams = !!game.teamA && !!game.teamB;
  const finished = game.status === "finished";

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">🗓️ {formatGameTime(game.start_time)}</div>
        <div className="text-xs text-neutral-400">
          {game.joinedCount}/{game.max_slots} in
        </div>
      </div>
      <div className="mt-1 text-xs text-neutral-400 flex flex-wrap gap-x-2">
        <span>Host: {game.hostName}</span>
        {game.skill_req && game.skill_req !== "Any" && <span>· {game.skill_req}+</span>}
        {game.age_group && game.age_group !== "Any" && <span>· {game.age_group}</span>}
      </div>
      {!hasTeams && game.players.length > 0 && (
        <div className="mt-1 text-[11px] text-neutral-500 truncate">In: {game.players.join(", ")}</div>
      )}
      {game.notes && <div className="mt-1 text-xs text-neutral-300">“{game.notes}”</div>}

      {/* Teams */}
      {hasTeams && (
        <div className="mt-2 flex gap-2">
          <TeamPanel label="Team A" members={game.teamA!} won={finished && game.winner === "A"} />
          <TeamPanel label="Team B" members={game.teamB!} won={finished && game.winner === "B"} />
        </div>
      )}
      {finished && (
        <div className="mt-2 text-xs text-court font-semibold">
          Final: Team {game.winner} won 🏆
        </div>
      )}

      {/* Actions */}
      {canAct && !finished && (
        <div className="mt-2 flex flex-wrap gap-2">
          {game.youHost ? (
            <>
              {!hasTeams && (
                <button
                  onClick={onGenerateTeams}
                  disabled={game.joinedCount < 2}
                  className="text-xs px-3 py-1.5 rounded bg-court text-black font-semibold hover:opacity-90 disabled:opacity-40"
                >
                  Generate fair teams
                </button>
              )}
              {hasTeams && (
                <>
                  <button
                    onClick={() => onRecord("A")}
                    className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700"
                  >
                    Team A won
                  </button>
                  <button
                    onClick={() => onRecord("B")}
                    className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700"
                  >
                    Team B won
                  </button>
                </>
              )}
              <button
                onClick={onCancel}
                className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-red-300"
              >
                Cancel
              </button>
            </>
          ) : game.youJoined ? (
            <button
              onClick={onLeave}
              className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700"
            >
              Leave
            </button>
          ) : game.isFull ? (
            <span className="text-xs px-3 py-1.5 rounded bg-neutral-800 text-neutral-500">Full</span>
          ) : (
            <button
              onClick={onJoin}
              className="text-xs px-3 py-1.5 rounded bg-court text-black font-semibold hover:opacity-90"
            >
              Join game
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function HostForm({
  court,
  hostId,
  onDone,
  onCancel,
}: {
  court: Court;
  hostId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const defaultTime = (() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}`;
  })();

  const [startTime, setStartTime] = useState(defaultTime);
  const [skill, setSkill] = useState<string>("Any");
  const [age, setAge] = useState<string>("Any");
  const [slots, setSlots] = useState(10);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const supabase = createClient();

    const { data: game, error: gErr } = await supabase
      .from("games")
      .insert({
        host_id: hostId,
        court_osm_id: court.id,
        court_name: court.name,
        court_lat: court.lat,
        court_lon: court.lon,
        start_time: new Date(startTime).toISOString(),
        skill_req: skill,
        age_group: age,
        max_slots: slots,
        notes: notes.trim() || null,
      })
      .select()
      .single();

    if (gErr || !game) {
      setError(gErr?.message ?? "Could not create game");
      setSaving(false);
      return;
    }

    await supabase.from("game_signups").insert({ game_id: game.id, user_id: hostId });
    onDone();
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 space-y-3">
      <div className="font-medium text-sm">Host a game at {court.name}</div>

      <label className="block">
        <span className="text-xs text-neutral-400">Time of arrival</span>
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
          className="mt-1 w-full rounded bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-court"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-neutral-400">Skill level</span>
          <select
            value={skill}
            onChange={(e) => setSkill(e.target.value)}
            className="mt-1 w-full rounded bg-neutral-950 border border-neutral-800 px-2 py-2 text-sm outline-none focus:border-court"
          >
            {SKILL_REQ_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-neutral-400">Age group</span>
          <select
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="mt-1 w-full rounded bg-neutral-950 border border-neutral-800 px-2 py-2 text-sm outline-none focus:border-court"
          >
            {AGE_GROUP_OPTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-neutral-400">Slots (players, incl. you): {slots}</span>
        <input
          type="range"
          min={2}
          max={30}
          value={slots}
          onChange={(e) => setSlots(Number(e.target.value))}
          className="mt-1 w-full accent-orange-500"
        />
      </label>

      <label className="block">
        <span className="text-xs text-neutral-400">Notes (optional)</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. full court 5v5, bring a light + dark shirt"
          className="mt-1 w-full rounded bg-neutral-950 border border-neutral-800 px-3 py-2 text-sm outline-none focus:border-court"
        />
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2 rounded bg-court text-black font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create game"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 rounded bg-neutral-800 hover:bg-neutral-700 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
