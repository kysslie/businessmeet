import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

// Pages a logged-out visitor may open. Everything else needs a login.
const PUBLIC_PATHS = ["/", "/login", "/privacy"];
const PUBLIC_PREFIXES = ["/auth/"];

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

  if (!loggedIn && !isPublic(pathname)) {
    return redirectTo(request, "/login", response);
  }
  if (loggedIn && pathname === "/login") {
    return redirectTo(request, "/feed", response);
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
