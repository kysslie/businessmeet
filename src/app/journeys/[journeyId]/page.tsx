import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Chat } from "@/components/chat";
import { JourneyDetails } from "@/components/journey-details-form";
import { JourneyInviteMember } from "@/components/journey-invite-member";
import { JourneyInviteResponse } from "@/components/journey-invite-response";
import { JourneyLeaveButton } from "@/components/journey-leave-button";
import { JourneyLinks } from "@/components/journey-links";
import { loadConversations } from "@/lib/conversations";
import type { JourneyLinkKind } from "@/lib/journey-options";
import { loadPeople, type JourneyLink, type JourneyMember } from "@/lib/journeys";
import { m } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/lib/validation/message";

// One parcours: name and goal, members, shared links, group chat, invitations, leave.
// Row level security means only members (and the invited person) can open it; anyone else gets a 404.
export default async function JourneyPage({ params }: PageProps<"/journeys/[journeyId]">) {
  const { journeyId } = await params;
  if (!idSchema.safeParse(journeyId).success) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: journey } = await supabase
    .from("journeys")
    .select("id, name, goal, created_by, conversation_id, archived_at")
    .eq("id", journeyId)
    .maybeSingle();
  const { data: mine } = await supabase
    .from("journey_members")
    .select("status, invited_by")
    .eq("journey_id", journeyId)
    .eq("user_id", userId)
    .is("left_at", null)
    .maybeSingle();
  if (!journey || !mine) notFound();

  // Invited but not yet joined: only the name, the goal and the answer buttons.
  if (mine.status === "invited") {
    const inviter = mine.invited_by ? (await loadPeople(supabase, [mine.invited_by])).get(mine.invited_by) : null;
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-6">
        <Link href="/journeys" className="text-sm underline">
          {m.common.back}
        </Link>
        <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">{m.parcours.invitationTitle}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{journey.name}</h1>
          {inviter && <p className="text-sm text-zinc-500">{m.parcours.invitedBy(inviter.name)}</p>}
          {journey.goal && <p className="whitespace-pre-wrap text-base">{journey.goal}</p>}
          <JourneyInviteResponse journeyId={journey.id} />
        </section>
      </main>
    );
  }

  const archived = journey.archived_at !== null;

  const [membersResult, linksResult, messagesResult, conversations] = await Promise.all([
    supabase
      .from("journey_members")
      .select("user_id, status")
      .eq("journey_id", journeyId)
      .is("left_at", null),
    supabase
      .from("journey_links")
      .select("id, title, url, kind, added_by")
      .eq("journey_id", journeyId)
      .order("created_at"),
    supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("conversation_id", journey.conversation_id)
      .order("created_at")
      .order("id")
      .limit(500),
    archived ? Promise.resolve([]) : loadConversations(supabase, userId),
  ]);
  if (membersResult.error || linksResult.error || messagesResult.error) {
    console.error("journey load failed:", membersResult.error?.code, linksResult.error?.code, messagesResult.error?.code);
    throw new Error(m.parcours.loadFailed);
  }

  const memberRows = membersResult.data;
  const people = await loadPeople(supabase, [
    ...memberRows.map((row) => row.user_id),
    ...linksResult.data.flatMap((link) => (link.added_by ? [link.added_by] : [])),
    ...messagesResult.data.map((message) => message.sender_id),
  ]);

  const members: JourneyMember[] = memberRows
    .map((row) => ({
      id: row.user_id,
      name: row.user_id === userId ? m.parcours.youTag : (people.get(row.user_id)?.name ?? m.parcours.someone),
      avatarUrl: people.get(row.user_id)?.avatarUrl ?? null,
      invited: row.status === "invited",
      isMe: row.user_id === userId,
    }))
    .sort((a, b) => Number(a.invited) - Number(b.invited) || Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name, m.locale));

  const links: JourneyLink[] = linksResult.data.map((link) => ({
    id: link.id,
    title: link.title,
    url: link.url,
    kind: link.kind as JourneyLinkKind,
    addedByName: link.added_by ? (link.added_by === userId ? m.parcours.youTag : (people.get(link.added_by)?.name ?? null)) : null,
    canRemove: link.added_by === userId || journey.created_by === userId,
  }));

  const memberIds = new Set(memberRows.map((row) => row.user_id));
  const candidates = conversations
    .filter((conversation) => !conversation.archived && conversation.partner && !memberIds.has(conversation.partner.id))
    .map((conversation) => conversation.partner!);

  const senderNames: Record<string, string> = {};
  for (const [id, person] of people) senderNames[id] = person.name;

  const memberCount = members.filter((member) => !member.invited).length;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-6">
      <div className="flex flex-col gap-4">
        <Link href="/journeys" className="text-sm underline">
          {m.parcours.title}
        </Link>
        <JourneyDetails journeyId={journey.id} name={journey.name} goal={journey.goal} canEdit={!archived} />
        {archived && (
          <p className="rounded-xl bg-zinc-100 p-4 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            {m.parcours.archivedNotice}
          </p>
        )}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">
          {m.parcours.membersTitle} <span className="text-sm font-normal text-zinc-500">({memberCount})</span>
        </h2>
        <ul className="flex flex-col gap-2">
          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                {member.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={member.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span aria-hidden="true">🙂</span>
                )}
              </div>
              <p className="min-w-0 flex-1 truncate font-medium">{member.name}</p>
              {member.invited && <span className="text-sm text-zinc-500">{m.parcours.invitedTag}</span>}
            </li>
          ))}
        </ul>
      </section>

      <JourneyLinks journeyId={journey.id} links={links} canAdd={!archived} />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{m.parcours.chatTitle}</h2>
        <Chat
          conversationId={journey.conversation_id}
          meId={userId}
          initialMessages={messagesResult.data}
          notice={archived ? m.parcours.archivedNotice : null}
          senderNames={senderNames}
          emptyText={m.parcours.chatEmpty}
        />
      </section>

      {!archived && <JourneyInviteMember journeyId={journey.id} candidates={candidates} />}

      <div className="flex flex-col items-start gap-3 pt-2">
        <JourneyLeaveButton journeyId={journey.id} />
      </div>
    </main>
  );
}
