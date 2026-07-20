import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/components/ui/theme';

interface AvatarProps {
  name: string;
  size?: number;
}

export function Avatar({ name, size = 56 }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((part) => part.trim().slice(0, 1))
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.initials}>{initials || 'CT'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  initials: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accent,
  },
});
