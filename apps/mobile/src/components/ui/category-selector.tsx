import type { Category } from '@casaticket/types';

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { colors } from '@/components/ui/theme';

interface CategorySelectorProps {
  categories: Category[];
  error?: string | undefined;
  loading?: boolean | undefined;
  onRetry?: (() => void) | undefined;
  onToggle: (categoryId: string) => void;
  selectedIds: string[];
}

export function CategorySelector({
  categories,
  error,
  loading = false,
  onRetry,
  onToggle,
  selectedIds,
}: CategorySelectorProps) {
  if (loading) {
    return <LoadingState message="Cargando rubros disponibles…" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} title="No pudimos cargar las categorías" />;
  }

  if (categories.length === 0) {
    return (
      <ErrorState
        actionLabel="Reintentar"
        message="Todavía no hay categorías activas para mostrar."
        onRetry={onRetry}
        title="Sin categorías disponibles"
      />
    );
  }

  return (
    <View style={styles.grid}>
      {categories.map((category) => {
        const selected = selectedIds.includes(category.id);

        return (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            key={category.id}
            onPress={() => onToggle(category.id)}
            style={[styles.item, selected ? styles.itemSelected : null]}
          >
            <View style={styles.itemCopy}>
              <Text style={[styles.label, selected ? styles.labelSelected : null]}>{category.name}</Text>
              {category.description ? (
                <Text numberOfLines={2} style={styles.description}>{category.description}</Text>
              ) : null}
            </View>
            <View style={[styles.check, selected ? styles.checkSelected : null]}>
              {selected ? <Ionicons color="#ffffff" name="checkmark" size={16} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 10,
  },
  item: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  labelSelected: {
    color: colors.accent,
  },
  itemCopy: {
    flex: 1,
    gap: 3,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
  check: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
  },
  checkSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
});
