import { z } from "zod";
import { m } from "@/lib/messages";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, m.validation.emailTooLong)
  .pipe(z.email(m.validation.emailInvalid));

// 72 is the most bytes the password scheme (bcrypt) looks at, so longer would be silently cut.
const newPassword = z
  .string()
  .min(8, m.validation.passwordMin)
  .max(72, m.validation.passwordMax);

export const loginSchema = z.object({ email });

export const passwordLoginSchema = z.object({
  email,
  password: z.string().min(1, m.validation.passwordRequired).max(72),
});

export const signUpSchema = z.object({ email, password: newPassword });

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, m.validation.currentPasswordRequired).max(72),
    new_password: newPassword,
    confirm_password: z.string(),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    path: ["confirm_password"],
    message: m.validation.passwordsDiffer,
  })
  .refine((values) => values.new_password !== values.current_password, {
    path: ["new_password"],
    message: m.validation.passwordUnchanged,
  });

// What the emailed login link carries (used only by the email-link fallback). `type` is
// limited to the values Supabase uses for email links, so nothing else can be passed
// through to verifyOtp.
export const confirmLoginSchema = z.object({
  token_hash: z.string().min(1).max(512),
  type: z.enum(["email", "magiclink", "signup"]),
});
