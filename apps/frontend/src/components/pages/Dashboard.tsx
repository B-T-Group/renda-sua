import { useAuth0 } from '@auth0/auth0-react';
import {
  AccountBalance,
  AccountBalanceWallet,
  Category,
  Inventory,
  LocationOn,
  ShoppingCart,
  Warning,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useAccountInfo, useCreateOrder, useInventoryItems } from '../../hooks';

const Dashboard: React.FC = () => {
  const { user } = useAuth0();
  const {
    inventoryItems,
    loading: inventoryLoading,
    error: inventoryError,
  } = useInventoryItems();
  const {
    accounts,
    clientInfo,
    loading: accountLoading,
    error: accountError,
  } = useAccountInfo();
  const { createOrderWithItems, loading: orderLoading } = useCreateOrder();

  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Assume USD as default currency for items since business_inventory doesn't have currency field
  const DEFAULT_ITEM_CURRENCY = 'USD';

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
      const orderData = {
        client_id: clientInfo[0]?.id || '',
        business_id: selectedItem.business_location.business_id,
        business_location_id: selectedItem.business_location_id,
        delivery_address_id: '', // This should be set from user's address
        subtotal: selectedItem.selling_price * quantity,
        delivery_fee: 0, // This should be calculated based on distance
        tax_amount: 0, // This should be calculated
        total_amount: selectedItem.selling_price * quantity,
        currency: DEFAULT_ITEM_CURRENCY,
        special_instructions: specialInstructions,
        payment_method: 'cash_on_delivery',
        payment_status: 'pending',
      };

      const orderItemData = {
        business_inventory_id: selectedItem.id,
        item_id: selectedItem.item.id,
        item_name: selectedItem.item.name,
        item_description: selectedItem.item.description,
        unit_price: selectedItem.selling_price,
        quantity,
        weight: selectedItem.item.weight,
        weight_unit: selectedItem.item.weight_unit,
        dimensions: `${selectedItem.item.size} ${selectedItem.item.size_unit}`,
        special_instructions: specialInstructions,
      };

      await createOrderWithItems(orderData, [orderItemData]);
      setOrderSuccess(true);
      setOrderDialogOpen(false);
      setTimeout(() => setOrderSuccess(false), 3000);
    } catch (error) {
      console.error('Error creating order:', error);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getPrimaryImage = (item: any) => {
    // Look for main image first, then fall back to first image
    const mainImage = item.item.item_images?.find(
      (img: any) => img.image_type === 'main'
    );
    const firstImage = item.item.item_images?.[0];
    return (
      mainImage?.image_url || firstImage?.image_url || '/placeholder-item.jpg'
    );
  };

  if (inventoryLoading || accountLoading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading your dashboard...
        </Typography>
      </Container>
    );
  }

  // Show error state if there are critical errors
  if (inventoryError && accountError) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          Unable to load dashboard data. Please try refreshing the page.
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

      {/* Account Information */}
      {accounts.length > 0 && (
        <Paper sx={{ p: 3, mb: 4 }}>
          <Typography
            variant="h6"
            gutterBottom
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <AccountBalance color="primary" />
            Account Information
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
            {accounts.map((account) => (
              <Card key={account.id} variant="outlined">
                <CardContent>
                  <Typography variant="h6" color="primary" gutterBottom>
                    {account.currency} Account
                  </Typography>
                  <Typography variant="h4" component="div" gutterBottom>
                    {formatCurrency(
                      account.available_balance,
                      account.currency
                    )}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Available Balance
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total:{' '}
                    {formatCurrency(account.total_balance, account.currency)}
                  </Typography>
                  <Chip label={account.currency} size="small" sx={{ mt: 1 }} />
                </CardContent>
                <CardActions>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<AccountBalanceWallet />}
                    fullWidth
                    onClick={handleTopUpClick}
                    size="small"
                  >
                    Top Up Account
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Box>
        </Paper>
      )}

      {/* Inventory Items */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography
          variant="h6"
          gutterBottom
          sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <Inventory color="primary" />
          Available Items
        </Typography>

        {inventoryError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Error loading inventory:{' '}
            {typeof inventoryError === 'string'
              ? inventoryError
              : 'Unknown error'}
          </Alert>
        )}

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
          {inventoryItems.map((item) => {
            const canAfford = canAffordItem(item);
            const account = getAccountForCurrency(DEFAULT_ITEM_CURRENCY);

            return (
              <Card
                key={item.id}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardMedia
                  component="img"
                  height="200"
                  image={getPrimaryImage(item)}
                  alt={item.item.name}
                  sx={{ objectFit: 'cover' }}
                />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    {item.item.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {item.item.description}
                  </Typography>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h5" color="primary" gutterBottom>
                      {formatCurrency(item.selling_price)}
                    </Typography>
                    <Chip
                      label={`${item.available_quantity} available`}
                      color={item.available_quantity > 0 ? 'success' : 'error'}
                      size="small"
                    />
                  </Box>

                  {/* Fund Status */}
                  {!canAfford &&
                    item.available_quantity > 0 &&
                    item.is_active && (
                      <Alert
                        severity="warning"
                        sx={{ mb: 2 }}
                        icon={<Warning />}
                      >
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          {getInsufficientFundsMessage(item)}
                        </Typography>
                        {account && (
                          <Typography variant="caption" color="text.secondary">
                            Current balance:{' '}
                            {formatCurrency(
                              account.available_balance,
                              account.currency
                            )}
                          </Typography>
                        )}
                      </Alert>
                    )}

                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <Category fontSize="small" />
                      {item.item.item_sub_category?.item_category?.name} →{' '}
                      {item.item.item_sub_category?.name}
                    </Typography>
                    {item.item.weight && (
                      <Typography variant="body2" color="text.secondary">
                        Weight: {item.item.weight} {item.item.weight_unit}
                      </Typography>
                    )}
                    {item.item.size && (
                      <Typography variant="body2" color="text.secondary">
                        Size: {item.item.size} {item.item.size_unit}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <LocationOn fontSize="small" />
                      {item.business_location.address.city},{' '}
                      {item.business_location.address.state}
                    </Typography>
                  </Box>
                </CardContent>
                <CardActions>
                  {item.available_quantity === 0 ? (
                    <Button variant="outlined" fullWidth disabled>
                      Out of Stock
                    </Button>
                  ) : !item.is_active ? (
                    <Button variant="outlined" fullWidth disabled>
                      Not Available
                    </Button>
                  ) : canAfford ? (
                    <Button
                      variant="contained"
                      startIcon={<ShoppingCart />}
                      fullWidth
                      onClick={() => handleOrderClick(item)}
                    >
                      Order Now
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      color="warning"
                      startIcon={<AccountBalanceWallet />}
                      fullWidth
                      onClick={handleTopUpClick}
                    >
                      Top Up Account
                    </Button>
                  )}
                </CardActions>
              </Card>
            );
          })}
        </Box>
      </Paper>

      {/* Order Dialog */}
      <Dialog
        open={orderDialogOpen}
        onClose={() => setOrderDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Place Order</DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box>
              <Typography variant="h6" gutterBottom>
                {selectedItem.item.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {selectedItem.item.description}
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" color="primary">
                  {formatCurrency(selectedItem.selling_price)} per item
                </Typography>
              </Box>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Quantity</InputLabel>
                <Select
                  value={quantity}
                  label="Quantity"
                  onChange={(e) => setQuantity(e.target.value as number)}
                >
                  {Array.from(
                    { length: Math.min(selectedItem.available_quantity, 10) },
                    (_, i) => i + 1
                  ).map((num) => (
                    <MenuItem key={num} value={num}>
                      {num}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                fullWidth
                label="Special Instructions"
                multiline
                rows={3}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                sx={{ mb: 2 }}
              />

              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Order Summary
                </Typography>
                <Typography variant="body2">
                  Subtotal:{' '}
                  {formatCurrency(selectedItem.selling_price * quantity)}
                </Typography>
                <Typography variant="body2">
                  Delivery Fee: {formatCurrency(0)}
                </Typography>
                <Typography variant="body2">
                  Tax: {formatCurrency(0)}
                </Typography>
                <Divider sx={{ my: 1 }} />
                <Typography variant="h6">
                  Total: {formatCurrency(selectedItem.selling_price * quantity)}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOrderDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleOrderSubmit}
            variant="contained"
            disabled={orderLoading}
            startIcon={
              orderLoading ? <CircularProgress size={20} /> : <ShoppingCart />
            }
          >
            {orderLoading ? 'Placing Order...' : 'Place Order'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Dashboard;
