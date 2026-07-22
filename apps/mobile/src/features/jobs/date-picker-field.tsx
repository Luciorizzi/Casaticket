import { useMemo, useState } from 'react';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { colors } from '@/components/ui/theme';

interface DatePickerFieldProps {
  allowClear?: boolean;
  disablePast?: boolean;
  onChange: (value: string | null) => void;
  placeholder?: string;
  value: string | null;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function fromDateString(value: string | null): Date {
  if (!value) {
    return new Date();
  }

  const [year = new Date().getFullYear(), month = 1, day = 1] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value: string | null, placeholder: string): string {
  if (!value) {
    return placeholder;
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(fromDateString(value));
}

export function DatePickerField({
  allowClear = false,
  disablePast = false,
  onChange,
  placeholder = 'Seleccionar fecha',
  value,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const minimumDate = useMemo(() => (disablePast ? fromDateString(todayDateString()) : undefined), [
    disablePast,
  ]);
  const selectedDate = useMemo(() => fromDateString(value), [value]);

  const handleChange = (event: DateTimePickerEvent, nextDate?: Date) => {
    if (Platform.OS === 'android') {
      setOpen(false);
    }

    if (event.type === 'dismissed' || !nextDate) {
      return;
    }

    onChange(toDateString(nextDate));
  };

  return (
    <View style={styles.stack}>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={styles.trigger}
      >
        <Text style={value ? styles.value : styles.placeholder}>📅 {formatDate(value, placeholder)}</Text>
      </Pressable>
      {allowClear && value ? (
        <Button onPress={() => onChange(null)} variant="secondary">
          Limpiar fecha
        </Button>
      ) : null}
      {open ? (
        <DateTimePicker
          {...(minimumDate ? { minimumDate } : {})}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          locale="es-AR"
          mode="date"
          onChange={handleChange}
          value={selectedDate}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 8,
  },
  trigger: {
    minHeight: 52,
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  value: {
    color: colors.text,
    fontSize: 16,
  },
  placeholder: {
    color: '#8d7f6c',
    fontSize: 16,
  },
});

export const datePickerTestUtils = {
  formatDate,
  toDateString,
};
