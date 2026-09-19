-- F1, migration 2 of 3: who can do what.
--
-- Two layers, both must allow an action:
--   1. GRANTs: which kinds of action a role may attempt on a table at all.
--   2. Row level security (RLS) policies: which rows that action may touch.
--
-- Supabase can hand out broad default grants on new tables, so we take everything
-- back from the public-facing roles first, then grant only what is needed.
-- Logged-out visitors (role `anon`) get nothing. Logged-in users are `authenticated`.
-- The server-only secret key (role `service_role`) is not affected by any of this.
--
-- Not created here on purpose:
--   * no INSERT policy on profiles (the sign-up trigger creates the row)
--   * no policy that lets users create matches (the F5 trigger does that)
--   * no way for a user to read anyone else's swipes, blocks, or reports
--   * no direct read of other people's profiles: the feed function (F4) will hand
--     those out, so nobody can scrape the whole user list from the API

-- ---------------------------------------------------------------------------
-- 1. GRANTs
-- ---------------------------------------------------------------------------

revoke all on table
  public.categories,
  public.skills,
  public.profiles,
  public.profile_categories,
  public.profile_skills,
  public.swipes,
  public.matches,
  public.messages,
  public.blocks,
  public.reports
from anon, authenticated;

grant select on public.categories, public.skills to authenticated;

grant select on public.profiles to authenticated;
-- Column-level: users may edit their own details but never id / created_at / updated_at.
grant update (
  display_name, avatar_path, city, work_mode, idea_status,
  pitch, weekly_hours, partner_weekly_hours, ambition, onboarded
) on public.profiles to authenticated;

grant select, insert, delete on public.profile_categories to authenticated;
grant select, insert, delete on public.profile_skills to authenticated;
grant select, insert on public.swipes to authenticated;
grant select on public.matches to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant insert on public.reports to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Row level security
-- ---------------------------------------------------------------------------

alter table public.categories enable row level security;
alter table public.skills enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_categories enable row level security;
alter table public.profile_skills enable row level security;
alter table public.swipes enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

-- Helper: is the given user someone I have matched with?
-- SECURITY INVOKER (the default), so it only ever sees the matches RLS lets me see.
create function public.is_match_partner(other_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.matches m
    where (m.user_a = (select auth.uid()) and m.user_b = other_user)
       or (m.user_b = (select auth.uid()) and m.user_a = other_user)
  );
$$;

revoke execute on function public.is_match_partner(uuid) from public, anon;
grant execute on function public.is_match_partner(uuid) to authenticated;

-- Categories and skills: any logged-in user can read them (they are not secret).
-- Nobody can change them through the API; change them with migrations or the dashboard.
create policy "categories: read"
  on public.categories for select to authenticated
  using (true);

create policy "skills: read"
  on public.skills for select to authenticated
  using (true);

-- Profiles: read your own, and the profiles of people you matched with.
create policy "profiles: read own or matched"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_match_partner(id));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Profile categories: manage your own (active categories only); read yours and matches'.
create policy "profile_categories: read own or matched"
  on public.profile_categories for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_match_partner(profile_id));

create policy "profile_categories: add own active"
  on public.profile_categories for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.categories c
      where c.id = category_id and c.is_active
    )
  );

create policy "profile_categories: delete own"
  on public.profile_categories for delete to authenticated
  using (profile_id = (select auth.uid()));

-- Profile skills: same idea.
create policy "profile_skills: read own or matched"
  on public.profile_skills for select to authenticated
  using (profile_id = (select auth.uid()) or public.is_match_partner(profile_id));

create policy "profile_skills: add own active"
  on public.profile_skills for insert to authenticated
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1 from public.skills s
      where s.id = skill_id and s.is_active
    )
  );

create policy "profile_skills: delete own"
  on public.profile_skills for delete to authenticated
  using (profile_id = (select auth.uid()));

-- Swipes: you can record your own swipes and see your own. Swipes cannot be changed
-- or deleted, so anyone you swiped on never comes back to the feed.
create policy "swipes: read own"
  on public.swipes for select to authenticated
  using (swiper_id = (select auth.uid()));

create policy "swipes: add own"
  on public.swipes for insert to authenticated
  with check (swiper_id = (select auth.uid()));

-- Matches: read-only, and only ones you are part of. Created by the F5 trigger.
create policy "matches: read own"
  on public.matches for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

-- Messages: read and send only inside matches you are part of, only as yourself.
create policy "messages: read in own matches"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = match_id and (select auth.uid()) in (m.user_a, m.user_b)
    )
  );

create policy "messages: send in own matches"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.matches m
      where m.id = match_id and (select auth.uid()) in (m.user_a, m.user_b)
    )
  );

-- Blocks: you manage your own block list. The blocked person cannot see it.
create policy "blocks: read own"
  on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

create policy "blocks: add own"
  on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));

create policy "blocks: delete own"
  on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- Reports: write-only for users. Only you (in the Supabase dashboard) can read them.
create policy "reports: add own"
  on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
