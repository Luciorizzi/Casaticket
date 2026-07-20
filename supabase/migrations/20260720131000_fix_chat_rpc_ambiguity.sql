create or replace function public.ensure_application_conversation(p_application_id uuid)
returns table (
  conversation_id uuid,
  application_id uuid,
  request_id uuid,
  customer_id uuid,
  professional_id uuid,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  unread_count integer,
  can_send boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  application_record public.applications%rowtype;
  request_customer_id uuid;
begin
  select a.*
  into application_record
  from public.applications a
  join public.service_requests sr on sr.id = a.request_id
  join public.professional_profiles pp on pp.id = a.professional_id
  where a.id = p_application_id
    and (
      sr.customer_id = auth.uid()
      or pp.user_id = auth.uid()
    );

  if not found then
    raise exception 'Application conversation not found for this user.';
  end if;

  select sr.customer_id
  into request_customer_id
  from public.service_requests sr
  where sr.id = application_record.request_id;

  insert into public.conversations (
    application_id,
    request_id,
    customer_id,
    professional_id
  )
  values (
    application_record.id,
    application_record.request_id,
    request_customer_id,
    application_record.professional_id
  )
  on conflict on constraint conversations_application_id_key do nothing;

  return query
  select
    c.id,
    c.application_id,
    c.request_id,
    c.customer_id,
    c.professional_id,
    c.status,
    c.created_at,
    c.updated_at,
    public.get_conversation_unread_count(c.id),
    public.can_send_conversation_message(c.id)
  from public.conversations c
  where c.application_id = p_application_id;
end;
$$;
