"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";

export type LoginState = {
  status: "idle" | "sent" | "error";
  message?: string;
  email?: string;
};

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
