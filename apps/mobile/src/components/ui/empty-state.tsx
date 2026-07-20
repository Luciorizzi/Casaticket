import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { colors } from '@/components/ui/theme';

interface EmptyStateProps {
  actionLabel?: string | undefined;
  description: string;
  onAction?: (() => void) | undefined;
  title: string;
}

export function EmptyState({ actionLabel, description, onAction, title }: EmptyStateProps) {
  return (
    <Card>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {actionLabel && onAction ? (
        <Button onPress={onAction}>{actionLabel}</Button>
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
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
});
