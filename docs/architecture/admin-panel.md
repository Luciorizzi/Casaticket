# Admin Panel

## Stack

- Next.js App Router;
- TypeScript estricto;
- Tailwind CSS;
- TanStack Query;
- React Hook Form;
- Zod;
- shadcn/ui preparado, todavia sin componentes innecesarios.

## Alcance actual

El panel actual es un esqueleto tecnico con:

- layout global;
- acceso placeholder;
- dashboard placeholder;
- navegacion lateral;
- modulos placeholder de usuarios, profesionales, categorias, solicitudes, reclamos y configuracion.

## Autenticacion y permisos

La autenticacion real se integrara con Supabase Auth. La autorizacion debe apoyarse en roles y reglas de backend, no solo en restricciones de interfaz.

## Estructura de modulos

Se eligio una estructura simple basada en App Router para crecer modulo por modulo sin montar un panel completo prematuro.

