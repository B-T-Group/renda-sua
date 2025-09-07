import { CheckCircle, AttachMoney as RefundIcon } from '@mui/icons-material';
import { Box, Button, CircularProgress } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackendOrders } from '../../hooks/useBackendOrders';
import type { OrderData } from '../../hooks/useOrderById';

interface BusinessActionsProps {
  order: OrderData;
  onActionComplete?: () => void;
  onShowNotification?: (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info'
  ) => void;
  onShowHistory?: () => void;
}

const BusinessActions: React.FC<BusinessActionsProps> = ({
  order,
  onActionComplete,
  onShowNotification,
  onShowHistory,
}) => {
  const { t } = useTranslation();
  const {
    confirmOrder,
    startPreparing,
    completePreparation,
    refundOrder,
    completeOrder,
  } = useBackendOrders();
  const [loading, setLoading] = useState(false);

  const handleConfirmOrder = async () => {
    setLoading(true);
    try {
      await confirmOrder({ orderId: order.id });
      onShowNotification?.(
        t('messages.orderConfirmSuccess', 'Order confirmed successfully'),
        'success'
      );
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error.message ||
          t('messages.orderConfirmError', 'Failed to confirm order'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStartPreparing = async () => {
    setLoading(true);
    try {
      await startPreparing({ orderId: order.id });
      onShowNotification?.(
        t(
          'messages.orderStartPreparingSuccess',
          'Order preparation started successfully'
        ),
        'success'
      );
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error.message ||
          t('messages.orderStartPreparingError', 'Failed to start preparation'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCompletePreparation = async () => {
    setLoading(true);
    try {
      await completePreparation({ orderId: order.id });
      onShowNotification?.(
        t(
          'messages.orderCompletePreparationSuccess',
          'Order preparation completed successfully'
        ),
        'success'
      );
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error.message ||
          t(
            'messages.orderCompletePreparationError',
            'Failed to complete preparation'
          ),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRefundOrder = async () => {
    setLoading(true);
    try {
      await refundOrder({ orderId: order.id });
      onShowNotification?.(
        t('messages.orderRefundSuccess', 'Order refunded successfully'),
        'success'
      );
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error.message ||
          t('messages.orderRefundError', 'Failed to refund order'),
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

    switch (order.current_status) {
      case 'pending':
        actions.push({
          label: t('orderActions.confirmOrder', 'Confirm Order'),
          action: handleConfirmOrder,
          color: 'success' as const,
          icon: <CheckCircle />,
        });
        break;

      case 'confirmed':
        actions.push({
          label: t('orderActions.startPreparing', 'Start Preparing'),
          action: handleStartPreparing,
          color: 'primary' as const,
          icon: <CheckCircle />,
        });
        break;

      case 'preparing':
        actions.push({
          label: t('orderActions.completePreparation', 'Complete Preparation'),
          action: handleCompletePreparation,
          color: 'success' as const,
          icon: <CheckCircle />,
        });
        break;

      case 'delivered':
        actions.push({
          label: t('orderActions.completeOrder', 'Complete Order'),
          action: handleCompleteOrder,
          color: 'success' as const,
          icon: <CheckCircle />,
        });
        // Only show refund option if payment is not pending
        if (order.payment_status !== 'pending') {
          actions.push({
            label: t('orderActions.refundOrder', 'Refund Order'),
            action: handleRefundOrder,
            color: 'warning' as const,
            icon: <RefundIcon />,
          });
        }
        break;

      case 'failed':
      case 'cancelled':
        // Only show refund option if payment is not pending
        if (order.payment_status !== 'pending') {
          actions.push({
            label: t('orderActions.refundOrder', 'Refund Order'),
            action: handleRefundOrder,
            color: 'warning' as const,
            icon: <RefundIcon />,
          });
        }
        break;

      default:
        // For other statuses, businesses can generally refund
        // But not if payment is still pending
        if (
          !['complete', 'refunded'].includes(order.current_status) &&
          order.payment_status !== 'pending'
        ) {
          actions.push({
            label: t('orderActions.refundOrder', 'Refund Order'),
            action: handleRefundOrder,
            color: 'warning' as const,
            icon: <RefundIcon />,
          });
        }
        break;
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
            [
              handleConfirmOrder,
              handleStartPreparing,
              handleCompletePreparation,
              handleRefundOrder,
              handleCompleteOrder,
            ].includes(action.action)
          }
          startIcon={
            loading &&
            [
              handleConfirmOrder,
              handleStartPreparing,
              handleCompletePreparation,
              handleRefundOrder,
              handleCompleteOrder,
            ].includes(action.action) ? (
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

export default BusinessActions;
