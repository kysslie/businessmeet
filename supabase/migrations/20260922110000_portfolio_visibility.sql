-- P3 ("Le CV de l'entrepreneur"): the public portfolio page, and who gets to see a profile.
--
-- Data touched: every existing profile row gets `visibility = 'private'` (no change in who sees
-- them today; nothing else about the row changes). Approved by Elie, 2026-09-22.
--
-- New profiles.columns:
--   * visibility          'private' | 'members' | 'public', no default: onboarding cannot
--                         complete without an explicit choice (extends profiles_onboarded_complete)
--   * slug                permanent portfolio link id, assigned by the database the moment
--                         onboarding completes, never editable by anyone (no UPDATE grant at all)
--   * open_to_partners    stored now; does nothing until matching returns (see CLAUDE.md)
--   * search_indexable    controls the <meta name="robots"> tag on the public page
--   * page_views          moved only by increment_page_view(), never by a direct UPDATE
--
-- Who can see a profile (single source of truth: portfolio_visible_to()):
--   * the owner always sees their own page
--   * 'private': nobody else (unchanged rule: only a match or a shared Parcours, via the
--     existing "profiles: read own or matched" table policy, untouched by this migration)
--   * 'members': any logged-in visitor, unless a block exists between the two (either direction)
--   * 'public': anyone, including logged out; a block only applies if the visitor is logged in
--     (there is no way to identify, let alone block, an anonymous visitor)
--
-- On purpose, the raw `profiles` table's own RLS policy is NOT widened to cover 'members' or
-- 'public': every non-match read of another profile goes through get_public_profile() /
-- get_public_projects() (both SECURITY DEFINER, both call portfolio_visible_to()). This keeps
-- "no bulk listing" true by construction: there is no table policy a future feature could
-- accidentally query in bulk against, only a slug-at-a-time function (see CLAUDE.md).
--
-- A public project only shows if BOTH the project itself is `visibility = 'public'` (P2) AND
-- the owning profile passes portfolio_visible_to() for the current viewer. A private project
-- never shows to anyone but the owner, regardless of the profile's level.

-- 1. Columns.
alter table public.profiles
  add column visibility text check (visibility in ('private', 'members', 'public')),
  add column slug text unique,
  add column open_to_partners boolean not null default false,
  add column search_indexable boolean not null default false,
  add column page_views integer not null default 0;

-- Existing accounts: no change in who sees them today.
update public.profiles set visibility = 'private' where visibility is null;

-- Onboarding cannot complete without a choice (same style as every other required field).
alter table public.profiles drop constraint profiles_onboarded_complete;
alter table public.profiles
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
        and visibility is not null
        and (not coalesce('local' = any (work_modes), false) or (city is not null and btrim(city) <> ''))
        and (
          not coalesce('local' = any (work_modes), false)
          or country <> 'FR'
          or postal_code is not null
        )
        and (not coalesce('has_idea' = any (idea_statuses), false) or (pitch is not null and btrim(pitch) <> ''))
      )
    );

-- 2. Slug: assigned once, by the database, the moment onboarding completes. First word of the
-- display name (accents stripped, lowercased) plus 4 random hex characters, retried on
-- collision. Never touched again (there is no UPDATE grant on this column for anyone).
create function public.assign_profile_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  base text;
  candidate text;
  i int;
begin
  if new.slug is not null or new.onboarded is not true then
    return new;
  end if;

  base := lower(regexp_replace(
    extensions.unaccent('extensions.unaccent', coalesce(split_part(new.display_name, ' ', 1), '')),
    '[^a-z0-9]', '', 'g'
  ));
  if base = '' then
    base := 'membre';
  end if;
  base := left(base, 20);

  for i in 1..20 loop
    candidate := base || '-' || substr(md5(random()::text), 1, 4);
    if not exists (select 1 from public.profiles where slug = candidate) then
      new.slug := candidate;
      return new;
    end if;
  end loop;

  -- Practically unreachable (20 collisions in a row), but never leave onboarding blocked.
  new.slug := base || '-' || substr(new.id::text, 1, 8);
  return new;
end;
$$;

create trigger profiles_assign_slug
  before insert or update on public.profiles
  for each row execute function public.assign_profile_slug();

-- 3. Who can see a profile: one function, reused by everything below.
create function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks bl
    where (bl.blocker_id = a and bl.blocked_id = b) or (bl.blocker_id = b and bl.blocked_id = a)
  );
$$;

create function public.portfolio_visible_to(p_owner_id uuid, p_visibility text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer uuid := (select auth.uid());
begin
  if viewer = p_owner_id then
    return true;
  end if;
  if p_visibility = 'private' then
    return false;
  end if;
  if p_visibility = 'members' and viewer is null then
    return false;
  end if;
  -- A block only applies to a viewer we can identify. A public profile stays visible to a
  -- logged-out visitor even if that person blocked (or was blocked by) the owner while logged in.
  if viewer is not null and public.is_blocked(viewer, p_owner_id) then
    return false;
  end if;
  return p_visibility in ('members', 'public');
end;
$$;

revoke execute on function public.is_blocked(uuid, uuid), public.portfolio_visible_to(uuid, text)
  from public, anon, authenticated;

-- 4. The public page's data, curated (never postal code, pitch, hours, SIRET, or private projects).
create function public.get_public_profile(p_slug text)
returns table (
  display_name text,
  avatar_path text,
  country text,
  city text,
  open_to_partners boolean,
  search_indexable boolean,
  category_names text[],
  offers text[],
  seeks text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target public.profiles%rowtype;
begin
  select * into target from public.profiles p where p.slug = p_slug and p.onboarded = true;
  if not found or not public.portfolio_visible_to(target.id, target.visibility) then
    return;
  end if;

  return query
    select
      target.display_name,
      target.avatar_path,
      target.country,
      target.city,
      target.open_to_partners,
      target.search_indexable,
      (
        select array_agg(c.name order by c.sort_order)
        from public.profile_categories pc
        join public.categories c on c.id = pc.category_id
        where pc.profile_id = target.id
      ),
      (
        select array_agg(s.name order by s.name)
        from public.profile_skills ps
        join public.skills s on s.id = ps.skill_id
        where ps.profile_id = target.id and ps.kind = 'offers'
      ),
      (
        select array_agg(s.name order by s.name)
        from public.profile_skills ps
        join public.skills s on s.id = ps.skill_id
        where ps.profile_id = target.id and ps.kind = 'seeks'
      );
end;
$$;

create function public.get_public_projects(p_slug text)
returns table (
  id uuid,
  name text,
  category_name text,
  started_on date,
  ended_on date,
  role text,
  outcome text,
  lessons text,
  links jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target public.profiles%rowtype;
begin
  select * into target from public.profiles p where p.slug = p_slug and p.onboarded = true;
  if not found or not public.portfolio_visible_to(target.id, target.visibility) then
    return;
  end if;

  return query
    select
      pr.id, pr.name, c.name, pr.started_on, pr.ended_on, pr.role, pr.outcome, pr.lessons,
      coalesce(
        (
          select jsonb_agg(jsonb_build_object('label', pl.label, 'url', pl.url) order by pl.created_at)
          from public.project_links pl
          where pl.project_id = pr.id
        ),
        '[]'::jsonb
      )
    from public.projects pr
    join public.categories c on c.id = pr.category_id
    where pr.owner_id = target.id and pr.visibility = 'public'
    order by pr.started_on desc;
end;
$$;

-- Never counts the owner's own visits, never counts a visit that could not actually see the
-- page, and stores nothing about the visitor.
create function public.increment_page_view(p_slug text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.profiles%rowtype;
begin
  select * into target from public.profiles p where p.slug = p_slug and p.onboarded = true;
  if not found then
    return;
  end if;
  if target.id = (select auth.uid()) then
    return;
  end if;
  if not public.portfolio_visible_to(target.id, target.visibility) then
    return;
  end if;
  update public.profiles set page_views = page_views + 1 where id = target.id;
end;
$$;

revoke execute on function
  public.get_public_profile(text), public.get_public_projects(text), public.increment_page_view(text)
from public;
grant execute on function
  public.get_public_profile(text), public.get_public_projects(text), public.increment_page_view(text)
to anon, authenticated;

-- 5. Column access on the new profiles columns. slug and page_views have no UPDATE grant at
-- all: nobody, not even the owner, can set them directly.
grant select (visibility, slug, open_to_partners, search_indexable, page_views)
  on public.profiles to authenticated;
grant update (visibility, open_to_partners, search_indexable)
  on public.profiles to authenticated;
