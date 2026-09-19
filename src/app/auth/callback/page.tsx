import { redirect } from "next/navigation";
import { confirmLogin } from "../actions";
import { confirmLoginSchema } from "@/lib/validation/auth";

// The page the emailed login link opens. The login only happens when the person
// presses the button, so mail scanners that open every link can't use the link up.
export default async function AuthCallbackPage({ searchParams }: PageProps<"/auth/callback">) {
  const params = await searchParams;
  const parsed = confirmLoginSchema.safeParse({
    token_hash: params.token_hash,
    type: params.type,
  });
  if (!parsed.success) redirect("/login?error=link");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Almost there</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Press the button to finish logging in to BusinessMeet.
        </p>
      </div>
      <form action={confirmLogin} className="flex flex-col gap-3">
        <input type="hidden" name="token_hash" value={parsed.data.token_hash} />
        <input type="hidden" name="type" value={parsed.data.type} />
        <button
          type="submit"
          className="h-12 rounded-xl bg-foreground px-5 text-base font-medium text-background"
        >
          Log in
        </button>
      </form>
    </main>
  );
}
