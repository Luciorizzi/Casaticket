import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';

import { useAuthSession } from '@/features/auth/auth-provider';
import { registerPushToken } from '@/features/notifications/api';
import { getNotificationHref } from '@/features/notifications/navigation';
import { supportsRemotePushRegistration } from '@/features/notifications/push-runtime';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: true, shouldShowBanner: true, shouldShowList: true }),
});

async function configurePush(): Promise<void> {
  if (!supportsRemotePushRegistration(Constants.appOwnership)) return;
  if (!Device.isDevice || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { importance: Notifications.AndroidImportance.DEFAULT, name: 'CasaTicket' });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === 'granted' ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return;
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await registerPushToken({ deviceId: Device.osInternalBuildId ?? null, platform: Platform.OS, token });
}

function openPushResponse(response: Notifications.NotificationResponse): void {
  const data = response.notification.request.content.data;
  const route = typeof data.route === 'string' ? data.route : null;
  const routeParams = data.routeParams && typeof data.routeParams === 'object' ? data.routeParams as Record<string, string> : {};
  const href = getNotificationHref({ route, routeParams });
  if (href) router.push(href);
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const { sessionState } = useAuthSession();
  useEffect(() => {
    if (sessionState.status !== 'authenticated') return;
    if (!supportsRemotePushRegistration(Constants.appOwnership)) return;
    void configurePush().catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener(openPushResponse);
    void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) openPushResponse(response); });
    return () => subscription.remove();
  }, [sessionState.status]);
  return children;
}

export const defaultNotificationPreferences = {
  jobs: true, messages: true, opportunities: false, pushEnabled: true,
} as const;
