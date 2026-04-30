import { Cancel, Undo } from '@mui/icons-material';
import { Box, Button, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  onShowHistory,
  hideDeliveryPin = false,
  deliveryPinFullWidth = false,
}) => {
  const { t } = useTranslation();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);

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

  const getAvailableActions = () => {
    const actions = [];

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
        color: 'error' as const,
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
        color: 'warning' as const,
        icon: <Undo />,
      });
    }

    return actions;
  };

  const availableActions = getAvailableActions();
  const showPin =
    !hideDeliveryPin &&
    order.payment_timing !== 'pay_at_delivery' &&
    order.payment_method !== 'pay_on_delivery' &&
    [
      'pending',
      'confirmed',
      'preparing',
      'ready_for_pickup',
      'assigned_to_agent',
      'picked_up',
      'in_transit',
      'out_for_delivery',
    ].includes(order.current_status);

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
                  variant="outlined"
                  color={action.color}
                  onClick={action.action}
                  startIcon={action.icon}
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
