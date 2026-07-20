import type { ComponentProps } from 'react';

import { StyleSheet, TextInput as NativeTextInput } from 'react-native';

import { colors } from '@/components/ui/theme';

type TextInputProps = ComponentProps<typeof NativeTextInput>;

export function TextInput(props: TextInputProps) {
  return (
    <NativeTextInput
      placeholderTextColor="#8d7f6c"
      style={[styles.input, props.multiline ? styles.multiline : null, props.style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  multiline: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
});
