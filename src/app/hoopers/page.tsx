import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { normalizeCourt } from "@/lib/skill";
import HooperCard, { type Hooper } from "@/components/HooperCard";

export default async function HoopersPage() {
  if (!isSupabaseConfigured) redirect("/signup");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rows }, { data: follows }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, username, full_name, home_court, skill_level, avatar_emoji, accent_color, bio, fav_position"
      )
      .order("updated_at", { ascending: false }),
    supabase.from("follows").select("following_id").eq("follower_id", user.id),
  ]);

  const followingSet = new Set((follows ?? []).map((f) => f.following_id));
  const hoopers = (rows ?? []) as Hooper[];
  const me = hoopers.find((h) => h.id === user.id);
  const myCourt = normalizeCourt(me?.home_court);
  const others = hoopers.filter((h) => h.id !== user.id);

  const following = others.filter((h) => followingSet.has(h.id));
  const atMyCourt = myCourt
    ? others.filter((h) => normalizeCourt(h.home_court) === myCourt && !followingSet.has(h.id))
    : [];
  const elsewhere = others.filter(
    (h) => !followingSet.has(h.id) && !atMyCourt.includes(h)
  );

  const card = (h: Hooper) => (
    <HooperCard key={h.id} hooper={h} meId={user.id} isFollowing={followingSet.has(h.id)} />
  );

  return (
    <main className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-lg">
        <h1 className="text-xl font-semibold">Players</h1>
        <p className="text-xs text-neutral-500 mb-6">
          Find hoopers, add them, and message them to set up a run.
        </p>

        {following.length > 0 && (
          <Section title="Following">{following.map(card)}</Section>
        )}

        {me?.home_court ? (
          <Section title={`At your home court · ${me.home_court}`}>
            {atMyCourt.length ? (
              atMyCourt.map(card)
            ) : (
              <p className="text-sm text-neutral-500 rounded-lg border border-dashed border-neutral-800 p-4">
                No one else has claimed {me.home_court} yet. Invite a friend to sign up!
              </p>
            )}
          </Section>
        ) : (
          <div className="mb-8 rounded-lg border border-dashed border-neutral-800 p-4">
            <p className="text-sm text-neutral-400">
              You haven&apos;t set a home court yet.{" "}
              <Link href="/profile" className="text-court hover:underline">Add one</Link> to see
              hoopers who play there.
            </p>
          </div>
        )}

        <Section title={atMyCourt.length || following.length ? "More players" : "All players"}>
          {elsewhere.length ? (
            elsewhere.map(card)
          ) : (
            <p className="text-sm text-neutral-500">
              No other hoopers have signed up yet — you&apos;re early. 🏀
            </p>
          )}
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
