"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Message = {
  id: number;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
};

export default function Thread({
  meId,
  other,
  initial,
}: {
  meId: string;
  other: { id: string; name: string };
  initial: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initial);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to newest whenever messages change.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Live updates: append messages this person sends me as they arrive.
  // (My own sent messages are appended optimistically in send().)
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      // Realtime respects row-level security, so the socket must carry my login
      // token — otherwise protected rows are never delivered.
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);

      channel = supabase
        .channel(`dm-${meId}-${other.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `recipient_id=eq.${meId}`,
          },
          (payload) => {
            const m = payload.new as Message;
            if (m.sender_id !== other.id) return; // only this conversation
            setMessages((prev) =>
              prev.some((x) => x.id === m.id) ? prev : [...prev, m]
            );
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [meId, other.id]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;
    setSending(true);
    setText("");

    const supabase = createClient();
    const { data, error } = await supabase
      .from("messages")
      .insert({ sender_id: meId, recipient_id: other.id, content })
      .select()
      .single();

    if (error) {
      setText(content); // restore on failure
    } else if (data) {
      setMessages((prev) =>
        prev.some((x) => x.id === data.id) ? prev : [...prev, data as Message]
      );
    }
    setSending(false);
  }

  return (
    <div className="flex flex-col h-[70vh]">
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-500 text-center mt-8">
            No messages yet. Say hi to {other.name}! 🏀
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  mine
                    ? "bg-court text-black rounded-br-sm"
                    : "bg-neutral-800 text-neutral-100 rounded-bl-sm"
                }`}
              >
                {m.content}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${other.name}…`}
          className="flex-1 rounded-full bg-neutral-900 border border-neutral-800 px-4 py-2 text-sm outline-none focus:border-court"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="px-4 py-2 rounded-full bg-court text-black font-semibold text-sm hover:opacity-90 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
