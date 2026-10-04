import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CatalogInventoryItem } from '../types/inventoryCatalog';
import { scheduleMetaAddToCart } from '../services/metaConversionsApi';
import { useStore } from '../stores/RootStore';
import {
  catalogRequiresVariantSelection,
  catalogUnitPriceForSelection,
} from '../utils/buildCartLineFromCatalog';
import type { PlaceOrderParams } from '../navigation/types';
import { toCartVariantId } from '../utils/shopperVariantSelection';

type PendingAction = 'cart' | 'order';

export type PickerConfirmResult = 'added' | 'closed' | 'unchanged';

export function placeOrderParamsFromCatalog(
  item: CatalogInventoryItem,
  cartVariantId?: string,
  quantity?: number
): PlaceOrderParams {
  const qty = Math.max(1, Math.floor(quantity ?? 1));
  return {
    inventoryItemId: item.id,
    ...(cartVariantId ? { variantId: cartVariantId } : {}),
    quantity: qty,
  };
}

function emitAddToCartMeta(
  item: CatalogInventoryItem,
  selectionId: string | null | undefined,
  isAuthenticated: boolean,
  quantity: number
): void {
  const qty = Math.max(1, quantity);
  const unit = catalogUnitPriceForSelection(item, selectionId);
  scheduleMetaAddToCart(
    {
      inventoryItemId: item.id,
      quantity: qty,
      value: unit * qty,
      currency: item.item.currency,
      contentName: item.item.name,
    },
    isAuthenticated
  );
}

/**
 * Catalog add/buy flow: opens a variant picker when the listing has options
 * and no selection was already made on the card.
 */
export function useCatalogVariantFlow(params: {
  onCartResult?: (result: 'added' | 'updated') => void;
  onPlaceOrder: (
    item: CatalogInventoryItem,
    cartVariantId?: string,
    quantity?: number
  ) => void;
  requireAuth?: () => boolean;
}) {
  const { t } = useTranslation();
  const { cart, auth } = useStore();
  const onCartResultRef = useRef(params.onCartResult);
  onCartResultRef.current = params.onCartResult;
  const onPlaceOrderRef = useRef(params.onPlaceOrder);
  onPlaceOrderRef.current = params.onPlaceOrder;
  const requireAuthRef = useRef(params.requireAuth);
  requireAuthRef.current = params.requireAuth;

  const [pickerItem, setPickerItem] = useState<CatalogInventoryItem | null>(
    null
  );
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null
  );
  const baseLabel = t('orders.variant.defaultOption', 'Default');

  const closePicker = useCallback(() => {
    setPickerItem(null);
    setPendingAction(null);
  }, []);

  const completeWithSelection = useCallback(
    (
      item: CatalogInventoryItem,
      selectionId: string,
      action: PendingAction,
      quantity = 1
    ): PickerConfirmResult => {
      if (action === 'order') {
        const cartVariantId = toCartVariantId(selectionId);
        onPlaceOrderRef.current(item, cartVariantId, Math.max(1, quantity));
        closePicker();
        return 'closed';
      }
      const before = cart.quantityForLine(item.id, toCartVariantId(selectionId));
      const result = cart.addFromCatalog(item, Math.max(1, quantity), selectionId, baseLabel);
      if (result === 'needs_variant') return 'unchanged';
      const after = cart.quantityForLine(item.id, toCartVariantId(selectionId));
      const added = after - before;
      if (added <= 0) return 'unchanged';
      emitAddToCartMeta(item, selectionId, auth.isAuthenticated, added);
      onCartResultRef.current?.(result);
      return 'added';
    },
    [auth.isAuthenticated, baseLabel, cart, closePicker]
  );

  const requestBuy = useCallback(
    (item: CatalogInventoryItem, selectionId?: string | null) => {
      if (requireAuthRef.current && !requireAuthRef.current()) return;
      if (catalogRequiresVariantSelection(item)) {
        if (selectionId) {
          completeWithSelection(item, selectionId, 'order');
          return;
        }
        setPendingAction('order');
        setPickerItem(item);
        return;
      }
      onPlaceOrderRef.current(item);
    },
    [completeWithSelection]
  );

  const requestAddToCart = useCallback(
    (item: CatalogInventoryItem, selectionId?: string | null) => {
      if (requireAuthRef.current && !requireAuthRef.current()) return;
      if (catalogRequiresVariantSelection(item)) {
        if (selectionId) {
          completeWithSelection(item, selectionId, 'cart');
          return;
        }
        setPendingAction('cart');
        setPickerItem(item);
        return;
      }
      const before = cart.quantityForLine(item.id, null);
      const result = cart.addFromCatalog(item, 1, null, baseLabel);
      if (result === 'needs_variant') {
        setPendingAction('cart');
        setPickerItem(item);
        return;
      }
      const after = cart.quantityForLine(item.id, null);
      const added = after - before;
      if (added > 0) {
        emitAddToCartMeta(item, null, auth.isAuthenticated, added);
        onCartResultRef.current?.(result);
      }
    },
    [auth.isAuthenticated, baseLabel, cart, completeWithSelection]
  );

  const onPickerConfirm = useCallback(
    (selectionId: string, quantity = 1): PickerConfirmResult => {
      if (!pickerItem || !pendingAction) return 'unchanged';
      return completeWithSelection(pickerItem, selectionId, pendingAction, quantity);
    },
    [completeWithSelection, pendingAction, pickerItem]
  );

  return {
    pickerItem,
    pickerOpen: pickerItem != null,
    closePicker,
    onPickerConfirm,
    requestBuy,
    requestAddToCart,
    confirmLabel:
      pendingAction === 'order'
        ? t('orders.variant.confirmOrder', 'Continue')
        : t('orders.variant.confirmSelection', 'Add to cart'),
  };
}
