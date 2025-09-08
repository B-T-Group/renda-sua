import { Alert, Box } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Order } from '../../hooks/useAgentOrders';
import { useUserProfile } from '../../hooks/useUserProfile';

interface AgentOrderAlertsProps {
  order: Order;
}

const AgentOrderAlerts: React.FC<AgentOrderAlertsProps> = ({ order }) => {
  const { t } = useTranslation();
  const { profile } = useUserProfile();

  const agentVerified = profile?.agent?.is_verified || false;

  const getDeliveryFee = () => {
    // Get delivery fee from order_holds table (new API response)
    if (order.order_holds && order.order_holds.length > 0) {
      const orderHold = order.order_holds[0]; // Get the first order hold
      return orderHold.delivery_fees || 0;
    }

    // Fallback to order delivery_fee if order_holds not available
    return order.delivery_fee || 0;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: order.currency || 'USD',
    }).format(amount);
  };

  const getAlertsForStatus = () => {
    const alerts = [];
    const deliveryFee = getDeliveryFee();

    switch (order.current_status) {
      case 'pending':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'agent.orders.pendingNotice',
            'This order is waiting for business confirmation. You cannot claim it yet.'
          ),
        });
        break;

      case 'confirmed':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'agent.orders.confirmedNotice',
            'Order confirmed by business and is being prepared. It will be available for pickup soon.'
          ),
        });
        break;

      case 'preparing':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'agent.orders.preparingNotice',
            'Business is currently preparing this order. It will be ready for pickup shortly.'
          ),
        });
        break;

      case 'ready_for_pickup':
        // Check if already assigned to this agent
        if (order.assigned_agent_id === profile?.agent?.id) {
          alerts.push({
            severity: 'success' as const,
            message: t(
              'agent.orders.assignedToYou',
              `Great! You've claimed this order. Earn ${formatCurrency(
                deliveryFee
              )} by completing the delivery. Pick up from the business and deliver to the customer.`
            ),
          });
        } else if (order.assigned_agent_id) {
          alerts.push({
            severity: 'info' as const,
            message: t(
              'agent.orders.assignedToOther',
              'This order has been claimed by another agent and is no longer available.'
            ),
          });
        } else {
          // Available for claiming
          if (order.verified_agent_delivery && !agentVerified) {
            alerts.push({
              severity: 'warning' as const,
              message: t(
                'agent.orders.verificationRequired',
                'This order requires a verified agent. Please complete your verification to claim high-value orders.'
              ),
            });
          } else {
            alerts.push({
              severity: 'success' as const,
              message: t(
                'agent.orders.canClaim',
                `🚀 Perfect opportunity! Claim this order and earn ${formatCurrency(
                  deliveryFee
                )} for the delivery.`
              ),
            });
          }
        }
        break;

      case 'picked_up':
        if (order.assigned_agent_id === profile?.agent?.id) {
          alerts.push({
            severity: 'warning' as const,
            message: t(
              'agent.orders.pickedUpByYou',
              `You've picked up this order. Deliver it promptly to earn your ${formatCurrency(
                deliveryFee
              )} delivery fee. Keep the customer informed of your progress.`
            ),
          });
        } else {
          alerts.push({
            severity: 'info' as const,
            message: t(
              'agent.orders.pickedUpByOther',
              'This order has been picked up by the assigned agent and is on its way to the customer.'
            ),
          });
        }
        break;

      case 'in_transit':
        if (order.assigned_agent_id === profile?.agent?.id) {
          alerts.push({
            severity: 'warning' as const,
            message: t(
              'agent.orders.inTransitByYou',
              `Order in transit. You're almost there! Complete the delivery to earn ${formatCurrency(
                deliveryFee
              )}. Update the customer on your ETA.`
            ),
          });
        } else {
          alerts.push({
            severity: 'info' as const,
            message: t(
              'agent.orders.inTransitByOther',
              'Order is currently being delivered by the assigned agent.'
            ),
          });
        }
        break;

      case 'out_for_delivery':
        if (order.assigned_agent_id === profile?.agent?.id) {
          alerts.push({
            severity: 'warning' as const,
            message: t(
              'agent.orders.outForDeliveryByYou',
              `Final step! You're out for delivery. Complete this delivery to earn ${formatCurrency(
                deliveryFee
              )}. Make sure to get confirmation from the customer.`
            ),
          });
        } else {
          alerts.push({
            severity: 'info' as const,
            message: t(
              'agent.orders.outForDeliveryByOther',
              'Order is out for delivery and should reach the customer soon.'
            ),
          });
        }
        break;

      case 'delivered':
        if (order.assigned_agent_id === profile?.agent?.id) {
          alerts.push({
            severity: 'success' as const,
            message: t(
              'agent.orders.deliveredByYou',
              `🎉 Excellent work! You've successfully delivered this order and earned ${formatCurrency(
                deliveryFee
              )}. Payment will be processed shortly.`
            ),
          });
        } else {
          alerts.push({
            severity: 'success' as const,
            message: t(
              'agent.orders.deliveredByOther',
              'Order has been successfully delivered to the customer.'
            ),
          });
        }
        break;

      case 'completed':
        if (order.assigned_agent_id === profile?.agent?.id) {
          alerts.push({
            severity: 'success' as const,
            message: t(
              'agent.orders.completedByYou',
              `✅ Order completed! Your ${formatCurrency(
                deliveryFee
              )} delivery payment has been processed. Thank you for your excellent service!`
            ),
          });
        } else {
          alerts.push({
            severity: 'success' as const,
            message: t(
              'agent.orders.completedByOther',
              'Order has been completed successfully.'
            ),
          });
        }
        break;

      case 'cancelled':
        alerts.push({
          severity: 'error' as const,
          message: t(
            'agent.orders.cancelledNotice',
            'This order has been cancelled and is no longer available for delivery.'
          ),
        });
        break;

      case 'failed':
        if (order.assigned_agent_id === profile?.agent?.id) {
          alerts.push({
            severity: 'error' as const,
            message: t(
              'agent.orders.failedByYou',
              'Delivery failed. Please contact support immediately to resolve this issue and avoid penalties.'
            ),
          });
        } else {
          alerts.push({
            severity: 'error' as const,
            message: t(
              'agent.orders.failedByOther',
              'This delivery failed. A new agent may be assigned to retry the delivery.'
            ),
          });
        }
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
