import Link from "next/link";
import { redirect } from "next/navigation";
import { FeedDeck } from "@/components/feed-deck";
import type { FeedCard } from "@/components/profile-card";
import { m } from "@/lib/messages";
import { signedPhotoLinks } from "@/lib/photo-links";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../auth/actions";

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  // proxy.ts already redirects logged-out visitors; this is a second lock on the door.
  if (!auth?.claims) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded")
    .eq("id", auth.claims.sub)
    .single();
  // New people finish their profile before anything else.
  if (!profile?.onboarded) redirect("/onboarding");

  // The up-to-20 people this user can swipe on (rules live in the database).
  const { data: feed, error } = await supabase.rpc("get_feed");
  if (error) {
    console.error("get_feed failed:", error.code, error.message);
    throw new Error(m.feed.loadFailed);
  }

  // One batch request for every photo link.
  const photoLinks = await signedPhotoLinks(
    supabase,
    feed.flatMap((person) => (person.avatar_path ? [person.avatar_path] : [])),
  );

  const cards: FeedCard[] = feed.map((person) => ({
    id: person.id,
    displayName: person.display_name ?? m.card.someone,
    avatarUrl: person.avatar_path ? (photoLinks.get(person.avatar_path) ?? null) : null,
    country: person.country,
    city: person.city,
    district: person.district,
    workModes: person.work_modes ?? [],
    ideaStatuses: person.idea_statuses ?? [],
    pitch: person.pitch,
    weeklyHours: person.weekly_hours ?? [],
    partnerWeeklyHours: person.partner_weekly_hours ?? [],
    ambitions: person.ambitions ?? [],
    categories: person.category_names,
    offers: person.offers,
    seeks: person.seeks,
  }));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">{m.app.name}</h1>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/matches" className="underline">
            {m.feed.nav.matches}
          </Link>
          <Link href="/journeys" className="underline">
            {m.feed.nav.parcours}
          </Link>
          <Link href="/profile" className="underline">
            {m.feed.nav.profile}
          </Link>
          <form action={signOut}>
            <button type="submit" className="underline">
              {m.common.logout}
            </button>
          </form>
        </nav>
      </header>
      {/* The key makes the deck start fresh whenever a new batch of people arrives. */}
      <FeedDeck key={cards.map((card) => card.id).join(",")} initialCards={cards} />
    </main>
  );
}
