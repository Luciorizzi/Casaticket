import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/components/ui/theme';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Cargando…' }: LoadingStateProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} size="large" />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  message: {
    fontSize: 15,
    color: colors.muted,
  },
});
