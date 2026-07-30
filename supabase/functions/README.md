# Supabase Edge Functions

`send-notification-push` envía una notificación persistida a los tokens Expo activos.

Invocación recomendada: Database Webhook sobre `notifications` (`INSERT`) enviando el `notificationId`, autenticado con `SUPABASE_SERVICE_ROLE_KEY`. Un cron puede invocarla con `{ "processReceipts": true }` para consultar receipts y desactivar tokens `DeviceNotRegistered`.

En desarrollo puede omitirse el webhook: las notificaciones internas siguen persistidas y la función puede mockearse. La app móvil nunca recibe la service role.

