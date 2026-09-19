// The fixed answers for the profile form. Values match the CHECK constraints in the
// database (see supabase/migrations/20260919190000_profile_multiselect.sql); labels are
// what people see. Every question below is "select all that fit".

export const WORK_MODES = [
  { value: "remote", label: "Remote" },
  { value: "local", label: "Local" },
] as const;

export const IDEA_STATUSES = [
  { value: "has_idea", label: "I have an idea" },
  { value: "wants_to_join", label: "I want to join someone's idea" },
  { value: "open_to_merge", label: "Open to merging ideas" },
  { value: "exploring", label: "Exploring" },
] as const;

export const WEEKLY_HOURS = [
  { value: "lt_5", label: "Less than 5" },
  { value: "5_10", label: "5–10" },
  { value: "10_20", label: "10–20" },
  { value: "20_plus", label: "20+" },
] as const;

export const AMBITIONS = [
  { value: "for_fun", label: "Side project for fun" },
  { value: "side_income", label: "Side income" },
  { value: "full_time", label: "Aim to go full-time" },
] as const;

// The labels people see for a list of stored values, in the order the options are
// defined ("Side income, Aim to go full-time"). Unknown values are shown as they are.
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

// Photos: must match the `avatars` bucket limits (2 MB, these types).
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
