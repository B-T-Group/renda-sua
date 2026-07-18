import { Cancel, CheckCircle, Undo } from '@mui/icons-material';
import { Box, Button } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackendOrders } from '../../hooks/useBackendOrders';
import type { OrderData } from '../../hooks/useOrderById';
import { isWithinRefundWindow } from '../../hooks/useOrderRefunds';
import CancellationReasonModal from '../dialogs/CancellationReasonModal';
import ClientRefundRequestDialog from '../dialogs/ClientRefundRequestDialog';
import { ClientDeliveryPinButton } from './ClientDeliveryPinButton';

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

const ClientActions: React.FC<ClientActionsProps> = ({
  order,
  onActionComplete,
  onShowNotification,
  hideDeliveryPin = false,
  deliveryPinFullWidth = false,
}) => {
  const { t } = useTranslation();
  const { completeOrder } = useBackendOrders();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [completing, setCompleting] = useState(false);

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

  const getAvailableActions = () => {
    const actions: Array<{
      label: string;
      action: () => void;
      color: 'error' | 'warning' | 'success';
      icon: React.ReactNode;
      variant?: 'outlined' | 'contained';
      loading?: boolean;
    }> = [];

    if (order.current_status === 'delivered') {
      actions.push({
        label: t('orders.actions.completeOrder', 'Complete Order'),
        action: () => void handleCompleteOrder(),
        color: 'success',
        icon: <CheckCircle />,
        variant: 'contained',
        loading: completing,
      });
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
      actions.push({
        label: t('orderActions.cancelOrder', 'Cancel Order'),
        action: handleCancelClick,
        color: 'error',
        icon: <Cancel />,
      });
    }

    if (
      order.current_status === 'complete' &&
      isWithinRefundWindow(order.completed_at)
    ) {
      actions.push({
        label: t('orders.refunds.requestButton', 'Request refund'),
        action: () => setRefundOpen(true),
        color: 'warning',
        icon: <Undo />,
      });
    }

    return actions;
  };

  const availableActions = getAvailableActions();
  const showPin =
    !hideDeliveryPin &&
    order.payment_timing !== 'pay_at_delivery' &&
    order.payment_timing !== 'pay_at_pickup' &&
    order.payment_method !== 'pay_on_delivery' &&
    (order.fulfillment_method === 'pickup'
      ? order.current_status === 'ready_for_pickup' &&
        (order.payment_status === 'authorized' || order.payment_status === 'paid')
      : [
          'picked_up',
          'in_transit',
          'out_for_delivery',
        ].includes(order.current_status));

  if (availableActions.length === 0 && !showPin) {
    return null;
  }

  return (
    <>
      {(availableActions.length > 0 || showPin) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {showPin && (
            <ClientDeliveryPinButton
              orderId={order.id}
              displayMode={
                order.fulfillment_method === 'pickup' ? 'show' : 'send'
              }
              onShowNotification={onShowNotification}
              fullWidth={deliveryPinFullWidth}
              size="medium"
            />
          )}
          {availableActions.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                flexWrap: { sm: 'wrap' },
                gap: 2,
                justifyContent: { xs: 'stretch', sm: 'flex-end' },
              }}
            >
              {availableActions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant ?? 'outlined'}
                  color={action.color}
                  onClick={action.action}
                  startIcon={action.icon}
                  disabled={Boolean(action.loading)}
                  sx={{
                    minWidth: { xs: 0, sm: 120 },
                    width: { xs: '100%', sm: 'auto' },
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </Box>
          )}
        </Box>
      )}

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
    </>
  );
};

export default ClientActions;
