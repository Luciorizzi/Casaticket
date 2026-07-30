create table public.professional_portfolio_items (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  title text not null,
  description text not null,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint professional_portfolio_title_check check (char_length(trim(title)) between 3 and 80),
  constraint professional_portfolio_description_check check (char_length(trim(description)) between 10 and 500),
  constraint professional_portfolio_sort_order_check check (sort_order between 0 and 11)
);

create index professional_portfolio_owner_idx
  on public.professional_portfolio_items (professional_id, sort_order, created_at);

create function public.validate_professional_portfolio_item()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.professional_portfolio_items where professional_id = new.professional_id) >= 12 then
    raise exception 'Portfolio item limit reached.';
  end if;
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create trigger validate_professional_portfolio_item_before_write
before insert or update on public.professional_portfolio_items
for each row execute procedure public.validate_professional_portfolio_item();

alter table public.professional_portfolio_items enable row level security;

create policy professional_portfolio_select_visible_or_owner
on public.professional_portfolio_items for select to authenticated
using (
  exists (
    select 1
    from public.professional_profiles pp
    join public.profiles p on p.id = pp.user_id
    where pp.id = professional_id
      and (
        pp.user_id = auth.uid()
        or (
          is_visible
          and p.role = 'professional'
          and p.onboarding_completed
          and pp.verification_status <> 'rejected'
        )
      )
  )
);

create policy professional_portfolio_insert_owner
on public.professional_portfolio_items for insert to authenticated
with check (exists (select 1 from public.professional_profiles pp where pp.id = professional_id and pp.user_id = auth.uid()));

create policy professional_portfolio_update_owner
on public.professional_portfolio_items for update to authenticated
using (exists (select 1 from public.professional_profiles pp where pp.id = professional_id and pp.user_id = auth.uid()))
with check (exists (select 1 from public.professional_profiles pp where pp.id = professional_id and pp.user_id = auth.uid()));

create policy professional_portfolio_delete_owner
on public.professional_portfolio_items for delete to authenticated
using (exists (select 1 from public.professional_profiles pp where pp.id = professional_id and pp.user_id = auth.uid()));

alter table public.attachments add column portfolio_item_id uuid references public.professional_portfolio_items (id) on delete cascade;
alter table public.attachments drop constraint attachments_one_parent_check;
alter table public.attachments drop constraint attachments_type_check;
alter table public.attachments add constraint attachments_one_parent_check
  check (num_nonnulls(service_request_id, job_id, portfolio_item_id) = 1);
alter table public.attachments add constraint attachments_type_check check (
  (attachment_type = 'request_evidence' and service_request_id is not null and job_id is null and portfolio_item_id is null)
  or (attachment_type in ('diagnosis_evidence', 'completion_evidence') and job_id is not null and service_request_id is null and portfolio_item_id is null)
  or (attachment_type = 'portfolio' and portfolio_item_id is not null and service_request_id is null and job_id is null)
);
create index attachments_portfolio_idx on public.attachments (portfolio_item_id, sort_order);

create or replace function public.can_access_attachment(p_attachment_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1
    from public.attachments a
    left join public.service_requests sr on sr.id = a.service_request_id
    left join public.professional_portfolio_items pi on pi.id = a.portfolio_item_id
    left join public.professional_profiles portfolio_owner on portfolio_owner.id = pi.professional_id
    left join public.profiles portfolio_profile on portfolio_profile.id = portfolio_owner.user_id
    where a.id = p_attachment_id
      and (
        a.owner_id = auth.uid()
        or (a.job_id is not null and public.is_job_participant(a.job_id))
        or (a.service_request_id is not null and sr.customer_id = auth.uid())
        or (
          a.service_request_id is not null and sr.status = 'published'
          and not exists (select 1 from public.jobs j where j.request_id = sr.id)
          and exists (select 1 from public.professional_profiles pp where pp.user_id = auth.uid() and public.is_professional_compatible_with_request(pp.id, sr.id))
        )
        or (a.service_request_id is not null and exists (select 1 from public.jobs j where j.request_id = sr.id and public.is_job_participant(j.id)))
        or (
          a.portfolio_item_id is not null and pi.is_visible
          and portfolio_profile.role = 'professional'
          and portfolio_profile.onboarding_completed
          and portfolio_owner.verification_status <> 'rejected'
        )
      )
  );
$$;

create function public.register_portfolio_attachment(
  p_portfolio_item_id uuid,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_sort_order integer,
  p_file_extension text
)
returns setof public.attachments
language plpgsql security definer set search_path = public
as $$
declare
  attachment_id uuid := gen_random_uuid();
  clean_extension text := lower(trim(coalesce(p_file_extension, '')));
  object_path text;
  created_attachment public.attachments%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if clean_extension not in ('jpg', 'jpeg', 'png', 'webp') then raise exception 'Invalid file extension.'; end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then raise exception 'Invalid image type.'; end if;
  if p_file_size_bytes is null or p_file_size_bytes < 1 or p_file_size_bytes > 10485760 then raise exception 'Invalid file size.'; end if;
  if p_sort_order not between 0 and 4 then raise exception 'Invalid sort order.'; end if;
  if not exists (
    select 1 from public.professional_portfolio_items pi
    join public.professional_profiles pp on pp.id = pi.professional_id
    where pi.id = p_portfolio_item_id and pp.user_id = auth.uid()
  ) then raise exception 'Portfolio item not found or not owned.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_portfolio_item_id::text || ':portfolio', 0));
  if (select count(*) from public.attachments where portfolio_item_id = p_portfolio_item_id) >= 5 then
    raise exception 'Attachment limit reached.';
  end if;
  object_path := 'portfolio/' || p_portfolio_item_id || '/' || attachment_id || '.' || clean_extension;
  insert into public.attachments (id, owner_id, portfolio_item_id, attachment_type, storage_path, mime_type, file_size_bytes, sort_order)
  values (attachment_id, auth.uid(), p_portfolio_item_id, 'portfolio', object_path, p_mime_type, p_file_size_bytes, p_sort_order)
  returning * into created_attachment;
  return next created_attachment;
end;
$$;

create function public.get_public_professional_profile(p_professional_id uuid)
returns table (
  professional_id uuid, user_id uuid, first_name text, last_name text, avatar_path text,
  base_city text, bio text, years_experience integer, service_radius_km integer,
  availability_status text, verification_status text, category_names text[],
  completed_jobs_count integer, average_rating numeric, reviews_count integer
)
language sql security definer set search_path = public stable
as $$
  select pp.id, pp.user_id, p.first_name, p.last_name, p.avatar_path, pp.base_city, pp.bio,
    pp.years_experience, pp.service_radius_km, pp.availability_status, pp.verification_status,
    coalesce(array_agg(distinct c.name) filter (where c.name is not null), '{}'),
    (select count(*)::integer from public.jobs j where j.professional_id = pp.id and j.status = 'completed'),
    (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.reviewed_user_id = pp.user_id and r.reviewer_role = 'customer'),
    (select count(*)::integer from public.reviews r where r.reviewed_user_id = pp.user_id and r.reviewer_role = 'customer')
  from public.professional_profiles pp
  join public.profiles p on p.id = pp.user_id
  left join public.professional_categories pc on pc.professional_id = pp.id
  left join public.categories c on c.id = pc.category_id and c.active
  where pp.id = p_professional_id and p.role = 'professional' and p.onboarding_completed and pp.verification_status <> 'rejected'
  group by pp.id, p.id;
$$;

create function public.list_public_professional_reviews(p_professional_id uuid)
returns table (id uuid, rating integer, comment text, created_at timestamptz, customer_name text)
language sql security definer set search_path = public stable
as $$
  select r.id, r.rating, r.comment, r.created_at,
    left(reviewer.first_name, 1) || case when reviewer.last_name is null or reviewer.last_name = '' then '.' else '. ' || left(reviewer.last_name, 1) || '.' end
  from public.reviews r
  join public.professional_profiles pp on pp.user_id = r.reviewed_user_id
  join public.profiles professional_user on professional_user.id = pp.user_id
  join public.profiles reviewer on reviewer.id = r.reviewer_user_id
  where pp.id = p_professional_id and r.reviewer_role = 'customer'
    and professional_user.role = 'professional' and professional_user.onboarding_completed
    and pp.verification_status <> 'rejected'
  order by r.created_at desc limit 10;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-media', 'profile-media', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy profile_media_insert_owner on storage.objects for insert to authenticated
with check (bucket_id = 'profile-media' and owner_id = auth.uid()::text and (storage.foldername(name))[1] = auth.uid()::text);
create policy profile_media_update_owner on storage.objects for update to authenticated
using (bucket_id = 'profile-media' and owner_id = auth.uid()::text)
with check (bucket_id = 'profile-media' and owner_id = auth.uid()::text);
create policy profile_media_delete_owner on storage.objects for delete to authenticated
using (bucket_id = 'profile-media' and owner_id = auth.uid()::text);
create policy profile_media_select_active_professional on storage.objects for select to authenticated
using (
  bucket_id = 'profile-media' and exists (
    select 1 from public.profiles p
    join public.professional_profiles pp on pp.user_id = p.id
    where p.avatar_path = name and p.role = 'professional' and p.onboarding_completed and pp.verification_status <> 'rejected'
  )
);

create function public.set_own_professional_avatar(p_avatar_path text)
returns text
language plpgsql security definer set search_path = public
as $$
begin
  if p_avatar_path is not null and p_avatar_path <> (auth.uid()::text || '/avatar.jpg') then
    raise exception 'Invalid avatar path.';
  end if;
  update public.profiles set avatar_path = p_avatar_path, updated_at = timezone('utc', now())
  where id = auth.uid() and role = 'professional';
  if not found then raise exception 'Professional profile not found.'; end if;
  return p_avatar_path;
end;
$$;

grant select, insert, update, delete on public.professional_portfolio_items to authenticated;
grant all on public.professional_portfolio_items to service_role;
grant execute on function public.register_portfolio_attachment(uuid, text, bigint, integer, text) to authenticated;
grant execute on function public.get_public_professional_profile(uuid) to authenticated;
grant execute on function public.list_public_professional_reviews(uuid) to authenticated;
grant execute on function public.set_own_professional_avatar(text) to authenticated;
