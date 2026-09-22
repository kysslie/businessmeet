import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 calls this file "proxy" (it was "middleware" in older versions).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static files, images, and the PWA files; run on everything else. icon/apple-icon are
    // Next.js's generated-icon routes (F9): they have no file extension in the URL even though
    // they serve an image, so they need to be named here explicitly, the same as favicon.ico.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon$|apple-icon$|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
