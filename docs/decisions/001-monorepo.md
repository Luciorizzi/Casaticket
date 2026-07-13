# ADR 001 - Monorepo

## Contexto

CasaTicket necesita una app movil, un panel admin y logica compartida sin duplicacion innecesaria.

## Decision

Usar un monorepo con `pnpm` workspaces y Turborepo.

## Ventajas

- comparte tipos, dominio y validaciones;
- centraliza scripts y calidad;
- reduce drift entre clientes.

## Desventajas

- requiere configuracion de tooling mas cuidadosa;
- puede aumentar la complejidad inicial.

## Consecuencias

La estructura compartida se vuelve parte del contrato del proyecto desde el inicio.

