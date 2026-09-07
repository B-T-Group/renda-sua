import { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import type { CatalogFilterState } from '../../types/catalogFilter';

type Field = keyof CatalogFilterState;

export interface CatalogBrowseActiveFilterChipsProps {
  values: CatalogFilterState;
  onClearField: (field: Field) => void;
  onClearAll: () => void;
}

export const CatalogBrowseActiveFilterChips = memo(function CatalogBrowseActiveFilterChips({
  values,
  onClearField,
  onClearAll,
}: CatalogBrowseActiveFilterChipsProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  const entries = useMemo(() => {
    const out: { field: Field; label: string }[] = [];
    if (values.category) {
      out.push({
        field: 'category',
        label: `${t('public.items.filters.category', 'Category')}: ${values.category}`,
      });
    }
    if (values.subcategory) {
      out.push({
        field: 'subcategory',
        label: `${t('public.items.filters.subcategory', 'Subcategory')}: ${values.subcategory}`,
      });
    }
    if (values.brand) {
      out.push({ field: 'brand', label: `${t('public.items.filters.brand', 'Brand')}: ${values.brand}` });
    }
    if (values.business) {
      out.push({
        field: 'business',
        label: `${t('public.items.filters.business', 'Business')}: ${values.business}`,
      });
    }
    if (values.collection) {
      out.push({
        field: 'collection',
        label: `${t('collections.filter', 'Collection')}: ${values.collection}`,
      });
    }
    return out;
  }, [values.brand, values.category, values.business, values.collection, values.subcategory, t]);

  if (entries.length === 0) return null;

  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text variant="labelLarge" style={{ color: colors.text.secondary, marginBottom: spacing.xs }}>
        {t('public.items.activeFiltersLabel', 'Active filters')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {entries.map((e) => {
          const label = e.label.length > 36 ? `${e.label.slice(0, 34)}…` : e.label;
          return (
            <View key={e.field} style={[styles.activeChip, { backgroundColor: colors.primaryTint, borderColor: colors.primary.main + '60' }]}>
              <Text style={[styles.activeChipLabel, { color: colors.primary.dark }]} numberOfLines={1}>
                {label}
              </Text>
              <Pressable
                onPress={() => onClearField(e.field)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${t('common.remove', 'Remove')} ${e.label}`}
              >
                <MaterialCommunityIcons name="close-circle" size={15} color={colors.primary.main} />
              </Pressable>
            </View>
          );
        })}
        <Pressable
          onPress={onClearAll}
          style={[styles.clearChip, { backgroundColor: colors.pageBackground, borderColor: colors.divider }]}
          accessibilityRole="button"
          accessibilityLabel={t('public.items.filters.clear', 'Clear filters')}
        >
          <Text style={[styles.clearChipLabel, { color: colors.text.secondary }]}>
            {t('public.items.filters.clear', 'Clear filters')}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'nowrap', gap: 8, alignItems: 'center', paddingVertical: 2 },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
    minHeight: 32,
  },
  activeChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    includeFontPadding: false,
    maxWidth: 160,
  },
  clearChip: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minHeight: 32,
    justifyContent: 'center',
  },
  clearChipLabel: {
    fontSize: 13,
    fontWeight: '500',
    includeFontPadding: false,
  },
});
