-- F4: the swipe feed.
--
-- get_feed() returns up to 20 profiles the logged-in user can swipe on. The rules
-- (from CLAUDE.md section 4):
--   * not yourself, and only people who finished onboarding (and you must have too)
--   * not someone you already swiped on (like or pass), so they never come back
--   * not blocked, in either direction
--   * shares at least one ACTIVE category with you
--   * work-mode compatible: if you are Remote OK you see everyone in shared
--     categories; if you are Local only you see only people in the same city
--     (compared case-insensitively, ignoring spaces around the text)
--
-- SECURITY DEFINER, because people cannot read each other's profiles directly (see
-- the profiles policy in migration 2); this function is the controlled way to see
-- other people. It works out who you are from auth.uid() and accepts no user id, so
-- nobody can ask for someone else's feed. It returns only what a swipe card shows.
-- Fixed search_path so it cannot be tricked into using look-alike tables.

create function public.get_feed()
returns table (
  id uuid,
  display_name text,
  avatar_path text,
  city text,
  work_mode text,
  idea_status text,
  pitch text,
  weekly_hours text,
  partner_weekly_hours text,
  ambition text,
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
      p.work_mode,
      nullif(lower(btrim(p.city)), '') as city
    from public.profiles p
    where p.id = (select auth.uid())
      and p.onboarded
  )
  select
    p.id,
    p.display_name,
    p.avatar_path,
    p.city,
    p.work_mode,
    p.idea_status,
    p.pitch,
    p.weekly_hours,
    p.partner_weekly_hours,
    p.ambition,
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
    -- work mode: Remote OK sees everyone; Local only sees the same city
    and (
      me.work_mode = 'remote_ok'
      or (me.city is not null and me.city = nullif(lower(btrim(p.city)), ''))
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
