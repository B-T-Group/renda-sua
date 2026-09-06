import { memo, useCallback } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useImageFallback } from '../../hooks/useImageFallback';
import type { ItemVariant, InventoryVariantPriceOverride } from '../../types/business/itemVariant';
import {
  effectiveVariantUnitPrice,
  primaryVariantImageUrl,
  unitPriceWithListingDeal,
} from '../../types/business/itemVariant';
import { formatCatalogMoney } from '../../utils/catalogInventoryDisplay';

export interface VariantOptionPickerProps {
  variants: ItemVariant[];
  value: string | null;
  onChange: (variantId: string) => void;
  listingSellingPrice: number;
  priceOverrides?: InventoryVariantPriceOverride[] | null;
  hasActiveDeal?: boolean;
  originalPrice?: number;
  discountedPrice?: number;
  currency: string;
  disabled?: boolean;
  /** Hide the in-picker title when a parent dialog already shows one. */
  hideHeading?: boolean;
  /** Cap scroll height so many options scroll inside modals/screens. */
  maxHeight?: number;
}

function OptionThumb({ uri }: { uri: string | null }) {
  const { colors } = useTheme();
  const image = useImageFallback(uri);

  if (!image.hasImage || !image.sourceUri) {
    return (
      <View style={[styles.thumbPlaceholder, { backgroundColor: colors.pageBackground }]}>
        <MaterialCommunityIcons name="image-off-outline" size={22} color={colors.text.disabled} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: image.sourceUri }}
      style={styles.thumb}
      resizeMode="cover"
      onError={image.onImageError}
    />
  );
}

function VariantOptionPickerInner({
  variants,
  value,
  onChange,
  listingSellingPrice,
  priceOverrides,
  hasActiveDeal,
  originalPrice,
  discountedPrice,
  currency,
  disabled,
  hideHeading,
  maxHeight,
}: VariantOptionPickerProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();

  const handleSelect = useCallback(
    (id: string) => {
      if (disabled) return;
      onChange(id);
    },
    [disabled, onChange]
  );

  if (variants.length === 0) return null;

  return (
    <View style={{ marginTop: hideHeading ? 0 : spacing.md }} accessibilityRole="radiogroup">
      {!hideHeading ? (
        <Text variant="titleSmall" style={{ marginBottom: spacing.xs }}>
          {t('client.placeOrder.chooseOption', 'Choose an option')}
        </Text>
      ) : null}
      {!value ? (
        <Text
          style={[
            typography.caption,
            { color: colors.warning.dark, marginBottom: spacing.sm },
          ]}
        >
          {t('client.placeOrder.selectVariant', 'Select an option')}
        </Text>
      ) : null}
      <ScrollView
        style={maxHeight != null ? { maxHeight } : undefined}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={variants.length > 4}
        nestedScrollEnabled
      >
        {variants.map((variant) => {
          const selected = variant.id === value;
          const override = priceOverrides?.find(
            (row) => row.item_variant_id === variant.id
          );
          const base = effectiveVariantUnitPrice(
            variant,
            listingSellingPrice,
            override
          );
          const pricing = unitPriceWithListingDeal(
            base,
            listingSellingPrice,
            hasActiveDeal,
            originalPrice,
            discountedPrice
          );
          const thumbUri = primaryVariantImageUrl(variant);
          const colorHint = variant.color?.trim();

          return (
            <Pressable
              key={variant.id}
              onPress={() => handleSelect(variant.id)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: !!disabled }}
              accessibilityLabel={`${variant.name}, ${formatCatalogMoney(pricing.unit, currency)}`}
              style={({ pressed }) => [
                styles.card,
                {
                  borderColor: selected ? colors.primary.main : colors.divider,
                  backgroundColor: selected
                    ? colors.primary.light + '22'
                    : colors.surface,
                  borderRadius: borderRadius.md,
                  opacity: pressed || disabled ? 0.72 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.thumbWrap,
                  { borderRadius: borderRadius.sm, backgroundColor: colors.pageBackground },
                ]}
              >
                <OptionThumb uri={thumbUri} />
                {selected ? (
                  <View style={[styles.checkBadge, { backgroundColor: colors.primary.main }]}>
                    <MaterialCommunityIcons name="check" size={14} color={colors.primary.contrast} />
                  </View>
                ) : null}
              </View>
              <Text
                style={[typography.caption, { color: colors.text.primary, fontWeight: '700' }]}
                numberOfLines={2}
              >
                {variant.name}
              </Text>
              {colorHint && colorHint !== variant.name ? (
                <Text
                  style={[typography.caption, { color: colors.text.secondary }]}
                  numberOfLines={1}
                >
                  {colorHint}
                </Text>
              ) : null}
              <Text
                style={[typography.caption, { color: colors.primary.main, fontWeight: '700' }]}
                numberOfLines={1}
              >
                {formatCatalogMoney(pricing.unit, currency)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export const VariantOptionPicker = memo(VariantOptionPickerInner);

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 4,
  },
  card: {
    width: 124,
    borderWidth: 2,
    padding: 8,
    gap: 6,
  },
  thumbWrap: {
    width: '100%',
    height: 96,
    overflow: 'hidden',
    position: 'relative',
  },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
