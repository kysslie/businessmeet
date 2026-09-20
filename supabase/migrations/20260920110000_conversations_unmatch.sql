-- Elie's decisions B and C, 2026-09-20: chat is built around CONVERSATIONS WITH PARTICIPANTS
-- (not one chat per match), matches never expire, and a match can be undone with "unmatch".
--
-- Data touched: none. `messages` and `matches` were empty when this was written (checked
-- 2026-09-20), and the migration would stop with an error if they were not.
--
-- What changes:
--   * new tables `conversations` and `conversation_participants`
--   * `messages` points at a conversation (conversation_id) instead of a match (match_id)
--   * `matches` gets conversation_id, unmatched_at, unmatched_by
--   * the match trigger creates the 'direct' conversation with its two participants
--   * `unmatch()`: marks the match unmatched and archives the conversation (read-only);
--     messages are never deleted
--   * reading: only a current participant (left_at is null), and never between two people
--     where one blocked the other; writing: also only if the conversation is not archived
--   * profile visibility for chat partners follows the conversation, so after an unmatch the
--     archived chat still shows the other person's name and photo; if that person deleted
--     their account, their participant row is gone and the app shows "Utilisateur supprimé"
--   * realtime is switched on for messages

-- 1. Conversations and their participants.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null default 'direct' check (type in ('direct', 'group')),
  archived_at timestamptz
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (conversation_id, user_id)
);

create index conversation_participants_user_id_idx on public.conversation_participants (user_id);

-- 2. Matches point at their conversation and can be unmatched (kept, never deleted).
alter table public.matches
  add column conversation_id uuid references public.conversations (id) on delete cascade,
  add column unmatched_at timestamptz,
  add column unmatched_by uuid references public.profiles (id) on delete set null;

alter table public.matches alter column conversation_id set not null;
create unique index matches_conversation_id_key on public.matches (conversation_id);

-- 3. Messages belong to a conversation.
drop policy "messages: read in own matches" on public.messages;
drop policy "messages: send in own matches" on public.messages;
drop index public.messages_match_id_created_at_idx;

alter table public.messages
  drop column match_id,
  add column conversation_id uuid not null references public.conversations (id) on delete cascade;

create index messages_conversation_id_created_at_idx on public.messages (conversation_id, created_at);

-- 4. Who may read or write a conversation. SECURITY DEFINER so the rules can look at
-- participants and blocks without running into row level security themselves.
-- A conversation is readable by its current participants, unless one of the participants
-- blocked another (a block hides the conversation from both). It is writable only while it
-- is not archived.
create function public.is_conversation_reader(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_participants me
    where me.conversation_id = conv
      and me.user_id = (select auth.uid())
      and me.left_at is null
      and not exists (
        select 1
        from public.conversation_participants other
        join public.blocks b
          on (b.blocker_id = me.user_id and b.blocked_id = other.user_id)
          or (b.blocker_id = other.user_id and b.blocked_id = me.user_id)
        where other.conversation_id = conv
          and other.user_id <> me.user_id
      )
  );
$$;

create function public.can_write_conversation(conv uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_conversation_reader(conv)
     and exists (
       select 1 from public.conversations c
       where c.id = conv and c.archived_at is null
     );
$$;

revoke execute on function public.is_conversation_reader(uuid) from public, anon;
revoke execute on function public.can_write_conversation(uuid) from public, anon;
grant execute on function public.is_conversation_reader(uuid) to authenticated;
grant execute on function public.can_write_conversation(uuid) to authenticated;

-- 5. Access: grants, then row level security. Nobody writes conversations or participants
-- directly; the match trigger, unmatch() and the account-deletion cascade do.
revoke all on table public.conversations, public.conversation_participants from anon, authenticated;
grant select on public.conversations, public.conversation_participants to authenticated;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;

create policy "conversations: read as participant"
  on public.conversations for select to authenticated
  using (public.is_conversation_reader(id));

create policy "conversation_participants: read in own conversations"
  on public.conversation_participants for select to authenticated
  using (public.is_conversation_reader(conversation_id));

create policy "messages: read in own conversations"
  on public.messages for select to authenticated
  using (public.is_conversation_reader(conversation_id));

create policy "messages: send in own open conversations"
  on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.can_write_conversation(conversation_id)
  );

-- 6. Chat partners can see each other's profile (photo, name, answers). This now follows the
-- conversation, so it survives an unmatch (the archived chat keeps the name and photo) and
-- ends with a block or when the other person deletes their account.
create or replace function public.is_match_partner(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
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
  );
$$;

-- 7. The match trigger now also creates the conversation (same transaction, same lock).
create or replace function public.create_match_on_mutual_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_user uuid := least(new.swiper_id, new.target_id);
  second_user uuid := greatest(new.swiper_id, new.target_id);
  new_conversation uuid;
begin
  -- one lock per pair of people, the same whichever of them is swiping
  perform pg_advisory_xact_lock(
    hashtextextended(first_user::text || ':' || second_user::text, 0)
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

  -- a match that already exists (even an unmatched one) is never created twice
  if exists (
    select 1 from public.matches m where m.user_a = first_user and m.user_b = second_user
  ) then
    return new;
  end if;

  insert into public.conversations (type) values ('direct') returning id into new_conversation;

  insert into public.conversation_participants (conversation_id, user_id)
  values (new_conversation, first_user), (new_conversation, second_user);

  insert into public.matches (user_a, user_b, conversation_id)
  values (first_user, second_user, new_conversation);

  return new;
end;
$$;

-- 8. Unmatch: either person can end the match. It stays in the database (unmatched_at) and the
-- conversation is archived (read-only for both). Nothing is deleted. Calling it again does nothing.
create function public.unmatch(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_match public.matches%rowtype;
begin
  select * into found_match
  from public.matches m
  where m.id = p_match_id
    and (select auth.uid()) in (m.user_a, m.user_b)
  for update;

  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;

  if found_match.unmatched_at is not null then
    return;
  end if;

  update public.matches
  set unmatched_at = now(), unmatched_by = (select auth.uid())
  where id = found_match.id;

  update public.conversations
  set archived_at = coalesce(archived_at, now())
  where id = found_match.conversation_id;
end;
$$;

revoke execute on function public.unmatch(uuid) from public, anon;
grant execute on function public.unmatch(uuid) to authenticated;

-- 9. When someone deletes their account their participant row goes with it (and so do the
-- messages they wrote, as before: right to erasure). The other person keeps the conversation,
-- now archived and read-only. If nobody is left, the conversation is deleted too.
create function public.on_participant_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.conversation_participants p
    where p.conversation_id = old.conversation_id
      and p.user_id <> old.user_id
  ) then
    update public.conversations
    set archived_at = coalesce(archived_at, now())
    where id = old.conversation_id and type = 'direct';
  else
    delete from public.conversations where id = old.conversation_id;
  end if;
  return old;
end;
$$;

revoke execute on function public.on_participant_removed() from public, anon, authenticated;

create trigger conversation_participants_removed
  after delete on public.conversation_participants
  for each row execute function public.on_participant_removed();

-- 10. Realtime: new messages are pushed to the people who may read them.
alter publication supabase_realtime add table public.messages;
