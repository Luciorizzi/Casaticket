# System Overview

## Vista general

CasaTicket se organiza como un monorepo con dos clientes principales y un backend compartido:

- `apps/mobile`: experiencia para usuario y profesional en una sola app;
- `apps/admin`: panel administrativo web;
- `supabase/`: autenticacion, datos, storage y reglas de seguridad.

## Diagrama

```mermaid
flowchart LR
    Mobile["Aplicacion movil (Expo Router)"]
    Admin["Panel admin (Next.js App Router)"]
    Auth["Supabase Auth"]
    DB["PostgreSQL + RLS"]
    Storage["Supabase Storage"]
    Future["Integraciones futuras"]

    Mobile --> Auth
    Mobile --> DB
    Mobile --> Storage
    Admin --> Auth
    Admin --> DB
    Admin --> Storage
    Auth --> DB
    DB --> Future
    Storage --> Future
```

## Principios

- una sola app movil con dos roles;
- panel web separado para operacion interna;
- dominio compartido en paquetes puros de TypeScript;
- backend centralizado en Supabase;
- RLS como linea base de seguridad;
- integraciones futuras desacopladas de la fundacion actual.

