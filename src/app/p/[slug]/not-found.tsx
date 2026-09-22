import Link from "next/link";
import { m } from "@/lib/messages";

// Shown when a slug is not a public (or visible-to-this-visitor) profile.
export default function PortfolioNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{m.portfolio.page.notFoundTitle}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{m.portfolio.page.notFoundText}</p>
      <Link href="/" className="text-sm underline">
        {m.portfolio.page.home}
      </Link>
    </main>
  );
}
