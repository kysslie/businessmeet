import { z } from "zod";
import { m } from "@/lib/messages";
import {
  PROJECT_HOURS_PER_WEEK,
  PROJECT_LESSONS_MAX_LENGTH,
  PROJECT_LINK_LABEL_MAX_LENGTH,
  PROJECT_LINK_URL_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_OUTCOMES,
  PROJECT_ROLE_MAX_LENGTH,
} from "@/lib/project-options";

const outcomeValues = PROJECT_OUTCOMES.map((o) => o.value) as [string, ...string[]];
const hoursValues = PROJECT_HOURS_PER_WEEK.map((o) => o.value) as [string, ...string[]];

// A month picker (<input type="month">) sends "YYYY-MM"; the database stores a full date with
// the day always at 1. Empty means "not set" (only allowed for the end date, when ongoing).
const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, m.validation.projectStartedRequired)
  .transform((value) => `${value}-01`);

export const projectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, m.validation.projectNameRequired)
      .max(PROJECT_NAME_MAX_LENGTH, m.validation.projectNameTooLong(PROJECT_NAME_MAX_LENGTH)),
    category_id: z.coerce.number().int().positive(m.validation.projectCategoryRequired),
    started_on: monthSchema,
    ended_on: z.string(), // "" when ongoing (outcome === "ongoing") or not yet set; validated below
    role: z.string().trim().max(PROJECT_ROLE_MAX_LENGTH, m.validation.projectRoleTooLong(PROJECT_ROLE_MAX_LENGTH)),
    hours_per_week: z.union([z.enum(hoursValues), z.literal("")]),
    outcome: z.enum(outcomeValues, m.validation.projectOutcomeRequired),
    lessons: z
      .string()
      .trim()
      .min(1, m.validation.projectLessonsRequired)
      .max(PROJECT_LESSONS_MAX_LENGTH, m.validation.projectLessonsTooLong(PROJECT_LESSONS_MAX_LENGTH)),
    siret: z
      .string()
      .trim()
      .refine((value) => value === "" || /^[0-9]{14}$/.test(value), m.validation.projectSiretFormat),
    visibility: z.enum(["private", "public"]),
  })
  .superRefine((project, ctx) => {
    const ongoing = project.outcome === "ongoing";
    if (ongoing) {
      if (project.ended_on !== "") {
        ctx.addIssue({ code: "custom", path: ["ended_on"], message: m.validation.projectEndedNotOngoing });
      }
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(project.ended_on)) {
      ctx.addIssue({ code: "custom", path: ["ended_on"], message: m.validation.projectEndedRequired });
      return;
    }
    if (project.ended_on < project.started_on.slice(0, 7)) {
      ctx.addIssue({ code: "custom", path: ["ended_on"], message: m.validation.projectEndedBeforeStarted });
    }
  })
  .transform((project) => ({
    ...project,
    ended_on: project.outcome === "ongoing" || project.ended_on === "" ? null : `${project.ended_on}-01`,
    role: project.role === "" ? null : project.role,
    hours_per_week: project.hours_per_week === "" ? null : project.hours_per_week,
    siret: project.siret === "" ? null : project.siret,
  }));

export type ProjectInput = z.infer<typeof projectSchema>;

const linkUrl = z
  .string()
  .trim()
  .min(1, m.validation.projectLinkUrlRequired)
  .max(PROJECT_LINK_URL_MAX_LENGTH, m.validation.projectLinkUrlTooLong(PROJECT_LINK_URL_MAX_LENGTH))
  .transform((value) => (value.includes("://") ? value : `https://${value}`))
  .refine((value) => !/\s/.test(value), m.validation.projectLinkUrlInvalid)
  .refine((value) => !/^http:\/\//i.test(value), m.validation.projectLinkUrlNotHttps)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname.includes(".");
    } catch {
      return false;
    }
  }, m.validation.projectLinkUrlInvalid);

export const projectLinkSchema = z.object({
  projectId: z.guid(),
  label: z
    .string()
    .trim()
    .min(1, m.validation.projectLinkLabelRequired)
    .max(PROJECT_LINK_LABEL_MAX_LENGTH, m.validation.projectLinkLabelTooLong(PROJECT_LINK_LABEL_MAX_LENGTH)),
  url: linkUrl,
});

export const projectIdSchema = z.guid();
