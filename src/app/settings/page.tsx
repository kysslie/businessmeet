import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { UnblockButton } from "@/components/unblock-button";
import { m } from "@/lib/messages";
import { signedPhotoLinks } from "@/lib/photo-links";
import { createClient } from "@/lib/supabase/server";

// Settings: the people you blocked, with a way to unblock, and account deletion.
export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  // proxy.ts already redirects logged-out visitors; this is a second lock on the door.
  if (!auth?.claims) redirect("/login");

  const { data: blocked, error } = await supabase.rpc("get_blocked_profiles");
  if (error) {
    console.error("get_blocked_profiles failed:", error.code, error.message);
    throw new Error(m.settings.loadFailed);
  }
  const photos = await signedPhotoLinks(
    supabase,
    blocked.flatMap((person) => (person.avatar_path ? [person.avatar_path] : [])),
  );

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <Link href="/profile" className="text-sm text-zinc-500 underline">
          {m.settings.back}
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{m.settings.title}</h1>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">{m.settings.blockedTitle}</h2>
        <p className="text-sm text-zinc-500">{m.settings.blockedHint}</p>
        {blocked.length === 0 ? (
          <p className="rounded-2xl border border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-800">
            {m.settings.blockedEmpty}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {blocked.map((person) => {
              const photo = person.avatar_path ? photos.get(person.avatar_path) : undefined;
              return (
                <li
                  key={person.id}
                  className="flex items-center gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span aria-hidden="true">🙂</span>
                    )}
                  </div>
                  <p className="min-w-0 flex-1 truncate font-medium">
                    {person.display_name ?? m.card.someone}
                  </p>
                  <UnblockButton targetId={person.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{m.settings.deleteAccount.title}</h2>
          <p className="mt-1 text-sm text-zinc-500">{m.settings.deleteAccount.intro}</p>
        </div>
        <DeleteAccountButton />
      </section>
    </main>
  );
}
