create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns table (
  conversation_id uuid,
  unread_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'Conversation not found for this user.';
  end if;

  update public.conversations c
  set customer_last_read_at = now()
  where c.id = p_conversation_id
    and c.customer_id = auth.uid();

  update public.conversations c
  set professional_last_read_at = now()
  from public.professional_profiles pp
  where c.id = p_conversation_id
    and pp.id = c.professional_id
    and pp.user_id = auth.uid();

  return query
  select p_conversation_id, public.get_conversation_unread_count(p_conversation_id);
end;
$$;

create or replace function public.get_conversation(p_conversation_id uuid)
returns table (
  conversation_id uuid,
  application_id uuid,
  request_id uuid,
  request_title text,
  customer_id uuid,
  professional_id uuid,
  status text,
  application_status text,
  request_status text,
  counterpart_user_id uuid,
  counterpart_name text,
  last_message_body text,
  last_message_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  unread_count integer,
  can_send boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id as conversation_id,
    c.application_id,
    c.request_id,
    sr.title as request_title,
    c.customer_id,
    c.professional_id,
    c.status,
    a.status as application_status,
    sr.status as request_status,
    case
      when c.customer_id = auth.uid() then pp.user_id
      else c.customer_id
    end as counterpart_user_id,
    trim(
      concat_ws(
        ' ',
        case when c.customer_id = auth.uid() then professional_profile.first_name else customer_profile.first_name end,
        case when c.customer_id = auth.uid() then professional_profile.last_name else customer_profile.last_name end
      )
    ) as counterpart_name,
    last_message.body as last_message_body,
    last_message.created_at as last_message_at,
    c.created_at,
    c.updated_at,
    public.get_conversation_unread_count(c.id) as unread_count,
    public.can_send_conversation_message(c.id) as can_send
  from public.conversations c
  join public.applications a on a.id = c.application_id
  join public.service_requests sr on sr.id = c.request_id
  join public.professional_profiles pp on pp.id = c.professional_id
  join public.profiles customer_profile on customer_profile.id = c.customer_id
  join public.profiles professional_profile on professional_profile.id = pp.user_id
  left join lateral (
    select m.body, m.created_at
    from public.messages m
    where m.conversation_id = c.id
      and m.deleted_at is null
    order by m.created_at desc
    limit 1
  ) last_message on true
  where c.id = p_conversation_id
    and public.is_conversation_participant(c.id);
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
  professional_category_names text[]
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
    ) as professional_category_names
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

drop function if exists public.list_professional_applications();

create function public.list_professional_applications()
returns table (
  id uuid,
  request_id uuid,
  professional_id uuid,
  message text,
  proposal_type text,
  visit_price numeric,
  estimated_price numeric,
  estimated_duration_text text,
  availability_text text,
  status text,
  conversation_id uuid,
  unread_count integer,
  last_message_body text,
  last_message_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  withdrawn_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id,
    a.request_id,
    a.professional_id,
    a.message,
    a.proposal_type,
    a.visit_price,
    a.estimated_price,
    a.estimated_duration_text,
    a.availability_text,
    a.status,
    conv.id as conversation_id,
    coalesce(public.get_conversation_unread_count(conv.id), 0) as unread_count,
    last_message.body as last_message_body,
    last_message.created_at as last_message_at,
    a.created_at,
    a.updated_at,
    a.withdrawn_at
  from public.applications a
  join public.professional_profiles pp on pp.id = a.professional_id
  left join public.conversations conv on conv.application_id = a.id
  left join lateral (
    select m.body, m.created_at
    from public.messages m
    where m.conversation_id = conv.id
      and m.deleted_at is null
    order by m.created_at desc
    limit 1
  ) last_message on true
  where pp.user_id = auth.uid()
  order by a.created_at desc;
$$;

drop function if exists public.get_professional_application(uuid);

create function public.get_professional_application(p_request_id uuid)
returns table (
  id uuid,
  request_id uuid,
  professional_id uuid,
  message text,
  proposal_type text,
  visit_price numeric,
  estimated_price numeric,
  estimated_duration_text text,
  availability_text text,
  status text,
  conversation_id uuid,
  unread_count integer,
  last_message_body text,
  last_message_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  withdrawn_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id,
    a.request_id,
    a.professional_id,
    a.message,
    a.proposal_type,
    a.visit_price,
    a.estimated_price,
    a.estimated_duration_text,
    a.availability_text,
    a.status,
    conv.id as conversation_id,
    coalesce(public.get_conversation_unread_count(conv.id), 0) as unread_count,
    last_message.body as last_message_body,
    last_message.created_at as last_message_at,
    a.created_at,
    a.updated_at,
    a.withdrawn_at
  from public.applications a
  join public.professional_profiles pp on pp.id = a.professional_id
  left join public.conversations conv on conv.application_id = a.id
  left join lateral (
    select m.body, m.created_at
    from public.messages m
    where m.conversation_id = conv.id
      and m.deleted_at is null
    order by m.created_at desc
    limit 1
  ) last_message on true
  where a.request_id = p_request_id
    and pp.user_id = auth.uid()
  limit 1;
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
  last_message_at timestamptz
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
    last_message.created_at as last_message_at
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
  left join public.categories c on c.id = sr.category_id
  where pp.user_id = auth.uid()
    and a.status = 'selected'
    and sr.status = 'professional_selected'
  order by sr.selected_at desc nulls last;
$$;

grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.get_conversation(uuid) to authenticated;
grant execute on function public.list_customer_request_applications(uuid) to authenticated;
grant execute on function public.list_professional_applications() to authenticated;
grant execute on function public.get_professional_application(uuid) to authenticated;
grant execute on function public.list_professional_selected_jobs() to authenticated;
