create or replace function public.prevent_service_request_unsafe_customer_update()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.customer_id is distinct from old.customer_id then
    raise exception 'Service request customer cannot be changed.';
  end if;

  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'Cancelled service requests cannot be reactivated.';
  end if;

  if old.status <> 'published' and new.status = 'cancelled' and old.status is distinct from new.status then
    raise exception 'Only published service requests can be cancelled.';
  end if;

  if old.status = 'published' and new.status not in ('published', 'cancelled') then
    raise exception 'Published service requests can only remain published or be cancelled.';
  end if;

  return new;
end;
$$;

create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  title text not null,
  description text not null,
  request_type text not null,
  urgency text not null,
  address_text text not null,
  city text not null,
  province text not null,
  preferred_date date,
  preferred_time_text text,
  availability_notes text,
  status text not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz,
  constraint service_requests_request_type_check
    check (request_type in ('quote', 'diagnostic_visit', 'specific_task', 'unsure')),
  constraint service_requests_urgency_check
    check (urgency in ('flexible', 'scheduled', 'soon', 'urgent')),
  constraint service_requests_status_check
    check (status in ('draft', 'published', 'cancelled')),
  constraint service_requests_title_length_check
    check (char_length(trim(title)) between 5 and 80),
  constraint service_requests_description_length_check
    check (char_length(trim(description)) between 20 and 1500),
  constraint service_requests_address_length_check
    check (char_length(trim(address_text)) >= 5),
  constraint service_requests_published_at_check
    check (status <> 'published' or published_at is not null)
);

create index service_requests_customer_created_at_idx
on public.service_requests (customer_id, created_at desc);

create index service_requests_customer_status_idx
on public.service_requests (customer_id, status);

create index service_requests_category_id_idx
on public.service_requests (category_id);

create trigger set_service_requests_updated_at
before update on public.service_requests
for each row
execute procedure public.set_updated_at();

create trigger guard_service_request_customer_updates
before update on public.service_requests
for each row
execute procedure public.prevent_service_request_unsafe_customer_update();

alter table public.service_requests enable row level security;

create policy "service_requests_select_own"
on public.service_requests
for select
to authenticated
using (customer_id = auth.uid());

create policy "service_requests_insert_own"
on public.service_requests
for insert
to authenticated
with check (customer_id = auth.uid());

create policy "service_requests_update_own"
on public.service_requests
for update
to authenticated
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

grant select, insert, update on table public.service_requests to authenticated;
grant all privileges on table public.service_requests to service_role;
