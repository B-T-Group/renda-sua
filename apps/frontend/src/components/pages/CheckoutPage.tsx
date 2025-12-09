import { ArrowBack, Security } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Switch,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CartItem, useCart } from '../../contexts/CartContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAddressManager } from '../../hooks/useAddressManager';
import { useCheckout } from '../../hooks/useCheckout';
import { useDeliveryFee } from '../../hooks/useDeliveryFee';
import { useFastDeliveryConfig } from '../../hooks/useFastDeliveryConfig';
import DeliveryTimeWindowSelector, {
  DeliveryWindowData,
} from '../common/DeliveryTimeWindowSelector';
import FastDeliveryOption from '../common/FastDeliveryOption';
import PhoneInput from '../common/PhoneInput';
import AddressDialog, { AddressFormData } from '../dialogs/AddressDialog';

// Loading Skeleton Component
const CheckoutPageSkeleton: React.FC = () => (
  <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
    <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, lg: 8 }}>
        <Skeleton
          variant="rectangular"
          height={400}
          sx={{ borderRadius: 2, mb: 3 }}
        />
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 2 }} />
      </Grid>
      <Grid size={{ xs: 12, lg: 4 }}>
        <Skeleton variant="rectangular" height={500} sx={{ borderRadius: 2 }} />
      </Grid>
    </Grid>
  </Container>
);

// Order Summary Component for multiple items
interface OrderSummaryProps {
  cartItems: CartItem[];
  deliveryFee: number | null;
  deliveryFeeLoading: boolean;
  deliveryFeeError: string | null;
  fastDeliveryFee: number;
  requiresFastDelivery: boolean;
  formatCurrency: (amount: number, currency?: string) => string;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({
  cartItems,
  deliveryFee,
  deliveryFeeLoading,
  deliveryFeeError,
  fastDeliveryFee,
  requiresFastDelivery,
  formatCurrency,
}) => {
  const { t } = useTranslation();
  const { getCartByBusiness } = useCart();

  const cartByBusiness = getCartByBusiness();
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.itemData.price * item.quantity,
    0
  );
  const total = subtotal + (deliveryFee || 0) + fastDeliveryFee;

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>
        {t('checkout.orderSummary', 'Order Summary')}
      </Typography>

      {/* Items by Business */}
      {Array.from(cartByBusiness.entries()).map(([businessId, items]) => (
        <Box key={businessId} sx={{ mb: 3 }}>
          <Typography variant="subtitle1" sx={{ mb: 2, color: 'primary.main' }}>
            {t('checkout.businessOrder', 'Order from Business')}
          </Typography>

          {items.map((item) => (
            <Box
              key={item.inventoryItemId}
              sx={{ display: 'flex', gap: 2, mb: 2 }}
            >
              <CardMedia
                component="img"
                sx={{
                  width: 60,
                  height: 60,
                  borderRadius: 1,
                  objectFit: 'cover',
                }}
                image={item.itemData.imageUrl || '/placeholder-item.jpg'}
                alt={item.itemData.name}
              />
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {item.itemData.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatCurrency(item.itemData.price, item.itemData.currency)}{' '}
                  × {item.quantity}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {formatCurrency(
                    item.itemData.price * item.quantity,
                    item.itemData.currency
                  )}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      ))}

      <Divider sx={{ my: 2 }} />

      {/* Totals */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">
            {t('checkout.subtotal', 'Subtotal')} (
            {t('cart.itemCount', 'items', { count: cartItems.length })})
          </Typography>
          <Typography variant="body2">{formatCurrency(subtotal)}</Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2">
            {t('checkout.deliveryFee', 'Delivery Fee')}
          </Typography>
          <Typography variant="body2">
            {deliveryFeeLoading ? (
              <CircularProgress size={16} />
            ) : deliveryFeeError ? (
              <Typography variant="body2" color="error">
                {t('checkout.deliveryFeeError', 'Error calculating')}
              </Typography>
            ) : (
              formatCurrency(deliveryFee || 0)
            )}
          </Typography>
        </Box>

        {requiresFastDelivery && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">
              {t('checkout.fastDeliveryFee', 'Fast Delivery Fee')}
            </Typography>
            <Typography variant="body2">
              {formatCurrency(fastDeliveryFee)}
            </Typography>
          </Box>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h6">{t('checkout.total', 'Total')}</Typography>
        <Typography variant="h6" color="primary">
          {formatCurrency(total)}
        </Typography>
      </Box>

      {cartByBusiness.size > 1 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {t(
            'checkout.multipleOrdersNotice',
            'Your items will be split into {{count}} separate orders',
            { count: cartByBusiness.size }
          )}
        </Alert>
      )}
    </Paper>
  );
};

const CheckoutPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { cartItems } = useCart();
  const { profile } = useUserProfileContext();

  // State
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [useDifferentPhone, setUseDifferentPhone] = useState(false);
  const [overridePhoneNumber, setOverridePhoneNumber] = useState('');
  const [requiresFastDelivery, setRequiresFastDelivery] = useState(false);
  const [deliveryWindow, setDeliveryWindow] =
    useState<DeliveryWindowData | null>(null);
  const [isCheckoutInProgress, setIsCheckoutInProgress] = useState(false);

  const handleDeliveryWindowChange = useCallback(
    (data: DeliveryWindowData | null) => {
      setDeliveryWindow(data);
    },
    []
  );

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

  // Get client addresses
  const {
    addresses,
    loading: addressesLoading,
    addAddress,
  } = useAddressManager({
    entityType: 'client',
    entityId: profile?.client?.id || '',
  });

  // Get fast delivery configuration
  const selectedAddress = addresses.find(
    (addr) => addr.address.id === selectedAddressId
  )?.address;
  const userCountry = selectedAddress?.country || 'GA';
  const userState = selectedAddress?.state || 'Estuaire Province';

  const { config: fastDeliveryConfig, isEnabledForLocation } =
    useFastDeliveryConfig(userCountry, userState);

  // Get delivery fee (use first item's business inventory ID as reference)
  const firstItem = cartItems[0];
  const {
    deliveryFee,
    loading: deliveryFeeLoading,
    error: deliveryFeeError,
  } = useDeliveryFee(
    firstItem?.inventoryItemId || null,
    selectedAddressId,
    requiresFastDelivery
  );

  // Checkout hook
  const {
    createOrdersFromCart,
    loading: checkoutLoading,
    error: checkoutError,
  } = useCheckout();

  // Set default address when addresses load
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const primaryAddress = addresses.find((addr) => addr.address.is_primary);
      setSelectedAddressId(
        primaryAddress?.address.id || addresses[0].address.id
      );
    }
  }, [addresses, selectedAddressId]);

  // Redirect if cart is empty
  useEffect(() => {
    if (cartItems.length === 0 && !isCheckoutInProgress) {
      navigate('/cart');
    }
  }, [cartItems.length, navigate, isCheckoutInProgress]);

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const handleSubmit = async () => {
    if (cartItems.length === 0 || !selectedAddressId) return;

    // Validate phone number if override is enabled
    if (useDifferentPhone && !overridePhoneNumber.trim()) {
      return;
    }

    setIsCheckoutInProgress(true); // Set flag before checkout

    try {
      const phoneNumber = useDifferentPhone ? overridePhoneNumber : undefined;
      const fastDeliveryFee = requiresFastDelivery
        ? fastDeliveryConfig?.fee || 0
        : 0;

      const orders = await createOrdersFromCart(
        cartItems,
        selectedAddressId,
        phoneNumber,
        undefined, // specialInstructions removed
        requiresFastDelivery,
        fastDeliveryFee,
        deliveryWindow
          ? {
              slot_id: deliveryWindow.slot_id,
              preferred_date: deliveryWindow.preferred_date,
              special_instructions: deliveryWindow.special_instructions,
            }
          : undefined
      );

      // Navigate to order confirmation
      navigate('/orders/confirmation', {
        state: {
          orders: orders,
          multipleOrders: orders.length > 1,
        },
      });
    } catch (error) {
      console.error('Checkout error:', error);
      setIsCheckoutInProgress(false); // Reset flag on error
    }
  };

  const handleBack = () => {
    navigate('/cart');
  };

  // Address Dialog Handlers
  const handleOpenAddressDialog = () => {
    setAddressDialogOpen(true);
  };

  const handleCloseAddressDialog = () => {
    setAddressDialogOpen(false);
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

  const handleAddressSubmit = async () => {
    try {
      // Ensure all required fields have default values
      const addressData = {
        address_line_1: addressFormData.address_line_1 || '',
        address_line_2: addressFormData.address_line_2 || '',
        city: addressFormData.city || '',
        state: addressFormData.state || '',
        postal_code: addressFormData.postal_code || '',
        country: addressFormData.country || '',
        address_type: addressFormData.address_type || 'home',
        is_primary: addressFormData.is_primary || false,
        latitude: addressFormData.latitude,
        longitude: addressFormData.longitude,
      };
      await addAddress(addressData);
      handleCloseAddressDialog();
    } catch (error) {
      console.error('Error adding address:', error);
    }
  };

  if (cartItems.length === 0) {
    return <CheckoutPageSkeleton />;
  }

  const fastDeliveryFee = requiresFastDelivery
    ? fastDeliveryConfig?.fee || 0
    : 0;

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <IconButton onClick={handleBack} sx={{ mr: 2 }}>
          <ArrowBack />
        </IconButton>
        <Typography variant="h4" component="h1">
          {t('checkout.title', 'Checkout')}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid size={{ xs: 12, lg: 8 }}>
          {/* Delivery Information */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3 }}>
                {t('checkout.deliveryInformation', 'Delivery Information')}
              </Typography>

              {/* Address Selection */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  {t('checkout.deliveryAddress', 'Delivery Address')}
                </Typography>

                {addressesLoading ? (
                  <Skeleton variant="rectangular" height={56} />
                ) : (
                  <FormControl fullWidth>
                    <InputLabel>
                      {t('checkout.selectAddress', 'Select Address')}
                    </InputLabel>
                    <Select
                      value={selectedAddressId}
                      onChange={(e) => setSelectedAddressId(e.target.value)}
                      label={t('checkout.selectAddress', 'Select Address')}
                    >
                      {addresses.map((addr) => (
                        <MenuItem key={addr.address.id} value={addr.address.id}>
                          <Box>
                            <Typography variant="body2">
                              {addr.address.address_line_1}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {addr.address.city}, {addr.address.state}{' '}
                              {addr.address.postal_code}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                <Button
                  variant="outlined"
                  onClick={handleOpenAddressDialog}
                  sx={{ mt: 1 }}
                >
                  {t('checkout.addNewAddress', 'Add New Address')}
                </Button>
              </Box>

              {/* Fast Delivery Option */}
              {isEnabledForLocation(userCountry, userState) &&
                fastDeliveryConfig && (
                  <FastDeliveryOption
                    config={fastDeliveryConfig}
                    selected={requiresFastDelivery}
                    onToggle={setRequiresFastDelivery}
                    formatCurrency={formatCurrency}
                  />
                )}

              {/* Delivery Time Window */}
              <DeliveryTimeWindowSelector
                countryCode={selectedAddress?.country || 'GA'}
                stateCode={selectedAddress?.state}
                onChange={handleDeliveryWindowChange}
                isFastDelivery={requiresFastDelivery}
                loading={checkoutLoading}
              />
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3 }}>
                {t('checkout.paymentInformation', 'Payment Information')}
              </Typography>

              {/* Mobile Payment Method */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                  {t('checkout.mobilePaymentMethod', 'Mobile Payment Method')}
                </Typography>

                {/* Primary Phone Number Display */}
                <Card
                  variant="outlined"
                  sx={{
                    p: 2,
                    mb: 2,
                    bgcolor: useDifferentPhone ? 'grey.50' : 'primary.50',
                    borderColor: useDifferentPhone ? 'grey.300' : 'primary.200',
                    transition: 'all 0.2s ease-in-out',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Security
                      color={useDifferentPhone ? 'disabled' : 'primary'}
                    />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" fontWeight={500}>
                        {t(
                          'checkout.primaryPhoneNumber',
                          'Primary Phone Number'
                        )}
                      </Typography>
                      <Typography
                        variant="body2"
                        color={
                          useDifferentPhone ? 'text.disabled' : 'text.secondary'
                        }
                      >
                        {profile?.phone_number ||
                          t('common.notAvailable', 'Not available')}
                      </Typography>
                      {!useDifferentPhone && (
                        <Typography
                          variant="caption"
                          color="primary"
                          sx={{ mt: 0.5, display: 'block' }}
                        >
                          {t(
                            'checkout.selectedForPayment',
                            'Selected for payment'
                          )}
                        </Typography>
                      )}
                    </Box>
                    {!useDifferentPhone && (
                      <Box
                        sx={{
                          bgcolor: 'primary.main',
                          color: 'white',
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        {t('checkout.active', 'Active')}
                      </Box>
                    )}
                  </Box>
                </Card>

                {/* Toggle for Different Phone Number */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={useDifferentPhone}
                      onChange={(e) => setUseDifferentPhone(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {t(
                          'checkout.useDifferentPhone',
                          'Use a different phone number for this order'
                        )}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(
                          'checkout.useDifferentPhoneDescription',
                          'Override your primary phone number for this specific order'
                        )}
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start', mb: 2 }}
                />

                {/* Alternative Phone Input */}
                {useDifferentPhone && (
                  <Card
                    variant="outlined"
                    sx={{
                      p: 2,
                      bgcolor: 'primary.50',
                      borderColor: 'primary.200',
                      border: '2px solid',
                      animation: 'fadeIn 0.3s ease-in-out',
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        mb: 2,
                      }}
                    >
                      <Security color="primary" />
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        color="primary"
                      >
                        {t(
                          'checkout.alternativePhoneNumber',
                          'Alternative Phone Number'
                        )}
                      </Typography>
                    </Box>
                    <PhoneInput
                      value={overridePhoneNumber}
                      onChange={(value) => setOverridePhoneNumber(value || '')}
                      label={t(
                        'checkout.enterPhoneNumber',
                        'Enter phone number'
                      )}
                      defaultCountry={selectedAddress?.country || 'GA'}
                    />
                    {overridePhoneNumber && (
                      <Typography
                        variant="caption"
                        color="primary"
                        sx={{ mt: 1, display: 'block' }}
                      >
                        {t(
                          'checkout.alternativePhoneSelected',
                          'This number will be used for payment processing'
                        )}
                      </Typography>
                    )}
                  </Card>
                )}
              </Box>

              {/* Payment Security Notice */}
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  {t(
                    'checkout.paymentSecurityNotice',
                    'Your payment will be processed securely through mobile money. The phone number above will be used to initiate the payment transaction.'
                  )}
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        </Grid>

        {/* Order Summary */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <OrderSummary
            cartItems={cartItems}
            deliveryFee={deliveryFee?.deliveryFee || null}
            deliveryFeeLoading={deliveryFeeLoading}
            deliveryFeeError={deliveryFeeError}
            fastDeliveryFee={fastDeliveryFee}
            requiresFastDelivery={requiresFastDelivery}
            formatCurrency={formatCurrency}
          />

          {/* Place Order Button */}
          <Button
            variant="contained"
            fullWidth
            size="large"
            onClick={handleSubmit}
            disabled={!selectedAddressId || checkoutLoading}
            sx={{ mt: 3 }}
          >
            {checkoutLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              t('checkout.placeOrder', 'Place Order')
            )}
          </Button>

          {checkoutError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {checkoutError}
            </Alert>
          )}
        </Grid>
      </Grid>

      {/* Address Dialog */}
      <AddressDialog
        open={addressDialogOpen}
        onClose={handleCloseAddressDialog}
        onSave={handleAddressSubmit}
        addressData={addressFormData}
        onAddressChange={setAddressFormData}
      />
    </Container>
  );
};

export default CheckoutPage;
