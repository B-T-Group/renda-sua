import {
  LocalShipping as LocalShippingIcon,
  Schedule as ScheduleIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface OrderCardProps {
  order: any;
}

const OrderCard: React.FC<OrderCardProps> = ({ order }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

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
      case 'assigned_to_agent':
        return 'info';
      case 'picked_up':
        return 'primary';
      case 'in_transit':
        return 'primary';
      case 'out_for_delivery':
        return 'secondary';
      case 'delivered':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'failed':
        return 'error';
      case 'refunded':
        return 'warning';
      case 'complete':
        return 'success';
      default:
        return 'default';
    }
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get the first item's image for display
  const getOrderImage = () => {
    if (order.order_items && order.order_items.length > 0) {
      const firstItem = order.order_items[0];
      if (
        firstItem.item?.item_images &&
        firstItem.item.item_images.length > 0
      ) {
        return firstItem.item.item_images[0].image_url;
      }
    }
    return null;
  };

  const orderImage = getOrderImage();

  return (
    <Card sx={{ display: 'flex', alignItems: 'center', p: 2, mb: 2 }}>
      {/* Order Image */}
      <Box sx={{ flexShrink: 0, mr: 3 }}>
        {orderImage ? (
          <Avatar
            src={orderImage}
            alt={t('orders.orderImage', 'Order')}
            sx={{
              width: 80,
              height: 80,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
            }}
            variant="rounded"
          />
        ) : (
          <Avatar
            sx={{
              width: 80,
              height: 80,
              borderRadius: 2,
              bgcolor: 'grey.100',
              border: '1px solid',
              borderColor: 'divider',
              color: 'grey.500',
            }}
            variant="rounded"
          >
            📦
          </Avatar>
        )}
      </Box>

      {/* Order Details */}
      <CardContent sx={{ flex: 1, p: 0, '&:last-child': { pb: 0 } }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          mb={1}
        >
          <Typography variant="h6" component="div">
            {t('common.orderNumber', { number: order.order_number })}
          </Typography>
          <Chip
            label={t(`common.orderStatus.${order.current_status || 'unknown'}`)}
            color={getStatusColor(order.current_status || 'unknown') as any}
            size="small"
          />
        </Box>

        <Typography variant="body2" color="text.secondary" mb={1}>
          {order.business?.name}
        </Typography>

        <Box display="flex" alignItems="center" gap={2} mb={1}>
          <Typography
            variant="body2"
            color="text.secondary"
            display="flex"
            alignItems="center"
          >
            <ScheduleIcon sx={{ mr: 0.5, fontSize: 16 }} />
            {formatDate(order.created_at)}
          </Typography>
          {order.assigned_agent && (
            <Typography
              variant="body2"
              color="text.secondary"
              display="flex"
              alignItems="center"
            >
              <LocalShippingIcon sx={{ mr: 0.5, fontSize: 16 }} />
              {order.assigned_agent.user.first_name}{' '}
              {order.assigned_agent.user.last_name}
            </Typography>
          )}
        </Box>

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" color="primary" fontWeight="bold">
            {formatCurrency(order.total_amount, order.currency)}
          </Typography>

          <Button
            variant="contained"
            size="small"
            startIcon={<VisibilityIcon />}
            onClick={() => navigate(`/orders/${order.id}`)}
          >
            {t('orders.manage', 'Manage')}
          </Button>
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.5, display: 'block' }}
        >
          {order.order_items?.length || 0} {t('orders.table.items')}
        </Typography>
      </CardContent>
    </Card>
  );
};

export default OrderCard;
