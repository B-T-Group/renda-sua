import { memo, useCallback, useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useImageFallback } from '../../hooks/useImageFallback';
import type {
  ItemVariant,
  InventoryVariantPriceOverride,
} from '../../types/business/itemVariant';
import {
  effectiveVariantUnitPrice,
  primaryVariantImageUrl,
  unitPriceWithListingDeal,
} from '../../types/business/itemVariant';
import { formatCatalogMoney } from '../../utils/catalogInventoryDisplay';

export interface DetailVariantCarouselProps {
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
  /** Hide unit prices (interest-only / price-on-request listings). */
  hidePrices?: boolean;
}

function OptionThumb({ uri }: { uri: string | null }) {
  const { colors } = useTheme();
  const image = useImageFallback(uri);

  if (!image.hasImage || !image.sourceUri) {
    return (
      <View
        style={[
          styles.thumbPlaceholder,
          { backgroundColor: colors.pageBackground },
        ]}
      >
        <MaterialCommunityIcons
          name="image-off-outline"
          size={22}
          color={colors.text.disabled}
        />
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

/**
 * Amazon-style horizontal variant strip for the item detail page:
 * “Option: Name” label + image thumbs with a thick selected border.
 */
function DetailVariantCarouselInner({
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
  hidePrices,
}: DetailVariantCarouselProps) {
  const { t } = useTranslation();
  const { colors, typography, spacing, borderRadius } = useTheme();

  const selected = useMemo(
    () => variants.find((v) => v.id === value) ?? null,
    [variants, value]
  );

  const handleSelect = useCallback(
    (id: string) => {
      if (disabled) return;
      onChange(id);
    },
    [disabled, onChange]
  );

  if (variants.length === 0) return null;

  return (
    <View style={{ marginTop: spacing.md }} accessibilityRole="radiogroup">
      <Text style={[typography.body2, { color: colors.text.primary }]}>
        {t('public.items.detail.optionLabel', 'Option')}:{' '}
        <Text style={{ fontWeight: '700' }}>
          {selected?.name?.trim() ||
            t('client.placeOrder.selectVariant', 'Select an option')}
        </Text>
      </Text>
      {!value ? (
        <Text
          style={[
            typography.caption,
            { color: colors.warning.dark, marginTop: spacing.xs },
          ]}
        >
          {t('client.placeOrder.selectVariant', 'Select an option')}
        </Text>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.strip, { paddingTop: spacing.sm }]}
        nestedScrollEnabled
      >
        {variants.map((variant) => {
          const isSelected = variant.id === value;
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

          return (
            <Pressable
              key={variant.id}
              onPress={() => handleSelect(variant.id)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected, disabled: !!disabled }}
              accessibilityLabel={
                hidePrices
                  ? variant.name
                  : `${variant.name}, ${formatCatalogMoney(pricing.unit, currency)}`
              }
              style={({ pressed }) => [
                styles.card,
                {
                  borderColor: isSelected
                    ? colors.primary.main
                    : colors.divider,
                  borderWidth: isSelected ? 2.5 : 1,
                  borderRadius: borderRadius.md,
                  backgroundColor: colors.surface,
                  opacity: pressed || disabled ? 0.75 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.thumbWrap,
                  {
                    borderRadius: borderRadius.sm,
                    backgroundColor: colors.pageBackground,
                  },
                ]}
              >
                <OptionThumb uri={thumbUri} />
              </View>
              <Text
                style={[
                  typography.caption,
                  {
                    color: colors.text.primary,
                    fontWeight: isSelected ? '700' : '500',
                    marginTop: 6,
                    textAlign: 'center',
                  },
                ]}
                numberOfLines={2}
              >
                {variant.name}
              </Text>
              {hidePrices ? null : (
              <Text
                style={[
                  typography.caption,
                  {
                    color: colors.primary.main,
                    fontWeight: '700',
                    marginTop: 2,
                    textAlign: 'center',
                  },
                ]}
                numberOfLines={1}
              >
                {formatCatalogMoney(pricing.unit, currency)}
              </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

export const DetailVariantCarousel = memo(DetailVariantCarouselInner);

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 8,
    paddingBottom: 4,
  },
  card: {
    width: 108,
    padding: 6,
  },
  thumbWrap: {
    width: '100%',
    height: 96,
    overflow: 'hidden',
  },
  thumb: { width: '100%', height: '100%' },
  thumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
