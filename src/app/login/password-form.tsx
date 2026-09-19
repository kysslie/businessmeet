"use client";

import { useActionState, useState } from "react";
import {
  signInWithPassword,
  signUpWithPassword,
  type PasswordFormState,
} from "./actions";

const initialState: PasswordFormState = { status: "idle" };

const inputClass =
  "h-12 w-full rounded-xl border border-zinc-300 bg-transparent px-4 text-base outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";

// Log in or create an account with email + password. `mode` decides which.
export function PasswordForm({ mode }: { mode: "login" | "signup" }) {
  const [state, formAction, pending] = useActionState(
    mode === "login" ? signInWithPassword : signUpWithPassword,
    initialState,
  );
  const [showPassword, setShowPassword] = useState(false);
  const errors = state.fieldErrors ?? {};

  if (state.status === "confirm") {
    return (
      <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800" role="status">
        <p className="font-medium">Check your email</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          We sent a confirmation link to <strong>{state.email}</strong>. Open it in this same
          browser to finish creating your account, then log in.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
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
          className={inputClass}
        />
        {errors.email && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {errors.email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "signup" ? 8 : undefined}
          className={inputClass}
        />
        {mode === "signup" && (
          <p className="text-sm text-zinc-500">At least 8 characters.</p>
        )}
        {errors.password && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {errors.password}
          </p>
        )}
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
          />
          Show password
        </label>
      </div>

      {state.status === "error" && state.message && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl bg-foreground px-5 text-base font-medium text-background disabled:opacity-60"
      >
        {pending
          ? mode === "login"
            ? "Logging in…"
            : "Creating account…"
          : mode === "login"
            ? "Log in"
            : "Create account"}
      </button>
    </form>
  );
}
