import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { colors } from '@/components/ui/theme';

type TabIconName = ComponentProps<typeof Ionicons>['name'];

export const sharedTabScreenOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.accent,
  tabBarInactiveTintColor: '#8c929b',
  tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const, marginTop: 2 },
  tabBarStyle: {
    height: 72,
    paddingBottom: 9,
    paddingTop: 8,
    borderTopColor: '#e7dfd3',
    backgroundColor: colors.surfaceStrong,
  },
};

export function createTabIcon(outlineName: TabIconName, focusedName: TabIconName) {
  return function TabIcon({ color, focused, size }: { color: string; focused: boolean; size: number }) {
    return <Ionicons color={color} name={focused ? focusedName : outlineName} size={size} />;
  };
}
