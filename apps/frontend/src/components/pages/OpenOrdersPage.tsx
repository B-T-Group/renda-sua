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
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOpenOrders } from '../../hooks/useOpenOrders';
import AvailableOrderCard from '../common/AvailableOrderCard';
import OrderCard from '../common/OrderCard';
import AgentOrderAlerts from '../orders/AgentOrderAlerts';
import SEOHead from '../seo/SEOHead';

interface OrderFilters {
  search: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

const OpenOrdersPage: React.FC = () => {
  const { t } = useTranslation();

  const { openOrders: orders, loading, error, refetch } = useOpenOrders();

  const [filters, setFilters] = useState<OrderFilters>({
    search: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  });
  const [showCompletedOrders, setShowCompletedOrders] = useState(false);

  const handleFilterChange = (newFilters: Partial<OrderFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleApplyFilters = () => {
    // For open orders, we don't need complex filtering since they're all available
    // But we can still filter by search term locally
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      search: '',
      status: '',
      dateFrom: '',
      dateTo: '',
    };
    setFilters(clearedFilters);
  };

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Filter orders based on search term
  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    let filtered = orders;

    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.order_number?.toLowerCase().includes(searchTerm) ||
          order.business?.name?.toLowerCase().includes(searchTerm) ||
          order.client?.user?.first_name?.toLowerCase().includes(searchTerm) ||
          order.client?.user?.last_name?.toLowerCase().includes(searchTerm)
      );
    }

    return filtered;
  }, [orders, filters.search]);

  // Separate available and claimed orders, prioritizing fast delivery
  const { availableOrders, claimedOrders } = useMemo(() => {
    const available = filteredOrders
      .filter(
        (order) =>
          order.current_status === 'ready_for_pickup' &&
          !order.assigned_agent_id
      )
      .sort((a, b) => {
        // Fast delivery orders first
        if (a.requires_fast_delivery && !b.requires_fast_delivery) return -1;
        if (!a.requires_fast_delivery && b.requires_fast_delivery) return 1;

        // If both have same fast delivery status, sort by creation date (newest first)
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });

    const claimed = filteredOrders
      .filter(
        (order) =>
          order.current_status === 'ready_for_pickup' && order.assigned_agent_id
      )
      .sort((a, b) => {
        // Fast delivery orders first
        if (a.requires_fast_delivery && !b.requires_fast_delivery) return -1;
        if (!a.requires_fast_delivery && b.requires_fast_delivery) return 1;

        // If both have same fast delivery status, sort by creation date (newest first)
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });

    return { availableOrders: available, claimedOrders: claimed };
  }, [filteredOrders]);

  const getPageTitle = () => {
    return t('agent.openOrders.title', 'Available Orders');
  };

  const getPageSubtitle = () => {
    return t(
      'agent.openOrders.subtitle',
      'Find and claim orders ready for pickup and delivery'
    );
  };

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
          Error loading data:{' '}
          {typeof error === 'string' ? error : (error as any)?.message}
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

        {/* Available Orders */}
        {availableOrders.length === 0 && claimedOrders.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              {t(
                'agent.openOrders.noOrdersFound',
                'No orders available for pickup'
              )}
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Available Orders */}
            {availableOrders.length > 0 && (
              <Box sx={{ width: '100%' }}>
                <Typography variant="h5" sx={{ mb: 2, color: 'success.main' }}>
                  {t('agent.openOrders.available', 'Available Orders')} (
                  {availableOrders.length})
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {availableOrders.map((order) => (
                    <Box key={order.id}>
                      {/* Agent-specific alerts for available orders */}
                      <AgentOrderAlerts order={order} />
                      <AvailableOrderCard order={order} />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Claimed Orders - Collapsible */}
            {claimedOrders.length > 0 && (
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
                    {t('agent.openOrders.claimed', 'Already Claimed Orders')} (
                    {claimedOrders.length})
                  </Typography>
                </Button>
                <Collapse in={showCompletedOrders}>
                  <Box sx={{ p: 2, pt: 0 }}>
                    <Box
                      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
                    >
                      {claimedOrders.map((order) => (
                        <OrderCard key={order.id} order={order} />
                      ))}
                    </Box>
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

export default OpenOrdersPage;
