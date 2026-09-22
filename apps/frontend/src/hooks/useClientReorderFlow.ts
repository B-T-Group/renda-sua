import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import type {
  ReorderCartAction,
  ReorderOrderResponse,
} from '../types/reorder';
import {
  formatSkippedNames,
  mapReorderLineToCartItem,
  resolveReorderCartAction,
} from '../utils/reorderCart';
import { useClientFlags, useReorderOrder } from './useClientFlags';
import {
  SITE_EVENT_ORDERS_REORDER_IMPRESSION,
  SITE_EVENT_ORDERS_REORDER_RESULT,
  SITE_EVENT_ORDERS_REORDER_TAP,
  useTrackSiteEvent,
} from './useTrackSiteEvent';

function isReorderEligible(status: string | undefined | null): boolean {
  return status === 'complete' || status === 'delivered';
}

export function useClientReorderFlow(
  orderId: string,
  orderStatus?: string | null
) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { cartItems, replaceItems, addItems } = useCart();
  const { flags } = useClientFlags();
  const { reorder, loading } = useReorderOrder();
  const { trackSiteEvent } = useTrackSiteEvent();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, setPending] = useState<ReorderOrderResponse | null>(null);
  const impressionSent = useRef(false);

  const enabled =
    flags.reorder_v1 === true && isReorderEligible(orderStatus);

  useEffect(() => {
    if (!enabled || impressionSent.current) return;
    impressionSent.current = true;
    void trackSiteEvent({
      eventType: SITE_EVENT_ORDERS_REORDER_IMPRESSION,
      subjectType: 'order',
      subjectId: orderId,
      metadata: { source: 'web' },
    });
  }, [enabled, orderId, trackSiteEvent]);

  const toastSkips = useCallback(
    (payload: ReorderOrderResponse) => {
      const names = payload.skipped.map((s) => s.name);
      if (!names.length) return;
      const list = formatSkippedNames(names, (n) =>
        t('orders.reorder.andMore', 'and {{count}} more', { count: n })
      );
      enqueueSnackbar(
        t('orders.reorder.skippedToast', 'Unavailable: {{names}}', {
          names: list,
        }),
        { variant: 'warning' }
      );
    },
    [enqueueSnackbar, t]
  );

  const navigateAfter = useCallback(
    (payload: ReorderOrderResponse, cartAction: ReorderCartAction) => {
      void trackSiteEvent({
        eventType: SITE_EVENT_ORDERS_REORDER_RESULT,
        subjectType: 'order',
        subjectId: orderId,
        metadata: {
          source: 'web',
          dest: payload.navigation_hint,
          skipped_count: payload.skipped.length,
          cart_action: cartAction,
        },
      });
      toastSkips(payload);
      if (payload.navigation_hint === 'none') return;

      if (payload.navigation_hint === 'checkout') {
        navigate('/checkout', {
          state: {
            deliveryAddressId: payload.fulfillment.address_id ?? undefined,
            fulfillmentMethod: payload.fulfillment.type,
          },
        });
        return;
      }

      let reorderBanner: 'business_closed' | 'address_invalid' | undefined;
      if (!payload.fulfillment.business_accepting_orders) {
        reorderBanner = 'business_closed';
      } else if (!payload.fulfillment.address_valid) {
        reorderBanner = 'address_invalid';
      }
      navigate('/cart', { state: { reorderBanner } });
    },
    [navigate, orderId, toastSkips, trackSiteEvent]
  );

  const applyLines = useCallback(
    (payload: ReorderOrderResponse, action: 'replace' | 'add') => {
      const items = payload.lines.map((line) =>
        mapReorderLineToCartItem(line, payload.business_id)
      );
      if (action === 'replace') replaceItems(items);
      else addItems(items);
      navigateAfter(payload, action);
    },
    [addItems, navigateAfter, replaceItems]
  );

  const onReorderPress = useCallback(async () => {
    void trackSiteEvent({
      eventType: SITE_EVENT_ORDERS_REORDER_TAP,
      subjectType: 'order',
      subjectId: orderId,
      metadata: { source: 'web' },
    });
    try {
      const payload = await reorder(orderId);
      if (payload.lines.length === 0) {
        navigateAfter(payload, 'replace');
        return;
      }
      const cartBizIds = [...new Set(cartItems.map((i) => i.businessId))];
      const decision = resolveReorderCartAction(
        cartBizIds,
        payload.business_id
      );
      if (decision === 'replace') {
        applyLines(payload, 'replace');
        return;
      }
      setPending(payload);
      setSheetOpen(true);
      if (decision === 'blocked_other_store') {
        enqueueSnackbar(
          t(
            'orders.reorder.otherStoreToast',
            'Your cart has items from another store'
          ),
          { variant: 'warning' }
        );
      }
    } catch (err: any) {
      enqueueSnackbar(
        err?.response?.data?.message ||
          err?.message ||
          t('orders.reorder.failed', 'Could not reorder. Try again.'),
        { variant: 'error' }
      );
    }
  }, [
    applyLines,
    cartItems,
    enqueueSnackbar,
    navigateAfter,
    orderId,
    reorder,
    t,
    trackSiteEvent,
  ]);

  const onReplace = useCallback(() => {
    if (!pending) return;
    setSheetOpen(false);
    applyLines(pending, 'replace');
    setPending(null);
  }, [applyLines, pending]);

  const onAdd = useCallback(() => {
    if (!pending) return;
    const cartBizIds = [...new Set(cartItems.map((i) => i.businessId))];
    const decision = resolveReorderCartAction(
      cartBizIds,
      pending.business_id
    );
    if (decision === 'blocked_other_store') {
      enqueueSnackbar(
        t(
          'orders.reorder.otherStoreToast',
          'Your cart has items from another store'
        ),
        { variant: 'warning' }
      );
      return;
    }
    setSheetOpen(false);
    applyLines(pending, 'add');
    setPending(null);
  }, [applyLines, cartItems, enqueueSnackbar, pending, t]);

  const onDismissSheet = useCallback(() => {
    setSheetOpen(false);
    setPending(null);
  }, []);

  const allowAdd =
    !!pending &&
    resolveReorderCartAction(
      [...new Set(cartItems.map((i) => i.businessId))],
      pending.business_id
    ) !== 'blocked_other_store';

  return {
    enabled,
    loading,
    sheetOpen,
    allowAdd,
    otherStoreBlocked: !!pending && !allowAdd,
    onReorderPress,
    onReplace,
    onAdd,
    onDismissSheet,
  };
}
