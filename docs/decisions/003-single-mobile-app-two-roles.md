# ADR 003 - Single Mobile App Two Roles

## Contexto

El producto tiene dos actores principales, pero ambos comparten parte del onboarding, autenticacion y datos base.

## Decision

Construir una sola app movil con dos roles: `customer` y `professional`.

## Ventajas

- evita duplicar aplicaciones;
- simplifica distribucion y mantenimiento;
- permite compartir onboarding, sesion y componentes.

## Desventajas

- obliga a pensar con cuidado la navegacion por rol;
- puede aumentar el branching de interfaz si no se modulariza bien.

## Consecuencias

La arquitectura movil debe separar features por rol sin mezclar la logica de negocio dentro de las rutas.

