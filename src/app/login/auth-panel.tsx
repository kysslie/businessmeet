"use client";

import { useState } from "react";
import { MagicLinkForm } from "./login-form";
import { PasswordForm } from "./password-form";

type Mode = "login" | "signup" | "link";

const tabClass = (active: boolean) =>
  `flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
    active ? "bg-foreground text-background" : "text-zinc-600 dark:text-zinc-400"
  }`;

// The login screen: email + password (log in or create an account), with an email link
// as the way back in for someone who forgot their password.
export function AuthPanel() {
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="flex flex-col gap-6">
      {mode !== "link" && (
        <div
          className="flex gap-1 rounded-xl border border-zinc-200 p-1 dark:border-zinc-800"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            onClick={() => setMode("login")}
            className={tabClass(mode === "login")}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            onClick={() => setMode("signup")}
            className={tabClass(mode === "signup")}
          >
            Create account
          </button>
        </div>
      )}

      {mode === "link" ? (
        <>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Forgot your password? We&apos;ll email you a link that logs you in. You can change
            your password afterwards on your profile page.
          </p>
          <MagicLinkForm />
        </>
      ) : (
        // key: switching tabs starts a clean form (no leftover errors)
        <PasswordForm key={mode} mode={mode} />
      )}

      <button
        type="button"
        onClick={() => setMode(mode === "link" ? "login" : "link")}
        className="text-sm text-zinc-500 underline"
      >
        {mode === "link" ? "← Back to password login" : "Forgot your password? Email me a login link"}
      </button>
    </div>
  );
}
