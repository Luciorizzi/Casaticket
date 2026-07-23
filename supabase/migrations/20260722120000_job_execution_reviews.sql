alter table public.jobs
  drop constraint if exists jobs_status_check;

alter table public.jobs
  add column if not exists started_at timestamptz,
  add column if not exists completion_summary text,
  add column if not exists final_notes text,
  add column if not exists final_materials_notes text,
  add column if not exists final_materials_amount numeric,
  add column if not exists professional_completed_at timestamptz,
  add column if not exists customer_confirmed_at timestamptz,
  add column if not exists dispute_reason text,
  add column if not exists dispute_details text,
  add column if not exists disputed_at timestamptz,
  add constraint jobs_status_check
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
        'ready_to_start',
        'in_progress',
        'completion_pending',
        'completed',
        'disputed',
        'cancelled'
      )
    ),
  add constraint jobs_completion_summary_length_check
    check (completion_summary is null or char_length(trim(completion_summary)) between 20 and 3000),
  add constraint jobs_dispute_details_length_check
    check (dispute_details is null or char_length(trim(dispute_details)) between 20 and 2000),
  add constraint jobs_final_materials_amount_check
    check (final_materials_amount is null or final_materials_amount >= 0);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  reviewer_user_id uuid not null references public.profiles (id) on delete cascade,
  reviewed_user_id uuid not null references public.profiles (id) on delete cascade,
  reviewer_role text not null,
  rating integer not null,
  comment text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint reviews_rating_check check (rating between 1 and 5),
  constraint reviews_reviewer_role_check check (reviewer_role in ('customer', 'professional')),
  constraint reviews_unique_reviewer_job unique (reviewer_user_id, job_id),
  constraint reviews_not_self_check check (reviewer_user_id <> reviewed_user_id)
);

create index if not exists reviews_job_id_idx on public.reviews (job_id);
create index if not exists reviews_reviewed_user_id_idx on public.reviews (reviewed_user_id);

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

drop trigger if exists validate_review_before_insert on public.reviews;
create trigger validate_review_before_insert
before insert on public.reviews
for each row
execute procedure public.validate_review();

alter table public.reviews enable row level security;

drop policy if exists "reviews_select_job_participants" on public.reviews;
create policy "reviews_select_job_participants"
on public.reviews
for select
to authenticated
using (public.is_job_participant(job_id));

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
    j.created_at,
    j.updated_at
  from public.jobs j
  where j.request_id = p_request_id
    and public.is_job_participant(j.id);
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

  update public.jobs j
  set
    status = 'in_progress',
    started_at = timezone('utc', now())
  where j.id = p_job_id
    and j.status in ('quote_accepted', 'ready_to_start')
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

  update public.jobs j
  set
    status = 'completion_pending',
    completion_summary = clean_summary,
    final_notes = clean_final_notes,
    final_materials_notes = clean_materials_notes,
    final_materials_amount = p_final_materials_amount,
    professional_completed_at = timezone('utc', now())
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
    customer_confirmed_at = timezone('utc', now())
  where j.id = p_job_id
    and j.status = 'completion_pending'
  returning * into updated_job;

  if not found then
    raise exception 'Job cannot be confirmed in the current status.';
  end if;

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
    and j.status = 'completion_pending'
  returning * into updated_job;

  if not found then
    raise exception 'Job cannot be disputed in the current status.';
  end if;

  return next updated_job;
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
      where j.professional_id = pp.id
        and j.status = 'completed'
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

drop function if exists public.list_customer_request_applications(uuid);

create function public.list_customer_request_applications(p_request_id uuid)
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
  conversation_id uuid,
  unread_count integer,
  last_message_body text,
  last_message_at timestamptz,
  professional_first_name text,
  professional_last_name text,
  professional_bio text,
  professional_years_experience integer,
  professional_base_city text,
  professional_service_radius_km integer,
  professional_verification_status text,
  professional_category_names text[],
  professional_completed_jobs_count integer,
  professional_average_rating numeric,
  professional_reviews_count integer
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
    conv.id as conversation_id,
    coalesce(public.get_conversation_unread_count(conv.id), 0) as unread_count,
    last_message.body as last_message_body,
    last_message.created_at as last_message_at,
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
    ) as professional_category_names,
    (
      select count(*)::integer
      from public.jobs j
      where j.professional_id = pp.id
        and j.status = 'completed'
    ) as professional_completed_jobs_count,
    (
      select round(avg(r.rating)::numeric, 2)
      from public.reviews r
      where r.reviewed_user_id = pp.user_id
    ) as professional_average_rating,
    (
      select count(*)::integer
      from public.reviews r
      where r.reviewed_user_id = pp.user_id
    ) as professional_reviews_count
  from public.applications a
  join public.service_requests sr on sr.id = a.request_id
  join public.professional_profiles pp on pp.id = a.professional_id
  join public.profiles p on p.id = pp.user_id
  left join public.conversations conv on conv.application_id = a.id
  left join lateral (
    select m.body, m.created_at
    from public.messages m
    where m.conversation_id = conv.id
      and m.deleted_at is null
    order by m.created_at desc
    limit 1
  ) last_message on true
  left join public.professional_categories pc on pc.professional_id = pp.id
  left join public.categories c on c.id = pc.category_id
  where sr.id = p_request_id
    and sr.customer_id = auth.uid()
  group by a.id, conv.id, last_message.body, last_message.created_at, p.id, pp.id
  order by a.created_at asc;
$$;

grant select on table public.reviews to authenticated;
grant all privileges on table public.reviews to service_role;
grant execute on function public.start_job(uuid) to authenticated;
grant execute on function public.mark_job_completed_by_professional(uuid, text, text, text, numeric) to authenticated;
grant execute on function public.confirm_job_completion(uuid) to authenticated;
grant execute on function public.dispute_job_completion(uuid, text, text) to authenticated;
grant execute on function public.create_review(uuid, integer, text) to authenticated;
grant execute on function public.get_professional_public_metrics(uuid) to authenticated;
grant execute on function public.get_job_by_request(uuid) to authenticated;
grant execute on function public.list_customer_request_applications(uuid) to authenticated;
