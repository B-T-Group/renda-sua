import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useClientFlags } from '../contexts/ClientFlagsContext';
import { useReorderOrder } from './useReorderOrder';
import { useStore } from '../stores/RootStore';
import type { ClientRootStackParamList } from '../navigation/types';
import type {
  ReorderCartAction,
  ReorderOrderResponse,
} from '../types/reorder';
import { trackReorderEvent } from '../utils/reorderAnalytics';
import {
  formatSkippedNames,
  mapReorderLineToCartLine,
  resolveReorderCartAction,
} from '../utils/reorderCart';

type Nav = NativeStackNavigationProp<ClientRootStackParamList>;

function isReorderEligible(status: string | undefined | null): boolean {
  return status === 'complete' || status === 'delivered';
}

export function useClientReorderFlow(orderId: string, orderStatus?: string | null) {
  const { t } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { flags } = useClientFlags();
  const { cart } = useStore();
  const { reorder, loading } = useReorderOrder();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [pending, setPending] = useState<ReorderOrderResponse | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const impressionSent = useRef(false);

  const enabled =
    flags.reorder_v1 === true && isReorderEligible(orderStatus);

  useEffect(() => {
    if (!enabled || impressionSent.current) return;
    impressionSent.current = true;
    trackReorderEvent('reorder_impression', { orderId });
  }, [enabled, orderId]);

  const buildSkipToast = useCallback(
    (payload: ReorderOrderResponse) => {
      const names = payload.skipped.map((s) => s.name);
      if (names.length === 0) return null;
      const list = formatSkippedNames(names, (n) =>
        t('orders.reorder.andMore', 'and {{count}} more', { count: n })
      );
      return t(
        'orders.reorder.skippedToast',
        'Unavailable: {{names}}',
        { names: list }
      );
    },
    [t]
  );

  const navigateAfterApply = useCallback(
    (payload: ReorderOrderResponse, cartAction: ReorderCartAction) => {
      trackReorderEvent('reorder_result', {
        orderId,
        dest: payload.navigation_hint,
        skipped_count: payload.skipped.length,
        cart_action: cartAction,
      });
      const skipToast = buildSkipToast(payload);
      if (skipToast) setSnack(skipToast);

      if (payload.navigation_hint === 'none') return;

      if (payload.navigation_hint === 'checkout') {
        navigation.navigate('CartCheckout', {
          deliveryAddressId: payload.fulfillment.address_id ?? undefined,
          fulfillmentMethod: payload.fulfillment.type,
        });
        return;
      }

      let banner: 'business_closed' | 'address_invalid' | undefined;
      if (!payload.fulfillment.business_accepting_orders) {
        banner = 'business_closed';
      } else if (!payload.fulfillment.address_valid) {
        banner = 'address_invalid';
      }
      navigation.navigate('Cart', banner ? { reorderBanner: banner } : undefined);
    },
    [buildSkipToast, navigation, orderId]
  );

  const applyLines = useCallback(
    (payload: ReorderOrderResponse, action: 'replace' | 'add') => {
      const lines = payload.lines.map((line) =>
        mapReorderLineToCartLine(line, payload.business_id)
      );
      if (action === 'replace') cart.replaceLines(lines);
      else cart.addLines(lines);
      navigateAfterApply(payload, action);
    },
    [cart, navigateAfterApply]
  );

  const onReorderPress = useCallback(async () => {
    trackReorderEvent('reorder_tap', { orderId });
    try {
      const payload = await reorder(orderId);
      if (payload.lines.length === 0) {
        navigateAfterApply(payload, 'replace');
        return;
      }
      const cartBizIds = [...new Set(cart.items.map((l) => l.businessId))];
      const decision = resolveReorderCartAction(cartBizIds, payload.business_id);
      if (decision === 'replace') {
        applyLines(payload, 'replace');
        return;
      }
      setPending(payload);
      setSheetOpen(true);
      if (decision === 'blocked_other_store') {
        setSnack(
          t(
            'orders.reorder.otherStoreToast',
            'Your cart has items from another store'
          )
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : t('orders.reorder.failed', 'Could not reorder. Try again.');
      setSnack(msg);
    }
  }, [applyLines, cart.items, navigateAfterApply, orderId, reorder, t]);

  const onReplace = useCallback(() => {
    if (!pending) return;
    setSheetOpen(false);
    applyLines(pending, 'replace');
    setPending(null);
  }, [applyLines, pending]);

  const onAdd = useCallback(() => {
    if (!pending) return;
    const cartBizIds = [...new Set(cart.items.map((l) => l.businessId))];
    const decision = resolveReorderCartAction(cartBizIds, pending.business_id);
    if (decision === 'blocked_other_store') {
      setSnack(
        t(
          'orders.reorder.otherStoreToast',
          'Your cart has items from another store'
        )
      );
      return;
    }
    setSheetOpen(false);
    applyLines(pending, 'add');
    setPending(null);
  }, [applyLines, cart.items, pending, t]);

  const onDismissSheet = useCallback(() => {
    setSheetOpen(false);
    setPending(null);
  }, []);

  const allowAdd =
    !!pending &&
    resolveReorderCartAction(
      [...new Set(cart.items.map((l) => l.businessId))],
      pending.business_id
    ) !== 'blocked_other_store';

  return {
    enabled,
    loading,
    sheetOpen,
    allowAdd,
    otherStoreBlocked: !!pending && !allowAdd,
    snack,
    setSnack,
    onReorderPress,
    onReplace,
    onAdd,
    onDismissSheet,
  };
}
