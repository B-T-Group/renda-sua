import {
  Cancel,
  CheckCircle,
  Close,
  ExpandLess,
  ExpandMore,
  FilterList,
  HourglassEmpty,
  LocalShipping,
  Refresh,
  Search as SearchIcon,
  ShoppingBag,
} from '@mui/icons-material';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Container,
  Drawer,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrders, type OrderFilters } from '../../hooks';
import { useUserProfile } from '../../hooks/useUserProfile';
import AddressAlert from '../common/AddressAlert';
import OrderCard from '../common/OrderCard';

import SEOHead from '../seo/SEOHead';

// Loading Skeleton Components
const OrderCardSkeleton: React.FC = () => (
  <Card sx={{ mb: 2 }}>
    <Skeleton variant="rectangular" height={8} />
    <CardContent>
      <Skeleton variant="text" width="40%" height={32} sx={{ mb: 1 }} />
      <Skeleton variant="text" width="30%" height={20} sx={{ mb: 2 }} />
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Skeleton
          variant="rectangular"
          width={120}
          height={120}
          sx={{ borderRadius: 2 }}
        />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="80%" height={20} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="70%" height={20} />
        </Box>
      </Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Skeleton variant="text" width="30%" height={40} />
        <Skeleton
          variant="rectangular"
          width={120}
          height={40}
          sx={{ borderRadius: 1 }}
        />
      </Box>
    </CardContent>
  </Card>
);

const StatsCardSkeleton: React.FC = () => (
  <Card>
    <CardContent>
      <Skeleton variant="circular" width={48} height={48} sx={{ mb: 2 }} />
      <Skeleton variant="text" width="60%" height={24} />
      <Skeleton variant="text" width="40%" height={32} />
    </CardContent>
  </Card>
);

const OrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { profile } = useUserProfile();
  const [filters, setFilters] = useState<OrderFilters>({
    search: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  });
  const [showCompletedOrders, setShowCompletedOrders] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buckets: Record<string, any[]> = {};
    (orders || []).forEach((o) => {
      const s = o.current_status || 'unknown';
      if (!buckets[s]) buckets[s] = [];
      buckets[s].push(o);
    });

    // Sort orders within each status bucket to prioritize fast delivery orders
    Object.keys(buckets).forEach((status) => {
      buckets[status].sort((a, b) => {
        // Fast delivery orders first
        if (a.requires_fast_delivery && !b.requires_fast_delivery) return -1;
        if (!a.requires_fast_delivery && b.requires_fast_delivery) return 1;

        // If both have same fast delivery status, sort by creation date (newest first)
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
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

  // Calculate order stats
  const orderStats = useMemo(() => {
    const total = orders.length;
    const activeOrders = orders.filter((o) =>
      [
        'confirmed',
        'preparing',
        'ready_for_pickup',
        'assigned_to_agent',
        'picked_up',
        'in_transit',
        'out_for_delivery',
      ].includes(o.current_status || '')
    );
    const pending = orders.filter((o) =>
      ['pending', 'pending_payment'].includes(o.current_status || '')
    );
    const delivered = orders.filter((o) =>
      ['delivered', 'complete'].includes(o.current_status || '')
    );
    const cancelled = orders.filter((o) =>
      ['cancelled', 'failed', 'refunded'].includes(o.current_status || '')
    );

    return {
      total,
      active: activeOrders.length,
      pending: pending.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
    };
  }, [orders]);

  useEffect(() => {
    fetchOrders({});
  }, [fetchOrders]);

  // Filters Component for reuse in drawer and desktop
  const FiltersContent = () => (
    <Stack spacing={2}>
      <TextField
        label={t('orders.filters.search', 'Search orders')}
        value={filters.search}
        onChange={(e) => handleFilterChange({ search: e.target.value })}
        size="small"
        fullWidth
        placeholder={t(
          'orders.searchPlaceholder',
          'Order number, business name...'
        )}
      />
      <FormControl size="small" fullWidth>
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
            {t('common.orderStatus.pending', 'Pending')}
          </MenuItem>
          <MenuItem value="confirmed">
            {t('common.orderStatus.confirmed', 'Confirmed')}
          </MenuItem>
          <MenuItem value="preparing">
            {t('common.orderStatus.preparing', 'Preparing')}
          </MenuItem>
          <MenuItem value="ready_for_pickup">
            {t('common.orderStatus.ready_for_pickup', 'Ready for Pickup')}
          </MenuItem>
          <MenuItem value="assigned_to_agent">
            {t('common.orderStatus.assigned_to_agent', 'Assigned')}
          </MenuItem>
          <MenuItem value="picked_up">
            {t('common.orderStatus.picked_up', 'Picked Up')}
          </MenuItem>
          <MenuItem value="in_transit">
            {t('common.orderStatus.in_transit', 'In Transit')}
          </MenuItem>
          <MenuItem value="out_for_delivery">
            {t('common.orderStatus.out_for_delivery', 'Out for Delivery')}
          </MenuItem>
          <MenuItem value="delivered">
            {t('common.orderStatus.delivered', 'Delivered')}
          </MenuItem>
          <MenuItem value="cancelled">
            {t('common.orderStatus.cancelled', 'Cancelled')}
          </MenuItem>
        </Select>
      </FormControl>
      <TextField
        label={t('orders.filters.dateFrom', 'From Date')}
        type="date"
        value={filters.dateFrom}
        onChange={(e) => handleFilterChange({ dateFrom: e.target.value })}
        size="small"
        fullWidth
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        label={t('orders.filters.dateTo', 'To Date')}
        type="date"
        value={filters.dateTo}
        onChange={(e) => handleFilterChange({ dateTo: e.target.value })}
        size="small"
        fullWidth
        InputLabelProps={{ shrink: true }}
      />
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          onClick={() => {
            handleApplyFilters();
            if (isMobile) setFilterDrawerOpen(false);
          }}
          startIcon={<SearchIcon />}
          fullWidth
        >
          {t('common.search', 'Search')}
        </Button>
        <Button variant="outlined" onClick={handleClearFilters} fullWidth>
          {t('common.clear', 'Clear')}
        </Button>
      </Stack>
    </Stack>
  );

  return (
    <>
      <SEOHead title={getPageTitle()} description={getPageSubtitle()} />
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        {/* Header Section */}
        <Box sx={{ mb: 4 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Box>
              <Typography
                variant="h4"
                component="h1"
                gutterBottom
                fontWeight="bold"
                sx={{ fontSize: { xs: '1.75rem', md: '2.125rem' } }}
              >
                {getPageTitle()}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {getPageSubtitle()}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              onClick={() => refreshOrders()}
              startIcon={<Refresh />}
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            >
              {t('common.refresh', 'Refresh')}
            </Button>
            <IconButton
              onClick={() => refreshOrders()}
              sx={{ display: { xs: 'flex', sm: 'none' } }}
            >
              <Refresh />
            </IconButton>
          </Box>

          {/* Address Alert - Only for clients */}
          {profile?.client && <AddressAlert />}
        </Box>

        {/* Stats Cards */}
        {loading ? (
          <Grid container spacing={2} sx={{ mb: 4 }}>
            {[1, 2, 3, 4].map((i) => (
              <Grid key={i} size={{ xs: 6, sm: 6, md: 3 }}>
                <StatsCardSkeleton />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid size={{ xs: 6, sm: 6, md: 3 }}>
              <Card
                sx={{
                  height: '100%',
                  bgcolor: 'primary.50',
                  borderLeft: 4,
                  borderColor: 'primary.main',
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 1,
                    }}
                  >
                    <ShoppingBag color="primary" sx={{ fontSize: 40 }} />
                    <Typography variant="h4" fontWeight="bold" color="primary">
                      {orderStats.total}
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    fontWeight="medium"
                  >
                    {t('orders.stats.total', 'Total Orders')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 6, sm: 6, md: 3 }}>
              <Card
                sx={{
                  height: '100%',
                  bgcolor: 'warning.50',
                  borderLeft: 4,
                  borderColor: 'warning.main',
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 1,
                    }}
                  >
                    <HourglassEmpty color="warning" sx={{ fontSize: 40 }} />
                    <Typography
                      variant="h4"
                      fontWeight="bold"
                      color="warning.main"
                    >
                      {orderStats.pending}
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    fontWeight="medium"
                  >
                    {t('orders.stats.pending', 'Pending')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 6, sm: 6, md: 3 }}>
              <Card
                sx={{
                  height: '100%',
                  bgcolor: 'info.50',
                  borderLeft: 4,
                  borderColor: 'info.main',
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 1,
                    }}
                  >
                    <LocalShipping color="info" sx={{ fontSize: 40 }} />
                    <Typography
                      variant="h4"
                      fontWeight="bold"
                      color="info.main"
                    >
                      {orderStats.active}
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    fontWeight="medium"
                  >
                    {t('orders.stats.active', 'Active')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 6, sm: 6, md: 3 }}>
              <Card
                sx={{
                  height: '100%',
                  bgcolor: 'success.50',
                  borderLeft: 4,
                  borderColor: 'success.main',
                }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: 1,
                    }}
                  >
                    <CheckCircle color="success" sx={{ fontSize: 40 }} />
                    <Typography
                      variant="h4"
                      fontWeight="bold"
                      color="success.main"
                    >
                      {orderStats.delivered}
                    </Typography>
                  </Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    fontWeight="medium"
                  >
                    {t('orders.stats.delivered', 'Delivered')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Desktop Filters */}
        <Paper sx={{ p: 3, mb: 3, display: { xs: 'none', md: 'block' } }}>
          <FiltersContent />
        </Paper>

        {/* Mobile Filter Button */}
        <Box sx={{ mb: 2, display: { xs: 'block', md: 'none' } }}>
          <Button
            variant="outlined"
            fullWidth
            startIcon={<FilterList />}
            onClick={() => setFilterDrawerOpen(true)}
            endIcon={
              filters.search ||
              filters.status ||
              filters.dateFrom ||
              filters.dateTo ? (
                <Badge color="primary" variant="dot" />
              ) : null
            }
          >
            {t('orders.filters.title', 'Filters')}
          </Button>
        </Box>

        {/* Mobile Filter Drawer */}
        <Drawer
          anchor="bottom"
          open={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
          PaperProps={{
            sx: {
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: '85vh',
            },
          }}
        >
          <Box sx={{ p: 3 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3,
              }}
            >
              <Typography variant="h6" fontWeight="bold">
                {t('orders.filters.title', 'Filters')}
              </Typography>
              <IconButton
                onClick={() => setFilterDrawerOpen(false)}
                size="small"
              >
                <Close />
              </IconButton>
            </Box>
            <FiltersContent />
          </Box>
        </Drawer>

        {/* Error Display */}
        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => refreshOrders()}
              >
                {t('common.retry', 'Retry')}
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {/* Orders List */}
        {loading ? (
          <Box>
            {[1, 2, 3].map((i) => (
              <OrderCardSkeleton key={i} />
            ))}
          </Box>
        ) : orders.length === 0 ? (
          <Paper
            sx={{
              p: 6,
              textAlign: 'center',
              bgcolor: 'grey.50',
              border: '2px dashed',
              borderColor: 'grey.300',
            }}
          >
            <ShoppingBag sx={{ fontSize: 80, color: 'grey.400', mb: 2 }} />
            <Typography variant="h5" gutterBottom fontWeight="bold">
              {t('orders.noOrdersFound', 'No Orders Yet')}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {t(
                'orders.noOrdersMessage',
                'When you place an order, it will appear here'
              )}
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => (window.location.href = '/items')}
            >
              {t('orders.browseItems', 'Browse Items')}
            </Button>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Active Orders */}
            {activeStatuses.map((statusKey) => (
              <Box key={statusKey} sx={{ width: '100%' }}>
                <Paper
                  sx={{
                    p: 2,
                    mb: 2,
                    bgcolor: 'primary.50',
                    borderLeft: 4,
                    borderColor: 'primary.main',
                  }}
                >
                  <Typography variant="h6" fontWeight="bold" color="primary">
                    {t(`common.orderStatus.${statusKey}`)}
                    <Chip
                      label={groupedByStatus[statusKey]?.length || 0}
                      size="small"
                      color="primary"
                      sx={{ ml: 1 }}
                    />
                  </Typography>
                </Paper>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {(groupedByStatus[statusKey] || []).map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </Box>
              </Box>
            ))}

            {/* Completed/Cancelled Orders - Collapsible */}
            {completedOrdersCount > 0 && (
              <Paper
                sx={{
                  mt: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  overflow: 'hidden',
                }}
              >
                <Button
                  fullWidth
                  onClick={() => setShowCompletedOrders(!showCompletedOrders)}
                  sx={{
                    p: 2.5,
                    justifyContent: 'space-between',
                    textTransform: 'none',
                    bgcolor: 'grey.50',
                    '&:hover': {
                      bgcolor: 'grey.100',
                    },
                  }}
                  endIcon={
                    showCompletedOrders ? <ExpandLess /> : <ExpandMore />
                  }
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Cancel color="action" />
                    <Typography variant="h6" fontWeight="bold">
                      {t(
                        'orders.completedAndCancelled',
                        'Completed & Cancelled Orders'
                      )}
                    </Typography>
                    <Chip
                      label={completedOrdersCount}
                      size="small"
                      color="default"
                    />
                  </Box>
                </Button>
                <Collapse in={showCompletedOrders}>
                  <Box sx={{ p: 3 }}>
                    {completedStatuses.map((statusKey) => (
                      <Box key={statusKey} sx={{ width: '100%', mb: 3 }}>
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            mb: 2,
                            bgcolor: 'grey.50',
                          }}
                        >
                          <Typography variant="subtitle1" fontWeight="medium">
                            {t(`common.orderStatus.${statusKey}`)}
                            <Chip
                              label={groupedByStatus[statusKey]?.length || 0}
                              size="small"
                              sx={{ ml: 1 }}
                            />
                          </Typography>
                        </Paper>
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
