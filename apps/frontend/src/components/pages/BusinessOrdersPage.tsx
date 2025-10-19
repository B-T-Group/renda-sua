import {
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  LocalShippingOutlined as LocalShippingOutlinedIcon,
  PlayArrow as PlayArrowIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBackendOrders } from '../../hooks/useBackendOrders';
import { useBusinessLocations } from '../../hooks/useBusinessLocations';
import { useBusinessOrders } from '../../hooks/useBusinessOrders';
import { useUserProfile } from '../../hooks/useUserProfile';
import BusinessOrderCard from '../business/BusinessOrderCard';
import SEOHead from '../seo/SEOHead';

interface OrderFilters {
  search: string;
  status: string;
  dateFrom: string;
  dateTo: string;
  address: string;
}

const BusinessOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfile();
  const [tabValue, setTabValue] = useState(0);
  const [filters, setFilters] = useState<OrderFilters>({
    search: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    address: '',
  });

  const {
    orders,
    loading: ordersLoading,
    error: ordersError,
    fetchOrders,
    refreshOrders,
  } = useBusinessOrders(profile?.business?.id);
  const {
    startPreparing,
    completePreparation,
    cancelOrder,
    refundOrder,
    loading: updateLoading,
    error: updateError,
  } = useBackendOrders();
  const { locations } = useBusinessLocations();

  // Debug logging
  console.log('BusinessOrdersPage: Orders data:', orders);
  console.log(
    'BusinessOrdersPage: Orders with undefined status:',
    orders.filter((order) => !order.current_status)
  );

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleFilterChange = (newFilters: Partial<OrderFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleStatusUpdate = async (
    orderId: string,
    newStatus: string,
    notes?: string
  ) => {
    try {
      let response;

      switch (newStatus) {
        case 'preparing':
          response = await startPreparing({ orderId, notes });
          break;
        case 'complete_preparation':
          response = await completePreparation({ orderId, notes });
          break;
        case 'ready_for_pickup':
          // No direct action, only transition from complete_preparation
          throw new Error(
            'Cannot set ready_for_pickup directly. Use complete_preparation.'
          );
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
        // Refresh orders to get the updated data
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

  const handleApplyFilters = () => {
    fetchOrders(filters);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      search: '',
      status: '',
      dateFrom: '',
      dateTo: '',
      address: '',
    };
    setFilters(clearedFilters);
    fetchOrders(clearedFilters);
  };

  const getAvailableActions = (order: any) => {
    const actions = [];
    const status = order.current_status;

    switch (status) {
      case 'pending':
        actions.push({
          label: t('orders.actions.confirm'),
          status: 'confirmed',
          color: 'success' as const,
          icon: CheckCircleIcon,
        });
        actions.push({
          label: t('orders.actions.cancel'),
          status: 'cancelled',
          color: 'error' as const,
          icon: CancelIcon,
        });
        break;
      case 'confirmed':
        actions.push({
          label: t('orders.actions.startPreparing'),
          status: 'preparing',
          color: 'primary' as const,
          icon: PlayArrowIcon,
        });
        actions.push({
          label: t('orders.actions.cancel'),
          status: 'cancelled',
          color: 'error' as const,
          icon: CancelIcon,
        });
        break;
      case 'preparing':
        actions.push({
          label: t('orders.actions.completePreparation'),
          status: 'complete_preparation',
          color: 'info' as const,
          icon: CheckCircleIcon,
        });
        break;
      case 'complete_preparation':
        actions.push({
          label: t('orders.actions.readyForPickup'),
          status: 'ready_for_pickup',
          color: 'success' as const,
          icon: LocalShippingOutlinedIcon,
        });
        break;
      case 'delivered':
        // Only show refund option if payment is not pending
        if (order.payment_status !== 'pending') {
          actions.push({
            label: t('orders.actions.refund'),
            status: 'refunded',
            color: 'warning' as const,
            icon: CancelIcon,
          });
        }
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

  const filteredOrders = orders
    .filter((order) => {
      if (tabValue === 0) return true; // All orders
      if (tabValue === 1)
        return [
          'pending',
          'confirmed',
          'preparing',
          'complete_preparation',
        ].includes(order.current_status);
      if (tabValue === 2)
        return [
          'ready_for_pickup',
          'assigned_to_agent',
          'picked_up',
          'in_transit',
          'out_for_delivery',
        ].includes(order.current_status);
      if (tabValue === 3)
        return ['delivered', 'cancelled', 'failed', 'refunded'].includes(
          order.current_status
        );
      return true;
    })
    .sort((a, b) => {
      // Fast delivery orders first
      if (a.requires_fast_delivery && !b.requires_fast_delivery) return -1;
      if (!a.requires_fast_delivery && b.requires_fast_delivery) return 1;

      // If both have same fast delivery status, sort by creation date (newest first)
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

  return (
    <>
      <SEOHead
        title={t('business.orders.title')}
        description={t('business.orders.subtitle')}
      />
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {t('business.orders.title')}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {t('business.orders.subtitle')}
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
                <MenuItem value="complete_preparation">
                  {t('common.orderStatus.complete_preparation')}
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
            <TextField
              label={t('business.orders.filters.address')}
              value={filters.address}
              onChange={(e) => handleFilterChange({ address: e.target.value })}
              size="small"
              sx={{ minWidth: 200 }}
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

        {/* Status Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label={t('orders.allOrders')} />
            <Tab label={t('common.orderStatus.preparing')} />
            <Tab label={t('common.orderStatus.in_transit')} />
            <Tab label={t('common.orderStatus.completed')} />
          </Tabs>
        </Box>

        {/* Error Display */}
        {(ordersError || updateError) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {ordersError || updateError}
          </Alert>
        )}

        {/* Orders List */}
        {ordersLoading ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="400px"
          >
            <Typography>{t('common.loading')}</Typography>
          </Box>
        ) : filteredOrders.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              {t('orders.noOrdersFound')}
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filteredOrders.map((order) => (
              <BusinessOrderCard
                key={order.id}
                order={order}
                onStatusUpdate={handleStatusUpdate}
                getAvailableActions={getAvailableActions}
                getStatusColor={getStatusColor}
                formatAddress={formatAddress}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                loading={updateLoading}
                refreshOrders={refreshOrders}
                businessAddress={
                  locations && locations.length > 0
                    ? formatAddress(locations[0].address)
                    : ''
                }
              />
            ))}
          </Box>
        )}
      </Container>
    </>
  );
};

export default BusinessOrdersPage;
