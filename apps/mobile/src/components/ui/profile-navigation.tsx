import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { ComponentProps, PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { colors } from '@/components/ui/theme';

export function ProfileMenuRow({ description, icon, label, path }: {
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  path: string;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(path as Href)} style={profileNavigationStyles.menuRow}>
      <View style={profileNavigationStyles.menuIcon}><Ionicons color={colors.accent} name={icon} size={22} /></View>
      <View style={profileNavigationStyles.menuCopy}>
        <Text style={profileNavigationStyles.menuLabel}>{label}</Text>
        <Text numberOfLines={2} style={profileNavigationStyles.menuDescription}>{description}</Text>
      </View>
      <Ionicons color="#9a8b79" name="chevron-forward" size={20} />
    </Pressable>
  );
}

export function ProfileSectionScreen({ children, subtitle, title }: PropsWithChildren<{ subtitle: string; title: string }>) {
  return (
    <Screen subtitle={subtitle} title={title}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={profileNavigationStyles.backButton}>
        <Ionicons color={colors.accent} name="arrow-back" size={20} />
        <Text style={profileNavigationStyles.backLabel}>Volver</Text>
      </Pressable>
      {children}
    </Screen>
  );
}

export const profileNavigationStyles = StyleSheet.create({
  backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  backLabel: { fontSize: 15, fontWeight: '700', color: colors.accent },
  menuCopy: { flex: 1, gap: 3 },
  menuDescription: { fontSize: 13, lineHeight: 18, color: colors.muted },
  menuIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.accentSoft },
  menuLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  menuRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceStrong, padding: 14 },
});
