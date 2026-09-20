-- Elie's decisions, 2026-09-20 (answer 2): launch region Île-de-France, accept all sign-ups.
--
-- A postal code (5 digits) is now required for anyone who takes Local and lives in France.
-- It is only used to work out a matching ZONE and is never shown to other users
-- (the feed function does not return it; migration 4 also blocks it at the column level).
--
-- Local matching zones:
--   * France, with a postal code: all of Île-de-France (departments 75, 77, 78, 91, 92, 93,
--     94, 95) is ONE zone; anywhere else in France the zone is the department.
--   * Any other country (or no postal code): the same city in the same country, compared
--     ignoring capitals, accents and repeated spaces (the earlier rule).
-- Two people see each other if both take Remote, or both take Local in the same zone.
-- Everything else about the feed is unchanged.
--
-- Existing data touched: the two demo profiles (Lyon) get postal codes, because the new rule
-- would otherwise make them invalid.

alter table public.profiles add column postal_code text;

update public.profiles p
set postal_code = case u.email
    when 'demo.ana@demo.invalid' then '69003'    -- Lyon 3e (Part-Dieu)
    when 'demo.marco@demo.invalid' then '69004'  -- Lyon 4e (Croix-Rousse)
  end
from auth.users u
where u.id = p.id
  and u.email in ('demo.ana@demo.invalid', 'demo.marco@demo.invalid');

-- The onboarding rule now also asks for a postal code from Local people in France.
alter table public.profiles drop constraint profiles_onboarded_complete;

alter table public.profiles
  add constraint profiles_postal_code_format
    check (postal_code ~ '^[0-9]{5}$'),
  add constraint profiles_onboarded_complete
    check (
      not onboarded
      or (
        display_name is not null
        and country is not null
        and coalesce(cardinality(work_modes), 0) >= 1
        and coalesce(cardinality(idea_statuses), 0) >= 1
        and coalesce(cardinality(weekly_hours), 0) >= 1
        and coalesce(cardinality(ambitions), 0) >= 1
        and (not coalesce('local' = any (work_modes), false) or (city is not null and btrim(city) <> ''))
        and (
          not coalesce('local' = any (work_modes), false)
          or country <> 'FR'
          or postal_code is not null
        )
        and (not coalesce('has_idea' = any (idea_statuses), false) or (pitch is not null and btrim(pitch) <> ''))
      )
    );

-- Users may edit their own postal code (column-level, like the other fields).
grant update (postal_code) on public.profiles to authenticated;

-- The owner reads their own postal code through this function (nobody else can).
create function public.get_my_postal_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.postal_code from public.profiles p where p.id = (select auth.uid());
$$;

revoke execute on function public.get_my_postal_code() from public, anon;
grant execute on function public.get_my_postal_code() to authenticated;

-- French department from a postal code: 2A/2B for Corsica, 3 digits for overseas
-- departments (97x, 98x), otherwise the first two digits.
create function public.department_of(postal_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when postal_code !~ '^[0-9]{5}$' then null
    when left(postal_code, 2) = '20' then case when postal_code::integer < 20200 then '2A' else '2B' end
    when left(postal_code, 2) in ('97', '98') then left(postal_code, 3)
    else left(postal_code, 2)
  end;
$$;

-- The zone used for Local matching (see the top of this file).
create function public.local_zone(country text, postal_code text, city text)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when country = 'FR' and postal_code ~ '^[0-9]{5}$' then
      case
        when public.department_of(postal_code) in ('75', '77', '78', '91', '92', '93', '94', '95')
          then 'FR:IDF'
        else 'FR:' || public.department_of(postal_code)
      end
    when public.normalize_place(city) is not null then country || ':' || public.normalize_place(city)
    else null
  end;
$$;

revoke execute on function public.department_of(text) from public, anon, authenticated;
revoke execute on function public.local_zone(text, text, text) from public, anon, authenticated;

-- The feed with the new Local rule. Same columns as before: the postal code is NOT returned.
create or replace function public.get_feed()
returns table (
  id uuid,
  display_name text,
  avatar_path text,
  country text,
  city text,
  district text,
  work_modes text[],
  idea_statuses text[],
  pitch text,
  weekly_hours text[],
  partner_weekly_hours text[],
  ambitions text[],
  category_names text[],
  offers text[],
  seeks text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select
      p.id,
      p.work_modes,
      public.local_zone(p.country, p.postal_code, p.city) as zone
    from public.profiles p
    where p.id = (select auth.uid())
      and p.onboarded
  )
  select
    p.id,
    p.display_name,
    p.avatar_path,
    p.country,
    p.city,
    p.district,
    p.work_modes,
    p.idea_statuses,
    p.pitch,
    p.weekly_hours,
    p.partner_weekly_hours,
    p.ambitions,
    (
      select coalesce(array_agg(c.name order by c.sort_order), '{}')
      from public.profile_categories pc
      join public.categories c on c.id = pc.category_id
      where pc.profile_id = p.id
    ),
    (
      select coalesce(array_agg(s.name order by s.name), '{}')
      from public.profile_skills ps
      join public.skills s on s.id = ps.skill_id
      where ps.profile_id = p.id and ps.kind = 'offers'
    ),
    (
      select coalesce(array_agg(s.name order by s.name), '{}')
      from public.profile_skills ps
      join public.skills s on s.id = ps.skill_id
      where ps.profile_id = p.id and ps.kind = 'seeks'
    )
  from me
  join public.profiles p
    on p.id <> me.id
   and p.onboarded
  where
    -- shares at least one active category
    exists (
      select 1
      from public.profile_categories mine
      join public.profile_categories theirs on theirs.category_id = mine.category_id
      join public.categories c on c.id = mine.category_id and c.is_active
      where mine.profile_id = me.id
        and theirs.profile_id = p.id
    )
    -- a shared way of working: both Remote, or both Local in the same zone
    and (
      ('remote' = any (me.work_modes) and 'remote' = any (p.work_modes))
      or (
        'local' = any (me.work_modes) and 'local' = any (p.work_modes)
        and me.zone is not null
        and me.zone = public.local_zone(p.country, p.postal_code, p.city)
      )
    )
    -- not already swiped
    and not exists (
      select 1 from public.swipes s
      where s.swiper_id = me.id and s.target_id = p.id
    )
    -- not blocked in either direction
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = me.id and b.blocked_id = p.id)
         or (b.blocker_id = p.id and b.blocked_id = me.id)
    )
  order by random()
  limit 20;
$$;
