import { Alert, Box } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderData } from '../../hooks/useOrderById';
import { useUserProfile } from '../../hooks/useUserProfile';

interface AgentOrderAlertsProps {
  order: OrderData;
  agentAccounts?: any[];
}

const AgentOrderAlerts: React.FC<AgentOrderAlertsProps> = ({
  order,
  agentAccounts = [],
}) => {
  const { t } = useTranslation();
  const { profile } = useUserProfile();

  const agentVerified = profile?.agent?.is_verified || false;

  const hasSufficientFunds = () => {
    // If no account data is provided, we can't determine funds status
    // So we assume funds are sufficient (don't show warning)
    if (!agentAccounts?.length) return true;
    
    const totalBalance = agentAccounts.reduce(
      (sum, account) => sum + (account.available_balance || 0),
      0
    );
    return totalBalance >= (order.total_amount || 0);
  };

  const getAlertsForStatus = () => {
    const alerts = [];

    switch (order.current_status) {
      case 'assigned_to_agent':
        alerts.push({
          severity: 'warning' as const,
          message: t(
            'agent.orders.assignedNotice',
            'Once you claim this order, you must deliver it within 24 hours or penalties may apply.'
          ),
        });
        break;

      case 'ready_for_pickup':
        alerts.push({
          severity: 'warning' as const,
          message: t(
            'agent.orders.readyForPickupNotice',
            'Please contact the client and confirm delivery arrangements.'
          ),
        });

        // Check if order requires verified agent
        if (order.verified_agent_delivery && !agentVerified) {
          alerts.push({
            severity: 'info' as const,
            message: t(
              'agent.orders.verificationRequired',
              'This order requires a verified agent. Please contact support to get your account verified.'
            ),
          });
        }

        // Check for sufficient funds
        if (!hasSufficientFunds()) {
          alerts.push({
            severity: 'warning' as const,
            message: t(
              'agent.orders.insufficientFunds',
              'Insufficient funds to claim this order. Please top up your account.'
            ),
          });
        }
        break;

      case 'picked_up':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'agent.orders.pickedUpNotice',
            'Order has been picked up. Please proceed to deliver it to the customer.'
          ),
        });
        break;

      case 'in_transit':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'agent.orders.inTransitNotice',
            'Order is in transit. Keep the customer updated on your progress.'
          ),
        });
        break;

      case 'out_for_delivery':
        alerts.push({
          severity: 'success' as const,
          message: t(
            'agent.orders.outForDeliveryNotice',
            'Order is out for delivery. Please complete the delivery and mark as delivered.'
          ),
        });
        break;

      case 'delivered':
        alerts.push({
          severity: 'success' as const,
          message: t(
            'agent.orders.deliveredNotice',
            'Order has been successfully delivered. Thank you for your service!'
          ),
        });
        break;

      case 'failed':
        alerts.push({
          severity: 'error' as const,
          message: t(
            'agent.orders.failedNotice',
            'Order delivery failed. Please contact support if you need assistance.'
          ),
        });
        break;

      default:
        // No specific alerts for other statuses
        break;
    }

    return alerts;
  };

  const alerts = getAlertsForStatus();

  if (alerts.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 2 }}>
      {alerts.map((alert, index) => (
        <Alert
          key={index}
          severity={alert.severity}
          variant="outlined"
          sx={{ mb: index < alerts.length - 1 ? 1 : 0 }}
        >
          {alert.message}
        </Alert>
      ))}
    </Box>
  );
};

export default AgentOrderAlerts;
