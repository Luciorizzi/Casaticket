create or replace function public.is_professional_profile_owner(p_professional_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.professional_profiles
    where id = p_professional_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_professional_compatible_with_request(
  p_professional_id uuid,
  p_request_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.professional_profiles pp
    join public.profiles p on p.id = pp.user_id
    join public.service_requests sr on sr.id = p_request_id
    where pp.id = p_professional_id
      and pp.user_id = auth.uid()
      and p.role = 'professional'
      and p.onboarding_completed = true
      and pp.verification_status::text not in ('rejected', 'suspended', 'blocked')
      and sr.status = 'published'
      and sr.deleted_at is null
      and (
        sr.category_id is null
        or exists (
          select 1
          from public.professional_categories pc
          where pc.professional_id = pp.id
            and pc.category_id = sr.category_id
        )
      )
  );
$$;

create or replace function public.list_professional_opportunities()
returns table (
  request_id uuid,
  title text,
  description text,
  category_id uuid,
  category_name text,
  request_type text,
  urgency text,
  city text,
  province text,
  preferred_date date,
  preferred_time_text text,
  availability_notes text,
  published_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    sr.id as request_id,
    sr.title,
    sr.description,
    sr.category_id,
    c.name as category_name,
    sr.request_type,
    sr.urgency,
    sr.city,
    sr.province,
    sr.preferred_date,
    sr.preferred_time_text,
    sr.availability_notes,
    sr.published_at
  from public.service_requests sr
  left join public.categories c on c.id = sr.category_id
  where sr.status = 'published'
    and sr.deleted_at is null
    and exists (
      select 1
      from public.professional_profiles pp
      where public.is_professional_compatible_with_request(pp.id, sr.id)
    )
  order by sr.published_at desc nulls last, sr.created_at desc;
$$;

create or replace function public.get_professional_opportunity(p_request_id uuid)
returns table (
  request_id uuid,
  title text,
  description text,
  category_id uuid,
  category_name text,
  request_type text,
  urgency text,
  city text,
  province text,
  preferred_date date,
  preferred_time_text text,
  availability_notes text,
  published_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    sr.id as request_id,
    sr.title,
    sr.description,
    sr.category_id,
    c.name as category_name,
    sr.request_type,
    sr.urgency,
    sr.city,
    sr.province,
    sr.preferred_date,
    sr.preferred_time_text,
    sr.availability_notes,
    sr.published_at
  from public.service_requests sr
  left join public.categories c on c.id = sr.category_id
  where sr.id = p_request_id
    and sr.status = 'published'
    and sr.deleted_at is null
    and exists (
      select 1
      from public.professional_profiles pp
      where public.is_professional_compatible_with_request(pp.id, sr.id)
    )
  limit 1;
$$;

create or replace function public.prevent_unsafe_application_write()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'submitted' then
      raise exception 'Applications must start as submitted.';
    end if;

    if new.withdrawn_at is not null then
      raise exception 'Applications cannot start withdrawn.';
    end if;

    return new;
  end if;

  if new.request_id is distinct from old.request_id then
    raise exception 'Application request cannot be changed.';
  end if;

  if new.professional_id is distinct from old.professional_id then
    raise exception 'Application professional cannot be changed.';
  end if;

  if old.status not in ('submitted', 'viewed') then
    raise exception 'Only submitted or viewed applications can be updated by professionals.';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if new.status = 'withdrawn' then
    if new.withdrawn_at is null then
      new.withdrawn_at = timezone('utc', now());
    end if;

    return new;
  end if;

  raise exception 'Professionals can only withdraw their own applications.';
end;
$$;

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.service_requests (id) on delete cascade,
  professional_id uuid not null references public.professional_profiles (id) on delete cascade,
  message text not null,
  proposal_type text not null,
  visit_price numeric,
  estimated_price numeric,
  estimated_duration_text text,
  availability_text text not null,
  status text not null default 'submitted',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  withdrawn_at timestamptz,
  constraint applications_request_professional_unique
    unique (request_id, professional_id),
  constraint applications_proposal_type_check
    check (proposal_type in ('diagnostic_visit', 'preliminary_quote', 'ask_for_details', 'direct_service')),
  constraint applications_status_check
    check (status in ('submitted', 'viewed', 'withdrawn', 'selected', 'rejected')),
  constraint applications_message_length_check
    check (char_length(trim(message)) between 20 and 1000),
  constraint applications_availability_length_check
    check (char_length(trim(availability_text)) >= 2),
  constraint applications_visit_price_check
    check (visit_price is null or visit_price >= 0),
  constraint applications_estimated_price_check
    check (estimated_price is null or estimated_price >= 0)
);

create index applications_professional_created_at_idx
on public.applications (professional_id, created_at desc);

create index applications_request_id_idx
on public.applications (request_id);

create index applications_professional_status_idx
on public.applications (professional_id, status);

create trigger set_applications_updated_at
before update on public.applications
for each row
execute procedure public.set_updated_at();

create trigger guard_application_writes
before insert or update on public.applications
for each row
execute procedure public.prevent_unsafe_application_write();

alter table public.applications enable row level security;

create policy "applications_select_own_professional"
on public.applications
for select
to authenticated
using (public.is_professional_profile_owner(professional_id));

create policy "applications_insert_own_compatible_professional"
on public.applications
for insert
to authenticated
with check (
  public.is_professional_profile_owner(professional_id)
  and public.is_professional_compatible_with_request(professional_id, request_id)
);

create policy "applications_update_own_professional"
on public.applications
for update
to authenticated
using (
  public.is_professional_profile_owner(professional_id)
  and status in ('submitted', 'viewed')
)
with check (
  public.is_professional_profile_owner(professional_id)
);

grant execute on function public.is_professional_profile_owner(uuid) to authenticated;
grant execute on function public.is_professional_compatible_with_request(uuid, uuid) to authenticated;
grant execute on function public.list_professional_opportunities() to authenticated;
grant execute on function public.get_professional_opportunity(uuid) to authenticated;

grant select, insert, update on table public.applications to authenticated;
grant all privileges on table public.applications to service_role;
