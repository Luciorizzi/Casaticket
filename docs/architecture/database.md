# Database

## Entidades actuales

### profiles

Perfil base por usuario autenticado.

Campos:

- `id`
- `first_name`
- `last_name`
- `phone`
- `avatar_path`
- `role`
- `province`
- `city`
- `onboarding_completed`
- `created_at`
- `updated_at`

Roles actuales:

- `customer`
- `professional`
- `admin`
- `operator`

Los roles administrativos no son autoasignables desde clientes.

### professional_profiles

Extension del perfil para profesionales.

Campos:

- `id`
- `user_id`
- `bio`
- `years_experience`
- `base_city`
- `base_latitude`
- `base_longitude`
- `service_radius_km`
- `availability_status`
- `verification_status`
- `created_at`
- `updated_at`

Restriccion actual:

- `service_radius_km` entre 1 y 100.

### categories

Catalogo administrable de rubros iniciales.

### professional_categories

Relacion muchos a muchos entre perfiles profesionales y categorias.

### customer_addresses

Direcciones iniciales del cliente, preparadas para futuras solicitudes y ubicacion operativa.

## Seguridad

- RLS activado en tablas de dominio;
- cada usuario accede a su propio perfil;
- cada profesional accede a su propio perfil profesional;
- categorias activas visibles para usuarios autenticados;
- storage preparado con buckets privados por carpeta de usuario;
- proteccion contra autoasignacion de roles administrativos;
- proteccion contra autoverificacion profesional.

## Entidades futuras documentadas

No implementadas aun, pero previstas:

- solicitudes;
- postulaciones;
- presupuestos;
- mensajes;
- calificaciones;
- reclamos;
- auditoria de negocio mas detallada.

