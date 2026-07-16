import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/components/ui/theme';

interface RoleCardProps {
  description: string;
  onPress: () => void;
  selected: boolean;
  title: string;
}

export function RoleCard({ description, onPress, selected, title }: RoleCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.card, selected ? styles.selected : null]}
    >
      <View style={styles.dotWrapper}>
        <View style={[styles.dot, selected ? styles.dotSelected : null]} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
  },
  selected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  dotWrapper: {
    paddingTop: 4,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#ffffff',
  },
  dotSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
  },
});
