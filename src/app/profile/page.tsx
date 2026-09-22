import Link from "next/link";
import { redirect } from "next/navigation";
import { ChangePasswordForm } from "@/components/change-password-form";
import { ProfileForm } from "@/components/profile-form";
import { ProjectList } from "@/components/project-list";
import { matchingEnabled } from "@/lib/feature-flags";
import { m } from "@/lib/messages";
import { loadProfileForm } from "@/lib/profile-data";
import { loadMyProjects } from "@/lib/projects";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const data = await loadProfileForm();
  if (!data) redirect("/login");
  if (!data.profile.onboarded) redirect("/onboarding");
  const { saved } = await searchParams;

  const supabase = await createClient();
  const projects = await loadMyProjects(supabase, data.profile.id);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <div>
        {matchingEnabled && (
          <Link href="/feed" className="text-sm text-zinc-500 underline">
            {m.common.back}
          </Link>
        )}
        <h1 className={matchingEnabled ? "mt-4 text-3xl font-semibold tracking-tight" : "text-3xl font-semibold tracking-tight"}>
          {m.profile.title}
        </h1>
        <Link href="/settings" className="mt-2 inline-block text-sm underline">
          {m.settings.link}
        </Link>
        {data.email && <p className="mt-1 text-sm text-zinc-500">{m.profile.loggedInAs(data.email)}</p>}
      </div>
      {saved && (
        <p
          className="rounded-xl bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-300"
          role="status"
        >
          {m.profile.saved}
        </p>
      )}
      <div className="border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <ProjectList projects={projects} categories={data.categories} />
      </div>
      <ProfileForm mode="edit" data={data} />
      <section className="flex flex-col gap-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-xl font-semibold tracking-tight">{m.password.title}</h2>
        <ChangePasswordForm />
      </section>
    </main>
  );
}
