-- Elie's decision D, 2026-09-20: launch metrics without a new tool.
--
--   * profiles.last_seen_at: set when a logged-in person opens the app, at most once per hour
--   * profiles.is_demo: true for demo/test accounts, which every metric ignores
--   * three admin-only views, read from the Supabase SQL editor:
--       metrics_active_profiles   profiles seen in the last 30 days, by region
--       metrics_weekly_matches    new matches per ISO week
--       metrics_retention_30d     per signup week, % of people seen again 30+ days after signup
--
-- Data touched (approved by Elie): last_seen_at is filled for the existing accounts from their
-- last login date, and the two demo accounts are flagged is_demo.

alter table public.profiles
  add column last_seen_at timestamptz,
  add column is_demo boolean not null default false;

update public.profiles p
set last_seen_at = u.last_sign_in_at
from auth.users u
where u.id = p.id;

update public.profiles p
set is_demo = true
from auth.users u
where u.id = p.id
  and u.email like '%@demo.invalid';

-- Called by the app when someone opens it. At most one write per hour per person: the update
-- only happens if the last value is empty or older than an hour. SECURITY DEFINER because people
-- may not write last_seen_at themselves.
create function public.touch_last_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
  set last_seen_at = now()
  where id = (select auth.uid())
    and (last_seen_at is null or last_seen_at < now() - interval '1 hour');
$$;

revoke execute on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

-- Views. security_invoker means they run with the rights of whoever reads them, and nobody but
-- the database owner (you, in the SQL editor) is given any access at all.

-- Profiles seen in the last 30 days, by region:
--   ile_de_france            takes Local and lives in Île-de-France (departments 75, 77, 78, 91-95)
--   local_hors_ile_de_france takes Local, anywhere else
--   remote_uniquement        takes only Remote
--   profil_incomplet         has not finished the profile, so no region is known
create view public.metrics_active_profiles
  with (security_invoker = true) as
select
  case
    when not p.onboarded then 'profil_incomplet'
    when 'local' = any (p.work_modes)
      and public.department_of(p.postal_code) in ('75', '77', '78', '91', '92', '93', '94', '95')
      then 'ile_de_france'
    when 'local' = any (p.work_modes) then 'local_hors_ile_de_france'
    else 'remote_uniquement'
  end as region,
  count(*) as active_profiles_30d
from public.profiles p
where not p.is_demo
  and p.last_seen_at >= now() - interval '30 days'
group by 1;

-- New matches per ISO week (a match counts even if it was unmatched later).
create view public.metrics_weekly_matches
  with (security_invoker = true) as
select
  date_trunc('week', m.created_at)::date as week_start,
  to_char(m.created_at, 'IYYY-"W"IW') as iso_week,
  count(*) as new_matches
from public.matches m
join public.profiles a on a.id = m.user_a
join public.profiles b on b.id = m.user_b
where not a.is_demo and not b.is_demo
group by 1, 2;

-- Per signup week: how many signed up, how many were seen again 30 or more days after their
-- signup, and the percentage. Only weeks that ended at least 30 days ago are shown, so a young
-- week never looks like a bad week.
create view public.metrics_retention_30d
  with (security_invoker = true) as
select
  date_trunc('week', p.created_at)::date as signup_week_start,
  to_char(p.created_at, 'IYYY-"W"IW') as signup_week,
  count(*) as signups,
  count(*) filter (where p.last_seen_at >= p.created_at + interval '30 days') as seen_after_30d,
  round(
    100.0 * count(*) filter (where p.last_seen_at >= p.created_at + interval '30 days') / count(*),
    1
  ) as retention_pct
from public.profiles p
where not p.is_demo
  and date_trunc('week', p.created_at) + interval '37 days' <= now()
group by 1, 2;

revoke all on public.metrics_active_profiles, public.metrics_weekly_matches, public.metrics_retention_30d
  from anon, authenticated;
