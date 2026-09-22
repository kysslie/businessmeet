-- P3b (share card): one new column, additive only, no existing data touched.
--
-- share_prompt_shown tracks whether the person has already seen the one-time "your portfolio
-- is live" prompt (shown once, ever, the moment it renders -- not tied to dismissing it).

alter table public.profiles
  add column share_prompt_shown boolean not null default false;

grant select (share_prompt_shown) on public.profiles to authenticated;
grant update (share_prompt_shown) on public.profiles to authenticated;
