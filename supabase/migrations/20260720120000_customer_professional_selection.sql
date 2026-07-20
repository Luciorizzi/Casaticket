alter table public.service_requests
add column if not exists selected_professional_id uuid references public.professional_profiles (id),
add column if not exists selected_at timestamptz;

alter table public.service_requests
drop constraint if exists service_requests_status_check;

alter table public.service_requests
add constraint service_requests_status_check
  check (status in ('draft', 'published', 'receiving_applications', 'professional_selected', 'cancelled'));

create index if not exists service_requests_selected_professional_idx
on public.service_requests (selected_professional_id);

create or replace function public.prevent_service_request_unsafe_customer_update()
returns trigger
language plpgsql
as $$
declare
  selecting_professional boolean := coalesce(current_setting('app.selecting_professional', true), 'false') = 'true';
  receiving_application boolean := coalesce(current_setting('app.receiving_application', true), 'false') = 'true';
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.customer_id is distinct from old.customer_id then
    raise exception 'Service request customer cannot be changed.';
  end if;

  if new.selected_professional_id is distinct from old.selected_professional_id and not selecting_professional then
    raise exception 'Selected professional can only be changed by the selection flow.';
  end if;

  if new.selected_at is distinct from old.selected_at and not selecting_professional then
    raise exception 'Selection timestamp can only be changed by the selection flow.';
  end if;

  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'Cancelled service requests cannot be reactivated.';
  end if;

  if old.status = 'professional_selected' and new.status <> 'professional_selected' then
    raise exception 'Selected service requests cannot change status from the client.';
  end if;

  if old.status = new.status then
    return new;
  end if;

  if selecting_professional and new.status = 'professional_selected' and old.status in ('published', 'receiving_applications') then
    return new;
  end if;

  if receiving_application and old.status = 'published' and new.status = 'receiving_applications' then
    return new;
  end if;

  if old.status in ('published', 'receiving_applications') and new.status = 'cancelled' then
    return new;
  end if;

  raise exception 'Service request status transition is not allowed.';
end;
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
      and sr.status in ('published', 'receiving_applications')
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
  where sr.status in ('published', 'receiving_applications')
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
    and sr.status in ('published', 'receiving_applications')
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
declare
  selecting_professional boolean := coalesce(current_setting('app.selecting_professional', true), 'false') = 'true';
  viewing_application boolean := coalesce(current_setting('app.viewing_application', true), 'false') = 'true';
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
    raise exception 'Only submitted or viewed applications can be updated by active flows.';
  end if;

  if new.status = old.status then
    return new;
  end if;

  if viewing_application and old.status = 'submitted' and new.status = 'viewed' then
    return new;
  end if;

  if selecting_professional and new.status in ('selected', 'rejected') then
    return new;
  end if;

  if new.status = 'withdrawn' then
    if new.withdrawn_at is null then
      new.withdrawn_at = timezone('utc', now());
    end if;

    return new;
  end if;

  raise exception 'Application status transition is not allowed.';
end;
$$;

create or replace function public.set_request_receiving_applications()
returns trigger
language plpgsql
as $$
begin
  perform set_config('app.receiving_application', 'true', true);

  update public.service_requests
  set status = 'receiving_applications'
  where id = new.request_id
    and status = 'published';

  return new;
end;
$$;

drop trigger if exists set_request_receiving_applications on public.applications;

create trigger set_request_receiving_applications
after insert on public.applications
for each row
execute procedure public.set_request_receiving_applications();

create or replace function public.list_customer_request_applications(p_request_id uuid)
returns table (
  application_id uuid,
  request_id uuid,
  professional_id uuid,
  status text,
  message text,
  proposal_type text,
  visit_price numeric,
  estimated_price numeric,
  estimated_duration_text text,
  availability_text text,
  created_at timestamptz,
  professional_first_name text,
  professional_last_name text,
  professional_bio text,
  professional_years_experience integer,
  professional_base_city text,
  professional_service_radius_km integer,
  professional_verification_status text,
  professional_category_names text[]
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id as application_id,
    a.request_id,
    a.professional_id,
    a.status,
    a.message,
    a.proposal_type,
    a.visit_price,
    a.estimated_price,
    a.estimated_duration_text,
    a.availability_text,
    a.created_at,
    p.first_name as professional_first_name,
    p.last_name as professional_last_name,
    pp.bio as professional_bio,
    pp.years_experience as professional_years_experience,
    pp.base_city as professional_base_city,
    pp.service_radius_km as professional_service_radius_km,
    pp.verification_status::text as professional_verification_status,
    coalesce(
      array_agg(c.name order by c.name) filter (where c.id is not null),
      array[]::text[]
    ) as professional_category_names
  from public.applications a
  join public.service_requests sr on sr.id = a.request_id
  join public.professional_profiles pp on pp.id = a.professional_id
  join public.profiles p on p.id = pp.user_id
  left join public.professional_categories pc on pc.professional_id = pp.id
  left join public.categories c on c.id = pc.category_id
  where sr.id = p_request_id
    and sr.customer_id = auth.uid()
  group by a.id, p.id, pp.id
  order by a.created_at asc;
$$;

create or replace function public.mark_customer_application_viewed(p_application_id uuid)
returns table (
  application_id uuid,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  application_record public.applications%rowtype;
begin
  select a.*
  into application_record
  from public.applications a
  join public.service_requests sr on sr.id = a.request_id
  where a.id = p_application_id
    and sr.customer_id = auth.uid()
  for update of a;

  if not found then
    raise exception 'Application not found for this customer.';
  end if;

  if application_record.status = 'submitted' then
    perform set_config('app.viewing_application', 'true', true);

    update public.applications
    set status = 'viewed'
    where id = p_application_id
    returning * into application_record;
  end if;

  return query select application_record.id, application_record.status;
end;
$$;

create or replace function public.select_professional_for_request(
  p_request_id uuid,
  p_application_id uuid
)
returns table (
  request_id uuid,
  request_status text,
  selected_professional_id uuid,
  selected_application_id uuid,
  selected_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.service_requests%rowtype;
  application_record public.applications%rowtype;
  selection_time timestamptz := timezone('utc', now());
begin
  select *
  into request_record
  from public.service_requests
  where id = p_request_id
    and customer_id = auth.uid()
  for update;

  if not found then
    raise exception 'Service request not found for this customer.';
  end if;

  if request_record.status not in ('published', 'receiving_applications') then
    raise exception 'Service request cannot select a professional in its current status.';
  end if;

  if request_record.selected_professional_id is not null then
    raise exception 'Service request already has a selected professional.';
  end if;

  select *
  into application_record
  from public.applications
  where id = p_application_id
    and request_id = p_request_id
  for update;

  if not found then
    raise exception 'Application does not belong to this service request.';
  end if;

  if application_record.status not in ('submitted', 'viewed') then
    raise exception 'Only submitted or viewed applications can be selected.';
  end if;

  perform set_config('app.selecting_professional', 'true', true);

  update public.applications
  set status = 'selected'
  where id = application_record.id;

  update public.applications
  set status = 'rejected'
  where request_id = p_request_id
    and id <> application_record.id
    and status in ('submitted', 'viewed');

  update public.service_requests
  set
    status = 'professional_selected',
    selected_professional_id = application_record.professional_id,
    selected_at = selection_time
  where id = p_request_id
  returning * into request_record;

  return query
  select
    request_record.id,
    request_record.status,
    request_record.selected_professional_id,
    application_record.id,
    request_record.selected_at;
end;
$$;

create or replace function public.list_professional_selected_jobs()
returns table (
  application_id uuid,
  request_id uuid,
  title text,
  category_name text,
  city text,
  request_status text,
  selected_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id as application_id,
    sr.id as request_id,
    sr.title,
    c.name as category_name,
    sr.city,
    sr.status as request_status,
    sr.selected_at
  from public.applications a
  join public.professional_profiles pp on pp.id = a.professional_id
  join public.service_requests sr on sr.id = a.request_id
  left join public.categories c on c.id = sr.category_id
  where pp.user_id = auth.uid()
    and a.status = 'selected'
    and sr.status = 'professional_selected'
  order by sr.selected_at desc nulls last;
$$;

grant execute on function public.list_customer_request_applications(uuid) to authenticated;
grant execute on function public.mark_customer_application_viewed(uuid) to authenticated;
grant execute on function public.select_professional_for_request(uuid, uuid) to authenticated;
grant execute on function public.list_professional_selected_jobs() to authenticated;
