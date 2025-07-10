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
}

const DashboardItemCard: React.FC<DashboardItemCardProps> = ({
  item,
  canAfford,
  account,
  insufficientFundsMessage,
  formatCurrency,
  onOrderClick,
  onTopUpClick,
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
        {!canAfford && item.available_quantity > 0 && item.is_active && (
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

        {/* Product Details */}
        <Box sx={{ mb: 2 }}>
          {item.item.brand && (
            <Typography
              variant="body1"
              color="primary"
              fontWeight="bold"
              sx={{ mb: 0.5 }}
            >
              {item.item.brand.name}
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
          {item.item.min_order_quantity && item.item.min_order_quantity > 1 && (
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
            {item.business_location.address?.city},{' '}
            {item.business_location.address?.state}
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
            onClick={() => onOrderClick(item)}
          >
            Order Now
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
