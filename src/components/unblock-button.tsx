"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { unblockUser } from "@/app/safety/actions";
import { m } from "@/lib/messages";

export function UnblockButton({ targetId }: { targetId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  function unblock() {
    setError(null);
    startBusy(async () => {
      const result = await unblockUser(targetId);
      if (result.ok) router.refresh();
      else setError(result.message);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={unblock}
        disabled={busy}
        className="h-10 rounded-xl border border-zinc-300 px-4 text-sm font-medium disabled:opacity-60 dark:border-zinc-700"
      >
        {busy ? m.settings.unblockBusy : m.settings.unblock}
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
