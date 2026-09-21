"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteToJourney } from "@/app/journeys/actions";
import { m } from "@/lib/messages";

export type InviteCandidate = { id: string; name: string; avatarUrl: string | null };

function Row({ journeyId, person }: { journeyId: string; person: InviteCandidate }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function invite() {
    setError(null);
    startBusy(async () => {
      const result = await inviteToJourney({ journeyId, userId: person.id });
      if (result.ok) {
        setDone(true);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        {person.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true">🙂</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{person.name}</p>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
      {done ? (
        <span className="text-sm text-zinc-500">{m.parcours.invited}</span>
      ) : (
        <button
          type="button"
          onClick={invite}
          disabled={busy}
          className="h-10 rounded-xl border border-zinc-300 px-4 text-sm font-medium disabled:opacity-60 dark:border-zinc-700"
        >
          {busy ? m.parcours.inviting : m.parcours.invite}
        </button>
      )}
    </li>
  );
}

// Your own matches you can still invite into this parcours.
export function JourneyInviteMember({
  journeyId,
  candidates,
}: {
  journeyId: string;
  candidates: InviteCandidate[];
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{m.parcours.inviteTitle}</h2>
      <p className="text-sm text-zinc-500">{m.parcours.inviteHint}</p>
      {candidates.length === 0 ? (
        <p className="rounded-2xl border border-zinc-200 p-4 text-center text-sm text-zinc-500 dark:border-zinc-800">
          {m.parcours.inviteNobody}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {candidates.map((person) => (
            <Row key={person.id} journeyId={journeyId} person={person} />
          ))}
        </ul>
      )}
    </section>
  );
}
