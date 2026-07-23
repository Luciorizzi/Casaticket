begin;

create temporary table cleanup_test_service_request_titles (
  title text primary key
) on commit drop;

insert into cleanup_test_service_request_titles (title)
values
  ('Arreglo de perdida'),
  ('No se que rubro necesito'),
  ('Solicitud con postulacion retirada'),
  ('Solicitud para seleccionar profesional'),
  ('Solicitud cancelada sin postulaciones'),
  ('Solicitud ajena'),
  ('Solicitud visible tras retiro');

select sr.id, sr.title
from public.service_requests sr
join cleanup_test_service_request_titles cleanup on cleanup.title = sr.title
order by sr.title, sr.created_at;

with deleted as (
  delete from public.service_requests sr
  using cleanup_test_service_request_titles cleanup
  where cleanup.title = sr.title
  returning sr.id
)
select count(*) as deleted_service_requests
from deleted;

commit;
