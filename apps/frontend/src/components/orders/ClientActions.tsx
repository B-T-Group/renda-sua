import { Cancel, CheckCircle } from '@mui/icons-material';
import { Box, Button, CircularProgress } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackendOrders } from '../../hooks/useBackendOrders';
import type { OrderData } from '../../hooks/useOrderById';

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
  const { cancelOrder, completeOrder } = useBackendOrders();
  const [loading, setLoading] = useState(false);

  const handleCancelOrder = async () => {
    setLoading(true);
    try {
      await cancelOrder({ orderId: order.id });
      onShowNotification?.(
        t('messages.orderCancelSuccess', 'Order cancelled successfully'),
        'success'
      );
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error.message ||
          t('messages.orderCancelError', 'Failed to cancel order'),
        'error'
      );
    } finally {
      setLoading(false);
    }
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
    } catch (error: any) {
      onShowNotification?.(
        error.message ||
          t('messages.orderCompleteError', 'Failed to complete order'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const getAvailableActions = () => {
    const actions = [];

    // Cancel action - only available for pending, confirmed, preparing statuses
    if (['pending', 'confirmed', 'preparing'].includes(order.current_status)) {
      actions.push({
        label: t('orderActions.cancelOrder', 'Cancel Order'),
        action: handleCancelOrder,
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
          disabled={
            loading &&
            (action.action === handleCancelOrder ||
              action.action === handleCompleteOrder)
          }
          startIcon={
            loading &&
            (action.action === handleCancelOrder ||
              action.action === handleCompleteOrder) ? (
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
  );
};

export default ClientActions;
