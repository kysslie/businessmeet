import { m } from "@/lib/messages";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PortfolioSettings = {
  slug: string | null;
  openToPartners: boolean;
  searchIndexable: boolean;
  pageViews: number;
  sharePromptShown: boolean;
};

// The logged-in person's own portfolio settings: their permanent link, the two toggles, and
// their view count. Not part of the shared profile-columns list (see src/lib/profile-columns.ts)
// since nobody else needs to read these.
export async function loadPortfolioSettings(supabase: Supabase, userId: string): Promise<PortfolioSettings> {
  const { data, error } = await supabase
    .from("profiles")
    .select("slug, open_to_partners, search_indexable, page_views, share_prompt_shown")
    .eq("id", userId)
    .single();
  if (error) throw new Error(m.portfolio.loadFailed);

  return {
    slug: data.slug,
    openToPartners: data.open_to_partners,
    searchIndexable: data.search_indexable,
    pageViews: data.page_views,
    sharePromptShown: data.share_prompt_shown,
  };
}
