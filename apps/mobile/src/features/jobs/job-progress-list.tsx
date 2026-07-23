import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/components/ui/theme';

export type JobProgressRowState = 'active' | 'done' | 'pending' | 'warning';

export interface JobProgressRowItem {
  id: string;
  state: JobProgressRowState;
  subtitle: string;
  title: string;
  onPress?: (() => void) | undefined;
}

const noop = () => undefined;

export function JobProgressList({ rows }: { rows: JobProgressRowItem[] }) {
  return (
    <View style={styles.list}>
      {rows.map((row, index) => (
        <Pressable
          accessibilityLabel={`${row.title}: ${row.subtitle}`}
          accessibilityRole="button"
          key={row.id}
          onPress={row.onPress ?? noop}
          style={[styles.row, index < rows.length - 1 ? styles.rowBorder : null]}
        >
          <View style={[styles.indicator, indicatorStyles[row.state]]} />
          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.title}>
              {row.title}
            </Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {row.subtitle}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const indicatorStyles = StyleSheet.create({
  active: {
    backgroundColor: colors.accent,
  },
  done: {
    backgroundColor: colors.success,
  },
  pending: {
    backgroundColor: colors.border,
  },
  warning: {
    backgroundColor: colors.warning,
  },
});

const styles = StyleSheet.create({
  list: {
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  chevron: {
    color: colors.muted,
    fontSize: 26,
    fontWeight: '500',
  },
});
