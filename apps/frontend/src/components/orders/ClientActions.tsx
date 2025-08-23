import {
  Cancel,
  History as HistoryIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
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
  onShowMessages?: () => void;
}

const ClientActions: React.FC<ClientActionsProps> = ({
  order,
  onActionComplete,
  onShowNotification,
  onShowHistory,
  onShowMessages,
}) => {
  const { t } = useTranslation();
  const { cancelOrder } = useBackendOrders();
  const [loading, setLoading] = useState(false);

  const handleCancelOrder = async () => {
    setLoading(true);
    try {
      await cancelOrder(order.id);
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

    // Always show history and messages for clients
    actions.push({
      label: t('orderActions.viewHistory', 'View History'),
      action: onShowHistory,
      color: 'info' as const,
      icon: <HistoryIcon />,
    });

    actions.push({
      label: t('orderActions.viewMessages', 'View Messages'),
      action: onShowMessages,
      color: 'primary' as const,
      icon: <MessageIcon />,
    });

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
          disabled={loading && action.action === handleCancelOrder}
          startIcon={
            loading && action.action === handleCancelOrder ? (
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
