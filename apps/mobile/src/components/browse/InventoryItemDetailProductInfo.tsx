import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';

export interface InventoryItemDetailProductInfoProps {
  description?: string | null;
  category?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  availableQuantity?: number | null;
}

const DESCRIPTION_COLLAPSE_CHARS = 160;

export function InventoryItemDetailProductInfo({
  description,
  category,
  subcategory,
  brand,
  availableQuantity,
}: InventoryItemDetailProductInfoProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const desc = description?.trim() ?? '';
  const specs = useMemo(() => {
    const rows: Array<{ label: string; value: string }> = [];
    if (category?.trim()) {
      rows.push({ label: t('items.category', 'Category'), value: category.trim() });
    }
    if (subcategory?.trim()) {
      rows.push({
        label: t('items.subcategory', 'Subcategory'),
        value: subcategory.trim(),
      });
    }
    if (brand?.trim()) {
      rows.push({ label: t('items.brand', 'Brand'), value: brand.trim() });
    }
    if (availableQuantity != null && Number.isFinite(availableQuantity)) {
      rows.push({
        label: t('public.items.detail.stockLabel', 'Available'),
        value: String(availableQuantity),
      });
    }
    return rows;
  }, [availableQuantity, brand, category, subcategory, t]);

  if (!desc && specs.length === 0) return null;

  const needsCollapse = desc.length > DESCRIPTION_COLLAPSE_CHARS;
  const shownDesc =
    !needsCollapse || expanded ? desc : `${desc.slice(0, DESCRIPTION_COLLAPSE_CHARS).trimEnd()}…`;

  return (
    <View
      style={[
        styles.card,
        {
          marginTop: spacing.lg,
          padding: spacing.md,
          borderRadius: borderRadius.lg,
          backgroundColor: colors.surface,
          borderColor: colors.divider,
        },
      ]}
    >
      <Text style={[typography.subtitle1, { color: colors.text.primary, fontWeight: '700' }]}>
        {t('items.productInformation', 'Product information')}
      </Text>

      {desc ? (
        <View style={{ marginTop: spacing.sm }}>
          <Text
            style={[typography.body2, { color: colors.text.primary, lineHeight: 20 }]}
          >
            {shownDesc}
          </Text>
          {needsCollapse ? (
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={
                expanded
                  ? t('common.showLess', 'Show less')
                  : t('common.showMore', 'Show more')
              }
              hitSlop={8}
              style={{ marginTop: 4, alignSelf: 'flex-start' }}
            >
              <Text style={[typography.caption, { color: colors.primary.main, fontWeight: '700' }]}>
                {expanded
                  ? t('common.showLess', 'Show less')
                  : t('common.showMore', 'Show more')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {specs.length > 0 ? (
        <View
          style={[
            styles.specGrid,
            {
              marginTop: desc ? spacing.md : spacing.sm,
              backgroundColor: colors.pageBackground,
              borderRadius: borderRadius.md,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
            },
          ]}
        >
          {specs.map((spec, index) => (
            <View
              key={spec.label}
              style={[
                styles.specCell,
                index % 2 === 0 ? styles.specCellLeft : styles.specCellRight,
                index < specs.length - (specs.length % 2 === 0 ? 2 : 1)
                  ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider }
                  : null,
              ]}
            >
              <Text
                style={[typography.caption, { color: colors.text.secondary }]}
                numberOfLines={1}
              >
                {spec.label}
              </Text>
              <Text
                style={[
                  typography.body2,
                  { color: colors.text.primary, fontWeight: '600', marginTop: 2 },
                ]}
                numberOfLines={2}
              >
                {spec.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  specGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specCell: {
    width: '50%',
    paddingVertical: 10,
    paddingHorizontal: 4,
    minWidth: 0,
  },
  specCellLeft: { paddingRight: 8 },
  specCellRight: { paddingLeft: 8 },
});
