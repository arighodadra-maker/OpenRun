"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import Avatar, { type AvatarData } from "./Avatar";
import { MapIcon, UsersIcon, SparkIcon, ChatIcon, TrophyIcon } from "./icons";

const NAV = [
  { href: "/", label: "Map", Icon: MapIcon, exact: true },
  { href: "/hoopers", label: "Players", Icon: UsersIcon },
  { href: "/matches", label: "Matches", Icon: SparkIcon },
  { href: "/messages", label: "Messages", Icon: ChatIcon },
  { href: "/leaderboard", label: "Leaderboard", Icon: TrophyIcon },
];

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AvatarData | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true);
      return;
    }
    const supabase = createClient();

    async function loadProfile(u: User | null) {
      setUser(u);
      if (u) {
        const { data } = await supabase
          .from("profiles")
          .select("full_name, username, avatar_emoji, accent_color")
          .eq("id", u.id)
          .single();
        setProfile(
          data ?? { full_name: (u.user_metadata?.full_name as string) ?? null }
        );
      } else {
        setProfile(null);
      }
      setReady(true);
    }

    supabase.auth.getUser().then(({ data }) => loadProfile(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      loadProfile(session?.user ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, [pathname]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push("/");
    router.refresh();
  }

  // Keep auth screens clean — no nav there.
  if (pathname?.startsWith("/login") || pathname?.startsWith("/signup")) return null;

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname?.startsWith(href + "/");

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-900 bg-neutral-950/85 backdrop-blur">
      <div className="mx-auto max-w-5xl px-3 h-14 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-court to-orange-600 flex items-center justify-center text-black font-black shadow-lg shadow-orange-900/30">
            ▲
          </div>
          <span className="font-extrabold tracking-tight hidden sm:block">OpenRun</span>
        </Link>

        {ready && user && (
          <nav className="flex items-center gap-0.5 sm:gap-1">
            {NAV.map(({ href, label, Icon, exact }) => {
              const active = isActive(href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  aria-label={label}
                  className={`relative flex items-center justify-center w-10 h-10 rounded-xl transition ${
                    active
                      ? "text-court bg-court/10"
                      : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900"
                  }`}
                >
                  <Icon size={20} />
                  {active && (
                    <span className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-court" />
                  )}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {ready && !user && (
            <>
              <Link href="/login" className="text-sm px-3 py-1.5 rounded-lg hover:bg-neutral-900">
                Log in
              </Link>
              <Link
                href="/signup"
                className="text-sm px-3 py-1.5 rounded-lg bg-court text-black font-semibold hover:opacity-90"
              >
                Sign up
              </Link>
            </>
          )}
          {ready && user && profile && (
            <div className="flex items-center gap-1">
              <Link
                href="/profile"
                title="Your profile"
                className={`rounded-full transition ${
                  isActive("/profile") ? "ring-2 ring-court" : "hover:opacity-80"
                }`}
              >
                <Avatar user={profile} size={34} />
              </Link>
              <button
                onClick={signOut}
                title="Sign out"
                aria-label="Sign out"
                className="w-9 h-9 flex items-center justify-center rounded-xl text-neutral-500 hover:text-neutral-200 hover:bg-neutral-900 text-lg"
              >
                ⏻
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
