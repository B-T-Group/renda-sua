import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackendOrders } from '../../hooks/useBackendOrders';
import { useClientReorderFlow } from '../../hooks/useClientReorderFlow';
import type { OrderData } from '../../hooks/useOrderById';
import { isWithinRefundWindow } from '../../hooks/useOrderRefunds';
import CancellationReasonModal from '../dialogs/CancellationReasonModal';
import ClientRefundRequestDialog from '../dialogs/ClientRefundRequestDialog';
import RequestPayAtPickupPaymentDialog from '../dialogs/RequestPayAtPickupPaymentDialog';
import { ClientDeliveryPinButton } from './ClientDeliveryPinButton';
import ClientConfirmReceiptActions from './ClientConfirmReceiptActions';
import { useDeliveryConfirmation } from '../../hooks/useDeliveryConfirmation';
import {
  clientCanShowConfirmReceipt,
  resolveUsesLegacyPin,
} from '../../utils/deliveryConfirmationUi';
import { EatInUnavailableNotice } from './EatInUnavailableNotice';
import { ReorderCartConflictDialog } from './ReorderCartConflictDialog';
import {
  OrderActionBar,
  type OrderActionBarHandler,
} from './OrderActionBar';
import {
  rankOrderDetailActions,
  type RankedOrderAction,
} from '../../utils/rankOrderDetailActions';

interface ClientActionsProps {
  order: OrderData;
  onActionComplete?: () => void;
  onShowNotification?: (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info'
  ) => void;
  onShowHistory?: () => void;
  /** When true, the delivery PIN control is not rendered here (shown elsewhere, e.g. order page header). */
  hideDeliveryPin?: boolean;
  /** Stretch the PIN button to the container width (e.g. order list cards). */
  deliveryPinFullWidth?: boolean;
}

function clientCanPayAtPickup(order: OrderData): boolean {
  return (
    order.fulfillment_method === 'pickup' &&
    order.current_status === 'ready_for_pickup' &&
    order.payment_timing === 'pay_at_pickup' &&
    order.payment_status !== 'paid' &&
    order.payment_status !== 'authorized'
  );
}

function clientCanAskIfReady(order: OrderData): boolean {
  return (
    order.current_status === 'confirmed' &&
    order.fulfillment_method !== 'shipping' &&
    !order.client_ready_nudge_sent_at
  );
}

const ClientActions: React.FC<ClientActionsProps> = ({
  order,
  onActionComplete,
  onShowNotification,
  onShowHistory,
  hideDeliveryPin = false,
  deliveryPinFullWidth = false,
}) => {
  const { t } = useTranslation();
  const {
    completeOrder,
    completeClientPickup,
    confirmOrderReceipt,
    reportDeliveryProblem,
    switchToPickup,
    remindReady,
  } = useBackendOrders();
  const { state: confirmState, refetch: refetchConfirm } = useDeliveryConfirmation(
    order.id,
    order.current_status,
    order.fulfillment_method
  );
  const usesLegacyPin = resolveUsesLegacyPin(confirmState);
  const canConfirmDelivery = clientCanShowConfirmReceipt({
    status: order.current_status,
    fulfillmentMethod: order.fulfillment_method,
    isGift: order.is_third_party_recipient,
    giftBuyerCanConfirm: confirmState?.giftBuyerCanConfirm,
    usesLegacyPin,
    paymentTiming: order.payment_timing,
    paymentMethod: order.payment_method,
    paymentStatus: order.payment_status,
    payAfterMerchantConfirm: order.pay_after_merchant_confirm,
  });
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [payPickupOpen, setPayPickupOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [switchingToPickup, setSwitchingToPickup] = useState(false);
  const [remindingReady, setRemindingReady] = useState(false);
  const reorderFlow = useClientReorderFlow(order.id, order.current_status);

  const handleCancelClick = () => {
    setCancelModalOpen(true);
  };

  const handleCancelSuccess = () => {
    onShowNotification?.(
      t('messages.orderCancelSuccess', 'Order cancelled successfully'),
      'success'
    );
    onActionComplete?.();
  };

  const handleCancelError = (errorMessage: string) => {
    onShowNotification?.(errorMessage, 'error');
  };

  const handleCompletePickup = async () => {
    setCompleting(true);
    try {
      await completeClientPickup(order.id);
      onShowNotification?.(
        t('messages.orderCompleteSuccess', 'Order completed successfully'),
        'success'
      );
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error?.message ||
          t('messages.orderCompleteError', 'Failed to complete order'),
        'error'
      );
    } finally {
      setCompleting(false);
    }
  };

  const handleCompleteOrder = async () => {
    setCompleting(true);
    try {
      await completeOrder({ orderId: order.id });
      onShowNotification?.(
        t('messages.orderCompleteSuccess', 'Order completed successfully'),
        'success'
      );
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error?.message ||
          t('messages.orderCompleteError', 'Failed to complete order'),
        'error'
      );
    } finally {
      setCompleting(false);
    }
  };

  const handleConfirmReceipt = async () => {
    setCompleting(true);
    try {
      await confirmOrderReceipt(order.id);
      onShowNotification?.(
        t('orders.clientConfirm.confirmDone', 'Thanks! Your order is complete.'),
        'success'
      );
      await refetchConfirm();
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error?.message ||
          t('messages.orderConfirmReceiptError', 'Failed to confirm receipt'),
        'error'
      );
    } finally {
      setCompleting(false);
    }
  };

  const handleReportProblem = async (description?: string) => {
    setCompleting(true);
    try {
      await reportDeliveryProblem(order.id, description);
      onShowNotification?.(
        t('orders.clientConfirm.problemSubmitted', 'We opened a support case.'),
        'success'
      );
      await refetchConfirm();
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error?.message || t('common.genericError', 'Something went wrong.'),
        'error'
      );
    } finally {
      setCompleting(false);
    }
  };

  const handleSwitchToPickup = async () => {
    setSwitchingToPickup(true);
    try {
      await switchToPickup(order.id);
      onShowNotification?.(
        t(
          'orders.noAgent.switchedSuccess',
          'Switched to store pickup. The delivery fee has been waived.'
        ),
        'success'
      );
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error?.message ||
          t('orderActions.switchToPickupFailed', 'Could not switch to store pickup.'),
        'error'
      );
    } finally {
      setSwitchingToPickup(false);
    }
  };

  const handleAskIfReady = async () => {
    setRemindingReady(true);
    try {
      await remindReady(order.id);
      onShowNotification?.(
        t(
          'orderActions.askIfReadySuccess',
          'We asked the store if your order is ready'
        ),
        'success'
      );
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error?.message ||
          t('orderActions.askIfReadyError', 'Could not send the reminder'),
        'error'
      );
    } finally {
      setRemindingReady(false);
    }
  };

  const rankedActions = useMemo(() => {
    const actions: RankedOrderAction[] = [];
    const push = (
      id: string,
      labelKey: string,
      defaultLabel: string,
      opts?: { destructive?: boolean; preferred?: boolean }
    ) => {
      if (actions.some((a) => a.id === id)) return;
      actions.push({
        id,
        labelKey,
        defaultLabel,
        destructive: opts?.destructive,
        preferred: opts?.preferred,
      });
    };

    if (reorderFlow.enabled) {
      push('reorder', 'orders.reorder.cta', 'Reorder', { preferred: true });
    }
    if (clientCanPayAtPickup(order)) {
      push('pay', 'orders.payAtPickup.cta', 'Pay now', {
        preferred: !reorderFlow.enabled,
      });
    }
    if (
      order.fulfillment_method === 'shipping' &&
      ['shipped', 'in_delivery'].includes(order.current_status)
    ) {
      push('confirm_receipt', 'orderActions.confirmReceipt', 'Confirm receipt', {
        preferred: !reorderFlow.enabled,
      });
    }
    if (
      order.fulfillment_method === 'pickup' &&
      order.current_status === 'ready_for_pickup' &&
      (order.payment_status === 'paid' || order.payment_status === 'authorized')
    ) {
      push('complete', 'orders.actions.complete', 'Complete order', {
        preferred: !reorderFlow.enabled,
      });
    }
    if (order.current_status === 'delivered') {
      push('complete', 'orders.actions.completeOrder', 'Complete Order', {
        preferred: !reorderFlow.enabled,
      });
    }
    // Doorstep confirm/report uses ClientConfirmReceiptActions in this sticky bar.
    if (clientCanAskIfReady(order)) {
      push('ask_if_ready', 'orderActions.askIfReady', 'Ask if my order is ready');
    }
    if (
      order.current_status === 'ready_for_pickup' &&
      !order.assigned_agent_id &&
      order.fulfillment_method !== 'pickup' &&
      !!order.dispatch_exhausted_at
    ) {
      push(
        'switch_to_pickup',
        'orders.noAgent.switchToPickup',
        'Switch to store pickup (fee waived)'
      );
    }
    if (
      order.current_status === 'complete' &&
      isWithinRefundWindow(order.completed_at)
    ) {
      push('request_refund', 'orders.refunds.requestButton', 'Request refund');
    }
    if (
      [
        'pending_payment',
        'pending',
        'preparing',
        'ready_for_pickup',
        'confirmed',
      ].includes(order.current_status)
    ) {
      push('cancel', 'orderActions.cancelOrder', 'Cancel Order', {
        destructive: true,
      });
    }
    if (onShowHistory) {
      push('view_history', 'orders.actions.viewHistory', 'View History');
    }
    return rankOrderDetailActions(
      actions,
      actions.find((a) => a.preferred)?.id
    );
  }, [order, reorderFlow.enabled, canConfirmDelivery, onShowHistory]);

  const handlers: Record<string, OrderActionBarHandler> = {
    reorder: {
      id: 'reorder',
      onClick: () => void reorderFlow.onReorderPress(),
      loading: reorderFlow.loading,
    },
    pay: {
      id: 'pay',
      onClick: () => setPayPickupOpen(true),
    },
    confirm_receipt: {
      id: 'confirm_receipt',
      onClick: () => void handleConfirmReceipt(),
      loading: completing,
    },
    complete: {
      id: 'complete',
      onClick: () => {
        if (
          order.fulfillment_method === 'pickup' &&
          order.current_status === 'ready_for_pickup'
        ) {
          void handleCompletePickup();
        } else {
          void handleCompleteOrder();
        }
      },
      loading: completing,
    },
    ask_if_ready: {
      id: 'ask_if_ready',
      onClick: () => void handleAskIfReady(),
      loading: remindingReady,
    },
    switch_to_pickup: {
      id: 'switch_to_pickup',
      onClick: () => void handleSwitchToPickup(),
      loading: switchingToPickup,
    },
    request_refund: {
      id: 'request_refund',
      onClick: () => setRefundOpen(true),
    },
    cancel: {
      id: 'cancel',
      onClick: handleCancelClick,
    },
    view_history: {
      id: 'view_history',
      onClick: () => onShowHistory?.(),
    },
  };

  const payAfterDelivery =
    order.pay_after_merchant_confirm === true &&
    order.fulfillment_method !== 'pickup';
  const showPin =
    usesLegacyPin &&
    !hideDeliveryPin &&
    (payAfterDelivery ||
      (order.payment_timing !== 'pay_at_delivery' &&
        order.payment_timing !== 'pay_at_pickup' &&
        order.payment_method !== 'pay_on_delivery')) &&
    order.fulfillment_method !== 'pickup' &&
    ['picked_up', 'in_transit', 'out_for_delivery'].includes(
      order.current_status
    );

  const hasBar =
    rankedActions.primary ||
    rankedActions.companion ||
    rankedActions.overflow.length > 0 ||
    showPin;

  if (!hasBar && !canConfirmDelivery && !reorderFlow.enabled) {
    return <EatInUnavailableNotice order={order} />;
  }

  return (
    <>
      <EatInUnavailableNotice order={order} />
      {canConfirmDelivery ? (
        <ClientConfirmReceiptActions
          state={confirmState}
          busy={completing}
          onConfirm={() => void handleConfirmReceipt()}
          onReportProblem={(description) => void handleReportProblem(description)}
        />
      ) : null}
      {showPin ? (
        <ClientDeliveryPinButton
          orderId={order.id}
          pinAudience={
            order.fulfillment_method === 'pickup' ? 'business' : 'agent'
          }
          onShowNotification={onShowNotification}
          fullWidth={deliveryPinFullWidth}
          size="medium"
        />
      ) : null}
      <OrderActionBar
        plain
        ranked={rankedActions}
        handlers={handlers}
        accentPrimary={rankedActions.primary?.id === 'pay'}
      />

      <CancellationReasonModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        order={order}
        persona="client"
        onSuccess={handleCancelSuccess}
        onError={handleCancelError}
      />
      <ClientRefundRequestDialog
        open={refundOpen}
        onClose={() => setRefundOpen(false)}
        order={order}
        onSuccess={() => {
          onShowNotification?.(
            t('orders.refunds.submitted', 'Refund request submitted'),
            'success'
          );
          onActionComplete?.();
        }}
        onError={(msg) => onShowNotification?.(msg, 'error')}
      />
      <RequestPayAtPickupPaymentDialog
        open={payPickupOpen}
        order={order}
        audience="client"
        onClose={() => setPayPickupOpen(false)}
        onSuccess={() => {
          onShowNotification?.(
            t(
              'orders.payAtPickup.sent',
              'Approve the payment request on your phone. The store will see it once it succeeds.'
            ),
            'success'
          );
          onActionComplete?.();
        }}
      />
      <ReorderCartConflictDialog
        open={reorderFlow.sheetOpen}
        allowAdd={reorderFlow.allowAdd}
        otherStoreBlocked={reorderFlow.otherStoreBlocked}
        onReplace={reorderFlow.onReplace}
        onAdd={reorderFlow.onAdd}
        onCancel={reorderFlow.onDismissSheet}
      />
    </>
  );
};

export default ClientActions;
