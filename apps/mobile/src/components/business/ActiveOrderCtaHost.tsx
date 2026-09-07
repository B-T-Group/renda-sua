import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomOverlaySnackbar } from '../feedback/BottomOverlaySnackbar';
import { ActionLoadingDialog } from '../feedback/ActionLoadingDialog';
import type { ActionLoadingKind } from '../feedback/actionLoadingKinds';
import { ConfirmActionDialog } from '../dialogs/ConfirmActionDialog';
import { SimpleMessageDialog } from '../dialogs/SimpleMessageDialog';
import { useBusinessOrderActions } from '../../hooks/business/useBusinessOrderActions';
import type { BusinessOrder } from '../../types/business/orders';
import {
  getBusinessOrderActions,
  type BusinessOrderActionId,
} from '../../utils/businessOrderActions';
import { BusinessConfirmOrderDialog } from './BusinessConfirmOrderDialog';
import { BusinessMarkShippedSheet } from './BusinessMarkShippedSheet';
import { useActivePickupPin } from '../../hooks/business/useActivePickupPin';
import { BusinessConfirmPickupPinDialog } from './BusinessConfirmPickupPinDialog';
import { BusinessPickupPaymentDialog } from './BusinessPickupPaymentDialog';
import { ReconcileCashDialog } from './ReconcileCashDialog';
import type { BusinessRootStackParamList } from '@/navigation/types';

function waitForModalDismiss(ms = 350): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, ms);
    });
  });
}

type PendingConfirm = {
  actionId: BusinessOrderActionId;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
};

type Props = {
  order: BusinessOrder | null;
  /** Increment to fire the primary action for `order`. */
  requestId: number;
  onSuccess?: () => void;
  onNavigateDetail?: (orderId: string) => void;
};

/**
 * Runs the merchant primary fulfillment action for an Active Orders card CTA
 * (confirm, mark ready, pickup PIN, etc.) without leaving the dashboard.
 */
export function ActiveOrderCtaHost({
  order,
  requestId,
  onSuccess,
  onNavigateDetail,
}: Props) {
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();
  const {
    actingId,
    snack,
    setSnack,
    confirmOrder,
    runImmediateAction,
    confirmClientPickup,
    requestPickupPayment,
    markShipped,
    updateTracking,
    reconcileCash,
  } = useBusinessOrderActions(onSuccess);

  const acting = !!order && actingId === order.id;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [pickupPinOpen, setPickupPinOpen] = useState(false);
  const [pickupPinError, setPickupPinError] = useState<string | null>(null);
  const {
    autoSharedPin,
    autoPinMessageId,
    resolvingSharedPin,
    noSharedPin,
    resetSharedPinState,
  } = useActivePickupPin(order?.id ?? '', pickupPinOpen);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [shipMode, setShipMode] = useState<'ship' | 'update'>('ship');
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(
    null
  );
  const [infoDialog, setInfoDialog] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [immediateKind, setImmediateKind] = useState<ActionLoadingKind | null>(
    null
  );
  const lastRequestRef = useRef(0);

  const runAction = useCallback(
    async (actionOrder: BusinessOrder, actionId: BusinessOrderActionId) => {
      const result = await runImmediateAction(actionOrder, actionId);
      if (result === false) return;
      if (typeof result === 'object' && result?.type === 'overwriteCode') {
        setInfoDialog({
          title: t('business.orders.overwriteCodeTitle', 'Overwrite code'),
          message:
            result.code ??
            t(
              'business.orders.overwriteCodeBody',
              'Share this code with the delivery agent.'
            ),
        });
      } else if (typeof result === 'object' && result?.type === 'manageRefunds') {
        navigation.navigate('BusinessRefundsList');
      }
    },
    [navigation, runImmediateAction, t]
  );

  const handlePrimary = useCallback(
    (actionOrder: BusinessOrder, actionId: BusinessOrderActionId) => {
      if (actionId === 'confirm') {
        setConfirmOpen(true);
        return;
      }
      if (actionId === 'reconcileCash') {
        setReconcileOpen(true);
        return;
      }
      if (actionId === 'requestPickupPayment') {
        setPickupOpen(true);
        return;
      }
      if (actionId === 'manageRefunds') {
        navigation.navigate('BusinessRefundsList');
        return;
      }
      if (actionId === 'markShipped') {
        setShipMode('ship');
        setShipOpen(true);
        return;
      }
      if (actionId === 'updateTracking') {
        setShipMode('update');
        setShipOpen(true);
        return;
      }
      if (actionId === 'completePreparation') {
        const isPickup = actionOrder.fulfillment_method === 'pickup';
        setPendingConfirm({
          actionId,
          title: t('business.orders.readyConfirmTitle', 'Mark ready for pickup?'),
          message: isPickup
            ? t(
                'business.orders.readyConfirmBodyStore',
                'The customer will be notified their order is ready to collect at your store. When they arrive, ask for their pickup PIN to confirm the handoff and capture payment.'
              )
            : t(
                'business.orders.readyConfirmBody',
                'The order will be ready for agent pickup.'
              ),
          confirmLabel: t('orderActions.readyForPickup', 'Set as ready'),
        });
        return;
      }
      if (actionId === 'completeOrder') {
        setPendingConfirm({
          actionId,
          title: t('orders.actions.completeOrder', 'Complete Order'),
          message: t(
            'orders.confirmCompleteMessage',
            'Mark this order as complete?'
          ),
          confirmLabel: t('orders.actions.completeOrder', 'Complete Order'),
        });
        return;
      }
      if (actionId === 'confirmClientPickup') {
        setPickupPinError(null);
        setPickupPinOpen(true);
        return;
      }
      void runAction(actionOrder, actionId);
    },
    [navigation, runAction, t]
  );

  useEffect(() => {
    if (!order || requestId === 0 || requestId === lastRequestRef.current) {
      return;
    }
    lastRequestRef.current = requestId;
    const primary = getBusinessOrderActions(order).find((a) => a.primary);
    if (!primary) {
      onNavigateDetail?.(order.id);
      return;
    }
    handlePrimary(order, primary.id);
  }, [order, requestId, handlePrimary, onNavigateDetail]);

  const handlePickupPinSubmit = useCallback(
    async (pin: string) => {
      if (!order || acting) return;
      setPickupPinError(null);
      try {
        await confirmClientPickup(order, pin);
        setPickupPinOpen(false);
        resetSharedPinState();
      } catch (e: unknown) {
        setPickupPinError(
          e instanceof Error
            ? e.message
            : t('business.orders.confirmPickupFailed', 'Failed to confirm pickup')
        );
      }
    },
    [acting, confirmClientPickup, order, resetSharedPinState, t]
  );

  const handleSharedPickupPinSubmit = useCallback(async () => {
    if (!order || acting || !autoPinMessageId) return;
    setPickupPinError(null);
    try {
      await confirmClientPickup(order, '', {
        useLatestSharedPin: true,
        pinMessageId: autoPinMessageId,
      });
      setPickupPinOpen(false);
      resetSharedPinState();
    } catch (e: unknown) {
      setPickupPinError(
        e instanceof Error
          ? e.message
          : t('business.orders.confirmPickupFailed', 'Failed to confirm pickup')
      );
    }
  }, [
    acting,
    autoPinMessageId,
    confirmClientPickup,
    order,
    resetSharedPinState,
    t,
  ]);

  const handleConfirmPending = useCallback(async () => {
    if (!order || !pendingConfirm || acting) return;
    const { actionId } = pendingConfirm;
    setPendingConfirm(null);
    const showLoader = actionId === 'completePreparation';
    if (showLoader) {
      await waitForModalDismiss();
      setImmediateKind('ready_for_pickup');
    }
    try {
      await runAction(order, actionId);
    } finally {
      setImmediateKind(null);
    }
  }, [acting, order, pendingConfirm, runAction]);

  if (!order) return null;

  return (
    <>
      <ConfirmActionDialog
        visible={!!pendingConfirm}
        title={pendingConfirm?.title ?? ''}
        message={pendingConfirm?.message ?? ''}
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={
          pendingConfirm?.confirmLabel ?? t('common.confirm', 'Confirm')
        }
        loading={acting}
        destructive={pendingConfirm?.destructive}
        onDismiss={() => !acting && setPendingConfirm(null)}
        onConfirm={handleConfirmPending}
      />

      <SimpleMessageDialog
        visible={!!infoDialog}
        title={infoDialog?.title ?? ''}
        message={infoDialog?.message ?? ''}
        dismissLabel={t('common.ok', 'OK')}
        onDismiss={() => setInfoDialog(null)}
      />

      <BusinessConfirmOrderDialog
        visible={confirmOpen}
        order={order}
        onDismiss={() => setConfirmOpen(false)}
        onConfirm={confirmOrder}
      />
      <BusinessMarkShippedSheet
        visible={shipOpen}
        mode={shipMode}
        initialTracking={order.shipping_tracking_number ?? ''}
        initialCarrier={order.shipping_carrier ?? ''}
        busy={acting}
        onDismiss={() => !acting && setShipOpen(false)}
        onSubmit={async (fields) => {
          if (shipMode === 'update') {
            await updateTracking(order.id, {
              tracking_number: fields.tracking_number ?? '',
              carrier: fields.carrier,
            });
          } else {
            await markShipped(order.id, fields);
          }
          setShipOpen(false);
        }}
      />
      <BusinessPickupPaymentDialog
        visible={pickupOpen}
        order={order}
        onDismiss={() => setPickupOpen(false)}
        loading={acting}
        onSubmit={(phone) => requestPickupPayment(order.id, phone)}
        onSuccess={(phone) => {
          setPickupOpen(false);
          navigation.navigate('BusinessPickupPaymentAwaiting', {
            orderId: order.id,
            phoneE164: phone,
            orderNumber: order.order_number ?? undefined,
            amount: order.total_amount
              ? `${order.currency} ${order.total_amount.toLocaleString()}`
              : undefined,
          });
        }}
      />
      <BusinessConfirmPickupPinDialog
        visible={pickupPinOpen}
        onDismiss={() => {
          if (!acting) {
            setPickupPinOpen(false);
            setPickupPinError(null);
            resetSharedPinState();
          }
        }}
        onSubmit={(pin) => void handlePickupPinSubmit(pin)}
        onSubmitSharedPin={() => void handleSharedPickupPinSubmit()}
        submitting={acting}
        errorText={pickupPinError}
        autoSharedPin={autoSharedPin}
        resolvingSharedPin={resolvingSharedPin}
        noSharedPin={noSharedPin}
      />
      <ReconcileCashDialog
        visible={reconcileOpen}
        itemCountry={order.business_location?.address?.country}
        onDismiss={() => setReconcileOpen(false)}
        loading={acting}
        onSubmit={(phone, reference, notes) =>
          reconcileCash(order.id, phone, reference, notes)
        }
      />

      <BottomOverlaySnackbar
        visible={!!snack}
        onDismiss={() => setSnack(null)}
        duration={4000}
      >
        {snack}
      </BottomOverlaySnackbar>

      <ActionLoadingDialog
        visible={acting && !!immediateKind}
        action={immediateKind ?? 'generic_update'}
      />
    </>
  );
}
