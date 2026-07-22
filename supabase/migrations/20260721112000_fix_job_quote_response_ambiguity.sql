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
  where public.job_quotes.job_id = quote_record.job_id
    and public.job_quotes.id <> quote_record.id
    and public.job_quotes.status in ('draft', 'sent');

  update public.job_quotes
  set
    status = 'accepted',
    accepted_at = accepted_time
  where public.job_quotes.id = quote_record.id
  returning * into quote_record;

  update public.jobs
  set status = 'quote_accepted'
  where public.jobs.id = quote_record.job_id;

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
  where public.job_quotes.id = quote_record.id
  returning * into quote_record;

  update public.jobs
  set status = 'quote_rejected'
  where public.jobs.id = quote_record.job_id;

  return query
  select quote_record.job_id, 'quote_rejected'::text, quote_record.id, quote_record.status, quote_record.rejected_at;
end;
$$;

grant execute on function public.accept_job_quote(uuid) to authenticated;
grant execute on function public.reject_job_quote(uuid, text) to authenticated;
