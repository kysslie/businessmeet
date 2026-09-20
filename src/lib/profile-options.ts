// The fixed answers for the profile form. Values match the CHECK constraints in the
// database (see supabase/migrations/20260919190000_profile_multiselect.sql); the labels
// people see come from the messages file. Every question below is "select all that fit".

import { m } from "@/lib/messages";

export const WORK_MODES = [
  { value: "remote", label: m.options.workModes.remote },
  { value: "local", label: m.options.workModes.local },
] as const;

export const IDEA_STATUSES = [
  { value: "has_idea", label: m.options.ideaStatuses.has_idea },
  { value: "wants_to_join", label: m.options.ideaStatuses.wants_to_join },
  { value: "open_to_merge", label: m.options.ideaStatuses.open_to_merge },
  { value: "exploring", label: m.options.ideaStatuses.exploring },
] as const;

export const WEEKLY_HOURS = [
  { value: "lt_5", label: m.options.weeklyHours.lt_5 },
  { value: "5_10", label: m.options.weeklyHours["5_10"] },
  { value: "10_20", label: m.options.weeklyHours["10_20"] },
  { value: "20_plus", label: m.options.weeklyHours["20_plus"] },
] as const;

export const AMBITIONS = [
  { value: "for_fun", label: m.options.ambitions.for_fun },
  { value: "side_income", label: m.options.ambitions.side_income },
  { value: "full_time", label: m.options.ambitions.full_time },
] as const;

// The labels people see for a list of stored values, in the order the options are
// defined ("Revenu complémentaire, Viser le temps plein"). Unknown values are shown as they are.
export function labelsFor(
  options: readonly { value: string; label: string }[],
  values: readonly string[] | null,
) {
  if (!values) return [];
  const known = options.filter((option) => values.includes(option.value)).map((o) => o.label);
  const unknown = values.filter((value) => !options.some((option) => option.value === value));
  return [...known, ...unknown];
}

export const PITCH_MAX_LENGTH = 280;
export const DISPLAY_NAME_MAX_LENGTH = 50;
export const CITY_MAX_LENGTH = 100;
export const DISTRICT_MAX_LENGTH = 100;
export const MESSAGE_MAX_LENGTH = 2000;

// Photos: must match the `avatars` bucket limits (2 MB, these types).
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
