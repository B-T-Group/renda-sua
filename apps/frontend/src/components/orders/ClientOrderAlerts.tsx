import { Alert, Box } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderData } from '../../hooks/useOrderById';

interface ClientOrderAlertsProps {
  order: OrderData;
}

const ClientOrderAlerts: React.FC<ClientOrderAlertsProps> = ({ order }) => {
  const { t } = useTranslation();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: order.currency || 'USD',
    }).format(amount);
  };

  const getOrderTotal = () => {
    return order.total_amount || 0;
  };

  const getAlertsForStatus = () => {
    const alerts = [];
    const orderTotal = getOrderTotal();

    switch (order.current_status) {
      case 'pending':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'client.orders.pendingNotice',
            `⏳ Your ${formatCurrency(
              orderTotal
            )} order is awaiting business confirmation. They typically respond within 10-15 minutes. You'll be notified once confirmed!`
          ),
        });
        break;

      case 'confirmed':
        alerts.push({
          severity: 'success' as const,
          message: t(
            'client.orders.confirmedNotice',
            `✅ Great news! Your order has been confirmed and preparation has begun. You'll receive updates as it progresses.`
          ),
        });
        break;

      case 'preparing':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'client.orders.preparingNotice',
            "👨‍🍳 Your order is being carefully prepared. Quality takes time - we'll notify you when it's ready for pickup!"
          ),
        });
        break;

      case 'ready_for_pickup':
        if (order.assigned_agent_id) {
          alerts.push({
            severity: 'success' as const,
            message: t(
              'client.orders.agentAssigned',
              '🚚 Excellent! An agent has claimed your order and will pick it up shortly. Your delivery is now in progress!'
            ),
          });
        } else {
          alerts.push({
            severity: 'warning' as const,
            message: t(
              'client.orders.readyForPickupNotice',
              "📦 Your order is ready! We're finding the perfect agent to deliver it to you. This usually takes just a few minutes."
            ),
          });
        }
        break;

      case 'assigned_to_agent':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'client.orders.assignedToAgentNotice',
            'An agent has been assigned to your order and will pick it up soon.'
          ),
        });
        break;

      case 'picked_up':
        alerts.push({
          severity: 'success' as const,
          message: t(
            'client.orders.pickedUpNotice',
            '🏃‍♂️ Your order is on the move! Our agent has picked it up and is heading your way. Get ready to enjoy your purchase!'
          ),
        });
        break;

      case 'in_transit':
        alerts.push({
          severity: 'warning' as const,
          message: t(
            'client.orders.inTransitNotice',
            "🚗 Your order is on its way! The agent will contact you when they're nearby. Please keep your phone handy."
          ),
        });
        break;

      case 'out_for_delivery':
        alerts.push({
          severity: 'warning' as const,
          message: t(
            'client.orders.outForDeliveryNotice',
            '🚪 Almost there! Your order is out for delivery. Please be available at your delivery address - our agent will arrive soon!'
          ),
        });
        break;

      case 'delivered':
        alerts.push({
          severity: 'success' as const,
          message: t(
            'client.orders.deliveredNotice',
            `🎉 Delivered! Your ${formatCurrency(
              orderTotal
            )} order has arrived safely. We hope you love it! Thank you for choosing our service.`
          ),
        });
        break;

      case 'cancelled':
        alerts.push({
          severity: 'error' as const,
          message: t(
            'client.orders.cancelledNotice',
            `❌ Your order has been cancelled. Any payment of ${formatCurrency(
              orderTotal
            )} will be refunded within 3-5 business days. Contact support if you have questions.`
          ),
        });
        break;

      case 'failed':
        alerts.push({
          severity: 'error' as const,
          message: t(
            'client.orders.failedNotice',
            "🚨 Delivery failed! Don't worry - we're working to resolve this immediately. You may receive a new delivery agent or a full refund. We'll keep you updated!"
          ),
        });
        break;

      case 'refunded':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'client.orders.refundedNotice',
            `💰 Your ${formatCurrency(
              orderTotal
            )} refund has been processed and should appear in your account within 3-5 business days. Thank you for your patience.`
          ),
        });
        break;

      case 'complete':
        alerts.push({
          severity: 'success' as const,
          message: t(
            'client.orders.completeNotice',
            '✅ Order complete! We hope you enjoyed your purchase. Please consider leaving a review to help other customers!'
          ),
        });
        break;

      default:
        // No specific alerts for unknown statuses
        break;
    }

    // Add payment-related alerts - only show when delivered
    if (
      order.payment_status === 'pending' &&
      order.current_status === 'delivered'
    ) {
      alerts.push({
        severity: 'warning' as const,
        message: t(
          'client.orders.paymentPendingNotice',
          'Payment is still pending for this order. Please ensure payment is completed.'
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

export default ClientOrderAlerts;
