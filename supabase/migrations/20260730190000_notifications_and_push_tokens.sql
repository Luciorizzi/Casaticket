create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  entity_type text not null,
  entity_id uuid,
  route text,
  route_params jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  dedupe_key text
);

create unique index notifications_user_dedupe_key_unique
on public.notifications (user_id, dedupe_key)
where dedupe_key is not null;
create index notifications_user_unread_created_idx
on public.notifications (user_id, read_at, created_at desc);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique,
  device_id text,
  platform text not null check (platform in ('ios', 'android')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (expo_push_token ~ '^ExponentPushToken\\[[A-Za-z0-9_-]+\\]$|^ExpoPushToken\\[[A-Za-z0-9_-]+\\]$')
);

create table public.push_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications (id) on delete cascade,
  push_token_id uuid not null references public.push_tokens (id) on delete cascade,
  expo_ticket_id text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'failed')),
  error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (notification_id, push_token_id)
);

create trigger set_push_tokens_updated_at before update on public.push_tokens
for each row execute procedure public.set_updated_at();

alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.push_delivery_attempts enable row level security;

create policy notifications_select_own on public.notifications for select to authenticated
using (user_id = auth.uid());
create policy notifications_update_own on public.notifications for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_tokens_select_own on public.push_tokens for select to authenticated
using (user_id = auth.uid());
create policy push_tokens_insert_own on public.push_tokens for insert to authenticated
with check (user_id = auth.uid());
create policy push_tokens_update_own on public.push_tokens for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_tokens_delete_own on public.push_tokens for delete to authenticated
using (user_id = auth.uid());

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert, update, delete on public.push_tokens to authenticated;
grant all on public.notifications, public.push_tokens to service_role;
grant all on public.push_delivery_attempts to service_role;

create or replace function public.create_notification(
  p_user_id uuid, p_type text, p_title text, p_body text,
  p_entity_type text, p_entity_id uuid, p_route text,
  p_route_params jsonb, p_dedupe_key text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare created_id uuid;
begin
  insert into public.notifications (user_id, type, title, body, entity_type, entity_id, route, route_params, dedupe_key)
  values (p_user_id, p_type, p_title, p_body, p_entity_type, p_entity_id, p_route, coalesce(p_route_params, '{}'::jsonb), p_dedupe_key)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into created_id;
  return created_id;
end;
$$;
revoke all on function public.create_notification(uuid,text,text,text,text,uuid,text,jsonb,text) from public, authenticated;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language sql security invoker set search_path = public
as $$ update public.notifications set read_at = coalesce(read_at, timezone('utc', now())) where id = p_notification_id and user_id = auth.uid(); $$;
create or replace function public.mark_all_notifications_read()
returns void language sql security invoker set search_path = public
as $$ update public.notifications set read_at = timezone('utc', now()) where user_id = auth.uid() and read_at is null; $$;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

create or replace function public.notify_application_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare customer_user_id uuid;
begin
  select sr.customer_id into customer_user_id from public.service_requests sr where sr.id = new.request_id;
  perform public.create_notification(customer_user_id, 'application_received', 'Nueva postulación', 'Un profesional se postuló a tu solicitud.', 'application', new.id,
    '/(customer)/requests/[id]', jsonb_build_object('id', new.request_id), 'application:' || new.id || ':created');
  return new;
end; $$;
create trigger notify_application_created after insert on public.applications for each row execute procedure public.notify_application_created();

create or replace function public.notify_message_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare conversation_row public.conversations%rowtype; recipient_id uuid;
begin
  select * into conversation_row from public.conversations where id = new.conversation_id;
  if new.sender_user_id = conversation_row.customer_id then
    select pp.user_id into recipient_id from public.professional_profiles pp where pp.id = conversation_row.professional_id;
  else recipient_id := conversation_row.customer_id; end if;
  if recipient_id is not null and recipient_id <> new.sender_user_id then
    perform public.create_notification(recipient_id, 'message_received', 'Nuevo mensaje', left(new.body, 160), 'conversation', new.conversation_id,
      '/chat/[conversationId]', jsonb_build_object('conversationId', new.conversation_id), 'message:' || new.id || ':received');
  end if;
  return new;
end; $$;
create trigger notify_message_created after insert on public.messages for each row execute procedure public.notify_message_created();

create or replace function public.notify_job_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare professional_user_id uuid;
begin
  select pp.user_id into professional_user_id from public.professional_profiles pp where pp.id = new.professional_id;
  perform public.create_notification(professional_user_id, 'application_selected', 'Postulación seleccionada', 'El cliente te seleccionó para realizar el trabajo.', 'job', new.id,
    '/(professional)/jobs/[jobId]', jsonb_build_object('jobId', new.id), 'job:' || new.id || ':selected');
  perform public.create_notification(new.customer_id, 'professional_selected', 'Profesional confirmado', 'El profesional seleccionado ya está asociado al trabajo.', 'job', new.id,
    '/(customer)/jobs/[jobId]', jsonb_build_object('jobId', new.id), 'job:' || new.id || ':professional_selected');
  return new;
end; $$;
create trigger notify_job_created after insert on public.jobs for each row execute procedure public.notify_job_created();

create or replace function public.notify_job_status_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare professional_user_id uuid;
begin
  if new.status is not distinct from old.status then return new; end if;
  select pp.user_id into professional_user_id from public.professional_profiles pp where pp.id = new.professional_id;
  case new.status
    when 'visit_proposed' then perform public.create_notification(new.customer_id, 'visit_proposed', 'Visita propuesta', 'El profesional propuso o actualizó una visita.', 'job', new.id, '/(customer)/jobs/[jobId]', jsonb_build_object('jobId', new.id), 'job:' || new.id || ':visit_proposed:' || coalesce(new.scheduled_date::text, 'none') || ':' || coalesce(new.scheduled_time_text, 'none'));
    when 'visit_confirmed' then perform public.create_notification(professional_user_id, 'visit_confirmed', 'Visita confirmada', 'El cliente confirmó la visita.', 'job', new.id, '/(professional)/jobs/[jobId]/visit', jsonb_build_object('jobId', new.id), 'job:' || new.id || ':visit_confirmed');
    when 'coordination_pending' then if old.status = 'visit_proposed' then perform public.create_notification(professional_user_id, 'visit_rejected', 'Visita rechazada', 'El cliente rechazó la visita propuesta.', 'job', new.id, '/(professional)/jobs/[jobId]/visit', jsonb_build_object('jobId', new.id), 'job:' || new.id || ':visit_rejected:' || new.updated_at::text); end if;
    when 'quote_pending' then perform public.create_notification(new.customer_id, 'diagnosis_available', 'Diagnóstico disponible', 'El profesional registró el diagnóstico.', 'job', new.id, '/(customer)/jobs/[jobId]', jsonb_build_object('jobId', new.id), 'job:' || new.id || ':diagnosis_available');
    when 'review_pending' then perform public.create_notification(new.customer_id, 'job_finished', 'Trabajo finalizado', 'El profesional marcó el trabajo como finalizado.', 'job', new.id, '/(customer)/jobs/[jobId]', jsonb_build_object('jobId', new.id), 'job:' || new.id || ':review_pending');
    when 'completed' then perform public.create_notification(professional_user_id, 'job_confirmed', 'Trabajo confirmado', 'El cliente confirmó la finalización del trabajo.', 'job', new.id, '/(professional)/jobs/[jobId]/completion', jsonb_build_object('jobId', new.id), 'job:' || new.id || ':completed');
    when 'disputed' then perform public.create_notification(professional_user_id, 'dispute_opened', 'Disputa abierta', 'El cliente reportó un problema con la finalización.', 'job', new.id, '/(professional)/jobs/[jobId]/completion', jsonb_build_object('jobId', new.id), 'job:' || new.id || ':disputed');
    else null;
  end case;
  return new;
end; $$;
create trigger notify_job_status_changed after update on public.jobs for each row execute procedure public.notify_job_status_changed();

create or replace function public.notify_quote_status_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare job_row public.jobs%rowtype; professional_user_id uuid;
begin
  if new.status is not distinct from old.status then return new; end if;
  select * into job_row from public.jobs where id = new.job_id;
  select pp.user_id into professional_user_id from public.professional_profiles pp where pp.id = job_row.professional_id;
  if new.status = 'sent' then
    perform public.create_notification(job_row.customer_id, 'quote_received', 'Presupuesto recibido', 'El profesional envió un presupuesto.', 'quote', new.id, '/(customer)/jobs/[jobId]', jsonb_build_object('jobId', new.job_id), 'quote:' || new.id || ':submitted');
  elsif new.status = 'accepted' then
    perform public.create_notification(professional_user_id, 'quote_accepted', 'Presupuesto aceptado', 'El cliente aceptó tu presupuesto.', 'quote', new.id, '/(professional)/jobs/[jobId]/quote', jsonb_build_object('jobId', new.job_id, 'quoteId', new.id), 'quote:' || new.id || ':accepted');
  elsif new.status = 'rejected' then
    perform public.create_notification(professional_user_id, 'quote_rejected', 'Presupuesto rechazado', 'El cliente rechazó tu presupuesto.', 'quote', new.id, '/(professional)/jobs/[jobId]/quote', jsonb_build_object('jobId', new.job_id, 'quoteId', new.id), 'quote:' || new.id || ':rejected');
  end if;
  return new;
end; $$;
create trigger notify_quote_status_changed after update on public.job_quotes for each row execute procedure public.notify_quote_status_changed();

create or replace function public.notify_payment_status_changed() returns trigger
language plpgsql security definer set search_path = public as $$
declare professional_user_id uuid;
begin
  if new.status is not distinct from old.status then return new; end if;
  select pp.user_id into professional_user_id from public.professional_profiles pp where pp.id = new.professional_id;
  if new.status = 'secured' then perform public.create_notification(professional_user_id, 'payment_secured', 'Pago asegurado', 'El pago del trabajo quedó protegido.', 'payment', new.id, '/(professional)/jobs/[jobId]/payment', jsonb_build_object('jobId', new.job_id, 'paymentId', new.id), 'payment:' || new.id || ':secured');
  elsif new.status = 'released' then
    perform public.create_notification(professional_user_id, 'payment_released', 'Pago liberado', 'El pago fue liberado.', 'payment', new.id, '/(professional)/jobs/[jobId]/payment', jsonb_build_object('jobId', new.job_id, 'paymentId', new.id), 'payment:' || new.id || ':released');
    perform public.create_notification(new.customer_id, 'payment_released', 'Pago liberado', 'El pago protegido fue liberado.', 'payment', new.id, '/(customer)/jobs/[jobId]', jsonb_build_object('jobId', new.job_id), 'payment:' || new.id || ':released');
  elsif new.status = 'refunded' then perform public.create_notification(new.customer_id, 'payment_refunded', 'Pago devuelto', 'El pago fue devuelto.', 'payment', new.id, '/(customer)/jobs/[jobId]', jsonb_build_object('jobId', new.job_id), 'payment:' || new.id || ':refunded');
  end if;
  return new;
end; $$;
create trigger notify_payment_status_changed after update on public.payments for each row execute procedure public.notify_payment_status_changed();

create or replace function public.notify_request_cancelled() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' and old.status is distinct from new.status then
    perform public.create_notification(new.customer_id, 'request_cancelled', 'Solicitud cancelada', 'La solicitud fue cancelada.', 'service_request', new.id, '/(customer)/requests/[id]', jsonb_build_object('id', new.id), 'request:' || new.id || ':cancelled');
  end if;
  return new;
end; $$;
create trigger notify_request_cancelled after update on public.service_requests for each row execute procedure public.notify_request_cancelled();

create or replace function public.register_push_token(p_expo_push_token text, p_device_id text, p_platform text)
returns public.push_tokens language plpgsql security invoker set search_path = public as $$
declare token public.push_tokens;
begin
  insert into public.push_tokens (user_id, expo_push_token, device_id, platform)
  values (auth.uid(), p_expo_push_token, p_device_id, p_platform)
  on conflict (expo_push_token) do update set user_id = auth.uid(), device_id = excluded.device_id, platform = excluded.platform, enabled = true, last_seen_at = timezone('utc', now())
  returning * into token;
  return token;
end; $$;
grant execute on function public.register_push_token(text,text,text) to authenticated;
