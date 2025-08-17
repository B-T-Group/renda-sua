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
import React from 'react';
import { DeliveryFee } from '../../hooks/useDeliveryFees';
import { InventoryItem } from '../../hooks/useInventoryItems';

interface OrderDialogProps {
  open: boolean;
  selectedItem: InventoryItem | null;
  quantity: number;
  specialInstructions: string;
  orderLoading: boolean;
  formatCurrency: (amount: number, currency?: string) => string;
  deliveryFee: DeliveryFee | null;
  onClose: () => void;
  onQuantityChange: (quantity: number) => void;
  onSpecialInstructionsChange: (instructions: string) => void;
  onSubmit: () => void;
}

const OrderDialog: React.FC<OrderDialogProps> = ({
  open,
  selectedItem,
  quantity,
  specialInstructions,
  orderLoading,
  formatCurrency,
  deliveryFee,
  onClose,
  onQuantityChange,
  onSpecialInstructionsChange,
  onSubmit,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
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
                  {selectedItem.item.brand.name}
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
                onChange={(e) => onQuantityChange(e.target.value as number)}
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
              onChange={(e) => onSpecialInstructionsChange(e.target.value)}
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <FormControlLabel
                control={<Switch color="primary" />}
                label="Require verified agent for delivery"
              />
            </Box>

            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Order Summary
              </Typography>
              <Typography variant="body2">
                Subtotal:{' '}
                {formatCurrency(selectedItem.selling_price * quantity)}
              </Typography>
              <Typography variant="body2">
                Delivery Fee:{' '}
                {formatCurrency(deliveryFee?.fee || 0, deliveryFee?.currency)}
              </Typography>
              <Typography variant="body2">Tax: {formatCurrency(0)}</Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="h6">
                Total:{' '}
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
                💳 Account Hold Information
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
                <strong style={{ color: '#1976d2' }}>Important:</strong> A hold
                of{' '}
                <strong style={{ color: '#1976d2' }}>
                  {formatCurrency(selectedItem.selling_price * quantity)}
                </strong>{' '}
                will be placed on your account. This amount will only be
                released to the seller after you confirm receipt of your order.
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={onSubmit}
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
  );
};

export default OrderDialog;
