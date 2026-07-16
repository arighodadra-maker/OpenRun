"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlusIcon, CheckIcon } from "./icons";

export default function FollowButton({
  targetId,
  initialFollowing,
}: {
  targetId: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    if (following) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
      setFollowing(false);
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: targetId });
      setFollowing(true);
    }
    setBusy(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-semibold transition disabled:opacity-50 ${
        following
          ? "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
          : "bg-court text-black hover:opacity-90"
      }`}
    >
      {following ? <CheckIcon size={12} /> : <PlusIcon size={12} />}
      {following ? "Following" : "Add"}
    </button>
  );
}
