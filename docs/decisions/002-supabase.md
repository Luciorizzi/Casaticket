# ADR 002 - Supabase

## Contexto

La primera version necesita autenticacion, PostgreSQL, storage, RLS y migraciones reproducibles sin operar infraestructura compleja.

## Decision

Usar Supabase como backend compartido.

## Ventajas

- acelera autenticacion y storage;
- mantiene PostgreSQL como base abierta;
- facilita RLS y desarrollo local reproducible.

## Desventajas

- algunas capacidades quedan acopladas al ecosistema Supabase;
- exige disciplina para modelar seguridad correctamente.

## Consecuencias

Las reglas de acceso deben vivir en backend y las migraciones pasan a ser una pieza central del repo.

