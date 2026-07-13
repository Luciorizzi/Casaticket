insert into public.categories (name, slug, description)
values
  ('Plomeria', 'plomeria', 'Reparaciones, instalaciones y mantenimiento de plomeria.'),
  ('Electricidad', 'electricidad', 'Instalaciones electricas, tableros y reparaciones.'),
  ('Pintura', 'pintura', 'Trabajos de pintura interior y exterior.'),
  ('Albanileria y terminaciones', 'albanileria-terminaciones', 'Arreglos, refacciones y terminaciones.'),
  ('Cerrajeria', 'cerrajeria', 'Aperturas, cambios de cerraduras y herrajes.'),
  ('Persianas y mosquiteros', 'persianas-mosquiteros', 'Reparacion y colocacion de persianas y mosquiteros.'),
  ('Carpinteria', 'carpinteria', 'Muebles, ajustes, reparaciones y colocaciones.'),
  ('Mantenimiento general y colocaciones', 'mantenimiento-general-colocaciones', 'Tareas generales del hogar y colocaciones varias.')
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  active = true,
  updated_at = timezone('utc', now());

-- Usuarios demo:
-- Por buenas practicas, las cuentas de Auth no se generan con SQL en esta base.
-- Ejecutar `pnpm db:seed:users` luego de levantar Supabase local para crear:
-- 1. demo.customer@casaticket.local
-- 2. demo.pro@casaticket.local

