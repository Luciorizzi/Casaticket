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

En esta fase, `role` puede comenzar en `null` hasta que la persona complete la seleccion de rol desde la app movil.

El perfil base se crea desde la aplicacion movil de forma controlada y respetando RLS cuando una sesion autenticada todavia no tiene fila en `profiles`.

Una vez elegido el rol:

- se permite `customer` o `professional`;
- no se permite `admin` ni `operator`;
- no se permite cambiar el rol libremente desde cliente una vez seleccionado.

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

Disponibilidades actuales:

- `available`
- `unavailable`
- `busy`
- `scheduled_only`
- `paused`

La validacion profesional comienza siempre en `pending` y no puede ser modificada por el propio profesional.

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

Ademas:

- `authenticated` tiene grants explicitos para operar solo las tablas necesarias del flujo movil;
- `service_role` tiene grants explicitos para seeds, scripts y pruebas reproducibles;
- el smoke test de RLS cubre lectura propia, escalacion de rol, bloqueo de verificacion profesional, bootstrap de perfil y bloqueo de cambio de rol.

## Entidades futuras documentadas

No implementadas aun, pero previstas:

- solicitudes;
- postulaciones;
- presupuestos;
- mensajes;
- calificaciones;
- reclamos;
- auditoria de negocio mas detallada.
