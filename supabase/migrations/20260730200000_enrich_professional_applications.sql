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
  withdrawn_at timestamptz,
  request_title text,
  category_name text,
  city text,
  request_status text,
  selected_professional_id uuid,
  job_id uuid
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
    conv.id,
    coalesce(public.get_conversation_unread_count(conv.id), 0),
    last_message.body,
    last_message.created_at,
    a.created_at,
    a.updated_at,
    a.withdrawn_at,
    sr.title,
    c.name,
    sr.city,
    sr.status,
    sr.selected_professional_id,
    j.id
  from public.applications a
  join public.professional_profiles pp on pp.id = a.professional_id
  join public.service_requests sr on sr.id = a.request_id
  left join public.categories c on c.id = sr.category_id
  left join public.conversations conv on conv.application_id = a.id
  left join public.jobs j on j.selected_application_id = a.id
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

revoke all on function public.list_professional_applications() from public;
grant execute on function public.list_professional_applications() to authenticated;

create or replace function public.get_professional_opportunity(
  p_request_id uuid,
  p_professional_id uuid
)
returns table (
  request_id uuid,
  title text,
  description text,
  category_id uuid,
  category_name text,
  request_type text,
  urgency text,
  city text,
  province text,
  preferred_date date,
  preferred_time_text text,
  availability_notes text,
  published_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    sr.id,
    sr.title,
    sr.description,
    sr.category_id,
    c.name,
    sr.request_type,
    sr.urgency,
    sr.city,
    sr.province,
    sr.preferred_date,
    sr.preferred_time_text,
    sr.availability_notes,
    sr.published_at
  from public.service_requests sr
  left join public.categories c on c.id = sr.category_id
  where sr.id = p_request_id
    and (
      public.is_professional_compatible_with_request(p_professional_id, sr.id)
      or exists (
        select 1
        from public.applications a
        join public.professional_profiles pp on pp.id = a.professional_id
        where a.request_id = sr.id
          and a.professional_id = p_professional_id
          and pp.user_id = auth.uid()
      )
    )
  limit 1;
$$;
