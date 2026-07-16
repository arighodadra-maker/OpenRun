import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import Thread, { type Message } from "@/components/Thread";

export default async function ThreadPage({ params }: { params: { id: string } }) {
  if (!isSupabaseConfigured) redirect("/signup");

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const otherId = params.id;

  const { data: other } = await supabase
    .from("profiles")
    .select("id, full_name, username")
    .eq("id", otherId)
    .single();

  if (!other) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4">
        <p className="text-neutral-400">That hooper doesn&apos;t exist.</p>
        <Link href="/messages" className="text-court hover:underline mt-2 text-sm">
          ← Back to messages
        </Link>
      </main>
    );
  }

  const name = other.full_name || other.username || "Hooper";

  // RLS already limits rows to messages I'm part of; filter to this pair.
  const { data: rows } = await supabase
    .from("messages")
    .select("id, sender_id, recipient_id, content, created_at")
    .or(
      `and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`
    )
    .order("created_at", { ascending: true });

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-lg flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/messages" className="text-sm text-neutral-400 hover:text-neutral-200">
            ←
          </Link>
          <div className="w-8 h-8 rounded-full bg-court/20 text-court flex items-center justify-center font-bold">
            {name.slice(0, 1).toUpperCase()}
          </div>
          <div className="font-semibold">{name}</div>
        </div>

        <Thread
          meId={user.id}
          other={{ id: otherId, name }}
          initial={(rows ?? []) as Message[]}
        />
      </div>
    </main>
  );
}
