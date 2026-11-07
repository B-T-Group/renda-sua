import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { agentApi } from '../services/agentApi';
import type { Order } from '../types/agent';
import type { OrderPrimaryActionId } from '../utils/orderPhase';

type Options = {
  onOpenOrder: (order: Order) => void;
  onMutated?: () => void | Promise<void>;
  onSnack?: (message: string) => void;
};

async function runConfirmReceipt(orderId: string): Promise<void> {
  await agentApi.orders.confirmReceipt(orderId);
}

async function runComplete(order: Order): Promise<void> {
  if (order.fulfillment_method === 'pickup') {
    await agentApi.orders.completePickup(order.id);
    return;
  }
  await agentApi.orders.complete({ orderId: order.id });
}

function isInlineCompleteAction(action: OrderPrimaryActionId): boolean {
  return action === 'confirm_receipt' || action === 'complete';
}

export function useClientHomeOrderCta({ onOpenOrder, onMutated, onSnack }: Options) {
  const { t } = useTranslation();
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const busyRef = useRef(false);

  const runInlineAction = useCallback(
    async (order: Order, action: OrderPrimaryActionId) => {
      if (action === 'confirm_receipt') await runConfirmReceipt(order.id);
      else await runComplete(order);
      await onMutated?.();
      onSnack?.(
        t('orders.clientConfirm.confirmDone', 'Thanks! Your order is complete.')
      );
    },
    [onMutated, onSnack, t]
  );

  const onPressCta = useCallback(
    async (order: Order, primaryActionId: OrderPrimaryActionId) => {
      if (busyRef.current) return;
      if (!isInlineCompleteAction(primaryActionId)) {
        onOpenOrder(order);
        return;
      }
      busyRef.current = true;
      setBusyOrderId(order.id);
      try {
        await runInlineAction(order, primaryActionId);
      } catch (e: unknown) {
        onSnack?.(
          e instanceof Error
            ? e.message
            : t('orders.shipping.receiptFailed', 'Failed to confirm receipt')
        );
      } finally {
        busyRef.current = false;
        setBusyOrderId(null);
      }
    },
    [onOpenOrder, onSnack, runInlineAction, t]
  );

  return { onPressCta, busyOrderId };
}
