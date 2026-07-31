create or replace function public.notify_job_status_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare professional_user_id uuid;
begin
  if new.status is not distinct from old.status then return new; end if;
  select pp.user_id into professional_user_id from public.professional_profiles pp where pp.id = new.professional_id;
  case new.status
    when 'visit_proposed' then perform public.create_notification(
      new.customer_id, 'visit_proposed', 'Nueva visita propuesta',
      'El profesional propuso una visita para el ' || coalesce(to_char(new.scheduled_date, 'DD/MM/YYYY'), 'dÃ­a a confirmar') || ' a las ' || coalesce(left(new.scheduled_time_text, 5), 'hora a confirmar') || '.',
      'job', new.id, '/(customer)/jobs/[jobId]/visit', jsonb_build_object('jobId', new.id, 'requestId', new.request_id),
      'job:' || new.id || ':visit:' || coalesce(new.scheduled_date::text, 'none') || ':' || coalesce(new.scheduled_time_text, 'none'));
    when 'visit_confirmed' then perform public.create_notification(professional_user_id, 'visit_confirmed', 'Visita confirmada', 'El cliente confirmÃ³ la visita.', 'job', new.id, '/(professional)/jobs/[jobId]/visit', jsonb_build_object('jobId', new.id), 'job:' || new.id || ':visit_confirmed');
    when 'coordination_pending' then if old.status = 'visit_proposed' then perform public.create_notification(professional_user_id, 'visit_rejected', 'Visita rechazada', 'El cliente rechazÃ³ la visita propuesta.', 'job', new.id, '/(professional)/jobs/[jobId]/visit', jsonb_build_object('jobId', new.id), 'job:' || new.id || ':visit_rejected:' || new.updated_at::text); end if;
    when 'quote_pending' then perform public.create_notification(new.customer_id, 'diagnosis_available', 'DiagnÃ³stico disponible', 'El profesional registrÃ³ el diagnÃ³stico.', 'job', new.id, '/(customer)/jobs/[jobId]', jsonb_build_object('jobId', new.id), 'job:' || new.id || ':diagnosis_available');
    when 'review_pending' then perform public.create_notification(new.customer_id, 'job_finished', 'Trabajo finalizado', 'El profesional marcÃ³ el trabajo como finalizado.', 'job', new.id, '/(customer)/jobs/[jobId]', jsonb_build_object('jobId', new.id), 'job:' || new.id || ':review_pending');
    when 'completed' then perform public.create_notification(professional_user_id, 'job_confirmed', 'Trabajo confirmado', 'El cliente confirmÃ³ la finalizaciÃ³n del trabajo.', 'job', new.id, '/(professional)/jobs/[jobId]/completion', jsonb_build_object('jobId', new.id), 'job:' || new.id || ':completed');
    when 'disputed' then perform public.create_notification(professional_user_id, 'dispute_opened', 'Disputa abierta', 'El cliente reportÃ³ un problema con la finalizaciÃ³n.', 'job', new.id, '/(professional)/jobs/[jobId]/completion', jsonb_build_object('jobId', new.id), 'job:' || new.id || ':disputed');
    else null;
  end case;
  return new;
end; $$;
