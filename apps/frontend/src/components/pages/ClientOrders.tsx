import {
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  History as HistoryIcon,
  LocalShipping as LocalShippingIcon,
  Schedule as ScheduleIcon,
  Search as SearchIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Container,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackendOrders } from '../../hooks/useBackendOrders';
import { useClientOrders } from '../../hooks/useClientOrders';
import { useDistanceMatrix } from '../../hooks/useDistanceMatrix';
import { useUserProfile } from '../../hooks/useUserProfile';
import AddressAlert from '../common/AddressAlert';
import ConfirmationModal from '../common/ConfirmationModal';
import OrderHistoryDialog from '../dialogs/OrderHistoryDialog';
import SEOHead from '../seo/SEOHead';

interface OrderFilters {
  search: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

const ClientOrders: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfile();
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [filters, setFilters] = useState<OrderFilters>({
    search: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  });
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    orderId: string;
    status: string;
    notes?: string;
  } | null>(null);
  const [notes, setNotes] = useState('');
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedOrderForHistory, setSelectedOrderForHistory] =
    useState<any>(null);

  const { orders, loading, error, fetchOrders, refreshOrders } =
    useClientOrders(profile?.client?.id);
  const {
    cancelOrder,
    refundOrder,
    completeOrder,
    loading: updateLoading,
    error: updateError,
  } = useBackendOrders();

  // Aggregate unique destination address IDs from all orders
  const destinationAddressIds = React.useMemo(() => {
    return Array.from(
      new Set(
        (orders || [])
          .map((order) => order.business_location?.address?.id)
          .filter(Boolean)
      )
    );
  }, [orders]);

  const {
    data: distanceData,
    loading: distanceLoading,
    error: distanceError,
    fetchDistanceMatrix,
  } = useDistanceMatrix();

  // Fetch distance matrix when orders or addresses change
  React.useEffect(() => {
    if (destinationAddressIds.length > 0) {
      fetchDistanceMatrix({ destination_address_ids: destinationAddressIds });
    }
  }, [destinationAddressIds.join(',')]);

  // Helper to get distance/duration for an order
  const getOrderDistanceInfo = (order: any) => {
    if (!distanceData || !order.business_location?.address?.id) return null;
    const idx = distanceData.destination_ids.indexOf(
      order.business_location.address.id
    );
    if (idx === -1 || !distanceData.rows[0]?.elements[idx]) return null;
    const el = distanceData.rows[0].elements[idx];
    if (el.status !== 'OK') return null;
    return {
      distance: el.distance?.text,
      duration: el.duration?.text,
    };
  };

  const handleExpandOrder = (orderId: string) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const handleFilterChange = (newFilters: Partial<OrderFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleApplyFilters = () => {
    fetchOrders(filters);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      search: '',
      status: '',
      dateFrom: '',
      dateTo: '',
    };
    setFilters(clearedFilters);
    fetchOrders(clearedFilters);
  };

  const handleStatusUpdate = async (
    orderId: string,
    newStatus: string,
    notes?: string
  ) => {
    try {
      let response;

      switch (newStatus) {
        case 'cancelled':
          response = await cancelOrder({ orderId, notes });
          break;
        case 'refunded':
          response = await refundOrder({ orderId, notes });
          break;
        case 'complete':
          response = await completeOrder({ orderId, notes });
          break;
        default:
          throw new Error(`Unsupported status transition: ${newStatus}`);
      }

      if (response.success) {
        await refreshOrders();
        return response.order;
      } else {
        throw new Error(response.message || 'Failed to update order status');
      }
    } catch (error) {
      console.error('Failed to update order status:', error);
      throw error;
    }
  };

  const handleActionClick = (orderId: string, status: string) => {
    setPendingAction({ orderId, status });
    setConfirmationOpen(true);
    setNotes('');
  };

  const handleConfirmAction = async () => {
    if (pendingAction) {
      try {
        await handleStatusUpdate(
          pendingAction.orderId,
          pendingAction.status,
          notes.trim() || undefined
        );
      } catch (error) {
        console.error('Failed to update order status:', error);
      } finally {
        setConfirmationOpen(false);
        setPendingAction(null);
        setNotes('');
      }
    }
  };

  const handleCancelAction = () => {
    setConfirmationOpen(false);
    setPendingAction(null);
    setNotes('');
  };

  const getAvailableActions = (order: any) => {
    const actions = [];
    const status = order.current_status;

    switch (status) {
      case 'pending':
      case 'confirmed':
      case 'preparing':
        actions.push({
          label: t('business.orders.actions.cancel'),
          status: 'cancelled',
          color: 'error' as const,
        });
        break;
      case 'delivered':
        actions.push({
          label: t('orders.actions.complete'),
          status: 'complete',
          color: 'success' as const,
        });
        actions.push({
          label: t('business.orders.actions.refund'),
          status: 'refunded',
          color: 'warning' as const,
        });
        break;
    }

    return actions;
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
      default:
        return 'default';
    }
  };

  // Helper to format address as string
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

  // Group by status and order statuses with 'complete' last
  const statusOrder = useMemo(
    () => [
      'pending',
      'confirmed',
      'preparing',
      'ready_for_pickup',
      'assigned_to_agent',
      'picked_up',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'cancelled',
      'failed',
      'refunded',
      'complete',
    ],
    []
  );

  const groupedByStatus = useMemo(() => {
    const buckets: Record<string, any[]> = {};
    (orders || []).forEach((o) => {
      const s = o.current_status || 'unknown';
      if (!buckets[s]) buckets[s] = [];
      buckets[s].push(o);
    });
    return buckets;
  }, [orders]);

  const orderedStatuses = useMemo(() => {
    const seen = Array.from(
      new Set((orders || []).map((o) => o.current_status || 'unknown'))
    );
    return seen.sort((a, b) => {
      const ia = statusOrder.indexOf(a);
      const ib = statusOrder.indexOf(b);
      const va = ia === -1 ? 999 : ia;
      const vb = ib === -1 ? 999 : ib;
      return va - vb;
    });
  }, [orders, statusOrder]);

  useEffect(() => {
    fetchOrders({});
  }, [fetchOrders]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Error loading orders:{' '}
          {typeof error === 'string' ? error : (error as any)?.message}
        </Alert>
      </Container>
    );
  }

  return (
    <>
      <SEOHead
        title={t('client.orders.title')}
        description={t('client.orders.subtitle')}
      />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {t('client.orders.title')}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {t('client.orders.subtitle')}
          </Typography>
        </Box>

        {/* Address Alert */}
        <AddressAlert />

        {/* Filters */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <TextField
              label={t('business.orders.filters.search')}
              value={filters.search}
              onChange={(e) => handleFilterChange({ search: e.target.value })}
              size="small"
              sx={{ minWidth: 200 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>{t('business.orders.filters.status')}</InputLabel>
              <Select
                value={filters.status}
                onChange={(e) => handleFilterChange({ status: e.target.value })}
                label={t('business.orders.filters.status')}
              >
                <MenuItem value="">
                  {t('business.orders.filters.allStatuses')}
                </MenuItem>
                <MenuItem value="pending">
                  {t('common.orderStatus.pending')}
                </MenuItem>
                <MenuItem value="confirmed">
                  {t('common.orderStatus.confirmed')}
                </MenuItem>
                <MenuItem value="preparing">
                  {t('common.orderStatus.preparing')}
                </MenuItem>
                <MenuItem value="ready_for_pickup">
                  {t('common.orderStatus.ready_for_pickup')}
                </MenuItem>
                <MenuItem value="assigned_to_agent">
                  {t('common.orderStatus.assigned_to_agent')}
                </MenuItem>
                <MenuItem value="picked_up">
                  {t('common.orderStatus.picked_up')}
                </MenuItem>
                <MenuItem value="in_transit">
                  {t('common.orderStatus.in_transit')}
                </MenuItem>
                <MenuItem value="out_for_delivery">
                  {t('common.orderStatus.out_for_delivery')}
                </MenuItem>
                <MenuItem value="delivered">
                  {t('common.orderStatus.delivered')}
                </MenuItem>
                <MenuItem value="cancelled">
                  {t('common.orderStatus.cancelled')}
                </MenuItem>
                <MenuItem value="failed">
                  {t('common.orderStatus.failed')}
                </MenuItem>
                <MenuItem value="refunded">
                  {t('common.orderStatus.refunded')}
                </MenuItem>
              </Select>
            </FormControl>
            <TextField
              label={t('business.orders.filters.dateFrom')}
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange({ dateFrom: e.target.value })}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('business.orders.filters.dateTo')}
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange({ dateTo: e.target.value })}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <Button
              variant="contained"
              onClick={handleApplyFilters}
              startIcon={<SearchIcon />}
            >
              {t('common.search')}
            </Button>
            <Button variant="outlined" onClick={handleClearFilters}>
              {t('common.clear')}
            </Button>
          </Box>
        </Paper>

        {/* Error Display */}
        {(error || updateError) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error || updateError}
          </Alert>
        )}

        {/* Orders List */}
        {orders.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              {t('client.orders.noOrdersFound')}
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {orderedStatuses.map((statusKey) => (
              <Box key={statusKey} sx={{ width: '100%' }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  {t(`common.orderStatus.${statusKey}`)} (
                  {groupedByStatus[statusKey]?.length || 0})
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {(groupedByStatus[statusKey] || []).map((order) => {
                    const distanceInfo = getOrderDistanceInfo(order);
                    return (
                      <Card key={order.id}>
                        <CardContent>
                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            mb={2}
                          >
                            <Typography variant="h6" component="div">
                              {t('common.orderNumber', {
                                number: order.order_number,
                              })}
                            </Typography>
                            <Chip
                              label={t(
                                `common.orderStatus.${
                                  order.current_status || 'unknown'
                                }`
                              )}
                              color={
                                getStatusColor(
                                  order.current_status || 'unknown'
                                ) as any
                              }
                              size="small"
                            />
                          </Box>

                          <Box mb={2}>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              display="flex"
                              alignItems="center"
                              mb={1}
                            >
                              <ShoppingCartIcon sx={{ mr: 1, fontSize: 16 }} />
                              {order.business?.name}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              display="flex"
                              alignItems="center"
                              mb={1}
                            >
                              {/* <ReceiptIcon sx={{ mr: 1, fontSize: 16 }} /> */}
                              {order.order_items?.length || 0}{' '}
                              {t('orders.table.items')}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              display="flex"
                              alignItems="center"
                              mb={1}
                            >
                              <LocalShippingIcon sx={{ mr: 1, fontSize: 16 }} />
                              {formatAddress(order.delivery_address)}
                            </Typography>
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              display="flex"
                              alignItems="center"
                            >
                              <ScheduleIcon sx={{ mr: 1, fontSize: 16 }} />
                              {formatDate(order.created_at)}
                            </Typography>
                          </Box>

                          <Box
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            mb={2}
                          >
                            <Typography variant="h6" color="primary">
                              {formatCurrency(
                                order.total_amount,
                                order.currency
                              )}
                            </Typography>
                            {order.assigned_agent && (
                              <Chip
                                label={`${order.assigned_agent.user.first_name} ${order.assigned_agent.user.last_name}`}
                                size="small"
                                color="secondary"
                              />
                            )}
                          </Box>

                          {/* Order Actions */}
                          <Box
                            sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}
                          >
                            {getAvailableActions(order).map((action) => (
                              <Button
                                key={action.status}
                                size="small"
                                color={action.color}
                                variant="outlined"
                                onClick={() =>
                                  handleActionClick(order.id, action.status)
                                }
                                disabled={updateLoading}
                              >
                                {action.label}
                              </Button>
                            ))}
                            <Button
                              size="small"
                              color="info"
                              variant="outlined"
                              startIcon={<HistoryIcon />}
                              onClick={() => {
                                setSelectedOrderForHistory(order);
                                setHistoryDialogOpen(true);
                              }}
                              disabled={updateLoading}
                            >
                              {t('orders.actions.viewHistory', 'History')}
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => handleExpandOrder(order.id)}
                              endIcon={
                                expandedOrder === order.id ? (
                                  <ExpandLessIcon />
                                ) : (
                                  <ExpandMoreIcon />
                                )
                              }
                            >
                              {expandedOrder === order.id
                                ? t('common.hideDetails')
                                : t('common.showDetails')}
                            </Button>
                          </Box>

                          {/* Warning for delivered orders */}
                          {order.current_status === 'delivered' && (
                            <Alert severity="warning" sx={{ mt: 2, mb: 2 }}>
                              <Typography variant="body2">
                                {t(
                                  'orders.completionWarning',
                                  'Please complete your order within 8 hours to finalize the transaction. Penalties may apply if not completed on time.'
                                )}
                              </Typography>
                            </Alert>
                          )}

                          {/* Order Details */}
                          <Collapse in={expandedOrder === order.id}>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle2" gutterBottom>
                              {t('orders.orderItems')}
                            </Typography>
                            <Box
                              sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 1,
                              }}
                            >
                              {order.order_items?.map((item: any) => (
                                <Box key={item.id} sx={{ width: '100%' }}>
                                  <Paper
                                    variant="outlined"
                                    sx={{
                                      p: 2,
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      gap: 2,
                                    }}
                                  >
                                    {/* Item Image */}
                                    <Box sx={{ flexShrink: 0 }}>
                                      {item.item?.item_images?.[0]
                                        ?.image_url ? (
                                        <Avatar
                                          src={
                                            item.item.item_images[0].image_url
                                          }
                                          alt={item.item_name}
                                          sx={{
                                            width: 150,
                                            height: 150,
                                            borderRadius: 1,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                          }}
                                          variant="rounded"
                                          onError={(e) => {
                                            // Hide the image on error and show fallback
                                            e.currentTarget.style.display =
                                              'none';
                                          }}
                                        />
                                      ) : null}
                                      {!item.item?.item_images?.[0]
                                        ?.image_url && (
                                        <Avatar
                                          sx={{
                                            width: 150,
                                            height: 150,
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
                                      <Typography
                                        variant="body1"
                                        fontWeight="medium"
                                        noWrap
                                      >
                                        {item.item_name}
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        color="text.secondary"
                                      >
                                        {item.quantity} x{' '}
                                        {formatCurrency(
                                          item.unit_price,
                                          order.currency
                                        )}
                                      </Typography>
                                      {item.item?.brand?.name && (
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                        >
                                          {t('orders.brand')}:{' '}
                                          {item.item.brand.name}
                                        </Typography>
                                      )}
                                      {item.item?.model && (
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          display="block"
                                        >
                                          {t('orders.model')}: {item.item.model}
                                        </Typography>
                                      )}
                                      {item.item?.color && (
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          display="block"
                                        >
                                          {t('orders.color')}: {item.item.color}
                                        </Typography>
                                      )}
                                      {item.item?.size && (
                                        <Typography
                                          variant="caption"
                                          color="text.secondary"
                                          display="block"
                                        >
                                          {t('orders.size')}: {item.item.size}{' '}
                                          {item.item.size_unit}
                                        </Typography>
                                      )}
                                    </Box>

                                    {/* Price */}
                                    <Box
                                      textAlign="right"
                                      sx={{ flexShrink: 0 }}
                                    >
                                      <Typography
                                        variant="body1"
                                        fontWeight="medium"
                                      >
                                        {formatCurrency(
                                          item.total_price,
                                          order.currency
                                        )}
                                      </Typography>
                                    </Box>
                                  </Paper>
                                </Box>
                              ))}
                            </Box>
                            {order.special_instructions && (
                              <>
                                <Divider sx={{ my: 2 }} />
                                <Typography variant="subtitle2" gutterBottom>
                                  {t('orders.specialInstructions')}
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                >
                                  {order.special_instructions}
                                </Typography>
                              </>
                            )}
                          </Collapse>
                          {/* Distance Matrix display */}
                          {distanceLoading && (
                            <Typography variant="body2" color="text.secondary">
                              {t('common.loading')} distance...
                            </Typography>
                          )}
                          {distanceError && (
                            <Typography variant="body2" color="error">
                              {t('common.error')}: {distanceError}
                            </Typography>
                          )}
                          {distanceInfo && (
                            <Typography variant="body2" color="text.secondary">
                              {t('Distance')}: {distanceInfo.distance},{' '}
                              {t('Duration')}: {distanceInfo.duration}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Container>

      <ConfirmationModal
        open={confirmationOpen}
        title={t('orders.confirmTitle')}
        message={
          pendingAction
            ? t('business.orders.confirmStatusUpdate', {
                orderNumber: orders.find((o) => o.id === pendingAction.orderId)
                  ?.order_number,
                newStatus: t(`common.orderStatus.${pendingAction.status}`),
              })
            : ''
        }
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
        confirmColor="primary"
        loading={updateLoading}
        additionalContent={
          <TextField
            fullWidth
            multiline
            rows={3}
            label={t('orders.notes')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('orders.notesPlaceholder')}
            sx={{ mt: 2 }}
          />
        }
      />

      <OrderHistoryDialog
        open={historyDialogOpen}
        onClose={() => {
          setHistoryDialogOpen(false);
          setSelectedOrderForHistory(null);
        }}
        orderHistory={selectedOrderForHistory?.order_status_history || []}
        orderNumber={selectedOrderForHistory?.order_number || ''}
      />
    </>
  );
};

export default ClientOrders;
