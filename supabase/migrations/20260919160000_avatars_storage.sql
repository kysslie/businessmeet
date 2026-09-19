-- F3: profile photos.
--
-- A private storage bucket `avatars`. Files live at  {user_id}/{random}.{ext}
--   * only the owner can add or delete files in their own folder
--   * any logged-in user can read (the app shows photos through short-lived signed links)
--   * logged-out visitors get nothing
--   * the bucket itself refuses anything over 2 MB or that is not JPEG / PNG / WebP
--
-- Files are never overwritten (every upload gets a new random name), so no UPDATE
-- policy is needed.
--
-- NOTE for F8 (account deletion): deleting a user does NOT delete their files in
-- Storage. The delete-account code must remove {user_id}/* from this bucket first.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  2097152, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars: logged-in users can read"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

create policy "avatars: upload into own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: delete from own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- The profile can only point at a file inside the person's own folder.
alter table public.profiles
  add constraint profiles_avatar_path_own_folder
  check (
    avatar_path is null
    or (char_length(avatar_path) <= 200 and avatar_path like id::text || '/%')
  );
