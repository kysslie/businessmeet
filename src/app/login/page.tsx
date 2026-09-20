import { m } from "@/lib/messages";
import { AuthPanel } from "./auth-panel";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{m.login.title}</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{m.login.subtitle}</p>
      </div>
      {(error === "link" || error === "browser") && (
        <p
          className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
          role="alert"
        >
          {error === "browser" ? m.login.linkOtherBrowser : m.login.linkInvalid}
        </p>
      )}
      <AuthPanel />
    </main>
  );
}
