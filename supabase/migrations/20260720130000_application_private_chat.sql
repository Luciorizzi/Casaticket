create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications (id) on delete cascade,
  request_id uuid not null references public.service_requests (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  professional_id uuid not null references public.professional_profiles (id) on delete cascade,
  status text not null default 'active',
  customer_last_read_at timestamptz,
  professional_last_read_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint conversations_status_check
    check (status in ('active', 'read_only', 'closed'))
);

comment on column public.conversations.customer_last_read_at is
  'Minimal unread tracking for the customer participant.';

comment on column public.conversations.professional_last_read_at is
  'Minimal unread tracking for the professional participant.';

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint messages_body_length_check
    check (char_length(trim(body)) between 1 and 2000)
);

create index conversations_request_id_idx
on public.conversations (request_id);

create index conversations_customer_id_idx
on public.conversations (customer_id);

create index conversations_professional_id_idx
on public.conversations (professional_id);

create index messages_conversation_created_at_idx
on public.messages (conversation_id, created_at);

create index messages_sender_user_id_idx
on public.messages (sender_user_id);

create trigger set_conversations_updated_at
before update on public.conversations
for each row
execute procedure public.set_updated_at();

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.conversations c
    join public.professional_profiles pp on pp.id = c.professional_id
    where c.id = p_conversation_id
      and (
        c.customer_id = auth.uid()
        or pp.user_id = auth.uid()
      )
  );
$$;

create or replace function public.can_send_conversation_message(p_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.conversations c
    join public.applications a on a.id = c.application_id
    join public.service_requests sr on sr.id = c.request_id
    join public.professional_profiles pp on pp.id = c.professional_id
    where c.id = p_conversation_id
      and c.status = 'active'
      and a.status in ('submitted', 'viewed', 'selected')
      and sr.status <> 'cancelled'
      and (
        c.customer_id = auth.uid()
        or pp.user_id = auth.uid()
      )
  );
$$;

create or replace function public.get_conversation_unread_count(p_conversation_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.professional_profiles pp on pp.id = c.professional_id
  where m.conversation_id = p_conversation_id
    and m.sender_user_id <> auth.uid()
    and (
      (c.customer_id = auth.uid() and m.created_at > coalesce(c.customer_last_read_at, '-infinity'::timestamptz))
      or (pp.user_id = auth.uid() and m.created_at > coalesce(c.professional_last_read_at, '-infinity'::timestamptz))
    );
$$;

create or replace function public.create_application_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  request_customer_id uuid;
begin
  select sr.customer_id
  into request_customer_id
  from public.service_requests sr
  where sr.id = new.request_id;

  insert into public.conversations (
    application_id,
    request_id,
    customer_id,
    professional_id
  )
  values (
    new.id,
    new.request_id,
    request_customer_id,
    new.professional_id
  )
  on conflict (application_id) do nothing;

  return new;
end;
$$;

create trigger create_application_conversation
after insert on public.applications
for each row
execute procedure public.create_application_conversation();

create or replace function public.sync_conversation_status_from_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('withdrawn', 'rejected') and old.status is distinct from new.status then
    update public.conversations
    set status = 'read_only'
    where application_id = new.id
      and status = 'active';
  end if;

  return new;
end;
$$;

create trigger sync_conversation_status_from_application
after update of status on public.applications
for each row
execute procedure public.sync_conversation_status_from_application();

create or replace function public.sync_conversations_from_service_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from new.status then
    update public.conversations
    set status = 'read_only'
    where request_id = new.id
      and status = 'active';
  end if;

  return new;
end;
$$;

create trigger sync_conversations_from_service_request
after update of status on public.service_requests
for each row
execute procedure public.sync_conversations_from_service_request();

create or replace function public.prevent_unsafe_message_write()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    new.body = trim(new.body);
    return new;
  end if;

  if new.sender_user_id <> auth.uid() then
    raise exception 'Message sender must match authenticated user.';
  end if;

  if not public.can_send_conversation_message(new.conversation_id) then
    raise exception 'Conversation is not writable.';
  end if;

  new.body = trim(new.body);

  if char_length(new.body) < 1 or char_length(new.body) > 2000 then
    raise exception 'Message body length is not allowed.';
  end if;

  return new;
end;
$$;

create trigger guard_message_writes
before insert on public.messages
for each row
execute procedure public.prevent_unsafe_message_write();

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "conversations_select_participants"
on public.conversations
for select
to authenticated
using (public.is_conversation_participant(id));

create policy "messages_select_conversation_participants"
on public.messages
for select
to authenticated
using (public.is_conversation_participant(conversation_id));

create policy "messages_insert_conversation_participants"
on public.messages
for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  and public.can_send_conversation_message(conversation_id)
);

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
  on conflict (application_id) do nothing;

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

create or replace function public.list_conversation_messages(p_conversation_id uuid)
returns table (
  message_id uuid,
  conversation_id uuid,
  sender_user_id uuid,
  body text,
  created_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    m.id,
    m.conversation_id,
    m.sender_user_id,
    m.body,
    m.created_at,
    m.edited_at,
    m.deleted_at
  from public.messages m
  where m.conversation_id = p_conversation_id
    and public.is_conversation_participant(p_conversation_id)
  order by m.created_at asc;
$$;

create or replace function public.send_conversation_message(
  p_conversation_id uuid,
  p_body text
)
returns table (
  message_id uuid,
  conversation_id uuid,
  sender_user_id uuid,
  body text,
  created_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_message public.messages%rowtype;
  clean_body text := trim(coalesce(p_body, ''));
begin
  if not public.can_send_conversation_message(p_conversation_id) then
    raise exception 'Conversation is not writable.';
  end if;

  if char_length(clean_body) < 1 or char_length(clean_body) > 2000 then
    raise exception 'Message body length is not allowed.';
  end if;

  insert into public.messages (
    conversation_id,
    sender_user_id,
    body
  )
  values (
    p_conversation_id,
    auth.uid(),
    clean_body
  )
  returning * into created_message;

  return query
  select
    created_message.id,
    created_message.conversation_id,
    created_message.sender_user_id,
    created_message.body,
    created_message.created_at,
    created_message.edited_at,
    created_message.deleted_at;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns table (
  conversation_id uuid,
  unread_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_time timestamptz := timezone('utc', now());
begin
  if not public.is_conversation_participant(p_conversation_id) then
    raise exception 'Conversation not found for this user.';
  end if;

  update public.conversations c
  set customer_last_read_at = current_time
  where c.id = p_conversation_id
    and c.customer_id = auth.uid();

  update public.conversations c
  set professional_last_read_at = current_time
  from public.professional_profiles pp
  where c.id = p_conversation_id
    and pp.id = c.professional_id
    and pp.user_id = auth.uid();

  return query
  select p_conversation_id, public.get_conversation_unread_count(p_conversation_id);
end;
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
  left join public.professional_categories pc on pc.professional_id = pp.id
  left join public.categories c on c.id = pc.category_id
  where sr.id = p_request_id
    and sr.customer_id = auth.uid()
  group by a.id, conv.id, p.id, pp.id
  order by a.created_at asc;
$$;

create or replace function public.list_professional_applications()
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
    a.created_at,
    a.updated_at,
    a.withdrawn_at
  from public.applications a
  join public.professional_profiles pp on pp.id = a.professional_id
  left join public.conversations conv on conv.application_id = a.id
  where pp.user_id = auth.uid()
  order by a.created_at desc;
$$;

create or replace function public.get_professional_application(p_request_id uuid)
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
    a.created_at,
    a.updated_at,
    a.withdrawn_at
  from public.applications a
  join public.professional_profiles pp on pp.id = a.professional_id
  left join public.conversations conv on conv.application_id = a.id
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
  unread_count integer
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
    coalesce(public.get_conversation_unread_count(conv.id), 0) as unread_count
  from public.applications a
  join public.professional_profiles pp on pp.id = a.professional_id
  join public.service_requests sr on sr.id = a.request_id
  left join public.conversations conv on conv.application_id = a.id
  left join public.categories c on c.id = sr.category_id
  where pp.user_id = auth.uid()
    and a.status = 'selected'
    and sr.status = 'professional_selected'
  order by sr.selected_at desc nulls last;
$$;

grant execute on function public.is_conversation_participant(uuid) to authenticated;
grant execute on function public.can_send_conversation_message(uuid) to authenticated;
grant execute on function public.get_conversation_unread_count(uuid) to authenticated;
grant execute on function public.ensure_application_conversation(uuid) to authenticated;
grant execute on function public.list_conversation_messages(uuid) to authenticated;
grant execute on function public.send_conversation_message(uuid, text) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.list_professional_applications() to authenticated;
grant execute on function public.get_professional_application(uuid) to authenticated;

grant select on table public.conversations to authenticated;
grant select, insert on table public.messages to authenticated;
grant all privileges on table public.conversations to service_role;
grant all privileges on table public.messages to service_role;
