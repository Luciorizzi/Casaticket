import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/components/ui/theme';
import { formatLocation } from '@/features/location/location';

export function LocationSummary({ city, province }: { city?: string | null; province?: string | null }) {
  return <View style={styles.row}><Ionicons color={colors.accent} name="location-outline" size={17} /><Text style={styles.text}>{formatLocation(city, province)}</Text></View>;
}

const styles = StyleSheet.create({ row: { alignItems: 'center', flexDirection: 'row', gap: 5 }, text: { color: colors.text, flexShrink: 1, fontSize: 14, lineHeight: 20 } });
