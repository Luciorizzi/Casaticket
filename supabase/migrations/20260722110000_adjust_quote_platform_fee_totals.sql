update public.job_quotes
set
  platform_fee_amount = round(labor_amount * 0.05, 2),
  total_amount = labor_amount + visit_amount + round(labor_amount * 0.05, 2);

create or replace function public.create_job_quote(
  p_job_id uuid,
  p_labor_amount numeric,
  p_materials_amount numeric,
  p_visit_amount numeric,
  p_platform_fee_amount numeric default null,
  p_description text default null,
  p_estimated_duration_text text default null,
  p_valid_until date default null
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
  calculated_platform_fee_amount numeric;
  calculated_total_amount numeric;
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

  if clean_labor_amount < 0 or clean_materials_amount < 0 or clean_visit_amount < 0 then
    raise exception 'Quote amounts cannot be negative.';
  end if;

  calculated_platform_fee_amount := round(clean_labor_amount * 0.05, 2);
  calculated_total_amount := clean_labor_amount + clean_visit_amount + calculated_platform_fee_amount;

  if calculated_total_amount <= 0 then
    raise exception 'Quote must include at least one positive service amount.';
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
      platform_fee_amount = calculated_platform_fee_amount,
      total_amount = calculated_total_amount,
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
      calculated_platform_fee_amount,
      calculated_total_amount,
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
    platform_fee_amount = round(labor_amount * 0.05, 2),
    total_amount = labor_amount + visit_amount + round(labor_amount * 0.05, 2)
  where id = quote_record.id
  returning * into quote_record;

  update public.jobs
  set status = 'quote_sent'
  where id = quote_record.job_id;

  return next quote_record;
end;
$$;

grant execute on function public.create_job_quote(uuid, numeric, numeric, numeric, numeric, text, text, date) to authenticated;
grant execute on function public.send_job_quote(uuid) to authenticated;
