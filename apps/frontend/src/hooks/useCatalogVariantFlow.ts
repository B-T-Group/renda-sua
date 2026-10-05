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

type AuthGuard = (
  run: () => void | Promise<void>
) => boolean | Promise<boolean>;

/** Runs the catalog action after auth. A guard that returns true without calling run still continues. */
export async function runAfterAuthGuard(
  guard: AuthGuard | undefined,
  run: () => void | Promise<void>
): Promise<boolean> {
  if (!guard) {
    await run();
    return true;
  }
  let invoked = false;
  const wrapped = () => {
    invoked = true;
    return run();
  };
  const result = guard(wrapped);
  const ok = result instanceof Promise ? await result : result;
  if (ok && !invoked) await run();
  return ok;
}

/**
 * Catalog add/buy flow: opens a variant picker when the listing has options
 * and no selection was already made on the card.
 */
export function useCatalogVariantFlow(params: {
  onCartBuilt: (cartItem: CartItem, item: InventoryItem) => void;
  requireAuth?: (run: () => void | Promise<void>) => boolean | Promise<boolean>;
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

  const guardAuth = useCallback(
    (run: () => void | Promise<void>) =>
      runAfterAuthGuard(requireAuthRef.current, run),
    []
  );

  const requestOrder = useCallback(
    async (item: InventoryItem, selectionId?: string | null) => {
      const execute = () => {
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
      };
      if (requireAuthRef.current) {
        const ok = await guardAuth(execute);
        if (!ok) return;
        return;
      }
      execute();
    },
    [completeWithSelection, guardAuth, navigate]
  );

  const requestAddToCart = useCallback(
    async (item: InventoryItem, selectionId?: string | null) => {
      const execute = () => {
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
      };
      if (requireAuthRef.current) {
        const ok = await guardAuth(execute);
        if (!ok) return;
        return;
      }
      execute();
    },
    [baseLabel, completeWithSelection, guardAuth]
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
