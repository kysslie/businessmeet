"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { sendMessage, type ChatMessage } from "@/app/matches/[conversationId]/actions";
import { m } from "@/lib/messages";
import { MESSAGE_MAX_LENGTH } from "@/lib/profile-options";
import { createClient } from "@/lib/supabase/client";

// Keeps messages in order and never shows the same one twice (a message can arrive both from
// the send button's answer and from the live channel).
function merge(list: ChatMessage[], incoming: ChatMessage) {
  if (list.some((message) => message.id === incoming.id)) return list;
  return [...list, incoming].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
}

// The messages of one conversation, updated live, plus the box to write in.
// `notice` is set when the conversation is read-only (archived), and then there is no box.
export function Chat({
  conversationId,
  meId,
  initialMessages,
  notice,
  senderNames,
  emptyText,
}: {
  conversationId: string;
  meId: string;
  initialMessages: ChatMessage[];
  notice: string | null;
  // Set in group chats: who wrote each message (by user id). Unknown senders show as a generic name.
  senderNames?: Record<string, string>;
  emptyText?: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  // Live updates: new messages in this conversation are pushed to the page. Row level security
  // decides who receives them, so only the two participants do.
  useEffect(() => {
    const channel = supabase
      .channel(`conversation-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => setMessages((list) => merge(list, payload.new as ChatMessage)),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, conversationId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setError(null);
    startSending(async () => {
      const result = await sendMessage(conversationId, text);
      if (result.ok) {
        setMessages((list) => merge(list, result.message));
        setDraft("");
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <ul className="flex flex-1 flex-col gap-2" aria-live="polite">
        {messages.length === 0 && (
          <li className="py-8 text-center text-sm text-zinc-500">{emptyText ?? m.chat.empty}</li>
        )}
        {messages.map((message) => {
          const mine = message.sender_id === meId;
          return (
            <li
              key={message.id}
              className={"flex flex-col gap-1 " + (mine ? "items-end" : "items-start")}
            >
              {senderNames && !mine && (
                <span className="px-2 text-xs text-zinc-500">
                  {senderNames[message.sender_id] ?? m.parcours.someone}
                </span>
              )}
              <p
                className={
                  "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-base " +
                  (mine
                    ? "bg-foreground text-background"
                    : "bg-zinc-100 text-foreground dark:bg-zinc-800")
                }
              >
                {message.body}
              </p>
            </li>
          );
        })}
        <div ref={bottom} />
      </ul>

      {notice ? (
        <p className="rounded-xl bg-zinc-100 p-4 text-center text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          {notice}
        </p>
      ) : (
        <form onSubmit={send} className="flex flex-col gap-2">
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={MESSAGE_MAX_LENGTH}
              placeholder={m.chat.placeholder}
              aria-label={m.chat.placeholder}
              autoComplete="off"
              className="h-12 min-w-0 flex-1 rounded-xl border border-zinc-300 bg-transparent px-4 text-base outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
            />
            <button
              type="submit"
              disabled={sending || draft.trim() === ""}
              className="h-12 rounded-xl bg-foreground px-5 text-base font-medium text-background disabled:opacity-60"
            >
              {sending ? m.chat.sending : m.chat.send}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
