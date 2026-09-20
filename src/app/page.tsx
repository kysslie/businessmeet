import Link from "next/link";
import { m } from "@/lib/messages";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">{m.app.name}</h1>
      <p className="text-lg leading-7 text-zinc-600 dark:text-zinc-400">{m.landing.intro}</p>
      <p className="text-zinc-600 dark:text-zinc-400">{m.landing.more}</p>
      <p className="text-sm text-zinc-500">{m.landing.region}</p>
      <Link
        href="/login"
        className="flex h-12 w-full items-center justify-center rounded-xl bg-foreground px-5 text-base font-medium text-background"
      >
        {m.landing.cta}
      </Link>
      {/* Founding-member offer: Elie's wording, pending legal review (DEBT-020). */}
      <p className="rounded-xl bg-zinc-100 p-4 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        {m.landing.pricing}
      </p>
    </main>
  );
}
