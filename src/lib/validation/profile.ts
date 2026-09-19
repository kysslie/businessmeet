import { z } from "zod";
import {
  AMBITIONS,
  CITY_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  IDEA_STATUSES,
  PITCH_MAX_LENGTH,
  WEEKLY_HOURS,
  WORK_MODES,
} from "@/lib/profile-options";

const values = <T extends readonly { value: string }[]>(options: T) =>
  options.map((option) => option.value) as [T[number]["value"], ...T[number]["value"][]];

const chooseOne = "Choose an option.";

const idList = z.array(z.coerce.number().int().positive());

// Everything the profile form sends. Which categories and skills are actually allowed
// is checked separately against the database (see saveProfile).
export const profileSchema = z
  .object({
    display_name: z
      .string()
      .trim()
      .min(1, "Enter your name.")
      .max(DISPLAY_NAME_MAX_LENGTH, `Keep your name under ${DISPLAY_NAME_MAX_LENGTH} characters.`),
    work_mode: z.enum(values(WORK_MODES), { error: chooseOne }),
    city: z
      .string()
      .trim()
      .max(CITY_MAX_LENGTH, `Keep the city under ${CITY_MAX_LENGTH} characters.`),
    idea_status: z.enum(values(IDEA_STATUSES), { error: chooseOne }),
    pitch: z.string().trim().max(PITCH_MAX_LENGTH, `Keep your pitch under ${PITCH_MAX_LENGTH} characters.`),
    weekly_hours: z.enum(values(WEEKLY_HOURS), { error: chooseOne }),
    // Optional: empty means "no preference".
    partner_weekly_hours: z.union([z.enum(values(WEEKLY_HOURS)), z.literal("")]),
    ambition: z.enum(values(AMBITIONS), { error: chooseOne }),
    category_ids: idList.min(1, "Pick at least one category."),
    offers: idList.min(1, "Pick at least one skill you offer."),
    seeks: idList,
  })
  .superRefine((profile, ctx) => {
    if (profile.work_mode === "local_only" && profile.city === "") {
      ctx.addIssue({
        code: "custom",
        path: ["city"],
        message: "Enter your city. Local-only people are matched by city.",
      });
    }
    if (profile.idea_status === "has_idea" && profile.pitch === "") {
      ctx.addIssue({
        code: "custom",
        path: ["pitch"],
        message: "Write a short pitch for your idea.",
      });
    }
  });

export type ProfileInput = z.infer<typeof profileSchema>;
