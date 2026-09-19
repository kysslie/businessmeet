import { z } from "zod";
import { isCountryCode } from "@/lib/countries";
import {
  AMBITIONS,
  CITY_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  DISTRICT_MAX_LENGTH,
  IDEA_STATUSES,
  PITCH_MAX_LENGTH,
  WEEKLY_HOURS,
  WORK_MODES,
} from "@/lib/profile-options";

const values = <T extends readonly { value: string }[]>(options: T) =>
  options.map((option) => option.value) as [T[number]["value"], ...T[number]["value"][]];

// A list of allowed values with duplicates removed. Give a message to require at least one.
const pickMany = <T extends [string, ...string[]]>(allowed: T, requiredMessage?: string) => {
  const list = z.array(z.enum(allowed));
  return (requiredMessage ? list.min(1, requiredMessage) : list).transform((chosen) => [
    ...new Set(chosen),
  ]);
};

const idList = z
  .array(z.coerce.number().int().positive())
  .transform((list) => [...new Set(list)]);

// Everything the profile form sends. Which categories and skills are actually allowed
// is checked separately against the database (see saveProfile).
export const profileSchema = z
  .object({
    display_name: z
      .string()
      .trim()
      .min(1, "Enter your name.")
      .max(DISPLAY_NAME_MAX_LENGTH, `Keep your name under ${DISPLAY_NAME_MAX_LENGTH} characters.`),
    work_modes: pickMany(values(WORK_MODES), "Pick Remote, Local, or both."),
    country: z
      .string()
      .refine(isCountryCode, "Choose your country."),
    city: z
      .string()
      .trim()
      .max(CITY_MAX_LENGTH, `Keep the city under ${CITY_MAX_LENGTH} characters.`),
    district: z
      .string()
      .trim()
      .max(DISTRICT_MAX_LENGTH, `Keep the district under ${DISTRICT_MAX_LENGTH} characters.`),
    idea_statuses: pickMany(values(IDEA_STATUSES), "Pick at least one."),
    pitch: z.string().trim().max(PITCH_MAX_LENGTH, `Keep your pitch under ${PITCH_MAX_LENGTH} characters.`),
    weekly_hours: pickMany(values(WEEKLY_HOURS), "Pick at least one range."),
    // Optional: an empty list means "no preference".
    partner_weekly_hours: pickMany(values(WEEKLY_HOURS)),
    ambitions: pickMany(values(AMBITIONS), "Pick at least one."),
    category_ids: idList.pipe(z.array(z.number()).min(1, "Pick at least one category.")),
    offers: idList.pipe(z.array(z.number()).min(1, "Pick at least one skill you offer.")),
    seeks: idList,
  })
  .superRefine((profile, ctx) => {
    if (profile.work_modes.includes("local") && profile.city === "") {
      ctx.addIssue({
        code: "custom",
        path: ["city"],
        message: "Enter your city or village. Local matches are by place.",
      });
    }
    if (profile.idea_statuses.includes("has_idea") && profile.pitch === "") {
      ctx.addIssue({
        code: "custom",
        path: ["pitch"],
        message: "Write a short pitch for your idea.",
      });
    }
  });

export type ProfileInput = z.infer<typeof profileSchema>;
