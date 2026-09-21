// Fixed choices for a parcours (journey). The database enforces the same limits.
export const JOURNEY_NAME_MAX_LENGTH = 60;
export const JOURNEY_GOAL_MAX_LENGTH = 280;
export const JOURNEY_LINK_TITLE_MAX_LENGTH = 60;
export const JOURNEY_LINK_URL_MAX_LENGTH = 500;
export const JOURNEY_MAX_MEMBERS = 10;

export const JOURNEY_LINK_KINDS = ["whatsapp", "discord", "x", "drive", "website", "other"] as const;
export type JourneyLinkKind = (typeof JOURNEY_LINK_KINDS)[number];

// Private links (group invitations, shared documents) are for members only. Public ones (a
// website, an X account) are the kind a public project page could show later (Phase 2). There
// is no public page yet, so today every link is visible to members only.
export function defaultVisibility(kind: JourneyLinkKind): "private" | "public" {
  return kind === "x" || kind === "website" ? "public" : "private";
}
