import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { skillBadgeClass } from "@/lib/skill";
import { rankMatches, type MatchInput } from "@/lib/matching";

export default async function MatchesPage() {
  if (!isSupabaseConfigured) redirect("/signup");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("profiles")
    .select("id, username, full_name, home_court, skill_level, availability");

  const all = (rows ?? []) as MatchInput[];
  const me = all.find((h) => h.id === user.id);
  const others = all.filter((h) => h.id !== user.id);
  const matches = me ? rankMatches(me, others) : [];

  const hasAvailability = !!me?.availability && me.availability.length > 0;

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
          ← Back to map
        </Link>
        <h1 className="text-xl font-semibold mt-4">Recommended hoopers</h1>
        <p className="text-xs text-neutral-500 mb-6">
          Players whose free time overlaps with yours — especially at your home court.
        </p>

        {!hasAvailability && (
          <div className="mb-6 rounded-lg border border-dashed border-neutral-800 p-4 text-sm text-neutral-400">
            Mark your free times on the{" "}
            <Link href="/" className="text-court hover:underline">home page calendar</Link>{" "}
            (while logged in) so we can match you by schedule.
          </div>
        )}

        {matches.length ? (
          <div className="space-y-2">
            {matches.map((m) => {
              const name = m.full_name || m.username || "Anonymous hooper";
              return (
                <div
                  key={m.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-950 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 shrink-0 rounded-full bg-court/20 text-court flex items-center justify-center font-bold">
                      {name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{name}</div>
                      <div className="text-xs text-neutral-500 truncate">
                        {m.reasons.join(" · ") || "New hooper"}
                      </div>
                    </div>
                    {m.skill_level && (
                      <span
                        className={`text-[11px] px-2 py-1 rounded-full border shrink-0 ${skillBadgeClass(
                          m.skill_level
                        )}`}
                      >
                        {m.skill_level}
                      </span>
                    )}
                  </div>

                  {m.topWindow && (
                    <div className="mt-2 text-xs text-neutral-400">
                      🗓️ You&apos;re both free <span className="text-neutral-200">{m.topWindow}</span>
                    </div>
                  )}

                  <div className="mt-3">
                    <Link
                      href={`/messages/${m.id}`}
                      className="inline-block text-xs px-3 py-1.5 rounded bg-court text-black font-semibold hover:opacity-90"
                    >
                      Message
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            No matches yet. As more hoopers set their availability and home court, they&apos;ll show
            up here. 🏀
          </p>
        )}
      </div>
    </main>
  );
}
