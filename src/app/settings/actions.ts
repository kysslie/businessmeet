"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { m } from "@/lib/messages";
import { adminDeleteUser } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DeleteAccountState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
};

const deleteAccountSchema = z.object({
  password: z.string().min(1, m.validation.currentPasswordRequired).max(72),
});

// Permanently deletes the logged-in person's account: everything of theirs (profile, projects,
// swipes, matches, messages, blocks, reports) goes with it via ON DELETE CASCADE, plus their
// Storage photos, which Postgres cascades never touch. The current password is checked first,
// the same way changing a password already does, since this cannot be undone.
export async function deleteAccount(
  _previous: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const parsed = deleteAccountSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { status: "error", fieldErrors: { password: parsed.error.issues[0].message } };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  const email = typeof auth?.claims?.email === "string" ? auth.claims.email : null;
  if (!userId || !email) redirect("/login");

  const check = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
  if (check.error) {
    if (check.error.status === 429) {
      return { status: "error", message: m.password.tooManyAttempts };
    }
    return { status: "error", fieldErrors: { password: m.password.wrongCurrent } };
  }

  // Best-effort: an orphaned photo file is a cleanup annoyance, not a reason to refuse
  // someone's right to erasure. The account is deleted below either way.
  const { data: files } = await supabase.storage.from("avatars").list(userId);
  if (files && files.length > 0) {
    const { error } = await supabase.storage
      .from("avatars")
      .remove(files.map((file) => `${userId}/${file.name}`));
    if (error) console.error("deleteAccount: could not remove avatar files:", error.message);
  }

  const result = await adminDeleteUser(userId);
  if (!result.ok) {
    console.error("deleteAccount: adminDeleteUser failed:", result.status, result.message);
    return { status: "error", message: m.settings.deleteAccount.failed };
  }

  await supabase.auth.signOut().catch(() => {});
  redirect("/?deleted=1");
}
