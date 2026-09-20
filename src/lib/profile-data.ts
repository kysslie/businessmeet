import { m } from "@/lib/messages";
import { PROFILE_COLUMNS } from "@/lib/profile-columns";
import { createClient } from "@/lib/supabase/server";

// How long a photo link stays valid. Links are made fresh on every page load.
const AVATAR_LINK_SECONDS = 60 * 60;

// Everything the profile form needs about the logged-in user and the available choices.
// Returns null when nobody is logged in.
export async function loadProfileForm() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return null;

  const [profile, postalCode, categories, skills, ownCategories, ownSkills] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).single(),
    supabase.rpc("get_my_postal_code"),
    supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("skills").select("id, name, category_id").eq("is_active", true).order("name"),
    supabase.from("profile_categories").select("category_id").eq("profile_id", userId),
    supabase.from("profile_skills").select("skill_id, kind").eq("profile_id", userId),
  ]);

  if (profile.error || postalCode.error || categories.error || skills.error || ownCategories.error || ownSkills.error) {
    console.error(
      "loadProfileForm failed:",
      profile.error?.code,
      postalCode.error?.code,
      categories.error?.code,
      skills.error?.code,
      ownCategories.error?.code,
      ownSkills.error?.code,
    );
    throw new Error(m.profile.errors.loadFailed);
  }

  const activeCategories = categories.data;
  const activeIds = new Set(activeCategories.map((category) => category.id));
  let categoryIds = ownCategories.data
    .map((row) => row.category_id)
    .filter((id) => activeIds.has(id));
  // While only one category is open (video games at launch) it is chosen for everyone.
  if (categoryIds.length === 0 && activeCategories.length === 1) {
    categoryIds = [activeCategories[0].id];
  }

  // Universal skills first, then category skills, each alphabetical.
  const sortedSkills = [...skills.data].sort((a, b) => {
    if ((a.category_id === null) !== (b.category_id === null)) return a.category_id === null ? -1 : 1;
    return a.name.localeCompare(b.name, m.locale);
  });

  let avatarUrl: string | null = null;
  if (profile.data.avatar_path) {
    const { data } = await supabase.storage
      .from("avatars")
      .createSignedUrl(profile.data.avatar_path, AVATAR_LINK_SECONDS);
    avatarUrl = data?.signedUrl ?? null;
  }

  return {
    profile: profile.data,
    postalCode: postalCode.data ?? "",
    email: typeof auth.claims.email === "string" ? auth.claims.email : null,
    categories: activeCategories,
    skills: sortedSkills,
    categoryIds,
    offers: ownSkills.data.filter((row) => row.kind === "offers").map((row) => row.skill_id),
    seeks: ownSkills.data.filter((row) => row.kind === "seeks").map((row) => row.skill_id),
    avatarUrl,
  };
}

export type ProfileFormData = NonNullable<Awaited<ReturnType<typeof loadProfileForm>>>;
