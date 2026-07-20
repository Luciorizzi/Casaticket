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

La sesion ya se centraliza en `src/features/auth/auth-provider.tsx`.

La implementacion actual:

- restaura la sesion al abrir la app;
- escucha cambios de sesion de Supabase Auth;
- persiste la sesion con `expo-sqlite/localStorage/install`;
- evita consultas duplicadas del perfil en cada pantalla;
- expone un unico hook de sesion para auth, perfil y refresh.

El estado principal queda resuelto como:

- `loading`;
- `unauthenticated`;
- `authenticated` con `user`, `profile`, `professionalProfile` y categorias seleccionadas.

## Estado remoto y local

- TanStack Query se usa para perfil, perfil profesional, categorias y cache;
- React Hook Form + Zod se usan en login, registro y onboarding;
- el estado de UI local debe quedar acotado a cada feature.

## Estructura de features

La carpeta `app/` contiene rutas y layouts. La logica reusable vive en `src/features` y `src/providers`.

La fase actual agrega:

- `src/features/auth` para sesion y formularios de autenticacion;
- `src/features/onboarding` para seleccion de rol;
- `src/features/customer` para onboarding, home y perfil del cliente;
- `src/features/professional` para onboarding, home y perfil profesional;
- `src/features/profile` para persistencia de perfil en Supabase;
- `src/features/categories` para lectura de categorias activas;
- `src/components/ui` para componentes moviles reutilizables.

## Guards de navegacion

La app usa `Stack.Protected` y `Tabs` de Expo Router.

Reglas actuales:

- sin sesion -> `(auth)`;
- sesion cargando -> `loading`;
- perfil sin rol -> `(onboarding)/role-selection`;
- cliente incompleto -> `(onboarding)/customer-profile`;
- profesional incompleto -> `(onboarding)/professional-profile`;
- cliente completo -> `(customer)`;
- profesional completo -> `(professional)`.

Los guards evitan loops, acceso cruzado entre roles y acceso al onboarding una vez finalizado.

## Onboarding

Cliente:

- nombre;
- apellido;
- telefono;
- ciudad;
- provincia;
- direccion inicial opcional.

Profesional:

- datos personales;
- descripcion profesional;
- experiencia;
- ciudad base;
- categorias;
- radio de trabajo;
- disponibilidad.

El onboarding profesional se implementa en pasos para no perder el formulario completo ante errores de guardado al final.

## Limitaciones actuales

- la recuperacion de contrasena ya dispara el correo, pero el deep link final de restablecimiento sigue pendiente;
- la carga real de avatar queda documentada como siguiente paso, sin debilitar Storage ni agregar una subida incompleta.

## Decision clave

No concentrar logica, validaciones ni acceso a backend dentro de las pantallas de ruta.
