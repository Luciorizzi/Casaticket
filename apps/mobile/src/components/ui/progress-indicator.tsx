import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/components/ui/theme';

interface ProgressIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressIndicator({ currentStep, totalSteps }: ProgressIndicatorProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>
        Paso {currentStep} de {totalSteps}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(currentStep / totalSteps) * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#eadbc7',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
});
