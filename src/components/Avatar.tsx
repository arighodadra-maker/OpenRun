// Presentational avatar (no hooks) so it works in both server and client components.
// Renders the user's chosen emoji on their accent-colored chip, or their initial.

export type AvatarData = {
  full_name?: string | null;
  username?: string | null;
  avatar_emoji?: string | null;
  accent_color?: string | null;
};

const DEFAULT_ACCENT = "#f97316";

export default function Avatar({
  user,
  size = 36,
  ring = false,
}: {
  user: AvatarData;
  size?: number;
  ring?: boolean;
}) {
  const accent = user.accent_color || DEFAULT_ACCENT;
  const emoji = user.avatar_emoji?.trim();
  const initial = (user.full_name || user.username || "?").trim().slice(0, 1).toUpperCase();

  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center font-bold select-none"
      style={{
        width: size,
        height: size,
        background: `${accent}22`,
        color: accent,
        fontSize: emoji ? size * 0.55 : size * 0.42,
        boxShadow: ring ? `0 0 0 2px ${accent}55` : undefined,
        lineHeight: 1,
      }}
    >
      {emoji || initial}
    </div>
  );
}
