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
import {
  useAccountInfo,
  useBackendOrders,
  useInventoryItems,
} from '../../hooks';
import NoImage from '../../assets/no-image.svg';

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
      };

      await createOrder(orderData);
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
    if (item.item.item_images && item.item.item_images.length > 0) {
      return item.item.item_images[0].image_url;
    }
    // Use local no-image.svg asset as fallback
    return NoImage;
  };

  if (inventoryLoading || accountLoading) {
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

  if (inventoryError || accountError) {
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
                md: 'repeat(auto-fit, minmax(300px, 1fr))',
              },
              gap: 2,
            }}
          >
            {accounts.map((account) => (
              <Card key={account.id} variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {account.currency} Account
                  </Typography>
                  <Typography variant="h4" color="primary" gutterBottom>
                    {formatCurrency(account.total_balance, account.currency)}
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Available:{' '}
                      {formatCurrency(
                        account.available_balance,
                        account.currency
                      )}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Withheld:{' '}
                      {formatCurrency(
                        account.withheld_balance,
                        account.currency
                      )}
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AccountBalanceWallet />}
                    onClick={handleTopUpClick}
                  >
                    Top Up Account
                  </Button>
                </CardContent>
              </Card>
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
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      paragraph
                    >
                      {item.item.description}
                    </Typography>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h5" color="primary" gutterBottom>
                        {formatCurrency(item.selling_price)}
                      </Typography>
                      <Chip
                        label={`${item.available_quantity} available`}
                        color={
                          item.available_quantity > 0 ? 'success' : 'error'
                        }
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
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
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
                        {
                          item.item.item_sub_category?.item_category?.name
                        } → {item.item.item_sub_category?.name}
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

                    {/* Product Details */}
                    <Box sx={{ mb: 2 }}>
                      {item.item.brand && (
                        <Typography
                          variant="body1"
                          color="primary"
                          fontWeight="bold"
                          sx={{ mb: 0.5 }}
                        >
                          {item.item.brand}
                        </Typography>
                      )}
                      {item.item.model && (
                        <Typography variant="body2" color="text.secondary">
                          Model: {item.item.model}
                        </Typography>
                      )}
                      {item.item.color && (
                        <Typography variant="body2" color="text.secondary">
                          Color: {item.item.color}
                        </Typography>
                      )}
                      {item.item.material && (
                        <Typography variant="body2" color="text.secondary">
                          Material: {item.item.material}
                        </Typography>
                      )}
                      {item.item.sku && (
                        <Typography variant="body2" color="text.secondary">
                          SKU: {item.item.sku}
                        </Typography>
                      )}
                    </Box>

                    {/* Special Handling Indicators */}
                    <Box sx={{ mb: 2 }}>
                      {item.item.is_fragile && (
                        <Chip
                          label="Fragile"
                          color="warning"
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      )}
                      {item.item.is_perishable && (
                        <Chip
                          label="Perishable"
                          color="error"
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      )}
                      {item.item.requires_special_handling && (
                        <Chip
                          label="Special Handling"
                          color="info"
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      )}
                    </Box>

                    {/* Delivery Information */}
                    <Box sx={{ mb: 2 }}>
                      {item.item.estimated_delivery_time && (
                        <Typography variant="body2" color="text.secondary">
                          Est. Delivery: {item.item.estimated_delivery_time} min
                        </Typography>
                      )}
                      {item.item.max_delivery_distance && (
                        <Typography variant="body2" color="text.secondary">
                          Max Distance: {item.item.max_delivery_distance} km
                        </Typography>
                      )}
                      {item.item.min_order_quantity &&
                        item.item.min_order_quantity > 1 && (
                          <Typography variant="body2" color="text.secondary">
                            Min Order: {item.item.min_order_quantity}
                          </Typography>
                        )}
                      {item.item.max_order_quantity && (
                        <Typography variant="body2" color="text.secondary">
                          Max Order: {item.item.max_order_quantity}
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
        )}
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

              {/* Product Details */}
              <Box sx={{ mb: 2 }}>
                {selectedItem.item.brand && (
                  <Typography
                    variant="body1"
                    color="primary"
                    fontWeight="bold"
                    sx={{ mb: 0.5 }}
                  >
                    {selectedItem.item.brand}
                  </Typography>
                )}
                {selectedItem.item.model && (
                  <Typography variant="body2" color="text.secondary">
                    Model: {selectedItem.item.model}
                  </Typography>
                )}
                {selectedItem.item.color && (
                  <Typography variant="body2" color="text.secondary">
                    Color: {selectedItem.item.color}
                  </Typography>
                )}
                {selectedItem.item.material && (
                  <Typography variant="body2" color="text.secondary">
                    Material: {selectedItem.item.material}
                  </Typography>
                )}
                {selectedItem.item.sku && (
                  <Typography variant="body2" color="text.secondary">
                    SKU: {selectedItem.item.sku}
                  </Typography>
                )}
              </Box>

              {/* Special Handling Indicators */}
              <Box sx={{ mb: 2 }}>
                {selectedItem.item.is_fragile && (
                  <Chip
                    label="Fragile"
                    color="warning"
                    size="small"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                )}
                {selectedItem.item.is_perishable && (
                  <Chip
                    label="Perishable"
                    color="error"
                    size="small"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                )}
                {selectedItem.item.requires_special_handling && (
                  <Chip
                    label="Special Handling"
                    color="info"
                    size="small"
                    sx={{ mr: 0.5, mb: 0.5 }}
                  />
                )}
              </Box>

              {/* Delivery Information */}
              <Box sx={{ mb: 2 }}>
                {selectedItem.item.estimated_delivery_time && (
                  <Typography variant="body2" color="text.secondary">
                    Estimated Delivery:{' '}
                    {selectedItem.item.estimated_delivery_time} minutes
                  </Typography>
                )}
                {selectedItem.item.max_delivery_distance && (
                  <Typography variant="body2" color="text.secondary">
                    Max Delivery Distance:{' '}
                    {selectedItem.item.max_delivery_distance} km
                  </Typography>
                )}
                {selectedItem.item.min_order_quantity &&
                  selectedItem.item.min_order_quantity > 1 && (
                    <Typography variant="body2" color="text.secondary">
                      Minimum Order: {selectedItem.item.min_order_quantity}
                    </Typography>
                  )}
                {selectedItem.item.max_order_quantity && (
                  <Typography variant="body2" color="text.secondary">
                    Maximum Order: {selectedItem.item.max_order_quantity}
                  </Typography>
                )}
              </Box>

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
