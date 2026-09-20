"use client";

import Link from "next/link";
import { m } from "@/lib/messages";

// Shown when something unexpected fails while a page loads.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{m.pages.errorTitle}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{m.pages.errorText}</p>
      <button
        type="button"
        onClick={reset}
        className="h-12 rounded-xl bg-foreground px-5 text-base font-medium text-background"
      >
        {m.pages.retry}
      </button>
      <Link href="/" className="text-sm underline">
        {m.pages.home}
      </Link>
    </main>
  );
}
