import {
  ArrowForward,
  CheckCircle,
  ExpandLess,
  ExpandMore,
  FlashOn,
  LocalShipping as LocalShippingIcon,
  LocationOn,
  Schedule as ScheduleIcon,
  ShoppingBag,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Paper,
  Stack,
  Tooltip,
  Typography,
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
import { useShippingLabels } from '../../hooks/useShippingLabels';
import ConfirmOrderModal from '../business/ConfirmOrderModal';

interface OrderItem {
  id: string;
  item_name?: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  item?: {
    item_images?: Array<{ image_url: string }>;
    item_sub_category?: {
      name: string;
      item_category?: { name: string };
    };
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
  const { profile } = useUserProfileContext();
  const { enqueueSnackbar } = useSnackbar();
  const { confirmOrder, startPreparing, completePreparation, completeOrder } =
    useBackendOrders();
  const { printLabelAndPrint, loading: printLabelLoading } = useShippingLabels();
  const [showItems, setShowItems] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Print label only before order is picked up (no longer available after picked_up)
  const PRINT_LABEL_STATUSES = [
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'assigned_to_agent',
  ];

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

  const handlePrintLabel = async () => {
    try {
      await printLabelAndPrint(order.id, {
        onSuccess: () =>
          enqueueSnackbar(
            t('orders.shippingLabel.printSuccess', 'Shipping label ready to print'),
            { variant: 'success' }
          ),
        onFallback: (msg) => enqueueSnackbar(msg, { variant: 'warning' }),
        fallbackMessage: t(
          'orders.shippingLabel.popupBlockedFallback',
          'Popup blocked. Label downloaded — open the file and print from your PDF viewer.'
        ),
      });
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : t('orders.shippingLabel.printError', 'Could not generate shipping label');
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  // Get available quick actions based on status and user type
  const getAvailableActions = () => {
    const actions: Array<{
      label: string;
      onClick: () => void;
      color: 'primary' | 'success';
      loading: boolean;
      icon?: React.ReactNode;
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
      if (PRINT_LABEL_STATUSES.includes(currentStatus)) {
        actions.push({
          label: t('orderActions.printLabel', 'Print label'),
          onClick: handlePrintLabel,
          color: 'primary',
          loading: printLabelLoading,
          icon: <LocalShippingIcon />,
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
  const primaryAction = availableActions[0];
  const statusBarColor =
    theme.palette[getStatusColor(currentStatus) as keyof typeof theme.palette]?.main ??
    theme.palette.divider;
  const itemCount = order.order_items?.length ?? 0;
  const deliveryFee = getDeliveryFee();
  const addressShort = order.delivery_address
    ? [order.delivery_address.address_line_1, order.delivery_address.city].filter(Boolean).join(', ')
    : '';
  const addressFull = order.delivery_address
    ? [
        order.delivery_address.address_line_1,
        order.delivery_address.address_line_2,
        order.delivery_address.city,
        order.delivery_address.state,
        order.delivery_address.postal_code,
        order.delivery_address.country,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <Card
      sx={{
        overflow: 'hidden',
        transition: 'box-shadow 0.2s ease',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        display: 'flex',
        '&:hover': {
          boxShadow: 2,
          borderColor: 'action.hover',
        },
      }}
    >
      {/* Vertical status indicator */}
      <Box sx={{ width: 4, flexShrink: 0, bgcolor: statusBarColor }} />
      <CardContent
        sx={{
          flex: 1,
          p: 1.5,
          py: 1.25,
          '&:last-child': { pb: 1.25 },
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { sm: 'center' },
          gap: { xs: 1, sm: 2 },
          minWidth: 0,
        }}
      >
        {/* Left: icon + order id + meta row */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              flexShrink: 0,
              borderRadius: 1,
              overflow: 'hidden',
              bgcolor: 'grey.200',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {orderImage ? (
              <img
                src={orderImage}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const parent = target.parentElement;
                  if (parent) {
                    const span = document.createElement('span');
                    span.setAttribute('role', 'img');
                    span.setAttribute('aria-label', t('orders.package', 'Package'));
                    span.textContent = '📦';
                    parent.appendChild(span);
                  }
                }}
              />
            ) : (
              <Typography component="span" sx={{ fontSize: 24 }} role="img" aria-label={t('orders.package', 'Package')}>
                📦
              </Typography>
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75} sx={{ mb: 0.25 }}>
              <Typography variant="subtitle1" fontWeight="bold" sx={{ fontSize: '1rem' }}>
                #{order.order_number}
              </Typography>
              <Chip
                label={String(t(`common.orderStatus.${currentStatus}`, currentStatus))}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                color={getStatusColor(currentStatus) as any}
                size="small"
                sx={{ fontWeight: 600, height: 22 }}
                icon={isCompleted ? <CheckCircle sx={{ fontSize: 14 }} /> : undefined}
              />
              {order.requires_fast_delivery && (
                <Chip
                  label={t('orders.fastDelivery.title', 'Fast Delivery')}
                  size="small"
                  sx={{ height: 22, fontWeight: 600, bgcolor: 'warning.light', color: 'warning.dark' }}
                  icon={<FlashOn sx={{ fontSize: 14 }} />}
                />
              )}
            </Stack>
            <Stack
              direction="row"
              flexWrap="wrap"
              alignItems="center"
              sx={{ typography: 'caption', color: 'text.secondary', gap: { xs: 1, sm: 2 } }}
            >
              <Stack direction="row" alignItems="center" gap={0.5}>
                <ScheduleIcon sx={{ fontSize: 14 }} />
                <span>{formatDate(order.created_at)}</span>
              </Stack>
              {addressShort && (
                <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
                  <LocationOn sx={{ fontSize: 14 }} />
                  <Tooltip title={addressFull || addressShort} enterDelay={300}>
                    <Typography component="span" noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: { xs: 120, md: 200 } }}>
                      {addressShort}
                    </Typography>
                  </Tooltip>
                </Stack>
              )}
              <Stack direction="row" alignItems="center" gap={0.5}>
                <ShoppingBag sx={{ fontSize: 14 }} />
                <span>
                  {itemCount} {itemCount === 1 ? t('orders.item', 'item') : t('orders.items', 'items')}
                </span>
              </Stack>
            </Stack>
          </Box>
        </Box>

        {/* Right: total + delivery line + actions */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 1,
            flexShrink: 0,
          }}
        >
          <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
            {profile?.agent && order.delivery_commission !== undefined ? (
              <>
                <Typography variant="body2" color="text.secondary">
                  {t('orders.earnings', 'Your Earnings')}
                </Typography>
                <Typography variant="subtitle1" fontWeight="bold" color="primary">
                  {formatCurrency(order.delivery_commission, order.currency)}
                </Typography>
              </>
            ) : (
              <>
                <Typography variant="subtitle1" fontWeight="bold">
                  {order.total_amount != null
                    ? formatCurrency(order.total_amount, order.currency)
                    : '—'}
                </Typography>
                {isCancelled ? (
                  <Typography variant="caption" color="text.secondary">
                    {t('orders.cancelledByCustomer', 'Cancelled by customer')}
                  </Typography>
                ) : deliveryFee > 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    {t('orders.inclDelivery', 'incl.')} {getDeliveryFeeDisplay()} {t('orders.delivery', 'delivery')}
                  </Typography>
                ) : null}
              </>
            )}
          </Box>
          <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" flexShrink={0}>
            {primaryAction && (
              <Button
                variant="contained"
                color={primaryAction.color}
                size="small"
                onClick={primaryAction.onClick}
                disabled={primaryAction.loading || !!loadingAction || printLabelLoading}
                startIcon={
                  primaryAction.loading ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : (
                    primaryAction.icon ?? <CheckCircle fontSize="small" />
                  )
                }
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                {primaryAction.label}
              </Button>
            )}
            {availableActions.length > 1 && (
              <Stack direction="row" spacing={0.5}>
                {availableActions.slice(1).map((action, idx) => (
                  <Button
                    key={idx}
                    variant="outlined"
                    size="small"
                    color={action.color}
                    onClick={action.onClick}
                    disabled={action.loading || !!loadingAction}
                    startIcon={action.icon}
                    sx={{ textTransform: 'none', minWidth: 'auto' }}
                  >
                    {action.label}
                  </Button>
                ))}
              </Stack>
            )}
            <Button
              variant="text"
              size="small"
              color={isCompleted || isCancelled ? 'inherit' : 'primary'}
              onClick={() => navigate(`/orders/${order.id}`)}
              endIcon={<ArrowForward fontSize="small" />}
              sx={{
                textTransform: 'none',
                fontWeight: 500,
                color: isCompleted || isCancelled ? 'text.secondary' : undefined,
              }}
            >
              {t('orders.details', 'Details')}
            </Button>
          </Stack>
        </Box>
      </CardContent>

      {/* Expandable order items (multi-item) */}
      {order.order_items && order.order_items.length > 1 && (
        <>
          <Button
            fullWidth
            size="small"
            onClick={() => setShowItems(!showItems)}
            endIcon={showItems ? <ExpandLess /> : <ExpandMore />}
            sx={{ textTransform: 'none', py: 0.5 }}
          >
            {t('orders.orderItems', 'Order Items')}
          </Button>
          <Collapse in={showItems}>
            <Box sx={{ px: 2, pb: 1.5, pt: 0 }}>
              <Stack spacing={1}>
                {order.order_items.map((item: OrderItem, index: number) => (
                  <Paper key={item.id || index} variant="outlined" sx={{ p: 1 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 1,
                          overflow: 'hidden',
                          bgcolor: 'grey.100',
                          flexShrink: 0,
                        }}
                      >
                        {item.item?.item_images?.[0]?.image_url ? (
                          <img
                            src={item.item.item_images[0].image_url}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography variant="caption" color="text.secondary">📦</Typography>
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight="medium" noWrap>
                          {item.item_name ?? item.item?.item_sub_category?.name ?? t('orders.unknownItem', 'Unknown Item')}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t('orders.quantity', 'Qty')}: {item.quantity}
                          {item.total_price != null && order.currency && ` · ${formatCurrency(item.total_price, order.currency)}`}
                        </Typography>
                      </Box>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          </Collapse>
        </>
      )}

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
