import {
  Build,
  Business,
  Category,
  LocalShipping,
  LocationOn,
  Palette,
  Scale,
  Schedule,
  ShoppingCart,
  Straighten,
  Verified,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  Divider,
  Grid,
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
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
      }}
    >
      {/* Image Section - Left Side */}
      <Box sx={{ width: '300px', flexShrink: 0 }}>
        <CardMedia
          component="img"
          height="400"
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
              mb: 2,
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

          {/* Business Information */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Business fontSize="small" color="primary" />
              <Typography variant="body2" fontWeight="medium">
                {inventory.business_location.business.name}
              </Typography>
              {inventory.business_location.business.is_verified && (
                <Verified fontSize="small" color="success" />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              {inventory.business_location.name}
            </Typography>
          </Box>

          {/* Pickup Address */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <LocationOn fontSize="small" color="primary" />
              <Typography variant="body2" fontWeight="medium">
                Pickup Address
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ ml: 3 }}>
              {inventory.business_location.address.address_line_1}
              {inventory.business_location.address.address_line_2 &&
                `, ${inventory.business_location.address.address_line_2}`}
              <br />
              {inventory.business_location.address.city},{' '}
              {inventory.business_location.address.state}{' '}
              {inventory.business_location.address.postal_code}
              <br />
              {inventory.business_location.address.country}
            </Typography>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Item Details Grid */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {/* Category */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
              >
                <Category fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight="medium">
                  Category
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 3 }}>
                {inventory.item.item_sub_category?.item_category?.name} →{' '}
                {inventory.item.item_sub_category?.name}
              </Typography>
            </Grid>

            {/* SKU */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}
              >
                <Build fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight="medium">
                  SKU
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ ml: 3 }}>
                {inventory.item.sku || 'N/A'}
              </Typography>
            </Grid>

            {/* Weight */}
            {inventory.item.weight && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  <Scale fontSize="small" color="primary" />
                  <Typography variant="body2" fontWeight="medium">
                    Weight
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ ml: 3 }}
                >
                  {inventory.item.weight} {inventory.item.weight_unit}
                </Typography>
              </Grid>
            )}

            {/* Size */}
            {inventory.item.size && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  <Straighten fontSize="small" color="primary" />
                  <Typography variant="body2" fontWeight="medium">
                    Size
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ ml: 3 }}
                >
                  {inventory.item.size} {inventory.item.size_unit}
                </Typography>
              </Grid>
            )}

            {/* Model */}
            {inventory.item.model && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  <Build fontSize="small" color="primary" />
                  <Typography variant="body2" fontWeight="medium">
                    Model
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ ml: 3 }}
                >
                  {inventory.item.model}
                </Typography>
              </Grid>
            )}

            {/* Color */}
            {inventory.item.color && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  <Palette fontSize="small" color="primary" />
                  <Typography variant="body2" fontWeight="medium">
                    Color
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ ml: 3 }}
                >
                  {inventory.item.color}
                </Typography>
              </Grid>
            )}

            {/* Material */}
            {inventory.item.material && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  <Build fontSize="small" color="primary" />
                  <Typography variant="body2" fontWeight="medium">
                    Material
                  </Typography>
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ ml: 3 }}
                >
                  {inventory.item.material}
                </Typography>
              </Grid>
            )}
          </Grid>

          {/* Order Limits */}
          {(inventory.item.min_order_quantity > 1 ||
            inventory.item.max_order_quantity) && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
                Order Limits
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {inventory.item.min_order_quantity > 1 && (
                  <Chip
                    label={`Min: ${inventory.item.min_order_quantity}`}
                    size="small"
                    color="info"
                    variant="outlined"
                  />
                )}
                {inventory.item.max_order_quantity && (
                  <Chip
                    label={`Max: ${inventory.item.max_order_quantity}`}
                    size="small"
                    color="info"
                    variant="outlined"
                  />
                )}
              </Box>
            </Box>
          )}

          {/* Delivery Information */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <LocalShipping fontSize="small" color="primary" />
              <Typography variant="body2" fontWeight="medium">
                Delivery Info
              </Typography>
            </Box>
            <Box sx={{ ml: 3 }}>
              {inventory.item.max_delivery_distance && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  Max Distance: {inventory.item.max_delivery_distance} km
                </Typography>
              )}
              {inventory.item.estimated_delivery_time && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Schedule fontSize="small" />
                  <Typography variant="body2" color="text.secondary">
                    Est. Delivery: {inventory.item.estimated_delivery_time}{' '}
                    minutes
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Special Handling Chips */}
          <Box sx={{ mb: 2 }}>
            {(inventory.item.is_fragile ||
              inventory.item.is_perishable ||
              inventory.item.requires_special_handling) && (
              <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
                Special Handling
              </Typography>
            )}
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {inventory.item.is_fragile && (
                <Chip label="Fragile" color="warning" size="small" />
              )}
              {inventory.item.is_perishable && (
                <Chip label="Perishable" color="error" size="small" />
              )}
              {inventory.item.requires_special_handling && (
                <Chip label="Special Handling" color="info" size="small" />
              )}
            </Box>
          </Box>

          {/* Distance Information */}
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
