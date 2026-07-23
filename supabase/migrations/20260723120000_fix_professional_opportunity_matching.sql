drop function if exists public.list_professional_opportunities();
drop function if exists public.get_professional_opportunity(uuid);

create or replace function public.list_professional_opportunities(p_professional_id uuid)
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
    sr.id as request_id,
    sr.title,
    sr.description,
    sr.category_id,
    c.name as category_name,
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
  where public.is_professional_compatible_with_request(p_professional_id, sr.id)
    and not exists (
      select 1
      from public.applications a
      where a.request_id = sr.id
        and a.professional_id = p_professional_id
        and a.status in ('submitted', 'viewed', 'selected')
    )
  order by sr.published_at desc nulls last, sr.created_at desc;
$$;

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
    sr.id as request_id,
    sr.title,
    sr.description,
    sr.category_id,
    c.name as category_name,
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
    and public.is_professional_compatible_with_request(p_professional_id, sr.id)
  limit 1;
$$;

grant execute on function public.list_professional_opportunities(uuid) to authenticated;
grant execute on function public.get_professional_opportunity(uuid, uuid) to authenticated;
