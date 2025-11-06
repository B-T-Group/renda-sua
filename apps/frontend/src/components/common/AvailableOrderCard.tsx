import {
  Business as BusinessIcon,
  CheckCircle,
  LocalShipping as DeliveryIcon,
  FlashOn,
  LocationOn as LocationIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import type { Order } from '../../hooks/useAgentOrders';
import type { OrderData } from '../../hooks/useOrderById';
import ClaimOrderDialog from '../orders/ClaimOrderDialog';
import ConfirmationModal from './ConfirmationModal';

interface AvailableOrderCardProps {
  order: Order;
  onClaimSuccess?: () => void;
}

const AvailableOrderCard: React.FC<AvailableOrderCardProps> = ({
  order,
  onClaimSuccess,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const apiClient = useApiClient();
  const { profile, accounts: agentAccounts } = useUserProfileContext();

  // Claim dialog state
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [showClaimConfirmation, setShowClaimConfirmation] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimError, setClaimError] = useState<string | undefined>();

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getDeliveryFee = () => {
    // Always use order delivery fee components directly
    // Do not use hold data for delivery fee calculation
    return (order.base_delivery_fee || 0) + (order.per_km_delivery_fee || 0);
  };

  const getDeliveryFeeDisplay = () => {
    return formatCurrency(getDeliveryFee(), order.currency);
  };

  // Check if agent has sufficient funds to claim the order
  const hasSufficientFunds = () => {
    if (!agentAccounts?.length) return false; // Assume insufficient if no account data

    // Calculate required hold amount (typically a percentage of total order amount)
    const holdPercentage = 80; // 80% hold percentage - matches backend config
    const requiredHoldAmount = (order.total_amount * holdPercentage) / 100;

    // Check if agent has sufficient balance in the order's currency
    const accountForCurrency = agentAccounts.find(
      (account) => account.currency === order.currency
    );

    if (!accountForCurrency) return false; // No account for this currency

    return accountForCurrency.available_balance >= requiredHoldAmount;
  };

  // Calculate total item quantity
  const getTotalItemQuantity = () => {
    if (!order.order_items || order.order_items.length === 0) return 0;
    return order.order_items.reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );
  };

  const handleClaim = async () => {
    if (!profile?.agent?.id) {
      setClaimError(
        t('messages.agentProfileNotFound', 'Agent profile not found')
      );
      return;
    }

    // Check if agent has sufficient funds
    if (hasSufficientFunds()) {
      // Show confirmation dialog before claiming
      setShowClaimConfirmation(true);
    } else {
      // Show dialog for claim with topup
      setShowClaimDialog(true);
    }
  };

  const handleConfirmClaim = async () => {
    if (!profile?.agent?.id) {
      setClaimError(
        t('messages.agentProfileNotFound', 'Agent profile not found')
      );
      return;
    }

    setShowClaimConfirmation(false);
    // Use regular claim order API directly (no distance-matrix needed)
    setClaimLoading(true);
    setClaimError(undefined);
    try {
      if (!apiClient) {
        throw new Error('API client not available');
      }
      const response = await apiClient.post('/orders/claim_order', {
        orderId: order.id,
      });
      if (response.data.success) {
        setClaimSuccess(true);
        onClaimSuccess?.();
        // Optionally navigate to manage order page after a short delay
        setTimeout(() => {
          navigate(`/orders/${order.id}`);
        }, 1500);
      } else {
        throw new Error(response.data.error || 'Failed to claim order');
      }
    } catch (error: any) {
      setClaimError(
        error.message ||
          t('messages.orderClaimError', 'Failed to claim order')
      );
    } finally {
      setClaimLoading(false);
    }
  };

  const handleClaimWithTopup = async (phoneNumber?: string) => {
    setClaimLoading(true);
    setClaimError(undefined);
    setClaimSuccess(false);

    try {
      if (!apiClient) {
        throw new Error('API client not available');
      }
      const payload: { orderId: string; phone_number?: string } = {
        orderId: order.id,
      };
      if (phoneNumber) {
        payload.phone_number = phoneNumber;
      }
      const response = await apiClient.post(
        '/orders/claim_order_with_topup',
        payload
      );
      if (response.data.success) {
        setClaimSuccess(true);
        setShowClaimDialog(false);
        onClaimSuccess?.();
        // Optionally navigate to manage order page after a short delay
        setTimeout(() => {
          navigate(`/orders/${order.id}`);
        }, 1500);
      } else {
        throw new Error(
          response.data.error || 'Failed to claim order with topup'
        );
      }
    } catch (error: any) {
      setClaimError(
        error.message ||
          t(
            'messages.orderClaimWithTopupError',
            'Failed to claim order with topup'
          )
      );
    } finally {
      setClaimLoading(false);
    }
  };

  const handleCloseClaimDialog = () => {
    setShowClaimDialog(false);
    setClaimSuccess(false);
    setClaimError(undefined);
  };

  const formatAddress = (address: any) => {
    if (!address) return '';
    const parts = [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready_for_pickup':
        return 'success';
      case 'pending':
        return 'warning';
      case 'confirmed':
        return 'info';
      case 'preparing':
        return 'primary';
      default:
        return 'default';
    }
  };

  const deliveryFeeDisplay = getDeliveryFeeDisplay();

  return (
    <Card
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        mb: 2,
        position: 'relative',
      }}
    >
      {/* Order Image */}
      <Box
        sx={{
          width: { xs: '100%', sm: '250px' },
          minHeight: { xs: 150, sm: 200 },
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.100',
          overflow: 'hidden',
          borderRadius: 0,
        }}
      >
        {order.order_items?.[0]?.item?.item_images?.[0]?.image_url ? (
          <img
            src={order.order_items[0].item.item_images[0].image_url}
            alt={t('orders.orderImage', 'Order')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.innerHTML =
                  '<div style="font-size: 2rem; color: #999;"><span role="img" aria-label="package">📦</span></div>';
              }
            }}
          />
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'grey.500',
              fontSize: '2rem',
              width: '100%',
              height: '100%',
            }}
          >
            <span role="img" aria-label="package">
              📦
            </span>
          </Box>
        )}
      </Box>

      {/* Order Details */}
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 1,
          }}
        >
          <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
            Order #{order.order_number}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={t(
                `common.orderStatus.${order.current_status}`,
                order.current_status
              )}
              color={getStatusColor(order.current_status) as any}
              size="small"
            />
            {order.requires_fast_delivery && (
              <Chip
                label={t('orders.fastDelivery.title', 'Fast Delivery')}
                color="warning"
                size="small"
                icon={<FlashOn fontSize="small" />}
              />
            )}
          </Box>
        </Box>

        {/* Business and Client Info */}
        <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BusinessIcon color="primary" sx={{ fontSize: 16 }} />
            <Typography variant="body2" color="text.secondary">
              {order.business?.name || t('common.business', 'Business')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PersonIcon color="primary" sx={{ fontSize: 16 }} />
            <Typography variant="body2" color="text.secondary">
              {order.client?.user?.first_name} {order.client?.user?.last_name}
            </Typography>
          </Box>
        </Box>

        {/* Addresses */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
          {/* Pickup Address */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <LocationIcon color="primary" sx={{ fontSize: 16, mt: 0.2 }} />
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
              >
                {t('orders.pickupAddress', 'Pickup from')}:
              </Typography>
              <Typography variant="body2">
                {formatAddress(order.business_location?.address)}
              </Typography>
            </Box>
          </Box>

          {/* Delivery Address */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <LocationIcon color="secondary" sx={{ fontSize: 16, mt: 0.2 }} />
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600 }}
              >
                {t('orders.deliveryAddress', 'Deliver to')}:
              </Typography>
              <Typography variant="body2">
                {formatAddress(order.delivery_address)}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Order Summary */}
        <Stack spacing={2} sx={{ mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', sm: 'flex-start' },
              gap: 2,
            }}
          >
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="body2"
                color="text.secondary"
                gutterBottom
              >
                {t('orders.items', 'Items')}: {order.order_items?.length || 0}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                gutterBottom
              >
                {t('orders.totalQuantity', 'Total Quantity')}:{' '}
                {getTotalItemQuantity()}
              </Typography>
            </Box>

            {/* Delivery Commission Highlight - More Prominent */}
            {order.delivery_commission !== undefined && (
              <Box
                sx={{
                  textAlign: { xs: 'left', sm: 'right' },
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  p: 2,
                  minWidth: { xs: '100%', sm: 160 },
                  border: `2px solid ${theme.palette.success.main}`,
                  boxShadow: `0 2px 8px ${theme.palette.success.main}20`,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: { xs: 'flex-start', sm: 'flex-end' },
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  <DeliveryIcon color="success" sx={{ fontSize: 24 }} />
                  <Typography
                    variant="h5"
                    color="success.main"
                    sx={{ fontWeight: 700 }}
                  >
                    {formatCurrency(order.delivery_commission, order.currency)}
                  </Typography>
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 600, textTransform: 'uppercase' }}
                >
                  {t('orders.deliveryCommission', 'Delivery Commission')}
                </Typography>
              </Box>
            )}
          </Box>
        </Stack>

        {/* Action Buttons */}
        <Stack
          direction={isMobile ? 'column' : 'row'}
          spacing={2}
          sx={{
            justifyContent: 'flex-end',
            alignItems: isMobile ? 'stretch' : 'center',
          }}
        >
          <Button
            variant="outlined"
            color="primary"
            onClick={() => navigate(`/orders/${order.id}`)}
            sx={{
              fontWeight: 600,
              width: isMobile ? '100%' : 'auto',
            }}
          >
            {t('orders.viewOrderDetails', 'View Order Details')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleClaim}
            disabled={claimLoading}
            startIcon={
              claimLoading ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <CheckCircle />
              )
            }
            sx={{
              fontWeight: 700,
              fontSize: '1rem',
              py: 1.5,
              px: 3,
              minWidth: isMobile ? '100%' : 180,
              width: isMobile ? '100%' : 'auto',
              boxShadow: '0 4px 14px 0 rgba(25, 118, 210, 0.39)',
              '&:hover': {
                boxShadow: '0 6px 20px 0 rgba(25, 118, 210, 0.5)',
                transform: 'translateY(-2px)',
              },
              transition: 'all 0.3s ease-in-out',
            }}
          >
            {claimLoading
              ? t('orderActions.claiming', 'Claiming...')
              : t('orderActions.claimOrder', 'Claim Order')}
          </Button>
        </Stack>
      </CardContent>

      {/* Claim Order Dialog */}
      <ClaimOrderDialog
        open={showClaimDialog}
        onClose={handleCloseClaimDialog}
        onConfirm={handleClaimWithTopup}
        order={order as unknown as OrderData}
        userPhoneNumber={profile?.phone_number}
        loading={claimLoading}
        success={claimSuccess}
        error={claimError}
      />

      {/* Claim Confirmation Dialog */}
      <ConfirmationModal
        open={showClaimConfirmation}
        title={t('orders.confirmClaimOrder', 'Confirm Claim Order')}
        message={t(
          'orders.confirmClaimOrderMessage',
          'Are you sure you want to claim order #{{orderNumber}}? This action cannot be undone.',
          { orderNumber: order.order_number }
        )}
        confirmText={t('orderActions.claimOrder', 'Claim Order')}
        cancelText={t('common.cancel', 'Cancel')}
        onConfirm={handleConfirmClaim}
        onCancel={() => setShowClaimConfirmation(false)}
        confirmColor="primary"
        loading={claimLoading}
      />
    </Card>
  );
};

export default AvailableOrderCard;
