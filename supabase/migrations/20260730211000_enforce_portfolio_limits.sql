create or replace function public.validate_professional_portfolio_item()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' and (select count(*) from public.professional_portfolio_items where professional_id = new.professional_id) >= 12 then
    raise exception 'Portfolio item limit reached.';
  end if;
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists validate_professional_portfolio_item_before_write on public.professional_portfolio_items;
create trigger validate_professional_portfolio_item_before_write
before insert or update on public.professional_portfolio_items
for each row execute procedure public.validate_professional_portfolio_item();

create or replace function public.set_own_professional_avatar(p_avatar_path text)
returns text
language plpgsql security definer set search_path = public
as $$
begin
  if p_avatar_path is not null and p_avatar_path <> (auth.uid()::text || '/avatar.jpg') then
    raise exception 'Invalid avatar path.';
  end if;
  update public.profiles set avatar_path = p_avatar_path, updated_at = timezone('utc', now())
  where id = auth.uid() and role = 'professional';
  if not found then raise exception 'Professional profile not found.'; end if;
  return p_avatar_path;
end;
$$;
