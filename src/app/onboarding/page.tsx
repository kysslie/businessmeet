import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { loadProfileForm } from "@/lib/profile-data";

export default async function OnboardingPage() {
  const data = await loadProfileForm();
  if (!data) redirect("/login");
  if (data.profile.onboarded) redirect("/profile");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Set up your profile</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          This is what other people see when you show up in their feed. It takes about two
          minutes.
        </p>
      </div>
      <ProfileForm mode="onboarding" data={data} />
    </main>
  );
}
