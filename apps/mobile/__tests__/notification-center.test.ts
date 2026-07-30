import { getNotificationHref, getUnreadNotificationCount } from '@/features/notifications/navigation';
import { formatRelativeNotificationDate } from '@/features/notifications/date';
import { supportsRemotePushRegistration } from '@/features/notifications/push-runtime';

describe('notification center helpers', () => {
  it('calculates the unread badge', () => {
    expect(getUnreadNotificationCount([{ readAt: null }, { readAt: '2026-07-30T12:00:00Z' }, { readAt: null }])).toBe(2);
  });

  it('opens an allowlisted route with its real params', () => {
    expect(getNotificationHref({ route: '/(customer)/jobs/[jobId]', routeParams: { jobId: 'job-1' } })).toEqual({
      pathname: '/(customer)/jobs/[jobId]', params: { jobId: 'job-1' },
    });
  });

  it('rejects untrusted routes', () => {
    expect(getNotificationHref({ route: '/(customer)/home', routeParams: {} })).toBeNull();
  });

  it('formats notification dates without Intl.RelativeTimeFormat', () => {
    const now = new Date('2026-07-30T12:00:00.000Z');

    expect(formatRelativeNotificationDate(null, now)).toBe('Fecha no disponible');
    expect(formatRelativeNotificationDate('invalid', now)).toBe('Fecha no disponible');
    expect(formatRelativeNotificationDate('2026-07-30T11:59:45.000Z', now)).toBe('Ahora');
    expect(formatRelativeNotificationDate('2026-07-30T11:35:00.000Z', now)).toBe('Hace 25 min');
    expect(formatRelativeNotificationDate('2026-07-30T09:00:00.000Z', now)).toBe('Hace 3 h');
    expect(formatRelativeNotificationDate('2026-07-29T10:00:00.000Z', now)).toBe('Ayer');
    expect(formatRelativeNotificationDate('2026-07-27T12:00:00.000Z', now)).toBe('Hace 3 días');
  });

  it('does not register remote push tokens from Expo Go', () => {
    expect(supportsRemotePushRegistration('expo')).toBe(false);
    expect(supportsRemotePushRegistration('standalone')).toBe(true);
    expect(supportsRemotePushRegistration(null)).toBe(true);
  });
});
