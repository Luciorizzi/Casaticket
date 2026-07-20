grant usage on schema public to authenticated, service_role;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.professional_profiles to authenticated;
grant select on table public.categories to authenticated;
grant select, insert, update, delete on table public.professional_categories to authenticated;
grant select, insert, update, delete on table public.customer_addresses to authenticated;

grant all privileges on table public.profiles to service_role;
grant all privileges on table public.professional_profiles to service_role;
grant all privileges on table public.categories to service_role;
grant all privileges on table public.professional_categories to service_role;
grant all privileges on table public.customer_addresses to service_role;
