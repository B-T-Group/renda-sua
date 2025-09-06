import { Category, LocationOn, ShoppingCart } from '@mui/icons-material';
import {
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
import { InventoryItem } from '../../hooks/useInventoryItems';

interface DashboardItemCardProps {
  item: InventoryItem;
  formatCurrency: (amount: number, currency?: string) => string;
  onOrderClick: (item: InventoryItem) => void;
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
  formatCurrency,
  onOrderClick,
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
        flexDirection: 'row',
        overflow: 'hidden',
      }}
    >
      {/* Image Section - Left Side */}
      <Box sx={{ width: '300px', flexShrink: 0 }}>
        <CardMedia
          component="img"
          height="200"
          image={getPrimaryImage(inventory)}
          alt={inventory.item.name}
          sx={{
            objectFit: 'cover',
            width: '100%',
            height: '100%',
          }}
        />
      </Box>

      {/* Content Section - Right Side */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1, p: 2 }}>
          {/* Header with Brand and Availability */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              mb: 1,
            }}
          >
            <Box sx={{ flex: 1 }}>
              {inventory.item.brand && (
                <Typography
                  variant="body2"
                  color="primary"
                  fontWeight="bold"
                  sx={{ mb: 0.5 }}
                >
                  {inventory.item.brand.name}
                </Typography>
              )}
              <Typography
                variant="h6"
                gutterBottom
                sx={{ mb: 1, lineHeight: 1.2 }}
              >
                {inventory.item.name}
              </Typography>
            </Box>
            <Chip
              label={`${inventory.computed_available_quantity} available`}
              color={
                inventory.computed_available_quantity > 0 ? 'success' : 'error'
              }
              size="small"
              sx={{ ml: 1 }}
            />
          </Box>

          {/* Price Section */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="h5" color="primary" fontWeight="bold">
              {formatCurrency(inventory.selling_price, inventory.item.currency)}
            </Typography>
          </Box>

          {/* Key Details Row */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <Category fontSize="small" />
              {inventory.item.item_sub_category?.item_category?.name} →{' '}
              {inventory.item.item_sub_category?.name}
            </Typography>

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

          {/* Special Handling Chips */}
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
        </CardContent>

        {/* Action Button */}
        <CardActions sx={{ p: 2, pt: 0, justifyContent: 'flex-end' }}>
          {inventory.computed_available_quantity === 0 ? (
            <Button variant="outlined" disabled>
              Out of Stock
            </Button>
          ) : !inventory.is_active ? (
            <Button variant="outlined" disabled>
              Not Available
            </Button>
          ) : isPublicView ? (
            <Button
              variant="contained"
              color="primary"
              startIcon={<ShoppingCart />}
              onClick={() => onOrderClick(inventory)}
            >
              {loginButtonText}
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={<ShoppingCart />}
              onClick={() => onOrderClick(inventory)}
            >
              {orderButtonText}
            </Button>
          )}
        </CardActions>
      </Box>
    </Card>
  );
};

export default DashboardItemCard;
