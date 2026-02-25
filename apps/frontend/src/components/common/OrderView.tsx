import {
  Business as BusinessIcon,
  LocalShipping as LocalShippingIcon,
  LocationOn as LocationIcon,
  Payment as PaymentIcon,
  Person as PersonIcon,
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
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import type { OrderData } from '../../hooks/useOrderById';
import DeliveryTimeWindowDisplay from './DeliveryTimeWindowDisplay';

interface OrderViewProps {
  order: OrderData;
  showFinancialDetails?: boolean;
}

const OrderView: React.FC<OrderViewProps> = ({
  order,
  showFinancialDetails = false,
}) => {
  const { t } = useTranslation();
  const { profile } = useUserProfileContext();
  const isAgent = !!profile?.agent;

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
    <Box sx={{ maxWidth: '100%', mx: 'auto' }}>
      {/* Order Header */}
      <Card
        sx={{
          mb: 4,
          borderRadius: 3,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        <CardContent sx={{ p: 4 }}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="flex-start"
            mb={3}
            flexDirection={{ xs: 'column', sm: 'row' }}
            gap={2}
          >
            <Box>
              <Typography
                variant="h4"
                component="h1"
                fontWeight="700"
                sx={{
                  background: 'linear-gradient(45deg, #1976d2, #42a5f5)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mb: 1,
                }}
              >
                Order #{order.order_number}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {t('orders.createdAt', 'Created')}:{' '}
                {formatDate(order.created_at)}
              </Typography>
            </Box>
            <Chip
              label={t(
                `common.orderStatus.${order.current_status}`,
                order.current_status
              )}
              color={getStatusColor(order.current_status) as any}
              size="medium"
              variant="filled"
              sx={{
                fontWeight: 600,
                fontSize: '0.875rem',
                height: 36,
                borderRadius: 2,
                px: 1,
              }}
            />
          </Box>

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  p: 2,
                  backgroundColor: 'grey.50',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'grey.200',
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  display="flex"
                  alignItems="center"
                  mb={1}
                  fontWeight="medium"
                >
                  <PaymentIcon
                    sx={{ mr: 1, fontSize: 18, color: 'primary.main' }}
                  />
                  {t('orders.paymentMethod', 'Payment Method')}
                </Typography>
                <Typography variant="body1" fontWeight="600" sx={{ ml: 3 }}>
                  {(order as any).payment_method || 'Not specified'}
                  <Chip
                    label={(order as any).payment_status || 'pending'}
                    size="small"
                    color={
                      (order as any).payment_status === 'paid'
                        ? 'success'
                        : 'warning'
                    }
                    sx={{ ml: 1, height: 20, fontSize: '0.75rem' }}
                  />
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Box
                sx={{
                  textAlign: { xs: 'left', md: 'right' },
                  p: 2,
                  backgroundColor: 'primary.50',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'primary.200',
                }}
              >
                <Typography
                  variant="h4"
                  color="primary.main"
                  fontWeight="bold"
                  sx={{ mb: 1 }}
                >
                  {formatCurrency(order.total_amount, order.currency)}
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  fontWeight="medium"
                >
                  <ShoppingCartIcon
                    sx={{ mr: 1, fontSize: 16, verticalAlign: 'middle' }}
                  />
                  {order.order_items.length}{' '}
                  {order.order_items.length === 1
                    ? t('orders.item', 'item')
                    : t('orders.items', 'items')}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={4}>
        {/* Business Information */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 2,
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              border: '1px solid',
              borderColor: 'divider',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <CardContent
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                p: 3,
              }}
            >
              <Typography
                variant="h6"
                gutterBottom
                display="flex"
                alignItems="center"
                sx={{
                  color: 'primary.main',
                  fontWeight: 600,
                  mb: 2,
                }}
              >
                <BusinessIcon sx={{ mr: 1.5, color: 'primary.main' }} />
                {t('orders.businessInfo', 'Business Information')}
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  color="text.primary"
                  gutterBottom
                >
                  {order.business.name}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  <strong>{t('orders.contact', 'Contact')}:</strong>{' '}
                  {order.business.user.first_name}{' '}
                  {order.business.user.last_name}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  📧 {order.business.user.email}
                </Typography>
                {order.business.user.phone_number && (
                  <Typography variant="body2" color="text.secondary">
                    📞 {order.business.user.phone_number}
                  </Typography>
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ flexGrow: 1 }}>
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  display="flex"
                  alignItems="center"
                  sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}
                >
                  <LocationIcon
                    sx={{ mr: 1, fontSize: 18, color: 'error.main' }}
                  />
                  {t('orders.businessLocation', 'Business Location')}
                </Typography>
                <Typography variant="body1" fontWeight="medium" sx={{ mb: 1 }}>
                  {order.business_location.name}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ lineHeight: 1.6 }}
                >
                  {formatAddress(order.business_location.address)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Client Information */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card
            sx={{
              height: '100%',
              borderRadius: 2,
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              border: '1px solid',
              borderColor: 'divider',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <CardContent
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                p: 3,
              }}
            >
              <Typography
                variant="h6"
                gutterBottom
                display="flex"
                alignItems="center"
                sx={{
                  color: 'secondary.main',
                  fontWeight: 600,
                  mb: 2,
                }}
              >
                <PersonIcon sx={{ mr: 1.5, color: 'secondary.main' }} />
                {t('orders.clientInfo', 'Client Information')}
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  color="text.primary"
                  gutterBottom
                >
                  {order.client.user.first_name} {order.client.user.last_name}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 1 }}
                >
                  📧 {order.client.user.email}
                </Typography>
                {order.client.user.phone_number && (
                  <Typography variant="body2" color="text.secondary">
                    📞 {order.client.user.phone_number}
                  </Typography>
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ flexGrow: 1 }}>
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  display="flex"
                  alignItems="center"
                  sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}
                >
                  <LocationIcon
                    sx={{ mr: 1, fontSize: 18, color: 'success.main' }}
                  />
                  {t('orders.deliveryAddress', 'Delivery Address')}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ lineHeight: 1.6 }}
                >
                  {formatAddress(order.delivery_address)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Agent Information */}
        {order.assigned_agent && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Typography
                  variant="h6"
                  gutterBottom
                  display="flex"
                  alignItems="center"
                >
                  <LocalShippingIcon sx={{ mr: 1 }} />
                  {t('orders.assignedAgent', 'Assigned Agent')}
                </Typography>
                <Box
                  display="flex"
                  alignItems="center"
                  gap={2}
                  flexWrap="wrap"
                  mb={1}
                >
                  <Avatar
                    src={order.assigned_agent.user.profile_picture_url}
                    sx={{ width: 48, height: 48 }}
                  >
                    {order.assigned_agent.user.first_name?.[0]}
                    {order.assigned_agent.user.last_name?.[0]}
                  </Avatar>
                  <Box>
                    <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
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
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Order Items */}
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent
              sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
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
                            <Grid>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('orders.brand')}: {item.item.brand.name}
                              </Typography>
                            </Grid>
                          )}
                          {item.item.model && (
                            <Grid>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('orders.model')}: {item.item.model}
                              </Typography>
                            </Grid>
                          )}
                          {item.item.color && (
                            <Grid>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('orders.color')}: {item.item.color}
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
                        {((item.item?.weight != null) || item.item?.dimensions) && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            {[
                              item.item?.weight != null
                                ? `${item.item.weight} ${item.item.weight_unit ?? ''}`.trim()
                                : null,
                              item.item?.dimensions || null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
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
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent
              sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
            >
              <Typography
                variant="h6"
                gutterBottom
                display="flex"
                alignItems="center"
              >
                <PaymentIcon sx={{ mr: 1 }} />
                {t('orders.orderSummary', 'Order Summary')}
              </Typography>

              <Box sx={{ flexGrow: 1 }}>
                {isAgent ? (
                  // Agent view: Show only delivery commission
                  <>
                    {order.delivery_commission !== undefined && (
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        sx={{
                          backgroundColor: 'primary.50',
                          p: 2,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'primary.200',
                        }}
                      >
                        <Typography variant="h6" fontWeight="bold">
                          {t('orders.earnings', 'Your Earnings')}
                        </Typography>
                        <Typography variant="h6" fontWeight="bold" color="primary">
                          {formatCurrency(order.delivery_commission, order.currency)}
                        </Typography>
                      </Box>
                    )}
                  </>
                ) : (
                  // Business/Client view: Show full breakdown
                  <>
                    {order.subtotal !== undefined && (
                      <Box display="flex" justifyContent="space-between" mb={1.5}>
                        <Typography variant="body2" color="text.secondary">
                          {t('orders.subtotal', 'Subtotal')}
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(order.subtotal, order.currency)}
                        </Typography>
                      </Box>
                    )}
                    {(order.base_delivery_fee || 0) + (order.per_km_delivery_fee || 0) > 0 && (
                      <Box display="flex" justifyContent="space-between" mb={1.5}>
                        <Typography variant="body2" color="text.secondary">
                          {t('orders.deliveryFee', 'Delivery Fee')}
                        </Typography>
                        <Typography variant="body2" fontWeight="medium">
                          {formatCurrency(
                            (order.base_delivery_fee || 0) + (order.per_km_delivery_fee || 0),
                            order.currency
                          )}
                        </Typography>
                      </Box>
                    )}
                    <Box display="flex" justifyContent="space-between" mb={2}>
                      <Typography variant="body2" color="text.secondary">
                        {t('orders.tax', 'Tax')}
                      </Typography>
                      <Typography variant="body2" fontWeight="medium">
                        {formatCurrency(order.tax_amount, order.currency)}
                      </Typography>
                    </Box>
                    <Divider sx={{ my: 2 }} />
                    {order.total_amount !== undefined && (
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        sx={{
                          backgroundColor: 'primary.50',
                          p: 2,
                          borderRadius: 1,
                          border: '1px solid',
                          borderColor: 'primary.200',
                        }}
                      >
                        <Typography variant="h6" fontWeight="bold">
                          {t('orders.total', 'Total')}
                        </Typography>
                        <Typography variant="h6" fontWeight="bold" color="primary">
                          {formatCurrency(order.total_amount, order.currency)}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Special Instructions */}
        {order.special_instructions && (
          <Grid size={{ xs: 12, md: 6 }}>
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

        {/* Delivery Time Window */}
        <Grid size={{ xs: 12 }}>
          <DeliveryTimeWindowDisplay order={order} />
        </Grid>

        {/* Financial Details (Admin/Business only) - Hidden for agents */}
        {showFinancialDetails && !isAgent && order.order_holds && order.order_holds.length > 0 && (
          <Grid size={{ xs: 12 }}>
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
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('orders.clientHold')}:{' '}
                          {formatCurrency(
                            hold.client_hold_amount,
                            hold.currency
                          )}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('orders.agentHold')}:{' '}
                          {formatCurrency(
                            hold.agent_hold_amount,
                            hold.currency
                          )}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="body2" color="text.secondary">
                          {t('orders.deliveryFees')}:{' '}
                          {formatCurrency(
                            order.base_delivery_fee + order.per_km_delivery_fee,
                            order.currency
                          )}
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
