"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unmatchAction } from "@/app/matches/[conversationId]/actions";
import { m } from "@/lib/messages";

// "Retirer ce match": asks first, then ends the match. The conversation stays, archived.
export function UnmatchButton({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function confirm() {
    setError(null);
    startBusy(async () => {
      const result = await unmatchAction(matchId);
      if (result.ok) {
        setAsking(false);
        router.refresh();
      } else {
        setError(result.message ?? m.chat.unmatchFailed);
      }
    });
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="text-sm text-zinc-500 underline"
      >
        {m.chat.unmatch}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800" role="alertdialog">
      <p className="text-sm">{m.chat.unmatchAsk}</p>
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
          {busy ? m.chat.unmatchBusy : m.chat.unmatchConfirm}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={busy}
          className="h-10 flex-1 rounded-xl border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700"
        >
          {m.chat.unmatchCancel}
        </button>
      </div>
    </div>
  );
}
