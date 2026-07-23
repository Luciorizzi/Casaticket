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
      join public.payments pay on pay.job_id = j.id
      where j.professional_id = pp.id
        and j.status = 'completed'
        and pay.status = 'released'
    ) as completed_jobs_count,
    (
      select round(avg(r.rating)::numeric, 2)
      from public.reviews r
      join public.jobs j on j.id = r.job_id
      join public.payments pay on pay.job_id = j.id
      where r.reviewed_user_id = pp.user_id
        and j.status = 'completed'
        and pay.status = 'released'
    ) as average_rating,
    (
      select count(*)::integer
      from public.reviews r
      join public.jobs j on j.id = r.job_id
      join public.payments pay on pay.job_id = j.id
      where r.reviewed_user_id = pp.user_id
        and j.status = 'completed'
        and pay.status = 'released'
    ) as reviews_count
  from public.professional_profiles pp
  where pp.id = p_professional_id
    and exists (select 1 from public.profiles p where p.id = auth.uid());
$$;
