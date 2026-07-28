create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  service_request_id uuid references public.service_requests (id) on delete cascade,
  job_id uuid references public.jobs (id) on delete cascade,
  attachment_type text not null,
  storage_path text not null unique,
  mime_type text not null,
  file_size_bytes bigint,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint attachments_one_parent_check check (num_nonnulls(service_request_id, job_id) = 1),
  constraint attachments_type_check check (
    (attachment_type = 'request_evidence' and service_request_id is not null and job_id is null)
    or (attachment_type in ('diagnosis_evidence', 'completion_evidence') and job_id is not null and service_request_id is null)
  ),
  constraint attachments_mime_check check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  constraint attachments_size_check check (file_size_bytes is null or file_size_bytes between 1 and 10485760),
  constraint attachments_sort_order_check check (sort_order between 0 and 4)
);

create index attachments_service_request_idx on public.attachments (service_request_id, attachment_type, sort_order);
create index attachments_job_idx on public.attachments (job_id, attachment_type, sort_order);

create or replace function public.can_access_attachment(p_attachment_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.attachments a
    left join public.service_requests sr on sr.id = a.service_request_id
    where a.id = p_attachment_id
      and (
        a.owner_id = auth.uid()
        or (a.job_id is not null and public.is_job_participant(a.job_id))
        or (
          a.service_request_id is not null
          and sr.customer_id = auth.uid()
        )
        or (
          a.service_request_id is not null
          and sr.status = 'published'
          and not exists (select 1 from public.jobs j where j.request_id = sr.id)
          and exists (
            select 1
            from public.professional_profiles pp
            where pp.user_id = auth.uid()
              and public.is_professional_compatible_with_request(pp.id, sr.id)
          )
        )
        or (
          a.service_request_id is not null
          and exists (
            select 1 from public.jobs j
            where j.request_id = sr.id
              and public.is_job_participant(j.id)
          )
        )
      )
  );
$$;

create or replace function public.register_attachment(
  p_service_request_id uuid,
  p_job_id uuid,
  p_attachment_type text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_sort_order integer,
  p_file_extension text
)
returns setof public.attachments
language plpgsql
security definer
set search_path = public
as $$
declare
  attachment_id uuid := gen_random_uuid();
  clean_extension text := lower(trim(coalesce(p_file_extension, '')));
  object_path text;
  allowed boolean := false;
  created_attachment public.attachments%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if clean_extension not in ('jpg', 'jpeg', 'png', 'webp') then raise exception 'Invalid file extension.'; end if;
  if p_mime_type not in ('image/jpeg', 'image/png', 'image/webp') then raise exception 'Invalid image type.'; end if;
  if p_file_size_bytes is null or p_file_size_bytes < 1 or p_file_size_bytes > 10485760 then raise exception 'Invalid file size.'; end if;
  if p_sort_order not between 0 and 4 then raise exception 'Invalid sort order.'; end if;

  if p_attachment_type = 'request_evidence' and p_service_request_id is not null and p_job_id is null then
    select exists (
      select 1 from public.service_requests sr
      where sr.id = p_service_request_id and sr.customer_id = auth.uid()
    ) into allowed;
    object_path := 'requests/' || p_service_request_id || '/' || attachment_id || '.' || clean_extension;
  elsif p_attachment_type in ('diagnosis_evidence', 'completion_evidence') and p_job_id is not null and p_service_request_id is null then
    select exists (
      select 1 from public.jobs j
      join public.professional_profiles pp on pp.id = j.professional_id
      where j.id = p_job_id
        and pp.user_id = auth.uid()
        and (
          (p_attachment_type = 'diagnosis_evidence' and j.status in ('visit_confirmed', 'diagnosis_pending'))
          or (p_attachment_type = 'completion_evidence' and j.status = 'in_progress')
        )
    ) into allowed;
    object_path := 'jobs/' || p_job_id || '/' || case when p_attachment_type = 'diagnosis_evidence' then 'diagnosis' else 'completion' end || '/' || attachment_id || '.' || clean_extension;
  end if;

  if not allowed then raise exception 'Attachment parent or permissions are invalid.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_service_request_id::text, p_job_id::text) || ':' || p_attachment_type, 0));
  if (select count(*) from public.attachments a where a.attachment_type = p_attachment_type and a.service_request_id is not distinct from p_service_request_id and a.job_id is not distinct from p_job_id) >= 5 then
    raise exception 'Attachment limit reached.';
  end if;

  insert into public.attachments (id, owner_id, service_request_id, job_id, attachment_type, storage_path, mime_type, file_size_bytes, sort_order)
  values (attachment_id, auth.uid(), p_service_request_id, p_job_id, p_attachment_type, object_path, p_mime_type, p_file_size_bytes, p_sort_order)
  returning * into created_attachment;
  return next created_attachment;
end;
$$;

create or replace function public.delete_own_attachment(p_attachment_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare deleted_path text;
begin
  delete from public.attachments a
  where a.id = p_attachment_id and a.owner_id = auth.uid()
  returning a.storage_path into deleted_path;
  if deleted_path is null then raise exception 'Attachment not found or not owned by user.'; end if;
  return deleted_path;
end;
$$;

alter table public.attachments enable row level security;
create policy attachments_select_authorized on public.attachments for select to authenticated using (public.can_access_attachment(id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-attachments', 'service-attachments', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy service_attachments_select on storage.objects for select to authenticated
using (bucket_id = 'service-attachments' and exists (select 1 from public.attachments a where a.storage_path = name and public.can_access_attachment(a.id)));
create policy service_attachments_insert on storage.objects for insert to authenticated
with check (bucket_id = 'service-attachments' and owner_id = auth.uid()::text and exists (select 1 from public.attachments a where a.storage_path = name and a.owner_id = auth.uid()));
create policy service_attachments_delete on storage.objects for delete to authenticated
using (bucket_id = 'service-attachments' and owner_id = auth.uid()::text and exists (select 1 from public.attachments a where a.storage_path = name and a.owner_id = auth.uid()));

grant select on public.attachments to authenticated;
grant all on public.attachments to service_role;
grant execute on function public.can_access_attachment(uuid) to authenticated;
grant execute on function public.register_attachment(uuid, uuid, text, text, bigint, integer, text) to authenticated;
grant execute on function public.delete_own_attachment(uuid) to authenticated;
