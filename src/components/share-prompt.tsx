"use client";

import { useEffect, useState } from "react";
import { markSharePromptShown } from "@/app/profile/actions";
import { m } from "@/lib/messages";

// The one-time "your portfolio is live" prompt (P3b). Only ever rendered once: the parent
// decides whether to show it at all (first public project + a visible profile level +
// not shown before); this component marks it shown the moment it actually renders, not on
// dismiss, so a person who never interacts with it still doesn't see it again next time.
export function SharePrompt({ url }: { url: string }) {
  const [closed, setClosed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    markSharePromptShown().catch(() => {});
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Nothing useful to do if the clipboard API is unavailable; the link is shown either way.
    }
  }

  if (closed) return null;

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900"
      role="status"
    >
      <p className="text-sm font-medium">{m.portfolio.sharePrompt.message}</p>
      <p className="truncate text-sm text-zinc-500">{url}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={copyLink}
          className="h-10 flex-1 rounded-xl bg-foreground px-4 text-sm font-medium text-background"
        >
          {copied ? m.portfolio.sharePrompt.linkCopied : m.portfolio.sharePrompt.copyLink}
        </button>
        <button
          type="button"
          onClick={() => setClosed(true)}
          className="h-10 flex-1 rounded-xl border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700"
        >
          {m.portfolio.sharePrompt.close}
        </button>
      </div>
    </div>
  );
}
