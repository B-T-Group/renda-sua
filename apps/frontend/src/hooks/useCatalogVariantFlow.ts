import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { CartItem } from '../contexts/CartContext';
import type { InventoryItem } from '../hooks/useInventoryItems';
import {
  buildCartItemFromInventory,
  catalogRequiresVariantSelection,
} from '../utils/catalogVariantCart';
import { toCartVariantId } from '../utils/shopperVariantSelection';

type PendingAction = 'cart' | 'order';

/**
 * Catalog add/buy flow: opens a variant picker when the listing has options
 * and no selection was already made on the card.
 */
export function useCatalogVariantFlow(params: {
  onCartBuilt: (cartItem: CartItem, item: InventoryItem) => void;
  requireAuth?: () => boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const onCartBuiltRef = useRef(params.onCartBuilt);
  onCartBuiltRef.current = params.onCartBuilt;
  const requireAuthRef = useRef(params.requireAuth);
  requireAuthRef.current = params.requireAuth;

  const [pickerItem, setPickerItem] = useState<InventoryItem | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null
  );
  const baseLabel = t('orders.variant.defaultOption', 'Default');

  const closePicker = useCallback(() => {
    setPickerItem(null);
    setPendingAction(null);
  }, []);

  const completeWithSelection = useCallback(
    (item: InventoryItem, selectionId: string, action: PendingAction) => {
      if (action === 'order') {
        const qsId = toCartVariantId(selectionId);
        const qs = qsId ? `?variantId=${encodeURIComponent(qsId)}` : '';
        navigate(`/items/${item.id}/place_order${qs}`);
        closePicker();
        return;
      }
      const cartItem = buildCartItemFromInventory(
        item,
        1,
        selectionId,
        baseLabel
      );
      if (cartItem === 'needs_variant') return;
      onCartBuiltRef.current(cartItem, item);
      closePicker();
    },
    [baseLabel, closePicker, navigate]
  );

  const requestOrder = useCallback(
    (item: InventoryItem, selectionId?: string | null) => {
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
      navigate(`/items/${item.id}/place_order`);
    },
    [completeWithSelection, navigate]
  );

  const requestAddToCart = useCallback(
    (item: InventoryItem, selectionId?: string | null) => {
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
      const cartItem = buildCartItemFromInventory(item, 1, null, baseLabel);
      if (cartItem === 'needs_variant') {
        setPendingAction('cart');
        setPickerItem(item);
        return;
      }
      onCartBuiltRef.current(cartItem, item);
    },
    [baseLabel, completeWithSelection]
  );

  const onPickerConfirm = useCallback(
    (selectionId: string) => {
      if (!pickerItem || !pendingAction) return;
      completeWithSelection(pickerItem, selectionId, pendingAction);
    },
    [completeWithSelection, pendingAction, pickerItem]
  );

  return {
    pickerItem,
    pickerOpen: pickerItem != null,
    closePicker,
    onPickerConfirm,
    requestOrder,
    requestAddToCart,
    confirmLabel:
      pendingAction === 'order'
        ? t('orders.variant.confirmOrder', 'Continue')
        : t('orders.variant.confirmSelection', 'Add to cart'),
  };
}
