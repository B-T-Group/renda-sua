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
import { Link } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAgentHasIdDocument } from '../../hooks/useAgentHasIdDocument';
import { useOpenOrders } from '../../hooks/useOpenOrders';
import { useStripeConnect } from '../../hooks/useStripeConnect';
import { orderModifiedAtMs } from '../../utils/orderListSort';
import AvailableOrderCard from '../common/AvailableOrderCard';
import OrderCard from '../common/OrderCard';
import SEOHead from '../seo/SEOHead';

interface OrderFilters {
  search: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

const OpenOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { profile, refetch: refetchProfile } = useUserProfileContext();
  const { openOrders: orders, loading, error, refetch, canClaim: ordersCanClaim, previewMode } = useOpenOrders();
  const { hasIdDocument } = useAgentHasIdDocument(profile?.user_type_id);
  const {
    status: connectStatus,
    loading: connectLoading,
    startOnboarding,
  } = useStripeConnect();

  const isAgent = Boolean(profile?.agent);
  const isStripeRail = connectStatus?.paymentRail === 'stripe';
  const stripeReady =
    !!connectStatus?.connected &&
    (connectStatus?.status === 'active' ||
      (!!connectStatus?.chargesEnabled && !!connectStatus?.payoutsEnabled));

  // When the agent returns from Stripe onboarding and the account is active,
  // the backend has flipped is_verified; refresh profile and open orders so
  // canClaim and the order list match verification state.
  useEffect(() => {
    if (isAgent && stripeReady && profile?.agent?.is_verified === false) {
      void refetchProfile();
    }
  }, [isAgent, stripeReady, profile?.agent?.is_verified, refetchProfile]);

  const prevStripeReadyRef = React.useRef(stripeReady);
  useEffect(() => {
    const wasReady = prevStripeReadyRef.current === true;
    prevStripeReadyRef.current = stripeReady;
    if (isAgent && stripeReady && !wasReady) {
      void refetch();
    }
  }, [isAgent, stripeReady, refetch]);

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
          orderModifiedAtMs(b) - orderModifiedAtMs(a)
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
          orderModifiedAtMs(b) - orderModifiedAtMs(a)
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
      <Container
        maxWidth="lg"
        sx={{ mt: 4, mb: 4, px: { xs: 0, sm: 2 } }}
      >
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
      <Container
        maxWidth="lg"
        sx={{ mt: 4, mb: 4, px: { xs: 0, sm: 2 } }}
      >
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
      <Container
        maxWidth="lg"
        sx={{ mt: 4, mb: 4, px: { xs: 0, sm: 2 } }}
      >
        {profile?.agent?.status === 'suspended' && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {t(
              'agent.suspendedBanner',
              'Your account is suspended. You cannot claim new orders. If you believe this is an error, please contact support.'
            )}
          </Alert>
        )}
        {isAgent &&
          !profile?.agent?.is_verified &&
          profile?.agent?.status !== 'suspended' &&
          ordersCanClaim === false &&
          availableOrders.length > 0 &&
          previewMode === 'country' &&
          !(isStripeRail && stripeReady) && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {t(
                'agent.openOrders.previewBanner',
                'These deliveries are available in your country. Complete verification to claim them.'
              )}
              <Box component="span" sx={{ display: 'block', mt: 1 }}>
                {isStripeRail ? (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={startOnboarding}
                    disabled={connectLoading}
                  >
                    {t('agent.openOrders.completeSetupToClaim', 'Complete setup to claim')}
                  </Button>
                ) : (
                  <Button component={Link} to="/documents" variant="outlined" size="small">
                    {t('agent.openOrders.completeSetupToClaim', 'Complete setup to claim')}
                  </Button>
                )}
              </Box>
            </Alert>
          )}
        {isAgent &&
          !profile?.agent?.is_verified &&
          profile?.agent?.status !== 'suspended' &&
          !(isStripeRail && stripeReady) &&
          !(ordersCanClaim === false && availableOrders.length > 0) &&
          (isStripeRail ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              {connectStatus?.connected
                ? t(
                    'agent.openOrders.stripeUnderReview',
                    'Your Stripe account is being reviewed. Complete setup to claim deliveries.'
                  )
                : t(
                    'agent.openOrders.connectStripeToGetVerified',
                    'Connect your Stripe account to get verified and start claiming deliveries.'
                  )}
              <Box component="span" sx={{ display: 'block', mt: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={startOnboarding}
                  disabled={connectLoading}
                >
                  {connectStatus?.connected
                    ? t('agent.openOrders.continueStripeSetup', 'Continue setup')
                    : t('agent.openOrders.setUpPayouts', 'Set up payouts')}
                </Button>
              </Box>
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              {hasIdDocument
                ? t(
                    'agent.openOrders.accountUnderReview',
                    'Your account is under review. You can claim deliveries once verified.'
                  )
                : t(
                    'agent.openOrders.uploadIdToGetVerified',
                    'Upload an ID to get verified and start claiming deliveries.'
                  )}
              {!hasIdDocument && (
                <Box component="span" sx={{ display: 'block', mt: 1 }}>
                  <Button
                    component={Link}
                    to="/documents"
                    variant="outlined"
                    size="small"
                  >
                    {t('agent.openOrders.goToDocuments', 'Go to Documents')}
                  </Button>
                </Box>
              )}
            </Alert>
          ))}
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
                    <AvailableOrderCard
                      key={order.id}
                      order={order}
                      onClaimSuccess={refetch}
                      isStripeRail={isStripeRail}
                      canClaimOrders={ordersCanClaim || (isStripeRail && stripeReady)}
                    />
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
