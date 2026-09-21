"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondToInvite } from "@/app/journeys/actions";
import { m } from "@/lib/messages";

// Accept or decline an invitation to a parcours. Accepting opens the parcours; declining goes
// back to the list.
export function JourneyInviteResponse({ journeyId }: { journeyId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startPending] = useTransition();
  const [choice, setChoice] = useState<"accept" | "decline" | null>(null);

  function respond(accept: boolean) {
    setError(null);
    setChoice(accept ? "accept" : "decline");
    startPending(async () => {
      const result = await respondToInvite(journeyId, accept);
      if (!result.ok) setError(result.message);
      else if (accept) router.refresh();
      else router.push("/journeys");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => respond(true)}
          disabled={pending}
          className="h-11 flex-1 rounded-xl bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
        >
          {pending && choice === "accept" ? m.parcours.accepting : m.parcours.accept}
        </button>
        <button
          type="button"
          onClick={() => respond(false)}
          disabled={pending}
          className="h-11 flex-1 rounded-xl border border-zinc-300 px-4 text-sm font-medium disabled:opacity-60 dark:border-zinc-700"
        >
          {pending && choice === "decline" ? m.parcours.declining : m.parcours.decline}
        </button>
      </div>
    </div>
  );
}
