import { Cancel, CheckCircle, LocalShipping } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { APP_FEATURES } from '../../constants/appFeatures';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAgentOrders } from '../../hooks/useAgentOrders';
import type { OrderData } from '../../hooks/useOrderById';
import ConfirmationModal from '../common/ConfirmationModal';
import MarkDeliveryAsFailedDialog from '../dialogs/MarkDeliveryAsFailedDialog';
import ClaimOrderDialog from './ClaimOrderDialog';

interface AgentActionsProps {
  order: OrderData;
  agentAccounts?: any[];
  onActionComplete?: () => void;
  onShowNotification?: (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info'
  ) => void;
}

const AgentActions: React.FC<AgentActionsProps> = ({
  order,
  agentAccounts = [],
  onActionComplete,
  onShowNotification,
}) => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const agentOrders = useAgentOrders();
  const [loading, setLoading] = useState(false);
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimError, setClaimError] = useState<string | undefined>();
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: string;
    label: string;
    color: 'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning';
  } | null>(null);
  const [showClaimConfirmation, setShowClaimConfirmation] = useState(false);
  const [showFailDeliveryDialog, setShowFailDeliveryDialog] = useState(false);

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Check if agent has sufficient funds to claim the order
  const hasSufficientFunds = () => {
    if (!agentAccounts?.length) return false; // Assume sufficient if no account data

    // Use hold amount from order (calculated by backend)
    const requiredHoldAmount = order.agent_hold_amount || 0;

    // Check if agent has sufficient balance in the order's currency
    const accountForCurrency = agentAccounts.find(
      (account) => account.currency === order.currency
    );

    if (!accountForCurrency) return false; // No account for this currency

    return accountForCurrency.available_balance >= requiredHoldAmount;
  };

  const handlePickUp = async () => {
    if (!profile?.id) {
      onShowNotification?.(
        t('messages.agentProfileNotFound', 'Agent profile not found'),
        'error'
      );
      return;
    }

    setLoading(true);
    try {
      const result = await agentOrders.pickUpOrder(order.id);
      onShowNotification?.(
        t(
          'messages.orderPickupSuccess',
          `Order ${result.order_number} picked up successfully`
        ),
        'success'
      );
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error.message ||
          t('messages.orderPickupError', 'Failed to pick up order'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!profile?.id) {
      onShowNotification?.(
        t('messages.agentProfileNotFound', 'Agent profile not found'),
        'error'
      );
      return;
    }

    // Check if agent has sufficient funds
    if (hasSufficientFunds()) {
      // Show confirmation dialog before claiming
      setShowClaimConfirmation(true);
    } else {
      // Show dialog for claim with topup
      setShowClaimDialog(true);
    }
  };

  const handleConfirmClaim = async () => {
    if (!profile?.id) {
      onShowNotification?.(
        t('messages.agentProfileNotFound', 'Agent profile not found'),
        'error'
      );
      return;
    }

    setShowClaimConfirmation(false);
    setLoading(true);
    try {
      const result = await agentOrders.getOrderForPickup(order.id);
      onShowNotification?.(
        t(
          'messages.orderAssignedSuccess',
          `Order ${result.order.order_number} claimed successfully`
        ),
        'success'
      );
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error.message || t('messages.orderClaimError', 'Failed to claim order'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClaimWithTopup = async (phoneNumber?: string) => {
    setLoading(true);
    setClaimError(undefined);
    setClaimSuccess(false);

    try {
      await agentOrders.claimOrderWithTopup(order.id, phoneNumber);
      setClaimSuccess(true);
      onActionComplete?.();
    } catch (error: any) {
      setClaimError(
        error.message ||
          t(
            'messages.orderClaimWithTopupError',
            'Failed to claim order with topup'
          )
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCloseClaimDialog = () => {
    setShowClaimDialog(false);
    setClaimSuccess(false);
    setClaimError(undefined);
  };

  const handleDrop = async () => {
    if (!profile?.id) {
      onShowNotification?.(
        t('messages.agentProfileNotFound', 'Agent profile not found'),
        'error'
      );
      return;
    }

    setLoading(true);
    try {
      const result = await agentOrders.dropOrder(order.id);
      onShowNotification?.(
        t(
          'messages.orderDropSuccess',
          `Order ${result.order_number} dropped successfully`
        ),
        'success'
      );
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error.message || t('messages.orderDropError', 'Failed to drop order'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdateDirect = async (newStatus: string) => {
    if (!profile?.id) {
      onShowNotification?.(
        t('messages.agentProfileNotFound', 'Agent profile not found'),
        'error'
      );
      return;
    }

    setLoading(true);
    try {
      await agentOrders.updateOrderStatusAction(order.id, newStatus);
      const statusLabels: Record<string, string> = {
        out_for_delivery: t(
          'orderActions.markAsOutForDelivery',
          'Mark as Out for Delivery'
        ),
        delivered: t('orderActions.markAsDelivered', 'Mark as Delivered'),
      };
      onShowNotification?.(
        t(
          'messages.orderStatusUpdated',
          `Order status updated to ${statusLabels[newStatus] || newStatus}`
        ),
        'success'
      );
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error.message ||
          t('messages.orderStatusUpdateError', 'Failed to update order status'),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!profile?.id) {
      onShowNotification?.(
        t('messages.agentProfileNotFound', 'Agent profile not found'),
        'error'
      );
      return;
    }

    // Special handling for failed status - show failure reason dialog
    if (newStatus === 'failed') {
      setShowFailDeliveryDialog(true);
      return;
    }

    // Direct update for out_for_delivery and delivered (no confirmation)
    if (newStatus === 'out_for_delivery' || newStatus === 'delivered') {
      await handleStatusUpdateDirect(newStatus);
      return;
    }

    // Set up confirmation modal for other statuses
    const statusLabels: Record<string, string> = {
      in_transit: t('orderActions.markAsInTransit', 'Mark as In Transit'),
      out_for_delivery: t(
        'orderActions.markAsOutForDelivery',
        'Mark as Out for Delivery'
      ),
      delivered: t('orderActions.markAsDelivered', 'Mark as Delivered'),
      failed: t('orderActions.markAsFailed', 'Mark as Failed'),
    };

    const statusColors: Record<
      string,
      'primary' | 'secondary' | 'success' | 'error' | 'info' | 'warning'
    > = {
      in_transit: 'primary',
      out_for_delivery: 'secondary',
      delivered: 'success',
      failed: 'error',
    };

    setPendingAction({
      action: newStatus,
      label: statusLabels[newStatus] || newStatus,
      color: statusColors[newStatus] || 'primary',
    });
    setConfirmationOpen(true);
  };

  const handleConfirmStatusUpdate = async () => {
    if (!pendingAction || !profile?.id) return;

    setLoading(true);
    try {
      await agentOrders.updateOrderStatusAction(order.id, pendingAction.action);
      onShowNotification?.(
        t(
          'messages.orderStatusUpdated',
          `Order status updated to ${pendingAction.label}`
        ),
        'success'
      );
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error.message ||
          t('messages.orderStatusUpdateError', 'Failed to update order status'),
        'error'
      );
    } finally {
      setLoading(false);
      setConfirmationOpen(false);
      setPendingAction(null);
    }
  };

  const handleConfirmFailDelivery = async (
    failureReasonId: string,
    notes?: string
  ) => {
    if (!profile?.id) {
      onShowNotification?.(
        t('messages.agentProfileNotFound', 'Agent profile not found'),
        'error'
      );
      return;
    }

    setLoading(true);
    try {
      await agentOrders.updateOrderStatusAction(
        order.id,
        'failed',
        notes,
        failureReasonId
      );
      onShowNotification?.(
        t('messages.orderStatusUpdated', 'Order marked as failed successfully'),
        'success'
      );
      setShowFailDeliveryDialog(false);
      onActionComplete?.();
    } catch (error: any) {
      onShowNotification?.(
        error.message ||
          t(
            'messages.orderStatusUpdateError',
            'Failed to mark delivery as failed'
          ),
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancelStatusUpdate = () => {
    setConfirmationOpen(false);
    setPendingAction(null);
  };

  const getAvailableActions = () => {
    const actions = [];

    switch (order.current_status) {
      case 'ready_for_pickup':
        actions.push({
          label: t('orderActions.claimOrder', 'Claim Order'),
          action: handleClaim,
          color: 'primary' as const,
          icon: <CheckCircle />,
          disabled: false, // Always enabled - will show dialog if insufficient funds
          isClaim: true, // Mark as claim action for special styling
        });
        break;

      case 'assigned_to_agent':
        actions.push({
          label: t('orderActions.pickUp', 'Pick Up'),
          action: handlePickUp,
          color: 'success' as const,
          icon: <CheckCircle />,
        });
        actions.push({
          label: t('orderActions.dropOrder', 'Drop Order'),
          action: handleDrop,
          color: 'error' as const,
          icon: <Cancel />,
        });
        break;

      case 'picked_up':
        // Only show "Mark as In Transit" if feature flag is enabled
        if (APP_FEATURES.AGENT_MARK_AS_IN_TRANSIT) {
          actions.push({
            label: t('orderActions.markAsInTransit', 'Mark as In Transit'),
            action: () => handleStatusUpdate('in_transit'),
            color: 'primary' as const,
            icon: <LocalShipping />,
          });
        }
        actions.push({
          label: t(
            'orderActions.markAsOutForDelivery',
            'Mark as Out for Delivery'
          ),
          action: () => handleStatusUpdate('out_for_delivery'),
          color: 'secondary' as const,
          icon: <LocalShipping />,
        });
        break;

      case 'in_transit':
        actions.push({
          label: t(
            'orderActions.markAsOutForDelivery',
            'Mark as Out for Delivery'
          ),
          action: () => handleStatusUpdate('out_for_delivery'),
          color: 'secondary' as const,
          icon: <LocalShipping />,
        });
        break;

      case 'out_for_delivery':
        actions.push({
          label: t('orderActions.markAsDelivered', 'Mark as Delivered'),
          action: () => handleStatusUpdate('delivered'),
          color: 'success' as const,
          icon: <CheckCircle />,
        });
        actions.push({
          label: t('orderActions.markAsFailed', 'Mark as Failed'),
          action: () => handleStatusUpdate('failed'),
          color: 'error' as const,
          icon: <Cancel />,
        });
        break;

      default:
        // No actions available for other statuses
        break;
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
          const isClaimAction = (action as any).isClaim;
          const button = (
            <Button
              key={index}
              variant={isClaimAction ? 'contained' : 'outlined'}
              color={action.color}
              onClick={action.action}
              disabled={loading || action.disabled}
              startIcon={loading ? <CircularProgress size={16} /> : action.icon}
              size={isClaimAction ? 'large' : 'medium'}
              sx={{
                minWidth: isClaimAction ? 180 : 120,
                fontSize: isClaimAction ? '1rem' : '0.875rem',
                fontWeight: isClaimAction ? 700 : 500,
                py: isClaimAction ? 1.5 : 1,
                px: isClaimAction ? 3 : 2,
                boxShadow: isClaimAction
                  ? '0 4px 14px 0 rgba(25, 118, 210, 0.39)'
                  : 'none',
                '&:hover': isClaimAction
                  ? {
                      boxShadow: '0 6px 20px 0 rgba(25, 118, 210, 0.5)',
                      transform: 'translateY(-2px)',
                    }
                  : {},
                transition: 'all 0.3s ease-in-out',
              }}
            >
              {action.label}
            </Button>
          );

          return (action as any).tooltip ? (
            <Tooltip key={index} title={(action as any).tooltip}>
              <span>{button}</span>
            </Tooltip>
          ) : (
            button
          );
        })}
      </Box>

      <ClaimOrderDialog
        open={showClaimDialog}
        onClose={handleCloseClaimDialog}
        onConfirm={handleClaimWithTopup}
        order={order}
        userPhoneNumber={profile?.phone_number}
        loading={loading}
        success={claimSuccess}
        error={claimError}
      />

      <ConfirmationModal
        open={showClaimConfirmation}
        title={t('orders.confirmClaimOrder', 'Confirm Claim Order')}
        message={t(
          'orders.confirmClaimOrderMessage',
          'Are you sure you want to claim order #{{orderNumber}}? This action cannot be undone.',
          { orderNumber: order.order_number }
        )}
        confirmText={t('orderActions.claimOrder', 'Claim Order')}
        cancelText={t('common.cancel', 'Cancel')}
        onConfirm={handleConfirmClaim}
        onCancel={() => setShowClaimConfirmation(false)}
        confirmColor="primary"
        loading={loading}
        additionalContent={
          order.agent_hold_amount !== undefined &&
          order.agent_hold_amount > 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                {t(
                  'orders.claimOrderHoldAmountInfo',
                  'Please note: {{holdAmount}} will be withheld from your account as a guarantee. This amount will be released upon successful delivery.',
                  {
                    holdAmount: formatCurrency(
                      order.agent_hold_amount,
                      order.currency
                    ),
                  }
                )}
              </Typography>
            </Alert>
          ) : undefined
        }
      />

      <ConfirmationModal
        open={confirmationOpen}
        title={t('orders.confirmStatusChange', 'Confirm Status Change')}
        message={
          pendingAction
            ? t('orders.confirmStatusChangeMessage', {
                orderNumber: order.order_number,
                newStatus: pendingAction.label,
              })
            : ''
        }
        confirmText={t('common.confirm', 'Confirm')}
        cancelText={t('common.cancel', 'Cancel')}
        onConfirm={handleConfirmStatusUpdate}
        onCancel={handleCancelStatusUpdate}
        confirmColor={pendingAction?.color || 'primary'}
        loading={loading}
      />

      <MarkDeliveryAsFailedDialog
        open={showFailDeliveryDialog}
        order={order}
        onClose={() => setShowFailDeliveryDialog(false)}
        onConfirm={handleConfirmFailDelivery}
        loading={loading}
      />
    </>
  );
};

export default AgentActions;
