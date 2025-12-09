import { Cancel, CheckCircle } from '@mui/icons-material';
import { Box, Button, CircularProgress } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackendOrders } from '../../hooks/useBackendOrders';
import type { OrderData } from '../../hooks/useOrderById';
import ConfirmationModal from '../common/ConfirmationModal';
import OrderCompletionSuccessDialog from '../common/OrderCompletionSuccessDialog';
import CancellationReasonModal from '../dialogs/CancellationReasonModal';

interface ClientActionsProps {
  order: OrderData;
  onActionComplete?: () => void;
  onShowNotification?: (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info'
  ) => void;
  onShowHistory?: () => void;
}

const ClientActions: React.FC<ClientActionsProps> = ({
  order,
  onActionComplete,
  onShowNotification,
  onShowHistory,
}) => {
  const { t } = useTranslation();
  const { completeOrder } = useBackendOrders();
  const [loading, setLoading] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [completeConfirmationOpen, setCompleteConfirmationOpen] =
    useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);

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

  const handleCompleteOrderClick = () => {
    setCompleteConfirmationOpen(true);
  };

  const handleConfirmCompleteOrder = async () => {
    setLoading(true);
    try {
      await completeOrder({ orderId: order.id });
      setCompleteConfirmationOpen(false);
      setSuccessModalOpen(true);
      onShowNotification?.(
        t('messages.orderCompleteSuccess', 'Order completed successfully'),
        'success'
      );
      // Delay onActionComplete to ensure modal is visible first
      setTimeout(() => {
        onActionComplete?.();
      }, 100);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('messages.orderCompleteError', 'Failed to complete order');
      onShowNotification?.(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelCompleteOrder = () => {
    setCompleteConfirmationOpen(false);
  };

  const getAvailableActions = () => {
    const actions = [];

    // Cancel action - available for pending_payment, pending, preparing, and ready_for_pickup statuses
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

    // Complete action - only available for delivered orders
    if (order.current_status === 'delivered') {
      actions.push({
        label: t('orderActions.completeOrder', 'Complete Order'),
        action: handleCompleteOrderClick,
        color: 'success' as const,
        icon: <CheckCircle />,
      });
    }

    return actions;
  };

  const availableActions = getAvailableActions();

  // Don't return null if success modal is open - keep it visible even after status change
  if (availableActions.length === 0 && !successModalOpen) {
    return null;
  }

  return (
    <>
      {availableActions.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          {availableActions.map((action, index) => (
            <Button
              key={index}
              variant="outlined"
              color={action.color}
              onClick={action.action}
              disabled={loading && action.action === handleCompleteOrderClick}
              startIcon={
                loading && action.action === handleCompleteOrderClick ? (
                  <CircularProgress size={16} />
                ) : (
                  action.icon
                )
              }
              sx={{ minWidth: 120 }}
            >
              {action.label}
            </Button>
          ))}
        </Box>
      )}

      {/* Cancellation Reason Modal */}
      <CancellationReasonModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        order={order}
        persona="client"
        onSuccess={handleCancelSuccess}
        onError={handleCancelError}
      />

      {/* Order Completion Confirmation Modal */}
      <ConfirmationModal
        open={completeConfirmationOpen}
        title={t('orders.confirmOrderCompletion', 'Confirm Order Completion')}
        message={t('orders.confirmOrderCompletionMessage', {
          orderNumber: order.order_number,
        })}
        confirmText={t('common.confirm', 'Confirm')}
        cancelText={t('common.cancel', 'Cancel')}
        onConfirm={handleConfirmCompleteOrder}
        onCancel={handleCancelCompleteOrder}
        confirmColor="success"
        loading={loading}
      />

      {/* Order Completion Success Modal */}
      <OrderCompletionSuccessDialog
        open={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
      />
    </>
  );
};

export default ClientActions;
