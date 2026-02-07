import {
  AttachMoney,
  Business as BusinessIcon,
  CheckCircle,
  LocalShipping as DeliveryIcon,
  FlashOn,
  LocationOn as LocationIcon,
  Person as PersonIcon,
  Phone,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import type { Order } from '../../hooks/useAgentOrders';
import { useApiClient } from '../../hooks/useApiClient';
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
  const navigate = useNavigate();
  const apiClient = useApiClient();
  const { profile, accounts: agentAccounts } = useUserProfileContext();

  // Claim dialog state
  const [showClaimDialog, setShowClaimDialog] = useState(false);
  const [showClaimConfirmation, setShowClaimConfirmation] = useState(false);
  const [showPaymentApprovalConfirmation, setShowPaymentApprovalConfirmation] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [claimError, setClaimError] = useState<string | undefined>();

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Calculate cost to claim order (hold amount + service charge)
  const getClaimCost = () => {
    const holdAmount = order.agent_hold_amount || 0;
    const chargePercentage = 3.5;
    const chargeAmount = (holdAmount * chargePercentage) / 100;
    return holdAmount + chargeAmount;
  };

  // Check if agent has sufficient funds to claim the order
  const hasSufficientFunds = () => {
    if (!agentAccounts?.length) return false; // Assume insufficient if no account data

    // Use hold amount from order (calculated by backend)
    const requiredHoldAmount = order.agent_hold_amount || 0;

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

  // Aggregate item specs from order_items
  const getItemSpecs = () => {
    if (!order.order_items || order.order_items.length === 0) {
      return { totalWeight: null, weightUnit: null, dimensions: [], isFragile: false, isPerishable: false };
    }
    let totalWeight: number | null = null;
    let weightUnit: string | null = null;
    const dimensionsSet = new Set<string>();
    let isFragile = false;
    let isPerishable = false;

    order.order_items.forEach((oi) => {
      const it = oi.item;
      const qty = oi.quantity || 1;
      if (it?.weight != null) {
        totalWeight = (totalWeight ?? 0) + it.weight * qty;
        weightUnit = it.weight_unit || weightUnit || 'kg';
      }
      if (it?.dimensions) dimensionsSet.add(it.dimensions);
      if (it?.is_fragile) isFragile = true;
      if (it?.is_perishable) isPerishable = true;
    });

    return {
      totalWeight,
      weightUnit,
      dimensions: Array.from(dimensionsSet),
      isFragile,
      isPerishable,
    };
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
        error.message || t('messages.orderClaimError', 'Failed to claim order')
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
        // Show payment approval confirmation screen first
        // Don't call onClaimSuccess or navigate yet - wait for user confirmation
        setShowPaymentApprovalConfirmation(true);
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

  const handleGoToOrder = () => {
    setShowPaymentApprovalConfirmation(false);
    // Now call onClaimSuccess and navigate after user has acknowledged payment approval
    onClaimSuccess?.();
    navigate(`/orders/${order.id}`);
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

  return (
    <Card
      sx={{
        mb: 1.5,
        position: 'relative',
      }}
    >
      {/* Order Details */}
      <CardContent
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 1.5 }}
      >
        {/* Header Row */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 1,
            gap: 1,
          }}
        >
          <Typography
            variant="h6"
            component="h3"
            sx={{ fontWeight: 600, fontSize: '1.1rem' }}
          >
            Order #{order.order_number}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <Chip
              label={t(
                `common.orderStatus.${order.current_status}`,
                order.current_status
              )}
              color={getStatusColor(order.current_status) as any}
              size="small"
              sx={{ height: 24, fontSize: '0.7rem' }}
            />
            {order.requires_fast_delivery && (
              <Chip
                label={t('orders.fastDelivery.title', 'Fast Delivery')}
                color="warning"
                size="small"
                icon={<FlashOn sx={{ fontSize: 14 }} />}
                sx={{ height: 24, fontSize: '0.7rem' }}
              />
            )}
          </Box>
        </Box>

        {/* Business and Client Info - Compact */}
        <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <BusinessIcon color="primary" sx={{ fontSize: 14 }} />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.75rem' }}
            >
              {order.business?.name || t('common.business', 'Business')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <PersonIcon color="primary" sx={{ fontSize: 14 }} />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.75rem' }}
            >
              {order.client?.user?.first_name}
              {profile?.agent?.id &&
                order.assigned_agent_id &&
                order.assigned_agent_id === profile.agent.id &&
                order.client?.user?.phone_number && (
                  <> 📞 {order.client.user.phone_number}</>
                )}
            </Typography>
          </Box>
        </Box>

        {/* Addresses - Full Text, Vertically Aligned */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
            <LocationIcon
              color="primary"
              sx={{ fontSize: 14, mt: 0.25, flexShrink: 0 }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.7rem', lineHeight: 1.4 }}
            >
              <strong>{t('orders.pickupAddress', 'Pickup')}:</strong>{' '}
              {formatAddress(order.business_location?.address)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
            <LocationIcon
              color="secondary"
              sx={{ fontSize: 14, mt: 0.25, flexShrink: 0 }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.7rem', lineHeight: 1.4 }}
            >
              <strong>{t('orders.deliveryAddress', 'Deliver')}:</strong>{' '}
              {formatAddress(order.delivery_address)}
              {profile?.agent?.id &&
                order.assigned_agent_id &&
                order.assigned_agent_id === profile.agent.id &&
                order.client?.user?.phone_number && (
                  <> • 📞 {order.client.user.phone_number}</>
                )}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 1 }} />

        {/* Order Summary - Compact Horizontal Layout */}
        <Box sx={{ mb: 1.5 }}>
          {/* Financial Info - Inline */}
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              mb: 1,
              flexWrap: 'wrap',
            }}
          >
            {/* Delivery Commission */}
            {order.delivery_commission !== undefined && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  bgcolor: 'success.50',
                  borderRadius: 1,
                  px: 1.5,
                  py: 0.75,
                  border: `1px solid ${theme.palette.success.main}40`,
                }}
              >
                <DeliveryIcon color="success" sx={{ fontSize: 18 }} />
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      fontSize: '0.65rem',
                      display: 'block',
                      lineHeight: 1,
                    }}
                  >
                    {t('orders.deliveryCommission', 'Earn')}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="success.main"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      lineHeight: 1.2,
                    }}
                  >
                    {formatCurrency(order.delivery_commission, order.currency)}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Claim Cost */}
            {order.agent_hold_amount !== undefined &&
              order.agent_hold_amount > 0 && (
                <Box
                  sx={{
                    bgcolor: 'warning.50',
                    borderRadius: 1,
                    px: 1.5,
                    py: 1,
                    border: `1px solid ${theme.palette.warning.main}40`,
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      mb: 0.5,
                    }}
                  >
                    <AttachMoney color="warning" sx={{ fontSize: 18 }} />
                    <Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          fontSize: '0.65rem',
                          display: 'block',
                          lineHeight: 1,
                        }}
                      >
                        {t('orders.costToClaim', 'Caution')}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="warning.main"
                        sx={{
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          lineHeight: 1.2,
                        }}
                      >
                        {formatCurrency(getClaimCost(), order.currency)}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      fontSize: '0.7rem',
                      display: 'block',
                      lineHeight: 1.3,
                      ml: 3.5,
                    }}
                  >
                    {t(
                      'orders.costToClaimDescription',
                      'A security deposit is required to claim this order. This amount is automatically calculated and will be released upon successful delivery.'
                    )}
                  </Typography>
                </Box>
              )}

            {/* Items Count */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                color: 'text.secondary',
              }}
            >
              <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                {order.order_items?.length || 0} {t('orders.items', 'items')} •{' '}
                {getTotalItemQuantity()} {t('orders.totalQuantity', 'qty')}
              </Typography>
            </Box>
          </Box>

          {/* Item specs: weight, dimensions, fragile, perishable */}
          {(() => {
            const specs = getItemSpecs();
            const hasSpecs =
              specs.totalWeight != null ||
              specs.dimensions.length > 0 ||
              specs.isFragile ||
              specs.isPerishable;
            if (!hasSpecs) return null;
            return (
              <Box
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  mt: 1,
                }}
              >
                {specs.totalWeight != null && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    <strong>{t('orders.weight', 'Weight')}:</strong>{' '}
                    {specs.totalWeight} {specs.weightUnit || 'kg'}
                  </Typography>
                )}
                {specs.dimensions.length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    <strong>{t('orders.dimensions', 'Dimensions')}:</strong>{' '}
                    {specs.dimensions.join(', ')}
                  </Typography>
                )}
                {specs.isFragile && (
                  <Chip
                    label={t('orders.fragile', 'Fragile')}
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                )}
                {specs.isPerishable && (
                  <Chip
                    label={t('orders.perishable', 'Perishable')}
                    size="small"
                    color="info"
                    variant="outlined"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                )}
              </Box>
            );
          })()}
        </Box>

        {/* Action Buttons - Compact */}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            justifyContent: 'flex-end',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Button
            variant="outlined"
            color="primary"
            size="small"
            onClick={() => navigate(`/orders/${order.id}`)}
            sx={{
              fontWeight: 600,
              fontSize: '0.8rem',
              py: 0.5,
              px: 1.5,
            }}
          >
            {t('orders.viewOrderDetails', 'Details')}
          </Button>
          <Button
            variant="contained"
            color="primary"
            size="medium"
            onClick={handleClaim}
            disabled={claimLoading}
            startIcon={
              claimLoading ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <CheckCircle sx={{ fontSize: 18 }} />
              )
            }
            sx={{
              fontWeight: 700,
              fontSize: '0.85rem',
              py: 0.75,
              px: 2,
              minWidth: 120,
            }}
          >
            {claimLoading
              ? t('orderActions.claiming', 'Claiming...')
              : t('orderActions.claimOrder', 'Claim Order')}
          </Button>
        </Box>
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
          'Are you sure you want to claim order #{{orderNumber}}? Claiming an order can be undone.',
          { orderNumber: order.order_number }
        )}
        confirmText={t('orderActions.claimOrder', 'Claim Order')}
        cancelText={t('common.cancel', 'Cancel')}
        onConfirm={handleConfirmClaim}
        onCancel={() => setShowClaimConfirmation(false)}
        confirmColor="primary"
        loading={claimLoading}
        additionalContent={
          order.agent_hold_amount !== undefined &&
          order.agent_hold_amount > 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                {t(
                  'orders.claimOrderHoldAmountInfo',
                  'Please note: {{holdAmount}} will be withheld from your account as a guarantee. This amount will be released upon successful delivery.',
                  {
                    holdAmount: formatCurrency(
                      order.agent_hold_amount,
                      order.currency
                    ),
                  }
                )}
              </Typography>
            </Alert>
          ) : undefined
        }
      />

      {/* Payment Approval Confirmation Dialog */}
      <Dialog
        open={showPaymentApprovalConfirmation}
        onClose={undefined} // Prevent closing without action
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'warning.50',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Phone color="warning" sx={{ fontSize: 28 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {t(
                  'agent.paymentApproval.title',
                  'Approve Payment on Your Phone'
                )}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 3 }} icon={<Phone />}>
            <Typography variant="body2" fontWeight="medium">
              {t(
                'agent.paymentApproval.message',
                'A payment request has been sent to your phone. Please check your phone and approve the payment request to complete claiming this order.'
              )}
            </Typography>
          </Alert>

          <Box sx={{ mb: 3 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              <strong>{t('agent.paymentApproval.orderNumber', 'Order Number')}:</strong>{' '}
              {order.order_number}
            </Typography>
          </Box>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              {t(
                'agent.paymentApproval.instruction',
                'Once you approve the payment on your phone, the order will be assigned to you. You can then proceed to view the order details and start the delivery process.'
              )}
            </Typography>
          </Alert>

          <Alert severity="success" icon={<CheckCircle />}>
            <Typography variant="body2" fontWeight="medium">
              {t(
                'agent.paymentApproval.note',
                'After approving the payment, click "Go to Order" below to view the order details.'
              )}
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={handleGoToOrder}
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            startIcon={<CheckCircle />}
            sx={{
              fontWeight: 'bold',
            }}
          >
            {t('agent.paymentApproval.goToOrder', 'Go to Order')}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default AvailableOrderCard;
