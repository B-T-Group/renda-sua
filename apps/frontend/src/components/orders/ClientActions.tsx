import { Cancel, CheckCircle } from '@mui/icons-material';
import { Box, Button, CircularProgress } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackendOrders } from '../../hooks/useBackendOrders';
import type { OrderData } from '../../hooks/useOrderById';
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
    setLoading(true);
    try {
      await completeOrder({ orderId: order.id });
      onShowNotification?.(
        t('messages.orderCompleteSuccess', 'Order completed successfully'),
        'success'
      );
      onActionComplete?.();
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

  const getAvailableActions = () => {
    const actions = [];

    // Cancel action - only available for pending and confirmed statuses
    if (['pending', 'confirmed'].includes(order.current_status)) {
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
        action: handleCompleteOrder,
        color: 'success' as const,
        icon: <CheckCircle />,
      });
    }

    return actions;
  };

  const availableActions = getAvailableActions();

  if (availableActions.length === 0) {
    return null;
  }

  return (
    <>
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
            disabled={loading && action.action === handleCompleteOrder}
            startIcon={
              loading && action.action === handleCompleteOrder ? (
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

      {/* Cancellation Reason Modal */}
      <CancellationReasonModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        order={order}
        persona="client"
        onSuccess={handleCancelSuccess}
        onError={handleCancelError}
      />
    </>
  );
};

export default ClientActions;
