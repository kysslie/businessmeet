import { z } from "zod";
import { isCountryCode } from "@/lib/countries";
import { m } from "@/lib/messages";
import {
  AMBITIONS,
  CITY_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  DISTRICT_MAX_LENGTH,
  IDEA_STATUSES,
  PITCH_MAX_LENGTH,
  VISIBILITY,
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
      .min(1, m.validation.nameRequired)
      .max(DISPLAY_NAME_MAX_LENGTH, m.validation.nameTooLong(DISPLAY_NAME_MAX_LENGTH)),
    work_modes: pickMany(values(WORK_MODES), m.validation.workModesRequired),
    country: z.string().refine(isCountryCode, m.validation.countryRequired),
    city: z.string().trim().max(CITY_MAX_LENGTH, m.validation.cityTooLong(CITY_MAX_LENGTH)),
    district: z
      .string()
      .trim()
      .max(DISTRICT_MAX_LENGTH, m.validation.districtTooLong(DISTRICT_MAX_LENGTH)),
    // A French postal code: 5 digits. Never shown to other people; used only for matching zones.
    postal_code: z
      .string()
      .trim()
      .refine((value) => value === "" || /^[0-9]{5}$/.test(value), m.validation.postalCodeFormat),
    idea_statuses: pickMany(values(IDEA_STATUSES), m.validation.ideaRequired),
    pitch: z.string().trim().max(PITCH_MAX_LENGTH, m.validation.pitchTooLong(PITCH_MAX_LENGTH)),
    weekly_hours: pickMany(values(WEEKLY_HOURS), m.validation.hoursRequired),
    // Optional: an empty list means "no preference".
    partner_weekly_hours: pickMany(values(WEEKLY_HOURS)),
    ambitions: pickMany(values(AMBITIONS), m.validation.ambitionRequired),
    // No default: the database also refuses to complete onboarding without this.
    visibility: z.enum(values(VISIBILITY), m.validation.visibilityRequired),
    category_ids: idList.pipe(z.array(z.number()).min(1, m.validation.categoryRequired)),
    offers: idList.pipe(z.array(z.number()).min(1, m.validation.offersRequired)),
    seeks: idList,
  })
  .superRefine((profile, ctx) => {
    const wantsLocal = profile.work_modes.includes("local");
    if (wantsLocal && profile.city === "") {
      ctx.addIssue({ code: "custom", path: ["city"], message: m.validation.cityRequiredForLocal });
    }
    // Local people in France are matched by zone, which needs the postal code.
    if (wantsLocal && profile.country === "FR" && profile.postal_code === "") {
      ctx.addIssue({
        code: "custom",
        path: ["postal_code"],
        message: m.validation.postalCodeRequiredForLocal,
      });
    }
    if (profile.idea_statuses.includes("has_idea") && profile.pitch === "") {
      ctx.addIssue({ code: "custom", path: ["pitch"], message: m.validation.pitchRequired });
    }
  });

export type ProfileInput = z.infer<typeof profileSchema>;
