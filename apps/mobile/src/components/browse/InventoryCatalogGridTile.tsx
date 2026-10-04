import { memo, useCallback, useMemo } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { useImageFallback } from '../../hooks/useImageFallback';
import { StatusPill } from '../common/StatusPill';
import { StarRatingDisplay } from '../rating/StarRatingDisplay';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';
import { catalogImageDisplayUrl } from '../../utils/catalogInventoryDisplay';
import {
  catalogFromPrice,
  catalogUnitPriceForSelection,
  shopperVariantOptionCount,
} from '../../utils/buildCartLineFromCatalog';
import { bestPackSavings } from '../../types/business/itemVariant';
import { ItemLikeButton } from './ItemLikeButton';
import { resolveProductCardHint } from '../../utils/resolveProductCardHint';

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'XAF',
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export interface InventoryCatalogGridTileProps {
  item: CatalogInventoryItem;
  onPress: (inventoryItemId: string) => void;
  onLikedChange?: (itemId: string, liked: boolean) => void;
}

function InventoryCatalogGridTileInner({
  item,
  onPress,
  onLikedChange,
}: InventoryCatalogGridTileProps) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, spacing, shadows } = useTheme();
  const exportAvailable = item.item.export_available === true;

  const variantOptionCount = useMemo(
    () => shopperVariantOptionCount(item),
    [item]
  );
  const hasVariantOptions = variantOptionCount > 1;

  const parentImageUrl = useMemo(() => {
    const imgs = item.item.item_images ?? [];
    const sorted = [...imgs].sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
    );
    return catalogImageDisplayUrl(sorted[0]) ?? null;
  }, [item]);

  const mainImage = useImageFallback(parentImageUrl);

  const hasDeal =
    item.hasActiveDeal &&
    typeof item.original_price === 'number' &&
    typeof item.discounted_price === 'number' &&
    item.original_price > item.discounted_price;

  const unitPrice = catalogUnitPriceForSelection(item, null);
  const fromPrice = useMemo(
    () => (hasVariantOptions ? catalogFromPrice(item) : unitPrice),
    [hasVariantOptions, item, unitPrice]
  );
  const currency = item.item.currency || 'XAF';
  const packSavings = useMemo(
    () =>
      bestPackSavings({
        variants: item.item.item_variants,
        listingSellingPrice: item.selling_price,
        overrides: item.variant_price_overrides,
        hasActiveDeal: item.hasActiveDeal,
        originalPrice: item.original_price,
        discountedPrice: item.discounted_price,
      }),
    [item]
  );

  const dealPercent = useMemo(() => {
    if (!hasDeal || !item.original_price) return 0;
    const disc = item.discounted_price ?? 0;
    if (item.original_price <= 0) return 0;
    return Math.max(0, Math.round((1 - disc / item.original_price) * 100));
  }, [hasDeal, item.discounted_price, item.original_price]);

  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={t(
        'public.items.card.openDetails',
        'Open {{name}} details',
        { name: item.item.name }
      )}
      style={({ pressed }) => [
        styles.tile,
        shadows.sm,
        {
          borderRadius: borderRadius.md,
          backgroundColor: colors.surface,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.imageContainer,
          { backgroundColor: colors.pageBackground, borderRadius: borderRadius.md },
        ]}
      >
        <View style={styles.likeOverlay} pointerEvents="box-none">
          <ItemLikeButton
            itemId={item.item_id || item.item?.id}
            initiallyLiked={item.liked === true}
            onLikedChange={(liked) =>
              onLikedChange?.(item.item_id || item.item?.id, liked)
            }
          />
        </View>
        {mainImage.hasImage && mainImage.sourceUri ? (
          <Image
            source={{ uri: mainImage.sourceUri }}
            style={styles.image}
            resizeMode="cover"
            onError={mainImage.onImageError}
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Text
              style={[typography.caption, { color: colors.text.disabled }]}
            >
              {t('public.items.noImage', 'Photo')}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.content, { padding: spacing.xs }]}>
        <Text
          style={[typography.body2, { color: colors.text.primary }]}
          numberOfLines={2}
        >
          {item.item.name}
        </Text>

        {exportAvailable ? (
          <Text
            style={[
              typography.caption,
              { color: colors.text.secondary, fontWeight: '600', marginTop: 2 },
            ]}
          >
            {t('productInterest.priceNotApplicable', 'Price on request')}
          </Text>
        ) : (
          <Text
            style={[
              typography.subtitle2,
              { color: colors.primary.main, fontWeight: '700', marginTop: 2 },
            ]}
          >
            {hasVariantOptions
              ? t('public.items.card.fromPrice', 'From {{price}}', {
                  price: formatMoney(fromPrice, currency),
                })
              : formatMoney(unitPrice, currency)}
          </Text>
        )}

        <ProductHint item={item} hasDeal={Boolean(hasDeal)} />

        {packSavings && !exportAvailable ? (
          <Text
            style={[
              typography.caption,
              { color: colors.success.dark, fontWeight: '700', marginTop: 2 },
            ]}
            numberOfLines={2}
          >
            {t('client.placeOrder.saveOnPack', 'Save {{pct}}% by buying a pack of {{count}} units', {
              pct: packSavings.pct,
              count: packSavings.count,
            })}
          </Text>
        ) : null}

        {!exportAvailable && hasDeal && dealPercent > 0 ? (
          <StatusPill
            label={`-${dealPercent}%`}
            backgroundColor={colors.error.light + '30'}
            textColor={colors.error.main}
            icon="tag"
            compact
            style={{ marginTop: spacing.xs }}
          />
        ) : null}

        {typeof item.avg_rating === 'number' && (item.rating_count ?? 0) > 0 ? (
          <StarRatingDisplay
            average={item.avg_rating}
            count={item.rating_count}
            size={12}
            style={{ marginTop: spacing.xs }}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

function ProductHint({ item, hasDeal }: { item: CatalogInventoryItem; hasDeal: boolean }) {
  const { t } = useTranslation();
  const { colors, typography } = useTheme();
  const hint = resolveProductCardHint({
    quantity: item.computed_available_quantity,
    isFood: Boolean(item.food_availability),
    foodOpen: item.food_availability?.is_available_now,
    hasDeal,
  });
  if (!hint) return null;
  const label =
    hint.id === 'low_stock'
      ? t('client.card.onlyLeft', 'Only {{count}} left', { count: hint.count })
      : hint.id === 'check_availability'
        ? t('client.card.checkAvailability', 'Check availability')
        : hint.id === 'food_closed'
          ? t('client.card.kitchenClosed', 'Kitchen closed')
          : hint.id === 'food_open'
            ? t('client.card.orderNow', 'Order now')
            : hint.id === 'deal'
              ? t('client.card.deal', 'Deal')
              : hint.label;
  return (
    <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 2 }]} numberOfLines={1}>
      {label}
    </Text>
  );
}

export const InventoryCatalogGridTile = memo(InventoryCatalogGridTileInner);

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  likeOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 3,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    minWidth: 0,
  },
});
