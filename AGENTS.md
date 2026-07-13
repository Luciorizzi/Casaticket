# CasaTicket Agent Instructions

Este archivo contiene instrucciones de trabajo para agentes. No reemplaza el contexto funcional completo del producto.

Antes de implementar funcionalidades, cualquier agente debe leer:

- `docs/product/product-context.md`
- `docs/product/business-model.md`
- `docs/product/roles-and-flows.md`
- `docs/product/mvp-scope.md`
- los documentos aplicables dentro de `docs/architecture`

Reglas de trabajo:

- usar TypeScript estricto;
- evitar `any`;
- no agregar dependencias sin justificar;
- no implementar funcionalidades fuera de alcance;
- separar logica de dominio e interfaz;
- ejecutar lint, typecheck y tests;
- no afirmar que algo funciona sin probarlo;
- no incluir secretos;
- mantener migraciones reproducibles;
- usar RLS;
- actualizar documentacion cuando cambie una decision;
- seguir la instruccion mas reciente del usuario cuando contradiga documentacion anterior;
- registrar decisiones importantes mediante ADR.

