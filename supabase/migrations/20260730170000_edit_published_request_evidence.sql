create or replace function public.can_edit_request_evidence(p_service_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.service_requests sr
    where sr.id = p_service_request_id
      and sr.customer_id = auth.uid()
      and sr.status in ('published', 'receiving_applications', 'professional_selected')
      and not exists (
        select 1
        from public.jobs j
        where j.request_id = sr.id
          and j.status in ('review_pending', 'completion_pending', 'completed', 'disputed', 'cancelled')
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
    allowed := public.can_edit_request_evidence(p_service_request_id);
    object_path := 'requests/' || p_service_request_id || '/' || attachment_id || '.' || clean_extension;
  elsif p_attachment_type in ('diagnosis_evidence', 'completion_evidence') and p_job_id is not null and p_service_request_id is null then
    select exists (
      select 1 from public.jobs j
      join public.professional_profiles pp on pp.id = j.professional_id
      where j.id = p_job_id and pp.user_id = auth.uid()
        and ((p_attachment_type = 'diagnosis_evidence' and j.status in ('visit_confirmed', 'diagnosis_pending'))
          or (p_attachment_type = 'completion_evidence' and j.status = 'in_progress'))
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
declare
  target public.attachments%rowtype;
  deleted_path text;
begin
  select * into target from public.attachments a where a.id = p_attachment_id and a.owner_id = auth.uid();
  if target.id is null then raise exception 'Attachment not found or not owned by user.'; end if;
  if target.attachment_type = 'request_evidence' and not public.can_edit_request_evidence(target.service_request_id) then
    raise exception 'Request evidence can no longer be edited.';
  end if;
  delete from public.attachments a where a.id = target.id returning a.storage_path into deleted_path;
  return deleted_path;
end;
$$;

drop policy if exists service_attachments_delete on storage.objects;
create policy service_attachments_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'service-attachments'
  and owner_id = auth.uid()::text
  and exists (
    select 1 from public.attachments a
    where a.storage_path = name
      and a.owner_id = auth.uid()
      and (a.attachment_type <> 'request_evidence' or public.can_edit_request_evidence(a.service_request_id))
  )
);

grant execute on function public.can_edit_request_evidence(uuid) to authenticated;
