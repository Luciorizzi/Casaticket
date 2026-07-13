# Mobile App

## Stack

- React Native;
- Expo;
- Expo Router;
- TypeScript estricto;
- TanStack Query;
- React Hook Form;
- Zod.

## Navegacion

La app movil usa grupos de rutas:

- `(auth)` para login y registro;
- `(onboarding)` para seleccion de rol;
- `(customer)` para la experiencia cliente;
- `(professional)` para la experiencia profesional;
- `profile` como espacio comun.

## Manejo de sesion

En esta fase solo existe la estructura base. La sesion real con Supabase Auth se conectara despues, pero ya hay providers para estado remoto y componentes de feature fuera de `app/`.

## Estado remoto y local

- TanStack Query se reserva para datos remotos y cache;
- React Hook Form + Zod se usaran para formularios y validacion;
- el estado de UI local debe quedar acotado a cada feature.

## Estructura de features

La carpeta `app/` contiene rutas y layouts. La logica reusable vive en `src/features` y `src/providers`.

## Decision clave

No concentrar logica, validaciones ni acceso a backend dentro de las pantallas de ruta.

