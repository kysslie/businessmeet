"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, passwordLoginSchema, signUpSchema } from "@/lib/validation/auth";

export type LoginState = {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
};

export type PasswordFormState = {
  status: "idle" | "error" | "confirm";
  message?: string;
  fieldErrors?: Record<string, string>;
  email?: string;
};

const TOO_MANY_ATTEMPTS = "Too many attempts. Please wait a few minutes and try again.";

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[String(issue.path[0])] ??= issue.message;
  return fieldErrors;
}

// Log in with email + password.
export async function signInWithPassword(
  _previous: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const parsed = passwordLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }
  const { email, password } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error("signInWithPassword failed:", error.status, error.code);
    if (error.status === 429) return { status: "error", email, message: TOO_MANY_ATTEMPTS };
    if (error.code === "email_not_confirmed") {
      return {
        status: "error",
        email,
        message: "Please confirm your email address first (check your inbox), then log in.",
      };
    }
    // Same message for a wrong password and an unknown email, so nobody can probe for accounts.
    return { status: "error", email, message: "Email or password is incorrect." };
  }

  redirect("/feed");
}

// Create an account with email + password. If the project requires email confirmation
// (Supabase "Confirm email" setting) no session comes back and we ask them to check their
// inbox; if it is off, they are logged in straight away.
export async function signUpWithPassword(
  _previous: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error.issues) };
  }
  const { email, password } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error) {
    console.error("signUp failed:", error.status, error.code);
    if (error.code === "user_already_exists") {
      return { status: "error", email, message: "An account with this email already exists. Log in instead." };
    }
    if (error.code === "weak_password") {
      return { status: "error", email, fieldErrors: { password: "That password is too easy to guess. Try a longer one." } };
    }
    if (error.status === 429) return { status: "error", email, message: TOO_MANY_ATTEMPTS };
    return { status: "error", email, message: "We couldn't create your account. Please try again." };
  }

  if (data.session) redirect("/feed");
  return { status: "confirm", email };
}

// The address this site is being served from, so the emailed link comes back to the
// same place (localhost while developing, the Vercel domain in production).
// Supabase only accepts addresses on its Redirect URLs allow-list.
async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto =
    h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function requestLoginLink(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0].message };
  }
  const { email } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // Signing up and logging in are the same step: unknown emails get an account.
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });

  if (error) {
    console.error("signInWithOtp failed:", error.status, error.code);
    if (error.status === 429) {
      return {
        status: "error",
        email,
        message: "Too many login emails were requested. Please wait a few minutes and try again.",
      };
    }
    return { status: "error", email, message: "We couldn't send the email. Please try again." };
  }

  return { status: "sent", email };
}
