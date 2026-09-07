import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrdersApi } from '../../contexts/OrdersApiContext';
import { useStore } from '@/stores/RootStore';
import type { BusinessOrder } from '../../types/business/orders';
import type { ConfirmOrderPayload } from '../../types/business/orders';
import type { BusinessOrderActionId } from '../../utils/businessOrderActions';
import { syncFirstOrderPinAfterOrderUpdate } from '@/utils/firstOrderPinSync';

export type BusinessImmediateActionResult =
  | { type: 'overwriteCode'; code?: string }
  | { type: 'printLabelHint' }
  | { type: 'manageRefunds' };

type PinOrder = Pick<BusinessOrder, 'id' | 'business_id' | 'created_at'>;

export function useBusinessOrderActions(onSuccess?: () => void) {
  const { t } = useTranslation();
  const { ftue } = useStore();
  const ordersApi = useOrdersApi();
  const [actingId, setActingId] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const syncTerminalPin = useCallback(
    async (order: PinOrder, terminalStatus: string) => {
      await syncFirstOrderPinAfterOrderUpdate(
        { ...order, current_status: terminalStatus },
        { convertNudge: (id) => ftue.convertNudge(id) }
      );
    },
    [ftue]
  );

  const finish = useCallback(() => {
    onSuccess?.();
    setActingId(null);
  }, [onSuccess]);

  const fail = useCallback((e: unknown, fallback: string) => {
    setSnack(e instanceof Error ? e.message : fallback);
    setActingId(null);
  }, []);

  const confirmOrder = useCallback(
    async (payload: ConfirmOrderPayload) => {
      setActingId(payload.orderId);
      try {
        await ordersApi.confirm(payload);
        finish();
      } catch (e: unknown) {
        fail(e, t('business.orders.confirmFailed', 'Failed to confirm order'));
        throw e;
      }
    },
    [fail, finish, ordersApi, t]
  );

  const cancelOrder = useCallback(
    async (order: BusinessOrder, notes: string) => {
      setActingId(order.id);
      try {
        await ordersApi.cancel({ orderId: order.id, notes });
        await syncTerminalPin(order, 'cancelled');
        finish();
      } catch (e: unknown) {
        fail(e, t('orders.cancelFailed', 'Failed to cancel order'));
        throw e;
      }
    },
    [fail, finish, ordersApi, syncTerminalPin, t]
  );

  const runImmediateAction = useCallback(
    async (
      order: BusinessOrder,
      actionId: BusinessOrderActionId
    ): Promise<BusinessImmediateActionResult | true | false> => {
      setActingId(order.id);
      try {
        if (actionId === 'completePreparation') {
          await ordersApi.completePreparation({ orderId: order.id });
          finish();
          return true;
        }
        if (actionId === 'completeOrder') {
          if (!ordersApi.complete) {
            finish();
            return true;
          }
          await ordersApi.complete({ orderId: order.id });
          await syncTerminalPin(order, 'complete');
          finish();
          return true;
        }
        if (actionId === 'confirmClientPickup') {
          finish();
          return true;
        }
        if (actionId === 'manageRefunds') {
          finish();
          return { type: 'manageRefunds' as const };
        }
        if (actionId === 'generateOverwriteCode') {
          if (!ordersApi.generateDeliveryOverwriteCode) {
            finish();
            return true;
          }
          const res = await ordersApi.generateDeliveryOverwriteCode(order.id);
          finish();
          return { type: 'overwriteCode', code: res.overwriteCode };
        }
        if (actionId === 'printLabel') {
          setActingId(null);
          return { type: 'printLabelHint' };
        }
        finish();
        return true;
      } catch (e: unknown) {
        fail(e, t('business.orders.actionFailed', 'Action failed'));
        return false;
      }
    },
    [fail, finish, ordersApi, syncTerminalPin, t]
  );

  const confirmClientPickup = useCallback(
    async (
      order: BusinessOrder,
      pin: string,
      options?: { useLatestSharedPin?: boolean; pinMessageId?: string }
    ) => {
      setActingId(order.id);
      try {
        await ordersApi.confirmClientPickup(order.id, pin, options);
        await syncTerminalPin(order, 'complete');
        finish();
      } catch (e: unknown) {
        setActingId(null);
        throw e;
      }
    },
    [finish, ordersApi, syncTerminalPin]
  );

  const requestPickupPayment = useCallback(
    async (orderId: string, phoneNumber?: string) => {
      setActingId(orderId);
      try {
        await ordersApi.initiatePayAtPickupPayment(
          orderId,
          phoneNumber ? { phone_number: phoneNumber } : undefined
        );
        finish();
      } catch (e: unknown) {
        fail(e, t('business.orders.pickupPaymentFailed', 'Failed to send payment request'));
        throw e;
      }
    },
    [fail, finish, ordersApi, t]
  );

  const markShipped = useCallback(
    async (orderId: string, fields?: { tracking_number?: string; carrier?: string }) => {
      setActingId(orderId);
      try {
        await ordersApi.markShipped(orderId, fields);
        finish();
      } catch (e: unknown) {
        fail(e, t('orders.shipping.markShippedFailed', 'Failed to mark as shipped'));
        throw e;
      }
    },
    [fail, finish, ordersApi, t]
  );

  const updateTracking = useCallback(
    async (orderId: string, fields: { tracking_number: string; carrier?: string }) => {
      setActingId(orderId);
      try {
        await ordersApi.updateTracking(orderId, fields);
        finish();
      } catch (e: unknown) {
        fail(e, t('orders.shipping.updateTrackingFailed', 'Failed to update tracking'));
        throw e;
      }
    },
    [fail, finish, ordersApi, t]
  );

  const reconcileCash = useCallback(
    async (orderId: string, phone: string, reference?: string, notes?: string) => {
      setActingId(orderId);
      try {
        if (!ordersApi.reconcileCashException) {
          finish();
          return;
        }
        await ordersApi.reconcileCashException(orderId, {
          customerPhone: phone,
          reference,
          notes,
        });
        finish();
      } catch (e: unknown) {
        fail(e, t('business.orders.reconcileFailed', 'Reconciliation failed'));
        throw e;
      }
    },
    [fail, finish, ordersApi, t]
  );

  return {
    actingId,
    snack,
    setSnack,
    confirmOrder,
    cancelOrder,
    runImmediateAction,
    confirmClientPickup,
    requestPickupPayment,
    markShipped,
    updateTracking,
    reconcileCash,
    mode: ordersApi.mode,
  };
}
