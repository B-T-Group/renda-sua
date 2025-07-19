import { useAuth0 } from '@auth0/auth0-react';
import { Inventory } from '@mui/icons-material';
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
} from '../../hooks';
import { useDistanceMatrix } from '../../hooks/useDistanceMatrix';
import AccountInformation from '../common/AccountInformation';
import AddressAlert from '../common/AddressAlert';
import DashboardItemCard from '../common/DashboardItemCard';
import OrderDialog from '../dialogs/OrderDialog';

const Dashboard: React.FC = () => {
  const { user } = useAuth0();
  const {
    inventoryItems,
    loading: inventoryLoading,
    error: inventoryError,
  } = useInventoryItems();
  const {
    accounts,
    loading: accountLoading,
    error: accountError,
  } = useAccountInfo();
  const {
    deliveryFees,
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
  const [orderSuccess, setOrderSuccess] = useState(false);

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
  }, [destinationAddressIds.join(',')]);

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
      };

      await createOrder(orderData);
      setOrderSuccess(true);
      setOrderDialogOpen(false);
      setTimeout(() => setOrderSuccess(false), 3000);
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

  if (inventoryLoading || accountLoading || deliveryFeesLoading) {
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

  if (inventoryError || accountError || deliveryFeesError) {
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
      {/* Success Alert */}
      {orderSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Order placed successfully! You will receive a confirmation shortly.
        </Alert>
      )}

      {/* Error Alert */}
      {orderError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {orderError}
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Client Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Welcome back, {user?.name}! Browse available items and manage your
          orders.
        </Typography>
      </Box>

      {/* Address Alert */}
      <AddressAlert />

      {/* Account Information */}
      <AccountInformation
        accounts={accounts}
        onTopUpClick={handleTopUpClick}
        formatCurrency={formatCurrency}
      />

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
            {inventoryItems.map((item) => {
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
            })}
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
    </Container>
  );
};

export default Dashboard;
