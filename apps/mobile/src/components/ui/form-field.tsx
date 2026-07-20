import type { PropsWithChildren, ReactNode } from 'react';

import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/components/ui/theme';

interface FormFieldProps extends PropsWithChildren {
  error?: string | undefined;
  hint?: string | undefined;
  label: string;
  rightAdornment?: ReactNode | undefined;
}

export function FormField({ children, error, hint, label, rightAdornment }: FormFieldProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {rightAdornment}
      </View>
      {children}
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
  },
});
