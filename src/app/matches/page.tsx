import Link from "next/link";
import { redirect } from "next/navigation";
import { loadConversations, type ConversationSummary } from "@/lib/conversations";
import { m } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

function Row({ conversation }: { conversation: ConversationSummary }) {
  const partner = conversation.partner;
  return (
    <li>
      <Link
        href={`/matches/${conversation.id}`}
        className="flex items-center gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-2xl dark:bg-zinc-800">
          {partner?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={partner.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden="true">🙂</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{partner?.name ?? m.common.deletedUser}</p>
          {conversation.archived && (
            <p className="text-sm text-zinc-500">{m.matches.archivedBadge}</p>
          )}
        </div>
      </Link>
    </li>
  );
}

export default async function MatchesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  // proxy.ts already redirects logged-out visitors; this is a second lock on the door.
  if (!userId) redirect("/login");

  const conversations = await loadConversations(supabase, userId);
  const active = conversations.filter((conversation) => !conversation.archived);
  const archived = conversations.filter((conversation) => conversation.archived);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{m.matches.title}</h1>
        <Link href="/feed" className="text-sm underline">
          {m.matches.back}
        </Link>
      </header>

      {active.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 p-8 text-center dark:border-zinc-800">
          <p className="text-lg font-medium">{m.matches.emptyTitle}</p>
          <p className="mt-2 text-sm text-zinc-500">{m.matches.emptyText}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {active.map((conversation) => (
            <Row key={conversation.id} conversation={conversation} />
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-500">{m.matches.archivedTitle}</h2>
          <ul className="flex flex-col gap-3">
            {archived.map((conversation) => (
              <Row key={conversation.id} conversation={conversation} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
