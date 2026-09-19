import { z } from "zod";

export const swipeSchema = z.object({
  // guid = any correctly shaped id; the database checks that the person really exists.
  targetId: z.guid(),
  direction: z.enum(["like", "pass"]),
});
