import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { homePath, matchingEnabled } from "@/lib/feature-flags";
import type { Database } from "@/types/database";

// Pages a logged-out visitor may open. Everything else needs a login.
const PUBLIC_PATHS = ["/", "/login", "/privacy"];
const PUBLIC_PREFIXES = ["/auth/", "/p/"];

// Matching pages, parked since the 2026-09-22 pivot (see src/lib/feature-flags.ts). Nothing
// under these paths is reachable while the flag is off; a direct link sends the visitor home.
const MATCHING_PREFIXES = ["/feed", "/matches", "/journeys"];

function isMatchingPath(pathname: string) {
  return MATCHING_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// "Last seen" is written at most once an hour per person and browser: a short-lived cookie holds
// the id of the person it was last done for, so most requests make no database call at all (the
// database also refuses to update more than once an hour, see touch_last_seen()).
const SEEN_COOKIE = "bm_seen";
const SEEN_SECONDS = 60 * 60;

function isPrefetch(request: NextRequest) {
  return (
    request.headers.get("next-router-prefetch") === "1" ||
    request.headers.get("purpose") === "prefetch" ||
    request.headers.get("sec-purpose")?.includes("prefetch") === true
  );
}

function isPublic(pathname: string) {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

// Runs on every page request (see src/proxy.ts):
//  1. refreshes the login session if it is about to expire
//  2. sends logged-out visitors to /login
//  3. sends logged-in visitors away from /login
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // getClaims() checks the session token's signature. Never trust getSession() here.
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);
  const { pathname } = request.nextUrl;

  // Opening the app counts as being seen (never blocks the page if it fails).
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  let markSeen = false;
  if (userId && !isPrefetch(request) && request.cookies.get(SEEN_COOKIE)?.value !== userId) {
    const { error } = await supabase.rpc("touch_last_seen");
    if (error) console.error("touch_last_seen failed:", error.code);
    else markSeen = true;
  }

  if (!loggedIn && !isPublic(pathname)) {
    return redirectTo(request, "/login", response);
  }
  if (loggedIn && pathname === "/login") {
    return redirectTo(request, homePath, response);
  }
  if (loggedIn && !matchingEnabled && isMatchingPath(pathname)) {
    return redirectTo(request, homePath, response);
  }

  if (markSeen) {
    response.cookies.set(SEEN_COOKIE, userId ?? "", {
      maxAge: SEEN_SECONDS,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
  }

  // Must return the response that setAll last built, or refreshed cookies are lost.
  return response;
}

function redirectTo(request: NextRequest, path: string, from: NextResponse) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  const redirect = NextResponse.redirect(url);
  // Carry over any refreshed session cookies and no-cache headers.
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  from.headers.forEach((value, key) => {
    if (key.toLowerCase() === "cache-control" || key.toLowerCase() === "pragma" || key.toLowerCase() === "expires") {
      redirect.headers.set(key, value);
    }
  });
  return redirect;
}
