import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Button, Snackbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PublicItemCheckoutSheet } from '../../components/dialogs/PublicItemCheckoutSheet';
import { InventoryItemShareButton } from '../../components/browse/InventoryItemShareButton';
import { ItemLikeButton } from '../../components/browse/ItemLikeButton';
import { InventoryItemDetailImageGallery } from '../../components/browse/InventoryItemDetailImageGallery';
import { DetailVariantCarousel } from '../../components/browse/DetailVariantCarousel';
import { InventoryItemDetailHowItWorks } from '../../components/browse/InventoryItemDetailHowItWorks';
import { InventoryItemDetailProductInfo } from '../../components/browse/InventoryItemDetailProductInfo';
import { ItemDetailFtueNudge } from '../../components/browse/ItemDetailFtueNudge';
import { InventoryItemDetailViewsRow } from '../../components/browse/InventoryItemDetailViewsRow';
import { StatusPill } from '../../components/common/StatusPill';
import { FoodAvailabilityChip } from '../../components/food/FoodAvailabilityChip';
import { FoodScheduleList } from '../../components/food/FoodScheduleList';
import { isFoodOrderBlocked } from '../../utils/foodAvailability';
import { TrustBadge } from '../../components/common/TrustBadge';
import { EntityRatingsSection } from '../../components/rating/EntityRatingsSection';
import { StarRatingDisplay } from '../../components/rating/StarRatingDisplay';
import { useTheme } from '../../contexts/ThemeContext';
import { useInventoryItemDetail } from '../../hooks/useInventoryItemDetail';
import { useIsStripeRail } from '../../hooks/useIsStripeRail';
import { useResolvedCheckout } from '../../hooks/useResolvedCheckout';
import { useTrackItemView } from '../../hooks/useTrackItemView';
import type { InventoryItemDetailParams, PlaceOrderParams } from '../../navigation/types';
import { useStore } from '../../stores/RootStore';
import { trackBrowseProductViewed } from '../../utils/ftueAnalytics';
import { stripHtml } from '../../utils/stripHtml';
import {
  catalogItemToCheckoutSummary,
  catalogOrderedImages,
  catalogSalePrice,
  formatCatalogMoney,
} from '../../utils/catalogInventoryDisplay';
import { catalogUnitPriceForSelection } from '../../utils/buildCartLineFromCatalog';
import {
  isOpeningSoonMerchant,
  merchantCanAcceptOrders,
} from '../../utils/merchantLifecycle';
import { buildInventoryItemSeoShareUrl } from '../../utils/buildInventoryItemSeoShareUrl';
import {
  effectiveVariantUnitPrice,
  orderedVariantImages,
  unitPriceWithListingDeal,
} from '../../types/business/itemVariant';
import {
  isShopperBaseVariantId,
  SHOPPER_BASE_VARIANT_ID,
  shopperVariantOptions,
  toCartVariantId,
  toOrderItemVariantId,
} from '../../utils/shopperVariantSelection';
import { LOW_STOCK_THRESHOLD } from '../../constants/stock';
import { requestStockAvailabilityCheck } from '../../services/inventoryItemsApi';
import { scheduleMetaAddToCart } from '../../services/metaConversionsApi';
import { ProductInterestSheet } from '../../components/product-interest/ProductInterestSheet';
import { useProductInterest } from '../../hooks/useProductInterest';

function InventoryItemDetailScreen() {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<{ InventoryItemDetail: InventoryItemDetailParams }, 'InventoryItemDetail'>>();
  const { inventoryItemId, availabilityResult, availabilityQuantity } = route.params;
  const { auth, cart, ftue } = useStore();
  const { item, loading, error, refetch } = useInventoryItemDetail(inventoryItemId, {
    withAuth: auth.isAuthenticated,
  });
  const [snack, setSnack] = useState<string | null>(null);
  const [interestOpen, setInterestOpen] = useState(false);
  const [interestSubmitting, setInterestSubmitting] = useState(false);
  const { submitInterest } = useProductInterest();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [availabilityPending, setAvailabilityPending] = useState(false);
  const [availabilitySending, setAvailabilitySending] = useState(false);
  const { trackView } = useTrackItemView();
  const { isStripeRail } = useIsStripeRail(auth.isAuthenticated);

  useEffect(() => {
    if (!item) return;
    void ftue.recordProductView();
    trackBrowseProductViewed(inventoryItemId);
  }, [ftue, inventoryItemId, item?.id]);

  const itemCountryCode = item?.business_location?.address?.country?.trim().toUpperCase() ?? undefined;

  const preflightRequest = useMemo(
    () =>
      checkoutOpen && item
        ? {
            items: [
              {
                business_inventory_id: item.id,
                quantity: 1,
                ...(toOrderItemVariantId(variantId)
                  ? { item_variant_id: toOrderItemVariantId(variantId) }
                  : {}),
              },
            ],
            provisional_country: itemCountryCode,
          }
        : null,
    [checkoutOpen, item, itemCountryCode, variantId]
  );

  const { config: preflightConfig, loading: preflightLoading } = useResolvedCheckout({
    request: preflightRequest,
    enabled: checkoutOpen && !!item,
  });

  const firstBlocker = preflightConfig?.blocking_errors?.[0]?.message ?? null;

  const isGuest = !auth.isAuthenticated;
  const defaultVariantLabel = t('orders.variant.defaultOption', 'Default');
  const dbVariants = useMemo(
    () =>
      [...(item?.item.item_variants ?? [])]
        .filter((variant) => variant.is_active !== false)
        .sort((left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0)),
    [item]
  );

  const parentImageUrl = useMemo(() => {
    if (!item) return null;
    return catalogOrderedImages(item)[0]?.image_url ?? null;
  }, [item]);

  const variants = useMemo(
    () =>
      shopperVariantOptions({
        defaultLabel: defaultVariantLabel,
        variants: dbVariants,
        parentImageUrl,
      }),
    [defaultVariantLabel, dbVariants, parentImageUrl]
  );

  useEffect(() => {
    if (!dbVariants.length) {
      setVariantId(null);
      return;
    }
    setVariantId((current) =>
      current && variants.some((variant) => variant.id === current)
        ? current
        : SHOPPER_BASE_VARIANT_ID
    );
  }, [dbVariants.length, variants]);

  const effectiveVariantId = variantId;

  const selectedDbVariant = useMemo(() => {
    if (!variantId || isShopperBaseVariantId(variantId)) return null;
    return dbVariants.find((variant) => variant.id === variantId) ?? null;
  }, [dbVariants, variantId]);

  const cartVariantKey = toCartVariantId(variantId) ?? null;

  const sharePriceLine = useMemo(() => {
    if (!item) return undefined;
    return formatCatalogMoney(catalogSalePrice(item), item.item.currency || 'XAF');
  }, [item]);

  useLayoutEffect(() => {
    const title = item?.item.name?.trim() || t('public.items.detail.navTitle', 'Item');
    navigation.setOptions({
      title,
      headerRight:
        item != null
          ? () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <ItemLikeButton
                  itemId={item.item_id || item.item.id}
                  initiallyLiked={item.liked === true}
                />
                <InventoryItemShareButton
                  shareUrl={buildInventoryItemSeoShareUrl(inventoryItemId)}
                  shareTitle={item.item.name}
                  shareDescription={sharePriceLine}
                />
              </View>
            )
          : undefined,
    });
  }, [inventoryItemId, item, navigation, sharePriceLine, t]);

  const onAddToCart = useCallback(() => {
    if (!item || item.computed_available_quantity <= 0) return;
    if (isFoodOrderBlocked(item.food_availability)) return;
    if (dbVariants.length >= 1 && !effectiveVariantId) return;
    trackView(inventoryItemId);
    const before = cart.quantityForLine(item.id, effectiveVariantId);
    cart.addFromCatalog(item, 1, effectiveVariantId, defaultVariantLabel);
    const after = cart.quantityForLine(item.id, effectiveVariantId);
    const added = after - before;
    if (added > 0) {
      const unit = catalogUnitPriceForSelection(item, effectiveVariantId);
      scheduleMetaAddToCart(
        {
          inventoryItemId: item.id,
          quantity: added,
          value: unit * added,
          currency: item.item.currency,
          contentName: item.item.name,
        },
        auth.isAuthenticated
      );
      setSnack(t('cart.itemAdded', 'Added to cart'));
    }
  }, [
    auth.isAuthenticated,
    cart,
    defaultVariantLabel,
    dbVariants.length,
    effectiveVariantId,
    inventoryItemId,
    item,
    t,
    trackView,
  ]);

  const onBuy = useCallback(() => {
    if (!item || item.computed_available_quantity <= 0) return;
    if (isFoodOrderBlocked(item.food_availability)) return;
    if (dbVariants.length >= 1 && !effectiveVariantId) return;
    trackView(inventoryItemId);
    if (isGuest) {
      setCheckoutOpen(true);
      return;
    }
    const orderVariantId = toCartVariantId(effectiveVariantId);
    (navigation as { navigate: (name: 'PlaceOrder', params: PlaceOrderParams) => void }).navigate('PlaceOrder', {
      inventoryItemId,
      ...(orderVariantId ? { variantId: orderVariantId } : {}),
    });
  }, [
    dbVariants.length,
    effectiveVariantId,
    isGuest,
    inventoryItemId,
    item,
    navigation,
    trackView,
  ]);

  const onCheckAvailability = useCallback(async () => {
    if (!item || availabilityPending || availabilitySending) return;
    if (isGuest) {
      setCheckoutOpen(true);
      return;
    }
    setAvailabilitySending(true);
    try {
      await requestStockAvailabilityCheck(inventoryItemId);
      setAvailabilityPending(true);
      setSnack(
        t(
          'items.availability.requestSent',
          'We’ve asked the store to confirm availability. You’ll be notified when they reply.'
        )
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setSnack(
        msg ||
          t('items.availability.requestFailed', 'Could not send the availability check. Try again shortly.')
      );
    } finally {
      setAvailabilitySending(false);
    }
  }, [
    availabilityPending,
    availabilitySending,
    inventoryItemId,
    isGuest,
    item,
    t,
  ]);

  useEffect(() => {
    if (!availabilityResult) return;
    void refetch();
    if (availabilityResult === 'unavailable') {
      setSnack(
        t('items.availability.resultUnavailable', 'The store said this item is no longer available.')
      );
    } else if (availabilityResult === 'adjusted' && availabilityQuantity != null) {
      setSnack(
        t('items.availability.resultAdjusted', 'The store updated stock — {{count}} available.', {
          count: availabilityQuantity,
        })
      );
    } else {
      setSnack(
        t('items.availability.resultConfirmed', 'The store confirmed this item is still available.')
      );
    }
  }, [availabilityQuantity, availabilityResult, refetch, t]);

  const onBrowseMore = useCallback(() => {
    const nav = navigation as { navigate: (name: string, params?: object) => void };
    const foodTab = Boolean(item?.food_availability);
    if (isGuest) {
      nav.navigate('GuestTabs', { screen: foodTab ? 'GuestFoods' : 'GuestBrowse' });
      return;
    }
    nav.navigate('ClientMainTabs', { screen: foodTab ? 'ClientFoods' : 'ClientBrowse' });
  }, [isGuest, item?.food_availability, navigation]);

  const inCartQuantity = cartVariantKey
    ? cart.quantityForLine(inventoryItemId, cartVariantKey)
    : cart.quantityForListing(inventoryItemId);
  const inCart = inCartQuantity > 0;
  const inCartLabel =
    inCartQuantity > 1
      ? t('cart.inCartCount', 'In cart ({{count}})', { count: inCartQuantity })
      : t('cart.inCart', 'In cart');
  const addToCartLabel = inCart
    ? t('cart.addMore', 'Add more')
    : t('cart.addToCart', 'Add to cart');
  const interestOnly = item?.item?.interest_only === true;

  const breadcrumb = useMemo(() => {
    if (!item) return '';
    const parts = [
      item.item.brand?.name?.trim(),
      item.item.item_sub_category?.item_category?.name?.trim(),
      item.item.item_sub_category?.name?.trim(),
    ].filter(Boolean);
    return parts.join(' · ');
  }, [item]);

  const dealPercent = useMemo(() => {
    if (!item) return 0;
    if (
      !item.hasActiveDeal ||
      typeof item.original_price !== 'number' ||
      typeof item.discounted_price !== 'number' ||
      item.original_price <= item.discounted_price
    ) {
      return 0;
    }
    return Math.max(0, Math.round((1 - item.discounted_price / item.original_price) * 100));
  }, [item]);

  useEffect(() => {
    if (!item?.id) return;
    if (dbVariants.length >= 1 && !effectiveVariantId) return;
    trackView(item.id, {
      forMetaViewContent: true,
      value: catalogUnitPriceForSelection(item, effectiveVariantId),
      currency: item.item.currency,
      contentName: item.item.name,
    });
  }, [dbVariants.length, effectiveVariantId, item, trackView]);

  if (loading && !item) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground }]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  if (error || !item) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBackground, padding: spacing.lg }]}>
        <Text style={[typography.body1, { color: colors.error.main, textAlign: 'center' }]}>
          {error || t('public.items.detail.notFound', 'Item not found')}
        </Text>
        <Button mode="contained-tonal" onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }}>
          {t('public.items.detail.goBack', 'Back')}
        </Button>
        <Button mode="text" onPress={refetch} style={{ marginTop: spacing.sm }}>
          {t('common.retry', 'Retry')}
        </Button>
      </View>
    );
  }

  const currency = item.item.currency || 'XAF';
  const selectedVariant = selectedDbVariant;
  const parentImgs = catalogOrderedImages(item).map((img) => ({
    id: img.id,
    image_url: img.display_url?.trim() || img.image_url,
  }));
  const variantImgs = orderedVariantImages(selectedVariant)
    .map((img) => ({
      id: img.id,
      image_url: img.display_url?.trim() || img.image_url?.trim() || '',
    }))
    .filter((img) => img.image_url.length > 0);
  // Selected option: show only that variant's photos (fallback to parent if none).
  const imgs =
    selectedVariant && variantImgs.length > 0 ? variantImgs : parentImgs;
  const orderVariantUuid = toOrderItemVariantId(effectiveVariantId);
  const selectedOverride = item.variant_price_overrides?.find(
    (override) => override.item_variant_id === orderVariantUuid
  );
  const effectiveBase = effectiveVariantUnitPrice(
    selectedVariant,
    item.selling_price,
    selectedOverride
  );
  const variantPricing = unitPriceWithListingDeal(
    effectiveBase,
    item.selling_price,
    item.hasActiveDeal,
    item.original_price,
    item.discounted_price
  );
  const price = variantPricing.unit;
  const needsVariantPick = dbVariants.length >= 1 && !variantId;
  const fromPrice = needsVariantPick
    ? Math.min(
        item.selling_price,
        ...dbVariants.map((variant) => {
          const override = item.variant_price_overrides?.find(
            (row) => row.item_variant_id === variant.id
          );
          const optionBase = effectiveVariantUnitPrice(
            variant,
            item.selling_price,
            override
          );
          return unitPriceWithListingDeal(
            optionBase,
            item.selling_price,
            item.hasActiveDeal,
            item.original_price,
            item.discounted_price
          ).unit;
        })
      )
    : price;
  const hasDeal =
    !needsVariantPick &&
    item.hasActiveDeal &&
    typeof item.original_price === 'number' &&
    typeof item.discounted_price === 'number' &&
    item.original_price > item.discounted_price;
  const loc = item.business_location;
  const shipLine = [loc.business?.name, loc.address?.city].filter(Boolean).join(' · ');
  const desc = stripHtml(item.item.description);
  const checkoutBase = catalogItemToCheckoutSummary(
    item,
    t('public.items.detail.navTitle', 'Item')
  );
  const checkoutSheetItem = {
    ...checkoutBase,
    priceText: formatCatalogMoney(price, currency),
    imageUrl: imgs[0]?.image_url ?? checkoutBase.imageUrl,
  };

  const qty = item.computed_available_quantity;
  const outOfStock = qty <= 0;
  const foodBlocked = isFoodOrderBlocked(item.food_availability);
  const orderBlocked = outOfStock || foodBlocked;
  const variantSelectionReady = dbVariants.length === 0 || !!variantId;
  const acceptsOrders = merchantCanAcceptOrders(loc.business);
  const openingSoon = isOpeningSoonMerchant(loc.business);
  const paymentsEnabled = item.payments_enabled !== false;
  const showLowStock = qty > 0 && qty <= LOW_STOCK_THRESHOLD;
  const showInStock = qty > LOW_STOCK_THRESHOLD;

  return (
    <View style={[styles.flex, { backgroundColor: colors.pageBackground }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 152 }} showsVerticalScrollIndicator={false}>
        {/* Amazon-style: brand / title / rating above the gallery */}
        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
          <View style={styles.brandRatingRow}>
            {item.item.brand?.name?.trim() ? (
              <Text
                style={[
                  typography.body2,
                  { color: colors.primary.main, fontWeight: '600', flexShrink: 1 },
                ]}
                numberOfLines={1}
              >
                {t('public.items.detail.brandLabel', 'Brand')}: {item.item.brand.name.trim()}
              </Text>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            {typeof item.avg_rating === 'number' && (item.rating_count ?? 0) > 0 ? (
              <StarRatingDisplay
                average={item.avg_rating}
                count={item.rating_count}
                size={14}
              />
            ) : null}
          </View>
          <Text
            style={[
              typography.h5,
              {
                color: colors.text.primary,
                marginTop: spacing.xs,
                fontWeight: '600',
                lineHeight: 24,
              },
            ]}
          >
            {item.item.name}
          </Text>
          {item.food_availability ? (
            <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
              <FoodAvailabilityChip availability={item.food_availability} />
              {item.item.preparation_minutes ? (
                <Text style={[typography.body2, { color: colors.text.secondary }]}>
                  {t('foods.prepMinutes', '~{{count}} min prep', {
                    count: item.item.preparation_minutes,
                  })}
                </Text>
              ) : null}
              {item.food_availability.has_schedule ? (
                <View style={{ marginTop: spacing.xs }}>
                  <Text
                    style={[
                      typography.caption,
                      { color: colors.text.secondary, fontWeight: '600', marginBottom: 4 },
                    ]}
                  >
                    {t('foods.schedule.title', 'Serving hours')}
                  </Text>
                  <FoodScheduleList slots={item.food_availability.slots} />
                </View>
              ) : null}
            </View>
          ) : null}
          {item.item.is_used ? (
            <StatusPill
              label={t('items.usedBadge', 'Used')}
              backgroundColor={colors.warning.light + '30'}
              textColor={colors.warning.dark}
              compact
              style={{ marginTop: spacing.xs, alignSelf: 'flex-start' }}
            />
          ) : null}
          {breadcrumb && !item.item.brand?.name?.trim() ? (
            <Text
              style={[
                typography.caption,
                { color: colors.text.secondary, marginTop: 4 },
              ]}
              numberOfLines={1}
            >
              {breadcrumb}
            </Text>
          ) : null}
        </View>

        <InventoryItemDetailImageGallery
          key={effectiveVariantId ?? 'no-variant'}
          images={imgs}
          emptyLabel={t('public.items.noImage', 'Photo')}
          itemName={item.item.name}
        />

        <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
          {variants.length > 1 ? (
            <DetailVariantCarousel
              variants={variants}
              value={variantId}
              onChange={setVariantId}
              listingSellingPrice={item.selling_price}
              priceOverrides={item.variant_price_overrides}
              hasActiveDeal={item.hasActiveDeal}
              originalPrice={item.original_price}
              discountedPrice={item.discounted_price}
              currency={currency}
              hidePrices={interestOnly}
            />
          ) : null}

          {/* Amazon-style price block under variants */}
          <View style={{ marginTop: spacing.md }}>
            {interestOnly ? (
              <Text
                style={[
                  typography.h3,
                  { color: colors.text.primary, fontWeight: '700' },
                ]}
              >
                {t('productInterest.priceNotApplicable', 'Price on request')}
              </Text>
            ) : (
              <>
            {hasDeal && dealPercent > 0 ? (
              <Text
                style={[
                  typography.h5,
                  { color: colors.error.main, fontWeight: '700' },
                ]}
              >
                -{dealPercent}%
              </Text>
            ) : null}
            <View style={styles.priceRow}>
              <Text
                style={[
                  typography.h3,
                  { color: colors.text.primary, fontWeight: '700' },
                ]}
              >
                {needsVariantPick
                  ? t('public.items.card.fromPrice', 'From {{price}}', {
                      price: formatCatalogMoney(fromPrice, currency),
                    })
                  : formatCatalogMoney(price, currency)}
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
                  {formatCatalogMoney(
                    variantPricing.strikeOriginal ?? item.original_price!,
                    currency
                  )}
                </Text>
              ) : null}
            </View>
            {hasDeal ? (
              <Text
                style={[
                  typography.caption,
                  { color: colors.text.secondary, marginTop: 2 },
                ]}
              >
                {t('public.items.detail.listPrice', 'List price')}:{' '}
                {formatCatalogMoney(
                  variantPricing.strikeOriginal ?? item.original_price!,
                  currency
                )}
              </Text>
            ) : null}
              </>
            )}
          </View>

          {showInStock ? (
            <Text
              style={[
                typography.body2,
                {
                  color: colors.success.dark,
                  fontWeight: '600',
                  marginTop: spacing.sm,
                },
              ]}
            >
              {t('public.items.inStock', 'In stock ({{count}})', {
                count: qty,
              })}
            </Text>
          ) : null}
          {showLowStock ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flexWrap: 'wrap',
                marginTop: spacing.sm,
                columnGap: spacing.xs,
              }}
            >
              <Text
                style={[
                  typography.body2,
                  {
                    color: colors.warning.dark,
                    fontWeight: '600',
                  },
                ]}
              >
                {t('public.items.card.lowStock', 'Only {{count}} left', {
                  count: qty,
                })}
              </Text>
              <Button
                mode="text"
                compact
                icon="store-check-outline"
                loading={availabilitySending}
                disabled={availabilityPending || availabilitySending}
                onPress={() => void onCheckAvailability()}
                labelStyle={{ fontSize: 13 }}
              >
                {availabilityPending
                  ? t('items.availability.pending', 'Waiting for the store…')
                  : t('items.availability.checkCta', 'Check availability with store')}
              </Button>
            </View>
          ) : null}
          {outOfStock ? (
            <Text
              style={[
                typography.body2,
                {
                  color: colors.error.dark,
                  fontWeight: '600',
                  marginTop: spacing.sm,
                },
              ]}
            >
              {t('items.detail.outOfStock', 'Out of stock')}
            </Text>
          ) : null}
          {openingSoon ? (
            <StatusPill
              label={t(
                'business.lifecycle.openingSoonBadge',
                'Opening Soon'
              )}
              backgroundColor={colors.info.light + '30'}
              textColor={colors.info.dark}
              icon="storefront-outline"
              compact
              style={{ marginTop: spacing.sm }}
            />
          ) : null}

          <InventoryItemDetailViewsRow
            viewsCount={item.viewsCount}
            style={{ marginTop: spacing.sm }}
          />

          {!orderBlocked ? (
            <Text
              style={[
                typography.body2,
                { color: colors.text.secondary, marginTop: spacing.md },
              ]}
            >
              {isStripeRail
                ? t('items.detail.valueLineCard', 'Pay securely by card at checkout.')
                : t('items.detail.valueLine', 'Pay with mobile money at checkout.')}
            </Text>
          ) : null}

          <Text
            style={[
              typography.overline,
              { color: colors.text.secondary, marginTop: spacing.md },
            ]}
          >
            {t(
              'items.detail.trustHeading',
              'Why you can order with confidence'
            )}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: spacing.sm }}
          >
            <View style={styles.trustRow}>
              <TrustBadge
                variant="encrypted_payments"
                label={
                  isStripeRail
                    ? t('items.detail.trustStrip.cardSecure', 'Card secure')
                    : t('items.detail.trustStrip.mobileMoney', 'MoMo secure')
                }
                inline
              />
              {loc.business?.is_verified && acceptsOrders ? (
                <TrustBadge
                  variant="verified_seller"
                  label={t(
                    'items.detail.trustStrip.verified',
                    'Verified seller'
                  )}
                  inline
                />
              ) : null}
              <TrustBadge
                variant="secure_checkout"
                label={t(
                  'items.detail.trustStrip.support',
                  'Help if something goes wrong'
                )}
                inline
              />
            </View>
          </ScrollView>

          <View
            style={[
              styles.shipCard,
              {
                borderRadius: borderRadius.md,
                backgroundColor: colors.surface,
                borderColor: colors.divider,
              },
            ]}
          >
            <Pressable
              style={({ pressed }) => [
                { flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed && !!loc.id ? 0.75 : 1 },
              ]}
              disabled={!loc.id}
              onPress={() => {
                if (!loc.id) return;
                (
                  navigation as {
                    navigate: (name: string, params: object) => void;
                  }
                ).navigate('StoreDetail', { businessId: loc.id });
              }}
              accessibilityRole="button"
              accessibilityLabel={t(
                'stores.openStoreA11y',
                'Open store {{name}}',
                { name: shipLine }
              )}
            >
              <MaterialCommunityIcons
                name="storefront-outline"
                size={20}
                color={loc.id ? colors.primary.main : colors.text.secondary}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[
                    typography.caption,
                    { color: colors.text.secondary },
                  ]}
                >
                  {t('public.items.detail.shippedBy', 'Shipped by')}
                </Text>
                <Text
                  style={[
                    typography.body1,
                    { color: loc.id ? colors.primary.main : colors.text.primary, marginTop: 4 },
                  ]}
                >
                  {shipLine}
                </Text>
              </View>
            </Pressable>
            {loc.id ? (
              <Button
                mode="text"
                compact
                style={{
                  alignSelf: 'flex-start',
                  marginLeft: -8,
                  marginTop: 2,
                }}
                onPress={() => {
                  (
                    navigation as {
                      navigate: (name: string, params: object) => void;
                    }
                  ).navigate('StoreDetail', { businessId: loc.id });
                }}
              >
                {t('stores.viewStore', 'View store')}
              </Button>
            ) : null}
          </View>

          <InventoryItemDetailHowItWorks
            isStripeRail={isStripeRail}
            pickupEnabled={Boolean(item.item.pay_at_pickup_enabled)}
            payAtDeliveryEnabled={Boolean(item.item.pay_on_delivery_enabled)}
          />
          <ItemDetailFtueNudge />

          <InventoryItemDetailProductInfo
            description={desc}
            category={item.item.item_sub_category?.item_category?.name}
            subcategory={item.item.item_sub_category?.name}
            brand={item.item.brand?.name}
            availableQuantity={item.computed_available_quantity}
          />

          <EntityRatingsSection
            entityType="item"
            entityId={item.item.id}
            style={{ marginTop: spacing.md }}
          />

          <Button
            mode="text"
            onPress={onBrowseMore}
            style={{
              marginTop: spacing.lg,
              marginBottom: spacing.sm,
              alignSelf: 'center',
            }}
            contentStyle={{ flexDirection: 'row-reverse' }}
            icon={() => (
              <MaterialCommunityIcons
                name="arrow-right"
                size={18}
                color={colors.primary.main}
              />
            )}
          >
            {t('items.detail.browseMoreItems', 'Browse more items')}
          </Button>
        </View>
      </ScrollView>

        <View
          style={[
            styles.bottomBarWrap,
            {
              paddingBottom: insets.bottom + spacing.sm,
              backgroundColor: colors.surface,
              borderTopColor: colors.divider,
            },
          ]}
        >
          {interestOnly ? (
            <View style={{ gap: spacing.sm }}>
              <Text
                style={[
                  typography.subtitle1,
                  { color: colors.text.primary, fontWeight: '700', textAlign: 'center' },
                ]}
              >
                {t('productInterest.priceNotApplicable', 'Price on request')}
              </Text>
              <Button
                mode="contained"
                onPress={() => {
                  if (!auth.isAuthenticated) {
                    void auth.setPostAuthResumeForInventoryDetail(inventoryItemId);
                    navigation.navigate('GuestTabs' as never, {
                      screen: 'GuestAuth',
                      params: { screen: 'Login' },
                    } as never);
                    return;
                  }
                  setInterestOpen(true);
                }}
                style={{ borderRadius: borderRadius.button }}
                contentStyle={styles.ctaBtnContent}
                labelStyle={styles.ctaBtnLabel}
              >
                {t('productInterest.cta', "I'm interested")}
              </Button>
            </View>
          ) : outOfStock ? (
            <Text style={[typography.body2, { color: colors.error.main, textAlign: 'center', marginBottom: spacing.sm, fontWeight: '600' }]}>
              {t('items.detail.outOfStock', 'Out of stock')}
            </Text>
          ) : foodBlocked ? (
            <Text style={[typography.body2, { color: colors.warning.dark, textAlign: 'center', marginBottom: spacing.sm, fontWeight: '600' }]}>
              {t('foods.status.notServingNow', 'Not serving now')}
            </Text>
          ) : (
            <View style={{ alignItems: 'center', marginBottom: spacing.sm }}>
              <Text style={[typography.subtitle1, { color: colors.text.primary, fontWeight: '700' }]}>
                {needsVariantPick
                  ? t('public.items.card.fromPrice', 'From {{price}}', {
                      price: formatCatalogMoney(fromPrice, currency),
                    })
                  : formatCatalogMoney(price, currency)}
              </Text>
              <Text style={[typography.caption, { color: colors.text.secondary, marginTop: 2, textAlign: 'center' }]}>
                {!paymentsEnabled
                  ? t(
                      'catalog.paymentsComingSoonDetail',
                      'Payments at this location are coming soon.'
                    )
                  : openingSoon
                  ? t(
                      'checkout.merchantNotAcceptingOrders',
                      'This merchant is currently completing account setup and is not yet accepting orders.'
                    )
                  : isStripeRail
                    ? t('items.detail.checkoutHintCard', 'Card at checkout')
                    : t('items.detail.checkoutHint', 'MoMo at checkout')}
              </Text>
            </View>
          )}
          {!interestOnly ? (
          <View style={styles.bottomBarRow}>
            <Button
              mode={inCart ? 'contained-tonal' : 'outlined'}
              icon={inCart ? 'cart-check' : 'cart-plus'}
              onPress={onAddToCart}
              disabled={
                orderBlocked ||
                !variantSelectionReady ||
                !paymentsEnabled ||
                !acceptsOrders
              }
              style={{ flex: 1, borderRadius: borderRadius.button }}
              contentStyle={styles.ctaBtnContent}
              labelStyle={styles.ctaBtnLabel}
              accessibilityLabel={
                inCart
                  ? t('cart.inCartA11y', 'In cart, quantity {{count}}. Add more', {
                      count: inCartQuantity,
                    })
                  : t('cart.addToCart', 'Add to cart')
              }
            >
              {addToCartLabel}
            </Button>
            <Button
              mode="contained"
              onPress={onBuy}
              disabled={orderBlocked || !acceptsOrders || !paymentsEnabled || !variantSelectionReady}
              style={{ flex: 1.12, borderRadius: borderRadius.button }}
              contentStyle={styles.ctaBtnContent}
              labelStyle={styles.ctaBtnLabel}
              accessibilityLabel={
                outOfStock
                  ? t('items.detail.outOfStock', 'Out of stock')
                  : foodBlocked
                    ? t('foods.status.notServingNow', 'Not serving now')
                  : !acceptsOrders
                    ? t('checkout.merchantNotAcceptingOrders', 'This merchant is not yet accepting orders.')
                    : !variantSelectionReady
                      ? t('client.placeOrder.selectVariant', 'Select an option')
                    : t('public.items.card.buyNowA11y', 'Buy {{name}}', { name: item.item.name })
              }
            >
              {foodBlocked
                ? t('foods.status.notServingNow', 'Not serving now')
                : !outOfStock && (!acceptsOrders || !paymentsEnabled)
                ? t('catalog.paymentsComingSoon', 'Coming soon')
                : t('public.items.buyNow', 'Buy')}
            </Button>
          </View>
          ) : null}
          {!interestOnly && inCart ? (
            <View style={{ alignItems: 'center', marginTop: spacing.sm }}>
              <StatusPill
                label={inCartLabel}
                backgroundColor={colors.primaryTint}
                textColor={colors.primary.main}
                icon="cart-check"
                compact
              />
            </View>
          ) : null}
        </View>

      <ProductInterestSheet
        visible={interestOpen}
        itemName={item.item.name}
        submitting={interestSubmitting}
        onDismiss={() => setInterestOpen(false)}
        onSubmit={async (note) => {
          setInterestSubmitting(true);
          try {
            await submitInterest(inventoryItemId, note);
            setInterestOpen(false);
            setSnack(
              t(
                'productInterest.success',
                'Interest sent. The seller will contact you.'
              )
            );
          } catch (e: any) {
            setSnack(
              e?.message ||
                t('productInterest.error', 'Could not send interest')
            );
          } finally {
            setInterestSubmitting(false);
          }
        }}
      />

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
        {snack}
      </Snackbar>

      <PublicItemCheckoutSheet
        visible={checkoutOpen}
        inventoryItemId={inventoryItemId}
        item={checkoutSheetItem}
        onDismiss={() => setCheckoutOpen(false)}
        resolvedVerificationMethod={preflightConfig?.verification_method ?? null}
        resolvingCheckout={preflightLoading}
        preflightBlocker={firstBlocker}
      />
    </View>
  );
}

export default observer(InventoryItemDetailScreen);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  brandRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  trustRow: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  shipCard: { marginTop: 16, padding: 12, borderWidth: 1 },
  bottomBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  bottomBarRow: {
    flexDirection: 'row',
    gap: 10,
  },
  /** 52dp height for CTA buttons (design spec: preferred 52dp) */
  ctaBtnContent: { height: 52 },
  ctaBtnLabel: { fontSize: 15, fontWeight: '700' },
});
