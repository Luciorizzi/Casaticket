import type { Href } from 'expo-router';

import type { AppNotification } from '@/features/notifications/api';

const allowedRoutes = new Set([
  '/(customer)/requests/[id]', '/chat/[conversationId]', '/(customer)/jobs/[jobId]',
  '/(professional)/jobs/[jobId]', '/(professional)/jobs/[jobId]/visit',
  '/(professional)/jobs/[jobId]/quote', '/(professional)/jobs/[jobId]/payment',
  '/(professional)/jobs/[jobId]/completion',
]);

export function getUnreadNotificationCount(notifications: Array<{ readAt: string | null }>): number {
  return notifications.filter((notification) => !notification.readAt).length;
}

export function getNotificationHref(notification: Pick<AppNotification, 'route' | 'routeParams'>): Href | null {
  if (!notification.route || !allowedRoutes.has(notification.route)) return null;
  return { pathname: notification.route, params: notification.routeParams } as Href;
}
