import { Search as SearchIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
import { useAccountInfo } from '../../hooks';
import { useClientOrders } from '../../hooks/useClientOrders';
import { useUserProfile } from '../../hooks/useUserProfile';
import AccountInformation from '../common/AccountInformation';
import AddressAlert from '../common/AddressAlert';
import OrderCard from '../common/OrderCard';
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

  const { orders, loading, error, fetchOrders, refreshOrders } =
    useClientOrders(profile?.client?.id);

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

        {/* Account Information */}
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
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
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
                  {(groupedByStatus[statusKey] || []).map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Container>
    </>
  );
};

export default ClientOrders;
