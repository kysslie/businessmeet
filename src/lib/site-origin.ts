import { headers } from "next/headers";

// The address this site is being served from (localhost while developing, the Vercel domain
// in production). Used for the login-link email and for building a portfolio's public link.
export async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
