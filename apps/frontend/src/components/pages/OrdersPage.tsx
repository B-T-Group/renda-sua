import {
  ExpandLess,
  ExpandMore,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Container,
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
import { useAccountInfo, useOrders, type OrderFilters } from '../../hooks';
import { useUserProfile } from '../../hooks/useUserProfile';
import AccountInformation from '../common/AccountInformation';
import AddressAlert from '../common/AddressAlert';
import OrderCard from '../common/OrderCard';

import SEOHead from '../seo/SEOHead';

const OrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile } = useUserProfile();
  const {
    accounts,
    loading: accountLoading,
    error: accountError,
  } = useAccountInfo();
  const [filters, setFilters] = useState<OrderFilters>({
    search: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  });
  const [showCompletedOrders, setShowCompletedOrders] = useState(false);

  // Use unified orders hook that handles user type on backend
  const { orders, loading, error, fetchOrders, refreshOrders } = useOrders();

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

  // Separate active and completed/cancelled orders
  const { activeStatuses, completedStatuses } = useMemo(() => {
    const seen = Array.from(
      new Set((orders || []).map((o) => o.current_status || 'unknown'))
    );

    const completedStatusTypes = ['complete', 'cancelled', 'refunded'];

    const active = seen.filter(
      (status) => !completedStatusTypes.includes(status)
    );
    const completed = seen.filter((status) =>
      completedStatusTypes.includes(status)
    );

    const sortStatuses = (statuses: string[]) => {
      return statuses.sort((a, b) => {
        const ia = statusOrder.indexOf(a);
        const ib = statusOrder.indexOf(b);
        const va = ia === -1 ? 999 : ia;
        const vb = ib === -1 ? 999 : ib;
        return va - vb;
      });
    };

    return {
      activeStatuses: sortStatuses(active),
      completedStatuses: sortStatuses(completed),
    };
  }, [orders, statusOrder]);

  // Count completed orders for the collapsible header
  const completedOrdersCount = useMemo(() => {
    return completedStatuses.reduce((count, status) => {
      return count + (groupedByStatus[status]?.length || 0);
    }, 0);
  }, [completedStatuses, groupedByStatus]);

  // Determine page titles and content based on user type
  const getPageTitle = () => {
    if (profile?.business) {
      return t('business.orders.title', 'Business Orders');
    } else if (profile?.agent) {
      return t('agent.orders.title', 'Agent Orders');
    } else {
      return t('client.orders.title', 'My Orders');
    }
  };

  const getPageSubtitle = () => {
    if (profile?.business) {
      return t('business.orders.subtitle', 'Manage your business orders');
    } else if (profile?.agent) {
      return t('agent.orders.subtitle', 'Manage assigned deliveries');
    } else {
      return t('client.orders.subtitle', 'Track your orders and deliveries');
    }
  };

  useEffect(() => {
    fetchOrders({});
  }, [fetchOrders]);

  if (loading || accountLoading) {
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

  if (error || accountError) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          Error loading data:{' '}
          {typeof error === 'string'
            ? error
            : (error as any)?.message || typeof accountError === 'string'
            ? accountError
            : (accountError as any)?.message}
        </Alert>
      </Container>
    );
  }

  return (
    <>
      <SEOHead title={getPageTitle()} description={getPageSubtitle()} />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            {getPageTitle()}
          </Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {getPageSubtitle()}
          </Typography>
        </Box>

        {/* Address Alert - Only for clients */}
        {profile?.client && <AddressAlert />}

        {/* Account Information - Always show for all user types */}
        <AccountInformation
          accounts={accounts}
          onRefresh={refreshOrders}
          compactView={true}
          showTransactions={true}
        />

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
              label={t('orders.filters.search', 'Search orders')}
              value={filters.search}
              onChange={(e) => handleFilterChange({ search: e.target.value })}
              size="small"
              sx={{ minWidth: 200 }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>{t('orders.filters.status', 'Status')}</InputLabel>
              <Select
                value={filters.status}
                onChange={(e) => handleFilterChange({ status: e.target.value })}
                label={t('orders.filters.status', 'Status')}
              >
                <MenuItem value="">
                  {t('orders.filters.allStatuses', 'All Statuses')}
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
              label={t('orders.filters.dateFrom', 'From Date')}
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange({ dateFrom: e.target.value })}
              size="small"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label={t('orders.filters.dateTo', 'To Date')}
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
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Orders List */}
        {orders.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              {t('orders.noOrdersFound', 'No orders found')}
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Active Orders */}
            {activeStatuses.map((statusKey) => (
              <Box key={statusKey} sx={{ width: '100%' }}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  {t(`common.orderStatus.${statusKey}`)} (
                  {groupedByStatus[statusKey]?.length || 0})
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {(groupedByStatus[statusKey] || []).map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </Box>
              </Box>
            ))}

            {/* Completed/Cancelled Orders - Collapsible */}
            {completedOrdersCount > 0 && (
              <Paper sx={{ mt: 2 }}>
                <Button
                  fullWidth
                  onClick={() => setShowCompletedOrders(!showCompletedOrders)}
                  sx={{
                    p: 2,
                    justifyContent: 'space-between',
                    textTransform: 'none',
                    backgroundColor: 'transparent',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    },
                  }}
                  endIcon={
                    showCompletedOrders ? <ExpandLess /> : <ExpandMore />
                  }
                >
                  <Typography variant="subtitle1">
                    {t(
                      'orders.completedAndCancelled',
                      'Completed & Cancelled Orders'
                    )}{' '}
                    ({completedOrdersCount})
                  </Typography>
                </Button>
                <Collapse in={showCompletedOrders}>
                  <Box sx={{ p: 2, pt: 0 }}>
                    {completedStatuses.map((statusKey) => (
                      <Box key={statusKey} sx={{ width: '100%', mb: 2 }}>
                        <Typography
                          variant="subtitle2"
                          sx={{ mb: 1, color: 'text.secondary' }}
                        >
                          {t(`common.orderStatus.${statusKey}`)} (
                          {groupedByStatus[statusKey]?.length || 0})
                        </Typography>
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                          }}
                        >
                          {(groupedByStatus[statusKey] || []).map((order) => (
                            <OrderCard key={order.id} order={order} />
                          ))}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              </Paper>
            )}
          </Box>
        )}
      </Container>
    </>
  );
};

export default OrdersPage;
