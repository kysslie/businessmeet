"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { confirmLoginSchema } from "@/lib/validation/auth";

// Called when someone presses "Log in" on the page the emailed link opens.
export async function confirmLogin(formData: FormData) {
  const parsed = confirmLoginSchema.safeParse({
    token_hash: formData.get("token_hash"),
    type: formData.get("type"),
  });
  if (!parsed.success) redirect("/login?error=link");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp(parsed.data);
  if (error) {
    console.error("verifyOtp failed:", error.status, error.code);
    redirect("/login?error=link");
  }

  redirect("/feed");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
