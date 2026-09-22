import { countryName } from "@/lib/countries";
import { PROJECT_OUTCOMES } from "@/lib/project-options";
import { createClient } from "@/lib/supabase/server";

type PublicProfileRow = {
  display_name: string;
  country: string | null;
  city: string | null;
  open_to_partners: boolean;
  category_names: string[] | null;
};

type PublicProjectRow = { outcome: string };

export type ShareCardData = {
  displayName: string;
  place: string | null;
  categoryName: string | null;
  openToPartners: boolean;
  projectCount: number;
  outcomeCounts: { label: string; count: number }[];
};

// The same public functions the portfolio page itself uses (get_public_profile /
// get_public_projects), so a share image never shows more than a stranger could already see —
// a link-preview bot has no session, same as any other logged-out visitor. Used by the
// Open Graph image and both downloadable cards (P3b).
export async function loadShareCardData(slug: string): Promise<ShareCardData | null> {
  const supabase = await createClient();
  const [profile, projects] = await Promise.all([
    supabase.rpc("get_public_profile", { p_slug: slug }),
    supabase.rpc("get_public_projects", { p_slug: slug }),
  ]);
  if (profile.error || projects.error) return null;

  const person = (profile.data as PublicProfileRow[])[0];
  if (!person) return null;

  const rows = (projects.data as PublicProjectRow[]) ?? [];
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.outcome, (counts.get(row.outcome) ?? 0) + 1);
  const outcomeCounts = PROJECT_OUTCOMES.filter((option) => (counts.get(option.value) ?? 0) > 0).map(
    (option) => ({ label: option.label, count: counts.get(option.value) ?? 0 }),
  );

  return {
    displayName: person.display_name,
    place: [person.city, countryName(person.country)].filter(Boolean).join(", ") || null,
    categoryName: person.category_names?.[0] ?? null,
    openToPartners: person.open_to_partners,
    projectCount: rows.length,
    outcomeCounts,
  };
}
