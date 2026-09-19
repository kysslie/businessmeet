import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { loadProfileForm } from "@/lib/profile-data";

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const data = await loadProfileForm();
  if (!data) redirect("/login");
  if (!data.profile.onboarded) redirect("/onboarding");
  const { saved } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <Link href="/feed" className="text-sm text-zinc-500 underline">
          ← Back
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Your profile</h1>
        {data.email && <p className="mt-1 text-sm text-zinc-500">Logged in as {data.email}</p>}
      </div>
      {saved && (
        <p
          className="rounded-xl bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-300"
          role="status"
        >
          Saved.
        </p>
      )}
      <ProfileForm mode="edit" data={data} />
    </main>
  );
}
