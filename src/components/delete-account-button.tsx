"use client";

import { useActionState, useState } from "react";
import { deleteAccount, type DeleteAccountState } from "@/app/settings/actions";
import { m } from "@/lib/messages";

const initialState: DeleteAccountState = { status: "idle" };

// "Supprimer mon compte": asks first, then requires the current password before doing
// anything irreversible. On success the server action itself redirects away.
export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(deleteAccount, initialState);
  const error = state.status === "error" ? (state.fieldErrors?.password ?? state.message) : undefined;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-red-600 underline dark:text-red-400">
        {m.settings.deleteAccount.open}
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-red-200 p-4 dark:border-red-900"
      role="alertdialog"
    >
      <p className="text-sm">{m.settings.deleteAccount.ask}</p>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {m.settings.deleteAccount.passwordLabel}
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className="h-11 rounded-xl border border-zinc-300 bg-transparent px-3 text-base font-normal outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
        />
      </label>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="h-11 flex-1 rounded-xl bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? m.settings.deleteAccount.confirmBusy : m.settings.deleteAccount.confirm}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="h-11 flex-1 rounded-xl border border-zinc-300 px-4 text-sm font-medium dark:border-zinc-700"
        >
          {m.settings.deleteAccount.cancel}
        </button>
      </div>
    </form>
  );
}
