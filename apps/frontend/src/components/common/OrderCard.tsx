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
  Divider,
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
import { useApiClient } from '../../hooks/useApiClient';
import type { OrderData } from '../../hooks/useOrderById';
import { useShippingLabels } from '../../hooks/useShippingLabels';
import ConfirmOrderModal from '../business/ConfirmOrderModal';

interface ItemImageRow {
  image_url: string;
  image_type?: string | null;
  display_order?: number | null;
}

interface OrderItem {
  id: string;
  item_name?: string;
  quantity: number;
  unit_price?: number;
  total_price?: number;
  item?: {
    sku?: string;
    item_images?: ItemImageRow[];
    item_sub_category?: {
      name: string;
      item_category?: { name: string };
    };
  };
}

function pickBestItemImageUrl(
  images: ItemImageRow[] | undefined | null
): string | null {
  if (!images?.length) return null;
  const main = images.find((i) => i.image_type === 'main');
  if (main?.image_url) return main.image_url;
  return images[0]?.image_url ?? null;
}

function heroImageFromOrder(order: {
  order_items?: OrderItem[];
}): string | null {
  for (const line of order.order_items ?? []) {
    const url = pickBestItemImageUrl(line.item?.item_images);
    if (url) return url;
  }
  return null;
}

function deliveryAddressLines(order: {
  delivery_address?: {
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    instructions?: string;
  };
}): string[] {
  const a = order.delivery_address;
  if (!a) return [];
  const lines = [
    a.address_line_1,
    a.address_line_2,
    [a.city, a.state, a.postal_code].filter(Boolean).join(', '),
    a.country,
    a.instructions,
  ].filter((x): x is string => !!x && String(x).trim().length > 0);
  return lines;
}

function formatDeliveryScheduleLabel(order: {
  preferred_delivery_time?: string | null;
  delivery_time_windows?: Array<{
    preferred_date?: string | null;
    time_slot_start?: string | null;
    time_slot_end?: string | null;
    slot?: { slot_name?: string | null };
  }>;
}): string | null {
  const windows = order.delivery_time_windows;
  if (windows?.length) {
    const parts = windows.map((w) => {
      const bits = [
        w.preferred_date,
        w.slot?.slot_name,
        w.time_slot_start && w.time_slot_end
          ? `${w.time_slot_start}–${w.time_slot_end}`
          : null,
      ].filter(Boolean);
      return bits.join(' · ');
    });
    return parts.filter(Boolean).join(' | ');
  }
  if (order.preferred_delivery_time?.trim()) {
    return order.preferred_delivery_time;
  }
  return null;
}

interface OrderCardProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  order: any;
  onActionComplete?: () => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onActionComplete }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const { profile } = useUserProfileContext();
  const apiClient = useApiClient();
  const { enqueueSnackbar } = useSnackbar();
  const { confirmOrder, completePreparation, completeOrder } = useBackendOrders();
  const { printLabelAndPrint, loading: printLabelLoading } = useShippingLabels();
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

  const orderImage = heroImageFromOrder(order);
  const currentStatus = order.current_status || 'unknown';
  const isCompleted = ['delivered', 'complete'].includes(currentStatus);
  const isCancelled = ['cancelled', 'failed', 'refunded'].includes(
    currentStatus
  );

  const userType =
    profile?.user_type_id === 'business'
      ? 'business'
      : profile?.user_type_id === 'client'
        ? 'client'
        : profile?.user_type_id === 'agent'
          ? 'agent'
          : null;
  const isBusinessView = userType === 'business';

  const lineItemCount = order.order_items?.length ?? 0;
  const [lineItemsOpen, setLineItemsOpen] = useState(lineItemCount <= 3);
  const scheduleLabel = formatDeliveryScheduleLabel(order);

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
      throw new Error(errorMessage);
    } finally {
      setLoadingAction(null);
    }
  };

  // Handle ready for pickup (from confirmed or preparing)
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

  const handleCancelClaimRequest = async () => {
    if (!apiClient) {
      enqueueSnackbar(t('messages.apiClientUnavailable', 'API client not available'), {
        variant: 'error',
      });
      return;
    }

    setLoadingAction('cancelClaimRequest');
    try {
      const response = await apiClient.post('/orders/cancel-claim-request', {
        orderId: order.id,
      });

      if (!response.data?.success) {
        throw new Error(
          response.data?.error ||
            response.data?.message ||
            t(
              'orders.claimPending.cancelRequestFailed',
              'Failed to cancel claim request'
            )
        );
      }

      enqueueSnackbar(
        t(
          'orders.claimPending.cancelRequestSuccess',
          'Claim request cancelled successfully'
        ),
        { variant: 'success' }
      );
      onActionComplete?.();
    } catch (error: any) {
      enqueueSnackbar(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          t(
            'orders.claimPending.cancelRequestFailed',
            'Failed to cancel claim request'
          ),
        { variant: 'error' }
      );
    } finally {
      setLoadingAction(null);
    }
  };

  // Get available quick actions based on status and user type
  const getAvailableActions = () => {
    const actions: Array<{
      label: string;
      onClick: () => void;
      color: 'primary' | 'success' | 'error';
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
      } else if (currentStatus === 'confirmed' || currentStatus === 'preparing') {
        actions.push({
          label: t('orders.actions.readyForPickup', 'Set as ready'),
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
    } else if (
      userType === 'agent' &&
      currentStatus === 'ready_for_pickup' &&
      order.is_claim_pending
    ) {
      actions.push({
        label: t(
          'orders.claimPending.cancelRequest',
          'Cancel claim request'
        ),
        onClick: handleCancelClaimRequest,
        color: 'error',
        loading: loadingAction === 'cancelClaimRequest',
      });
    }

    return actions;
  };

  const availableActions = getAvailableActions();
  const primaryAction = availableActions[0];
  const statusColorKey = getStatusColor(currentStatus) as keyof typeof theme.palette;
  const statusPalette = theme.palette[statusColorKey] as { main?: string } | undefined;
  const statusBarColor = statusPalette?.main ?? theme.palette.divider;
  const itemCount =
    order.order_items?.reduce(
      (sum: number, item: OrderItem) => sum + (item.quantity ?? 0),
      0
    ) ?? 0;
  const deliveryFee = getDeliveryFee();
  const addressLines = deliveryAddressLines(order);
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

  const orderImageBox = (px: number) => (
    <Box
      sx={{
        width: px,
        height: px,
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
        <Typography
          component="span"
          sx={{ fontSize: px * 0.45 }}
          role="img"
          aria-label={t('orders.package', 'Package')}
        >
          📦
        </Typography>
      )}
    </Box>
  );

  const statusChipRow = (
    <Stack direction="row" alignItems="center" flexWrap="wrap" gap={0.75} sx={{ mb: 0.25 }}>
      <Typography variant="subtitle1" fontWeight="bold" sx={{ fontSize: '1rem' }}>
        #{order.order_number}
      </Typography>
      <Chip
        label={String(t(`common.orderStatus.${currentStatus}`, currentStatus))}
        color={getStatusColor(currentStatus) as 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'}
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
      {userType === 'agent' &&
        currentStatus === 'ready_for_pickup' &&
        order.is_claim_pending && (
          <Chip
            label={t('orders.claimPending.waitingApproval', 'Waiting for payment approval')}
            size="small"
            color="warning"
            variant="outlined"
            sx={{ height: 22, fontWeight: 600 }}
          />
        )}
    </Stack>
  );

  const actionsRow = (
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
  );

  const pricingBlock = (
    <Box sx={{ textAlign: { xs: 'left', sm: 'right' } }}>
      {profile?.user_type_id === 'agent' && order.delivery_commission !== undefined ? (
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
              {t('orders.inclDelivery', 'incl.')} {getDeliveryFeeDisplay()}{' '}
              {t('orders.delivery', 'delivery')}
            </Typography>
          ) : null}
        </>
      )}
    </Box>
  );

  const taxAmt = Number(order.tax_amount ?? 0);

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
      {isBusinessView ? (
        <CardContent
          sx={{
            flex: 1,
            p: 2.5,
            py: 2,
            '&:last-child': { pb: 2.5 },
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
            {orderImageBox(96)}
            <Box sx={{ flex: 1, minWidth: 200 }}>
              {statusChipRow}
              <Stack
                direction="row"
                flexWrap="wrap"
                alignItems="center"
                sx={{ typography: 'caption', color: 'text.secondary', gap: 2, mt: 0.5 }}
              >
                <Stack direction="row" alignItems="center" gap={0.5}>
                  <ScheduleIcon sx={{ fontSize: 16 }} />
                  <span>{formatDate(order.created_at)}</span>
                </Stack>
                <Stack direction="row" alignItems="center" gap={0.5}>
                  <ShoppingBag sx={{ fontSize: 16 }} />
                  <span>
                    {itemCount}{' '}
                    {itemCount === 1 ? t('orders.item', 'item') : t('orders.items', 'items')}
                  </span>
                </Stack>
              </Stack>
            </Box>
            <Box sx={{ minWidth: 140 }}>{pricingBlock}</Box>
          </Box>

          {addressLines.length > 0 && (
            <Box>
              <Stack direction="row" gap={1.25} alignItems="flex-start">
                <LocationOn color="action" sx={{ fontSize: 22, mt: 0.25, flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" gutterBottom>
                    {t('orders.card.deliveryAddress', 'Delivery address')}
                  </Typography>
                  {addressLines.map((line, i) => (
                    <Typography key={i} variant="body2" sx={{ wordBreak: 'break-word' }}>
                      {line}
                    </Typography>
                  ))}
                </Box>
              </Stack>
            </Box>
          )}

          {scheduleLabel ? (
            <Stack direction="row" gap={1.25} alignItems="flex-start">
              <ScheduleIcon color="action" sx={{ fontSize: 22, mt: 0.25, flexShrink: 0 }} />
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" gutterBottom>
                  {t('orders.card.preferredDelivery', 'Preferred delivery')}
                </Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                  {scheduleLabel}
                </Typography>
              </Box>
            </Stack>
          ) : null}

          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" gutterBottom>
              {t('orders.card.amounts', 'Amounts')}
            </Typography>
            <Stack spacing={0.75}>
              <Stack direction="row" justifyContent="space-between" gap={2}>
                <Typography variant="body2" color="text.secondary">
                  {t('orders.subtotal', 'Subtotal')}
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {formatCurrency(order.subtotal ?? 0, order.currency)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" gap={2}>
                <Typography variant="body2" color="text.secondary">
                  {t('orders.deliveryFee', 'Delivery fee')}
                </Typography>
                <Typography variant="body2" fontWeight={500}>
                  {getDeliveryFeeDisplay()}
                </Typography>
              </Stack>
              {taxAmt > 0 ? (
                <Stack direction="row" justifyContent="space-between" gap={2}>
                  <Typography variant="body2" color="text.secondary">
                    {t('orders.tax', 'Tax')}
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {formatCurrency(taxAmt, order.currency)}
                  </Typography>
                </Stack>
              ) : null}
              <Divider />
              <Stack direction="row" justifyContent="space-between" gap={2} alignItems="baseline">
                <Typography variant="subtitle2" fontWeight={700}>
                  {t('orders.total', 'Total')}
                </Typography>
                <Typography variant="subtitle1" fontWeight={700}>
                  {order.total_amount != null
                    ? formatCurrency(order.total_amount, order.currency)
                    : '—'}
                </Typography>
              </Stack>
            </Stack>
          </Box>

          {lineItemCount > 0 ? (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1} sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  {t('orders.card.lineItems', 'Items in this order')}
                </Typography>
                {lineItemCount > 1 ? (
                  <Button
                    size="small"
                    onClick={() => setLineItemsOpen((o) => !o)}
                    endIcon={lineItemsOpen ? <ExpandLess /> : <ExpandMore />}
                    sx={{ textTransform: 'none' }}
                  >
                    {lineItemsOpen
                      ? t('orders.card.hideItems', 'Hide items')
                      : t('orders.card.showItems', 'Show items ({{count}})', { count: lineItemCount })}
                  </Button>
                ) : null}
              </Stack>
              <Collapse in={lineItemsOpen || lineItemCount === 1}>
                <Stack spacing={1.5} sx={{ maxHeight: 320, overflow: 'auto', pr: 0.5 }}>
                  {(order.order_items ?? []).map((line: OrderItem) => {
                    const thumb = pickBestItemImageUrl(line.item?.item_images);
                    return (
                      <Stack key={line.id} direction="row" spacing={1.5} alignItems="center">
                        <Box
                          sx={{
                            width: 56,
                            height: 56,
                            borderRadius: 1,
                            overflow: 'hidden',
                            flexShrink: 0,
                            bgcolor: 'grey.200',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <Typography component="span" sx={{ fontSize: 22 }}>
                              📦
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
                            {line.item_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {t('orders.card.sku', 'SKU')}: {line.item?.sku ?? '—'} · ×{line.quantity}
                          </Typography>
                        </Box>
                        <Typography variant="body2" fontWeight={600} sx={{ flexShrink: 0 }}>
                          {formatCurrency(line.total_price ?? 0, order.currency)}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Stack>
              </Collapse>
            </Box>
          ) : null}

          <Divider />
          {actionsRow}
        </CardContent>
      ) : (
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
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, flex: 1, minWidth: 0 }}>
            {orderImageBox(48)}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {statusChipRow}
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
                {addressShort ? (
                  <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
                    <LocationOn sx={{ fontSize: 14 }} />
                    <Tooltip title={addressFull || addressShort} enterDelay={300}>
                      <Typography
                        component="span"
                        noWrap
                        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: { xs: 120, md: 200 } }}
                      >
                        {addressShort}
                      </Typography>
                    </Tooltip>
                  </Stack>
                ) : null}
                <Stack direction="row" alignItems="center" gap={0.5}>
                  <ShoppingBag sx={{ fontSize: 14 }} />
                  <span>
                    {itemCount}{' '}
                    {itemCount === 1 ? t('orders.item', 'item') : t('orders.items', 'items')}
                  </span>
                </Stack>
              </Stack>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              gap: 1,
              flexShrink: 0,
            }}
          >
            {pricingBlock}
            {actionsRow}
          </Box>
        </CardContent>
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
