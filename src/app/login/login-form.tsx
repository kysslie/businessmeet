"use client";

import { useActionState } from "react";
import { requestLoginLink, type LoginState } from "./actions";

const initialState: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(requestLoginLink, initialState);

  if (state.status === "sent") {
    return (
      <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800" role="status">
        <p className="font-medium">Check your email</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          We sent a login link to <strong>{state.email}</strong>. Open it on this device to
          log in. The link works once and expires after an hour.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium">
        Email address
      </label>
      <input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        defaultValue={state.email}
        placeholder="you@example.com"
        className="h-12 rounded-xl border border-zinc-300 bg-transparent px-4 text-base outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
      />
      {state.status === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-foreground px-5 text-base font-medium text-background disabled:opacity-60"
      >
        {pending ? "Sending…" : "Email me a login link"}
      </button>
    </form>
  );
}
