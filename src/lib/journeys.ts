import { m } from "@/lib/messages";
import { signedPhotoLinks } from "@/lib/photo-links";
import type { createClient } from "@/lib/supabase/server";
import type { JourneyLinkKind } from "@/lib/journey-options";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type JourneySummary = {
  id: string;
  name: string;
  archived: boolean;
  status: "invited" | "active";
  memberCount: number | null; // unknown for an invitation (members are only visible to members)
  inviterName: string | null;
  createdAt: string;
};

// The parcours the logged-in person belongs to or is invited to. Row level security already
// limits everything to that.
export async function loadJourneys(supabase: Supabase, userId: string): Promise<JourneySummary[]> {
  const { data: mine, error } = await supabase
    .from("journey_members")
    .select("journey_id, status, invited_by, journeys(id, name, archived_at, created_at)")
    .eq("user_id", userId)
    .is("left_at", null);
  if (error) throw new Error(m.parcours.loadFailed);

  const rows = mine.flatMap((row) => (row.journeys ? [{ ...row, journey: row.journeys }] : []));
  if (rows.length === 0) return [];

  const activeIds = rows.filter((row) => row.status === "active").map((row) => row.journey_id);
  const { data: members } =
    activeIds.length > 0
      ? await supabase
          .from("journey_members")
          .select("journey_id")
          .in("journey_id", activeIds)
          .eq("status", "active")
          .is("left_at", null)
      : { data: [] };
  const counts = new Map<string, number>();
  for (const row of members ?? []) counts.set(row.journey_id, (counts.get(row.journey_id) ?? 0) + 1);

  const inviterIds = [
    ...new Set(rows.flatMap((row) => (row.status === "invited" && row.invited_by ? [row.invited_by] : []))),
  ];
  const { data: inviters } =
    inviterIds.length > 0
      ? await supabase.from("profiles").select("id, display_name").in("id", inviterIds)
      : { data: [] };
  const inviterName = new Map((inviters ?? []).map((person) => [person.id, person.display_name]));

  return rows
    .map(
      (row): JourneySummary => ({
        id: row.journey.id,
        name: row.journey.name,
        archived: row.journey.archived_at !== null,
        status: row.status === "invited" ? "invited" : "active",
        memberCount: row.status === "active" ? (counts.get(row.journey_id) ?? 1) : null,
        inviterName: row.invited_by ? (inviterName.get(row.invited_by) ?? m.parcours.someone) : null,
        createdAt: row.journey.created_at,
      }),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type JourneyMember = {
  id: string;
  name: string;
  avatarUrl: string | null;
  invited: boolean;
  isMe: boolean;
};

export type JourneyLink = {
  id: number;
  title: string;
  url: string;
  kind: JourneyLinkKind;
  addedByName: string | null;
  canRemove: boolean;
};

// Names and photos of the given people, as far as row level security lets this person see them
// (co-members and direct matches). Anyone else is "Quelqu'un".
export async function loadPeople(supabase: Supabase, ids: string[]) {
  const unique = [...new Set(ids)];
  const { data } =
    unique.length > 0
      ? await supabase.from("profiles").select("id, display_name, avatar_path").in("id", unique)
      : { data: [] };
  const photos = await signedPhotoLinks(
    supabase,
    (data ?? []).flatMap((person) => (person.avatar_path ? [person.avatar_path] : [])),
  );
  return new Map(
    (data ?? []).map((person) => [
      person.id,
      {
        name: person.display_name ?? m.parcours.someone,
        avatarUrl: person.avatar_path ? (photos.get(person.avatar_path) ?? null) : null,
      },
    ]),
  );
}
