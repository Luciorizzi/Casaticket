alter table public.service_requests
  add column if not exists formatted_address text,
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists postal_code text,
  add column if not exists address_provider text,
  add column if not exists provider_place_id text;

comment on column public.service_requests.provider_place_id is
  'Null for legacy free-text addresses. New mobile requests require an explicit autocomplete selection.';

alter table public.applications drop constraint if exists applications_message_length_check;
alter table public.applications add constraint applications_message_length_check
  check (char_length(trim(message)) between 20 and 2000);
alter table public.applications drop constraint if exists applications_availability_length_check;
alter table public.applications alter column availability_text set default '';
alter table public.applications add constraint applications_visit_price_by_type_check
  check (proposal_type <> 'diagnostic_visit' or visit_price > 0);

create or replace function public.create_professional_application_with_message(
  p_request_id uuid,
  p_proposal_type text,
  p_message text,
  p_visit_price numeric default null,
  p_estimated_price numeric default null,
  p_estimated_duration_text text default null
)
returns table (application_id uuid, conversation_id uuid, message_id uuid)
language plpgsql security definer set search_path = public
as $$
declare
  professional_row public.professional_profiles%rowtype;
  application_row public.applications%rowtype;
  existing_message_id uuid;
  created_conversation_id uuid;
begin
  select * into professional_row from public.professional_profiles where user_id = auth.uid();
  if professional_row.id is null then raise exception 'Professional profile required.'; end if;
  if char_length(trim(coalesce(p_message, ''))) not between 20 and 2000 then raise exception 'Presentation message must contain between 20 and 2000 characters.'; end if;
  if p_proposal_type not in ('diagnostic_visit', 'preliminary_quote', 'ask_for_details', 'direct_service') then raise exception 'Invalid proposal type.'; end if;
  if p_proposal_type = 'diagnostic_visit' and coalesce(p_visit_price, 0) <= 0 then raise exception 'Diagnostic visit price must be greater than zero.'; end if;

  select * into application_row from public.applications
  where request_id = p_request_id and professional_id = professional_row.id;
  if application_row.id is not null then
    select c.id into created_conversation_id from public.conversations c where c.application_id = application_row.id;
    select m.id into existing_message_id from public.messages m where m.conversation_id = created_conversation_id order by m.created_at, m.id limit 1;
    if application_row.message = trim(p_message) and existing_message_id is not null then
      return query select application_row.id, created_conversation_id, existing_message_id; return;
    end if;
    raise exception 'An application already exists for this request.';
  end if;

  if not public.is_professional_compatible_with_request(professional_row.id, p_request_id) then raise exception 'Request is not available or compatible.'; end if;
  insert into public.applications(request_id, professional_id, message, proposal_type, visit_price, estimated_price, estimated_duration_text, availability_text)
  values (p_request_id, professional_row.id, trim(p_message), p_proposal_type,
    case when p_proposal_type = 'diagnostic_visit' then p_visit_price else null end,
    p_estimated_price, nullif(trim(p_estimated_duration_text), ''), '') returning * into application_row;
  select c.id into created_conversation_id from public.conversations c where c.application_id = application_row.id;
  insert into public.messages(conversation_id, sender_user_id, body)
  values (created_conversation_id, auth.uid(), trim(p_message)) returning id into existing_message_id;
  return query select application_row.id, created_conversation_id, existing_message_id;
end; $$;

grant execute on function public.create_professional_application_with_message(uuid, text, text, numeric, numeric, text) to authenticated;

create or replace function public.notify_message_created() returns trigger
language plpgsql security definer set search_path = public as $$
declare conversation_row public.conversations%rowtype; recipient_id uuid; is_initial_application_message boolean;
begin
  select * into conversation_row from public.conversations where id = new.conversation_id;
  select exists (
    select 1 from public.applications a join public.professional_profiles pp on pp.id = a.professional_id
    where a.id = conversation_row.application_id and pp.user_id = new.sender_user_id
      and a.message = new.body
      and not exists (select 1 from public.messages prior where prior.conversation_id = new.conversation_id and prior.id <> new.id)
  ) into is_initial_application_message;
  if is_initial_application_message then return new; end if;
  if new.sender_user_id = conversation_row.customer_id then
    select pp.user_id into recipient_id from public.professional_profiles pp where pp.id = conversation_row.professional_id;
  else recipient_id := conversation_row.customer_id; end if;
  if recipient_id is not null and recipient_id <> new.sender_user_id then
    perform public.create_notification(recipient_id, 'message_received', 'Nuevo mensaje', left(new.body, 160), 'conversation', new.conversation_id,
      '/chat/[conversationId]', jsonb_build_object('conversationId', new.conversation_id), 'message:' || new.id || ':received');
  end if;
  return new;
end; $$;
