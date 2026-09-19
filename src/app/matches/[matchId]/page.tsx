import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProfileCard, type FeedCard } from "@/components/profile-card";
import { signedPhotoLinks } from "@/lib/photo-links";
import { createClient } from "@/lib/supabase/server";
import { swipeSchema } from "@/lib/validation/swipe";

// One match: the other person's full profile. The chat itself arrives in F6.
export default async function MatchPage({ params }: PageProps<"/matches/[matchId]">) {
  const { matchId } = await params;
  if (!swipeSchema.shape.targetId.safeParse(matchId).success) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) redirect("/login");

  // Row level security: only a match the user is part of can be read here.
  const { data: match } = await supabase
    .from("matches")
    .select("id, user_a, user_b")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) notFound();
  const partnerId = match.user_a === userId ? match.user_b : match.user_a;

  const [profile, categories, skills] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", partnerId).single(),
    supabase
      .from("profile_categories")
      .select("categories(name, sort_order)")
      .eq("profile_id", partnerId),
    supabase.from("profile_skills").select("kind, skills(name)").eq("profile_id", partnerId),
  ]);
  if (profile.error || categories.error || skills.error) {
    console.error("match page failed:", profile.error?.code, categories.error?.code, skills.error?.code);
    throw new Error("Could not load this match.");
  }

  const photos = await signedPhotoLinks(
    supabase,
    profile.data.avatar_path ? [profile.data.avatar_path] : [],
  );
  const names = (rows: { name: string }[]) => rows.map((row) => row.name).sort();

  const person = profile.data;
  const card: FeedCard = {
    id: person.id,
    displayName: person.display_name ?? "Someone",
    avatarUrl: person.avatar_path ? (photos.get(person.avatar_path) ?? null) : null,
    country: person.country,
    city: person.city,
    district: person.district,
    workModes: person.work_modes ?? [],
    ideaStatuses: person.idea_statuses ?? [],
    pitch: person.pitch,
    weeklyHours: person.weekly_hours ?? [],
    partnerWeeklyHours: person.partner_weekly_hours ?? [],
    ambitions: person.ambitions ?? [],
    categories: categories.data
      .flatMap((row) => (row.categories ? [row.categories] : []))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((category) => category.name),
    offers: names(
      skills.data.flatMap((row) => (row.kind === "offers" && row.skills ? [row.skills] : [])),
    ),
    seeks: names(
      skills.data.flatMap((row) => (row.kind === "seeks" && row.skills ? [row.skills] : [])),
    ),
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-6">
      <header className="flex items-center justify-between">
        <Link href="/matches" className="text-sm underline">
          ← Matches
        </Link>
      </header>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <ProfileCard card={card} />
      </div>
      <p className="rounded-xl bg-zinc-100 p-4 text-center text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
        You both liked each other. Chat opens in the next step.
      </p>
    </main>
  );
}
