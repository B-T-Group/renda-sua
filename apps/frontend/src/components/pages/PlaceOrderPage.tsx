import {
  Add,
  ArrowBack,
  CheckCircle,
  LocalShipping,
  LocationOn,
  Phone,
  Security,
  ShoppingCart,
  Verified,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { parsePhoneNumber } from 'libphonenumber-js';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useAddressManager } from '../../hooks/useAddressManager';
import { useApiClient } from '../../hooks/useApiClient';
import { useDeliveryFee } from '../../hooks/useDeliveryFee';
import { useInventoryItem } from '../../hooks/useInventoryItem';
import { useSupportedPaymentSystems } from '../../hooks/useSupportedPaymentSystems';
import PhoneInput from '../common/PhoneInput';
import AddressDialog, { AddressFormData } from '../dialogs/AddressDialog';

// Loading Skeleton Component
const OrderPageSkeleton: React.FC = () => {
  return (
    <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
      <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Skeleton
            variant="rectangular"
            height={400}
            sx={{ borderRadius: 2, mb: 3 }}
          />
          <Skeleton
            variant="rectangular"
            height={300}
            sx={{ borderRadius: 2 }}
          />
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Skeleton
            variant="rectangular"
            height={500}
            sx={{ borderRadius: 2 }}
          />
        </Grid>
      </Grid>
    </Container>
  );
};

// Order Summary Component
interface OrderSummaryProps {
  selectedItem: {
    selling_price: number;
    item: {
      name: string;
      currency: string;
      item_images?: Array<{ image_url: string }>;
    };
  };
  quantity: number;
  deliveryFee: number | null;
  deliveryFeeLoading: boolean;
  deliveryFeeError: string | null;
  formatCurrency: (amount: number, currency?: string) => string;
  onSubmit: () => void;
  loading: boolean;
  disabled: boolean;
  isMobile: boolean;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({
  selectedItem,
  quantity,
  deliveryFee,
  deliveryFeeLoading,
  deliveryFeeError,
  formatCurrency,
  onSubmit,
  loading,
  disabled,
  isMobile,
}) => {
  const { t } = useTranslation();
  const subtotal = selectedItem.selling_price * quantity;
  const total = subtotal + (deliveryFee || 0);

  return (
    <Paper
      elevation={isMobile ? 0 : 2}
      sx={{
        p: 3,
        position: isMobile ? 'fixed' : 'sticky',
        top: isMobile ? 'auto' : 100,
        bottom: isMobile ? 0 : 'auto',
        left: isMobile ? 0 : 'auto',
        right: isMobile ? 0 : 'auto',
        zIndex: isMobile ? 1000 : 'auto',
        bgcolor: 'background.paper',
        borderRadius: isMobile ? 0 : 2,
        borderTop: isMobile ? 1 : 0,
        borderColor: 'divider',
        boxShadow: isMobile ? '0 -4px 12px rgba(0,0,0,0.1)' : 2,
      }}
    >
      <Typography variant="h6" gutterBottom fontWeight="bold">
        {t('orders.orderSummary', 'Order Summary')}
      </Typography>

      <Divider sx={{ my: 2 }} />

      {/* Item Summary */}
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {selectedItem.item.item_images?.[0] && (
            <Box
              component="img"
              src={selectedItem.item.item_images[0].image_url}
              alt={selectedItem.item.name}
              sx={{
                width: 60,
                height: 60,
                borderRadius: 1,
                objectFit: 'cover',
              }}
            />
          )}
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight="medium" noWrap>
              {selectedItem.item.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('orders.quantity', 'Quantity')}: {quantity}
            </Typography>
          </Box>
        </Box>

        {/* Price Breakdown */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('orders.subtotal', 'Subtotal')}
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {formatCurrency(subtotal, selectedItem.item.currency)}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {t('orders.deliveryFee', 'Delivery Fee')}
            </Typography>
            <Typography variant="body2" fontWeight="medium">
              {deliveryFeeLoading ? (
                <CircularProgress size={14} />
              ) : deliveryFeeError ? (
                <span style={{ color: 'error.main' }}>
                  {t('common.error', 'Error')}
                </span>
              ) : (
                formatCurrency(deliveryFee || 0, selectedItem.item.currency)
              )}
            </Typography>
          </Box>

          <Divider sx={{ my: 1.5 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight="bold">
              {t('orders.total', 'Total')}
            </Typography>
            <Typography variant="h6" fontWeight="bold" color="primary">
              {formatCurrency(total, selectedItem.item.currency)}
            </Typography>
          </Box>
        </Box>

        {/* Trust Indicators */}
        <Stack direction="row" spacing={1} sx={{ py: 2 }}>
          <Security fontSize="small" color="action" />
          <Typography variant="caption" color="text.secondary">
            {t('orders.securePayment', 'Secure Payment')}
          </Typography>
        </Stack>

        {/* CTA Button */}
        <Button
          onClick={onSubmit}
          variant="contained"
          size="large"
          fullWidth
          disabled={disabled || loading}
          startIcon={
            loading ? <CircularProgress size={20} /> : <ShoppingCart />
          }
          sx={{
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: 3,
            '&:hover': {
              boxShadow: 6,
            },
          }}
        >
          {loading
            ? t('orders.placingOrder', 'Placing Order...')
            : t('orders.confirmOrder', 'Confirm Order')}
        </Button>
      </Stack>
    </Paper>
  );
};

const PlaceOrderPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const apiClient = useApiClient();
  const { profile, refetch: refetchProfile } = useUserProfileContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Get supported payment systems
  const {
    isCountrySupported,
    supportedCountries,
    loading: paymentSystemsLoading,
  } = useSupportedPaymentSystems();

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [verifiedAgentDelivery, setVerifiedAgentDelivery] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [useDifferentPhone, setUseDifferentPhone] = useState(false);
  const [overridePhoneNumber, setOverridePhoneNumber] = useState('');

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

  // Get inventory item
  const { inventoryItem: selectedItem, loading: inventoryLoading } =
    useInventoryItem(id || null);

  // Get delivery fee for the selected item
  const {
    deliveryFee,
    loading: deliveryFeeLoading,
    error: deliveryFeeError,
  } = useDeliveryFee(selectedItem?.id || null, selectedAddressId);

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

    // Validate phone number if override is enabled
    if (useDifferentPhone && !overridePhoneNumber.trim()) {
      setError(
        t(
          'orders.phoneNumberRequired',
          'Phone number is required when using a different phone number'
        )
      );
      return;
    }

    setLoading(true);
    setError(null); // Clear any previous errors
    try {
      const orderData = {
        item: {
          business_inventory_id: selectedItem.id,
          quantity: quantity,
        },
        verified_agent_delivery: verifiedAgentDelivery,
        special_instructions: specialInstructions.trim() || undefined,
        delivery_address_id: selectedAddressId,
        phone_number: useDifferentPhone ? overridePhoneNumber : undefined,
      };

      const response = await apiClient.post('/orders', orderData);

      if (!response.data.success) {
        throw new Error(
          response.data.message ||
            t('orders.createOrderFailed', 'Failed to create order')
        );
      }

      // Navigate to order confirmation page
      navigate('/orders/confirmation', {
        state: {
          order: response.data.order,
        },
      });
    } catch (error: unknown) {
      console.error('Error creating order:', error);

      // Set user-friendly error message
      let errorMessage = t(
        'orders.createOrderError',
        'An error occurred while creating your order. Please try again.'
      );

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      setError(errorMessage);
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

  // Validate phone number country - must be before early returns
  const phoneValidation = useMemo(() => {
    const phoneToValidate = useDifferentPhone
      ? overridePhoneNumber
      : profile?.phone_number;

    if (!phoneToValidate) {
      return {
        isValid: false,
        countryCode: null,
        message: null,
      };
    }

    try {
      const parsedPhone = parsePhoneNumber(phoneToValidate);
      if (!parsedPhone) {
        return {
          isValid: false,
          countryCode: null,
          message: t(
            'orders.invalidPhoneNumber',
            'Invalid phone number format'
          ),
        };
      }

      const countryCode = parsedPhone.country;
      const isSupported = countryCode ? isCountrySupported(countryCode) : false;

      if (!isSupported) {
        return {
          isValid: false,
          countryCode,
          message: t(
            'orders.unsupportedPhoneCountry',
            'Phone number is not from a supported country. Supported countries: {{countries}}',
            { countries: supportedCountries.join(', ') }
          ),
        };
      }

      return {
        isValid: true,
        countryCode,
        message: null,
      };
    } catch {
      return {
        isValid: false,
        countryCode: null,
        message: t('orders.invalidPhoneNumber', 'Invalid phone number format'),
      };
    }
  }, [
    useDifferentPhone,
    overridePhoneNumber,
    profile?.phone_number,
    isCountrySupported,
    supportedCountries,
    t,
  ]);

  // Show loading skeleton
  if (inventoryLoading) {
    return <OrderPageSkeleton />;
  }

  // Show not found message
  if (!selectedItem) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Paper sx={{ p: 6 }}>
          <Typography variant="h4" gutterBottom color="text.secondary">
            {t('orders.itemNotFound', 'Item not found')}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            {t(
              'orders.itemNotFoundMessage',
              'The item you are looking for is no longer available.'
            )}
          </Typography>
          <Button
            onClick={handleBack}
            variant="contained"
            startIcon={<ArrowBack />}
            size="large"
          >
            {t('common.goBack', 'Go Back')}
          </Button>
        </Paper>
      </Container>
    );
  }

  // Calculate if order can be placed
  const canPlaceOrder =
    !loading &&
    !paymentSystemsLoading &&
    selectedAddressId &&
    addresses.length > 0 &&
    profile?.phone_number &&
    (!useDifferentPhone || overridePhoneNumber.trim()) &&
    phoneValidation.isValid;

  return (
    <Box sx={{ bgcolor: 'grey.50', minHeight: '100vh', pb: isMobile ? 20 : 4 }}>
      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        {/* Header with Progress */}
        <Box sx={{ mb: 4 }}>
          <Button
            onClick={handleBack}
            startIcon={<ArrowBack />}
            size="small"
            sx={{ mb: 2 }}
          >
            {t('common.goBack', 'Go Back')}
          </Button>
          <Typography
            variant="h4"
            component="h1"
            fontWeight="bold"
            gutterBottom
            sx={{ fontSize: { xs: '1.75rem', md: '2.5rem' } }}
          >
            {t('orders.completeYourOrder', 'Complete Your Order')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t(
              'orders.reviewDetails',
              'Review your order details and confirm your delivery information'
            )}
          </Typography>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Main Content Grid */}
        <Grid container spacing={3}>
          {/* Left Column - Order Details */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <Stack spacing={3}>
              {/* Product Card */}
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 3,
                    }}
                  >
                    <ShoppingCart color="primary" />
                    <Typography variant="h6" fontWeight="bold">
                      {t('orders.productDetails', 'Product Details')}
                    </Typography>
                  </Box>

                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 5 }}>
                      {selectedItem.item.item_images?.[0] ? (
                        <CardMedia
                          component="img"
                          image={selectedItem.item.item_images[0].image_url}
                          alt={selectedItem.item.name}
                          sx={{
                            borderRadius: 2,
                            width: '100%',
                            height: { xs: 200, md: 250 },
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            borderRadius: 2,
                            width: '100%',
                            height: { xs: 200, md: 250 },
                            bgcolor: 'grey.200',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography color="text.secondary">
                            {t('common.noImage', 'No Image')}
                          </Typography>
                        </Box>
                      )}
                    </Grid>

                    <Grid size={{ xs: 12, md: 7 }}>
                      <Typography variant="h5" fontWeight="bold" gutterBottom>
                        {selectedItem.item.name}
                      </Typography>

                      {selectedItem.item.brand && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 2,
                          }}
                        >
                          <Chip
                            label={selectedItem.item.brand.name}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      )}

                      {selectedItem.item.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 2 }}
                        >
                          {selectedItem.item.description}
                        </Typography>
                      )}

                      {/* Special Handling Tags */}
                      {(selectedItem.item.is_fragile ||
                        selectedItem.item.is_perishable ||
                        selectedItem.item.requires_special_handling) && (
                        <Stack
                          direction="row"
                          spacing={0.5}
                          sx={{ mb: 2, flexWrap: 'wrap' }}
                        >
                          {selectedItem.item.is_fragile && (
                            <Chip
                              label="Fragile"
                              color="warning"
                              size="small"
                            />
                          )}
                          {selectedItem.item.is_perishable && (
                            <Chip
                              label="Perishable"
                              color="error"
                              size="small"
                            />
                          )}
                          {selectedItem.item.requires_special_handling && (
                            <Chip
                              label="Special Handling"
                              color="info"
                              size="small"
                            />
                          )}
                        </Stack>
                      )}

                      {/* Product Specifications */}
                      <Paper
                        variant="outlined"
                        sx={{ p: 2, bgcolor: 'grey.50' }}
                      >
                        <Stack spacing={1}>
                          {selectedItem.item.sku && (
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                SKU
                              </Typography>
                              <Typography variant="caption" fontWeight="medium">
                                {selectedItem.item.sku}
                              </Typography>
                            </Box>
                          )}
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {t('orders.availability', 'Availability')}
                            </Typography>
                            <Typography
                              variant="caption"
                              fontWeight="medium"
                              color="success.main"
                            >
                              {selectedItem.computed_available_quantity}{' '}
                              {t('common.inStock', 'in stock')}
                            </Typography>
                          </Box>
                          {selectedItem.item.weight && (
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                              }}
                            >
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {t('common.weight', 'Weight')}
                              </Typography>
                              <Typography variant="caption" fontWeight="medium">
                                {selectedItem.item.weight}{' '}
                                {selectedItem.item.weight_unit}
                              </Typography>
                            </Box>
                          )}
                        </Stack>
                      </Paper>
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 3 }} />

                  {/* Order Configuration */}
                  <Typography
                    variant="subtitle1"
                    fontWeight="bold"
                    gutterBottom
                  >
                    {t('orders.orderConfiguration', 'Order Configuration')}
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth>
                        <InputLabel>
                          {t('orders.quantity', 'Quantity')}
                        </InputLabel>
                        <Select
                          value={quantity}
                          label={t('orders.quantity', 'Quantity')}
                          onChange={(e) =>
                            setQuantity(e.target.value as number)
                          }
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
                              {num} {num === 1 ? 'unit' : 'units'}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                      <TextField
                        fullWidth
                        label={t(
                          'orders.specialInstructions',
                          'Special Instructions'
                        )}
                        placeholder={t(
                          'orders.specialInstructionsPlaceholder',
                          'Add any special instructions for this order (optional)'
                        )}
                        multiline
                        rows={3}
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        disabled={loading}
                      />
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={verifiedAgentDelivery}
                            onChange={(e) =>
                              setVerifiedAgentDelivery(e.target.checked)
                            }
                            disabled={loading}
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" fontWeight="medium">
                              {t(
                                'orders.requireVerifiedAgent',
                                'Verified Agent Only'
                              )}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {t(
                                'orders.verifiedAgentDescription',
                                'Only verified agents can deliver this order'
                              )}
                            </Typography>
                          </Box>
                        }
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Pickup Location Card */}
              {selectedItem.business_location && (
                <Card>
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        mb: 3,
                      }}
                    >
                      <LocalShipping color="primary" />
                      <Typography variant="h6" fontWeight="bold">
                        {t('orders.pickupLocation', 'Pickup Location')}
                      </Typography>
                    </Box>

                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          mb: 2,
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight="bold">
                          {selectedItem.business_location.name}
                        </Typography>
                        {selectedItem.business_location.business
                          .is_verified && (
                          <Chip
                            icon={<Verified />}
                            label={t('common.verified', 'Verified')}
                            size="small"
                            color="success"
                          />
                        )}
                      </Box>

                      {selectedItem.business_location.address && (
                        <Stack spacing={0.5}>
                          <Typography variant="body2">
                            {
                              selectedItem.business_location.address
                                .address_line_1
                            }
                            {selectedItem.business_location.address
                              .address_line_2 &&
                              `, ${selectedItem.business_location.address.address_line_2}`}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {selectedItem.business_location.address.city},{' '}
                            {selectedItem.business_location.address.state}{' '}
                            {selectedItem.business_location.address.postal_code}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {selectedItem.business_location.business.name}
                          </Typography>
                        </Stack>
                      )}
                    </Paper>
                  </CardContent>
                </Card>
              )}

              {/* Delivery Address Card */}
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 3,
                    }}
                  >
                    <LocationOn color="primary" />
                    <Typography variant="h6" fontWeight="bold">
                      {t('orders.deliveryAddress', 'Delivery Address')}
                    </Typography>
                  </Box>

                  {addressesLoading ? (
                    <Box
                      sx={{ display: 'flex', justifyContent: 'center', py: 3 }}
                    >
                      <CircularProgress />
                    </Box>
                  ) : addresses.length === 0 ? (
                    <Paper
                      variant="outlined"
                      sx={{ p: 3, textAlign: 'center', bgcolor: 'grey.50' }}
                    >
                      <LocationOn
                        sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
                      />
                      <Typography variant="subtitle1" gutterBottom>
                        {t('orders.noAddresses', 'No delivery address found')}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {t(
                          'orders.noAddressesMessage',
                          'Please add a delivery address to continue with your order'
                        )}
                      </Typography>
                      <Button
                        variant="contained"
                        onClick={handleOpenAddressDialog}
                        startIcon={<Add />}
                      >
                        {t('orders.addAddress', 'Add Delivery Address')}
                      </Button>
                    </Paper>
                  ) : (
                    <>
                      <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>
                          {t('orders.selectAddress', 'Select Delivery Address')}
                        </InputLabel>
                        <Select
                          value={selectedAddressId}
                          label={t(
                            'orders.selectAddress',
                            'Select Delivery Address'
                          )}
                          onChange={(e) => setSelectedAddressId(e.target.value)}
                          disabled={loading}
                        >
                          {addresses.map((addressWrapper) => {
                            const address = addressWrapper.address;
                            return (
                              <MenuItem key={address.id} value={address.id}>
                                <Box>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 1,
                                    }}
                                  >
                                    <Typography variant="body2">
                                      {address.address_line_1}, {address.city}
                                    </Typography>
                                    {address.is_primary && (
                                      <Chip
                                        label="Primary"
                                        size="small"
                                        color="primary"
                                      />
                                    )}
                                  </Box>
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

                      {/* Selected Address Display */}
                      {selectedAddressId &&
                        (() => {
                          const selectedAddressWrapper = addresses.find(
                            (addr) => addr.address.id === selectedAddressId
                          );
                          if (!selectedAddressWrapper) return null;
                          const address = selectedAddressWrapper.address;
                          return (
                            <Paper
                              variant="outlined"
                              sx={{ p: 2, bgcolor: 'grey.50' }}
                            >
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 1,
                                  mb: 1,
                                }}
                              >
                                <CheckCircle color="success" fontSize="small" />
                                <Typography
                                  variant="subtitle2"
                                  fontWeight="bold"
                                >
                                  {t('orders.deliveryTo', 'Delivery to')}
                                </Typography>
                              </Box>
                              <Typography variant="body2" sx={{ mb: 0.5 }}>
                                {address.address_line_1}
                                {address.address_line_2 &&
                                  `, ${address.address_line_2}`}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {address.city}, {address.state}{' '}
                                {address.postal_code}
                              </Typography>
                            </Paper>
                          );
                        })()}

                      <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        onClick={handleOpenAddressDialog}
                        startIcon={<Add />}
                        sx={{ mt: 2 }}
                      >
                        {t('orders.addAnotherAddress', 'Add Another Address')}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Payment Information Card */}
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 3,
                    }}
                  >
                    <Phone color="primary" />
                    <Typography variant="h6" fontWeight="bold">
                      {t('orders.paymentInformation', 'Payment Information')}
                    </Typography>
                  </Box>

                  {!profile?.phone_number ? (
                    <Paper
                      variant="outlined"
                      sx={{ p: 3, textAlign: 'center', bgcolor: 'warning.50' }}
                    >
                      <Phone
                        sx={{ fontSize: 48, color: 'warning.main', mb: 2 }}
                      />
                      <Typography variant="subtitle1" gutterBottom>
                        {t(
                          'orders.phoneNumberRequired',
                          'Phone Number Required'
                        )}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {t(
                          'orders.phoneNumberRequiredMessage',
                          'Please add your phone number to receive payment requests'
                        )}
                      </Typography>
                      <Button
                        variant="contained"
                        onClick={() => navigate('/profile')}
                        size="small"
                      >
                        {t('orders.addPhoneNumber', 'Add Phone Number')}
                      </Button>
                    </Paper>
                  ) : (
                    <>
                      <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          gutterBottom
                        >
                          {t('orders.mobilePayment', 'Mobile Money Payment')}
                        </Typography>
                        <Typography variant="body2">
                          {t(
                            'orders.paymentRequestMessage',
                            'A payment request will be sent to your registered phone number. Please approve it to complete your order.'
                          )}
                        </Typography>
                      </Alert>

                      <Paper
                        variant="outlined"
                        sx={{ p: 2, bgcolor: 'grey.50', mb: 2 }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          gutterBottom
                        >
                          {t(
                            'orders.paymentPhoneNumber',
                            'Payment Phone Number'
                          )}
                        </Typography>
                        <Typography variant="body1" fontWeight="bold">
                          {useDifferentPhone
                            ? overridePhoneNumber
                            : profile.phone_number}
                        </Typography>
                      </Paper>

                      <FormControlLabel
                        control={
                          <Switch
                            checked={useDifferentPhone}
                            onChange={(e) =>
                              setUseDifferentPhone(e.target.checked)
                            }
                            disabled={loading}
                          />
                        }
                        label={
                          <Typography variant="body2">
                            {t(
                              'orders.useDifferentPhone',
                              'Use a different phone number'
                            )}
                          </Typography>
                        }
                      />

                      {useDifferentPhone && (
                        <Box sx={{ mt: 2 }}>
                          <PhoneInput
                            value={overridePhoneNumber}
                            onChange={(value) =>
                              setOverridePhoneNumber(value || '')
                            }
                            label={t(
                              'orders.overridePhoneNumber',
                              'Phone Number for Payment'
                            )}
                            defaultCountry="GA"
                            fullWidth
                          />
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ mt: 1, display: 'block' }}
                          >
                            {t(
                              'orders.overridePhoneNote',
                              'This number will receive the payment request for this order'
                            )}
                          </Typography>
                        </Box>
                      )}

                      {/* Phone Number Country Validation Warning */}
                      {phoneValidation.message && !phoneValidation.isValid && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                          <Typography
                            variant="body2"
                            fontWeight="medium"
                            gutterBottom
                          >
                            {t(
                              'orders.phoneNumberNotSupported',
                              'Phone Number Not Supported'
                            )}
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 2 }}>
                            {phoneValidation.message}
                          </Typography>
                          <Typography variant="body2" fontWeight="medium">
                            {t(
                              'orders.useAlternativePhone',
                              'Please use the "Use a different phone number" option above to enter a phone number from a supported country.'
                            )}
                          </Typography>
                        </Alert>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </Stack>
          </Grid>

          {/* Right Column - Order Summary (Desktop Sticky) */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <OrderSummary
              selectedItem={selectedItem}
              quantity={quantity}
              deliveryFee={deliveryFee?.deliveryFee || null}
              deliveryFeeLoading={deliveryFeeLoading}
              deliveryFeeError={deliveryFeeError}
              formatCurrency={formatCurrency}
              onSubmit={handleSubmit}
              loading={loading}
              disabled={!canPlaceOrder}
              isMobile={isMobile}
            />
          </Grid>
        </Grid>
      </Container>

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
