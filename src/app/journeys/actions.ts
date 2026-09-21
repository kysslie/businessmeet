"use server";

import { revalidatePath } from "next/cache";
import { defaultVisibility } from "@/lib/journey-options";
import { m } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import {
  addLinkSchema,
  inviteSchema,
  journeyIdSchema,
  startJourneySchema,
  updateJourneySchema,
} from "@/lib/validation/journey";

export type JourneyResult = { ok: true; journeyId?: string } | { ok: false; message: string };

async function currentUser() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  return { supabase, userId: auth?.claims?.sub ?? null };
}

const firstIssue = (error: { issues: { message: string }[] }) => error.issues[0].message;

// Starts a parcours from one of the caller's matches. The other person is invited and must accept.
// The database function checks the match is active and not blocked.
export async function startJourney(input: {
  matchId: string;
  name: string;
  goal: string;
}): Promise<JourneyResult> {
  const parsed = startJourneySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const { supabase, userId } = await currentUser();
  if (!userId) return { ok: false, message: m.feed.errors.loggedOut };

  const { data, error } = await supabase.rpc("start_journey", {
    p_match_id: parsed.data.matchId,
    p_name: parsed.data.name,
    p_goal: parsed.data.goal,
  });
  if (error || !data) {
    console.error("start_journey failed:", error?.code, error?.message);
    return { ok: false, message: m.parcours.errors.startFailed };
  }
  revalidatePath("/journeys");
  return { ok: true, journeyId: data };
}

// Invites one of the caller's own matches. The database checks the match, blocks and the limit.
export async function inviteToJourney(input: { journeyId: string; userId: string }): Promise<JourneyResult> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: m.parcours.errors.inviteFailed };
  const { supabase, userId } = await currentUser();
  if (!userId) return { ok: false, message: m.feed.errors.loggedOut };

  const { error } = await supabase.rpc("invite_to_journey", {
    p_journey_id: parsed.data.journeyId,
    p_user_id: parsed.data.userId,
  });
  if (error) {
    console.error("invite_to_journey failed:", error.code, error.message);
    const message =
      error.message.includes("full")
        ? m.parcours.errors.inviteFull
        : error.message.includes("already")
          ? m.parcours.errors.inviteAlready
          : error.message.includes("not allowed") || error.message.includes("not matched")
            ? m.parcours.errors.inviteNotAllowed
            : m.parcours.errors.inviteFailed;
    return { ok: false, message };
  }
  revalidatePath(`/journeys/${parsed.data.journeyId}`);
  return { ok: true };
}

export async function respondToInvite(journeyId: string, accept: boolean): Promise<JourneyResult> {
  if (!journeyIdSchema.safeParse(journeyId).success) return { ok: false, message: m.parcours.errors.respondFailed };
  const { supabase, userId } = await currentUser();
  if (!userId) return { ok: false, message: m.feed.errors.loggedOut };

  const { error } = await supabase.rpc("respond_to_journey_invite", { p_journey_id: journeyId, p_accept: accept });
  if (error) {
    console.error("respond_to_journey_invite failed:", error.code, error.message);
    return { ok: false, message: m.parcours.errors.respondFailed };
  }
  revalidatePath("/journeys");
  return { ok: true };
}

export async function leaveJourney(journeyId: string): Promise<JourneyResult> {
  if (!journeyIdSchema.safeParse(journeyId).success) return { ok: false, message: m.parcours.errors.leaveFailed };
  const { supabase, userId } = await currentUser();
  if (!userId) return { ok: false, message: m.feed.errors.loggedOut };

  const { error } = await supabase.rpc("leave_journey", { p_journey_id: journeyId });
  if (error) {
    console.error("leave_journey failed:", error.code, error.message);
    return { ok: false, message: m.parcours.errors.leaveFailed };
  }
  revalidatePath("/journeys");
  return { ok: true };
}

// Renames a parcours / edits its goal. Row level security allows only active members of a
// parcours that is not archived; zero rows updated means "not allowed".
export async function updateJourney(input: {
  journeyId: string;
  name: string;
  goal: string;
}): Promise<JourneyResult> {
  const parsed = updateJourneySchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const { supabase, userId } = await currentUser();
  if (!userId) return { ok: false, message: m.feed.errors.loggedOut };

  const { data, error } = await supabase
    .from("journeys")
    .update({ name: parsed.data.name, goal: parsed.data.goal === "" ? null : parsed.data.goal })
    .eq("id", parsed.data.journeyId)
    .select("id");
  if (error || !data || data.length === 0) {
    if (error) console.error("updateJourney failed:", error.code, error.message);
    return { ok: false, message: m.parcours.errors.updateFailed };
  }
  revalidatePath(`/journeys/${parsed.data.journeyId}`);
  return { ok: true };
}

export async function addLink(input: {
  journeyId: string;
  title: string;
  url: string;
  kind: string;
}): Promise<JourneyResult> {
  const parsed = addLinkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: firstIssue(parsed.error) };
  const { supabase, userId } = await currentUser();
  if (!userId) return { ok: false, message: m.feed.errors.loggedOut };

  const { error } = await supabase.from("journey_links").insert({
    journey_id: parsed.data.journeyId,
    added_by: userId,
    title: parsed.data.title,
    url: parsed.data.url,
    kind: parsed.data.kind,
    visibility: defaultVisibility(parsed.data.kind),
  });
  if (error) {
    console.error("addLink failed:", error.code, error.message);
    return { ok: false, message: m.parcours.errors.linkAddFailed };
  }
  revalidatePath(`/journeys/${parsed.data.journeyId}`);
  return { ok: true };
}

export async function removeLink(journeyId: string, linkId: number): Promise<JourneyResult> {
  if (!journeyIdSchema.safeParse(journeyId).success || !Number.isInteger(linkId)) {
    return { ok: false, message: m.parcours.errors.linkRemoveFailed };
  }
  const { supabase, userId } = await currentUser();
  if (!userId) return { ok: false, message: m.feed.errors.loggedOut };

  const { data, error } = await supabase
    .from("journey_links")
    .delete()
    .eq("id", linkId)
    .eq("journey_id", journeyId)
    .select("id");
  if (error || !data || data.length === 0) {
    if (error) console.error("removeLink failed:", error.code, error.message);
    return { ok: false, message: m.parcours.errors.linkRemoveFailed };
  }
  revalidatePath(`/journeys/${journeyId}`);
  return { ok: true };
}
