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
import React, { useMemo, useState } from 'react';
import {
  useAccountInfo,
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
import OrderDialog from '../dialogs/OrderDialog';

const Dashboard: React.FC = () => {
  const { user } = useAuth0();
  const { profile } = useUserProfile();
  const {
    inventoryItems,
    loading: inventoryLoading,
    error: inventoryError,
  } = useInventoryItems();
  const { accounts } = useAccountInfo();
  const { orders, loading: ordersLoading, error: ordersError } = useOrders();
  const {
    loading: deliveryFeesLoading,
    error: deliveryFeesError,
    getDeliveryFeeForCurrency,
  } = useDeliveryFees();
  const {
    createOrder,
    loading: orderLoading,
    error: orderError,
  } = useBackendOrders();

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [verifiedAgentDelivery, setVerifiedAgentDelivery] = useState(false);
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);

  // Assume USD as default currency for items since business_inventory doesn't have currency field
  const DEFAULT_ITEM_CURRENCY = 'USD';

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
          return ['delivered', 'cancelled'].includes(status);
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

  // Memoized function to check if user can afford an item
  const canAffordItem = useMemo(() => {
    return (item: any) => {
      const itemPrice = item.selling_price;
      const itemCurrency = DEFAULT_ITEM_CURRENCY;

      // Find account with matching currency
      const matchingAccount = accounts.find(
        (account) => account.currency === itemCurrency
      );

      if (!matchingAccount) {
        return false; // No account with matching currency
      }

      return matchingAccount.available_balance >= itemPrice;
    };
  }, [accounts]);

  // Memoized function to get account for item currency
  const getAccountForCurrency = useMemo(() => {
    return (currency: string) => {
      return accounts.find((account) => account.currency === currency);
    };
  }, [accounts]);

  // Memoized function to get insufficient funds message
  const getInsufficientFundsMessage = useMemo(() => {
    return (item: any) => {
      const itemPrice = item.selling_price;
      const itemCurrency = DEFAULT_ITEM_CURRENCY;
      const account = getAccountForCurrency(itemCurrency);

      if (!account) {
        return `No ${itemCurrency} account found. Please add a ${itemCurrency} account to your profile.`;
      }

      const shortfall = itemPrice - account.available_balance;
      return `Insufficient funds. You need ${formatCurrency(
        shortfall,
        itemCurrency
      )} more to order this item.`;
    };
  }, [accounts, getAccountForCurrency]);

  const handleOrderClick = (item: any) => {
    setSelectedItem(item);
    setOrderDialogOpen(true);
    setQuantity(1);
    setSpecialInstructions('');
    setVerifiedAgentDelivery(false);
  };

  const handleTopUpClick = () => {
    // Navigate to profile page for account management
    window.location.href = '/profile';
  };

  const handleOrderSubmit = async () => {
    if (!selectedItem || quantity <= 0) return;

    try {
      // Use the new backend API format with business_inventory_id and single item
      const orderData = {
        item: {
          business_inventory_id: selectedItem.id,
          quantity: quantity,
        },
        special_instructions: specialInstructions,
        verified_agent_delivery: verifiedAgentDelivery,
      };

      const result = await createOrder(orderData);
      // The order number might not be available in the basic OrderResult
      // We'll show the confirmation without the specific order number
      setOrderDialogOpen(false);
      setConfirmationModalOpen(true);
    } catch (error) {
      console.error('Error creating order:', error);
    }
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
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Error Alert */}
      {orderError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {orderError}
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 0 }}>
            Client Dashboard
          </Typography>
          {user?.email_verified && <StatusBadge type="verified" />}
        </Box>
        <Typography variant="body1" color="text.secondary">
          Welcome back, {user?.name}! Browse available items and manage your
          orders.
        </Typography>
      </Box>

      {/* Address Alert */}
      <AddressAlert />

      {/* Orders Requiring Action */}
      {ordersRequiringAction.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
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
              gap: 3,
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
      <Paper sx={{ p: 3 }}>
        <Typography
          variant="h6"
          gutterBottom
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
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
          >
            <Typography variant="body1" color="text.secondary">
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
              gap: 3,
            }}
          >
            {(filteredItems.length > 0 ? filteredItems : inventoryItems).map(
              (item) => {
                const canAfford = canAffordItem(item);
                const account = getAccountForCurrency(DEFAULT_ITEM_CURRENCY);
                const distanceInfo = getItemDistanceInfo(item);
                return (
                  <DashboardItemCard
                    key={item.id}
                    item={item}
                    canAfford={canAfford}
                    account={account}
                    insufficientFundsMessage={getInsufficientFundsMessage(item)}
                    formatCurrency={formatCurrency}
                    onOrderClick={handleOrderClick}
                    onTopUpClick={handleTopUpClick}
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

      {/* Order Dialog */}
      <OrderDialog
        open={orderDialogOpen}
        onClose={() => setOrderDialogOpen(false)}
        selectedItem={selectedItem}
        quantity={quantity}
        specialInstructions={specialInstructions}
        orderLoading={orderLoading}
        formatCurrency={formatCurrency}
        deliveryFee={
          selectedItem ? getDeliveryFeeForCurrency(DEFAULT_ITEM_CURRENCY) : null
        }
        onQuantityChange={setQuantity}
        onSpecialInstructionsChange={setSpecialInstructions}
        onSubmit={handleOrderSubmit}
      />

      <OrderConfirmationModal
        open={confirmationModalOpen}
        onClose={() => setConfirmationModalOpen(false)}
        orderNumber={selectedItem?.order_number}
      />
    </Container>
  );
};

export default Dashboard;
