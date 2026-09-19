"use server";

import { createClient } from "@/lib/supabase/server";
import { swipeSchema } from "@/lib/validation/swipe";

export type SwipeResult = { ok: true } | { ok: false; message: string };

// Records a like or pass on someone in the feed. A swipe can never be changed or
// undone, so the person never comes back to the feed. Mutual likes become matches
// in F5 (a database trigger), not here.
export async function recordSwipe(targetId: string, direction: "like" | "pass"): Promise<SwipeResult> {
  const parsed = swipeSchema.safeParse({ targetId, direction });
  if (!parsed.success) return { ok: false, message: "Something went wrong. Please try again." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { ok: false, message: "Please log in again." };

  const { error } = await supabase.from("swipes").insert({
    swiper_id: userId,
    target_id: parsed.data.targetId,
    direction: parsed.data.direction,
  });

  // 23505 = already swiped this person (e.g. a double tap). Nothing to do.
  if (error && error.code !== "23505") {
    console.error("recordSwipe failed:", error.code, error.message);
    return { ok: false, message: "We couldn't save that. Please try again." };
  }
  return { ok: true };
}
