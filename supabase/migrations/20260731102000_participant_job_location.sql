create or replace function public.get_job_location(p_job_id uuid)
returns table (job_id uuid, request_id uuid, address_text text, city text, province text)
language sql
security definer
set search_path = public
stable
as $$
  select j.id, sr.id, sr.address_text, sr.city, sr.province
  from public.jobs j
  join public.service_requests sr on sr.id = j.request_id
  join public.professional_profiles pp on pp.id = j.professional_id
  where j.id = p_job_id
    and (j.customer_id = auth.uid() or pp.user_id = auth.uid())
  limit 1;
$$;

revoke all on function public.get_job_location(uuid) from public;
grant execute on function public.get_job_location(uuid) to authenticated;
