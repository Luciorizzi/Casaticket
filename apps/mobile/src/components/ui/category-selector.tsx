import type { Category } from '@casaticket/types';

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
            key={category.id}
            onPress={() => onToggle(category.id)}
            style={[styles.item, selected ? styles.itemSelected : null]}
          >
            <Text style={[styles.label, selected ? styles.labelSelected : null]}>{category.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  item: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
});
