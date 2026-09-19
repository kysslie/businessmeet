import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."));

// 72 is the most bytes the password scheme (bcrypt) looks at, so longer would be silently cut.
const newPassword = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.");

export const loginSchema = z.object({ email });

export const passwordLoginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password.").max(72),
});

export const signUpSchema = z.object({ email, password: newPassword });

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, "Enter your current password.").max(72),
    new_password: newPassword,
    confirm_password: z.string(),
  })
  .refine((values) => values.new_password === values.confirm_password, {
    path: ["confirm_password"],
    message: "The two new passwords don't match.",
  })
  .refine((values) => values.new_password !== values.current_password, {
    path: ["new_password"],
    message: "Choose a password different from the current one.",
  });

// What the emailed login link carries (used only by the email-link fallback). `type` is
// limited to the values Supabase uses for email links, so nothing else can be passed
// through to verifyOtp.
export const confirmLoginSchema = z.object({
  token_hash: z.string().min(1).max(512),
  type: z.enum(["email", "magiclink", "signup"]),
});
