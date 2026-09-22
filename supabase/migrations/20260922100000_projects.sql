-- P2 ("Le CV de l'entrepreneur", 2026-09-22 pivot): projects a founder documents on their
-- profile, including ones that were abandoned or stopped.
--
-- Data touched: none. Two new tables only.
--
--   * projects       one entry per project: name, category, when, role, outcome, what was
--                     learned, optional SIRET, public/private (the switch does nothing yet --
--                     P3 wires it to a public page)
--   * project_links   up to 5 evidence links per project, https:// only
--
-- Rules (all enforced here, in the database):
--   * only the owner can read, add, edit or delete their own projects and links -- nobody else,
--     logged in or not, even a project marked "public" (that starts working in P3)
--   * a project needs an ACTIVE category (same rule as profile_categories)
--   * "what I learned" is required (Elie, 2026-09-22): a project entry without a lesson is not
--     what this feature is for
--   * dates are month precision only (the day is always the 1st); the end date is required
--     unless the outcome is "ongoing", in which case it must be empty
--   * at most 5 links per project (a trigger, since a plain CHECK cannot count sibling rows)

-- 1. Tables.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  category_id integer not null references public.categories (id) on delete restrict,
  started_on date not null
    check (date_trunc('month', started_on)::date = started_on),
  ended_on date
    check (ended_on is null or date_trunc('month', ended_on)::date = ended_on),
  role text check (role is null or char_length(role) <= 80),
  hours_per_week text check (hours_per_week is null or hours_per_week in ('lt_5', '5_10', '10_20', '20_plus')),
  outcome text not null check (outcome in ('idea_abandoned', 'launched_then_stopped', 'ongoing', 'sold')),
  lessons text not null check (char_length(btrim(lessons)) between 1 and 500),
  siret text check (siret is null or siret ~ '^[0-9]{14}$'),
  visibility text not null default 'private' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_ended_on_order check (ended_on is null or ended_on >= started_on),
  constraint projects_ended_on_matches_outcome check (
    (outcome = 'ongoing' and ended_on is null)
    or (outcome <> 'ongoing' and ended_on is not null)
  )
);

create index projects_owner_id_idx on public.projects (owner_id);
create index projects_category_id_idx on public.projects (category_id);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create table public.project_links (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  label text not null check (char_length(btrim(label)) between 1 and 60),
  url text not null
    constraint project_links_url_https
    check (char_length(url) <= 500 and url ~ '^https://[^[:space:]]+$'),
  created_at timestamptz not null default now()
);

create index project_links_project_id_idx on public.project_links (project_id);

-- At most 5 links per project. A CHECK constraint cannot see sibling rows, so this needs a
-- trigger. It runs with the inserting user's own rights: they can already read their own
-- project's links (see the select policy below), so no elevated privilege is needed here.
create function public.check_project_links_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.project_links where project_id = new.project_id) >= 5 then
    raise exception 'a project can have at most 5 links' using errcode = '54000';
  end if;
  return new;
end;
$$;

create trigger project_links_limit
  before insert on public.project_links
  for each row execute function public.check_project_links_limit();

-- 2. Access: the owner only. No public read yet -- that is wired up in P3.
revoke all on table public.projects, public.project_links from anon, authenticated;

grant select, insert, delete on public.projects to authenticated;
grant update (
  name, category_id, started_on, ended_on, role, hours_per_week, outcome, lessons, siret, visibility
) on public.projects to authenticated;
grant select, insert, delete on public.project_links to authenticated;

alter table public.projects enable row level security;
alter table public.project_links enable row level security;

create policy "projects: read own"
  on public.projects for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "projects: add own, active category"
  on public.projects for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.categories c where c.id = category_id and c.is_active)
  );

create policy "projects: edit own, active category"
  on public.projects for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (select 1 from public.categories c where c.id = category_id and c.is_active)
  );

create policy "projects: delete own"
  on public.projects for delete to authenticated
  using (owner_id = (select auth.uid()));

create policy "project_links: read own project's links"
  on public.project_links for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  );

create policy "project_links: add to own project"
  on public.project_links for insert to authenticated
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  );

create policy "project_links: delete from own project"
  on public.project_links for delete to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = (select auth.uid())
    )
  );
