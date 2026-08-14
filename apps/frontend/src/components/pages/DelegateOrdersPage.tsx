import {
  Alert,
  Box,
  Button,
  Container,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { OrdersApiPrefixProvider } from '../../contexts/OrdersApiPrefixContext';
import { useDelegateOrders } from '../../hooks/useDelegateOrders';
import {
  BUSINESS_ORDER_QUEUE_FILTERS,
  matchesBusinessOrderQueue,
  orderToPhaseInput,
  type BusinessOrderQueue,
} from '../../utils/orderPhase';
import { sortOrdersByModifiedDesc } from '../../utils/orderListSort';
import PersonaOrderCard from '../orders/PersonaOrderCard';
import LoadingPage from '../common/LoadingPage';
import { DELEGATION_PERMISSIONS } from '../../types/delegation';

const QUEUE_LABELS: Record<BusinessOrderQueue, [string, string]> = {
  confirm: ['orders.queue.confirm', 'Confirm'],
  prep: ['orders.queue.prep', 'Prep'],
  pickup: ['orders.queue.pickup', 'Pickup'],
  issues: ['orders.queue.issues', 'Issues'],
  all: ['orders.queue.all', 'All'],
};

const DelegateOrdersPageInner: React.FC = () => {
  const { t } = useTranslation();
  const { isDelegationContext, activeDelegation } = useUserProfileContext();
  const { orders, loading, error, refreshOrders } = useDelegateOrders({
    enabled: isDelegationContext,
  });
  const [queue, setQueue] = useState<BusinessOrderQueue>('confirm');
  const [search, setSearch] = useState('');

  const canRead = activeDelegation?.permissions?.includes(
    DELEGATION_PERMISSIONS.ORDERS_READ
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortOrdersByModifiedDesc(
      orders.filter((order) => {
        if (
          !matchesBusinessOrderQueue(
            orderToPhaseInput(order as never),
            queue
          )
        ) {
          return false;
        }
        if (!q) return true;
        return (
          order.order_number?.toLowerCase().includes(q) ||
          order.client?.user?.first_name?.toLowerCase().includes(q) ||
          order.client?.user?.last_name?.toLowerCase().includes(q)
        );
      })
    );
  }, [orders, queue, search]);

  if (!isDelegationContext) {
    return <Navigate to="/select-persona" replace />;
  }

  if (!canRead && activeDelegation) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning">
          {t(
            'delegation.orders.noPermission',
            'You do not have permission to view orders for this location.'
          )}
        </Alert>
      </Container>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <LoadingPage
        message={t('delegation.orders.loading', 'Loading location orders')}
        subtitle={t('common.pleaseWait', 'Please wait')}
        showProgress
      />
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1.5}
        sx={{ mb: 2 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800}>
            {t('delegation.orders.title', 'Location orders')}
          </Typography>
          <Typography color="text.secondary">
            {activeDelegation
              ? `${activeDelegation.locationName} · ${activeDelegation.businessName}`
              : null}
          </Typography>
        </Box>
        <Button
          startIcon={<RefreshIcon />}
          variant="outlined"
          onClick={() => void refreshOrders()}
        >
          {t('common.refresh', 'Refresh')}
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TextField
        size="small"
        fullWidth
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t(
          'delegation.orders.search',
          'Search by order number or client'
        )}
        sx={{ mb: 2 }}
      />

      <Tabs
        value={queue}
        onChange={(_, v) => setQueue(v as BusinessOrderQueue)}
        variant="scrollable"
        allowScrollButtonsMobile
        sx={{ mb: 2 }}
      >
        {BUSINESS_ORDER_QUEUE_FILTERS.map((key) => (
          <Tab
            key={key}
            value={key}
            label={t(QUEUE_LABELS[key][0], QUEUE_LABELS[key][1])}
          />
        ))}
      </Tabs>

      {filtered.length === 0 ? (
        <Alert severity="info">
          {t('delegation.orders.empty', 'No orders in this queue')}
        </Alert>
      ) : (
        <Stack spacing={2}>
          {filtered.map((order) => (
            <PersonaOrderCard
              key={order.id}
              order={order as never}
              forcePersona="business"
              detailBasePath="/delegate/orders"
              onActionComplete={() => void refreshOrders()}
            />
          ))}
        </Stack>
      )}
    </Container>
  );
};

const DelegateOrdersPage: React.FC = () => (
  <OrdersApiPrefixProvider value="/delegate">
    <DelegateOrdersPageInner />
  </OrdersApiPrefixProvider>
);

export default DelegateOrdersPage;
