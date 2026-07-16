import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type Row = {
  id: number;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
};

export default async function MessagesPage() {
  if (!isSupabaseConfigured) redirect("/signup");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // All my messages, newest first (RLS keeps this to conversations I'm in).
  const { data: rows } = await supabase
    .from("messages")
    .select("id, sender_id, recipient_id, content, created_at")
    .order("created_at", { ascending: false });

  const messages = (rows ?? []) as Row[];

  // Reduce to one entry per conversation partner (their latest message).
  const latestByPartner = new Map<string, Row>();
  for (const m of messages) {
    const partner = m.sender_id === user.id ? m.recipient_id : m.sender_id;
    if (!latestByPartner.has(partner)) latestByPartner.set(partner, m);
  }

  const partnerIds = [...latestByPartner.keys()];
  const { data: profiles } = partnerIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, username")
        .in("id", partnerIds)
    : { data: [] as { id: string; full_name: string | null; username: string | null }[] };

  const nameOf = (id: string) => {
    const p = (profiles ?? []).find((x) => x.id === id);
    return p?.full_name || p?.username || "Hooper";
  };

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-lg">
        <Link href="/" className="text-sm text-neutral-400 hover:text-neutral-200">
          ← Back to map
        </Link>
        <h1 className="text-xl font-semibold mt-4 mb-6">Messages</h1>

        {partnerIds.length ? (
          <div className="space-y-2">
            {partnerIds.map((pid) => {
              const last = latestByPartner.get(pid)!;
              const name = nameOf(pid);
              const preview =
                (last.sender_id === user.id ? "You: " : "") + last.content;
              return (
                <Link
                  key={pid}
                  href={`/messages/${pid}`}
                  className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-950 p-3 hover:border-neutral-700"
                >
                  <div className="w-9 h-9 shrink-0 rounded-full bg-court/20 text-court flex items-center justify-center font-bold">
                    {name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{name}</div>
                    <div className="text-xs text-neutral-500 truncate">{preview}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            No conversations yet. Find someone on{" "}
            <Link href="/matches" className="text-court hover:underline">Recommended hoopers</Link>{" "}
            or{" "}
            <Link href="/hoopers" className="text-court hover:underline">Hoopers</Link> and say hi. 🏀
          </p>
        )}
      </div>
    </main>
  );
}
