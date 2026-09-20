"use client";

import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "@/app/profile/actions";
import { m } from "@/lib/messages";

const initialState: ChangePasswordState = { status: "idle" };

const inputClass =
  "h-12 w-full rounded-xl border border-zinc-300 bg-transparent px-4 text-base outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";

function Field({
  id,
  label,
  autoComplete,
  error,
  hint,
}: {
  id: string;
  label: string;
  autoComplete: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="password"
        autoComplete={autoComplete}
        required
        className={inputClass}
      />
      {hint && <p className="text-sm text-zinc-500">{hint}</p>}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        id="current_password"
        label={m.password.current}
        autoComplete="current-password"
        error={errors.current_password}
      />
      <Field
        id="new_password"
        label={m.password.new}
        autoComplete="new-password"
        hint={m.login.passwordHint}
        error={errors.new_password}
      />
      <Field
        id="confirm_password"
        label={m.password.confirm}
        autoComplete="new-password"
        error={errors.confirm_password}
      />
      {state.status === "error" && state.message && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {state.message}
        </p>
      )}
      {state.status === "done" && (
        <p
          className="rounded-xl bg-green-50 p-4 text-sm text-green-800 dark:bg-green-950 dark:text-green-300"
          role="status"
        >
          {m.password.done}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-12 rounded-xl border border-zinc-300 px-5 text-base font-medium disabled:opacity-60 dark:border-zinc-700"
      >
        {pending ? m.password.submitBusy : m.password.submit}
      </button>
    </form>
  );
}
