import {
  ArrowForward,
  CheckCircle,
  LocalShipping as LocalShippingIcon,
  LocationOn,
  Schedule as ScheduleIcon,
  Store,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface OrderCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any;
}

const OrderCard: React.FC<OrderCardProps> = ({ order }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
      case 'pending_payment':
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

  const getStatusProgress = (status: string): number => {
    const statusProgression = {
      pending: 10,
      pending_payment: 15,
      confirmed: 25,
      preparing: 40,
      ready_for_pickup: 55,
      assigned_to_agent: 65,
      picked_up: 75,
      in_transit: 85,
      out_for_delivery: 95,
      delivered: 100,
      complete: 100,
      cancelled: 0,
      failed: 0,
      refunded: 0,
    };
    return statusProgression[status as keyof typeof statusProgression] || 0;
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
  const currentStatus = order.current_status || 'unknown';
  const statusProgress = getStatusProgress(currentStatus);
  const isCompleted = ['delivered', 'complete'].includes(currentStatus);
  const isCancelled = ['cancelled', 'failed', 'refunded'].includes(
    currentStatus
  );

  return (
    <Card
      sx={{
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        border: '1px solid',
        borderColor: 'divider',
        '&:hover': {
          boxShadow: 6,
          borderColor: 'primary.main',
          transform: 'translateY(-2px)',
        },
      }}
    >
      {/* Progress Bar - Top of Card */}
      {!isCancelled && (
        <LinearProgress
          variant="determinate"
          value={statusProgress}
          sx={{
            height: 6,
            bgcolor: 'grey.200',
            '& .MuiLinearProgress-bar': {
              bgcolor: isCompleted ? 'success.main' : 'primary.main',
            },
          }}
        />
      )}

      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        {/* Header Section */}
        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              mb: 1,
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Typography
              variant="h6"
              component="div"
              fontWeight="bold"
              sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}
            >
              {t('common.orderNumber', { orderNumber: order.order_number })}
            </Typography>
            <Chip
              label={t(`common.orderStatus.${currentStatus}`)}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              color={getStatusColor(currentStatus) as any}
              size="small"
              sx={{ fontWeight: 600 }}
              icon={isCompleted ? <CheckCircle fontSize="small" /> : undefined}
            />
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <ScheduleIcon fontSize="small" />
            {formatDate(order.created_at)}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Main Content Section */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          {/* Order Image */}
          {!isMobile && (
            <Box
              sx={{
                width: { xs: '100%', sm: 120 },
                height: { xs: 200, sm: 120 },
                flexShrink: 0,
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: 'grey.100',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {orderImage ? (
                <img
                  src={orderImage}
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
                        '<div style="font-size: 2rem; color: #999;">📦</div>';
                    }
                  }}
                />
              ) : (
                <Typography variant="h1" color="text.secondary">
                  <span role="img" aria-label={t('orders.package', 'Package')}>
                    📦
                  </span>
                </Typography>
              )}
            </Box>
          )}

          {/* Order Info */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack spacing={1.5}>
              {/* Business Name */}
              {order.business && (
                <Paper
                  variant="outlined"
                  sx={{ p: 1.5, bgcolor: 'grey.50', borderRadius: 1 }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar
                      sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}
                    >
                      <Store fontSize="small" />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        {t('orders.business', 'Business')}
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight="medium"
                        noWrap
                        sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {order.business.name}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              )}

              {/* Delivery Info Grid */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 1,
                }}
              >
                {/* Agent Info */}
                {order.assigned_agent && (
                  <Paper variant="outlined" sx={{ p: 1, borderRadius: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocalShippingIcon fontSize="small" color="primary" />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">
                          {t('orders.agent', 'Agent')}
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          noWrap
                          sx={{ fontSize: '0.875rem' }}
                        >
                          {order.assigned_agent.user.first_name}{' '}
                          {order.assigned_agent.user.last_name}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                )}

                {/* Items Count */}
                <Paper variant="outlined" sx={{ p: 1, borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6" color="primary">
                      {order.order_items?.length || 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('orders.items', 'items')}
                    </Typography>
                  </Box>
                </Paper>
              </Box>

              {/* Delivery Address */}
              {order.delivery_address && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <LocationOn fontSize="small" color="action" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('orders.deliveryAddress', 'Delivery Address')}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                      {order.delivery_address.address_line_1},{' '}
                      {order.delivery_address.city}
                    </Typography>
                  </Box>
                </Box>
              )}
            </Stack>
          </Box>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Footer Section */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              {t('orders.totalAmount', 'Total Amount')}
            </Typography>
            <Typography
              variant="h5"
              color="primary"
              fontWeight="bold"
              sx={{ fontSize: { xs: '1.5rem', sm: '1.75rem' } }}
            >
              {formatCurrency(order.total_amount, order.currency)}
            </Typography>
          </Box>

          <Button
            variant="contained"
            onClick={() => navigate(`/orders/${order.id}`)}
            endIcon={<ArrowForward />}
            sx={{
              px: 3,
              py: 1,
              textTransform: 'none',
              fontWeight: 600,
              boxShadow: 2,
              '&:hover': {
                boxShadow: 4,
              },
            }}
          >
            {t('orders.viewDetails', 'View Details')}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default OrderCard;
