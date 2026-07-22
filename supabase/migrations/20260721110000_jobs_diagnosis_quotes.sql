create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.service_requests (id) on delete cascade,
  selected_application_id uuid not null unique references public.applications (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professional_profiles (id) on delete cascade,
  status text not null default 'coordination_pending',
  scheduled_date date,
  scheduled_time_text text,
  scheduling_notes text,
  diagnosis_text text,
  diagnosed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint jobs_status_check
    check (
      status in (
        'coordination_pending',
        'visit_proposed',
        'visit_confirmed',
        'diagnosis_pending',
        'quote_pending',
        'quote_sent',
        'quote_accepted',
        'quote_rejected',
        'cancelled'
      )
    ),
  constraint jobs_diagnosis_length_check
    check (diagnosis_text is null or char_length(trim(diagnosis_text)) between 20 and 3000)
);

create table public.job_quotes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  version integer not null,
  labor_amount numeric not null,
  materials_amount numeric not null default 0,
  visit_amount numeric not null default 0,
  platform_fee_amount numeric not null default 0,
  total_amount numeric not null,
  currency text not null default 'ARS',
  description text not null,
  estimated_duration_text text,
  valid_until date,
  status text not null default 'draft',
  rejected_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  rejected_at timestamptz,
  constraint job_quotes_job_version_key unique (job_id, version),
  constraint job_quotes_status_check
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'superseded')),
  constraint job_quotes_amounts_non_negative_check
    check (
      labor_amount >= 0
      and materials_amount >= 0
      and visit_amount >= 0
      and platform_fee_amount >= 0
      and total_amount >= 0
    ),
  constraint job_quotes_description_length_check
    check (char_length(trim(description)) between 20 and 3000)
);

create index jobs_customer_id_idx on public.jobs (customer_id);
create index jobs_professional_id_idx on public.jobs (professional_id);
create index job_quotes_job_status_idx on public.job_quotes (job_id, status);

create trigger set_jobs_updated_at
before update on public.jobs
for each row
execute procedure public.set_updated_at();

create trigger set_job_quotes_updated_at
before update on public.job_quotes
for each row
execute procedure public.set_updated_at();

create or replace function public.is_job_participant(p_job_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.jobs j
    join public.professional_profiles pp on pp.id = j.professional_id
    where j.id = p_job_id
      and (
        j.customer_id = auth.uid()
        or pp.user_id = auth.uid()
      )
  );
$$;

create or replace function public.is_job_customer(p_job_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.jobs j
    where j.id = p_job_id
      and j.customer_id = auth.uid()
  );
$$;

create or replace function public.is_job_professional(p_job_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.jobs j
    join public.professional_profiles pp on pp.id = j.professional_id
    where j.id = p_job_id
      and pp.user_id = auth.uid()
  );
$$;

alter table public.jobs enable row level security;
alter table public.job_quotes enable row level security;

create policy "jobs_select_participants"
on public.jobs
for select
to authenticated
using (public.is_job_participant(id));

create policy "job_quotes_select_job_participants"
on public.job_quotes
for select
to authenticated
using (public.is_job_participant(job_id));

create or replace function public.get_job_by_request(p_request_id uuid)
returns table (
  job_id uuid,
  request_id uuid,
  selected_application_id uuid,
  customer_id uuid,
  professional_id uuid,
  status text,
  scheduled_date date,
  scheduled_time_text text,
  scheduling_notes text,
  diagnosis_text text,
  diagnosed_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    j.id,
    j.request_id,
    j.selected_application_id,
    j.customer_id,
    j.professional_id,
    j.status,
    j.scheduled_date,
    j.scheduled_time_text,
    j.scheduling_notes,
    j.diagnosis_text,
    j.diagnosed_at,
    j.created_at,
    j.updated_at
  from public.jobs j
  where j.request_id = p_request_id
    and public.is_job_participant(j.id);
$$;

create or replace function public.list_job_quotes(p_job_id uuid)
returns table (
  quote_id uuid,
  job_id uuid,
  version integer,
  labor_amount numeric,
  materials_amount numeric,
  visit_amount numeric,
  platform_fee_amount numeric,
  total_amount numeric,
  currency text,
  description text,
  estimated_duration_text text,
  valid_until date,
  status text,
  rejected_reason text,
  created_at timestamptz,
  updated_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    jq.id,
    jq.job_id,
    jq.version,
    jq.labor_amount,
    jq.materials_amount,
    jq.visit_amount,
    jq.platform_fee_amount,
    jq.total_amount,
    jq.currency,
    jq.description,
    jq.estimated_duration_text,
    jq.valid_until,
    jq.status,
    jq.rejected_reason,
    jq.created_at,
    jq.updated_at,
    jq.accepted_at,
    jq.rejected_at
  from public.job_quotes jq
  where jq.job_id = p_job_id
    and public.is_job_participant(p_job_id)
  order by jq.version desc;
$$;

create or replace function public.propose_job_visit(
  p_job_id uuid,
  p_scheduled_date date,
  p_scheduled_time_text text,
  p_scheduling_notes text
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_job public.jobs%rowtype;
begin
  if not public.is_job_professional(p_job_id) then
    raise exception 'Only the selected professional can propose a visit.';
  end if;

  update public.jobs j
  set
    status = 'visit_proposed',
    scheduled_date = p_scheduled_date,
    scheduled_time_text = nullif(trim(coalesce(p_scheduled_time_text, '')), ''),
    scheduling_notes = nullif(trim(coalesce(p_scheduling_notes, '')), '')
  where j.id = p_job_id
    and j.status in ('coordination_pending', 'visit_proposed')
  returning * into updated_job;

  if not found then
    raise exception 'Visit cannot be proposed in the current job status.';
  end if;

  return next updated_job;
end;
$$;

create or replace function public.confirm_job_visit(p_job_id uuid)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_job public.jobs%rowtype;
begin
  if not public.is_job_customer(p_job_id) then
    raise exception 'Only the customer can confirm this visit.';
  end if;

  update public.jobs j
  set status = 'visit_confirmed'
  where j.id = p_job_id
    and j.status = 'visit_proposed'
  returning * into updated_job;

  if not found then
    raise exception 'Visit cannot be confirmed in the current job status.';
  end if;

  return next updated_job;
end;
$$;

create or replace function public.reject_job_visit(p_job_id uuid)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_job public.jobs%rowtype;
begin
  if not public.is_job_customer(p_job_id) then
    raise exception 'Only the customer can reject this visit proposal.';
  end if;

  update public.jobs j
  set
    status = 'coordination_pending',
    scheduled_date = null,
    scheduled_time_text = null,
    scheduling_notes = null
  where j.id = p_job_id
    and j.status = 'visit_proposed'
  returning * into updated_job;

  if not found then
    raise exception 'Visit cannot be rejected in the current job status.';
  end if;

  return next updated_job;
end;
$$;

create or replace function public.record_job_diagnosis(
  p_job_id uuid,
  p_diagnosis_text text
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_job public.jobs%rowtype;
  clean_diagnosis text := trim(coalesce(p_diagnosis_text, ''));
begin
  if not public.is_job_professional(p_job_id) then
    raise exception 'Only the selected professional can register the diagnosis.';
  end if;

  if char_length(clean_diagnosis) < 20 or char_length(clean_diagnosis) > 3000 then
    raise exception 'Diagnosis length is not allowed.';
  end if;

  update public.jobs j
  set
    status = 'quote_pending',
    diagnosis_text = clean_diagnosis,
    diagnosed_at = now()
  where j.id = p_job_id
    and j.status = 'visit_confirmed'
  returning * into updated_job;

  if not found then
    raise exception 'Diagnosis requires a confirmed visit.';
  end if;

  return next updated_job;
end;
$$;

create or replace function public.create_job_quote(
  p_job_id uuid,
  p_labor_amount numeric,
  p_materials_amount numeric,
  p_visit_amount numeric,
  p_platform_fee_amount numeric,
  p_description text,
  p_estimated_duration_text text,
  p_valid_until date
)
returns setof public.job_quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  job_record public.jobs%rowtype;
  next_version integer;
  created_quote public.job_quotes%rowtype;
  clean_description text := trim(coalesce(p_description, ''));
  labor_amount numeric := coalesce(p_labor_amount, 0);
  materials_amount numeric := coalesce(p_materials_amount, 0);
  visit_amount numeric := coalesce(p_visit_amount, 0);
  platform_fee_amount numeric := coalesce(p_platform_fee_amount, 0);
begin
  if not public.is_job_professional(p_job_id) then
    raise exception 'Only the selected professional can create quotes.';
  end if;

  select *
  into job_record
  from public.jobs
  where id = p_job_id
  for update;

  if not found or job_record.status not in ('quote_pending', 'quote_rejected', 'quote_sent') then
    raise exception 'Quote cannot be created in the current job status.';
  end if;

  if labor_amount < 0 or materials_amount < 0 or visit_amount < 0 or platform_fee_amount < 0 then
    raise exception 'Quote amounts cannot be negative.';
  end if;

  if char_length(clean_description) < 20 or char_length(clean_description) > 3000 then
    raise exception 'Quote description length is not allowed.';
  end if;

  select coalesce(max(version), 0) + 1
  into next_version
  from public.job_quotes
  where job_id = p_job_id;

  update public.job_quotes
  set status = 'superseded'
  where job_id = p_job_id
    and status in ('draft', 'sent');

  insert into public.job_quotes (
    job_id,
    version,
    labor_amount,
    materials_amount,
    visit_amount,
    platform_fee_amount,
    total_amount,
    description,
    estimated_duration_text,
    valid_until,
    status
  )
  values (
    p_job_id,
    next_version,
    labor_amount,
    materials_amount,
    visit_amount,
    platform_fee_amount,
    labor_amount + materials_amount + visit_amount + platform_fee_amount,
    clean_description,
    nullif(trim(coalesce(p_estimated_duration_text, '')), ''),
    p_valid_until,
    'draft'
  )
  returning * into created_quote;

  return next created_quote;
end;
$$;

create or replace function public.send_job_quote(p_quote_id uuid)
returns setof public.job_quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_record public.job_quotes%rowtype;
begin
  select jq.*
  into quote_record
  from public.job_quotes jq
  join public.jobs j on j.id = jq.job_id
  where jq.id = p_quote_id
    and public.is_job_professional(j.id)
  for update;

  if not found then
    raise exception 'Quote not found for this professional.';
  end if;

  if quote_record.status <> 'draft' then
    raise exception 'Only draft quotes can be sent.';
  end if;

  update public.job_quotes
  set status = 'superseded'
  where job_id = quote_record.job_id
    and id <> quote_record.id
    and status in ('draft', 'sent');

  update public.job_quotes
  set status = 'sent'
  where id = quote_record.id
  returning * into quote_record;

  update public.jobs
  set status = 'quote_sent'
  where id = quote_record.job_id;

  return next quote_record;
end;
$$;

create or replace function public.accept_job_quote(p_quote_id uuid)
returns table (
  job_id uuid,
  job_status text,
  quote_id uuid,
  quote_status text,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_record public.job_quotes%rowtype;
  accepted_time timestamptz := now();
begin
  select jq.*
  into quote_record
  from public.job_quotes jq
  join public.jobs j on j.id = jq.job_id
  where jq.id = p_quote_id
    and public.is_job_customer(j.id)
  for update;

  if not found then
    raise exception 'Quote not found for this customer.';
  end if;

  if quote_record.status <> 'sent' then
    raise exception 'Only sent quotes can be accepted.';
  end if;

  update public.job_quotes
  set status = 'superseded'
  where job_id = quote_record.job_id
    and id <> quote_record.id
    and status in ('draft', 'sent');

  update public.job_quotes
  set
    status = 'accepted',
    accepted_at = accepted_time
  where id = quote_record.id
  returning * into quote_record;

  update public.jobs
  set status = 'quote_accepted'
  where id = quote_record.job_id;

  return query
  select quote_record.job_id, 'quote_accepted'::text, quote_record.id, quote_record.status, quote_record.accepted_at;
end;
$$;

create or replace function public.reject_job_quote(
  p_quote_id uuid,
  p_rejected_reason text default null
)
returns table (
  job_id uuid,
  job_status text,
  quote_id uuid,
  quote_status text,
  rejected_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_record public.job_quotes%rowtype;
  rejected_time timestamptz := now();
begin
  select jq.*
  into quote_record
  from public.job_quotes jq
  join public.jobs j on j.id = jq.job_id
  where jq.id = p_quote_id
    and public.is_job_customer(j.id)
  for update;

  if not found then
    raise exception 'Quote not found for this customer.';
  end if;

  if quote_record.status <> 'sent' then
    raise exception 'Only sent quotes can be rejected.';
  end if;

  update public.job_quotes
  set
    status = 'rejected',
    rejected_at = rejected_time,
    rejected_reason = nullif(trim(coalesce(p_rejected_reason, '')), '')
  where id = quote_record.id
  returning * into quote_record;

  update public.jobs
  set status = 'quote_rejected'
  where id = quote_record.job_id;

  return query
  select quote_record.job_id, 'quote_rejected'::text, quote_record.id, quote_record.status, quote_record.rejected_at;
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
  select sr.*
  into request_record
  from public.service_requests sr
  where sr.id = p_request_id
    and sr.customer_id = auth.uid()
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

  select a.*
  into application_record
  from public.applications a
  where a.id = p_application_id
    and a.request_id = p_request_id
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
  where public.applications.id = application_record.id;

  update public.applications
  set status = 'rejected'
  where public.applications.request_id = p_request_id
    and public.applications.id <> application_record.id
    and public.applications.status in ('submitted', 'viewed');

  update public.service_requests
  set
    status = 'professional_selected',
    selected_professional_id = application_record.professional_id,
    selected_at = selection_time
  where public.service_requests.id = p_request_id
  returning * into request_record;

  insert into public.jobs (
    request_id,
    selected_application_id,
    customer_id,
    professional_id,
    status
  )
  values (
    request_record.id,
    application_record.id,
    request_record.customer_id,
    application_record.professional_id,
    'coordination_pending'
  )
  on conflict (request_id) do nothing;

  return query
  select
    request_record.id,
    request_record.status,
    request_record.selected_professional_id,
    application_record.id,
    request_record.selected_at;
end;
$$;

drop function if exists public.list_professional_selected_jobs();

create function public.list_professional_selected_jobs()
returns table (
  application_id uuid,
  request_id uuid,
  title text,
  category_name text,
  city text,
  request_status text,
  selected_at timestamptz,
  conversation_id uuid,
  unread_count integer,
  last_message_body text,
  last_message_at timestamptz,
  job_id uuid,
  job_status text
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
    sr.selected_at,
    conv.id as conversation_id,
    coalesce(public.get_conversation_unread_count(conv.id), 0) as unread_count,
    last_message.body as last_message_body,
    last_message.created_at as last_message_at,
    j.id as job_id,
    j.status as job_status
  from public.applications a
  join public.professional_profiles pp on pp.id = a.professional_id
  join public.service_requests sr on sr.id = a.request_id
  left join public.conversations conv on conv.application_id = a.id
  left join lateral (
    select m.body, m.created_at
    from public.messages m
    where m.conversation_id = conv.id
      and m.deleted_at is null
    order by m.created_at desc
    limit 1
  ) last_message on true
  left join public.jobs j on j.selected_application_id = a.id
  left join public.categories c on c.id = sr.category_id
  where pp.user_id = auth.uid()
    and a.status = 'selected'
    and sr.status = 'professional_selected'
  order by sr.selected_at desc nulls last;
$$;

grant select on table public.jobs to authenticated;
grant select on table public.job_quotes to authenticated;
grant execute on function public.is_job_participant(uuid) to authenticated;
grant execute on function public.is_job_customer(uuid) to authenticated;
grant execute on function public.is_job_professional(uuid) to authenticated;
grant execute on function public.get_job_by_request(uuid) to authenticated;
grant execute on function public.list_job_quotes(uuid) to authenticated;
grant execute on function public.propose_job_visit(uuid, date, text, text) to authenticated;
grant execute on function public.confirm_job_visit(uuid) to authenticated;
grant execute on function public.reject_job_visit(uuid) to authenticated;
grant execute on function public.record_job_diagnosis(uuid, text) to authenticated;
grant execute on function public.create_job_quote(uuid, numeric, numeric, numeric, numeric, text, text, date) to authenticated;
grant execute on function public.send_job_quote(uuid) to authenticated;
grant execute on function public.accept_job_quote(uuid) to authenticated;
grant execute on function public.reject_job_quote(uuid, text) to authenticated;
grant execute on function public.select_professional_for_request(uuid, uuid) to authenticated;
grant execute on function public.list_professional_selected_jobs() to authenticated;
grant all privileges on table public.jobs to service_role;
grant all privileges on table public.job_quotes to service_role;
