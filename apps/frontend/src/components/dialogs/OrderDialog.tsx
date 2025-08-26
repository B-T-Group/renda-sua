import { ShoppingCart } from '@mui/icons-material';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../hooks/useApiClient';
import { DeliveryFee } from '../../hooks/useDeliveryFees';
import { InventoryItem } from '../../hooks/useInventoryItems';

interface OrderDialogProps {
  open: boolean;
  selectedItem: InventoryItem | null;
  quantity: number;
  specialInstructions: string;
  formatCurrency: (amount: number, currency?: string) => string;
  deliveryFee: DeliveryFee | null;
  onClose: () => void;
  onQuantityChange: (quantity: number) => void;
  onSpecialInstructionsChange: (instructions: string) => void;
  onOrderSuccess?: (order: any) => void;
  onOrderError?: (error: string) => void;
}

const OrderDialog: React.FC<OrderDialogProps> = ({
  open,
  selectedItem,
  quantity,
  specialInstructions,
  formatCurrency,
  deliveryFee,
  onClose,
  onQuantityChange,
  onSpecialInstructionsChange,
  onOrderSuccess,
  onOrderError,
}) => {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [verifiedAgentDelivery, setVerifiedAgentDelivery] = useState(false);

  const handleSubmit = async () => {
    if (!selectedItem || !apiClient) return;

    setLoading(true);
    try {
      const orderData = {
        item: {
          business_inventory_id: selectedItem.id,
          quantity: quantity,
        },
        verified_agent_delivery: verifiedAgentDelivery,
        special_instructions: specialInstructions.trim() || undefined,
      };

      const response = await apiClient.post('/orders', orderData);

      if (!response.data.success) {
        throw new Error(response.data.message || 'Failed to create order');
      }

      // Call success callback if provided
      onOrderSuccess?.(response.data.order);

      // Close the dialog
      onClose();
    } catch (error: any) {
      console.error('Error creating order:', error);
      const errorMessage =
        error.response?.data?.error ||
        error.message ||
        t('orders.createError', 'Failed to create order');
      onOrderError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('orders.placeOrder', 'Place Order')}</DialogTitle>
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
                  {selectedItem.item.brand.name}
                </Typography>
              )}
              {selectedItem.item.model && (
                <Typography variant="body2" color="text.secondary">
                  {t('common.model', 'Model')}: {selectedItem.item.model}
                </Typography>
              )}
              {selectedItem.item.color && (
                <Typography variant="body2" color="text.secondary">
                  {t('common.color', 'Color')}: {selectedItem.item.color}
                </Typography>
              )}
              {selectedItem.item.material && (
                <Typography variant="body2" color="text.secondary">
                  {t('common.material', 'Material')}:{' '}
                  {selectedItem.item.material}
                </Typography>
              )}
              {selectedItem.item.sku && (
                <Typography variant="body2" color="text.secondary">
                  {t('common.sku', 'SKU')}: {selectedItem.item.sku}
                </Typography>
              )}
            </Box>

            {/* Special Handling Indicators */}
            <Box sx={{ mb: 2 }}>
              {selectedItem.item.is_fragile && (
                <Chip
                  label={t('items.fragile', 'Fragile')}
                  color="warning"
                  size="small"
                  sx={{ mr: 0.5, mb: 0.5 }}
                />
              )}
              {selectedItem.item.is_perishable && (
                <Chip
                  label={t('items.perishable', 'Perishable')}
                  color="error"
                  size="small"
                  sx={{ mr: 0.5, mb: 0.5 }}
                />
              )}
              {selectedItem.item.requires_special_handling && (
                <Chip
                  label={t('items.specialHandling', 'Special Handling')}
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
                  {t('orders.estimatedDelivery', 'Estimated Delivery')}:{' '}
                  {selectedItem.item.estimated_delivery_time}{' '}
                  {t('common.minutes', 'minutes')}
                </Typography>
              )}
              {selectedItem.item.max_delivery_distance && (
                <Typography variant="body2" color="text.secondary">
                  {t('orders.maxDeliveryDistance', 'Max Delivery Distance')}:{' '}
                  {selectedItem.item.max_delivery_distance}{' '}
                  {t('common.km', 'km')}
                </Typography>
              )}
              {selectedItem.item.min_order_quantity &&
                selectedItem.item.min_order_quantity > 1 && (
                  <Typography variant="body2" color="text.secondary">
                    {t('orders.minimumOrder', 'Minimum Order')}:{' '}
                    {selectedItem.item.min_order_quantity}
                  </Typography>
                )}
              {selectedItem.item.max_order_quantity && (
                <Typography variant="body2" color="text.secondary">
                  {t('orders.maximumOrder', 'Maximum Order')}:{' '}
                  {selectedItem.item.max_order_quantity}
                </Typography>
              )}
            </Box>

            <Box sx={{ mb: 3 }}>
              <Typography variant="h5" color="primary">
                {formatCurrency(
                  selectedItem.selling_price,
                  selectedItem.item.currency
                )}{' '}
                {t('orders.perItem', 'per item')}
              </Typography>
            </Box>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>{t('orders.quantity', 'Quantity')}</InputLabel>
              <Select
                value={quantity}
                label={t('orders.quantity', 'Quantity')}
                onChange={(e) => onQuantityChange(e.target.value as number)}
                disabled={loading}
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
              label={t('orders.specialInstructions', 'Special Instructions')}
              multiline
              rows={3}
              value={specialInstructions}
              onChange={(e) => onSpecialInstructionsChange(e.target.value)}
              disabled={loading}
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
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
            </Box>

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
                {formatCurrency(deliveryFee?.fee || 0, deliveryFee?.currency)}
              </Typography>
              <Typography variant="body2">
                {t('orders.tax', 'Tax')}: {formatCurrency(0)}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="h6">
                {t('orders.total', 'Total')}:{' '}
                {formatCurrency(
                  selectedItem.selling_price * quantity +
                    (deliveryFee?.fee || 0),
                  deliveryFee?.currency || 'USD'
                )}
              </Typography>
            </Box>

            {/* Account Hold Notice */}
            <Box
              sx={{
                p: 2,
                bgcolor: 'rgba(25, 118, 210, 0.08)',
                borderRadius: 1,
                mt: 2,
                border: '1px solid',
                borderColor: 'info.main',
              }}
            >
              <Typography
                variant="subtitle1"
                color="text.primary"
                gutterBottom
                fontWeight="bold"
                sx={{
                  color: '#1976d2',
                  textShadow: '0 0 0 rgba(255,255,255,0.8)',
                }}
              >
                <span role="img" aria-label="credit card">
                  💳
                </span>{' '}
                {t('orders.accountHoldInformation', 'Account Hold Information')}
              </Typography>
              <Typography
                variant="body2"
                color="text.primary"
                sx={{
                  lineHeight: 1.6,
                  color: '#424242',
                  fontWeight: 500,
                }}
              >
                <strong style={{ color: '#1976d2' }}>
                  {t('orders.important', 'Important')}:
                </strong>{' '}
                {t('orders.accountHoldMessage', 'A hold of')}{' '}
                <strong style={{ color: '#1976d2' }}>
                  {formatCurrency(
                    selectedItem.selling_price * quantity,
                    selectedItem.item.currency
                  )}
                </strong>{' '}
                {t(
                  'orders.accountHoldMessage2',
                  'will be placed on your account. This amount will only be released to the seller after you confirm receipt of your order.'
                )}
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !selectedItem || !apiClient}
          startIcon={
            loading ? <CircularProgress size={20} /> : <ShoppingCart />
          }
        >
          {loading
            ? t('orders.placingOrder', 'Placing Order...')
            : t('orders.placeOrder', 'Place Order')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OrderDialog;
