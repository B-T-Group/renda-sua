import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Card, Divider, IconButton, Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useImageFallback } from '../../hooks/useImageFallback';
import { StatusPill } from '../common/StatusPill';
import { StarRatingDisplay } from '../rating/StarRatingDisplay';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';
import {
  catalogGalleryForSelection,
  catalogImageDisplayUrl,
} from '../../utils/catalogInventoryDisplay';
import {
  catalogFromPrice,
  catalogUnitPriceForSelection,
  shopperVariantOptionCount,
} from '../../utils/buildCartLineFromCatalog';
import {
  isOpeningSoonMerchant,
  merchantCanAcceptOrders,
} from '../../utils/merchantLifecycle';
import {
  SHOPPER_BASE_VARIANT_ID,
  shopperVariantOptions,
} from '../../utils/shopperVariantSelection';
import { CatalogOptionChips } from './CatalogOptionChips';
import { ItemLikeButton } from './ItemLikeButton';
import { FoodAvailabilityChip } from '../food/FoodAvailabilityChip';
import { LOW_STOCK_THRESHOLD } from '../../constants/stock';
import { isFoodOrderBlocked } from '../../utils/foodAvailability';

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

export interface InventoryCatalogCardProps {
  item: CatalogInventoryItem;
  /** Called with the card's current shopper selection (`__base__` / variant id / null). */
  onPrimaryPress: (selectionId: string | null) => void;
  primaryLabel: string;
  onItemPress?: (inventoryItemId: string) => void;
  onAddToCart?: (selectionId: string | null) => void;
  /** Total quantity already in cart for this listing (any variant). */
  inCartQuantity?: number;
  /** When provided, logo and business line become tappable and navigate to the store. */
  onStorePress?: (businessLocationId: string) => void;
  /** Low-stock: ask the store to confirm availability before buying. */
  onCheckAvailability?: () => void;
  availabilityPending?: boolean;
  availabilitySending?: boolean;
  onLikedChange?: (itemId: string, liked: boolean) => void;
}

function InventoryCatalogCardInner({
  item,
  onPrimaryPress,
  primaryLabel,
  onItemPress,
  onAddToCart,
  inCartQuantity = 0,
  onStorePress,
  onCheckAvailability,
  availabilityPending = false,
  availabilitySending = false,
  onLikedChange,
}: InventoryCatalogCardProps) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, spacing } = useTheme();
  const interestOnly = item.item.interest_only === true;
  const defaultLabel = t('orders.variant.defaultOption', 'Default');
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

  const optionList = useMemo(
    () =>
      shopperVariantOptions({
        defaultLabel,
        variants: item.item.item_variants,
        parentImageUrl,
      }),
    [defaultLabel, item, parentImageUrl]
  );

  const [selectionId, setSelectionId] = useState<string | null>(() =>
    hasVariantOptions ? SHOPPER_BASE_VARIANT_ID : null
  );
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setSelectionId(hasVariantOptions ? SHOPPER_BASE_VARIANT_ID : null);
    setActiveIndex(0);
  }, [item.id, hasVariantOptions]);

  const gallery = useMemo(
    () => catalogGalleryForSelection(item, selectionId),
    [item, selectionId]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [selectionId, gallery.length]);

  const handleSelectOption = useCallback((id: string) => {
    setSelectionId(id);
  }, []);

  const openDetails = useCallback(() => {
    onItemPress?.(item.id);
  }, [item.id, onItemPress]);

  const displayIdx =
    gallery.length === 0 ? 0 : Math.min(activeIndex, gallery.length - 1);
  const mainUri = catalogImageDisplayUrl(gallery[displayIdx]);
  const hasMultiple = gallery.length > 1;
  const logoUri = item.business_location.logo_url?.trim() || undefined;
  const mainImage = useImageFallback(mainUri);
  const logoImage = useImageFallback(logoUri);
  const brandName = item.item.brand?.name?.trim();

  const hasDeal =
    item.hasActiveDeal &&
    typeof item.original_price === 'number' &&
    typeof item.discounted_price === 'number' &&
    item.original_price > item.discounted_price;
  const unitPrice = catalogUnitPriceForSelection(item, selectionId);
  const fromPrice = useMemo(
    () => (hasVariantOptions ? catalogFromPrice(item) : unitPrice),
    [hasVariantOptions, item, unitPrice]
  );
  const currency = item.item.currency || 'XAF';
  const dealPercent = useMemo(() => {
    if (!hasDeal || !item.original_price) return 0;
    const disc = item.discounted_price ?? 0;
    if (item.original_price <= 0) return 0;
    return Math.max(0, Math.round((1 - disc / item.original_price) * 100));
  }, [hasDeal, item.discounted_price, item.original_price]);
  const showLowStock =
    !item.food_availability &&
    item.computed_available_quantity > 0 &&
    item.computed_available_quantity <= LOW_STOCK_THRESHOLD;
  const loc = item.business_location;
  const acceptsOrders = merchantCanAcceptOrders(loc.business);
  const openingSoon = isOpeningSoonMerchant(loc.business);
  const paymentsEnabled = item.payments_enabled !== false;
  const outOfStock = item.computed_available_quantity <= 0;
  const foodBlocked = isFoodOrderBlocked(item.food_availability);
  const buyDisabled =
    outOfStock || foodBlocked || !acceptsOrders || !paymentsEnabled;
  const cityLine = [loc.address?.city, loc.address?.state]
    .filter(Boolean)
    .join(' • ');
  const businessLine =
    `${loc.business?.name ?? ''}${cityLine ? ` • ${cityLine}` : ''}`.trim();
  const buyA11y = t('public.items.card.buyNowA11y', 'Buy {{name}}', {
    name: item.item.name,
  });
  const inCart = inCartQuantity > 0;

  return (
    <Card
      mode="elevated"
      elevation={2}
      style={[
        styles.card,
        {
          borderRadius: borderRadius.md,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <Pressable
        onPress={openDetails}
        disabled={!onItemPress}
        style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={t(
          'public.items.card.openDetails',
          'Open {{name}} details',
          { name: item.item.name }
        )}
      >
        <View
          style={[
            styles.hero,
            { backgroundColor: colors.pageBackground },
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
              style={styles.heroImage}
              resizeMode="cover"
              onError={mainImage.onImageError}
            />
          ) : (
            <View style={[styles.heroImage, styles.thumbPlaceholder]}>
              <Text
                style={[typography.caption, { color: colors.text.disabled }]}
              >
                {t('public.items.noImage', 'Photo')}
              </Text>
            </View>
          )}
          {hasMultiple ? (
            <View
              style={[
                styles.photoBadge,
                { backgroundColor: 'rgba(0,0,0,0.65)' },
              ]}
            >
              <Text
                style={[
                  typography.caption,
                  { color: '#fff', fontSize: 10, fontWeight: '600' },
                ]}
              >
                {t('public.items.card.photosBadge', '{{count}} photos', {
                  count: gallery.length,
                })}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {hasMultiple ? (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.thumbStripContent,
            { paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
          ]}
        >
          {gallery.map((img, i) => (
            <Pressable
              key={`${img.id}-${i}`}
              onPress={() => setActiveIndex(i)}
              accessibilityRole="button"
              accessibilityLabel={t(
                'public.items.card.viewPhoto',
                'View photo {{n}} of {{total}}',
                { n: i + 1, total: gallery.length }
              )}
              accessibilityState={{ selected: i === displayIdx }}
              style={[
                styles.miniThumbWrap,
                {
                  borderColor:
                    i === displayIdx ? colors.primary.main : colors.divider,
                  borderRadius: borderRadius.sm,
                },
              ]}
            >
              <MiniCatalogThumb
                uri={catalogImageDisplayUrl(img)}
                borderRadius={borderRadius.sm}
                placeholderLabel={t('public.items.noImage', 'Photo')}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={[styles.body, { padding: spacing.sm }]}>
        <View style={styles.brandRow}>
          {logoImage.hasImage && logoImage.sourceUri ? (
            <Pressable
              onPress={() =>
                onStorePress && loc.id ? onStorePress(loc.id) : undefined
              }
              disabled={!onStorePress || !loc.id}
              accessibilityRole="button"
              accessibilityLabel={t(
                'stores.openStoreA11y',
                'Open store {{name}}',
                { name: loc.business?.name ?? '' }
              )}
              style={({ pressed }) => [
                { opacity: pressed && !!onStorePress ? 0.75 : 1 },
              ]}
            >
              <View
                style={[
                  styles.logoBox,
                  {
                    borderColor: colors.divider,
                    backgroundColor: colors.pageBackground,
                  },
                ]}
              >
                <Image
                  source={{ uri: logoImage.sourceUri }}
                  style={styles.logoImg}
                  resizeMode="contain"
                  onError={logoImage.onImageError}
                />
              </View>
            </Pressable>
          ) : null}
          <View style={styles.brandTextCol}>
            {brandName ? (
              <Text
                style={[
                  typography.caption,
                  { color: colors.text.secondary, fontWeight: '600' },
                ]}
                numberOfLines={1}
              >
                {brandName}
              </Text>
            ) : null}
            <Pressable
              onPress={() => onItemPress?.(item.id)}
              disabled={!onItemPress}
            >
              <Text
                style={[typography.subtitle2, { color: colors.text.primary }]}
                numberOfLines={2}
              >
                {item.item.name}
              </Text>
              <View style={styles.priceRow}>
                {interestOnly ? (
                  <Text
                    style={[
                      typography.subtitle2,
                      { color: colors.text.secondary, fontWeight: '600' },
                    ]}
                  >
                    {t(
                      'productInterest.priceNotApplicable',
                      'Price on request'
                    )}
                  </Text>
                ) : (
                  <>
                    <Text
                      style={[
                        typography.h5,
                        { color: colors.primary.main, fontWeight: '700' },
                      ]}
                    >
                      {hasVariantOptions
                        ? t('public.items.card.fromPrice', 'From {{price}}', {
                            price: formatMoney(fromPrice, currency),
                          })
                        : formatMoney(unitPrice, currency)}
                    </Text>
                    {hasDeal ? (
                      <Text
                        style={[
                          typography.body2,
                          {
                            color: colors.text.disabled,
                            textDecorationLine: 'line-through',
                          },
                        ]}
                      >
                        {formatMoney(item.original_price!, currency)}
                      </Text>
                    ) : null}
                  </>
                )}
              </View>
              {item.food_availability ? (
                <View style={{ marginTop: 6, gap: 4 }}>
                  <FoodAvailabilityChip availability={item.food_availability} />
                  {item.item.preparation_minutes ? (
                    <Text
                      style={[
                        typography.caption,
                        { color: colors.text.secondary },
                      ]}
                    >
                      {t('foods.prepMinutes', '~{{count}} min prep', {
                        count: item.item.preparation_minutes,
                      })}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {typeof item.avg_rating === 'number' &&
              (item.rating_count ?? 0) > 0 ? (
                <StarRatingDisplay
                  average={item.avg_rating}
                  count={item.rating_count}
                  style={{ marginTop: 2 }}
                />
              ) : null}
            </Pressable>
          </View>
        </View>

        {!interestOnly && hasDeal && dealPercent > 0 ? (
          <StatusPill
            label={t('public.items.card.savePercent', 'Save {{pct}}%', {
              pct: dealPercent,
            })}
            backgroundColor={colors.secondary.light + '40'}
            textColor={colors.secondary.dark}
            icon="tag"
            compact
            style={{ marginTop: spacing.xs }}
          />
        ) : !interestOnly && hasDeal ? (
          <StatusPill
            label={t('public.items.card.dealBadge', 'Deal')}
            backgroundColor={colors.secondary.light + '40'}
            textColor={colors.secondary.dark}
            icon="tag"
            compact
            style={{ marginTop: spacing.xs }}
          />
        ) : openingSoon ? (
          <StatusPill
            label={t('business.lifecycle.openingSoonBadge', 'Opening Soon')}
            backgroundColor={colors.info.light + '30'}
            textColor={colors.info.dark}
            icon="storefront-outline"
            compact
            style={{ marginTop: spacing.xs }}
          />
        ) : showLowStock ? (
          <View style={[styles.lowStockRow, { marginTop: spacing.xs }]}>
            <StatusPill
              label={t('public.items.card.lowStock', 'Only {{count}} left', {
                count: item.computed_available_quantity,
              })}
              backgroundColor={colors.warning.light + '30'}
              textColor={colors.warning.dark}
              icon="alert-outline"
              compact
            />
            {onCheckAvailability ? (
              <Button
                mode="text"
                compact
                icon="store-check-outline"
                loading={availabilitySending}
                disabled={availabilityPending || availabilitySending}
                onPress={onCheckAvailability}
                style={styles.availabilityBtn}
                contentStyle={styles.availabilityContent}
                labelStyle={[
                  styles.availabilityLabel,
                  { color: colors.warning.dark },
                ]}
                accessibilityLabel={t(
                  'items.availability.checkCtaA11y',
                  'Check availability of {{name}} with the store',
                  { name: item.item.name }
                )}
              >
                {availabilityPending
                  ? t('items.availability.pending', 'Waiting for the store…')
                  : t(
                      'items.availability.checkCtaShort',
                      'Verify stock with store'
                    )}
              </Button>
            ) : null}
          </View>
        ) : null}

        {item.item.is_used ? (
          <StatusPill
            label={t('items.usedBadge', 'Used')}
            backgroundColor={colors.warning.light + '30'}
            textColor={colors.warning.dark}
            compact
            style={{ marginTop: spacing.xs }}
          />
        ) : null}

        {hasVariantOptions ? (
          <CatalogOptionChips
            options={optionList}
            value={selectionId}
            onChange={handleSelectOption}
          />
        ) : null}

        <Pressable
          onPress={() =>
            onStorePress && loc.id ? onStorePress(loc.id) : undefined
          }
          disabled={!onStorePress || !loc.id}
          accessibilityRole="button"
          accessibilityLabel={t(
            'stores.openStoreA11y',
            'Open store {{name}}',
            { name: loc.business?.name ?? '' }
          )}
          style={({ pressed }) => [
            { opacity: pressed && !!onStorePress ? 0.75 : 1 },
          ]}
        >
          <Text
            style={[
              typography.caption,
              {
                color:
                  onStorePress && loc.id
                    ? colors.primary.main
                    : colors.text.secondary,
                marginTop: spacing.xs,
              },
            ]}
            numberOfLines={2}
          >
            {businessLine}
          </Text>
        </Pressable>
        {item.distance_text ? (
          <View style={[styles.distanceRow, { marginTop: 2 }]}>
            <MaterialCommunityIcons
              name="map-marker-outline"
              size={12}
              color={colors.text.secondary}
            />
            <Text
              style={[
                typography.caption,
                { color: colors.text.secondary, flex: 1 },
              ]}
              numberOfLines={1}
            >
              {item.distance_text}{' '}
              {t('public.items.card.distanceAway', 'away')}
            </Text>
          </View>
        ) : null}
        <Divider style={{ marginTop: spacing.sm }} />

        <View style={[styles.ctaRow, { marginTop: spacing.xs }]}>
          {interestOnly ? (
            <Button
              mode="contained"
              icon="hand-wave-outline"
              onPress={() => {
                if (onItemPress) {
                  onItemPress(item.id);
                  return;
                }
                onPrimaryPress(selectionId);
              }}
              accessibilityLabel={t('productInterest.cta', "I'm interested")}
              buttonColor={colors.primary.main}
              textColor={colors.primary.contrast}
              style={{ flex: 1, minWidth: 0 }}
              contentStyle={styles.ctaContent}
              labelStyle={styles.ctaLabel}
            >
              {t('productInterest.cta', "I'm interested")}
            </Button>
          ) : (
            <>
          {onAddToCart ? (
            <IconButton
              icon={inCart ? 'cart-check' : 'cart-plus'}
              mode={inCart ? 'contained' : 'outlined'}
              size={20}
              onPress={() => onAddToCart(selectionId)}
              disabled={outOfStock || foodBlocked || !paymentsEnabled || !acceptsOrders}
              accessibilityLabel={
                inCart
                  ? t(
                      'cart.inCartA11y',
                      'In cart, quantity {{count}}. Add more',
                      { count: inCartQuantity }
                    )
                  : t('cart.addToCart', 'Add to cart')
              }
              containerColor={inCart ? colors.primary.main : undefined}
              iconColor={inCart ? colors.primary.contrast : undefined}
              style={[
                styles.cartIconBtn,
                {
                  borderColor: outOfStock
                    ? colors.text.disabled
                    : colors.primary.main,
                },
              ]}
            />
          ) : null}
          <Button
            mode="contained"
            icon={buyDisabled ? undefined : 'cart-outline'}
            onPress={() => onPrimaryPress(selectionId)}
            disabled={buyDisabled}
            accessibilityLabel={
              outOfStock
                ? t('public.items.outOfStock', 'Out of stock')
                : foodBlocked
                  ? t('foods.status.notServingNow', 'Not serving now')
                  : !acceptsOrders
                    ? t(
                        'checkout.merchantNotAcceptingOrders',
                        'This merchant is not yet accepting orders.'
                      )
                    : buyA11y
            }
            buttonColor={
              buyDisabled ? colors.text.disabled : colors.primary.main
            }
            textColor={colors.primary.contrast}
            style={{ flex: 1, minWidth: 0 }}
            contentStyle={styles.ctaContent}
            labelStyle={styles.ctaLabel}
          >
            {outOfStock
              ? t('public.items.outOfStock', 'Out of stock')
              : foodBlocked
                ? t('foods.status.notServingNow', 'Not serving now')
                : !paymentsEnabled || !acceptsOrders
                  ? t('catalog.paymentsComingSoon', 'Coming soon')
                  : primaryLabel}
          </Button>
            </>
          )}
        </View>
      </View>
    </Card>
  );
}

export const InventoryCatalogCard = memo(InventoryCatalogCardInner);

function MiniCatalogThumb({
  uri,
  borderRadius,
  placeholderLabel,
}: {
  uri?: string | null;
  borderRadius: number;
  placeholderLabel: string;
}) {
  const { colors, typography } = useTheme();
  const image = useImageFallback(uri);

  if (!image.hasImage || !image.sourceUri) {
    return (
      <View
        style={[
          styles.miniThumb,
          styles.thumbPlaceholder,
          { borderRadius, backgroundColor: colors.pageBackground },
        ]}
      >
        <Text
          style={[typography.caption, { color: colors.text.disabled }]}
          numberOfLines={1}
        >
          {placeholderLabel}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: image.sourceUri }}
      style={styles.miniThumb}
      resizeMode="cover"
      onError={image.onImageError}
    />
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12, overflow: 'hidden' },
  hero: {
    width: '100%',
    aspectRatio: 4 / 3,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  likeOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 3,
  },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  photoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lowStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  thumbStripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 2,
  },
  miniThumbWrap: { width: 44, height: 44, borderWidth: 2, overflow: 'hidden' },
  miniThumb: { width: '100%', height: '100%' },
  body: { minWidth: 0 },
  brandRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  logoBox: {
    width: 56,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: { width: 52, height: 32 },
  brandTextCol: { flex: 1, minWidth: 0 },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'stretch',
  },
  ctaContent: {
    height: 40,
    paddingHorizontal: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  ctaLabel: { fontSize: 14, fontWeight: '700', letterSpacing: 0.15 },
  cartIconBtn: { margin: 0, width: 40, height: 40 },
  availabilityBtn: { margin: 0, marginHorizontal: -4 },
  availabilityContent: { height: 32, justifyContent: 'flex-start' },
  availabilityLabel: { fontSize: 12, fontWeight: '600', marginVertical: 0 },
});
