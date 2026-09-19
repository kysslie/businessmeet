-- F5: mutual matches.
--
-- When someone likes a person who has already liked them back, a row in `matches` is
-- created, in the same transaction as the second like (so it cannot be lost or doubled).
--
-- SECURITY DEFINER with a fixed search_path, because the trigger has to read the OTHER
-- person's swipe (which row level security hides from the person swiping) and write to
-- `matches` (which no user is allowed to write to). It is kept small on purpose.
--
-- Rules:
--   * only a "like" can create a match (a pass never does)
--   * the other person must already have LIKED (not passed on) this person
--   * both must have finished onboarding
--   * nobody blocked the other, in either direction
--   * the pair is stored in a fixed order (user_a < user_b) and can exist only once
--
-- Race safety: if two people like each other at the same moment, each transaction could
-- miss the other's not-yet-committed like and no match would form. To prevent that, every
-- like first takes a short lock that is the same for both directions of the pair, so the
-- second one waits for the first to finish and then sees its like.

create function public.create_match_on_mutual_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- one lock per pair of people, the same whichever of them is swiping
  perform pg_advisory_xact_lock(
    hashtextextended(
      least(new.swiper_id, new.target_id)::text || ':' || greatest(new.swiper_id, new.target_id)::text,
      0
    )
  );

  -- the other person must have liked this person already
  if not exists (
    select 1
    from public.swipes s
    where s.swiper_id = new.target_id
      and s.target_id = new.swiper_id
      and s.direction = 'like'
  ) then
    return new;
  end if;

  -- both people must have finished onboarding
  if (
    select count(*)
    from public.profiles p
    where p.id in (new.swiper_id, new.target_id) and p.onboarded
  ) < 2 then
    return new;
  end if;

  -- nobody blocked anybody
  if exists (
    select 1
    from public.blocks b
    where (b.blocker_id = new.swiper_id and b.blocked_id = new.target_id)
       or (b.blocker_id = new.target_id and b.blocked_id = new.swiper_id)
  ) then
    return new;
  end if;

  insert into public.matches (user_a, user_b)
  values (
    least(new.swiper_id, new.target_id),
    greatest(new.swiper_id, new.target_id)
  )
  on conflict (user_a, user_b) do nothing;

  return new;
end;
$$;

revoke execute on function public.create_match_on_mutual_like() from public, anon, authenticated;

create trigger swipes_create_match
  after insert on public.swipes
  for each row
  when (new.direction = 'like')
  execute function public.create_match_on_mutual_like();
