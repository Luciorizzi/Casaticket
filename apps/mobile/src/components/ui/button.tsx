import type { PropsWithChildren } from 'react';

import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/components/ui/theme';

interface ButtonProps extends PropsWithChildren {
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}

export function Button({
  children,
  disabled = false,
  loading = false,
  onPress,
  variant = 'primary',
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        isDisabled ? styles.disabled : null,
        pressed && !isDisabled ? styles.pressed : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#ffffff' : colors.text} />
      ) : (
        <Text style={[styles.label, labelStyles[variant]]}>{children}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    transform: [{ scale: 0.99 }],
  },
});

const variantStyles = StyleSheet.create({
  primary: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  secondary: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
  },
  ghost: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  danger: {
    borderColor: colors.danger,
    backgroundColor: colors.danger,
  },
});

const labelStyles = StyleSheet.create({
  primary: {
    color: '#ffffff',
  },
  secondary: {
    color: colors.text,
  },
  ghost: {
    color: colors.accent,
  },
  danger: {
    color: '#ffffff',
  },
});
