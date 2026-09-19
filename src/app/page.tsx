import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">BusinessMeet</h1>
      <p className="text-lg leading-7 text-zinc-600 dark:text-zinc-400">
        Starting your first small business? Find the person to start it with. Meet people who
        share your interests, bring the skills you&apos;re missing, and can give the time it takes.
      </p>
      <p className="text-zinc-600 dark:text-zinc-400">
        For local services and trades, food, e-commerce and more. Whether you have an idea or want
        to join someone else&apos;s, and whether you can work side by side or from anywhere, you&apos;re
        welcome.
      </p>
      <Link
        href="/login"
        className="flex h-12 w-full items-center justify-center rounded-xl bg-foreground px-5 text-base font-medium text-background"
      >
        Log in or sign up
      </Link>
    </main>
  );
}
