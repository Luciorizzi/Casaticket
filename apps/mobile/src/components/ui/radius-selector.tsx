import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/components/ui/theme';

interface RadiusSelectorProps {
  onChange: (value: number) => void;
  value: number;
}

export function RadiusSelector({ onChange, value }: RadiusSelectorProps) {
  const nextDown = Math.max(1, value - 1);
  const nextUp = Math.min(100, value + 1);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.value}>Trabajos dentro de un radio de {value} km</Text>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange(nextDown)}
          style={[styles.stepButton, value === 1 ? styles.disabled : null]}
        >
          <Text style={styles.stepLabel}>-</Text>
        </Pressable>
        <View style={styles.currentValue}>
          <Text style={styles.currentValueLabel}>{value} km</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange(nextUp)}
          style={[styles.stepButton, value === 100 ? styles.disabled : null]}
        >
          <Text style={styles.stepLabel}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
  },
  disabled: {
    opacity: 0.5,
  },
  stepLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  currentValue: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  currentValueLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accent,
  },
});
