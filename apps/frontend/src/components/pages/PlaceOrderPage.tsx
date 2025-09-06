import { ArrowBack, ShoppingCart } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAddressManager } from '../../hooks/useAddressManager';
import { useApiClient } from '../../hooks/useApiClient';
import { useDeliveryFee } from '../../hooks/useDeliveryFee';
import { useInventoryItems } from '../../hooks/useInventoryItems';
import AddressDialog, { AddressFormData } from '../dialogs/AddressDialog';

const PlaceOrderPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const apiClient = useApiClient();
  const { profile, refetch: refetchProfile } = useUserProfileContext();

  // State
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [verifiedAgentDelivery, setVerifiedAgentDelivery] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');

  // Address Dialog State
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [addressFormData, setAddressFormData] = useState<AddressFormData>({
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    address_type: 'home',
    is_primary: false,
  });

  // Get inventory items
  const { inventoryItems, loading: inventoryLoading } = useInventoryItems();

  // Find the selected item
  const selectedItem = inventoryItems.find((item) => item.id === id);

  // Get delivery fee for the selected item
  const {
    deliveryFee,
    loading: deliveryFeeLoading,
    error: deliveryFeeError,
  } = useDeliveryFee(selectedItem?.id || null);

  // Get client addresses
  const {
    addresses,
    loading: addressesLoading,
    addAddress,
  } = useAddressManager({
    entityType: 'client',
    entityId: profile?.client?.id || '',
  });

  // Set default address when addresses load
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const primaryAddress = addresses.find((addr) => addr.address.is_primary);
      setSelectedAddressId(
        primaryAddress?.address.id || addresses[0].address.id
      );
    }
  }, [addresses, selectedAddressId]);

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleSubmit = async () => {
    if (!selectedItem || !apiClient || !selectedAddressId) return;

    setLoading(true);
    try {
      const orderData = {
        item: {
          business_inventory_id: selectedItem.id,
          quantity: quantity,
        },
        verified_agent_delivery: verifiedAgentDelivery,
        special_instructions: specialInstructions.trim() || undefined,
        delivery_address_id: selectedAddressId,
      };

      const response = await apiClient.post('/orders', orderData);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to create order');
      }

      // Navigate to success page or dashboard
      navigate('/dashboard', {
        state: {
          orderSuccess: true,
          orderNumber: response.data.order?.order_number,
        },
      });
    } catch (error: unknown) {
      console.error('Error creating order:', error);
      // You might want to show an error message here
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  // Address Dialog Handlers
  const handleOpenAddressDialog = () => {
    setAddressDialogOpen(true);
  };

  const handleCloseAddressDialog = () => {
    setAddressDialogOpen(false);
    // Reset form data
    setAddressFormData({
      address_line_1: '',
      address_line_2: '',
      city: '',
      state: '',
      postal_code: '',
      country: '',
      address_type: 'home',
      is_primary: false,
    });
  };

  const handleAddressChange = (address: AddressFormData) => {
    setAddressFormData(address);
  };

  const handleSaveAddress = async () => {
    try {
      // Ensure required fields are set
      const addressData = {
        ...addressFormData,
        address_type: addressFormData.address_type || 'home',
        is_primary: addressFormData.is_primary || false,
      };

      // Add the address using the address manager
      await addAddress(addressData);

      // Close the dialog
      handleCloseAddressDialog();

      // Refresh the user profile to get updated addresses
      await refetchProfile();

      // The addresses will be automatically updated through the useAddressManager hook
      // If this was the first address, it will be automatically selected by the useEffect
    } catch (error) {
      console.error('Error saving address:', error);
      // You might want to show an error message here
    }
  };

  if (inventoryLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!selectedItem) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>
          {t('orders.itemNotFound', 'Item not found')}
        </Typography>
        <Button onClick={handleBack} startIcon={<ArrowBack />}>
          {t('common.goBack', 'Go Back')}
        </Button>
      </Box>
    );
  }

  const totalCost =
    selectedItem.selling_price * quantity + (deliveryFee?.deliveryFee || 0);

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button onClick={handleBack} startIcon={<ArrowBack />}>
          {t('common.goBack', 'Go Back')}
        </Button>
        <Typography variant="h4" component="h1">
          {t('orders.placeOrder', 'Place Order')}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Order Details Section */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('orders.orderDetails', 'Order Details')}
              </Typography>

              {/* Item Information */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" gutterBottom>
                  {selectedItem.item.name}
                </Typography>

                {selectedItem.item.brand && (
                  <Typography
                    variant="body2"
                    color="primary"
                    fontWeight="bold"
                    sx={{ mb: 1 }}
                  >
                    {selectedItem.item.brand.name}
                  </Typography>
                )}

                <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                  {formatCurrency(
                    selectedItem.selling_price,
                    selectedItem.item.currency
                  )}
                </Typography>

                {/* Special Handling Chips */}
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
              </Box>

              {/* Quantity Selection */}
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>{t('orders.quantity', 'Quantity')}</InputLabel>
                <Select
                  value={quantity}
                  label={t('orders.quantity', 'Quantity')}
                  onChange={(e) => setQuantity(e.target.value as number)}
                  disabled={loading}
                >
                  {Array.from(
                    {
                      length: Math.min(
                        selectedItem.computed_available_quantity,
                        10
                      ),
                    },
                    (_, i) => i + 1
                  ).map((num) => (
                    <MenuItem key={num} value={num}>
                      {num}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Special Instructions */}
              <TextField
                fullWidth
                label={t('orders.specialInstructions', 'Special Instructions')}
                multiline
                rows={3}
                value={specialInstructions}
                onChange={(e) => setSpecialInstructions(e.target.value)}
                disabled={loading}
                sx={{ mb: 2 }}
              />

              {/* Verified Agent Delivery */}
              <FormControlLabel
                control={
                  <Switch
                    color="primary"
                    checked={verifiedAgentDelivery}
                    onChange={(e) => setVerifiedAgentDelivery(e.target.checked)}
                    disabled={loading}
                  />
                }
                label={t(
                  'orders.requireVerifiedAgent',
                  'Require verified agent for delivery'
                )}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Delivery Address Section */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('orders.deliveryAddress', 'Delivery Address')}
              </Typography>

              {addressesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : addresses.length === 0 ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    {t(
                      'orders.noAddresses',
                      'No delivery addresses found. Please add an address to your profile.'
                    )}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ mt: 1 }}
                    onClick={handleOpenAddressDialog}
                  >
                    {t('orders.addAddress', 'Add Address')}
                  </Button>
                </Alert>
              ) : (
                <FormControl fullWidth>
                  <InputLabel>
                    {t('orders.selectAddress', 'Select Delivery Address')}
                  </InputLabel>
                  <Select
                    value={selectedAddressId}
                    label={t('orders.selectAddress', 'Select Delivery Address')}
                    onChange={(e) => setSelectedAddressId(e.target.value)}
                    disabled={loading}
                  >
                    {addresses.map((addressWrapper) => {
                      const address = addressWrapper.address;
                      const addressText = `${address.address_line_1}, ${address.city}, ${address.state}`;
                      return (
                        <MenuItem key={address.id} value={address.id}>
                          <Box>
                            <Typography variant="body2">
                              {addressText}
                              {address.is_primary && (
                                <Chip
                                  label="Primary"
                                  size="small"
                                  color="primary"
                                  sx={{ ml: 1 }}
                                />
                              )}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {address.address_type}
                            </Typography>
                          </Box>
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Payment Details Section */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('orders.paymentDetails', 'Payment Details')}
              </Typography>

              {/* Phone Number Validation */}
              {!profile?.phone_number ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {t('orders.phoneNumberRequired', 'Phone Number Required')}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {t(
                      'orders.phoneNumberRequiredMessage',
                      'A phone number is required to place an order. Please add your mobile money phone number to your profile.'
                    )}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ mt: 1 }}
                    onClick={() => navigate('/profile')}
                  >
                    {t('orders.addPhoneNumber', 'Add Phone Number')}
                  </Button>
                </Alert>
              ) : (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {t(
                      'orders.paymentRequestInfo',
                      'Payment Request Information'
                    )}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {t(
                      'orders.paymentRequestMessage',
                      'A payment request will be sent to your phone number:'
                    )}
                  </Typography>
                  <Typography variant="body2" fontWeight="bold" color="primary">
                    {profile.phone_number}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {t(
                      'orders.paymentRequestNote',
                      'Once you accept the payment request, your order will be sent to the merchant.'
                    )}
                  </Typography>
                </Alert>
              )}

              {/* Order Summary */}
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('orders.orderSummary', 'Order Summary')}
                </Typography>
                <Typography variant="body2">
                  {t('orders.subtotal', 'Subtotal')}:{' '}
                  {formatCurrency(
                    selectedItem.selling_price * quantity,
                    selectedItem.item.currency
                  )}
                </Typography>
                <Typography variant="body2">
                  {t('orders.deliveryFee', 'Delivery Fee')}:{' '}
                  {deliveryFeeLoading ? (
                    <span style={{ fontStyle: 'italic' }}>
                      {t('common.calculating', 'Calculating...')}
                    </span>
                  ) : deliveryFeeError ? (
                    <span style={{ color: 'error.main', fontStyle: 'italic' }}>
                      {t('common.error', 'Error')}
                    </span>
                  ) : (
                    formatCurrency(
                      deliveryFee?.deliveryFee || 0,
                      deliveryFee?.currency
                    )
                  )}
                </Typography>
                <Typography variant="body2">
                  {t('orders.tax', 'Tax')}: {formatCurrency(0)}
                </Typography>
                <Box
                  sx={{ borderTop: 1, borderColor: 'divider', mt: 1, pt: 1 }}
                >
                  <Typography variant="h6">
                    {t('orders.total', 'Total')}:{' '}
                    {formatCurrency(
                      totalCost,
                      deliveryFee?.currency || selectedItem.item.currency
                    )}
                  </Typography>
                </Box>
              </Box>

              {/* Order Requirements Summary */}
              <Box sx={{ mt: 2, mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {t('orders.orderRequirements', 'Order Requirements')}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {profile?.phone_number ? (
                      <Box sx={{ color: 'success.main' }}>✓</Box>
                    ) : (
                      <Box sx={{ color: 'error.main' }}>✗</Box>
                    )}
                    <Typography variant="body2">
                      {t(
                        'orders.phoneNumberRequirement',
                        'Phone number for payment'
                      )}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {selectedAddressId && addresses.length > 0 ? (
                      <Box sx={{ color: 'success.main' }}>✓</Box>
                    ) : (
                      <Box sx={{ color: 'error.main' }}>✗</Box>
                    )}
                    <Typography variant="body2">
                      {t(
                        'orders.deliveryAddressRequirement',
                        'Delivery address selected'
                      )}
                    </Typography>
                  </Box>
                </Box>
                {(!profile?.phone_number ||
                  !selectedAddressId ||
                  addresses.length === 0) && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      {t(
                        'orders.completeRequirements',
                        'Please complete all requirements above before placing your order.'
                      )}
                    </Typography>
                  </Alert>
                )}
              </Box>

              {/* Place Order Button */}
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                <Button
                  onClick={handleSubmit}
                  variant="contained"
                  size="large"
                  disabled={
                    loading ||
                    !selectedAddressId ||
                    addresses.length === 0 ||
                    !profile?.phone_number
                  }
                  startIcon={
                    loading ? <CircularProgress size={20} /> : <ShoppingCart />
                  }
                >
                  {loading
                    ? t('orders.placingOrder', 'Placing Order...')
                    : t('orders.placeOrder', 'Place Order')}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Address Dialog */}
      <AddressDialog
        open={addressDialogOpen}
        title={t('orders.addDeliveryAddress', 'Add Delivery Address')}
        addressData={addressFormData}
        loading={loading}
        showAddressType={true}
        showIsPrimary={true}
        showCoordinates={false}
        onClose={handleCloseAddressDialog}
        onSave={handleSaveAddress}
        onAddressChange={handleAddressChange}
      />
    </Box>
  );
};

export default PlaceOrderPage;
