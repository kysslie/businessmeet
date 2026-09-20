import Link from "next/link";
import { m } from "@/lib/messages";

// Shown for any page that does not exist, or that the person is not allowed to open.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">{m.pages.notFoundTitle}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{m.pages.notFoundText}</p>
      <Link href="/" className="text-sm underline">
        {m.pages.home}
      </Link>
    </main>
  );
}
