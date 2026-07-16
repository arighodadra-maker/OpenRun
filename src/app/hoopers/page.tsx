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

  const { data: rows } = await supabase
    .from("profiles")
    .select("id, username, full_name, home_court, skill_level")
    .order("updated_at", { ascending: false });

  const hoopers = (rows ?? []) as Hooper[];
  const me = hoopers.find((h) => h.id === user.id);
  const myCourt = normalizeCourt(me?.home_court);
  const others = hoopers.filter((h) => h.id !== user.id);

  const atMyCourt = myCourt
    ? others.filter((h) => normalizeCourt(h.home_court) === myCourt)
    : [];
  const elsewhere = others.filter((h) => !atMyCourt.includes(h));

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
          ← Back to map
        </Link>
        <h1 className="text-xl font-semibold mt-4">Hoopers</h1>
        <p className="text-xs text-neutral-500 mb-6">
          Other players on OpenRun. Set your home court on your{" "}
          <Link href="/profile" className="text-court hover:underline">profile</Link> to find
          people who ball where you do.
        </p>

        {/* Hoopers at your home court */}
        {me?.home_court ? (
          <section className="mb-8">
            <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
              At your home court · {me.home_court}
            </h2>
            {atMyCourt.length ? (
              <div className="space-y-2">
                {atMyCourt.map((h) => (
                  <HooperCard key={h.id} hooper={h} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 rounded-lg border border-dashed border-neutral-800 p-4">
                No one else has claimed {me.home_court} yet. Invite a friend to sign up!
              </p>
            )}
          </section>
        ) : (
          <section className="mb-8 rounded-lg border border-dashed border-neutral-800 p-4">
            <p className="text-sm text-neutral-400">
              You haven&apos;t set a home court yet.{" "}
              <Link href="/profile" className="text-court hover:underline">Add one</Link> to see
              hoopers who play there.
            </p>
          </section>
        )}

        {/* Everyone else */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
            {atMyCourt.length ? "More hoopers" : "All hoopers"}
          </h2>
          {elsewhere.length ? (
            <div className="space-y-2">
              {elsewhere.map((h) => (
                <HooperCard key={h.id} hooper={h} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">
              No other hoopers have signed up yet — you&apos;re early. 🏀
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
