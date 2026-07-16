import { StyleSheet, Text, View } from 'react-native';

import type { AvailabilityStatus, VerificationStatus } from '@casaticket/types';

import { getAvailabilityLabel } from '@casaticket/domain';

import { colors } from '@/components/ui/theme';

interface StatusBadgeProps {
  tone?: 'accent' | 'neutral' | 'success' | 'warning';
  value: string;
}

export function StatusBadge({ tone = 'neutral', value }: StatusBadgeProps) {
  return (
    <View style={[styles.badge, toneStyles[tone]]}>
      <Text style={[styles.label, labelStyles[tone]]}>{value}</Text>
    </View>
  );
}

export function getVerificationLabel(status: VerificationStatus): string {
  switch (status) {
    case 'pending':
      return 'Validación pendiente';
    case 'verified':
      return 'Validado';
    case 'rejected':
      return 'Rechazado';
  }
}

export function getAvailabilityBadge(status: AvailabilityStatus): string {
  return getAvailabilityLabel(status);
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});

const toneStyles = StyleSheet.create({
  neutral: {
    backgroundColor: '#eee4d2',
  },
  accent: {
    backgroundColor: colors.accentSoft,
  },
  success: {
    backgroundColor: '#d9ecdf',
  },
  warning: {
    backgroundColor: '#f6e6d0',
  },
});

const labelStyles = StyleSheet.create({
  neutral: {
    color: colors.muted,
  },
  accent: {
    color: colors.accent,
  },
  success: {
    color: colors.success,
  },
  warning: {
    color: colors.warning,
  },
});
