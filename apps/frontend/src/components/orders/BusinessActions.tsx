import {
  Cancel,
  CheckCircle,
  AttachMoney as RefundIcon,
  LocalShipping,
} from '@mui/icons-material';
import { Box, Button, CircularProgress } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ConfirmOrderData,
  useBackendOrders,
} from '../../hooks/useBackendOrders';
import type { OrderData } from '../../hooks/useOrderById';
import { useShippingLabels } from '../../hooks/useShippingLabels';
import ConfirmOrderModal from '../business/ConfirmOrderModal';
import CancellationReasonModal from '../dialogs/CancellationReasonModal';
import ShippingLabelPrintModal from '../dialogs/ShippingLabelPrintModal';

const PRINT_LABEL_STATUSES = [
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'assigned_to_agent',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'complete',
];

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
  const { printLabel, loading: printLabelLoading } = useShippingLabels();
  const [loading, setLoading] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [labelPrintModalOpen, setLabelPrintModalOpen] = useState(false);
  const [labelPrintBlob, setLabelPrintBlob] = useState<Blob | null>(null);

  const handlePrintLabel = async () => {
    try {
      const blob = await printLabel(order.id);
      if (blob) {
        setLabelPrintBlob(blob);
        setLabelPrintModalOpen(true);
        onShowNotification?.(
          t('orders.shippingLabel.printSuccess', 'Shipping label ready to print'),
          'success'
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('orders.shippingLabel.printError', 'Could not generate shipping label');
      onShowNotification?.(msg, 'error');
    }
  };

  const canPrintLabel = PRINT_LABEL_STATUSES.includes(order.current_status || '');

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

  const handleConfirmOrder = () => {
    setConfirmModalOpen(true);
  };

  const handleConfirmOrderSuccess = async (data: ConfirmOrderData) => {
    setLoading(true);
    try {
      await confirmOrder(data);
      onShowNotification?.(
        t('messages.orderConfirmSuccess', 'Order confirmed successfully'),
        'success'
      );
      onActionComplete?.();
      setConfirmModalOpen(false);
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
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t(
              'messages.orderStartPreparingError',
              'Failed to start preparation'
            );
      onShowNotification?.(errorMessage, 'error');
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
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t(
              'messages.orderCompletePreparationError',
              'Failed to complete preparation'
            );
      onShowNotification?.(errorMessage, 'error');
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
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('messages.orderRefundError', 'Failed to refund order');
      onShowNotification?.(errorMessage, 'error');
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
    const actions: Array<{
      label: string;
      action: () => void | Promise<void>;
      color: 'success' | 'primary' | 'error' | 'warning';
      icon: JSX.Element;
      isPrintLabel?: boolean;
    }> = [];

    switch (order.current_status) {
      case 'pending':
        actions.push({
          label: t('orderActions.confirmOrder', 'Confirm Order'),
          action: handleConfirmOrder,
          color: 'success' as const,
          icon: <CheckCircle />,
        });
        actions.push({
          label: t('orderActions.cancelOrder', 'Cancel Order'),
          action: handleCancelClick,
          color: 'error' as const,
          icon: <Cancel />,
        });
        break;

      case 'confirmed':
        actions.push({
          label: t('orderActions.startPreparing', 'Start Preparing'),
          action: handleStartPreparing,
          color: 'primary' as const,
          icon: <CheckCircle />,
        });
        actions.push({
          label: t('orderActions.cancelOrder', 'Cancel Order'),
          action: handleCancelClick,
          color: 'error' as const,
          icon: <Cancel />,
        });
        break;

      case 'preparing':
        actions.push({
          label: t('orderActions.completePreparation', 'Complete Preparation'),
          action: handleCompletePreparation,
          color: 'success' as const,
          icon: <CheckCircle />,
        });
        actions.push({
          label: t('orderActions.cancelOrder', 'Cancel Order'),
          action: handleCancelClick,
          color: 'error' as const,
          icon: <Cancel />,
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

    if (canPrintLabel) {
      actions.push({
        label: t('orderActions.printLabel', 'Print label'),
        action: handlePrintLabel,
        color: 'primary' as const,
        icon: <LocalShipping />,
        isPrintLabel: true,
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
        {availableActions.map((action, index) => {
          const isLoadingAction = action.isPrintLabel
            ? printLabelLoading
            : loading && action.action !== handleCancelClick;
          return (
            <Button
              key={index}
              variant="outlined"
              color={action.color}
              onClick={action.action}
              disabled={isLoadingAction}
              startIcon={
                isLoadingAction ? <CircularProgress size={16} /> : action.icon
              }
              sx={{ minWidth: 120 }}
            >
              {action.label}
            </Button>
          );
        })}
      </Box>

      {/* Cancellation Reason Modal */}
      <CancellationReasonModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        order={order}
        persona="business"
        onSuccess={handleCancelSuccess}
        onError={handleCancelError}
      />

      {/* Confirm Order Modal */}
      <ConfirmOrderModal
        open={confirmModalOpen}
        order={order}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirmOrderSuccess}
        loading={loading}
      />

      {/* Shipping Label Print Modal */}
      <ShippingLabelPrintModal
        open={labelPrintModalOpen}
        onClose={() => {
          setLabelPrintModalOpen(false);
          setLabelPrintBlob(null);
        }}
        pdfBlob={labelPrintBlob}
      />
    </>
  );
};

export default BusinessActions;
