import type { AvailabilityStatus } from '@casaticket/types';

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getAvailabilityLabel, PROFESSIONAL_AVAILABILITY_STATUSES } from '@casaticket/domain';

import { colors } from '@/components/ui/theme';

interface AvailabilitySelectorProps {
  onChange: (value: AvailabilityStatus) => void;
  value: AvailabilityStatus;
}

export function AvailabilitySelector({ onChange, value }: AvailabilitySelectorProps) {
  return (
    <View style={styles.wrapper}>
      {PROFESSIONAL_AVAILABILITY_STATUSES.map((status) => {
        const selected = status === value;

        return (
          <Pressable
            key={status}
            onPress={() => onChange(status)}
            style={[styles.item, selected ? styles.itemSelected : null]}
          >
            <Text style={[styles.label, selected ? styles.labelSelected : null]}>
              {getAvailabilityLabel(status)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 10,
  },
  item: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  itemSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  label: {
    fontSize: 15,
    color: colors.text,
  },
  labelSelected: {
    fontWeight: '700',
    color: colors.accent,
  },
});
