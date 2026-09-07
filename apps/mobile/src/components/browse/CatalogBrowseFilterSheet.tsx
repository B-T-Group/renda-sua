import { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppModal } from '../common/AppModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Divider, IconButton, RadioButton, Text } from 'react-native-paper';
import { CATALOG_SORT_OPTIONS } from '../../constants/catalogSortOptions';
import { useTheme } from '../../contexts/ThemeContext';
import type { CatalogFilterState } from '../../types/catalogFilter';
import type { InventorySortMode } from '../../types/inventoryCatalog';

const ALL = '__all__';

function toRadio(v: string) {
  return v === '' ? ALL : v;
}

function fromRadio(v: string) {
  return v === ALL ? '' : v;
}

export interface CatalogBrowseFilterSheetProps {
  visible: boolean;
  onDismiss: () => void;
  sort: InventorySortMode;
  onSortChange: (mode: InventorySortMode) => void;
  values: CatalogFilterState;
  onChange: (next: CatalogFilterState) => void;
  categories: string[];
  subcategories: string[];
  brands: string[];
  businesses: string[];
  collectionOptions: Array<{ slug: string; name: string }>;
  disabled?: boolean;
  /** Hide retail-only filters (category, collections, deals) on the Food tab. */
  foodOnly?: boolean;
}

function RadioBlock({
  title,
  options,
  value,
  onSelect,
  disabled,
}: {
  title: string;
  options: string[];
  value: string;
  onSelect: (v: string) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const allLabel = t('public.items.filters.all', 'All');
  const radioVal = toRadio(value);

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text variant="titleSmall" style={{ color: colors.text.primary, marginBottom: spacing.xs }}>
        {title}
      </Text>
      <RadioButton.Group
        onValueChange={(v) => onSelect(fromRadio(v))}
        value={radioVal}
      >
        <RadioButton.Item label={allLabel} value={ALL} disabled={disabled} />
        {options.map((opt) => (
          <RadioButton.Item key={opt} label={opt} value={opt} disabled={disabled} />
        ))}
      </RadioButton.Group>
    </View>
  );
}

export function CatalogBrowseFilterSheet({
  visible,
  onDismiss,
  sort,
  onSortChange,
  values,
  onChange,
  categories,
  subcategories,
  brands,
  businesses,
  collectionOptions,
  disabled,
  foodOnly = false,
}: CatalogBrowseFilterSheetProps) {
  const { t } = useTranslation();
  const { colors, borderRadius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const maxH = Math.min(winH * 0.88, 720);

  const setField = useCallback(
    (field: keyof CatalogFilterState, v: string) => {
      if (field === 'category') {
        onChange({ ...values, category: v, subcategory: '' });
        return;
      }
      onChange({ ...values, [field]: v });
    },
    [onChange, values]
  );

  const clearAll = useCallback(() => {
    onChange({ category: '', subcategory: '', brand: '', business: '', collection: '' });
  }, [onChange]);

  const hasFilters = useMemo(
    () =>
      Boolean(
        values.category ||
          values.subcategory ||
          values.brand ||
          values.business ||
          values.collection
      ),
    [values.brand, values.category, values.business, values.collection, values.subcategory]
  );

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdropFill} onPress={onDismiss} accessibilityRole="button" />
        <View
          style={[
            styles.sheet,
            {
              maxHeight: maxH,
              paddingBottom: insets.bottom + spacing.md,
              backgroundColor: colors.surface,
              borderTopLeftRadius: borderRadius.lg,
              borderTopRightRadius: borderRadius.lg,
            },
          ]}
        >
        <View style={[styles.sheetHeader, { paddingHorizontal: spacing.md, paddingTop: spacing.sm }]}>
          <Text variant="titleMedium" style={{ color: colors.text.primary, flex: 1 }}>
            {t('public.items.filterSheetTitle', 'Filters & sort')}
          </Text>
          <IconButton icon="close" onPress={onDismiss} accessibilityLabel={t('common.cancel', 'Close')} />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}
        >
          <Text variant="labelLarge" style={{ color: colors.text.secondary, marginBottom: spacing.xs }}>
            {t('public.items.sortLabel', 'Sort')}
          </Text>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {(foodOnly
              ? CATALOG_SORT_OPTIONS.filter((o) => o.key !== 'deals')
              : CATALOG_SORT_OPTIONS
            ).map((o) => (
              <Chip
                key={o.key}
                selected={sort === o.key}
                onPress={() => onSortChange(o.key)}
                style={{ marginRight: spacing.xs }}
                mode={sort === o.key ? 'flat' : 'outlined'}
              >
                {t(o.labelKey, o.labelDefault)}
              </Chip>
            ))}
          </ScrollView>
          <Divider style={{ marginVertical: spacing.md }} />
          {foodOnly ? null : (
            <RadioBlock
              title={t('public.items.filters.category', 'Category')}
              options={categories}
              value={values.category}
              onSelect={(v) => setField('category', v)}
              disabled={disabled}
            />
          )}
          <RadioBlock
            title={
              foodOnly
                ? t('foods.filters.dishType', 'Dish type')
                : t('public.items.filters.subcategory', 'Subcategory')
            }
            options={subcategories}
            value={values.subcategory}
            onSelect={(v) => setField('subcategory', v)}
            disabled={disabled}
          />
          <RadioBlock
            title={t('public.items.filters.brand', 'Brand')}
            options={brands}
            value={values.brand}
            onSelect={(v) => setField('brand', v)}
            disabled={disabled}
          />
          <RadioBlock
            title={t('public.items.filters.business', 'Business')}
            options={businesses}
            value={values.business}
            onSelect={(v) => setField('business', v)}
            disabled={disabled}
          />
          {!foodOnly && collectionOptions.length > 0 ? (
            <View style={{ marginBottom: spacing.md }}>
              <Text variant="titleSmall" style={{ color: colors.text.primary, marginBottom: spacing.xs }}>
                {t('collections.filter', 'Collection')}
              </Text>
              <RadioButton.Group
                onValueChange={(v) => setField('collection', fromRadio(v))}
                value={toRadio(values.collection)}
              >
                <RadioButton.Item label={t('public.items.filters.all', 'All')} value={ALL} disabled={disabled} />
                {collectionOptions.map((c) => (
                  <RadioButton.Item
                    key={c.slug}
                    label={c.name}
                    value={c.slug}
                    disabled={disabled}
                  />
                ))}
              </RadioButton.Group>
            </View>
          ) : null}
          <View style={styles.footerBtns}>
            {hasFilters ? (
              <Button mode="text" onPress={clearAll} compact>
                {t('public.items.filters.clear', 'Clear filters')}
              </Button>
            ) : null}
            <Button mode="contained" onPress={onDismiss} style={{ flex: 1, minWidth: 120 }}>
              {t('common.done', 'Done')}
            </Button>
          </View>
        </ScrollView>
        </View>
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdropFill: { flex: 1 },
  sheet: {
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipsRow: { flexDirection: 'row', paddingVertical: 4 },
  footerBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 16 },
});
