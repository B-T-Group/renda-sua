import { Cancel, CheckCircle, LocalShipping } from '@mui/icons-material';
import { Box, Button, CircularProgress, Tooltip } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgentOrders } from '../../hooks/useAgentOrders';
import type { OrderData } from '../../hooks/useOrderById';
import { useUserProfile } from '../../hooks/useUserProfile';
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
  const { profile } = useUserProfile();
  const agentOrders = useAgentOrders();
  const [loading, setLoading] = useState(false);
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimError, setClaimError] = useState<string | undefined>();

  // Check if agent has sufficient funds to claim the order
  const hasSufficientFunds = () => {
    if (!agentAccounts?.length) return true; // Assume sufficient if no account data

    // Calculate required hold amount (typically a percentage of total order amount)
    const holdPercentage = 80; // 80% hold percentage - matches backend config
    const requiredHoldAmount = (order.total_amount * holdPercentage) / 100;

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
      // Use regular claim order API
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
          error.message ||
            t('messages.orderClaimError', 'Failed to claim order'),
          'error'
        );
      } finally {
        setLoading(false);
      }
    } else {
      // Show dialog for claim with topup
      setShowClaimDialog(true);
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

  const handleStatusUpdate = async (newStatus: string) => {
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
      onShowNotification?.(
        t(
          'messages.orderStatusUpdated',
          `Order status updated to ${newStatus}`
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
        actions.push({
          label: t('orderActions.markAsInTransit', 'Mark as In Transit'),
          action: () => handleStatusUpdate('in_transit'),
          color: 'primary' as const,
          icon: <LocalShipping />,
        });
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
          const button = (
            <Button
              key={index}
              variant="outlined"
              color={action.color}
              onClick={action.action}
              disabled={loading || action.disabled}
              startIcon={loading ? <CircularProgress size={16} /> : action.icon}
              sx={{ minWidth: 120 }}
            >
              {action.label}
            </Button>
          );

          return action.tooltip ? (
            <Tooltip key={index} title={action.tooltip}>
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
        userPhoneNumber={undefined}
        loading={loading}
        success={claimSuccess}
        error={claimError}
      />
    </>
  );
};

export default AgentActions;
