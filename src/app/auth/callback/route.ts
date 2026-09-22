import { NextResponse, type NextRequest } from "next/server";
import { isAuthPKCECodeVerifierMissingError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { confirmLoginSchema } from "@/lib/validation/auth";
import { homePath } from "@/lib/feature-flags";

// Where the emailed login link lands. Supabase's standard link sends people here with
// a one-time `code`; we swap it for a logged-in session (stored in cookies).
// If custom email templates are ever enabled, links can carry `token_hash` instead,
// which is handled below as well.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const supabase = await createClient();

  let failure: "link" | "browser" | null = "link";

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      failure = null;
    } else {
      console.error("exchangeCodeForSession failed:", error.status, error.code);
      // The code only works in the browser that asked for the link.
      if (isAuthPKCECodeVerifierMissingError(error)) failure = "browser";
    }
  } else {
    const parsed = confirmLoginSchema.safeParse({
      token_hash: searchParams.get("token_hash"),
      type: searchParams.get("type"),
    });
    if (parsed.success) {
      const { error } = await supabase.auth.verifyOtp(parsed.data);
      if (!error) failure = null;
      else console.error("verifyOtp failed:", error.status, error.code);
    } else if (searchParams.get("error")) {
      // Supabase itself rejected the link (expired, already used, ...).
      console.error("login link rejected:", searchParams.get("error_code"));
    }
  }

  const target = failure ? `/login?error=${failure}` : homePath;
  return NextResponse.redirect(new URL(target, request.url));
}
