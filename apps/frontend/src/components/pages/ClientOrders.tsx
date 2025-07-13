import {
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  LocalShipping as LocalShippingIcon,
  Schedule as ScheduleIcon,
  Search as SearchIcon,
  ShoppingCart as ShoppingCartIcon,
} from '@mui/icons-material';
import {
  Alert,
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
  Grid,
  InputLabel,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackendOrders } from '../../hooks/useBackendOrders';
import { useClientOrders } from '../../hooks/useClientOrders';
import { useUserProfile } from '../../hooks/useUserProfile';
import ConfirmationModal from '../common/ConfirmationModal';
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

  const { orders, loading, error, fetchOrders, refreshOrders } =
    useClientOrders(profile?.client?.id);
  const {
    cancelOrder,
    refundOrder,
    loading: updateLoading,
    error: updateError,
  } = useBackendOrders();

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
          label: t('orders.actions.cancel'),
          status: 'cancelled',
          color: 'error' as const,
        });
        break;
      case 'delivered':
        actions.push({
          label: t('orders.actions.refund'),
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
          {typeof error === 'string' ? error : error.message}
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
              label={t('orders.filters.search')}
              value={filters.search}
              onChange={(e) => handleFilterChange({ search: e.target.value })}
              size="small"
              sx={{ minWidth: 200 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>{t('orders.filters.status')}</InputLabel>
              <Select
                value={filters.status}
                onChange={(e) => handleFilterChange({ status: e.target.value })}
                label={t('orders.filters.status')}
              >
                <MenuItem value="">{t('orders.filters.allStatuses')}</MenuItem>
                <MenuItem value="pending">
                  {t('orders.status.pending')}
                </MenuItem>
                <MenuItem value="confirmed">
                  {t('orders.status.confirmed')}
                </MenuItem>
                <MenuItem value="preparing">
                  {t('orders.status.preparing')}
                </MenuItem>
                <MenuItem value="ready_for_pickup">
                  {t('orders.status.ready_for_pickup')}
                </MenuItem>
                <MenuItem value="assigned_to_agent">
                  {t('orders.status.assigned_to_agent')}
                </MenuItem>
                <MenuItem value="picked_up">
                  {t('orders.status.picked_up')}
                </MenuItem>
                <MenuItem value="in_transit">
                  {t('orders.status.in_transit')}
                </MenuItem>
                <MenuItem value="out_for_delivery">
                  {t('orders.status.out_for_delivery')}
                </MenuItem>
                <MenuItem value="delivered">
                  {t('orders.status.delivered')}
                </MenuItem>
                <MenuItem value="cancelled">
                  {t('orders.status.cancelled')}
                </MenuItem>
                <MenuItem value="failed">{t('orders.status.failed')}</MenuItem>
                <MenuItem value="refunded">
                  {t('orders.status.refunded')}
                </MenuItem>
              </Select>
            </FormControl>
            <TextField
              label={t('orders.filters.dateFrom')}
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange({ dateFrom: e.target.value })}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('orders.filters.dateTo')}
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
          <Grid container spacing={2}>
            {orders.map((order) => (
              <Grid item xs={12} key={order.id}>
                <Card>
                  <CardContent>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      mb={2}
                    >
                      <Typography variant="h6" component="div">
                        {t('orders.table.orderNumber', {
                          number: order.order_number,
                        })}
                      </Typography>
                      <Chip
                        label={t(
                          `orders.status.${order.current_status || 'unknown'}`
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
                        <ReceiptIcon sx={{ mr: 1, fontSize: 16 }} />
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
                        {formatCurrency(order.total_amount, order.currency)}
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
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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

                    {/* Order Details */}
                    <Collapse in={expandedOrder === order.id}>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle2" gutterBottom>
                        {t('orders.orderItems')}
                      </Typography>
                      <List dense>
                        {order.order_items?.map((item: any) => (
                          <ListItem key={item.id}>
                            <ListItemText
                              primary={item.item_name}
                              secondary={`${item.quantity} x ${formatCurrency(
                                item.unit_price,
                                order.currency
                              )}`}
                            />
                            <ListItemSecondaryAction>
                              <Typography variant="body2">
                                {formatCurrency(
                                  item.total_price,
                                  order.currency
                                )}
                              </Typography>
                            </ListItemSecondaryAction>
                          </ListItem>
                        ))}
                      </List>
                      {order.special_instructions && (
                        <>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant="subtitle2" gutterBottom>
                            {t('orders.specialInstructions')}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {order.special_instructions}
                          </Typography>
                        </>
                      )}
                    </Collapse>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>

      <ConfirmationModal
        open={confirmationOpen}
        title={t('orders.confirmTitle')}
        message={
          pendingAction
            ? t('orders.confirmStatusUpdate', {
                orderNumber: orders.find((o) => o.id === pendingAction.orderId)
                  ?.order_number,
                newStatus: t(`orders.status.${pendingAction.status}`),
              })
            : ''
        }
        confirmText={t('common.confirm')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmAction}
        onCancel={handleCancelAction}
        color="primary"
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
    </>
  );
};

export default ClientOrders;
