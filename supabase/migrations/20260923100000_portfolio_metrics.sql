-- P4 ("Le CV de l'entrepreneur"): two new admin-only metrics views for the new milestone.
--
-- Data touched: none. metrics_active_profiles (from decision D, 2026-09-20) is kept as-is and
-- needs no change. The old match-only views (metrics_weekly_matches, metrics_retention_30d)
-- are left in place too, not dropped -- they still work, they are just not part of today's
-- three (Elie, 2026-09-22, replacing decision D's set with a smaller one for this milestone).
--
-- Same rules as every other metrics view: security_invoker, no grant to anon/authenticated, so
-- only the database owner can read them, from the Supabase SQL editor. is_demo is excluded.

-- Per sign-up week: how many signed up, how many have added at least one project (any
-- visibility -- this is about using the feature, not about being publicly visible), and the
-- percentage.
create view public.metrics_project_adoption
  with (security_invoker = true) as
select
  date_trunc('week', p.created_at)::date as signup_week_start,
  to_char(p.created_at, 'IYYY-"W"IW') as signup_week,
  count(*) as signups,
  count(*) filter (where exists (select 1 from public.projects pr where pr.owner_id = p.id)) as with_a_project,
  round(
    100.0 * count(*) filter (where exists (select 1 from public.projects pr where pr.owner_id = p.id))
      / count(*),
    1
  ) as pct_with_a_project
from public.profiles p
where not p.is_demo
group by 1, 2;

-- How many profiles are currently Public, and the total view count across everyone's page.
create view public.metrics_public_pages
  with (security_invoker = true) as
select
  count(*) filter (where p.visibility = 'public') as public_profiles,
  coalesce(sum(p.page_views), 0) as total_page_views
from public.profiles p
where not p.is_demo;

revoke all on public.metrics_project_adoption, public.metrics_public_pages from anon, authenticated;
