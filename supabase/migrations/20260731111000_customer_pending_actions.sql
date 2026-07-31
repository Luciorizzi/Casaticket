create or replace function public.list_customer_pending_actions()
returns table (
  request_id uuid,
  action_type text,
  action_label text,
  cta_label text,
  action_priority integer,
  occurred_at timestamptz,
  application_id uuid,
  job_id uuid
)
language sql security definer set search_path = public stable
as $$
  select sr.id, selected.action_type, selected.action_label, selected.cta_label,
    selected.action_priority, selected.occurred_at, selected.application_id, selected.job_id
  from public.service_requests sr
  cross join lateral (
    select candidate.* from (
      select 'dispute'::text, 'Hay una disputa que requiere tu atención'::text, 'Revisar disputa'::text,
        500, coalesce(j.disputed_at, j.updated_at), null::uuid, j.id
      from public.jobs j where j.request_id = sr.id and j.status = 'disputed'
      union all
      select 'completion', 'Revisá el trabajo finalizado', 'Revisar finalización',
        400, coalesce(j.professional_completed_at, j.updated_at), null::uuid, j.id
      from public.jobs j where j.request_id = sr.id and j.status in ('review_pending', 'completion_pending')
      union all
      select 'quote', 'Tenés un presupuesto para revisar', 'Ver presupuesto',
        350, j.updated_at, null::uuid, j.id
      from public.jobs j where j.request_id = sr.id and j.status = 'quote_sent'
      union all
      select 'visit', 'Confirmá la visita propuesta', 'Revisar visita',
        300, j.updated_at, null::uuid, j.id
      from public.jobs j where j.request_id = sr.id and j.status = 'visit_proposed'
      union all
      select 'application', 'Nueva postulación para revisar', 'Ver profesionales',
        250, a.created_at, a.id, null::uuid
      from public.applications a where a.request_id = sr.id and a.status = 'submitted'
      union all
      select 'message', 'Tenés mensajes sin leer', 'Abrir solicitud',
        100, coalesce(c.updated_at, c.created_at), c.application_id, null::uuid
      from public.conversations c
      where c.request_id = sr.id and public.get_conversation_unread_count(c.id) > 0
    ) candidate(action_type, action_label, cta_label, action_priority, occurred_at, application_id, job_id)
    order by candidate.action_priority desc, candidate.occurred_at desc
    limit 1
  ) selected
  where sr.customer_id = auth.uid() and sr.deleted_at is null and sr.status <> 'cancelled';
$$;

grant execute on function public.list_customer_pending_actions() to authenticated;
