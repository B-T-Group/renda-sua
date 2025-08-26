import { Alert, Box } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderData } from '../../hooks/useOrderById';

interface BusinessOrderAlertsProps {
  order: OrderData;
}

const BusinessOrderAlerts: React.FC<BusinessOrderAlertsProps> = ({ order }) => {
  const { t } = useTranslation();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: order.order_items[0].item.currency || 'XAF',
    }).format(amount);
  };

  const getExpectedRevenue = () => {
    return order.subtotal || 0;
  };

  const getAlertsForStatus = () => {
    const alerts = [];
    const revenue = getExpectedRevenue();

    switch (order.current_status) {
      case 'pending':
        alerts.push({
          severity: 'warning' as const,
          message: t(
            'business.orders.pendingNotice',
            `💰 New order worth ${formatCurrency(
              revenue
            )}! Customer is waiting for confirmation. Confirm quickly to ensure customer satisfaction and secure this sale.`
          ),
        });
        break;

      case 'confirmed':
        alerts.push({
          severity: 'success' as const,
          message: t(
            'business.orders.confirmedNotice',
            '✅ Order confirmed! Begin preparation immediately. Quality preparation ensures customer satisfaction and positive reviews.'
          ),
        });
        break;

      case 'preparing':
        alerts.push({
          severity: 'warning' as const,
          message: t(
            'business.orders.preparingNotice',
            '👨‍🍳 Preparation in progress. Complete carefully and mark as "Ready for Pickup" to notify available agents.'
          ),
        });
        break;

      case 'ready_for_pickup':
        if (order.assigned_agent_id) {
          alerts.push({
            severity: 'success' as const,
            message: t(
              'business.orders.agentAssigned',
              '🚚 Great! An agent has claimed this order and will arrive soon. Have the order ready for quick handoff.'
            ),
          });
        } else {
          alerts.push({
            severity: 'info' as const,
            message: t(
              'business.orders.waitingForAgent',
              '📦 Order ready for pickup! Waiting for an agent to claim this delivery. Keep the order prepared and ready.'
            ),
          });
        }
        break;

      case 'assigned_to_agent':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'business.orders.assignedToAgentNotice',
            'An agent has been assigned to collect this order from your location.'
          ),
        });
        break;

      case 'picked_up':
        alerts.push({
          severity: 'success' as const,
          message: t(
            'business.orders.pickedUpNotice',
            'Order has been picked up by the agent and is being delivered to the customer.'
          ),
        });
        break;

      case 'in_transit':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'business.orders.inTransitNotice',
            'Order is in transit to the customer.'
          ),
        });
        break;

      case 'out_for_delivery':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'business.orders.outForDeliveryNotice',
            'Order is out for delivery to the customer.'
          ),
        });
        break;

      case 'delivered':
        alerts.push({
          severity: 'success' as const,
          message: t(
            'business.orders.deliveredNotice',
            `🎉 Order delivered successfully! Customer received their ${formatCurrency(
              revenue
            )} order. Excellent service provided!`
          ),
        });
        break;

      case 'failed':
        alerts.push({
          severity: 'error' as const,
          message: t(
            'business.orders.failedNotice',
            `🚨 Delivery failed! This impacts customer satisfaction and your ${formatCurrency(
              revenue
            )} revenue. Contact support immediately to resolve and potentially reassign to another agent.`
          ),
        });
        break;

      case 'cancelled':
        alerts.push({
          severity: 'error' as const,
          message: t(
            'business.orders.cancelledNotice',
            `❌ Order cancelled. Potential revenue of ${formatCurrency(
              revenue
            )} lost. Review cancellation reason and process refund if payment was received.`
          ),
        });
        break;

      case 'refunded':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'business.orders.refundedNotice',
            'Order has been refunded to the customer.'
          ),
        });
        break;

      case 'complete':
        alerts.push({
          severity: 'success' as const,
          message: t(
            'business.orders.completeNotice',
            'Order is complete. Thank you for using our platform!'
          ),
        });
        break;

      default:
        // No specific alerts for unknown statuses
        break;
    }

    // Add payment-related alerts
    if (
      order.payment_status === 'pending' &&
      !['cancelled', 'refunded'].includes(order.current_status)
    ) {
      alerts.push({
        severity: 'warning' as const,
        message: t(
          'business.orders.paymentPendingNotice',
          'Customer payment is still pending. Order may be cancelled if payment is not received.'
        ),
      });
    }

    // Add special instructions alert if present
    if (
      order.special_instructions &&
      ['pending', 'confirmed', 'preparing'].includes(order.current_status)
    ) {
      alerts.push({
        severity: 'info' as const,
        message: t(
          'business.orders.specialInstructionsNotice',
          `📝 Special instructions: "${order.special_instructions}". Follow these carefully to ensure customer satisfaction.`
        ),
      });
    }

    // Add high-value order alert
    if (
      revenue > 100 &&
      ['pending', 'confirmed', 'preparing'].includes(order.current_status)
    ) {
      alerts.push({
        severity: 'info' as const,
        message: t(
          'business.orders.highValueOrder',
          '💎 High-value order! Extra care recommended. Ensure quality preparation to maintain premium service standards.'
        ),
      });
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

export default BusinessOrderAlerts;
