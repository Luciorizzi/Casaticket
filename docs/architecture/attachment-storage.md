# ADR — Adjuntos privados de solicitudes y trabajos

Fecha: 2026-07-28

## Decisión

Los adjuntos se registran en `public.attachments` y el contenido binario se guarda en el bucket privado `service-attachments`. La aplicación nunca persiste URLs: solicita URLs firmadas por 15 minutos y las mantiene en memoria hasta cerca de su vencimiento.

La creación y eliminación de metadatos se realiza mediante funciones `security definer`. Estas funciones derivan el path desde la entidad validada, restringen MIME, tamaño, tipo y cantidad, y no confían en un path enviado por el cliente. La carga se registra primero para que las políticas de Storage puedan validar el path; ante un fallo de carga se elimina el registro y el reintento reutiliza la solicitud o job ya existente.

## Acceso

- El cliente accede a adjuntos de sus solicitudes y jobs.
- Antes de una selección, solo profesionales compatibles acceden a fotos de solicitudes publicadas.
- Después de crear un job, el acceso queda limitado a sus participantes.
- Solo el propietario puede borrar su archivo.
- Diagnóstico y finalización solo pueden ser registrados por el profesional seleccionado en estados habilitados.

## Consecuencias

La eliminación usa Storage primero y luego la RPC de metadatos para evitar referencias a objetos inexistentes durante una operación normal. Si el segundo paso falla, queda un registro recuperable sin objeto; no se borran automáticamente evidencias asociadas a revisión o disputa.
