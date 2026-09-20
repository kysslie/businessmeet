import { z } from "zod";
import { m } from "@/lib/messages";
import { MESSAGE_MAX_LENGTH } from "@/lib/profile-options";

// A chat message. Empty or too-long messages are refused here and again by the database.
export const messageSchema = z.object({
  // guid = any correctly shaped id; row level security checks the person may write there.
  conversationId: z.guid(),
  body: z
    .string()
    .trim()
    .min(1, m.validation.messageEmpty)
    .max(MESSAGE_MAX_LENGTH, m.validation.messageTooLong(MESSAGE_MAX_LENGTH)),
});

export const idSchema = z.guid();
