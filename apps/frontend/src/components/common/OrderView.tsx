import {
  Business as BusinessIcon,
  LocalShipping as LocalShippingIcon,
  LocationOn as LocationIcon,
  Payment as PaymentIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Paper,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderData } from '../../hooks/useOrderById';

interface OrderViewProps {
  order: OrderData;
  showFinancialDetails?: boolean;
}

const OrderView: React.FC<OrderViewProps> = ({
  order,
  showFinancialDetails = false,
}) => {
  const { t } = useTranslation();

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

  return (
    <Box>
      {/* Order Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            mb={2}
          >
            <Typography variant="h4" component="h1">
              {t('common.orderNumber', { number: order.order_number })}
            </Typography>
            <Chip
              label={t(`common.orderStatus.${order.current_status}`)}
              color={getStatusColor(order.current_status) as any}
              size="large"
            />
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography
                variant="body2"
                color="text.secondary"
                display="flex"
                alignItems="center"
                mb={1}
              >
                <ScheduleIcon sx={{ mr: 1, fontSize: 16 }} />
                {t('orders.createdAt')}: {formatDate(order.created_at)}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                display="flex"
                alignItems="center"
                mb={1}
              >
                <PaymentIcon sx={{ mr: 1, fontSize: 16 }} />
                {t('orders.paymentMethod')}: {order.payment_method} (
                {order.payment_status})
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box textAlign={{ xs: 'left', md: 'right' }}>
                <Typography variant="h5" color="primary" fontWeight="bold">
                  {formatCurrency(order.total_amount, order.currency)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {order.order_items.length} {t('orders.table.items')}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Business Information */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography
                variant="h6"
                gutterBottom
                display="flex"
                alignItems="center"
              >
                <BusinessIcon sx={{ mr: 1 }} />
                {t('orders.businessInfo', 'Business Information')}
              </Typography>
              <Typography variant="body1" fontWeight="medium" gutterBottom>
                {order.business.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('orders.contact', 'Contact')}: {order.business.user.first_name}{' '}
                {order.business.user.last_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {order.business.user.email}
              </Typography>
              {order.business.user.phone_number && (
                <Typography variant="body2" color="text.secondary">
                  {order.business.user.phone_number}
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                {t('orders.businessLocation', 'Business Location')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {order.business_location.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatAddress(order.business_location.address)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Client Information */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography
                variant="h6"
                gutterBottom
                display="flex"
                alignItems="center"
              >
                <PersonIcon sx={{ mr: 1 }} />
                {t('orders.clientInfo', 'Client Information')}
              </Typography>
              <Typography variant="body1" fontWeight="medium" gutterBottom>
                {order.client.user.first_name} {order.client.user.last_name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {order.client.user.email}
              </Typography>
              {order.client.user.phone_number && (
                <Typography variant="body2" color="text.secondary">
                  {order.client.user.phone_number}
                </Typography>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography
                variant="subtitle2"
                gutterBottom
                display="flex"
                alignItems="center"
              >
                <LocationIcon sx={{ mr: 1, fontSize: 16 }} />
                {t('orders.deliveryAddress', 'Delivery Address')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {formatAddress(order.delivery_address)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Agent Information */}
        {order.assigned_agent && (
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography
                  variant="h6"
                  gutterBottom
                  display="flex"
                  alignItems="center"
                >
                  <LocalShippingIcon sx={{ mr: 1 }} />
                  {t('orders.assignedAgent', 'Assigned Agent')}
                </Typography>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Typography variant="body1" fontWeight="medium">
                    {order.assigned_agent.user.first_name}{' '}
                    {order.assigned_agent.user.last_name}
                  </Typography>
                  {order.assigned_agent.is_verified && (
                    <Chip
                      label={t('orders.verified', 'Verified')}
                      size="small"
                      color="success"
                    />
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {order.assigned_agent.user.email}
                </Typography>
                {order.assigned_agent.user.phone_number && (
                  <Typography variant="body2" color="text.secondary">
                    {order.assigned_agent.user.phone_number}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Order Items */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography
                variant="h6"
                gutterBottom
                display="flex"
                alignItems="center"
              >
                <ShoppingCartIcon sx={{ mr: 1 }} />
                {t('orders.orderItems', 'Order Items')}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {order.order_items.map((item) => (
                  <Paper key={item.id} variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      {/* Item Image */}
                      <Box sx={{ flexShrink: 0 }}>
                        {item.item.item_images.length > 0 ? (
                          <Avatar
                            src={item.item.item_images[0].image_url}
                            alt={item.item_name}
                            sx={{
                              width: 100,
                              height: 100,
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                            }}
                            variant="rounded"
                          />
                        ) : (
                          <Avatar
                            sx={{
                              width: 100,
                              height: 100,
                              borderRadius: 1,
                              bgcolor: 'grey.100',
                              border: '1px solid',
                              borderColor: 'divider',
                              color: 'grey.500',
                            }}
                            variant="rounded"
                          >
                            <ShoppingCartIcon />
                          </Avatar>
                        )}
                      </Box>

                      {/* Item Details */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h6" gutterBottom>
                          {item.item_name}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          gutterBottom
                        >
                          {item.item_description}
                        </Typography>

                        <Grid container spacing={1}>
                          {item.item.brand && (
                            <Grid item>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('orders.brand')}: {item.item.brand.name}
                              </Typography>
                            </Grid>
                          )}
                          {item.item.model && (
                            <Grid item>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('orders.model')}: {item.item.model}
                              </Typography>
                            </Grid>
                          )}
                          {item.item.color && (
                            <Grid item>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('orders.color')}: {item.item.color}
                              </Typography>
                            </Grid>
                          )}
                          {item.item.size && (
                            <Grid item>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('orders.size')}: {item.item.size}{' '}
                                {item.item.size_unit}
                              </Typography>
                            </Grid>
                          )}
                        </Grid>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mt: 1 }}
                        >
                          {t('orders.category')}:{' '}
                          {item.item.item_sub_category.item_category.name} -{' '}
                          {item.item.item_sub_category.name}
                        </Typography>
                      </Box>

                      {/* Price and Quantity */}
                      <Box textAlign="right" sx={{ flexShrink: 0 }}>
                        <Typography variant="h6" fontWeight="bold">
                          {formatCurrency(item.total_price, order.currency)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.quantity} x{' '}
                          {formatCurrency(item.unit_price, order.currency)}
                        </Typography>
                        {item.weight && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            {item.weight} {item.weight_unit}
                          </Typography>
                        )}
                      </Box>
                    </Box>

                    {item.special_instructions && (
                      <Box
                        sx={{
                          mt: 2,
                          p: 1,
                          bgcolor: 'grey.50',
                          borderRadius: 1,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          {t('orders.specialInstructions')}:{' '}
                          {item.special_instructions}
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Order Summary */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('orders.orderSummary')}
              </Typography>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">{t('orders.subtotal')}</Typography>
                <Typography variant="body2">
                  {formatCurrency(order.subtotal, order.currency)}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">
                  {t('orders.deliveryFee')}
                </Typography>
                <Typography variant="body2">
                  {formatCurrency(order.delivery_fee, order.currency)}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2">{t('orders.tax')}</Typography>
                <Typography variant="body2">
                  {formatCurrency(order.tax_amount, order.currency)}
                </Typography>
              </Box>
              <Divider sx={{ my: 1 }} />
              <Box display="flex" justifyContent="space-between">
                <Typography variant="h6" fontWeight="bold">
                  {t('orders.total')}
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="primary">
                  {formatCurrency(order.total_amount, order.currency)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Special Instructions */}
        {order.special_instructions && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('orders.specialInstructions')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {order.special_instructions}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Financial Details (Admin/Business only) */}
        {showFinancialDetails && order.order_holds.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('orders.financialDetails')}
                </Typography>
                {order.order_holds.map((hold) => (
                  <Box key={hold.id} sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      {t('orders.holdStatus')}: {hold.status}
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          {t('orders.clientHold')}:{' '}
                          {formatCurrency(
                            hold.client_hold_amount,
                            hold.currency
                          )}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          {t('orders.agentHold')}:{' '}
                          {formatCurrency(
                            hold.agent_hold_amount,
                            hold.currency
                          )}
                        </Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary">
                          {t('orders.deliveryFees')}:{' '}
                          {formatCurrency(hold.delivery_fees, hold.currency)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default OrderView;
