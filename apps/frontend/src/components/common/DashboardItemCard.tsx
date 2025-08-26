import {
  AccountBalanceWallet,
  Category,
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
  Typography,
} from '@mui/material';
import React from 'react';
import NoImage from '../../assets/no-image.svg';
import { Account } from '../../hooks/useAccountInfo';
import { InventoryItem } from '../../hooks/useInventoryItems';

interface DashboardItemCardProps {
  item: InventoryItem;
  canAfford: boolean;
  account?: Account;
  insufficientFundsMessage?: string;
  formatCurrency: (amount: number, currency?: string) => string;
  onOrderClick: (item: InventoryItem) => void;
  onTopUpClick: () => void;
  estimatedDistance?: string | null;
  estimatedDuration?: string | null;
  distanceLoading?: boolean;
  distanceError?: string | null;
  // New props for customization
  isPublicView?: boolean;
  loginButtonText?: string;
  orderButtonText?: string;
}

const DashboardItemCard: React.FC<DashboardItemCardProps> = ({
  item: inventory,
  canAfford,
  account,
  insufficientFundsMessage,
  formatCurrency,
  onOrderClick,
  onTopUpClick,
  estimatedDistance,
  estimatedDuration,
  distanceLoading,
  distanceError,
  isPublicView = false,
  loginButtonText = 'Login to Order',
  orderButtonText = 'Order Now',
}) => {
  const getPrimaryImage = (item: InventoryItem) => {
    if (item.item.item_images && item.item.item_images.length > 0) {
      return item.item.item_images[0].image_url;
    }
    return NoImage;
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <CardMedia
        component="img"
        height="200"
        image={getPrimaryImage(inventory)}
        alt={inventory.item.name}
        sx={{ objectFit: 'cover' }}
      />
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" gutterBottom>
          {inventory.item.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          {inventory.item.description}
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Typography variant="h5" color="primary" gutterBottom>
            {formatCurrency(inventory.selling_price, inventory.item.currency)}
          </Typography>
          <Chip
            label={`${inventory.available_quantity} available`}
            color={inventory.available_quantity > 0 ? 'success' : 'error'}
            size="small"
          />
        </Box>

        {/* Fund Status */}
        {!canAfford &&
          inventory.available_quantity > 0 &&
          inventory.is_active && (
            <Alert severity="warning" sx={{ mb: 2 }} icon={<Warning />}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {insufficientFundsMessage}
              </Typography>
              {account && (
                <Typography variant="caption" color="text.secondary">
                  Current balance:{' '}
                  {formatCurrency(account.available_balance, account.currency)}
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
            {inventory.item.item_sub_category?.item_category?.name} →{' '}
            {inventory.item.item_sub_category?.name}
          </Typography>
          {inventory.item.weight && (
            <Typography variant="body2" color="text.secondary">
              Weight: {inventory.item.weight} {inventory.item.weight_unit}
            </Typography>
          )}
          {inventory.item.size && (
            <Typography variant="body2" color="text.secondary">
              Size: {inventory.item.size} {inventory.item.size_unit}
            </Typography>
          )}
        </Box>

        {/* Product Details */}
        <Box sx={{ mb: 2 }}>
          {inventory.item.brand && (
            <Typography
              variant="body1"
              color="primary"
              fontWeight="bold"
              sx={{ mb: 0.5 }}
            >
              {inventory.item.brand.name}
            </Typography>
          )}
          {inventory.item.model && (
            <Typography variant="body2" color="text.secondary">
              Model: {inventory.item.model}
            </Typography>
          )}
          {inventory.item.color && (
            <Typography variant="body2" color="text.secondary">
              Color: {inventory.item.color}
            </Typography>
          )}
          {inventory.item.material && (
            <Typography variant="body2" color="text.secondary">
              Material: {inventory.item.material}
            </Typography>
          )}
          {inventory.item.sku && (
            <Typography variant="body2" color="text.secondary">
              SKU: {inventory.item.sku}
            </Typography>
          )}
        </Box>

        {/* Special Handling Indicators */}
        <Box sx={{ mb: 2 }}>
          {inventory.item.is_fragile && (
            <Chip
              label="Fragile"
              color="warning"
              size="small"
              sx={{ mr: 0.5, mb: 0.5 }}
            />
          )}
          {inventory.item.is_perishable && (
            <Chip
              label="Perishable"
              color="error"
              size="small"
              sx={{ mr: 0.5, mb: 0.5 }}
            />
          )}
          {inventory.item.requires_special_handling && (
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
          {inventory.item.min_order_quantity &&
            inventory.item.min_order_quantity > 1 && (
              <Typography variant="body2" color="text.secondary">
                Min Order: {inventory.item.min_order_quantity}
              </Typography>
            )}
          {inventory.item.max_order_quantity && (
            <Typography variant="body2" color="text.secondary">
              Max Order: {inventory.item.max_order_quantity}
            </Typography>
          )}
          {/* Estimated Distance/Time from Distance Matrix */}
          {distanceLoading && (
            <Typography variant="body2" color="text.secondary">
              Calculating distance...
            </Typography>
          )}
          {distanceError && (
            <Typography variant="body2" color="error">
              Error: {distanceError}
            </Typography>
          )}
          {estimatedDistance && estimatedDuration && (
            <Typography variant="body2" color="text.secondary">
              Distance: {estimatedDistance}, Duration: {estimatedDuration}
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
            {inventory.business_location.address?.city},{' '}
            {inventory.business_location.address?.state}
          </Typography>
        </Box>
      </CardContent>
      <CardActions>
        {inventory.available_quantity === 0 ? (
          <Button variant="outlined" fullWidth disabled>
            Out of Stock
          </Button>
        ) : !inventory.is_active ? (
          <Button variant="outlined" fullWidth disabled>
            Not Available
          </Button>
        ) : isPublicView && !canAfford ? (
          <Button
            variant="contained"
            color="primary"
            startIcon={<ShoppingCart />}
            fullWidth
            onClick={() => onOrderClick(inventory)}
          >
            {loginButtonText}
          </Button>
        ) : canAfford ? (
          <Button
            variant="contained"
            startIcon={<ShoppingCart />}
            fullWidth
            onClick={() => onOrderClick(inventory)}
          >
            {orderButtonText}
          </Button>
        ) : (
          <Button
            variant="outlined"
            color="warning"
            startIcon={<AccountBalanceWallet />}
            fullWidth
            onClick={onTopUpClick}
          >
            Top Up Account
          </Button>
        )}
      </CardActions>
    </Card>
  );
};

export default DashboardItemCard;
