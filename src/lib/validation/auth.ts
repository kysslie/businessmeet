import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "That email address is too long.")
    .pipe(z.email("Enter a valid email address.")),
});

// What the emailed login link carries. `type` is limited to the values Supabase uses
// for email links, so nothing else can be passed through to verifyOtp.
export const confirmLoginSchema = z.object({
  token_hash: z.string().min(1).max(512),
  type: z.enum(["email", "magiclink", "signup"]),
});
