import {
  ArrowForward,
  CheckCircle,
  ExpandLess,
  ExpandMore,
  FlashOn,
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
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import {
  ConfirmOrderData,
  useBackendOrders,
} from '../../hooks/useBackendOrders';
import type { OrderData } from '../../hooks/useOrderById';
import ConfirmOrderModal from '../business/ConfirmOrderModal';

interface OrderItem {
  id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  item?: {
    item_images?: Array<{ image_url: string }>;
  };
}

interface OrderCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any;
  showAgentEarnings?: boolean;
  onActionComplete?: () => void;
}

const OrderCard: React.FC<OrderCardProps> = ({
  order,
  showAgentEarnings = false,
  onActionComplete,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { profile } = useUserProfileContext();
  const { enqueueSnackbar } = useSnackbar();
  const { confirmOrder, startPreparing, completePreparation, completeOrder } =
    useBackendOrders();
  const [showItems, setShowItems] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

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

  const getDeliveryFee = () => {
    // Always use order delivery fee components directly
    // Do not use hold data for delivery fee calculation
    return (order.base_delivery_fee || 0) + (order.per_km_delivery_fee || 0);
  };

  const getDeliveryFeeDisplay = () => {
    return formatCurrency(getDeliveryFee(), order.currency);
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

  // Determine user type
  const userType = profile?.business
    ? 'business'
    : profile?.client
    ? 'client'
    : profile?.agent
    ? 'agent'
    : null;

  // Handle confirm order action
  const handleConfirmOrder = () => {
    setConfirmModalOpen(true);
  };

  const handleConfirmOrderSuccess = async (data: ConfirmOrderData) => {
    setLoadingAction('confirm');
    try {
      await confirmOrder(data);
      enqueueSnackbar(
        t('messages.orderConfirmSuccess', 'Order confirmed successfully'),
        { variant: 'success' }
      );
      setConfirmModalOpen(false);
      onActionComplete?.();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('messages.orderConfirmError', 'Failed to confirm order');
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle start preparing
  const handleStartPreparing = async () => {
    setLoadingAction('startPreparing');
    try {
      await startPreparing({ orderId: order.id });
      enqueueSnackbar(
        t(
          'messages.orderStartPreparingSuccess',
          'Order preparation started successfully'
        ),
        { variant: 'success' }
      );
      onActionComplete?.();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t(
              'messages.orderStartPreparingError',
              'Failed to start preparation'
            );
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle finish preparing
  const handleFinishPreparing = async () => {
    setLoadingAction('finishPreparing');
    try {
      await completePreparation({ orderId: order.id });
      enqueueSnackbar(
        t(
          'messages.orderCompletePreparationSuccess',
          'Order preparation completed successfully'
        ),
        { variant: 'success' }
      );
      onActionComplete?.();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t(
              'messages.orderCompletePreparationError',
              'Failed to complete preparation'
            );
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle complete order
  const handleCompleteOrder = async () => {
    setLoadingAction('completeOrder');
    try {
      await completeOrder({ orderId: order.id });
      enqueueSnackbar(
        t('messages.orderCompleteSuccess', 'Order completed successfully'),
        { variant: 'success' }
      );
      onActionComplete?.();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('messages.orderCompleteError', 'Failed to complete order');
      enqueueSnackbar(errorMessage, { variant: 'error' });
    } finally {
      setLoadingAction(null);
    }
  };

  // Get available quick actions based on status and user type
  const getAvailableActions = () => {
    const actions: Array<{
      label: string;
      onClick: () => void;
      color: 'primary' | 'success';
      loading: boolean;
    }> = [];

    if (userType === 'business') {
      if (currentStatus === 'pending') {
        actions.push({
          label: t('orders.actions.confirmOrder', 'Confirm Order'),
          onClick: handleConfirmOrder,
          color: 'success',
          loading: loadingAction === 'confirm',
        });
      } else if (currentStatus === 'confirmed') {
        actions.push({
          label: t('orders.actions.startPreparing', 'Start Preparing'),
          onClick: handleStartPreparing,
          color: 'primary',
          loading: loadingAction === 'startPreparing',
        });
      } else if (currentStatus === 'preparing') {
        actions.push({
          label: t('orders.actions.finishPreparing', 'Finish Preparing'),
          onClick: handleFinishPreparing,
          color: 'success',
          loading: loadingAction === 'finishPreparing',
        });
      } else if (currentStatus === 'delivered') {
        actions.push({
          label: t('orders.actions.completeOrder', 'Complete Order'),
          onClick: handleCompleteOrder,
          color: 'success',
          loading: loadingAction === 'completeOrder',
        });
      }
    } else if (userType === 'client') {
      if (currentStatus === 'delivered') {
        actions.push({
          label: t('orders.actions.completeOrder', 'Complete Order'),
          onClick: handleCompleteOrder,
          color: 'success',
          loading: loadingAction === 'completeOrder',
        });
      }
    }

    return actions;
  };

  const availableActions = getAvailableActions();

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
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={String(
                  t(`common.orderStatus.${currentStatus}`, currentStatus)
                )}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                color={getStatusColor(currentStatus) as any}
                size="small"
                sx={{ fontWeight: 600 }}
                icon={
                  isCompleted ? <CheckCircle fontSize="small" /> : undefined
                }
              />
              {order.requires_fast_delivery && (
                <Chip
                  label={t('orders.fastDelivery.title', 'Fast Delivery')}
                  color="warning"
                  size="small"
                  sx={{ fontWeight: 600 }}
                  icon={<FlashOn fontSize="small" />}
                />
              )}
            </Box>
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
                    {order.order_items && order.order_items.length > 1 && (
                      <IconButton
                        size="small"
                        onClick={() => setShowItems(!showItems)}
                        sx={{ ml: 'auto' }}
                      >
                        {showItems ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                    )}
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

              {/* Order Items - Collapsible */}
              {order.order_items && order.order_items.length > 1 && (
                <Collapse in={showItems}>
                  <Box sx={{ mt: 2 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      gutterBottom
                    >
                      {t('orders.orderItems', 'Order Items')}
                    </Typography>
                    <Stack spacing={1}>
                      {order.order_items.map(
                        (item: OrderItem, index: number) => (
                          <Paper
                            key={item.id || index}
                            variant="outlined"
                            sx={{ p: 1.5 }}
                          >
                            <Box
                              sx={{
                                display: 'flex',
                                gap: 2,
                                alignItems: 'center',
                              }}
                            >
                              {/* Item Image */}
                              <Box
                                sx={{
                                  width: 50,
                                  height: 50,
                                  borderRadius: 1,
                                  overflow: 'hidden',
                                  bgcolor: 'grey.100',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {item.item?.item_images?.[0]?.image_url ? (
                                  <img
                                    src={item.item.item_images[0].image_url}
                                    alt={item.item_name || 'Item'}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                    }}
                                    onError={(e) => {
                                      const target =
                                        e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        parent.innerHTML = '📦';
                                      }
                                    }}
                                  />
                                ) : (
                                  <Typography
                                    variant="h6"
                                    color="text.secondary"
                                  >
                                    <span
                                      role="img"
                                      aria-label={t(
                                        'orders.package',
                                        'Package'
                                      )}
                                    >
                                      📦
                                    </span>
                                  </Typography>
                                )}
                              </Box>

                              {/* Item Details */}
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography
                                  variant="body2"
                                  fontWeight="medium"
                                  sx={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {item.item_name ||
                                    t('orders.unknownItem', 'Unknown Item')}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {t('orders.quantity', 'Qty')}: {item.quantity}{' '}
                                  ×{' '}
                                  {formatCurrency(
                                    item.unit_price,
                                    order.currency
                                  )}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  fontWeight="medium"
                                  color="primary"
                                >
                                  {formatCurrency(
                                    item.total_price,
                                    order.currency
                                  )}
                                </Typography>
                              </Box>
                            </Box>
                          </Paper>
                        )
                      )}
                    </Stack>
                  </Box>
                </Collapse>
              )}
            </Stack>
          </Box>
        </Stack>

        <Divider sx={{ my: 2 }} />

        {/* Quick Action Buttons */}
        {availableActions.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {availableActions.map((action, index) => (
                <Button
                  key={index}
                  variant="outlined"
                  color={action.color}
                  onClick={action.onClick}
                  disabled={action.loading || !!loadingAction}
                  startIcon={
                    action.loading ? (
                      <CircularProgress size={16} />
                    ) : (
                      <CheckCircle />
                    )
                  }
                  sx={{
                    minWidth: { xs: '100%', sm: 140 },
                    textTransform: 'none',
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </Stack>
          </Box>
        )}

        {/* Footer Section */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          {/* Amount Breakdown */}
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              {t('orders.amountBreakdown', 'Amount Breakdown')}
            </Typography>
            <Stack spacing={0.5}>
              {/* Subtotal */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2" color="text.secondary">
                  {t('orders.subtotal', 'Subtotal')}:
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatCurrency(order.subtotal, order.currency)}
                </Typography>
              </Box>

              {/* Total Delivery Fee */}
              {order.base_delivery_fee + order.per_km_delivery_fee > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('orders.deliveryFee', 'Delivery Fee')}:
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {getDeliveryFeeDisplay()}
                  </Typography>
                </Box>
              )}

              {/* Tax Amount */}
              {order.tax_amount > 0 && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('orders.tax', 'Tax')}:
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {formatCurrency(order.tax_amount, order.currency)}
                  </Typography>
                </Box>
              )}

              {/* Divider */}
              <Divider sx={{ my: 0.5 }} />

              {/* Total Amount */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body1" fontWeight="bold" color="primary">
                  {t('orders.totalAmount', 'Total')}:
                </Typography>
                <Typography
                  variant="h6"
                  color="primary"
                  fontWeight="bold"
                  sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}
                >
                  {formatCurrency(order.total_amount, order.currency)}
                </Typography>
              </Box>
            </Stack>
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

      {/* Confirm Order Modal */}
      <ConfirmOrderModal
        open={confirmModalOpen}
        order={order as OrderData}
        onClose={() => setConfirmModalOpen(false)}
        onConfirm={handleConfirmOrderSuccess}
        loading={loadingAction === 'confirm'}
      />
    </Card>
  );
};

export default OrderCard;
