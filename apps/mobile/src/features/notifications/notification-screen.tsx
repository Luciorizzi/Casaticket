import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { Screen } from '@/components/ui/screen';
import { colors } from '@/components/ui/theme';
import { useAuthSession } from '@/features/auth/auth-provider';
import { listNotifications, markAllNotificationsRead, markNotificationRead, notificationsQueryKey, type AppNotification } from '@/features/notifications/api';
import { formatRelativeNotificationDate } from '@/features/notifications/date';
import { getNotificationHref } from '@/features/notifications/navigation';

export function NotificationsScreen() {
  const { sessionState } = useAuthSession();
  const userId = sessionState.status === 'authenticated' ? sessionState.user.id : '';
  const queryClient = useQueryClient();
  const queryKey = notificationsQueryKey(userId);
  const query = useQuery({ enabled: Boolean(userId), queryFn: listNotifications, queryKey });
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const readMutation = useMutation({ mutationFn: markNotificationRead, onSuccess: refresh });
  const readAllMutation = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh });
  const open = (notification: AppNotification) => {
    if (!notification.readAt) readMutation.mutate(notification.id);
    const href = getNotificationHref(notification);
    if (href) router.push(href);
  };
  const notifications = query.data ?? [];
  return <Screen footer={<Button onPress={() => router.back()} variant="secondary">Volver</Button>} scroll={false} subtitle="Novedades de tus solicitudes y trabajos." title="Notificaciones">
    {notifications.some((item) => !item.readAt) ? <Button loading={readAllMutation.isPending} onPress={() => readAllMutation.mutate()} variant="ghost">Marcar todas como leídas</Button> : null}
    {query.isPending ? <LoadingState message="Cargando notificaciones..." /> : null}
    {query.error ? <ErrorState message="No pudimos cargar tus notificaciones." onRetry={() => void query.refetch()} /> : null}
    {!query.isPending && !query.error ? <FlatList
      data={notifications}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={<EmptyState description="Las novedades importantes aparecerán acá." title="Sin notificaciones" />}
      refreshControl={<RefreshControl onRefresh={() => void query.refetch()} refreshing={query.isRefetching} />}
      renderItem={({ item }) => <Pressable accessibilityLabel={`${item.readAt ? '' : 'Sin leer: '}${item.title}`} accessibilityRole="button" onPress={() => open(item)} style={[styles.row, !item.readAt ? styles.unread : null]}>
        <View style={styles.rowHeader}><Text style={styles.title}>{item.title}</Text>{!item.readAt ? <View style={styles.dot} /> : null}</View>
        <Text style={styles.body}>{item.body}</Text><Text style={styles.date}>{formatRelativeNotificationDate(item.createdAt)}</Text>
      </Pressable>}
    /> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 }, date: { color: colors.muted, fontSize: 12 },
  dot: { backgroundColor: colors.accent, borderRadius: 5, height: 10, width: 10 },
  row: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: 6, marginBottom: 10, padding: 14 },
  rowHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  title: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '800' }, unread: { backgroundColor: colors.accentSoft },
});
