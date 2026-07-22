drop function if exists public.select_professional_for_request(uuid, uuid);

create function public.select_professional_for_request(
  p_request_id uuid,
  p_application_id uuid
)
returns table (
  request_id uuid,
  request_status text,
  selected_professional_id uuid,
  selected_application_id uuid,
  selected_at timestamptz,
  job_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  request_record public.service_requests%rowtype;
  application_record public.applications%rowtype;
  job_record public.jobs%rowtype;
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
  on conflict on constraint jobs_request_id_key do update
  set
    selected_application_id = excluded.selected_application_id,
    customer_id = excluded.customer_id,
    professional_id = excluded.professional_id
  returning * into job_record;

  return query
  select
    request_record.id,
    request_record.status,
    request_record.selected_professional_id,
    application_record.id,
    request_record.selected_at,
    job_record.id;
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
  join public.jobs j on j.selected_application_id = a.id
  left join public.conversations conv on conv.application_id = a.id
  left join lateral (
    select m.body, m.created_at
    from public.messages m
    where m.conversation_id = conv.id
      and m.deleted_at is null
    order by m.created_at desc
    limit 1
  ) last_message on true
  left join public.categories c on c.id = sr.category_id
  where pp.user_id = auth.uid()
    and a.status = 'selected'
    and sr.status = 'professional_selected'
  order by sr.selected_at desc nulls last;
$$;

insert into public.jobs (
  request_id,
  selected_application_id,
  customer_id,
  professional_id,
  status
)
select
  sr.id,
  a.id,
  sr.customer_id,
  a.professional_id,
  'coordination_pending'
from public.service_requests sr
join public.applications a
  on a.request_id = sr.id
  and a.status = 'selected'
  and a.professional_id = sr.selected_professional_id
where sr.status = 'professional_selected'
  and not exists (
    select 1
    from public.jobs j
    where j.request_id = sr.id
  )
on conflict on constraint jobs_request_id_key do nothing;

grant execute on function public.select_professional_for_request(uuid, uuid) to authenticated;
grant execute on function public.list_professional_selected_jobs() to authenticated;
