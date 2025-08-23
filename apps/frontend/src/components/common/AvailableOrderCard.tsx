import {
  Business as BusinessIcon,
  LocalShipping as DeliveryIcon,
  LocationOn as LocationIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import {
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
import type { DeliveryFee } from '../../hooks/useDeliveryFees';
import type { OrderData } from '../../hooks/useOrderById';

interface AvailableOrderCardProps {
  order: OrderData;
  deliveryFees?: DeliveryFee[];
  getDeliveryFeeByCurrency?: (currency: string) => DeliveryFee | null;
}

const AvailableOrderCard: React.FC<AvailableOrderCardProps> = ({
  order,
  deliveryFees = [],
  getDeliveryFeeByCurrency,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getDeliveryFee = () => {
    // Get delivery fee from API based on order currency
    if (getDeliveryFeeByCurrency && order.currency) {
      const deliveryFeeData = getDeliveryFeeByCurrency(order.currency);
      return deliveryFeeData?.fee || 0;
    }
    // Fallback to order delivery_fee if API data not available
    return order.delivery_fee || 0;
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready_for_pickup':
        return 'success';
      case 'pending':
        return 'warning';
      case 'confirmed':
        return 'info';
      case 'preparing':
        return 'primary';
      default:
        return 'default';
    }
  };

  const deliveryFee = getDeliveryFee();

  return (
    <Card sx={{ display: 'flex', mb: 2, position: 'relative' }}>
      {/* Order Image */}
      <Box
        sx={{
          width: 120,
          minHeight: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.100',
          overflow: 'hidden',
          borderRadius: 0,
        }}
      >
        {order.items?.[0]?.item?.images?.[0]?.image_url ? (
          <img
            src={order.items[0].item.images[0].image_url}
            alt={t('orders.orderImage', 'Order')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML =
                  '<div style="font-size: 2rem; color: #999;"><span role="img" aria-label="package">📦</span></div>';
              }
            }}
          />
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'grey.500',
              fontSize: '2rem',
              width: '100%',
              height: '100%',
            }}
          >
            <span role="img" aria-label="package">
              📦
            </span>
          </Box>
        )}
      </Box>

      {/* Order Details */}
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 1,
          }}
        >
          <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
            {t('common.orderNumber', 'Order')} #{order.order_number}
          </Typography>
          <Chip
            label={t(
              `common.orderStatus.${order.current_status}`,
              order.current_status
            )}
            color={getStatusColor(order.current_status) as any}
            size="small"
          />
        </Box>

        {/* Business and Client Info */}
        <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BusinessIcon color="primary" sx={{ fontSize: 16 }} />
            <Typography variant="body2" color="text.secondary">
              {order.business?.name || t('common.business', 'Business')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon color="primary" sx={{ fontSize: 16 }} />
            <Typography variant="body2" color="text.secondary">
              {order.client?.user?.first_name} {order.client?.user?.last_name}
            </Typography>
          </Box>
        </Box>

        {/* Addresses */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
          {/* Pickup Address */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <LocationIcon color="primary" sx={{ fontSize: 16, mt: 0.2 }} />
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
              >
                {t('orders.pickupAddress', 'Pickup from')}:
              </Typography>
              <Typography variant="body2">
                {formatAddress(order.business_location?.address)}
              </Typography>
            </Box>
          </Box>

          {/* Delivery Address */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <LocationIcon color="secondary" sx={{ fontSize: 16, mt: 0.2 }} />
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
              >
                {t('orders.deliveryAddress', 'Deliver to')}:
              </Typography>
              <Typography variant="body2">
                {formatAddress(order.client_address)}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Order Summary */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Box>
            <Typography variant="body2" color="text.secondary">
              {t('orders.items', 'Items')}: {order.items?.length || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('orders.total', 'Total')}:{' '}
              {formatCurrency(order.total_amount, order.currency)}
            </Typography>
          </Box>

          {/* Delivery Fee Highlight */}
          <Box sx={{ textAlign: 'right' }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
            >
              <DeliveryIcon color="success" sx={{ fontSize: 20 }} />
              <Typography
                variant="h6"
                color="success.main"
                sx={{ fontWeight: 700 }}
              >
                {formatCurrency(deliveryFee, order.currency)}
              </Typography>
            </Box>
            <Typography
              variant="caption"
              color="success.main"
              sx={{ fontWeight: 600 }}
            >
              {t('orders.deliveryFee', 'Delivery Fee')}
            </Typography>
          </Box>
        </Box>

        {/* Action Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate(`/orders/${order.id}/manage`)}
            sx={{ fontWeight: 600 }}
          >
            {t('orders.manageOrder', 'Manage Order')}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default AvailableOrderCard;
