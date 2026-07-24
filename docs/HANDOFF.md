# CasaTicket Handoff

Ultima actualizacion: 2026-07-23.

Este documento resume el estado real del repositorio para que otro agente pueda continuar sin relevar todo desde cero. No contiene secretos.

## Estado general

CasaTicket es un monorepo con:

- `apps/mobile`: app movil Expo/React Native con una sola experiencia para cliente y profesional.
- `apps/admin`: panel web Next.js, actualmente en estado placeholder operativo.
- `packages/types`, `packages/domain`, `packages/validation`, `packages/ui`: contratos, reglas de dominio, validaciones y UI compartida.
- `supabase`: migraciones, seed, scripts y smoke tests RLS.

El flujo movil ya supera el alcance inicial documentado en `docs/product/mvp-scope.md`: ademas de autenticacion, onboarding, solicitudes, oportunidades, postulaciones y seleccion, existen chat privado, jobs, diagnostico, presupuestos, pagos mock protegidos, ejecucion, finalizacion y calificaciones.

## Funcionalidades implementadas

### Autenticacion y onboarding

- Registro, login, logout y recuperacion inicial de contrasena.
- Restauracion de sesion con Supabase Auth y storage local Expo SQLite.
- Validacion de sesiones restauradas: si el JWT local referencia un usuario inexistente o invalido, se limpia sesion/cache y se redirige a login.
- Bootstrap controlado de `profiles` desde la app.
- Seleccion inicial de rol `customer` o `professional` una sola vez.
- Bloqueo de autoasignacion de `admin` y `operator`.
- Onboarding cliente con perfil base, ubicacion y direccion inicial opcional.
- Onboarding profesional con perfil, experiencia, categorias, radio de trabajo y disponibilidad.

Archivos principales:

- `apps/mobile/src/features/auth/auth-provider.tsx`
- `apps/mobile/src/features/auth/session-state.ts`
- `apps/mobile/src/features/auth/session-validation.ts`
- `apps/mobile/src/features/onboarding/role-selection-screen.tsx`
- `apps/mobile/src/features/profile/api.ts`
- `apps/mobile/src/features/customer/customer-profile-form.tsx`
- `apps/mobile/src/features/professional/professional-profile-form.tsx`
- `apps/mobile/src/features/navigation/access.ts`

### Cliente

- Home cliente.
- Creacion de solicitudes reales en `service_requests`.
- Lista y detalle de solicitudes propias.
- Pantalla compacta de detalles de solicitud.
- Cancelacion de solicitudes propias cuando corresponde.
- Visualizacion de postulaciones recibidas.
- Marcado de postulacion como vista.
- Detalle de postulacion con perfil/propuesta del profesional.
- Seleccion de profesional.
- Acceso a chat asociado a postulacion.
- Acceso a progreso operativo del trabajo seleccionado.
- Confirmacion/rechazo de visita propuesta.
- Aceptacion/rechazo de presupuesto.
- Pago protegido mock posterior a presupuesto aceptado.
- Confirmacion o disputa de finalizacion.
- Calificacion al profesional.

Archivos principales:

- `apps/mobile/src/features/customer/screens.tsx`
- `apps/mobile/src/features/customer/service-request-form.tsx`
- `apps/mobile/src/features/customer/service-requests-api.ts`
- `apps/mobile/src/features/jobs/customer-job-panel.tsx`
- `apps/mobile/app/(customer)/requests/[id].tsx`
- `apps/mobile/app/(customer)/requests/[id]/details.tsx`
- `apps/mobile/app/(customer)/requests/[id]/applications/[applicationId].tsx`
- `apps/mobile/app/(customer)/jobs/[jobId].tsx`

### Profesional

- Home profesional.
- Perfil profesional editable.
- Actualizacion de disponibilidad.
- Pantalla Oportunidades con filtros por categoria, ciudad y texto.
- Matching de oportunidades basado en categoria, ciudad/radio basico y estado publicado.
- Refetch de oportunidades solo al foco, refresh manual y pull-to-refresh; sin polling permanente.
- Postulacion a solicitudes compatibles.
- Retiro de postulacion.
- Lista de postulaciones propias.
- Lista Mis trabajos con `jobId` real cuando existe job asociado.
- Acceso a detalle operativo del job.
- Propuesta de visita.
- Registro de diagnostico.
- Creacion, versionado y envio de presupuesto.
- Inicio de trabajo despues de pago protegido.
- Marcado de trabajo como finalizado por profesional.
- Calificacion al cliente.

Archivos principales:

- `apps/mobile/src/features/professional/screens.tsx`
- `apps/mobile/src/features/professional/opportunities-api.ts`
- `apps/mobile/src/features/professional/application-form.tsx`
- `apps/mobile/src/features/professional/city-catalog.ts`
- `apps/mobile/src/features/jobs/professional-job-detail-screen.tsx`
- `apps/mobile/app/(professional)/opportunities.tsx`
- `apps/mobile/app/(professional)/opportunities/[id].tsx`
- `apps/mobile/app/(professional)/jobs.tsx`
- `apps/mobile/app/(professional)/jobs/[jobId].tsx`

### Chat privado

- Conversacion privada por postulacion.
- Creacion automatica/idempotente de conversacion por `application_id`.
- Mensajes entre cliente propietario de la solicitud y profesional de la postulacion.
- Contadores de no leidos.
- Marcar conversacion como leida.
- Conversaciones rechazadas o retiradas pasan a solo lectura.
- Advertencia simple ante posible intercambio de contacto externo.
- Polling moderado/refetch en pantalla de chat, sin Supabase Realtime.

Archivos principales:

- `apps/mobile/src/features/applications/chat-api.ts`
- `apps/mobile/src/features/applications/chat-panel.tsx`
- `apps/mobile/src/features/applications/chat-screen.tsx`
- `apps/mobile/app/chat/[conversationId].tsx`

### Jobs, presupuesto, pagos y reviews

- Creacion de `jobs` al seleccionar profesional.
- Backfill de jobs faltantes para solicitudes ya seleccionadas.
- Estados operativos de job: coordinacion, visita, diagnostico, presupuesto, pago, ejecucion, revision, completado/disputado/cancelado.
- Presupuestos versionados en `job_quotes`.
- Totales ajustados: mano de obra, materiales, visita, comision plataforma y total cliente.
- Pago protegido mock en `payments`.
- Flujo mock: pago pendiente, procesando, protegido, fallido, liberacion, liberado, disputa, devolucion.
- Reglas para iniciar trabajo solo cuando el pago esta protegido.
- Finalizacion por profesional y confirmacion/disputa por cliente.
- Reviews por ambas partes con metricas publicas del profesional, condicionadas por pago liberado.

Archivos principales:

- `apps/mobile/src/features/jobs/api.ts`
- `apps/mobile/src/features/jobs/customer-job-panel.tsx`
- `apps/mobile/src/features/jobs/professional-job-detail-screen.tsx`
- `apps/mobile/src/features/jobs/job-progress-list.tsx`
- `apps/mobile/src/features/jobs/status-labels.ts`
- `packages/types/src/index.ts`
- `packages/domain/src/index.ts`
- `packages/validation/src/index.ts`

### Admin

- App Next.js con layout, providers, navegacion y modulos placeholder.
- Aun no hay integracion real de Auth/RLS en UI admin.

Archivos principales:

- `apps/admin/app/(dashboard)/*`
- `apps/admin/src/components/dashboard-shell.tsx`
- `apps/admin/src/components/placeholder-page.tsx`

## Funcionalidad actual en desarrollo

El ultimo foco funcional fue estabilizar Oportunidades del profesional y datos de prueba:

- Se corrigio el loop de refresh en Oportunidades.
- Se elimino polling permanente en esa pantalla.
- Se mantiene data previa durante refetch para evitar saltos visuales.
- `supabase/seed.sql` queda solo con categorias base.
- Se agrego un script seguro para limpiar solicitudes ficticias conocidas: `supabase/scripts/cleanup-test-service-requests.sql`.
- El smoke RLS limpia solicitudes temporales que crea durante la prueba.

No hay cambios funcionales pendientes en el worktree antes de crear este handoff; `docs/HANDOFF.md` es el unico archivo que debe quedar modificado por esta tarea.

## Decisiones tecnicas tomadas

- Monorepo con pnpm workspaces.
- TypeScript estricto en apps y paquetes.
- Supabase como backend central: Auth, Postgres, RLS y Storage preparado.
- RLS no se desactiva para resolver flujos moviles; se corrigen policies/RPCs/migraciones.
- Una sola app movil con rutas protegidas por rol usando Expo Router.
- Estado de sesion centralizado en `AuthProvider`; pantallas consumen `useAuthSession`.
- TanStack Query como fuente de cache remota.
- Mutaciones criticas sincronizan cache y estado de sesion cuando corresponde.
- Operaciones sensibles de negocio viven preferentemente en RPC SQL transaccionales.
- Jobs se crean desde la RPC de seleccion profesional, no desde frontend.
- Chat privado usa RPCs y RLS, no Supabase Realtime en esta fase.
- Pagos son mock pero modelados como pago protegido previo; no hay proveedor real integrado.
- Seeds definitivos no insertan solicitudes, postulaciones, chat, jobs ni pagos.
- Datos demo de usuarios se crean con script service-role, no con SQL directo en `seed.sql`.

## Supabase: esquema relevante

Tablas principales:

- `profiles`: perfil base y rol.
- `professional_profiles`: datos profesionales y disponibilidad.
- `categories`: rubros base.
- `professional_categories`: rubros por profesional.
- `customer_addresses`: direcciones cliente.
- `service_requests`: solicitudes cliente.
- `applications`: postulaciones profesionales.
- `conversations`: chat por postulacion.
- `messages`: mensajes privados.
- `jobs`: trabajo operativo posterior a seleccion.
- `job_quotes`: presupuestos versionados.
- `payments`: pagos mock protegidos.
- `reviews`: calificaciones.

RPCs principales:

- `list_professional_opportunities(p_professional_id)`
- `get_professional_opportunity(p_request_id, p_professional_id)`
- `list_customer_request_applications(p_request_id)`
- `mark_customer_application_viewed(p_application_id)`
- `select_professional_for_request(p_request_id, p_application_id)`
- `list_professional_applications()`
- `list_professional_selected_jobs()`
- `ensure_application_conversation(p_application_id)`
- `get_conversation(p_conversation_id)`
- `list_conversation_messages(p_conversation_id)`
- `send_conversation_message(p_conversation_id, p_body)`
- `mark_conversation_read(p_conversation_id)`
- `get_job_by_request(p_request_id)`
- `list_job_quotes(p_job_id)`
- `propose_job_visit`, `confirm_job_visit`, `reject_job_visit`
- `record_job_diagnosis`
- `create_job_quote`, `send_job_quote`, `reject_job_quote`
- `accept_quote_and_create_payment`
- `retry_mock_payment`, `secure_mock_payment`, `release_eligible_payments`, `refund_mock_payment`
- `start_job`, `mark_job_completed_by_professional`, `confirm_job_completion`, `dispute_job_completion`
- `create_review`, `get_professional_public_metrics`

## Migraciones relevantes

- `20260713150000_initial_schema.sql`: perfiles, categorias, relaciones, direcciones, buckets y RLS inicial.
- `20260716110000_mobile_auth_onboarding.sql`: onboarding movil, rol nullable y trigger `guard_profile_role_reassignment`.
- `20260716120000_table_grants.sql`: grants explicitos para `authenticated` y `service_role`.
- `20260720100000_service_requests.sql`: tabla y RLS de solicitudes.
- `20260720110000_professional_applications.sql`: postulaciones, matching inicial y RPCs de oportunidades.
- `20260720120000_customer_professional_selection.sql`: seleccion de profesional y postulaciones del cliente.
- `20260720121000_fix_customer_selection_rpc.sql`: correccion de RPC de seleccion.
- `20260720130000_application_private_chat.sql`: conversaciones, mensajes, contadores y RLS de chat.
- `20260720131000_fix_chat_rpc_ambiguity.sql`: correccion de ambiguedad en RPC de chat.
- `20260721100000_fix_chat_mark_read_and_dedicated_summary.sql`: resumen de chat y lectura.
- `20260721110000_jobs_diagnosis_quotes.sql`: jobs y presupuestos.
- `20260721111000_fix_jobs_selection_conflict_ambiguity.sql`: correccion de seleccion/job.
- `20260721112000_fix_job_quote_response_ambiguity.sql`: correccion de respuesta de presupuestos.
- `20260721113000_backfill_selected_jobs.sql`: backfill de jobs faltantes.
- `20260721114000_finalize_selected_jobs.sql`: seleccion crea job y retorna `job_id`.
- `20260722100000_complete_job_diagnosis_quote_flow.sql`: completa diagnostico/presupuesto.
- `20260722110000_adjust_quote_platform_fee_totals.sql`: totales y comision plataforma.
- `20260722120000_job_execution_reviews.sql`: ejecucion, finalizacion, disputa y reviews.
- `20260723110000_protected_mock_payments.sql`: pagos mock protegidos.
- `20260723111000_fix_protected_payment_ambiguity.sql`: correccion de ambiguedad en pagos.
- `20260723112000_fix_payment_conflict_target.sql`: correccion de conflicto en pagos.
- `20260723113000_fix_metrics_require_released_payment.sql`: metricas solo con pago liberado.
- `20260723120000_fix_professional_opportunity_matching.sql`: matching de oportunidades por profesional y filtros reales.

## Seeds y datos locales

- `supabase/seed.sql` solo inserta categorias base.
- `pnpm db:seed:users` crea dos usuarios demo, sus perfiles, categorias profesionales y direccion cliente usando `SUPABASE_SERVICE_ROLE_KEY`.
- El seed de usuarios no crea solicitudes, postulaciones, conversaciones, jobs ni pagos.
- `supabase/scripts/cleanup-test-service-requests.sql` elimina por titulo exacto solicitudes ficticias conocidas y fue creado para limpiar entornos locales sin `db:reset`.

## Errores conocidos y deuda

- Recuperacion de contrasena: se envia correo, pero el deep link final de restablecimiento sigue pendiente.
- Avatar: la carga real sigue pendiente; Storage esta preparado.
- Admin: panel placeholder, sin autenticacion/autorizacion real integrada.
- Pagos: proveedor real no integrado; solo existe mock protegido.
- Realtime: chat usa refetch/polling moderado, no Supabase Realtime.
- Geolocalizacion: matching usa ciudad/categoria/radio basico; no hay PostGIS ni geocodificacion real.
- Hay textos con mojibake en algunos archivos, por ejemplo `packages/domain/src/index.ts` y `apps/mobile/src/lib/supabase.ts`.
- `apps/mobile/src/features/applications/job-panel.tsx` conserva texto/flujo legacy sobre presupuestos y pagos; los paneles principales actuales estan en `apps/mobile/src/features/jobs/*`.
- Los docs de arquitectura estan parcialmente desactualizados frente al estado real implementado.

## Pruebas realizadas

Ultima validacion conocida del estado actual:

- `pnpm lint`: paso.
- `pnpm typecheck`: paso.
- `pnpm test`: paso.
- `pnpm db:test:rls`: paso.

Cobertura destacada:

- AuthProvider y sesiones invalidas.
- Seleccion de rol.
- Onboarding cliente/profesional.
- APIs de perfil.
- Solicitudes cliente.
- Oportunidades profesional, filtros, refresh y estado vacio.
- Postulaciones.
- Chat API y pantalla de chat.
- Jobs API.
- Detalle profesional de job.
- Panel cliente de job.
- Migraciones de jobs seleccionados.
- Migraciones de pagos protegidos.
- Seed sin `service_requests`.
- Smoke RLS end to end para roles, solicitudes, oportunidades, postulaciones, chat, seleccion, jobs, presupuestos, pagos y reviews.

## Comandos para levantar el proyecto

Instalacion:

```powershell
corepack enable
pnpm install
```

Supabase local:

```powershell
pnpm db:start
pnpm db:reset
pnpm db:seed:users
```

App movil:

```powershell
pnpm dev:mobile
```

Admin:

```powershell
pnpm dev:admin
```

Todo el workspace en desarrollo:

```powershell
pnpm dev
```

Validacion:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm db:test:rls
```

Limpieza puntual de solicitudes ficticias locales:

```powershell
Get-Content -Raw supabase/scripts/cleanup-test-service-requests.sql | docker exec -i supabase_db_casaticket psql -U postgres -d postgres
```

## Variables de entorno requeridas

No incluir valores reales en documentacion ni commits.

App movil:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Scripts Supabase y RLS:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Alias aceptados en algunos scripts:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Para obtener valores locales despues de `pnpm db:start`, usar:

```powershell
pnpm exec supabase status
```

## Proximos pasos recomendados

1. Corregir mojibake restante en dominio/lib moviles y asegurar UTF-8 consistente.
2. Actualizar `docs/architecture/*` para reflejar chat, jobs, pagos mock y reviews.
3. Completar deep link de recuperacion de contrasena.
4. Decidir e implementar carga real de avatar/adjuntos con Storage seguro.
5. Consolidar o retirar `apps/mobile/src/features/applications/job-panel.tsx` si ya no es ruta primaria.
6. Reemplazar pago mock por integracion real cuando se defina proveedor.
7. Evaluar Supabase Realtime para chat/notificaciones cuando el flujo base este estable.
8. Implementar geocodificacion real y matching por distancia.
9. Avanzar panel admin con Auth, roles internos y moderacion real.
10. Mantener `supabase/seed.sql` sin datos transaccionales ficticios.

## Supuestos para continuar

- Los roles moviles seleccionables siguen siendo solo `customer` y `professional`.
- `admin` y `operator` son roles internos futuros, no autoasignables desde la app.
- La fuente de verdad de estado operativo es Supabase con RLS y RPCs transaccionales.
- La app movil debe mostrar solo solicitudes reales creadas desde la app, no fixtures persistentes.
- Jobs validos siempre deben tener `jobId` real; no usar `requestId` ni `applicationId` como reemplazo.
- La conversacion pertenece a una postulacion y no debe convertirse en chat global.
- Los pagos actuales son simulados; no representar cobros reales al usuario final.
- Ante cambios de negocio importantes, crear ADR en `docs/decisions`.
