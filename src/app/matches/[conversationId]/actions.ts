"use server";

import { m } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { idSchema, messageSchema } from "@/lib/validation/message";

export type ChatMessage = { id: number; sender_id: string; body: string; created_at: string };

export type SendResult = { ok: true; message: ChatMessage } | { ok: false; message: string };

// Sends a message. Row level security decides whether the person may write here: they must be a
// current participant and the conversation must not be archived.
export async function sendMessage(conversationId: string, body: string): Promise<SendResult> {
  const parsed = messageSchema.safeParse({ conversationId, body });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { ok: false, message: m.feed.errors.loggedOut };

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: parsed.data.conversationId,
      sender_id: userId,
      body: parsed.data.body,
    })
    .select("id, sender_id, body, created_at")
    .single();

  if (error || !data) {
    console.error("sendMessage failed:", error?.code, error?.message);
    return { ok: false, message: m.chat.sendFailed };
  }
  return { ok: true, message: data };
}

// Ends a match: it is kept but marked unmatched, and the conversation is archived (read-only
// for both people). Nothing is deleted. The database function checks the person is in the match.
export async function unmatchAction(matchId: string): Promise<{ ok: boolean; message?: string }> {
  if (!idSchema.safeParse(matchId).success) return { ok: false, message: m.chat.unmatchFailed };

  const supabase = await createClient();
  const { error } = await supabase.rpc("unmatch", { p_match_id: matchId });
  if (error) {
    console.error("unmatch failed:", error.code, error.message);
    return { ok: false, message: m.chat.unmatchFailed };
  }
  return { ok: true };
}
