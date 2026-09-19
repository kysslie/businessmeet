import Link from "next/link";
import { redirect } from "next/navigation";
import { countryName } from "@/lib/countries";
import { IDEA_STATUSES, labelsFor } from "@/lib/profile-options";
import { signedPhotoLinks } from "@/lib/photo-links";
import { createClient } from "@/lib/supabase/server";

export default async function MatchesPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  // proxy.ts already redirects logged-out visitors; this is a second lock on the door.
  if (!userId) redirect("/login");

  // Row level security means this returns only matches the user is part of.
  const { data: matches, error } = await supabase
    .from("matches")
    .select("id, created_at, user_a, user_b")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("matches list failed:", error.code, error.message);
    throw new Error("Could not load your matches.");
  }

  const partnerIds = matches.map((match) => (match.user_a === userId ? match.user_b : match.user_a));
  const { data: partners } =
    partnerIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, display_name, avatar_path, country, city, idea_statuses")
          .in("id", partnerIds)
      : { data: [] };
  const byId = new Map((partners ?? []).map((partner) => [partner.id, partner]));
  const photos = await signedPhotoLinks(
    supabase,
    (partners ?? []).flatMap((partner) => (partner.avatar_path ? [partner.avatar_path] : [])),
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Matches</h1>
        <Link href="/feed" className="text-sm underline">
          Back to swiping
        </Link>
      </header>

      {matches.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 p-8 text-center dark:border-zinc-800">
          <p className="text-lg font-medium">No matches yet</p>
          <p className="mt-2 text-sm text-zinc-500">
            When someone you like also likes you, they show up here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {matches.map((match) => {
            const partnerId = match.user_a === userId ? match.user_b : match.user_a;
            const partner = byId.get(partnerId);
            const photo = partner?.avatar_path ? photos.get(partner.avatar_path) : undefined;
            const place = [partner?.city, countryName(partner?.country ?? null)]
              .filter(Boolean)
              .join(", ");
            return (
              <li key={match.id}>
                <Link
                  href={`/matches/${match.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-2xl dark:bg-zinc-800">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span aria-hidden="true">🙂</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{partner?.display_name ?? "Someone"}</p>
                    {place && <p className="truncate text-sm text-zinc-500">{place}</p>}
                    <p className="truncate text-sm text-zinc-500">
                      {labelsFor(IDEA_STATUSES, partner?.idea_statuses ?? []).join(" · ")}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
