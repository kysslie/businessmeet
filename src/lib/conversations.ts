import type { FeedCard } from "@/components/profile-card";
import { m } from "@/lib/messages";
import { signedPhotoLinks } from "@/lib/photo-links";
import { PROFILE_COLUMNS } from "@/lib/profile-columns";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// One conversation as the matches list shows it.
export type ConversationSummary = {
  id: string;
  archived: boolean;
  createdAt: string;
  partner: { id: string; name: string; avatarUrl: string | null } | null; // null = deleted account
};

// All the logged-in person's direct conversations (row level security already limits this to
// conversations they may read; a blocked pair is hidden from both). The other person is null
// when they deleted their account, and the app then shows "Utilisateur supprimé".
export async function loadConversations(supabase: Supabase, userId: string) {
  const { data: mine, error } = await supabase
    .from("conversation_participants")
    .select("conversation_id, conversations(id, type, archived_at, created_at)")
    .eq("user_id", userId);
  if (error) throw new Error(m.matches.loadFailed);

  const conversations = mine.flatMap((row) =>
    row.conversations && row.conversations.type === "direct" ? [row.conversations] : [],
  );
  if (conversations.length === 0) return [] as ConversationSummary[];

  const ids = conversations.map((conversation) => conversation.id);
  const { data: everyone } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id")
    .in("conversation_id", ids)
    .neq("user_id", userId);
  const partnerOf = new Map((everyone ?? []).map((row) => [row.conversation_id, row.user_id]));

  const partnerIds = [...new Set(partnerOf.values())];
  const { data: profiles } =
    partnerIds.length > 0
      ? await supabase.from("profiles").select("id, display_name, avatar_path").in("id", partnerIds)
      : { data: [] };
  const byId = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const photos = await signedPhotoLinks(
    supabase,
    (profiles ?? []).flatMap((profile) => (profile.avatar_path ? [profile.avatar_path] : [])),
  );

  return conversations
    .map((conversation): ConversationSummary => {
      const partnerId = partnerOf.get(conversation.id);
      const profile = partnerId ? byId.get(partnerId) : undefined;
      return {
        id: conversation.id,
        archived: conversation.archived_at !== null,
        createdAt: conversation.created_at,
        partner: profile
          ? {
              id: profile.id,
              name: profile.display_name ?? m.card.someone,
              avatarUrl: profile.avatar_path ? (photos.get(profile.avatar_path) ?? null) : null,
            }
          : null,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// The full profile of the other person in a conversation, as a card. Null if they cannot be
// read (deleted account, or a block).
export async function loadPartnerCard(supabase: Supabase, partnerId: string): Promise<FeedCard | null> {
  const [profile, categories, skills] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", partnerId).maybeSingle(),
    supabase.from("profile_categories").select("categories(name, sort_order)").eq("profile_id", partnerId),
    supabase.from("profile_skills").select("kind, skills(name)").eq("profile_id", partnerId),
  ]);
  if (!profile.data || categories.error || skills.error) return null;

  const person = profile.data;
  const photos = await signedPhotoLinks(supabase, person.avatar_path ? [person.avatar_path] : []);
  const names = (rows: { name: string }[]) => rows.map((row) => row.name).sort((a, b) => a.localeCompare(b, m.locale));

  return {
    id: person.id,
    displayName: person.display_name ?? m.card.someone,
    avatarUrl: person.avatar_path ? (photos.get(person.avatar_path) ?? null) : null,
    country: person.country,
    city: person.city,
    district: person.district,
    workModes: person.work_modes ?? [],
    ideaStatuses: person.idea_statuses ?? [],
    pitch: person.pitch,
    weeklyHours: person.weekly_hours ?? [],
    partnerWeeklyHours: person.partner_weekly_hours ?? [],
    ambitions: person.ambitions ?? [],
    categories: categories.data
      .flatMap((row) => (row.categories ? [row.categories] : []))
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((category) => category.name),
    offers: names(skills.data.flatMap((row) => (row.kind === "offers" && row.skills ? [row.skills] : []))),
    seeks: names(skills.data.flatMap((row) => (row.kind === "seeks" && row.skills ? [row.skills] : []))),
  };
}
