alter table public.jobs
  add column if not exists recommended_work_text text,
  add column if not exists materials_notes text,
  add column if not exists diagnosis_notes text;

alter table public.job_quotes
  add column if not exists rejection_reason text;

update public.job_quotes
set rejection_reason = rejected_reason
where rejection_reason is null
  and rejected_reason is not null;

drop function if exists public.get_job_by_request(uuid);

create function public.get_job_by_request(p_request_id uuid)
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
  recommended_work_text text,
  materials_notes text,
  diagnosis_notes text,
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
    j.recommended_work_text,
    j.materials_notes,
    j.diagnosis_notes,
    j.diagnosed_at,
    j.created_at,
    j.updated_at
  from public.jobs j
  where j.request_id = p_request_id
    and public.is_job_participant(j.id);
$$;

drop function if exists public.list_job_quotes(uuid);

create function public.list_job_quotes(p_job_id uuid)
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
  rejection_reason text,
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
    jq.rejection_reason,
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

create or replace function public.record_job_diagnosis(
  p_job_id uuid,
  p_diagnosis_text text,
  p_recommended_work_text text,
  p_materials_notes text default null,
  p_diagnosis_notes text default null
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_job public.jobs%rowtype;
  clean_diagnosis text := trim(coalesce(p_diagnosis_text, ''));
  clean_recommended_work text := trim(coalesce(p_recommended_work_text, ''));
begin
  if not public.is_job_professional(p_job_id) then
    raise exception 'Only the selected professional can register the diagnosis.';
  end if;

  if char_length(clean_diagnosis) < 20 or char_length(clean_diagnosis) > 3000 then
    raise exception 'Diagnosis length is not allowed.';
  end if;

  if char_length(clean_recommended_work) < 10 or char_length(clean_recommended_work) > 3000 then
    raise exception 'Recommended work length is not allowed.';
  end if;

  update public.jobs j
  set
    status = 'quote_pending',
    diagnosis_text = clean_diagnosis,
    recommended_work_text = clean_recommended_work,
    materials_notes = nullif(trim(coalesce(p_materials_notes, '')), ''),
    diagnosis_notes = nullif(trim(coalesce(p_diagnosis_notes, '')), ''),
    diagnosed_at = timezone('utc', now())
  where j.id = p_job_id
    and j.status in ('visit_confirmed', 'diagnosis_pending')
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
  quote_record public.job_quotes%rowtype;
  clean_description text := trim(coalesce(p_description, ''));
  clean_labor_amount numeric := coalesce(p_labor_amount, 0);
  clean_materials_amount numeric := coalesce(p_materials_amount, 0);
  clean_visit_amount numeric := coalesce(p_visit_amount, 0);
  clean_platform_fee_amount numeric := coalesce(p_platform_fee_amount, 0);
begin
  if not public.is_job_professional(p_job_id) then
    raise exception 'Only the selected professional can create quotes.';
  end if;

  select *
  into job_record
  from public.jobs
  where id = p_job_id
  for update;

  if not found or job_record.status not in ('quote_pending', 'quote_rejected') then
    raise exception 'Quote cannot be created in the current job status.';
  end if;

  if clean_labor_amount < 0 or clean_materials_amount < 0 or clean_visit_amount < 0 or clean_platform_fee_amount < 0 then
    raise exception 'Quote amounts cannot be negative.';
  end if;

  if clean_labor_amount + clean_materials_amount + clean_visit_amount + clean_platform_fee_amount <= 0 then
    raise exception 'Quote must include at least one positive amount.';
  end if;

  if char_length(clean_description) < 20 or char_length(clean_description) > 3000 then
    raise exception 'Quote description length is not allowed.';
  end if;

  select jq.*
  into quote_record
  from public.job_quotes jq
  where jq.job_id = p_job_id
    and jq.status = 'draft'
  order by jq.version desc
  limit 1
  for update;

  if found then
    update public.job_quotes
    set
      labor_amount = clean_labor_amount,
      materials_amount = clean_materials_amount,
      visit_amount = clean_visit_amount,
      platform_fee_amount = clean_platform_fee_amount,
      total_amount = clean_labor_amount + clean_materials_amount + clean_visit_amount + clean_platform_fee_amount,
      description = clean_description,
      estimated_duration_text = nullif(trim(coalesce(p_estimated_duration_text, '')), ''),
      valid_until = p_valid_until
    where id = quote_record.id
    returning * into quote_record;
  else
    select coalesce(max(version), 0) + 1
    into next_version
    from public.job_quotes
    where job_id = p_job_id;

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
      clean_labor_amount,
      clean_materials_amount,
      clean_visit_amount,
      clean_platform_fee_amount,
      clean_labor_amount + clean_materials_amount + clean_visit_amount + clean_platform_fee_amount,
      clean_description,
      nullif(trim(coalesce(p_estimated_duration_text, '')), ''),
      p_valid_until,
      'draft'
    )
    returning * into quote_record;
  end if;

  return next quote_record;
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
  job_record public.jobs%rowtype;
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

  select *
  into job_record
  from public.jobs
  where id = quote_record.job_id
  for update;

  if quote_record.status <> 'draft' then
    raise exception 'Only draft quotes can be sent.';
  end if;

  if job_record.status not in ('quote_pending', 'quote_rejected') then
    raise exception 'Quote cannot be sent in the current job status.';
  end if;

  update public.job_quotes
  set status = 'superseded'
  where job_id = quote_record.job_id
    and id <> quote_record.id
    and status = 'sent';

  update public.job_quotes
  set
    status = 'sent',
    total_amount = labor_amount + materials_amount + visit_amount + platform_fee_amount
  where id = quote_record.id
  returning * into quote_record;

  update public.jobs
  set status = 'quote_sent'
  where id = quote_record.job_id;

  return next quote_record;
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
  rejected_time timestamptz := timezone('utc', now());
  clean_reason text := nullif(trim(coalesce(p_rejected_reason, '')), '');
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
    rejected_reason = clean_reason,
    rejection_reason = clean_reason
  where id = quote_record.id
  returning * into quote_record;

  update public.jobs
  set status = 'quote_rejected'
  where id = quote_record.job_id;

  return query
  select quote_record.job_id, 'quote_rejected'::text, quote_record.id, quote_record.status, quote_record.rejected_at;
end;
$$;

grant execute on function public.get_job_by_request(uuid) to authenticated;
grant execute on function public.list_job_quotes(uuid) to authenticated;
grant execute on function public.record_job_diagnosis(uuid, text, text, text, text) to authenticated;
grant execute on function public.create_job_quote(uuid, numeric, numeric, numeric, numeric, text, text, date) to authenticated;
grant execute on function public.send_job_quote(uuid) to authenticated;
grant execute on function public.reject_job_quote(uuid, text) to authenticated;
