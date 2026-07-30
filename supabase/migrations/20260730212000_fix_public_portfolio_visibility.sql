create function public.is_public_professional_profile(p_professional_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.professional_profiles pp
    join public.profiles p on p.id = pp.user_id
    where pp.id = p_professional_id
      and p.role = 'professional'
      and p.onboarding_completed
      and pp.verification_status <> 'rejected'
  );
$$;

drop policy if exists professional_portfolio_select_visible_or_owner on public.professional_portfolio_items;
create policy professional_portfolio_select_visible_or_owner
on public.professional_portfolio_items for select to authenticated
using (
  exists (select 1 from public.professional_profiles pp where pp.id = professional_id and pp.user_id = auth.uid())
  or (is_visible and public.is_public_professional_profile(professional_id))
);

grant execute on function public.is_public_professional_profile(uuid) to authenticated;

create function public.is_public_professional_avatar(p_storage_path text)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.profiles p
    join public.professional_profiles pp on pp.user_id = p.id
    where p.avatar_path = p_storage_path
      and public.is_public_professional_profile(pp.id)
  );
$$;

drop policy if exists profile_media_select_active_professional on storage.objects;
create policy profile_media_select_active_professional on storage.objects for select to authenticated
using (bucket_id = 'profile-media' and public.is_public_professional_avatar(name));

grant execute on function public.is_public_professional_avatar(text) to authenticated;
