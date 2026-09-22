-- Fix: assign_profile_slug() ran the a-z0-9 filter BEFORE lower(), so any uppercase first
-- letter (the usual case for a display name) was stripped as "not a-z0-9" instead of being
-- lowercased. "John" became slug "ohn-...", "Ana Demo" became "na-...". Confirmed on the 3
-- real accounts that already had a slug assigned (20260922120000); their bad slugs are cleared
-- here so the corrected trigger reassigns them.
create or replace function public.assign_profile_slug()
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

  base := regexp_replace(
    lower(extensions.unaccent('extensions.unaccent', coalesce(split_part(new.display_name, ' ', 1), ''))),
    '[^a-z0-9]', '', 'g'
  );
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

  new.slug := base || '-' || substr(new.id::text, 1, 8);
  return new;
end;
$$;

update public.profiles set slug = null, updated_at = now() where onboarded = true;
