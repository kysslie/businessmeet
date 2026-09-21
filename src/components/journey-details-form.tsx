"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateJourney } from "@/app/journeys/actions";
import { JOURNEY_GOAL_MAX_LENGTH, JOURNEY_NAME_MAX_LENGTH } from "@/lib/journey-options";
import { m } from "@/lib/messages";

// Shows the name and goal of a parcours; any member of an open parcours can edit them.
export function JourneyDetails({
  journeyId,
  name,
  goal,
  canEdit,
}: {
  journeyId: string;
  name: string;
  goal: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);
  const [goalDraft, setGoalDraft] = useState(goal ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startBusy(async () => {
      const result = await updateJourney({ journeyId, name: nameDraft, goal: goalDraft });
      if (result.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(result.message);
      }
    });
  }

  if (!editing) {
    return (
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
        <p className={goal ? "whitespace-pre-wrap text-base" : "text-sm text-zinc-500"}>
          {goal ?? m.parcours.noGoal}
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setNameDraft(name);
              setGoalDraft(goal ?? "");
              setEditing(true);
            }}
            className="self-start text-sm underline"
          >
            {m.parcours.edit}
          </button>
        )}
      </section>
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {m.parcours.nameLabel}
        <input
          value={nameDraft}
          onChange={(event) => setNameDraft(event.target.value)}
          maxLength={JOURNEY_NAME_MAX_LENGTH}
          className="h-12 rounded-xl border border-zinc-300 bg-transparent px-4 text-base font-normal outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {m.parcours.goalLabel}
        <textarea
          value={goalDraft}
          onChange={(event) => setGoalDraft(event.target.value)}
          maxLength={JOURNEY_GOAL_MAX_LENGTH}
          rows={3}
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
          disabled={busy || nameDraft.trim() === ""}
          className="h-11 flex-1 rounded-xl bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
        >
          {busy ? m.parcours.saving : m.parcours.save}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          disabled={busy}
          className="h-11 flex-1 rounded-xl border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700"
        >
          {m.parcours.cancel}
        </button>
      </div>
    </form>
  );
}
