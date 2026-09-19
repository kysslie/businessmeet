import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Log in or sign up</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          No password needed. We email you a link that logs you in. New here? The same step
          creates your account.
        </p>
      </div>
      {error === "link" && (
        <p
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          role="alert"
        >
          That login link is invalid or has expired. Request a new one below.
        </p>
      )}
      <LoginForm />
    </main>
  );
}
