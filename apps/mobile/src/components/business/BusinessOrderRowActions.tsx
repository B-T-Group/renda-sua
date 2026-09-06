import { useCallback, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EntityActionRow } from '../common/EntityActionRow';
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
import { BusinessCancelOrderDialog } from './BusinessCancelOrderDialog';
import { BusinessConfirmOrderDialog } from './BusinessConfirmOrderDialog';
import { BusinessMarkShippedSheet } from './BusinessMarkShippedSheet';
import { useActivePickupPin } from '../../hooks/business/useActivePickupPin';
import { BusinessConfirmPickupPinDialog } from './BusinessConfirmPickupPinDialog';
import { BusinessPickupPaymentDialog } from './BusinessPickupPaymentDialog';
import { ReconcileCashDialog } from './ReconcileCashDialog';
import type { BusinessRootStackParamList } from '@/navigation/types';
import { resolveFirstOrderJourney } from '../../utils/firstOrderJourney';
import { trackFirstOrderReadyMarked } from '../../utils/firstOrderAnalytics';

/** iOS freezes if a second Modal presents while another is still dismissing. */
function waitForModalDismiss(ms = 350): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, ms);
    });
  });
}

type Props = {
  order: BusinessOrder;
  onSuccess?: () => void;
};

type PendingConfirm = {
  actionId: BusinessOrderActionId;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
};

export function BusinessOrderRowActions({ order, onSuccess }: Props) {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<BusinessRootStackParamList>>();
  const {
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
    mode,
  } = useBusinessOrderActions(onSuccess);

  const acting = actingId === order.id;
  const actions = getBusinessOrderActions(order, { mode });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [pickupPinOpen, setPickupPinOpen] = useState(false);
  const [pickupPinError, setPickupPinError] = useState<string | null>(null);
  const {
    autoSharedPin,
    autoPinMessageId,
    resolvingSharedPin,
    noSharedPin,
    resetSharedPinState,
  } = useActivePickupPin(order.id, pickupPinOpen);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [shipMode, setShipMode] = useState<'ship' | 'update'>('ship');
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [infoDialog, setInfoDialog] = useState<{ title: string; message: string } | null>(null);
  const [immediateKind, setImmediateKind] = useState<ActionLoadingKind | null>(null);

  const runAction = useCallback(
    async (actionId: BusinessOrderActionId) => {
      const result = await runImmediateAction(order, actionId);
      if (result === false) return false;
      if (typeof result === 'object' && result?.type === 'overwriteCode') {
        setInfoDialog({
          title: t('business.orders.overwriteCodeTitle', 'Overwrite code'),
          message:
            result.code ??
            t('business.orders.overwriteCodeBody', 'Share this code with the delivery agent.'),
        });
      } else if (typeof result === 'object' && result?.type === 'manageRefunds') {
        navigation.navigate('BusinessRefundsList');
      } else if (typeof result === 'object' && result?.type === 'printLabelHint') {
        setInfoDialog({
          title: t('business.orders.printLabelTitle', 'Shipping label'),
          message: t(
            'business.orders.printLabelWebHint',
            'Print shipping labels from the business dashboard on rendasua.com for now.'
          ),
        });
      }
      return true;
    },
    [navigation, order, runImmediateAction, t]
  );

  const handlePress = useCallback(
    (actionId: BusinessOrderActionId, destructive?: boolean) => {
      if (actionId === 'confirm') {
        setConfirmOpen(true);
        return;
      }
      if (actionId === 'cancel') {
        setCancelOpen(true);
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
        const isPickup = order.fulfillment_method === 'pickup';
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
                'Rendasua will start looking for a delivery agent to pick up this order from your location.'
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
      void runAction(actionId);
    },
    [navigation, order.fulfillment_method, order.payment_status, runAction, t]
  );

  const handlePickupPinSubmit = useCallback(
    async (pin: string) => {
      if (acting) return;
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
    [acting, confirmClientPickup, order.id, resetSharedPinState, t]
  );

  const handleSharedPickupPinSubmit = useCallback(async () => {
    if (acting || !autoPinMessageId) return;
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
  }, [acting, autoPinMessageId, confirmClientPickup, order.id, resetSharedPinState, t]);

  const handleConfirmPending = useCallback(async () => {
    if (!pendingConfirm || acting) return;
    const { actionId } = pendingConfirm;
    // Dismiss confirm first; presenting ActionLoadingDialog in the same frame
    // freezes iOS ("presentation is in progress").
    setPendingConfirm(null);
    const showLoader = actionId === 'completePreparation';
    if (showLoader) {
      await waitForModalDismiss();
      setImmediateKind('ready_for_pickup');
    }
    try {
      const ok = await runAction(actionId);
      if (ok && actionId === 'completePreparation') {
        const journey = resolveFirstOrderJourney({
          order,
          businessId: order.business_id,
        });
        if (journey.showJourney) {
          trackFirstOrderReadyMarked({ order_id: order.id });
        }
      }
    } finally {
      setImmediateKind(null);
    }
  }, [acting, pendingConfirm, runAction]);

  if (actions.length === 0) return null;

  return (
    <>
      <EntityActionRow
        actions={actions.map((a) => ({
          id: a.id,
          label: t(a.labelKey, a.defaultLabel),
          mode: a.destructive ? 'outlined' : a.primary ? 'contained' : 'contained-tonal',
          destructive: a.destructive,
          primary: a.primary,
          compact: true,
          loading: acting,
          disabled: acting,
        }))}
        onActionPress={(id) => {
          const action = actions.find((a) => a.id === id);
          if (action) void handlePress(action.id, action.destructive);
        }}
      />

      <ConfirmActionDialog
        visible={!!pendingConfirm}
        title={pendingConfirm?.title ?? ''}
        message={pendingConfirm?.message ?? ''}
        cancelLabel={t('common.cancel', 'Cancel')}
        confirmLabel={pendingConfirm?.confirmLabel ?? t('common.confirm', 'Confirm')}
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
      <BusinessCancelOrderDialog
        visible={cancelOpen}
        order={order}
        onDismiss={() => setCancelOpen(false)}
        onSubmit={(notes) => cancelOrder(order, notes)}
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
        onSubmit={(phone, reference, notes) => reconcileCash(order.id, phone, reference, notes)}
      />

      <BottomOverlaySnackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={4000}>
        {snack}
      </BottomOverlaySnackbar>

      <ActionLoadingDialog
        visible={acting && !!immediateKind}
        action={immediateKind ?? 'generic_update'}
      />
    </>
  );
}
