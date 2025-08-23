import { Alert, Box } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderData } from '../../hooks/useOrderById';

interface BusinessOrderAlertsProps {
  order: OrderData;
}

const BusinessOrderAlerts: React.FC<BusinessOrderAlertsProps> = ({ order }) => {
  const { t } = useTranslation();

  const getAlertsForStatus = () => {
    const alerts = [];

    switch (order.current_status) {
      case 'pending':
        alerts.push({
          severity: 'warning' as const,
          message: t(
            'business.orders.pendingNotice',
            'New order received! Please review and confirm this order to proceed with preparation.'
          ),
        });
        break;

      case 'confirmed':
        alerts.push({
          severity: 'info' as const,
          message: t(
            'business.orders.confirmedNotice',
            'Order confirmed. Please prepare the items and mark as ready when complete.'
          ),
        });
        break;

      case 'preparing':
        alerts.push({
          severity: 'primary' as const,
          message: t(
            'business.orders.preparingNotice',
            'Order is being prepared. Mark as ready for pickup when items are complete.'
          ),
        });
        break;

      case 'ready_for_pickup':
        alerts.push({
          severity: 'success' as const,
          message: t(
            'business.orders.readyForPickupNotice',
            'Order is ready for pickup. An agent will be assigned to collect it soon.'
          ),
        });
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
          severity: 'primary' as const,
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
            'Order has been delivered successfully! You can now mark it as complete or process a refund if needed.'
          ),
        });
        break;

      case 'failed':
        alerts.push({
          severity: 'error' as const,
          message: t(
            'business.orders.failedNotice',
            'Order delivery failed. You may need to process a refund or arrange alternative delivery.'
          ),
        });
        break;

      case 'cancelled':
        alerts.push({
          severity: 'warning' as const,
          message: t(
            'business.orders.cancelledNotice',
            'Order has been cancelled. Consider processing a refund if payment was received.'
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
    if (order.special_instructions) {
      alerts.push({
        severity: 'info' as const,
        message: t(
          'business.orders.specialInstructionsNotice',
          'This order has special instructions. Please review them carefully.'
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
