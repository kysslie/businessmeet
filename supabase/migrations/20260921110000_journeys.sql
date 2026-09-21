-- Parcours ("journey", Elie's core concept, 2026-09-21): a match can become a group.
--
-- Data touched: none. New tables and functions; two existing helper functions are extended.
--
--   * journeys          a named group with a short goal and its own GROUP conversation (F6 model)
--   * journey_members   who is invited or active (joined_at / left_at)
--   * journey_links     the stored tools ("Nos outils"): WhatsApp, Discord, X, Drive, website, other
--
-- Rules (all enforced here, in the database):
--   * either matched person starts a parcours from their match; the other is INVITED and must
--     accept (nobody is pulled in without saying yes)
--   * an active member can invite people they have an active match with; the person accepts;
--     never someone blocked from (or blocking) any current member; at most 10 people
--   * a member can leave; with fewer than 2 active members the parcours and its chat are
--     archived (read-only). Nothing is deleted.
--   * only active members can read the parcours, its members' names/photos, its links and chat
--   * links must be https:// only. Private invite links (WhatsApp, Discord, Drive) are for
--     members only; there is no public page yet (Phase 2), so the private/public flag is only
--     stored for later.
--   * in a group chat a block between two members does not hide the whole chat from the rest
--     (that rule stays for 1:1 chats)

-- 1. Tables.
create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  goal text check (goal is null or char_length(goal) <= 280),
  created_by uuid references public.profiles (id) on delete set null,
  conversation_id uuid not null unique references public.conversations (id) on delete cascade,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.journey_members (
  journey_id uuid not null references public.journeys (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('invited', 'active')),
  invited_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (journey_id, user_id)
);

create index journey_members_user_id_idx on public.journey_members (user_id);

create table public.journey_links (
  id bigint generated always as identity primary key,
  journey_id uuid not null references public.journeys (id) on delete cascade,
  added_by uuid references public.profiles (id) on delete set null,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  url text not null
    constraint journey_links_url_https
    check (char_length(url) <= 500 and url ~ '^https://[^[:space:]]+$'),
  kind text not null check (kind in ('whatsapp', 'discord', 'x', 'drive', 'website', 'other')),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now()
);

create index journey_links_journey_id_idx on public.journey_links (journey_id);

-- 2. Who is who (SECURITY DEFINER so the rules can read membership without recursion).
create function public.is_journey_member(j uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.journey_members jm
    where jm.journey_id = j
      and jm.user_id = (select auth.uid())
      and jm.status = 'active'
      and jm.left_at is null
  );
$$;

-- an active member of a parcours that is not archived (the only people who may change it)
create function public.is_open_journey_member(j uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_journey_member(j)
     and exists (select 1 from public.journeys x where x.id = j and x.archived_at is null);
$$;

create function public.is_journey_invitee(j uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.journey_members jm
    where jm.journey_id = j
      and jm.user_id = (select auth.uid())
      and jm.status = 'invited'
      and jm.left_at is null
  );
$$;

revoke execute on function public.is_journey_member(uuid), public.is_open_journey_member(uuid),
  public.is_journey_invitee(uuid) from public, anon;
grant execute on function public.is_journey_member(uuid), public.is_open_journey_member(uuid),
  public.is_journey_invitee(uuid) to authenticated;

-- 3. Access: nobody creates or deletes parcours or members directly (the functions below do).
revoke all on table public.journeys, public.journey_members, public.journey_links from anon, authenticated;
grant select on public.journeys, public.journey_members to authenticated;
grant update (name, goal) on public.journeys to authenticated;
grant select, insert, delete on public.journey_links to authenticated;

alter table public.journeys enable row level security;
alter table public.journey_members enable row level security;
alter table public.journey_links enable row level security;

create policy "journeys: read as member or invitee"
  on public.journeys for select to authenticated
  using (public.is_journey_member(id) or public.is_journey_invitee(id));

create policy "journeys: members edit name and goal"
  on public.journeys for update to authenticated
  using (public.is_open_journey_member(id))
  with check (public.is_open_journey_member(id));

create policy "journey_members: read own row or, as a member, all rows"
  on public.journey_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_journey_member(journey_id));

create policy "journey_links: members read"
  on public.journey_links for select to authenticated
  using (public.is_journey_member(journey_id));

create policy "journey_links: members add their own"
  on public.journey_links for insert to authenticated
  with check (added_by = (select auth.uid()) and public.is_open_journey_member(journey_id));

create policy "journey_links: adder or creator removes"
  on public.journey_links for delete to authenticated
  using (
    public.is_open_journey_member(journey_id)
    and (
      added_by = (select auth.uid())
      or exists (
        select 1 from public.journeys j
        where j.id = journey_id and j.created_by = (select auth.uid())
      )
    )
  );

-- 4. Group chats: a block between two members hides the chat only in 1:1 conversations.
create or replace function public.is_conversation_reader(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_participants me
    join public.conversations c on c.id = me.conversation_id
    where me.conversation_id = conv
      and me.user_id = (select auth.uid())
      and me.left_at is null
      and (
        c.type = 'group'
        or not exists (
          select 1
          from public.conversation_participants other
          join public.blocks b
            on (b.blocker_id = me.user_id and b.blocked_id = other.user_id)
            or (b.blocker_id = other.user_id and b.blocked_id = me.user_id)
          where other.conversation_id = conv
            and other.user_id <> me.user_id
        )
      )
  );
$$;

-- 5. People who share a parcours can see each other's profile (name, photo, answers), unless
-- blocked. (Same function as before, plus this second way of being connected.)
create or replace function public.is_match_partner(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.conversation_participants me
      join public.conversations c on c.id = me.conversation_id and c.type = 'direct'
      join public.conversation_participants them
        on them.conversation_id = me.conversation_id
       and them.user_id = other_user
       and them.left_at is null
      where me.user_id = (select auth.uid())
        and me.left_at is null
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id = me.user_id and b.blocked_id = them.user_id)
             or (b.blocker_id = them.user_id and b.blocked_id = me.user_id)
        )
    )
    or exists (
      select 1
      from public.journey_members me
      join public.journey_members them
        on them.journey_id = me.journey_id
       and them.user_id = other_user
       and them.status = 'active'
       and them.left_at is null
      where me.user_id = (select auth.uid())
        and me.status = 'active'
        and me.left_at is null
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id = me.user_id and b.blocked_id = them.user_id)
             or (b.blocker_id = them.user_id and b.blocked_id = me.user_id)
        )
    );
$$;

-- 6. Starting a parcours from an active match. The creator is active, the other person invited.
create function public.start_journey(p_match_id uuid, p_name text, p_goal text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  found_match public.matches%rowtype;
  other uuid;
  new_conversation uuid;
  new_journey uuid;
begin
  select * into found_match
  from public.matches m
  where m.id = p_match_id and me in (m.user_a, m.user_b) and m.unmatched_at is null;
  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;

  other := case when found_match.user_a = me then found_match.user_b else found_match.user_a end;

  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = me and b.blocked_id = other) or (b.blocker_id = other and b.blocked_id = me)
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 1 and 60 then
    raise exception 'invalid name' using errcode = '22023';
  end if;
  if p_goal is not null and char_length(p_goal) > 280 then
    raise exception 'invalid goal' using errcode = '22023';
  end if;

  insert into public.conversations (type) values ('group') returning id into new_conversation;
  insert into public.conversation_participants (conversation_id, user_id) values (new_conversation, me);

  insert into public.journeys (name, goal, created_by, conversation_id)
  values (btrim(p_name), nullif(btrim(coalesce(p_goal, '')), ''), me, new_conversation)
  returning id into new_journey;

  insert into public.journey_members (journey_id, user_id, status, invited_by, joined_at)
  values (new_journey, me, 'active', me, now()),
         (new_journey, other, 'invited', me, null);

  return new_journey;
end;
$$;

-- 7. Inviting someone the caller has an active match with.
create function public.invite_to_journey(p_journey_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if not public.is_open_journey_member(p_journey_id) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if p_user_id is null or p_user_id = me then
    raise exception 'invalid person' using errcode = '22023';
  end if;

  -- only people the caller matched with (and did not unmatch or block)
  if not exists (
    select 1 from public.matches m
    where m.unmatched_at is null
      and m.user_a = least(me, p_user_id)
      and m.user_b = greatest(me, p_user_id)
  ) then
    raise exception 'not matched' using errcode = '42501';
  end if;

  -- never someone blocked from, or blocking, any current member
  if exists (
    select 1
    from public.journey_members jm
    join public.blocks b
      on (b.blocker_id = p_user_id and b.blocked_id = jm.user_id)
      or (b.blocker_id = jm.user_id and b.blocked_id = p_user_id)
    where jm.journey_id = p_journey_id and jm.status = 'active' and jm.left_at is null
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  -- at most 10 people (active or invited)
  if (
    select count(*) from public.journey_members jm
    where jm.journey_id = p_journey_id and jm.left_at is null
  ) >= 10 then
    raise exception 'journey is full' using errcode = '54000';
  end if;

  if exists (
    select 1 from public.journey_members jm
    where jm.journey_id = p_journey_id and jm.user_id = p_user_id
      and jm.left_at is null
  ) then
    raise exception 'already invited or member' using errcode = '23505';
  end if;

  insert into public.journey_members (journey_id, user_id, status, invited_by, joined_at, left_at)
  values (p_journey_id, p_user_id, 'invited', me, null, null)
  on conflict (journey_id, user_id) do update
    set status = 'invited', invited_by = me, joined_at = null, left_at = null, created_at = now();
end;
$$;

-- 8. Accepting or declining an invitation.
create function public.respond_to_journey_invite(p_journey_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  target_journey public.journeys%rowtype;
begin
  select * into target_journey from public.journeys j where j.id = p_journey_id for update;
  if not found or not public.is_journey_invitee(p_journey_id) then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  if p_accept then
    if target_journey.archived_at is not null then
      raise exception 'journey is archived' using errcode = '55000';
    end if;

    update public.journey_members
    set status = 'active', joined_at = now(), left_at = null
    where journey_id = p_journey_id and user_id = me;

    insert into public.conversation_participants (conversation_id, user_id, left_at)
    values (target_journey.conversation_id, me, null)
    on conflict (conversation_id, user_id) do update set left_at = null;
  else
    delete from public.journey_members where journey_id = p_journey_id and user_id = me;

    -- if nobody but the creator is left and nothing is pending, the empty parcours is removed
    if not exists (
      select 1 from public.journey_members jm
      where jm.journey_id = p_journey_id and jm.left_at is null and jm.user_id <> coalesce(target_journey.created_by, me)
    ) then
      delete from public.conversations where id = target_journey.conversation_id;
    end if;
  end if;
end;
$$;

-- 9. Leaving. With fewer than 2 active members the parcours and its chat are archived.
create function public.leave_journey(p_journey_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  target_journey public.journeys%rowtype;
begin
  select * into target_journey from public.journeys j where j.id = p_journey_id for update;
  if not found or not public.is_journey_member(p_journey_id) then
    raise exception 'not a member' using errcode = 'P0002';
  end if;

  update public.journey_members
  set left_at = now()
  where journey_id = p_journey_id and user_id = me;

  update public.conversation_participants
  set left_at = now()
  where conversation_id = target_journey.conversation_id and user_id = me;

  perform public.archive_journey_if_too_small(p_journey_id);
end;
$$;

create function public.archive_journey_if_too_small(p_journey_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*) from public.journey_members jm
    where jm.journey_id = p_journey_id and jm.status = 'active' and jm.left_at is null
  ) < 2 then
    update public.journeys set archived_at = coalesce(archived_at, now()) where id = p_journey_id;
    update public.conversations
    set archived_at = coalesce(archived_at, now())
    where id = (select conversation_id from public.journeys where id = p_journey_id);
  end if;
end;
$$;

-- 10. When a member's account is deleted their member row goes with it (cascade): archive the
-- parcours if too few active members are left.
create function public.on_journey_member_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.journeys where id = old.journey_id) then
    perform public.archive_journey_if_too_small(old.journey_id);
  end if;
  return old;
end;
$$;

create trigger journey_members_removed
  after delete on public.journey_members
  for each row execute function public.on_journey_member_removed();

revoke execute on function public.archive_journey_if_too_small(uuid) from public, anon, authenticated;
revoke execute on function public.on_journey_member_removed() from public, anon, authenticated;
revoke execute on function
  public.start_journey(uuid, text, text),
  public.invite_to_journey(uuid, uuid),
  public.respond_to_journey_invite(uuid, boolean),
  public.leave_journey(uuid)
from public, anon;
grant execute on function
  public.start_journey(uuid, text, text),
  public.invite_to_journey(uuid, uuid),
  public.respond_to_journey_invite(uuid, boolean),
  public.leave_journey(uuid)
to authenticated;
