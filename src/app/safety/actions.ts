"use server";

import { revalidatePath } from "next/cache";
import { m } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { reportSchema, targetSchema } from "@/lib/validation/safety";

export type SafetyResult = { ok: true } | { ok: false; message: string };

async function currentUserId() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  return { supabase, userId: auth?.claims?.sub ?? null };
}

// Blocks a person. The database then ends any match with them and archives the conversation
// (trigger on blocks); the feed, chat and profile rules already hide them both ways. The blocked
// person is never told.
export async function blockUser(targetId: string): Promise<SafetyResult> {
  if (!targetSchema.safeParse(targetId).success) return { ok: false, message: m.safety.errors.blockFailed };
  const { supabase, userId } = await currentUserId();
  if (!userId) return { ok: false, message: m.feed.errors.loggedOut };

  const { error } = await supabase.from("blocks").insert({ blocker_id: userId, blocked_id: targetId });
  // 23505 = already blocked (e.g. a double tap): nothing to do.
  if (error && error.code !== "23505") {
    console.error("blockUser failed:", error.code, error.message);
    return { ok: false, message: m.safety.errors.blockFailed };
  }
  revalidatePath("/matches");
  revalidatePath("/settings");
  return { ok: true };
}

// Removes a block. A match that was ended by the block does not come back.
export async function unblockUser(targetId: string): Promise<SafetyResult> {
  if (!targetSchema.safeParse(targetId).success) return { ok: false, message: m.safety.errors.unblockFailed };
  const { supabase, userId } = await currentUserId();
  if (!userId) return { ok: false, message: m.feed.errors.loggedOut };

  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_id", userId)
    .eq("blocked_id", targetId);
  if (error) {
    console.error("unblockUser failed:", error.code, error.message);
    return { ok: false, message: m.safety.errors.unblockFailed };
  }
  revalidatePath("/settings");
  return { ok: true };
}

// Stores a report. Reports can only be read by the site owner (admin_reports in the SQL editor).
export async function reportUser(targetId: string, reason: string, details: string): Promise<SafetyResult> {
  const parsed = reportSchema.safeParse({ targetId, reason, details });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { supabase, userId } = await currentUserId();
  if (!userId) return { ok: false, message: m.feed.errors.loggedOut };

  const { error } = await supabase.from("reports").insert({
    reporter_id: userId,
    reported_id: parsed.data.targetId,
    reason: parsed.data.reason,
    details: parsed.data.details === "" ? null : parsed.data.details,
  });
  if (error) {
    console.error("reportUser failed:", error.code, error.message);
    return { ok: false, message: m.safety.errors.reportFailed };
  }
  return { ok: true };
}
