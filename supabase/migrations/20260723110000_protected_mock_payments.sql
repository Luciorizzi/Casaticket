alter table public.jobs
  drop constraint if exists jobs_status_check;

alter table public.jobs
  add column if not exists review_deadline_at timestamptz,
  add column if not exists completion_mode text,
  add constraint jobs_status_check
    check (
      status in (
        'coordination_pending',
        'visit_proposed',
        'visit_confirmed',
        'diagnosis_pending',
        'quote_pending',
        'quote_sent',
        'payment_pending',
        'quote_accepted',
        'quote_rejected',
        'ready_to_start',
        'in_progress',
        'review_pending',
        'completion_pending',
        'completed',
        'disputed',
        'cancelled'
      )
    );

alter table public.jobs
  drop constraint if exists jobs_completion_mode_check;

alter table public.jobs
  add constraint jobs_completion_mode_check
    check (completion_mode is null or completion_mode in ('customer_confirmed', 'automatic'));

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs (id) on delete cascade,
  quote_id uuid not null unique references public.job_quotes (id) on delete restrict,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professional_profiles (id) on delete cascade,
  status text not null default 'pending',
  provider text not null default 'mock',
  provider_payment_id text,
  currency text not null default 'ARS',
  labor_amount numeric not null,
  visit_amount numeric not null,
  materials_reference_amount numeric not null default 0,
  platform_fee_amount numeric not null,
  customer_total_amount numeric not null,
  professional_amount numeric not null,
  released_amount numeric,
  failure_reason text,
  paid_at timestamptz,
  secured_at timestamptz,
  release_pending_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payments_status_check
    check (
      status in (
        'pending',
        'processing',
        'secured',
        'failed',
        'release_pending',
        'released',
        'disputed',
        'refund_pending',
        'refunded',
        'cancelled'
      )
    ),
  constraint payments_amounts_non_negative_check
    check (
      labor_amount >= 0
      and visit_amount >= 0
      and materials_reference_amount >= 0
      and platform_fee_amount >= 0
      and customer_total_amount >= 0
      and professional_amount >= 0
      and (released_amount is null or released_amount >= 0)
    )
);

create index if not exists payments_customer_id_idx on public.payments (customer_id);
create index if not exists payments_professional_id_idx on public.payments (professional_id);
create index if not exists payments_status_idx on public.payments (status);

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
before update on public.payments
for each row
execute procedure public.set_updated_at();

create or replace function public.is_payment_participant(p_payment_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.payments p
    join public.professional_profiles pp on pp.id = p.professional_id
    where p.id = p_payment_id
      and (
        p.customer_id = auth.uid()
        or pp.user_id = auth.uid()
      )
  );
$$;

alter table public.payments enable row level security;

drop policy if exists "payments_select_participants" on public.payments;
create policy "payments_select_participants"
on public.payments
for select
to authenticated
using (public.is_payment_participant(id));

drop function if exists public.get_job_payment(uuid);
create function public.get_job_payment(p_job_id uuid)
returns table (
  payment_id uuid,
  job_id uuid,
  quote_id uuid,
  customer_id uuid,
  professional_id uuid,
  status text,
  provider text,
  provider_payment_id text,
  currency text,
  labor_amount numeric,
  visit_amount numeric,
  materials_reference_amount numeric,
  platform_fee_amount numeric,
  customer_total_amount numeric,
  professional_amount numeric,
  released_amount numeric,
  failure_reason text,
  paid_at timestamptz,
  secured_at timestamptz,
  release_pending_at timestamptz,
  released_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.job_id,
    p.quote_id,
    p.customer_id,
    p.professional_id,
    p.status,
    p.provider,
    p.provider_payment_id,
    p.currency,
    p.labor_amount,
    p.visit_amount,
    p.materials_reference_amount,
    p.platform_fee_amount,
    p.customer_total_amount,
    p.professional_amount,
    p.released_amount,
    p.failure_reason,
    p.paid_at,
    p.secured_at,
    p.release_pending_at,
    p.released_at,
    p.refunded_at,
    p.created_at,
    p.updated_at
  from public.payments p
  where p.job_id = p_job_id
    and public.is_job_participant(p_job_id);
$$;

drop function if exists public.get_payment_status(uuid);
create function public.get_payment_status(p_payment_id uuid)
returns setof public.payments
language sql
security definer
set search_path = public
stable
as $$
  select *
  from public.payments p
  where p.id = p_payment_id
    and public.is_payment_participant(p.id);
$$;

drop function if exists public.accept_quote_and_create_payment(uuid);
create function public.accept_quote_and_create_payment(p_quote_id uuid)
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
    where job_id = quote_record.job_id
      and id <> quote_record.id
      and status in ('draft', 'sent');

    update public.job_quotes
    set
      status = 'accepted',
      platform_fee_amount = calculated_platform_fee_amount,
      total_amount = calculated_customer_total_amount,
      accepted_at = accepted_time
    where id = quote_record.id
    returning * into quote_record;

    update public.jobs
    set status = 'payment_pending'
    where id = quote_record.job_id
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
  from public.payments
  where job_id = quote_record.job_id
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

drop function if exists public.accept_job_quote(uuid);
create function public.accept_job_quote(p_quote_id uuid)
returns table (
  job_id uuid,
  job_status text,
  quote_id uuid,
  quote_status text,
  accepted_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    accepted.job_id,
    accepted.job_status,
    accepted.quote_id,
    accepted.quote_status,
    accepted.accepted_at
  from public.accept_quote_and_create_payment(p_quote_id) accepted;
$$;

drop function if exists public.retry_mock_payment(uuid);
create function public.retry_mock_payment(p_payment_id uuid)
returns setof public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record public.payments%rowtype;
begin
  select *
  into payment_record
  from public.payments
  where id = p_payment_id
  for update;

  if not found or not public.is_job_customer(payment_record.job_id) then
    raise exception 'Payment not found for this customer.';
  end if;

  if payment_record.status = 'pending' then
    return next payment_record;
    return;
  end if;

  if payment_record.status <> 'failed' then
    raise exception 'Only failed payments can be retried.';
  end if;

  update public.payments
  set
    status = 'pending',
    failure_reason = null
  where id = payment_record.id
  returning * into payment_record;

  return next payment_record;
end;
$$;

drop function if exists public.secure_mock_payment(uuid, boolean, text);
create function public.secure_mock_payment(
  p_payment_id uuid,
  p_approved boolean default true,
  p_failure_reason text default null
)
returns setof public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record public.payments%rowtype;
begin
  select *
  into payment_record
  from public.payments
  where id = p_payment_id
  for update;

  if not found or not public.is_job_customer(payment_record.job_id) then
    raise exception 'Payment not found for this customer.';
  end if;

  if payment_record.status = 'secured' then
    return next payment_record;
    return;
  end if;

  if payment_record.status not in ('pending', 'processing') then
    raise exception 'Payment cannot be processed in the current status.';
  end if;

  if not coalesce(p_approved, true) then
    update public.payments
    set
      status = 'failed',
      failure_reason = coalesce(nullif(trim(coalesce(p_failure_reason, '')), ''), 'Pago rechazado por el proveedor simulado.')
    where id = payment_record.id
    returning * into payment_record;

    return next payment_record;
    return;
  end if;

  update public.payments
  set
    status = 'secured',
    failure_reason = null,
    provider_payment_id = coalesce(provider_payment_id, 'mock-' || id::text),
    paid_at = coalesce(paid_at, timezone('utc', now())),
    secured_at = coalesce(secured_at, timezone('utc', now()))
  where id = payment_record.id
  returning * into payment_record;

  update public.jobs
  set status = 'ready_to_start'
  where id = payment_record.job_id
    and status = 'payment_pending';

  return next payment_record;
end;
$$;

create or replace function public.start_job(p_job_id uuid)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_job public.jobs%rowtype;
begin
  if not public.is_job_professional(p_job_id) then
    raise exception 'Only the selected professional can start this job.';
  end if;

  if not exists (
    select 1
    from public.job_quotes jq
    join public.payments p on p.quote_id = jq.id
    where jq.job_id = p_job_id
      and jq.status = 'accepted'
      and p.status = 'secured'
  ) then
    raise exception 'Payment must be secured before starting the job.';
  end if;

  update public.jobs j
  set
    status = 'in_progress',
    started_at = coalesce(j.started_at, timezone('utc', now()))
  where j.id = p_job_id
    and j.status = 'ready_to_start'
  returning * into updated_job;

  if not found then
    raise exception 'Job cannot be started in the current status.';
  end if;

  return next updated_job;
end;
$$;

create or replace function public.mark_job_completed_by_professional(
  p_job_id uuid,
  p_completion_summary text,
  p_final_notes text default null,
  p_final_materials_notes text default null,
  p_final_materials_amount numeric default null
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_job public.jobs%rowtype;
  clean_summary text := trim(coalesce(p_completion_summary, ''));
  clean_final_notes text := nullif(trim(coalesce(p_final_notes, '')), '');
  clean_materials_notes text := nullif(trim(coalesce(p_final_materials_notes, '')), '');
begin
  if not public.is_job_professional(p_job_id) then
    raise exception 'Only the selected professional can finish this job.';
  end if;

  if char_length(clean_summary) < 20 or char_length(clean_summary) > 3000 then
    raise exception 'Completion summary length is not allowed.';
  end if;

  if p_final_materials_amount is not null and p_final_materials_amount < 0 then
    raise exception 'Final materials amount cannot be negative.';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.job_id = p_job_id
      and p.status = 'secured'
  ) then
    raise exception 'Payment must remain secured before finishing the job.';
  end if;

  update public.jobs j
  set
    status = 'review_pending',
    completion_summary = clean_summary,
    final_notes = clean_final_notes,
    final_materials_notes = clean_materials_notes,
    final_materials_amount = p_final_materials_amount,
    professional_completed_at = timezone('utc', now()),
    review_deadline_at = timezone('utc', now()) + interval '48 hours'
  where j.id = p_job_id
    and j.status = 'in_progress'
  returning * into updated_job;

  if not found then
    raise exception 'Job cannot be completed in the current status.';
  end if;

  return next updated_job;
end;
$$;

create or replace function public.confirm_job_completion(p_job_id uuid)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_job public.jobs%rowtype;
begin
  if not public.is_job_customer(p_job_id) then
    raise exception 'Only the customer can confirm this job.';
  end if;

  update public.jobs j
  set
    status = 'completed',
    completion_mode = 'customer_confirmed',
    customer_confirmed_at = timezone('utc', now())
  where j.id = p_job_id
    and j.status in ('review_pending', 'completion_pending')
    and exists (
      select 1
      from public.payments p
      where p.job_id = j.id
        and p.status = 'secured'
    )
  returning * into updated_job;

  if not found then
    raise exception 'Job cannot be confirmed in the current status.';
  end if;

  update public.payments
  set
    status = 'release_pending',
    release_pending_at = coalesce(release_pending_at, timezone('utc', now()))
  where job_id = p_job_id
    and status = 'secured';

  return next updated_job;
end;
$$;

create or replace function public.dispute_job_completion(
  p_job_id uuid,
  p_dispute_reason text,
  p_dispute_details text
)
returns setof public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_job public.jobs%rowtype;
  clean_reason text := trim(coalesce(p_dispute_reason, ''));
  clean_details text := trim(coalesce(p_dispute_details, ''));
begin
  if not public.is_job_customer(p_job_id) then
    raise exception 'Only the customer can report a problem for this job.';
  end if;

  if char_length(clean_reason) < 3 or char_length(clean_reason) > 120 then
    raise exception 'Dispute reason length is not allowed.';
  end if;

  if char_length(clean_details) < 20 or char_length(clean_details) > 2000 then
    raise exception 'Dispute details length is not allowed.';
  end if;

  update public.jobs j
  set
    status = 'disputed',
    dispute_reason = clean_reason,
    dispute_details = clean_details,
    disputed_at = timezone('utc', now())
  where j.id = p_job_id
    and j.status in ('review_pending', 'completion_pending')
  returning * into updated_job;

  if not found then
    raise exception 'Job cannot be disputed in the current status.';
  end if;

  update public.payments
  set status = 'disputed'
  where job_id = p_job_id
    and status in ('secured', 'release_pending');

  return next updated_job;
end;
$$;

drop function if exists public.complete_expired_jobs();
create function public.complete_expired_jobs()
returns table (
  job_id uuid,
  payment_id uuid,
  job_status text,
  payment_status text
)
language sql
security definer
set search_path = public
as $$
  with eligible as (
    select j.id as job_id, p.id as payment_id
    from public.jobs j
    join public.payments p on p.job_id = j.id
    where j.status = 'review_pending'
      and j.review_deadline_at is not null
      and j.review_deadline_at <= timezone('utc', now())
      and j.disputed_at is null
      and p.status = 'secured'
    for update of j, p
  ),
  updated_jobs as (
    update public.jobs j
    set
      status = 'completed',
      completion_mode = 'automatic',
      customer_confirmed_at = coalesce(j.customer_confirmed_at, j.review_deadline_at)
    from eligible e
    where j.id = e.job_id
    returning j.id
  ),
  updated_payments as (
    update public.payments p
    set
      status = 'release_pending',
      release_pending_at = coalesce(p.release_pending_at, timezone('utc', now()))
    from eligible e
    join updated_jobs uj on uj.id = e.job_id
    where p.id = e.payment_id
    returning p.id, p.job_id, p.status
  )
  select
    up.job_id,
    up.id,
    'completed'::text,
    up.status
  from updated_payments up;
$$;

drop function if exists public.release_eligible_payments();
create function public.release_eligible_payments()
returns setof public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  released_payment public.payments%rowtype;
begin
  for released_payment in
    update public.payments p
    set
      status = 'released',
      released_at = coalesce(p.released_at, timezone('utc', now())),
      released_amount = p.professional_amount
    where p.status = 'release_pending'
      and exists (
        select 1
        from public.jobs j
        where j.id = p.job_id
          and j.status = 'completed'
          and j.disputed_at is null
      )
    returning *
  loop
    return next released_payment;
  end loop;
end;
$$;

drop function if exists public.refund_mock_payment(uuid);
create function public.refund_mock_payment(p_payment_id uuid)
returns setof public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record public.payments%rowtype;
  requester_role text;
begin
  select role::text
  into requester_role
  from public.profiles
  where id = auth.uid();

  if coalesce(auth.role(), '') <> 'service_role' and requester_role not in ('admin', 'operator') then
    raise exception 'Only internal operators can refund payments.';
  end if;

  select *
  into payment_record
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found.';
  end if;

  if payment_record.status = 'refunded' then
    return next payment_record;
    return;
  end if;

  if payment_record.status not in ('disputed', 'refund_pending') then
    raise exception 'Payment cannot be refunded in the current status.';
  end if;

  update public.payments
  set
    status = 'refunded',
    refunded_at = coalesce(refunded_at, timezone('utc', now()))
  where id = payment_record.id
  returning * into payment_record;

  return next payment_record;
end;
$$;

create or replace function public.validate_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_record public.jobs%rowtype;
  professional_user_id uuid;
begin
  select *
  into job_record
  from public.jobs
  where id = new.job_id;

  if not found then
    raise exception 'Job not found for review.';
  end if;

  if job_record.status <> 'completed' then
    raise exception 'Reviews are only allowed for completed jobs.';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.job_id = new.job_id
      and p.status = 'released'
  ) then
    raise exception 'Reviews are only allowed after payment release.';
  end if;

  select pp.user_id
  into professional_user_id
  from public.professional_profiles pp
  where pp.id = job_record.professional_id;

  if new.reviewer_role = 'customer' then
    if new.reviewer_user_id <> job_record.customer_id or new.reviewed_user_id <> professional_user_id then
      raise exception 'Customer review participants do not match this job.';
    end if;
  elsif new.reviewer_role = 'professional' then
    if new.reviewer_user_id <> professional_user_id or new.reviewed_user_id <> job_record.customer_id then
      raise exception 'Professional review participants do not match this job.';
    end if;
  else
    raise exception 'Invalid reviewer role.';
  end if;

  return new;
end;
$$;

create or replace function public.create_review(
  p_job_id uuid,
  p_rating integer,
  p_comment text default null
)
returns setof public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  job_record public.jobs%rowtype;
  professional_user_id uuid;
  reviewer_role text;
  reviewed_user_id uuid;
  created_review public.reviews%rowtype;
  clean_comment text := nullif(trim(coalesce(p_comment, '')), '');
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'Rating must be between 1 and 5.';
  end if;

  select *
  into job_record
  from public.jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception 'Job not found.';
  end if;

  if job_record.status <> 'completed' then
    raise exception 'Reviews are only allowed after job completion.';
  end if;

  if not exists (
    select 1
    from public.payments p
    where p.job_id = p_job_id
      and p.status = 'released'
  ) then
    raise exception 'Reviews are only allowed after payment release.';
  end if;

  select pp.user_id
  into professional_user_id
  from public.professional_profiles pp
  where pp.id = job_record.professional_id;

  if auth.uid() = job_record.customer_id then
    reviewer_role := 'customer';
    reviewed_user_id := professional_user_id;
  elsif auth.uid() = professional_user_id then
    reviewer_role := 'professional';
    reviewed_user_id := job_record.customer_id;
  else
    raise exception 'Only job participants can review.';
  end if;

  insert into public.reviews (
    job_id,
    reviewer_user_id,
    reviewed_user_id,
    reviewer_role,
    rating,
    comment
  )
  values (
    p_job_id,
    auth.uid(),
    reviewed_user_id,
    reviewer_role,
    p_rating,
    clean_comment
  )
  returning * into created_review;

  return next created_review;
end;
$$;

create or replace function public.get_professional_public_metrics(p_professional_id uuid)
returns table (
  professional_id uuid,
  completed_jobs_count integer,
  average_rating numeric,
  reviews_count integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    pp.id as professional_id,
    (
      select count(*)::integer
      from public.jobs j
      join public.payments p on p.job_id = j.id
      where j.professional_id = pp.id
        and j.status = 'completed'
        and p.status = 'released'
    ) as completed_jobs_count,
    (
      select round(avg(r.rating)::numeric, 2)
      from public.reviews r
      where r.reviewed_user_id = pp.user_id
    ) as average_rating,
    (
      select count(*)::integer
      from public.reviews r
      where r.reviewed_user_id = pp.user_id
    ) as reviews_count
  from public.professional_profiles pp
  where pp.id = p_professional_id
    and exists (select 1 from public.profiles p where p.id = auth.uid());
$$;

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
  started_at timestamptz,
  completion_summary text,
  final_notes text,
  final_materials_notes text,
  final_materials_amount numeric,
  professional_completed_at timestamptz,
  customer_confirmed_at timestamptz,
  dispute_reason text,
  dispute_details text,
  disputed_at timestamptz,
  review_deadline_at timestamptz,
  completion_mode text,
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
    j.started_at,
    j.completion_summary,
    j.final_notes,
    j.final_materials_notes,
    j.final_materials_amount,
    j.professional_completed_at,
    j.customer_confirmed_at,
    j.dispute_reason,
    j.dispute_details,
    j.disputed_at,
    j.review_deadline_at,
    j.completion_mode,
    j.created_at,
    j.updated_at
  from public.jobs j
  where j.request_id = p_request_id
    and public.is_job_participant(j.id);
$$;

grant select on table public.payments to authenticated;
grant all privileges on table public.payments to service_role;
grant execute on function public.get_job_payment(uuid) to authenticated;
grant execute on function public.get_payment_status(uuid) to authenticated;
grant execute on function public.accept_quote_and_create_payment(uuid) to authenticated;
grant execute on function public.accept_job_quote(uuid) to authenticated;
grant execute on function public.retry_mock_payment(uuid) to authenticated;
grant execute on function public.secure_mock_payment(uuid, boolean, text) to authenticated;
grant execute on function public.start_job(uuid) to authenticated;
grant execute on function public.mark_job_completed_by_professional(uuid, text, text, text, numeric) to authenticated;
grant execute on function public.confirm_job_completion(uuid) to authenticated;
grant execute on function public.dispute_job_completion(uuid, text, text) to authenticated;
grant execute on function public.create_review(uuid, integer, text) to authenticated;
grant execute on function public.complete_expired_jobs() to service_role;
grant execute on function public.release_eligible_payments() to service_role;
grant execute on function public.refund_mock_payment(uuid) to authenticated, service_role;
