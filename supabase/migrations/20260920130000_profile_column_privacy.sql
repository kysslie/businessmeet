-- Privacy hardening, applied AFTER the app code that no longer reads whole profile rows.
--
-- Other people (a chat partner can read a profile through row level security) must never be
-- able to read a person's postal code, last-seen time or demo flag. Row level security works
-- per row, not per column, so the rule is made at the column level: logged-in users may read
-- every profile column EXCEPT these three. The owner reads their own postal code through
-- get_my_postal_code(); last_seen_at and is_demo are only for the admin views.
--
-- Any column added to `profiles` later must be added to this list on purpose (it is not
-- readable by default any more).

revoke select on public.profiles from authenticated;

grant select (
  id, display_name, avatar_path, country, city, district,
  work_modes, idea_statuses, pitch, weekly_hours, partner_weekly_hours, ambitions,
  onboarded, created_at, updated_at
) on public.profiles to authenticated;
