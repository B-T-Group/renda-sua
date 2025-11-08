import {
  Assignment,
  CheckCircle,
  FlashOn,
  Info,
  Warning,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useBackendOrders } from '../../hooks/useBackendOrders';
import type { Order } from '../../hooks/useOrders';
import ConfirmationModal from './ConfirmationModal';

interface OrderActionCardProps {
  order: Order;
  userType: 'client' | 'business' | 'agent';
  formatCurrency: (amount: number, currency?: string) => string;
  onActionComplete?: () => void;
}

const OrderActionCard: React.FC<OrderActionCardProps> = ({
  order,
  userType,
  formatCurrency,
  onActionComplete,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const { completeOrder } = useBackendOrders();
  const [loading, setLoading] = useState(false);
  const [completeConfirmationOpen, setCompleteConfirmationOpen] =
    useState(false);

  const getActionRequiredInfo = () => {
    const status = order.current_status;

    switch (userType) {
      case 'business':
        switch (status) {
          case 'pending':
            return {
              required: true,
              severity: 'warning' as const,
              icon: <Assignment />,
              message: t(
                'orders.business.actionRequired.pending',
                'Action Required: Confirm this order'
              ),
              action: 'confirm',
            };
          case 'preparing':
            return {
              required: true,
              severity: 'info' as const,
              icon: <Info />,
              message: t(
                'orders.business.actionRequired.preparing',
                'Action Required: Complete preparation'
              ),
              action: 'complete_preparation',
            };
          case 'delivered':
            return {
              required: true,
              severity: 'success' as const,
              icon: <CheckCircle />,
              message: t(
                'orders.business.actionRequired.delivered',
                'Action Required: Complete order'
              ),
              action: 'complete_order',
            };
          default:
            return { required: false };
        }

      case 'client':
        switch (status) {
          case 'delivered':
            return {
              required: true,
              severity: 'success' as const,
              icon: <CheckCircle />,
              message: t(
                'orders.client.actionRequired.delivered',
                'Action Required: Complete order to release payment'
              ),
              action: 'complete_order',
            };

          default:
            return { required: false };
        }

      case 'agent':
        switch (status) {
          case 'ready_for_pickup':
            if (!order.assigned_agent_id) {
              return {
                required: true,
                severity: 'info' as const,
                icon: <Assignment />,
                message: t(
                  'orders.agent.actionRequired.ready_for_pickup',
                  'Action Required: Claim this order'
                ),
                action: 'claim_order',
              };
            }
            return { required: false };
          case 'picked_up':
            return {
              required: true,
              severity: 'warning' as const,
              icon: <Warning />,
              message: t(
                'orders.agent.actionRequired.picked_up',
                'Action Required: Start delivery'
              ),
              action: 'start_delivery',
            };
          case 'in_transit':
            return {
              required: true,
              severity: 'info' as const,
              icon: <Info />,
              message: t(
                'orders.agent.actionRequired.in_transit',
                'Action Required: Update delivery status'
              ),
              action: 'update_status',
            };
          default:
            return { required: false };
        }

      default:
        return { required: false };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'confirmed':
        return 'info';
      case 'preparing':
        return 'primary';
      case 'ready_for_pickup':
        return 'secondary';
      case 'picked_up':
        return 'primary';
      case 'in_transit':
        return 'primary';
      case 'out_for_delivery':
        return 'secondary';
      case 'delivered':
        return 'success';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const formatAddress = (address: any) => {
    if (!address) return '';
    const parts = [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const handleCompleteOrderClick = () => {
    setCompleteConfirmationOpen(true);
  };

  const handleConfirmCompleteOrder = async () => {
    setLoading(true);
    try {
      await completeOrder({ orderId: order.id });
      setCompleteConfirmationOpen(false);
      onActionComplete?.();
    } catch (error) {
      console.error('Failed to complete order:', error);
      // Error is handled by the hook, but we still close the modal
      setCompleteConfirmationOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelCompleteOrder = () => {
    setCompleteConfirmationOpen(false);
  };

  const actionInfo = getActionRequiredInfo();

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        {/* Order Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 2,
          }}
        >
          <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
            Order #{order.order_number}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={t(
                `common.orderStatus.${order.current_status}`,
                order.current_status
              )}
              color={getStatusColor(order.current_status) as any}
              size="small"
            />
            {order.requires_fast_delivery && (
              <Chip
                label={t('orders.fastDelivery.title', 'Fast Delivery')}
                color="warning"
                size="small"
                icon={<FlashOn fontSize="small" />}
              />
            )}
          </Box>
        </Box>

        {/* Action Required Alert */}
        {actionInfo.required && (
          <Alert
            severity={actionInfo.severity}
            icon={actionInfo.icon}
            sx={{ mb: 2 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {actionInfo.message}
            </Typography>
          </Alert>
        )}

        {/* Order Details */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <strong>Business Location:</strong> {order.business_location?.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <strong>Client:</strong> {order.client?.user?.first_name}
            {profile?.agent?.id &&
              order.assigned_agent_id &&
              order.assigned_agent_id === profile.agent.id &&
              order.client?.user &&
              'phone_number' in order.client.user &&
              order.client.user.phone_number && (
                <> 📞 {order.client.user.phone_number}</>
              )}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <strong>Items:</strong> {order.order_items?.length || 0}
          </Typography>
          <Box sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              {userType === 'agent' ? (
                <strong>
                  {t('orders.deliveryCommission', 'Delivery Commission')}:
                </strong>
              ) : (
                <strong>
                  {t('orders.amountBreakdown', 'Amount Breakdown')}:
                </strong>
              )}
            </Typography>
            <Box sx={{ pl: 1 }}>
              {userType === 'agent' ? (
                // Agent view: Show only delivery commission
                (order as any).delivery_commission !== undefined && (
                  <Typography variant="body2" fontWeight="bold" color="primary">
                    {t('orders.earnings', 'Your Earnings')}:{' '}
                    {formatCurrency(
                      (order as any).delivery_commission,
                      order.currency
                    )}
                  </Typography>
                )
              ) : (
                // Business/Client view: Show full breakdown
                <>
                  {order.subtotal !== undefined && (
                    <Typography variant="body2" color="text.secondary">
                      {t('orders.subtotal', 'Subtotal')}:{' '}
                      {formatCurrency(order.subtotal, order.currency)}
                    </Typography>
                  )}
                  {(order.base_delivery_fee || 0) +
                    (order.per_km_delivery_fee || 0) >
                    0 && (
                    <Typography variant="body2" color="text.secondary">
                      {t('orders.deliveryFee', 'Delivery')}:{' '}
                      {formatCurrency(
                        (order.base_delivery_fee || 0) +
                          (order.per_km_delivery_fee || 0),
                        order.currency
                      )}
                    </Typography>
                  )}
                  {order.tax_amount > 0 && (
                    <Typography variant="body2" color="text.secondary">
                      {t('orders.tax', 'Tax')}:{' '}
                      {formatCurrency(order.tax_amount, order.currency)}
                    </Typography>
                  )}
                  {order.total_amount !== undefined && (
                    <Typography
                      variant="body2"
                      fontWeight="bold"
                      color="primary"
                    >
                      {t('orders.total', 'Total')}:{' '}
                      {formatCurrency(order.total_amount, order.currency)}
                    </Typography>
                  )}
                </>
              )}
            </Box>
          </Box>
        </Box>

        {/* Addresses */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            <strong>Pickup:</strong>{' '}
            {formatAddress(order.business_location?.address)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Delivery:</strong> {formatAddress(order.delivery_address)}
            {profile?.agent?.id &&
              order.assigned_agent_id &&
              order.assigned_agent_id === profile.agent.id &&
              order.client?.user &&
              'phone_number' in order.client.user &&
              order.client.user.phone_number && (
                <> • 📞 {order.client.user.phone_number}</>
              )}
          </Typography>
        </Box>

        {/* Special Instructions */}
        {order.special_instructions && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Special Instructions:</strong>{' '}
              {order.special_instructions}
            </Typography>
          </Box>
        )}
      </CardContent>

      <CardActions>
        {userType === 'client' &&
        order.current_status === 'delivered' &&
        actionInfo.required ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              width: '100%',
            }}
          >
            <Button
              variant="contained"
              color="success"
              onClick={handleCompleteOrderClick}
              disabled={loading}
              startIcon={
                loading ? <CircularProgress size={16} /> : <CheckCircle />
              }
              fullWidth
            >
              {loading
                ? t('orders.completing', 'Completing...')
                : t('orders.completeOrder', 'Complete Order')}
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => navigate(`/orders/${order.id}`)}
              fullWidth
            >
              {t('orders.viewDetails', 'View Details')}
            </Button>
          </Box>
        ) : (
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={() => navigate(`/orders/${order.id}`)}
          >
            {actionInfo.required
              ? t('orders.viewAndTakeAction', 'View & Take Action')
              : t('orders.viewDetails', 'View Details')}
          </Button>
        )}
      </CardActions>

      {/* Order Completion Confirmation Modal */}
      {userType === 'client' && (
        <ConfirmationModal
          open={completeConfirmationOpen}
          title={t('orders.confirmOrderCompletion', 'Confirm Order Completion')}
          message={t('orders.confirmOrderCompletionMessage', {
            orderNumber: order.order_number,
            defaultValue: `Are you sure you want to complete order #${order.order_number}? This action cannot be undone.`,
          })}
          confirmText={t('common.confirm', 'Confirm')}
          cancelText={t('common.cancel', 'Cancel')}
          onConfirm={handleConfirmCompleteOrder}
          onCancel={handleCancelCompleteOrder}
          confirmColor="success"
          loading={loading}
        />
      )}
    </Card>
  );
};

export default OrderActionCard;
