-- F1, migration 1 of 3: tables, constraints, indexes, and the two small triggers.
-- Security (grants + row level security) is in migration 2. Seed data is in migration 3.
--
-- Every foreign key that points at a user uses ON DELETE CASCADE, so deleting the
-- auth user (account deletion, F8) removes all of that user's data.
-- Chain: auth.users -> profiles -> everything else.

-- ---------------------------------------------------------------------------
-- Categories and skills: data, not code. Activating a category = flip is_active.
-- ---------------------------------------------------------------------------

create table public.categories (
  id integer generated always as identity primary key,
  slug text not null unique,
  name text not null,
  is_active boolean not null default false,
  sort_order integer not null default 0
);

create table public.skills (
  id integer generated always as identity primary key,
  slug text not null unique,
  name text not null,
  -- null = universal skill, shown for every category
  category_id integer references public.categories (id) on delete restrict,
  is_active boolean not null default true
);

create index skills_category_id_idx on public.skills (category_id);

-- ---------------------------------------------------------------------------
-- Profiles: one row per auth user, created automatically at sign-up (see trigger
-- below). Fields stay empty until onboarding; `onboarded` flips to true only when
-- the required fields are filled in (enforced by profiles_onboarded_complete).
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_path text,
  city text,
  work_mode text,
  idea_status text,
  pitch text,
  weekly_hours text,
  -- Hours per week the person would like a partner to commit (same ranges as
  -- weekly_hours). Optional: null = no preference.
  partner_weekly_hours text,
  ambition text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_display_name_length
    check (display_name is null or char_length(btrim(display_name)) between 1 and 50),
  constraint profiles_city_length
    check (city is null or char_length(city) <= 100),
  constraint profiles_work_mode_values
    check (work_mode in ('remote_ok', 'local_only')),
  constraint profiles_idea_status_values
    check (idea_status in ('has_idea', 'wants_to_join', 'exploring')),
  constraint profiles_weekly_hours_values
    check (weekly_hours in ('lt_5', '5_10', '10_20', '20_plus')),
  constraint profiles_partner_weekly_hours_values
    check (partner_weekly_hours in ('lt_5', '5_10', '10_20', '20_plus')),
  constraint profiles_ambition_values
    check (ambition in ('for_fun', 'side_income', 'full_time')),
  constraint profiles_pitch_length
    check (pitch is null or char_length(pitch) <= 280),
  -- A profile can only be marked onboarded when it is complete:
  --  * name, work mode, idea status, weekly hours and ambition are set
  --  * local-only people must give a city (the feed matches them by city)
  --  * people with an idea must write a pitch
  constraint profiles_onboarded_complete
    check (
      not onboarded
      or (
        display_name is not null
        and work_mode is not null
        and idea_status is not null
        and weekly_hours is not null
        and ambition is not null
        and (work_mode <> 'local_only' or (city is not null and btrim(city) <> ''))
        and (idea_status <> 'has_idea' or (pitch is not null and btrim(pitch) <> ''))
      )
    )
);

-- Keep updated_at honest.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create an empty profile row whenever someone signs up (pattern from the Supabase
-- docs). SECURITY DEFINER because the sign-up itself is not allowed to write to
-- public.profiles. Kept minimal on purpose: if this trigger fails, sign-up fails.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- What each profile is into / good at / looking for
-- ---------------------------------------------------------------------------

create table public.profile_categories (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  category_id integer not null references public.categories (id) on delete restrict,
  primary key (profile_id, category_id)
);

create index profile_categories_category_id_idx on public.profile_categories (category_id);

create table public.profile_skills (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  skill_id integer not null references public.skills (id) on delete restrict,
  kind text not null check (kind in ('offers', 'seeks')),
  primary key (profile_id, skill_id, kind)
);

create index profile_skills_skill_id_idx on public.profile_skills (skill_id);

-- ---------------------------------------------------------------------------
-- Swipes, matches, messages
-- ---------------------------------------------------------------------------

create table public.swipes (
  swiper_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  direction text not null check (direction in ('like', 'pass')),
  created_at timestamptz not null default now(),
  primary key (swiper_id, target_id),
  constraint swipes_not_self check (swiper_id <> target_id)
);

create index swipes_target_id_idx on public.swipes (target_id);

-- The pair is stored in a fixed order (user_a < user_b) so a match can never exist
-- twice with the two people swapped.
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint matches_ordered check (user_a < user_b),
  constraint matches_pair_unique unique (user_a, user_b)
);

create index matches_user_b_idx on public.matches (user_b);

create table public.messages (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_length
    check (char_length(btrim(body)) > 0 and char_length(body) <= 2000)
);

create index messages_match_id_created_at_idx on public.messages (match_id, created_at);
create index messages_sender_id_idx on public.messages (sender_id);

-- ---------------------------------------------------------------------------
-- Safety: blocks and reports
-- ---------------------------------------------------------------------------

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_id_idx on public.blocks (blocked_id);

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 100),
  details text check (details is null or char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  constraint reports_not_self check (reporter_id <> reported_id)
);

create index reports_reporter_id_idx on public.reports (reporter_id);
create index reports_reported_id_idx on public.reports (reported_id);
