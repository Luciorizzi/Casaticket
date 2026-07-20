alter table public.profiles
alter column role drop not null;

alter type public.availability_status add value if not exists 'unavailable';
alter type public.availability_status add value if not exists 'scheduled_only';

create or replace function public.prevent_profile_role_reassignment()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if old.role is not null and new.role is distinct from old.role then
    raise exception 'Role cannot be changed once selected.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_role_reassignment on public.profiles;

create trigger guard_profile_role_reassignment
before update on public.profiles
for each row
execute procedure public.prevent_profile_role_reassignment();

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (
  id = auth.uid()
  and (role is null or role in ('customer', 'professional'))
);
