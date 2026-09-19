-- Profile redesign (Elie, 2026-09-19): "select all that fit" answers and a structured location.
--
--   work_mode (one of remote_ok / local_only)  ->  work_modes (any of remote, local)
--   idea_status (one of 3)                     ->  idea_statuses (any of 4; new: open_to_merge)
--   ambition (one of 3)                        ->  ambitions (any of 3)
--   weekly_hours (one range)                   ->  weekly_hours (any ranges)
--   partner_weekly_hours (one range or null)   ->  partner_weekly_hours (any ranges, null = no preference)
--   city (free text)                           ->  country (2-letter code, everyone) + city + district (optional)
--
-- Existing answers are copied into the new lists first, then the old columns are removed.
-- Profiles that have no country yet (all existing ones) are switched back to "not
-- onboarded" so their owners are asked to confirm the profile once (the form is pre-filled).
--
-- The feed rule becomes: two people see each other if they share a way of working:
--   * both take Remote (any country), or
--   * both take Local AND live in the same place (same country, same city; the city is
--     compared ignoring capitals, accents and extra spaces).
-- Picking both Remote and Local reaches the widest pool.
-- Everything else about the feed (shared active category, not swiped, not blocked, max 20,
-- auth.uid(), no parameters) is unchanged.

create extension if not exists unaccent with schema extensions;

-- 1. Constraints that mention the old columns.
alter table public.profiles drop constraint profiles_onboarded_complete;
alter table public.profiles drop constraint profiles_weekly_hours_values;
alter table public.profiles drop constraint profiles_partner_weekly_hours_values;

-- 2. New columns.
alter table public.profiles
  add column work_modes text[],
  add column idea_statuses text[],
  add column ambitions text[],
  add column country text,
  add column district text;

-- 3. Copy the existing single answers into the new lists.
update public.profiles
set
  work_modes = case work_mode
    when 'remote_ok' then array['remote']
    when 'local_only' then array['local']
  end,
  idea_statuses = case when idea_status is null then null else array[idea_status] end,
  ambitions = case when ambition is null then null else array[ambition] end;

alter table public.profiles
  alter column weekly_hours type text[]
    using case when weekly_hours is null then null else array[weekly_hours] end,
  alter column partner_weekly_hours type text[]
    using case when partner_weekly_hours is null then null else array[partner_weekly_hours] end;

-- 4. Remove the old single-answer columns (their check constraints go with them).
alter table public.profiles
  drop column work_mode,
  drop column idea_status,
  drop column ambition;

-- 5. Nobody has a country yet, so ask everyone to confirm their profile once.
update public.profiles set onboarded = false where onboarded and country is null;

-- 6. The rules, in the same style as before.
alter table public.profiles
  add constraint profiles_work_modes_values
    check (work_modes <@ array['remote', 'local']::text[]),
  add constraint profiles_idea_statuses_values
    check (idea_statuses <@ array['has_idea', 'wants_to_join', 'open_to_merge', 'exploring']::text[]),
  add constraint profiles_weekly_hours_values
    check (weekly_hours <@ array['lt_5', '5_10', '10_20', '20_plus']::text[]),
  add constraint profiles_partner_weekly_hours_values
    check (partner_weekly_hours <@ array['lt_5', '5_10', '10_20', '20_plus']::text[]),
  add constraint profiles_ambitions_values
    check (ambitions <@ array['for_fun', 'side_income', 'full_time']::text[]),
  add constraint profiles_country_format
    check (country ~ '^[A-Z]{2}$'),
  add constraint profiles_district_length
    check (district is null or char_length(district) <= 100),
  -- A profile can only be marked onboarded when it is complete:
  --  * name, country, and at least one answer for work mode, idea status, hours, ambition
  --  * anyone taking Local must give a city (the feed matches them by place)
  --  * anyone with an idea must write a pitch
  -- (coalesce: a missing list counts as empty, so it can never slip through as "unknown")
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
        and (not coalesce('has_idea' = any (idea_statuses), false) or (pitch is not null and btrim(pitch) <> ''))
      )
    );

-- 7. Users may edit the new columns of their own profile (column-level, as before).
grant update (country, district, work_modes, idea_statuses, ambitions)
  on public.profiles to authenticated;

-- 8. Place comparison: ignores capitals, accents and repeated spaces ("Zürich" = "zurich").
-- unaccent is called with an explicit dictionary because this function has an empty search_path.
create function public.normalize_place(place text)
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(
    lower(regexp_replace(extensions.unaccent('extensions.unaccent', btrim(place)), '\s+', ' ', 'g')),
    ''
  );
$$;

revoke execute on function public.normalize_place(text) from public, anon, authenticated;

-- 9. The feed, rebuilt for the new columns and the new rule.
drop function public.get_feed();

create function public.get_feed()
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
      p.country,
      public.normalize_place(p.city) as city
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
    -- a shared way of working: both Remote, or both Local in the same place
    and (
      ('remote' = any (me.work_modes) and 'remote' = any (p.work_modes))
      or (
        'local' = any (me.work_modes) and 'local' = any (p.work_modes)
        and me.country is not null and me.country = p.country
        and me.city is not null and me.city = public.normalize_place(p.city)
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

revoke execute on function public.get_feed() from public, anon;
grant execute on function public.get_feed() to authenticated;
