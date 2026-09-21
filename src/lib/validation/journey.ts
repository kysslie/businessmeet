import { z } from "zod";
import {
  JOURNEY_GOAL_MAX_LENGTH,
  JOURNEY_LINK_KINDS,
  JOURNEY_LINK_TITLE_MAX_LENGTH,
  JOURNEY_LINK_URL_MAX_LENGTH,
  JOURNEY_NAME_MAX_LENGTH,
} from "@/lib/journey-options";
import { m } from "@/lib/messages";

const name = z
  .string()
  .trim()
  .min(1, m.validation.journeyNameRequired)
  .max(JOURNEY_NAME_MAX_LENGTH, m.validation.journeyNameTooLong(JOURNEY_NAME_MAX_LENGTH));

const goal = z
  .string()
  .trim()
  .max(JOURNEY_GOAL_MAX_LENGTH, m.validation.journeyGoalTooLong(JOURNEY_GOAL_MAX_LENGTH));

// A pasted address without "https://" gets it added ("exemple.fr" is fine). Anything else must
// be a proper https:// address: no http, no javascript:, no spaces.
const linkUrl = z
  .string()
  .trim()
  .min(1, m.validation.linkUrlRequired)
  .max(JOURNEY_LINK_URL_MAX_LENGTH, m.validation.linkUrlTooLong(JOURNEY_LINK_URL_MAX_LENGTH))
  .transform((value) => (value.includes("://") ? value : `https://${value}`))
  .refine((value) => !/\s/.test(value), m.validation.linkUrlInvalid)
  .refine((value) => !/^http:\/\//i.test(value), m.validation.linkUrlNotHttps)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname.includes(".");
    } catch {
      return false;
    }
  }, m.validation.linkUrlInvalid);

export const startJourneySchema = z.object({ matchId: z.guid(), name, goal });
export const updateJourneySchema = z.object({ journeyId: z.guid(), name, goal });
export const inviteSchema = z.object({ journeyId: z.guid(), userId: z.guid() });
export const journeyIdSchema = z.guid();
export const addLinkSchema = z.object({
  journeyId: z.guid(),
  title: z
    .string()
    .trim()
    .min(1, m.validation.linkTitleRequired)
    .max(JOURNEY_LINK_TITLE_MAX_LENGTH, m.validation.linkTitleTooLong(JOURNEY_LINK_TITLE_MAX_LENGTH)),
  url: linkUrl,
  kind: z.enum(JOURNEY_LINK_KINDS, m.validation.linkKindInvalid),
});
