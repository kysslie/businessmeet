"use server";

import { m } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { swipeSchema } from "@/lib/validation/swipe";

// `conversationId` is set when this like completed a mutual like (the database created a
// match and its conversation).
export type SwipeResult = { ok: true; conversationId?: string } | { ok: false; message: string };

// Records a like or pass on someone in the feed. A swipe can never be changed or
// undone, so the person never comes back to the feed. Matches are created by a database
// trigger in the same transaction as the second like; here we only look whether one exists.
export async function recordSwipe(targetId: string, direction: "like" | "pass"): Promise<SwipeResult> {
  const parsed = swipeSchema.safeParse({ targetId, direction });
  if (!parsed.success) return { ok: false, message: m.feed.errors.generic };
  const target = parsed.data.targetId;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { ok: false, message: m.feed.errors.loggedOut };

  const { error } = await supabase.from("swipes").insert({
    swiper_id: userId,
    target_id: target,
    direction: parsed.data.direction,
  });

  // 23505 = already swiped this person (e.g. a double tap). Nothing to do.
  if (error && error.code !== "23505") {
    console.error("recordSwipe failed:", error.code, error.message);
    return { ok: false, message: m.feed.errors.notSaved };
  }
  if (direction === "pass") return { ok: true };

  // Did this like complete a match? (Both ids are validated as ids above, so they are safe
  // to use in the filter.)
  const { data: match } = await supabase
    .from("matches")
    .select("conversation_id")
    .or(`and(user_a.eq.${userId},user_b.eq.${target}),and(user_a.eq.${target},user_b.eq.${userId})`)
    .maybeSingle();
  return { ok: true, conversationId: match?.conversation_id };
}
