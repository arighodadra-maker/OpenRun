"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Header widget: shows Log in / Sign up, or the current user's name + menu. */
export default function AuthWidget() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true);
      return;
    }
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.refresh();
  }

  // Hide entirely if Supabase isn't set up yet, or while we check the session.
  if (!isSupabaseConfigured || !ready) return null;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="text-xs px-3 py-1.5 rounded hover:bg-neutral-800">
          Log in
        </Link>
        <Link
          href="/signup"
          className="text-xs px-3 py-1.5 rounded bg-court text-black font-semibold hover:opacity-90"
        >
          Sign up
        </Link>
      </div>
    );
  }

  const name =
    (user.user_metadata?.full_name as string) || user.email?.split("@")[0] || "you";

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/hoopers"
        className="text-xs px-3 py-1.5 rounded hover:bg-neutral-800"
        title="Find other hoopers"
      >
        Hoopers
      </Link>
      <Link
        href="/matches"
        className="text-xs px-3 py-1.5 rounded hover:bg-neutral-800"
        title="Recommended hoopers"
      >
        Matches
      </Link>
      <Link
        href="/messages"
        className="text-xs px-3 py-1.5 rounded hover:bg-neutral-800"
        title="Your messages"
      >
        Messages
      </Link>
      <Link
        href="/leaderboard"
        className="text-xs px-3 py-1.5 rounded hover:bg-neutral-800"
        title="Leaderboard"
      >
        🏆
      </Link>
      <Link
        href="/profile"
        className="text-xs px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700"
        title="Your profile"
      >
        {name}
      </Link>
      <button
        onClick={signOut}
        className="text-xs px-3 py-1.5 rounded hover:bg-neutral-800 text-neutral-400"
      >
        Sign out
      </button>
    </div>
  );
}
