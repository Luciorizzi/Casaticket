# ADR 005 - App Controlled Profile Bootstrap

## Contexto

La app movil necesita soportar el estado "usuario autenticado pero todavia sin rol ni onboarding completo".

El esquema inicial tenia `profiles.role` obligatorio y no resolvia de forma consistente el caso de una sesion valida sin fila en `profiles`.

## Decision

Crear el perfil base desde la aplicacion movil, de forma controlada y respetando RLS, cuando una sesion autenticada todavia no tenga fila en `profiles`.

La fila inicial se crea con:

- `id = auth.uid()`
- `role = null`
- defaults del resto del perfil

Luego:

- la seleccion de rol persiste `customer` o `professional`;
- el onboarding completa los datos del perfil;
- una vez elegido el rol, no se permite cambiarlo libremente desde cliente.

## Ventajas

- soporta usuarios autenticados sin perfil previo;
- evita depender de triggers en `auth.users` para esta fase;
- mantiene la operacion dentro del mismo flujo de RLS que usa la app;
- permite un bootstrap idempotente desde el provider de sesion.

## Desventajas

- el cliente necesita resolver el caso de perfil ausente en el arranque;
- exige grants y politicas claros para no romper scripts ni smoke tests.

## Consecuencias

`profiles.role` pasa a ser nullable hasta la seleccion inicial y el provider de autenticacion se vuelve responsable de asegurar que exista una fila base antes de resolver la navegacion.
