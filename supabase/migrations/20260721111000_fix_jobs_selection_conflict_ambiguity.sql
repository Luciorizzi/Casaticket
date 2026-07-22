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
  on conflict on constraint jobs_request_id_key do nothing;

  return query
  select
    request_record.id,
    request_record.status,
    request_record.selected_professional_id,
    application_record.id,
    request_record.selected_at;
end;
$$;

grant execute on function public.select_professional_for_request(uuid, uuid) to authenticated;
