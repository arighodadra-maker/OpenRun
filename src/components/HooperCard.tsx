import Link from "next/link";
import { skillBadgeClass } from "@/lib/skill";
import Avatar from "./Avatar";
import FollowButton from "./FollowButton";
import { ChatIcon } from "./icons";

export type Hooper = {
  id: string;
  username: string | null;
  full_name: string | null;
  home_court: string | null;
  skill_level: string | null;
  avatar_emoji?: string | null;
  accent_color?: string | null;
  bio?: string | null;
  fav_position?: string | null;
};

/** A single hooper row: avatar, name, meta, bio, skill badge, and social actions. */
export default function HooperCard({
  hooper,
  isYou,
  meId,
  isFollowing,
}: {
  hooper: Hooper;
  isYou?: boolean;
  meId?: string | null;
  isFollowing?: boolean;
}) {
  const displayName = hooper.full_name || hooper.username || "Anonymous hooper";
  const showActions = !!meId && !isYou;

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
      <div className="flex items-center gap-3">
        <Avatar user={hooper} size={40} ring />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{displayName}</span>
            {isYou && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400">
                you
              </span>
            )}
          </div>
          <div className="text-xs text-neutral-500 truncate">
            {hooper.username ? `@${hooper.username}` : "no username yet"}
            {hooper.fav_position ? ` · ${hooper.fav_position}` : ""}
            {hooper.home_court ? ` · 🏀 ${hooper.home_court}` : ""}
          </div>
        </div>
        {hooper.skill_level && (
          <span
            className={`text-[11px] px-2 py-1 rounded-full border shrink-0 ${skillBadgeClass(
              hooper.skill_level
            )}`}
          >
            {hooper.skill_level}
          </span>
        )}
      </div>

      {hooper.bio && <p className="mt-2 text-xs text-neutral-400 line-clamp-2">{hooper.bio}</p>}

      {showActions && (
        <div className="mt-2.5 flex items-center gap-2">
          <Link
            href={`/messages/${hooper.id}`}
            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 font-medium"
          >
            <ChatIcon size={12} /> Message
          </Link>
          <FollowButton targetId={hooper.id} initialFollowing={!!isFollowing} />
        </div>
      )}
    </div>
  );
}
