import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/components/ui/theme';
import { useAuthSession } from '@/features/auth/auth-provider';
import { listNotifications, notificationsQueryKey } from '@/features/notifications/api';
import { getUnreadNotificationCount } from '@/features/notifications/navigation';

export function NotificationBell() {
  const { sessionState } = useAuthSession();
  const userId = sessionState.status === 'authenticated' ? sessionState.user.id : '';
  const query = useQuery({ enabled: Boolean(userId), queryFn: listNotifications, queryKey: notificationsQueryKey(userId) });
  const unread = getUnreadNotificationCount(query.data ?? []);
  return <Pressable accessibilityLabel={`Notificaciones${unread ? `, ${unread} sin leer` : ''}`} accessibilityRole="button" onPress={() => router.push('/notifications')} style={styles.bell}>
    <Ionicons color={colors.accent} name="notifications-outline" size={24} />
    {unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text></View> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', backgroundColor: colors.danger, borderRadius: 10, minWidth: 18, paddingHorizontal: 4, position: 'absolute', right: -5, top: -5 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  bell: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44, position: 'relative' },
});
