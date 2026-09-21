"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startJourney } from "@/app/journeys/actions";
import { JOURNEY_GOAL_MAX_LENGTH, JOURNEY_NAME_MAX_LENGTH } from "@/lib/journey-options";
import { m } from "@/lib/messages";

// "Lancer un parcours" under a conversation: name + goal, then the other person is invited.
export function JourneyStart({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startBusy(async () => {
      const result = await startJourney({ matchId, name, goal });
      if (result.ok && result.journeyId) router.push(`/journeys/${result.journeyId}`);
      else if (!result.ok) setError(result.message);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 rounded-xl border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700"
      >
        {m.parcours.startCta}
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <h2 className="text-base font-semibold">{m.parcours.startTitle}</h2>
      <p className="text-sm text-zinc-500">{m.parcours.startHint}</p>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {m.parcours.nameLabel}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={JOURNEY_NAME_MAX_LENGTH}
          placeholder={m.parcours.namePlaceholder}
          className="h-12 rounded-xl border border-zinc-300 bg-transparent px-4 text-base font-normal outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {m.parcours.goalLabel}
        <textarea
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          maxLength={JOURNEY_GOAL_MAX_LENGTH}
          rows={3}
          placeholder={m.parcours.goalPlaceholder}
          className="rounded-xl border border-zinc-300 bg-transparent px-4 py-3 text-base font-normal outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
        />
      </label>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || name.trim() === ""}
          className="h-11 flex-1 rounded-xl bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
        >
          {busy ? m.parcours.startBusy : m.parcours.startSubmit}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={busy}
          className="h-11 flex-1 rounded-xl border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700"
        >
          {m.parcours.cancel}
        </button>
      </div>
    </form>
  );
}
