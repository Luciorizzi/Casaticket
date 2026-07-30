# ADR — Perfil público, portfolio y reputación profesional

Fecha: 2026-07-30

## Decisión

CasaTicket expone perfiles profesionales activos mediante funciones de lectura acotadas. La respuesta contiene identidad pública, ciudad base, rubros, experiencia, disponibilidad, verificación y métricas reales; no devuelve email, teléfono, dirección ni identificadores administrativos.

El portfolio se modela en `professional_portfolio_items`, con un máximo de 12 items y asociación futura opcional a `job_id`. Sus imágenes reutilizan `attachments` y el bucket privado `service-attachments`, con hasta cinco fotos por item y URLs firmadas. Los items ocultos y sus archivos sólo son visibles para el propietario.

El avatar usa el bucket privado `profile-media` y un path estable por usuario (`{user_id}/avatar.jpg`). El reemplazo usa `upsert`, evitando objetos huérfanos, y `profiles.avatar_path` sólo se actualiza mediante una función que valida ownership y path.

Las reseñas públicas se derivan exclusivamente de reviews reales escritas por clientes sobre trabajos completados. El nombre del cliente se abrevia y no se genera una calificación cuando no existen reviews.

## Consecuencias

- clientes autenticados pueden evaluar profesionales activos sin acceder a información de contacto;
- el mismo componente renderiza la propuesta contextual y el preview del profesional;
- la edición de portfolio y avatar queda limitada por RLS al propietario;
- la eliminación de un item elimina primero sus objetos privados y luego sus metadatos;
- una futura validación documental podrá ampliar el mapper de verificación sin cambiar la pantalla pública.
