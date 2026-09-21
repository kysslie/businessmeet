"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveJourney } from "@/app/journeys/actions";
import { m } from "@/lib/messages";

// "Quitter le parcours": asks first. Nothing is deleted; the person just stops being a member.
export function JourneyLeaveButton({ journeyId }: { journeyId: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function confirm() {
    setError(null);
    startBusy(async () => {
      const result = await leaveJourney(journeyId);
      if (result.ok) router.push("/journeys");
      else setError(result.message);
    });
  }

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className="text-sm text-zinc-500 underline">
        {m.parcours.leave}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800" role="alertdialog">
      <p className="text-sm">{m.parcours.leaveAsk}</p>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="h-10 flex-1 rounded-xl bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
        >
          {busy ? m.parcours.leaveBusy : m.parcours.leaveConfirm}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={busy}
          className="h-10 flex-1 rounded-xl border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700"
        >
          {m.parcours.cancel}
        </button>
      </div>
    </div>
  );
}
