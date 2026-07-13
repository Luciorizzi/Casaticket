# CasaTicket

CasaTicket es un marketplace movil para conectar usuarios del hogar con profesionales independientes de servicios, reparaciones y tareas domesticas.

## Estado actual

Este repositorio contiene la fundacion tecnica inicial del proyecto:

- monorepo con `pnpm` workspaces y Turborepo;
- app movil con Expo Router y placeholders navegables;
- panel administrativo con Next.js App Router y modulos placeholder;
- paquetes compartidos de tipos, dominio, validaciones y metadata UI;
- backend preparado para Supabase, migraciones reproducibles, RLS y seed;
- documentacion de producto, arquitectura y ADR;
- lint, typecheck, tests base, Playwright preparado y GitHub Actions.

No se implementaron aun flujos funcionales completos de solicitudes, postulaciones, matching, pagos, chat ni reclamos operativos.

## Arquitectura

```text
apps/
  mobile/   -> app Expo con dos roles
  admin/    -> panel administrativo web
packages/
  config/   -> tsconfig y configuracion compartida
  domain/   -> reglas de negocio puras
  types/    -> tipos compartidos
  validation/ -> esquemas Zod
  ui/       -> metadata UI minima realmente compartible
supabase/
  migrations/ -> esquema inicial y RLS
  seed.sql  -> catalogos base
  scripts/  -> bootstrap de usuarios demo
  tests/    -> verificacion reproducible de RLS
docs/
  product/      -> contexto funcional
  architecture/ -> decisiones tecnicas de alto nivel
  decisions/    -> ADR
```

## Documentos obligatorios antes de implementar

Leer primero:

- `AGENTS.md`
- `docs/product/product-context.md`
- `docs/product/business-model.md`
- `docs/product/roles-and-flows.md`
- `docs/product/mvp-scope.md`
- `docs/architecture/system-overview.md`
- `docs/architecture/mobile-app.md`
- `docs/architecture/admin-panel.md`
- `docs/architecture/database.md`

## Requisitos

- Node.js 22 o superior
- Corepack habilitado
- `pnpm`
- Supabase CLI

## Instalacion

1. Habilitar Corepack si hace falta:

```bash
corepack enable
corepack prepare pnpm@10.0.0 --activate
```

2. Instalar dependencias:

```bash
pnpm install
```

3. Completar variables locales a partir de `.env.example`.

## Variables de entorno

Variables publicas para clientes:

```env
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Variables para scripts seguros de backend local:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

No incluir claves reales ni `service_role` en aplicaciones cliente.

## Supabase local

Levantar el stack local:

```bash
pnpm db:start
```

Aplicar migraciones y seed:

```bash
pnpm db:reset
```

Crear usuarios demo de Auth y perfiles asociados:

```bash
pnpm db:seed:users
```

Verificar RLS:

```bash
pnpm db:test:rls
```

Detener el stack:

```bash
pnpm db:stop
```

## Ejecucion de aplicaciones

App movil:

```bash
pnpm dev:mobile
```

Panel administrativo:

```bash
pnpm dev:admin
```

Ambas apps en paralelo:

```bash
pnpm dev
```

## Calidad

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format
```

## Migraciones y seed

- `supabase/migrations/20260713150000_initial_schema.sql` crea el esquema base, triggers, buckets y politicas RLS.
- `supabase/seed.sql` inserta las ocho categorias iniciales.
- `supabase/scripts/seed-demo-users.ts` crea un cliente demo y un profesional demo sin guardar secretos en el repo.

## Pruebas

- `packages/domain` y `packages/validation` tienen tests de reglas de dominio y esquemas.
- `apps/mobile` tiene una prueba base con React Native Testing Library.
- `apps/admin` tiene una prueba base con Vitest y una smoke spec preparada para Playwright.

## Alcance actual

Incluye:

- estructura de monorepo;
- placeholders navegables;
- modelo de datos inicial;
- seguridad base;
- documentacion fuente.

Fuera de alcance actual:

- solicitudes funcionales;
- matching;
- postulaciones;
- chat;
- pagos;
- mapas reales;
- geocodificacion real;
- notificaciones push;
- reputacion avanzada;
- reclamos operativos completos.

