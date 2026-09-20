import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { ProfileCard } from "@/components/profile-card";
import { UnmatchButton } from "@/components/unmatch-button";
import { loadPartnerCard } from "@/lib/conversations";
import { m } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/message";

// One conversation: who it is with, their profile, the messages (live), and unmatch.
// Row level security means only a current participant can open it; anyone else gets a 404.
export default async function ConversationPage({ params }: PageProps<"/matches/[conversationId]">) {
  const { conversationId } = await params;
  if (!idSchema.safeParse(conversationId).success) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, type, archived_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation || conversation.type !== "direct") notFound();

  const { data: participants } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId);
  // Nobody else in the conversation: the other person deleted their account.
  const partnerId = participants?.find((row) => row.user_id !== userId)?.user_id ?? null;

  const [card, match, messages] = await Promise.all([
    partnerId ? loadPartnerCard(supabase, partnerId) : Promise.resolve(null),
    supabase.from("matches").select("id, unmatched_at").eq("conversation_id", conversationId).maybeSingle(),
    supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at")
      .order("id")
      .limit(500),
  ]);
  if (messages.error) {
    console.error("messages load failed:", messages.error.code, messages.error.message);
    throw new Error(m.chat.loadFailed);
  }

  const archived = conversation.archived_at !== null;
  const notice = archived ? (card ? m.chat.archivedNotice : m.chat.deletedNotice) : null;
  const canUnmatch = Boolean(match.data && !match.data.unmatched_at && !archived);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-6 py-6">
      <header className="flex flex-col gap-3">
        <Link href="/matches" className="text-sm underline">
          {m.chat.back}
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            {card?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true">🙂</span>
            )}
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{card?.displayName ?? m.common.deletedUser}</h1>
        </div>
        {card && (
          <details className="rounded-2xl border border-zinc-200 dark:border-zinc-800">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{m.chat.viewProfile}</summary>
            <div className="overflow-hidden rounded-b-2xl border-t border-zinc-200 dark:border-zinc-800">
              <ProfileCard card={card} />
            </div>
          </details>
        )}
      </header>

      <Chat
        conversationId={conversationId}
        meId={userId}
        initialMessages={messages.data}
        notice={notice}
      />

      {canUnmatch && match.data && (
        <div className="pt-2">
          <UnmatchButton matchId={match.data.id} />
        </div>
      )}
    </main>
  );
}
