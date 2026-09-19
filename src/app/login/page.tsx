import { AuthPanel } from "./auth-panel";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Log in or sign up</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Use your email and a password. New here? Choose &ldquo;Create account&rdquo;.
        </p>
      </div>
      {(error === "link" || error === "browser") && (
        <p
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          role="alert"
        >
          {error === "browser"
            ? "Please open the login link in the same browser you requested it in. Request a new link and open it there."
            : "That login link is invalid or has expired. Log in with your password, or request a new link."}
        </p>
      )}
      <AuthPanel />
    </main>
  );
}
