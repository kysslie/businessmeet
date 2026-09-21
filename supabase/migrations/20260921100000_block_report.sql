-- F7: block and report.
--
-- Data touched: none. This only adds functions, a trigger and a view.
--
--   * Blocking: whichever way a block is recorded, any match between the two people is marked
--     unmatched and their conversation is archived (read-only, nothing deleted). Reading the
--     conversation and each other's profile is already refused between blocked people (F6), and
--     the feed and the match trigger already skip them (F4, F5), so they disappear from each
--     other completely and the blocked person is never told.
--   * get_blocked_profiles(): lists the people YOU blocked with their name and photo path, for
--     the block list. Needed because a block hides the other person's profile from you too.
--   * admin_reports: an admin-only view for reading reports in the Supabase SQL editor
--     (no access at all for app users).

-- 1. A block ends the match and archives the conversation.
create function public.on_block_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_user uuid := least(new.blocker_id, new.blocked_id);
  second_user uuid := greatest(new.blocker_id, new.blocked_id);
begin
  update public.matches
  set unmatched_at = coalesce(unmatched_at, now()),
      unmatched_by = coalesce(unmatched_by, new.blocker_id)
  where user_a = first_user and user_b = second_user;

  update public.conversations
  set archived_at = coalesce(archived_at, now())
  where id in (
    select m.conversation_id
    from public.matches m
    where m.user_a = first_user and m.user_b = second_user
  );

  return new;
end;
$$;

revoke execute on function public.on_block_created() from public, anon, authenticated;

create trigger blocks_end_match
  after insert on public.blocks
  for each row execute function public.on_block_created();

-- 2. The people I blocked (only mine, newest first).
create function public.get_blocked_profiles()
returns table (
  id uuid,
  display_name text,
  avatar_path text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.avatar_path, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = (select auth.uid())
  order by b.created_at desc;
$$;

revoke execute on function public.get_blocked_profiles() from public, anon;
grant execute on function public.get_blocked_profiles() to authenticated;

-- 3. Reports, readable by you in the SQL editor:  select * from public.admin_reports;
create view public.admin_reports
  with (security_invoker = true) as
select
  r.id,
  r.created_at,
  r.reason,
  r.details,
  r.reporter_id,
  reporter.display_name as reporter_name,
  reporter_account.email as reporter_email,
  r.reported_id,
  reported.display_name as reported_name,
  reported_account.email as reported_email
from public.reports r
left join public.profiles reporter on reporter.id = r.reporter_id
left join auth.users reporter_account on reporter_account.id = r.reporter_id
left join public.profiles reported on reported.id = r.reported_id
left join auth.users reported_account on reported_account.id = r.reported_id
order by r.created_at desc;

revoke all on public.admin_reports from anon, authenticated;
