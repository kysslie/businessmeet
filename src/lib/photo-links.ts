import type { createClient } from "@/lib/supabase/server";

// How long a photo link stays valid. Links are made fresh on every page load.
const PHOTO_LINK_SECONDS = 60 * 60;

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Temporary links for a batch of profile photos: Map of stored path -> link.
// Photos live in a private bucket, so every photo needs a link like this to be shown.
export async function signedPhotoLinks(supabase: Supabase, paths: string[]) {
  const links = new Map<string, string>();
  if (paths.length === 0) return links;
  const { data } = await supabase.storage.from("avatars").createSignedUrls(paths, PHOTO_LINK_SECONDS);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) links.set(item.path, item.signedUrl);
  }
  return links;
}
