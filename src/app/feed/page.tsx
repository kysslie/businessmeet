import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../auth/actions";

// Placeholder. The real swipe feed arrives in F4; for now this proves login and
// profile setup work.
export default async function FeedPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  // proxy.ts already redirects logged-out visitors; this is a second lock on the door.
  if (!data?.claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, onboarded")
    .eq("id", data.claims.sub)
    .single();
  // New people finish their profile before anything else.
  if (!profile?.onboarded) redirect("/onboarding");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Hi {profile.display_name}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        You&apos;re logged in as <strong>{data.claims.email}</strong>. The swipe feed arrives in
        a later step.
      </p>
      <Link
        href="/profile"
        className="flex h-12 w-full items-center justify-center rounded-xl bg-foreground px-5 text-base font-medium text-background"
      >
        Edit profile
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="h-12 w-full rounded-xl border border-zinc-300 px-5 text-base font-medium dark:border-zinc-700"
        >
          Log out
        </button>
      </form>
    </main>
  );
}
