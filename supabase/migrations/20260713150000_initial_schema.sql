create extension if not exists "pgcrypto";

create type public.app_role as enum ('customer', 'professional', 'admin', 'operator');
create type public.availability_status as enum ('available', 'busy', 'paused');
create type public.verification_status as enum ('pending', 'verified', 'rejected');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.prevent_admin_role_self_assignment()
returns trigger
language plpgsql
as $$
begin
  if auth.role() <> 'service_role' and new.role in ('admin', 'operator') then
    raise exception 'Administrative roles cannot be self assigned.';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_professional_verification_self_update()
returns trigger
language plpgsql
as $$
declare
  acting_role public.app_role;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  select role
  into acting_role
  from public.profiles
  where id = auth.uid();

  if acting_role in ('admin', 'operator') then
    return new;
  end if;

  if new.verification_status is distinct from old.verification_status then
    raise exception 'Verification status can only be updated by privileged actors.';
  end if;

  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  avatar_path text,
  role public.app_role not null,
  province text not null default 'Buenos Aires',
  city text not null default 'Ciudad Autonoma de Buenos Aires',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.professional_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  bio text,
  years_experience integer,
  base_city text not null,
  base_latitude numeric(9, 6),
  base_longitude numeric(9, 6),
  service_radius_km integer not null,
  availability_status public.availability_status not null default 'available',
  verification_status public.verification_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint professional_profiles_service_radius_check
    check (service_radius_km between 1 and 100),
  constraint professional_profiles_years_experience_check
    check (years_experience is null or years_experience between 0 and 80)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.professional_categories (
  professional_id uuid not null references public.professional_profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (professional_id, category_id)
);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  address_line text not null,
  city text not null,
  province text not null,
  postal_code text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index profiles_role_idx on public.profiles (role);
create index professional_profiles_user_id_idx on public.professional_profiles (user_id);
create index categories_active_idx on public.categories (active);
create index customer_addresses_customer_id_idx on public.customer_addresses (customer_id);

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute procedure public.set_updated_at();

create trigger set_professional_profiles_updated_at
before update on public.professional_profiles
for each row
execute procedure public.set_updated_at();

create trigger set_categories_updated_at
before update on public.categories
for each row
execute procedure public.set_updated_at();

create trigger set_customer_addresses_updated_at
before update on public.customer_addresses
for each row
execute procedure public.set_updated_at();

create trigger guard_profile_role_assignments
before insert or update on public.profiles
for each row
execute procedure public.prevent_admin_role_self_assignment();

create trigger guard_verification_status_updates
before update on public.professional_profiles
for each row
execute procedure public.prevent_professional_verification_self_update();

alter table public.profiles enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.professional_categories enable row level security;
alter table public.customer_addresses enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and role in ('customer', 'professional')
);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and role in ('customer', 'professional')
);

create policy "professional_profiles_select_own"
on public.professional_profiles
for select
to authenticated
using (user_id = auth.uid());

create policy "professional_profiles_insert_own"
on public.professional_profiles
for insert
to authenticated
with check (user_id = auth.uid());

create policy "professional_profiles_update_own"
on public.professional_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "professional_profiles_delete_own"
on public.professional_profiles
for delete
to authenticated
using (user_id = auth.uid());

create policy "professional_categories_manage_own"
on public.professional_categories
for all
to authenticated
using (
  exists (
    select 1
    from public.professional_profiles
    where professional_profiles.id = professional_categories.professional_id
      and professional_profiles.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.professional_profiles
    where professional_profiles.id = professional_categories.professional_id
      and professional_profiles.user_id = auth.uid()
  )
);

create policy "categories_select_active"
on public.categories
for select
to authenticated
using (active = true);

create policy "customer_addresses_select_own"
on public.customer_addresses
for select
to authenticated
using (customer_id = auth.uid());

create policy "customer_addresses_insert_own"
on public.customer_addresses
for insert
to authenticated
with check (customer_id = auth.uid());

create policy "customer_addresses_update_own"
on public.customer_addresses
for update
to authenticated
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

create policy "customer_addresses_delete_own"
on public.customer_addresses
for delete
to authenticated
using (customer_id = auth.uid());

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', false),
  ('private-documents', 'private-documents', false)
on conflict (id) do nothing;

create policy "avatars_read_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatars_manage_own"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "private_documents_read_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "private_documents_manage_own"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

comment on table public.categories is
'Configurable service categories. The user-facing apps must read them from the database.';

comment on table public.professional_profiles is
'Initial professional profile model prepared for future matching and opportunity flows.';

