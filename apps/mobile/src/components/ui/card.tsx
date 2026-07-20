import type { PropsWithChildren } from 'react';

import { StyleSheet, View } from 'react-native';

import { colors } from '@/components/ui/theme';

export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 12,
  },
});
