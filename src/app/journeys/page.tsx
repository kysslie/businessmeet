import Link from "next/link";
import { redirect } from "next/navigation";
import { loadJourneys, type JourneySummary } from "@/lib/journeys";
import { m } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";

function Row({ journey }: { journey: JourneySummary }) {
  return (
    <li>
      <Link
        href={`/journeys/${journey.id}`}
        className="flex flex-col gap-1 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <p className="truncate font-medium">{journey.name}</p>
        <p className="text-sm text-zinc-500">
          {journey.status === "invited" && journey.inviterName
            ? m.parcours.invitedBy(journey.inviterName)
            : journey.archived
              ? m.parcours.archivedBadge
              : journey.memberCount !== null
                ? m.parcours.members(journey.memberCount)
                : ""}
        </p>
      </Link>
    </li>
  );
}

// The list of parcours: invitations waiting for an answer, your parcours, and archived ones.
export default async function JourneysPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  // proxy.ts already redirects logged-out visitors; this is a second lock on the door.
  if (!userId) redirect("/login");

  const journeys = await loadJourneys(supabase, userId);
  const invitations = journeys.filter((journey) => journey.status === "invited" && !journey.archived);
  const active = journeys.filter((journey) => journey.status === "active" && !journey.archived);
  const archived = journeys.filter((journey) => journey.status === "active" && journey.archived);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{m.parcours.title}</h1>
        <Link href="/feed" className="text-sm underline">
          {m.parcours.back}
        </Link>
      </header>
      <p className="text-sm text-zinc-500">{m.parcours.intro}</p>

      {invitations.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-500">{m.parcours.invitationsTitle}</h2>
          <ul className="flex flex-col gap-3">
            {invitations.map((journey) => (
              <Row key={journey.id} journey={journey} />
            ))}
          </ul>
        </section>
      )}

      {active.length === 0 && invitations.length === 0 && archived.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 p-8 text-center dark:border-zinc-800">
          <p className="text-lg font-medium">{m.parcours.empty}</p>
          <p className="mt-2 text-sm text-zinc-500">{m.parcours.emptyText}</p>
          <Link href="/matches" className="mt-4 inline-block text-sm underline">
            {m.feed.nav.matches}
          </Link>
        </div>
      ) : (
        active.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-500">{m.parcours.activeTitle}</h2>
            <ul className="flex flex-col gap-3">
              {active.map((journey) => (
                <Row key={journey.id} journey={journey} />
              ))}
            </ul>
          </section>
        )
      )}

      {archived.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-500">{m.parcours.archivedTitle}</h2>
          <ul className="flex flex-col gap-3">
            {archived.map((journey) => (
              <Row key={journey.id} journey={journey} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
