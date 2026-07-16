import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  if (!isSupabaseConfigured) redirect("/signup");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, full_name, home_court, skill_level, age, years_experience, points, wins, losses")
    .eq("id", user.id)
    .single();

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
          ← Back to map
        </Link>
        <h1 className="text-xl font-semibold mt-4 mb-1">Your profile</h1>
        <p className="text-xs text-neutral-500 mb-6">{user.email}</p>

        <ProfileForm
          initial={{
            username: profile?.username ?? "",
            full_name: profile?.full_name ?? "",
            home_court: profile?.home_court ?? "",
            skill_level: profile?.skill_level ?? "",
            age: profile?.age != null ? String(profile.age) : "",
            years_experience:
              profile?.years_experience != null ? String(profile.years_experience) : "",
          }}
          stats={{
            points: profile?.points ?? 0,
            wins: profile?.wins ?? 0,
            losses: profile?.losses ?? 0,
          }}
        />
      </div>
    </main>
  );
}
