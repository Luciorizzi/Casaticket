drop policy if exists profile_media_insert_owner on storage.objects;
create policy profile_media_insert_owner on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-media'
  and owner_id = auth.uid()::text
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
  and name ~ ('^avatars/' || auth.uid()::text || '/profile-[0-9]+\.(jpg|png|webp)$')
);

create or replace function public.set_own_professional_avatar(p_avatar_path text)
returns text
language plpgsql security definer set search_path = public, storage
as $$
begin
  if p_avatar_path is not null then
    if p_avatar_path !~ ('^avatars/' || auth.uid()::text || '/profile-[0-9]+\.(jpg|png|webp)$') then
      raise exception 'Invalid avatar path.';
    end if;
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'profile-media' and name = p_avatar_path and owner_id = auth.uid()::text
    ) then
      raise exception 'Avatar object not found.';
    end if;
  end if;

  update public.profiles
  set avatar_path = p_avatar_path, updated_at = timezone('utc', now())
  where id = auth.uid() and role = 'professional';
  if not found then raise exception 'Professional profile not found.'; end if;
  return p_avatar_path;
end;
$$;

grant execute on function public.set_own_professional_avatar(text) to authenticated;
