import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { skillBadgeClass } from "@/lib/skill";
import Avatar from "@/components/Avatar";

export default async function LeaderboardPage() {
  if (!isSupabaseConfigured) redirect("/signup");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows } = await supabase
    .from("profiles")
    .select("id, full_name, username, skill_level, points, wins, losses, avatar_emoji, accent_color")
    .order("points", { ascending: false })
    .order("wins", { ascending: false })
    .limit(100);

  const players = rows ?? [];

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
          ← Back to map
        </Link>
        <h1 className="text-xl font-semibold mt-4">Leaderboard 🏆</h1>
        <p className="text-xs text-neutral-500 mb-6">
          Earn 25 points for a win, 5 just for playing. Win games to climb.
        </p>

        <div className="space-y-2">
          {players.map((p, i) => {
            const name = p.full_name || p.username || "Hooper";
            const isYou = user && p.id === user.id;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  isYou ? "border-court bg-court/10" : "border-neutral-800 bg-neutral-950"
                }`}
              >
                <div className="w-6 text-center font-bold text-sm text-neutral-400">{medal}</div>
                <Avatar user={p} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {name} {isYou ? <span className="text-xs text-court">(you)</span> : null}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {p.wins ?? 0}W · {p.losses ?? 0}L
                  </div>
                </div>
                {p.skill_level && (
                  <span
                    className={`text-[11px] px-2 py-1 rounded-full border shrink-0 ${skillBadgeClass(
                      p.skill_level
                    )}`}
                  >
                    {p.skill_level}
                  </span>
                )}
                <div className="text-right shrink-0 w-14">
                  <div className="font-bold text-court">{p.points ?? 0}</div>
                  <div className="text-[10px] text-neutral-500">pts</div>
                </div>
              </div>
            );
          })}
          {players.length === 0 && (
            <p className="text-sm text-neutral-500">No players yet. 🏀</p>
          )}
        </div>
      </div>
    </main>
  );
}
