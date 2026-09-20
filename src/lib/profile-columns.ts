// The profile columns the app reads. Listed on purpose (never "*"): postal_code, last_seen_at
// and is_demo are private and cannot be read through the API (see migration
// 20260920130000_profile_column_privacy.sql). The owner's postal code comes from
// get_my_postal_code().
export const PROFILE_COLUMNS =
  "id, display_name, avatar_path, country, city, district, work_modes, idea_statuses, pitch, weekly_hours, partner_weekly_hours, ambitions, onboarded, created_at, updated_at";
