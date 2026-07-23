create or replace function public.accept_quote_and_create_payment(p_quote_id uuid)
returns table (
  job_id uuid,
  job_status text,
  quote_id uuid,
  quote_status text,
  payment_id uuid,
  payment_status text,
  accepted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  quote_record public.job_quotes%rowtype;
  job_record public.jobs%rowtype;
  payment_record public.payments%rowtype;
  accepted_time timestamptz := timezone('utc', now());
  calculated_platform_fee_amount numeric;
  calculated_customer_total_amount numeric;
  calculated_professional_amount numeric;
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

  select *
  into job_record
  from public.jobs
  where id = quote_record.job_id
  for update;

  if quote_record.status not in ('sent', 'accepted') then
    raise exception 'Only sent quotes can be accepted.';
  end if;

  calculated_platform_fee_amount := round(quote_record.labor_amount * 0.05, 2);
  calculated_customer_total_amount := quote_record.labor_amount + quote_record.visit_amount + calculated_platform_fee_amount;
  calculated_professional_amount := quote_record.labor_amount + quote_record.visit_amount;

  if quote_record.status = 'sent' then
    update public.job_quotes
    set status = 'superseded'
    where public.job_quotes.job_id = quote_record.job_id
      and public.job_quotes.id <> quote_record.id
      and public.job_quotes.status in ('draft', 'sent');

    update public.job_quotes
    set
      status = 'accepted',
      platform_fee_amount = calculated_platform_fee_amount,
      total_amount = calculated_customer_total_amount,
      accepted_at = accepted_time
    where public.job_quotes.id = quote_record.id
    returning * into quote_record;

    update public.jobs
    set status = 'payment_pending'
    where public.jobs.id = quote_record.job_id
    returning * into job_record;
  end if;

  insert into public.payments (
    job_id,
    quote_id,
    customer_id,
    professional_id,
    status,
    currency,
    labor_amount,
    visit_amount,
    materials_reference_amount,
    platform_fee_amount,
    customer_total_amount,
    professional_amount
  )
  values (
    quote_record.job_id,
    quote_record.id,
    job_record.customer_id,
    job_record.professional_id,
    'pending',
    quote_record.currency,
    quote_record.labor_amount,
    quote_record.visit_amount,
    quote_record.materials_amount,
    calculated_platform_fee_amount,
    calculated_customer_total_amount,
    calculated_professional_amount
  )
  on conflict (job_id) do nothing;

  select *
  into payment_record
  from public.payments p
  where p.job_id = quote_record.job_id
  for update;

  if payment_record.quote_id <> quote_record.id then
    raise exception 'Job already has a payment for another quote.';
  end if;

  return query
  select
    job_record.id,
    job_record.status,
    quote_record.id,
    quote_record.status,
    payment_record.id,
    payment_record.status,
    quote_record.accepted_at;
end;
$$;
