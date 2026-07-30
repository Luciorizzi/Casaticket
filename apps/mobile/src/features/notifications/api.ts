export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  entityType: string;
  entityId: string | null;
  route: string | null;
  routeParams: Record<string, string>;
  readAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string; user_id: string; type: string; title: string; body: string;
  entity_type: string; entity_id: string | null; route: string | null;
  route_params: Record<string, unknown>; read_at: string | null; created_at: string;
}

function mapNotification(row: NotificationRow): AppNotification {
  const routeParams = Object.fromEntries(Object.entries(row.route_params ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  return { body: row.body, createdAt: row.created_at, entityId: row.entity_id, entityType: row.entity_type, id: row.id, readAt: row.read_at, route: row.route, routeParams, title: row.title, type: row.type, userId: row.user_id };
}

export const notificationsQueryKey = (userId: string) => ['notifications', userId] as const;

export async function listNotifications(): Promise<AppNotification[]> {
  const { supabase } = await import('@/lib/supabase');
  const { data, error } = await supabase.from('notifications').select('*').order('read_at', { ascending: true, nullsFirst: true }).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as NotificationRow[]).map(mapNotification);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { supabase } = await import('@/lib/supabase');
  const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: notificationId });
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { supabase } = await import('@/lib/supabase');
  const { error } = await supabase.rpc('mark_all_notifications_read');
  if (error) throw error;
}

export async function registerPushToken(input: { deviceId: string | null; platform: 'android' | 'ios'; token: string }): Promise<void> {
  const { supabase } = await import('@/lib/supabase');
  const { error } = await supabase.rpc('register_push_token', { p_device_id: input.deviceId, p_expo_push_token: input.token, p_platform: input.platform });
  if (error) throw error;
}

export async function disablePushToken(token: string): Promise<void> {
  const { supabase } = await import('@/lib/supabase');
  const { error } = await supabase.from('push_tokens').update({ enabled: false }).eq('expo_push_token', token);
  if (error) throw error;
}
