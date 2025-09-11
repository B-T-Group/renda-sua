import { useAuth0 } from '@auth0/auth0-react';
import { Assignment, Inventory } from '@mui/icons-material';
import {
  Alert,
  Box,
  CircularProgress,
  Container,
  Paper,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useBackendOrders,
  useDeliveryFees,
  useInventoryItems,
  useOrders,
} from '../../hooks';
import { useDistanceMatrix } from '../../hooks/useDistanceMatrix';
import { InventoryItem } from '../../hooks/useInventoryItems';
import { useUserProfile } from '../../hooks/useUserProfile';
import AddressAlert from '../common/AddressAlert';
import DashboardItemCard from '../common/DashboardItemCard';
import ItemsFilter from '../common/ItemsFilter';
import OrderActionCard from '../common/OrderActionCard';
import StatusBadge from '../common/StatusBadge';
import OrderConfirmationModal from '../dialogs/OrderConfirmationModal';

const Dashboard: React.FC = () => {
  const { user } = useAuth0();
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const {
    inventoryItems,
    loading: inventoryLoading,
    error: inventoryError,
  } = useInventoryItems();
  const { orders } = useOrders();
  const { loading: deliveryFeesLoading, error: deliveryFeesError } =
    useDeliveryFees();
  const { error: orderError } = useBackendOrders();

  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);

  // Aggregate unique destination address IDs from inventoryItems
  const destinationAddressIds = React.useMemo(() => {
    return Array.from(
      new Set(
        (inventoryItems || [])
          .map((item) => item.business_location?.address?.id)
          .filter(Boolean)
      )
    );
  }, [inventoryItems]);

  const {
    data: distanceData,
    loading: distanceLoading,
    error: distanceError,
    fetchDistanceMatrix,
  } = useDistanceMatrix();

  React.useEffect(() => {
    if (destinationAddressIds.length > 0) {
      fetchDistanceMatrix({ destination_address_ids: destinationAddressIds });
    }
  }, [destinationAddressIds]);

  // Initialize filtered items when inventory items change
  React.useEffect(() => {
    // TODO: When order history is available, prioritize delivered items
    // For now, sort items alphabetically by name
    const sortedItems = [...inventoryItems].sort((a, b) =>
      (a.item?.name || '').localeCompare(b.item?.name || '')
    );
    setFilteredItems(sortedItems);
  }, [inventoryItems]);

  // Filter orders that require action based on user type and status
  const ordersRequiringAction = React.useMemo(() => {
    if (!orders || !profile?.user_type_id) return [];

    const userType = profile.user_type_id;

    return orders.filter((order) => {
      const status = order.current_status;

      switch (userType) {
        case 'business':
          return ['pending', 'preparing', 'delivered'].includes(status);
        case 'client':
          return ['delivered'].includes(status);
        case 'agent':
          return (
            (status === 'ready_for_pickup' && !order.assigned_agent_id) ||
            ['picked_up', 'in_transit'].includes(status)
          );
        default:
          return false;
      }
    });
  }, [orders, profile?.user_type_id]);

  // Helper to get distance/duration for an item
  const getItemDistanceInfo = (item: any) => {
    if (!distanceData || !item.business_location?.address?.id) return null;
    const idx = distanceData.destination_ids.indexOf(
      item.business_location.address.id
    );
    if (idx === -1 || !distanceData.rows[0]?.elements[idx]) return null;
    const el = distanceData.rows[0].elements[idx];
    if (el.status !== 'OK') return null;
    return {
      distance: el.distance?.text,
      duration: el.duration?.text,
    };
  };

  const handleOrderClick = (item: any) => {
    navigate(`/items/${item.id}/place_order`);
  };

  const handleTopUpClick = () => {
    // Navigate to profile page for account management
    window.location.href = '/profile';
  };

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  if (inventoryLoading || deliveryFeesLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
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

  if (inventoryError || deliveryFeesError) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Error loading data. Please try refreshing the page.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 } }}>
      {/* Error Alert */}
      {orderError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {orderError}
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ mb: { xs: 3, sm: 4 } }}>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            mb: 2,
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              mb: 0,
              fontSize: { xs: '1.75rem', sm: '2.125rem' },
            }}
          >
            Client Dashboard
          </Typography>
          {user?.email_verified && <StatusBadge type="verified" />}
        </Box>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}
        >
          Welcome back,{' '}
          {`${user?.first_name || ''} ${user?.last_name || ''}`.trim() ||
            user?.email}
          ! Browse available items and manage your orders.
        </Typography>
      </Box>

      {/* Address Alert */}
      <AddressAlert />

      {/* Orders Requiring Action */}
      {ordersRequiringAction.length > 0 && (
        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              fontSize: { xs: '1.1rem', sm: '1.25rem' },
            }}
          >
            <Assignment color="primary" />
            Orders Requiring Action ({ordersRequiringAction.length})
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
              },
              gap: { xs: 2, sm: 3 },
            }}
          >
            {ordersRequiringAction.map((order) => (
              <OrderActionCard
                key={order.id}
                order={order}
                userType={
                  profile?.user_type_id as 'client' | 'business' | 'agent'
                }
                formatCurrency={formatCurrency}
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* Inventory Items */}
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography
          variant="h6"
          gutterBottom
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            fontSize: { xs: '1.1rem', sm: '1.25rem' },
          }}
        >
          <Inventory color="primary" />
          Available Items
        </Typography>

        {/* Filter Component */}
        {inventoryItems.length > 0 && (
          <ItemsFilter
            items={inventoryItems}
            onFilterChange={setFilteredItems}
            loading={inventoryLoading}
          />
        )}

        {inventoryItems.length === 0 ? (
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="200px"
            sx={{ p: { xs: 2, sm: 0 } }}
          >
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ textAlign: 'center' }}
            >
              No items available at the moment.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(4, 1fr)',
              },
              gap: { xs: 2, sm: 3 },
            }}
          >
            {(filteredItems.length > 0 ? filteredItems : inventoryItems).map(
              (item) => {
                const distanceInfo = getItemDistanceInfo(item);
                return (
                  <DashboardItemCard
                    key={item.id}
                    item={item}
                    formatCurrency={formatCurrency}
                    onOrderClick={handleOrderClick}
                    estimatedDistance={distanceInfo?.distance}
                    estimatedDuration={distanceInfo?.duration}
                    distanceLoading={distanceLoading}
                    distanceError={distanceError}
                  />
                );
              }
            )}
          </Box>
        )}
      </Paper>

      <OrderConfirmationModal
        open={confirmationModalOpen}
        onClose={() => setConfirmationModalOpen(false)}
        orderNumber={undefined}
      />
    </Container>
  );
};

export default Dashboard;
