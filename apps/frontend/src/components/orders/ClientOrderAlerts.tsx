import { Alert, Box } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderData } from '../../hooks/useOrderById';

interface ClientOrderAlertsProps {
  order: OrderData;
}

const ClientOrderAlerts: React.FC<ClientOrderAlertsProps> = ({ order }) => {
  const { t } = useTranslation();

  const getAlertsForStatus = () => {
    const alerts = [];

    switch (order.current_status) {
      case 'pending':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'client.orders.pendingNotice',
            'Your order is pending confirmation from the business. You will be notified once it is confirmed.'
          ),
        });
        break;

      case 'confirmed':
        alerts.push({
          severity: 'success' as const,
          message: t(
            'client.orders.confirmedNotice',
            'Your order has been confirmed and is being prepared.'
          ),
        });
        break;

      case 'preparing':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'client.orders.preparingNotice',
            'Your order is being prepared. It will be ready for pickup soon.'
          ),
        });
        break;

      case 'ready_for_pickup':
        alerts.push({
          severity: 'warning' as const,
          message: t(
            'client.orders.readyForPickupNotice',
            'Your order is ready for pickup and an agent will be assigned soon.'
          ),
        });
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
          severity: 'primary' as const,
          message: t(
            'client.orders.pickedUpNotice',
            'Your order has been picked up by our agent and is on its way to you.'
          ),
        });
        break;

      case 'in_transit':
        alerts.push({
          severity: 'primary' as const,
          message: t(
            'client.orders.inTransitNotice',
            'Your order is in transit. The agent will contact you when nearby.'
          ),
        });
        break;

      case 'out_for_delivery':
        alerts.push({
          severity: 'warning' as const,
          message: t(
            'client.orders.outForDeliveryNotice',
            'Your order is out for delivery. Please be available to receive it.'
          ),
        });
        break;

      case 'delivered':
        alerts.push({
          severity: 'success' as const,
          message: t(
            'client.orders.deliveredNotice',
            'Your order has been successfully delivered. Thank you for your business!'
          ),
        });
        break;

      case 'cancelled':
        alerts.push({
          severity: 'error' as const,
          message: t(
            'client.orders.cancelledNotice',
            'Your order has been cancelled. If you have any questions, please contact support.'
          ),
        });
        break;

      case 'failed':
        alerts.push({
          severity: 'error' as const,
          message: t(
            'client.orders.failedNotice',
            'There was an issue with your order delivery. Please contact support for assistance.'
          ),
        });
        break;

      case 'refunded':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'client.orders.refundedNotice',
            'Your order has been refunded. The refund should appear in your account soon.'
          ),
        });
        break;

      case 'complete':
        alerts.push({
          severity: 'success' as const,
          message: t(
            'client.orders.completeNotice',
            'Your order is complete. Thank you for choosing our service!'
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
