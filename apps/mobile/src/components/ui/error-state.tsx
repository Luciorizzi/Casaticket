import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { colors } from '@/components/ui/theme';

interface ErrorStateProps {
  actionLabel?: string | undefined;
  message: string;
  onRetry?: (() => void) | undefined;
  title?: string | undefined;
}

export function ErrorState({
  actionLabel = 'Reintentar',
  message,
  onRetry,
  title = 'Algo salió mal',
}: ErrorStateProps) {
  return (
    <Card>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      {onRetry ? (
        <Button onPress={onRetry} variant="secondary">
          {actionLabel}
        </Button>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
});
