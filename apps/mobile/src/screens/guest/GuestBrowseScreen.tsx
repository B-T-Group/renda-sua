import React, { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { Snackbar } from 'react-native-paper';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { GuestTabParamList } from '../../navigation/types';
import type { CatalogInventoryItem } from '../../types/inventoryCatalog';
import { PublicItemCheckoutSheet } from '../../components/dialogs/PublicItemCheckoutSheet';
import { BrowseCartFab } from '../../components/browse/BrowseCartFab';
import { CatalogVariantPickerDialog } from '../../components/browse/CatalogVariantPickerDialog';
import { catalogItemToCheckoutSummary } from '../../utils/catalogInventoryDisplay';
import { BrowseCatalogScreen } from '../shared/BrowseCatalogScreen';
import { useCatalogVariantFlow } from '../../hooks/useCatalogVariantFlow';
import { useResolvedCheckout } from '../../hooks/useResolvedCheckout';
import { toOrderItemVariantId } from '../../utils/shopperVariantSelection';

export default observer(function GuestBrowseScreen({
  foodOnly = false,
}: {
  foodOnly?: boolean;
}) {
  const { t } = useTranslation();
  const navigation = useNavigation<BottomTabNavigationProp<GuestTabParamList>>();
  const [checkoutCatalogItem, setCheckoutCatalogItem] = useState<CatalogInventoryItem | null>(null);
  const [checkoutVariantId, setCheckoutVariantId] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const itemCountryCode = checkoutCatalogItem?.business_location?.address?.country?.trim().toUpperCase() ?? undefined;

  const onPlaceOrder = useCallback(
    (catalogItem: CatalogInventoryItem, cartVariantId?: string) => {
      setCheckoutVariantId(cartVariantId ?? null);
      setCheckoutCatalogItem(catalogItem);
    },
    []
  );

  const variantFlow = useCatalogVariantFlow({
    onPlaceOrder,
    onCartResult: (result) => {
      setSnack(
        result === 'added'
          ? t('cart.itemAdded', 'Added to cart')
          : t('cart.itemUpdated', 'Cart updated')
      );
    },
  });

  const preflightRequest = useMemo(() => {
    if (!checkoutCatalogItem) return null;
    const orderVariantId = toOrderItemVariantId(checkoutVariantId);
    return {
      items: [
        {
          business_inventory_id: checkoutCatalogItem.id,
          quantity: 1,
          ...(orderVariantId ? { item_variant_id: orderVariantId } : {}),
        },
      ],
      provisional_country: itemCountryCode,
    };
  }, [checkoutCatalogItem, checkoutVariantId, itemCountryCode]);

  const { config: preflightConfig, loading: preflightLoading } = useResolvedCheckout({
    request: preflightRequest,
    enabled: !!checkoutCatalogItem,
  });

  const firstBlocker = preflightConfig?.blocking_errors?.[0]?.message ?? null;

  const onItemPress = useCallback(
    (inventoryItemId: string) => {
      (navigation.getParent() as { navigate?: (name: string, params: object) => void } | undefined)?.navigate?.(
        'InventoryItemDetail',
        { inventoryItemId }
      );
    },
    [navigation]
  );

  const onCollectionPress = useCallback(
    (slug: string) => {
      (navigation.getParent() as { navigate?: (name: string, params: object) => void } | undefined)?.navigate?.(
        'CollectionDetail',
        { slug }
      );
    },
    [navigation]
  );

  const onStorePress = useCallback(
    (businessLocationId: string) => {
      (navigation.getParent() as { navigate?: (name: string, params: object) => void } | undefined)?.navigate?.(
        'StoreDetail',
        { businessId: businessLocationId }
      );
    },
    [navigation]
  );

  const onSeeAllStores = useCallback(() => {
    (navigation.getParent() as { navigate?: (name: string) => void } | undefined)?.navigate?.(
      'StoresList'
    );
  }, [navigation]);

  const checkoutSummary = useMemo(() => {
    if (!checkoutCatalogItem) return null;
    return catalogItemToCheckoutSummary(
      checkoutCatalogItem,
      t('public.items.detail.navTitle', 'Item')
    );
  }, [checkoutCatalogItem, t]);

  const dismissCheckout = useCallback(() => {
    setCheckoutCatalogItem(null);
    setCheckoutVariantId(null);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <BrowseCatalogScreen
        foodOnly={foodOnly}
        onGuestBuyNow={variantFlow.requestBuy}
        onAddToCart={variantFlow.requestAddToCart}
        onItemPress={onItemPress}
        onCollectionPress={onCollectionPress}
        onStorePress={onStorePress}
        onSeeAllStores={onSeeAllStores}
        onLoginRequired={() => {
          (navigation as { navigate?: (name: string, params?: object) => void }).navigate?.(
            'GuestAuth',
            { screen: 'Login' }
          );
        }}
      />
      <BrowseCartFab />
      <CatalogVariantPickerDialog
        open={variantFlow.pickerOpen}
        item={variantFlow.pickerItem}
        onDismiss={variantFlow.closePicker}
        onConfirm={variantFlow.onPickerConfirm}
        confirmLabel={variantFlow.confirmLabel}
      />
      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2500}>
        {snack}
      </Snackbar>
      {checkoutCatalogItem && checkoutSummary ? (
        <PublicItemCheckoutSheet
          visible
          inventoryItemId={checkoutCatalogItem.id}
          item={checkoutSummary}
          onDismiss={dismissCheckout}
          resolvedVerificationMethod={preflightConfig?.verification_method ?? null}
          resolvingCheckout={preflightLoading}
          preflightBlocker={firstBlocker}
        />
      ) : null}
    </View>
  );
});
