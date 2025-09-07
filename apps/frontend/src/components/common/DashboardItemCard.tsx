import {
  Build,
  Business,
  Category,
  LocationOn,
  Palette,
  Scale,
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
        minHeight: '280px',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
      }}
    >
      {/* Image Section - Left Side */}
      <Box sx={{ width: '200px', flexShrink: 0 }}>
        <CardMedia
          component="img"
          height="280"
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
        <CardContent sx={{ flexGrow: 1, p: 1.5 }}>
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
                  variant="caption"
                  color="primary"
                  fontWeight="bold"
                  sx={{ mb: 0.25 }}
                >
                  {inventory.item.brand.name}
                </Typography>
              )}
              <Typography
                variant="h6"
                sx={{ mb: 0.5, lineHeight: 1.2, fontSize: '1.1rem' }}
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
              sx={{ ml: 1, fontSize: '0.7rem' }}
            />
          </Box>

          {/* Price Section */}
          <Box sx={{ mb: 1 }}>
            <Typography variant="h6" color="primary" fontWeight="bold">
              {formatCurrency(inventory.selling_price, inventory.item.currency)}
            </Typography>
          </Box>

          {/* Business Information - Compact */}
          <Box sx={{ mb: 1 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}
            >
              <Business fontSize="small" color="primary" />
              <Typography
                variant="body2"
                fontWeight="medium"
                sx={{ fontSize: '0.8rem' }}
              >
                {inventory.business_location.business.name}
              </Typography>
              {inventory.business_location.business.is_verified && (
                <Verified fontSize="small" color="success" />
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocationOn fontSize="small" color="primary" />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.7rem' }}
              >
                {inventory.business_location.address.city},{' '}
                {inventory.business_location.address.state}
              </Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 1 }} />

          {/* Item Details Grid - Compact */}
          <Grid container spacing={1} sx={{ mb: 1 }}>
            {/* Category */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mb: 0.25,
                }}
              >
                <Category fontSize="small" color="primary" />
                <Typography
                  variant="caption"
                  fontWeight="medium"
                  sx={{ fontSize: '0.7rem' }}
                >
                  Category
                </Typography>
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ ml: 2.5, fontSize: '0.7rem' }}
              >
                {inventory.item.item_sub_category?.item_category?.name} →{' '}
                {inventory.item.item_sub_category?.name}
              </Typography>
            </Grid>

            {/* SKU */}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mb: 0.25,
                }}
              >
                <Build fontSize="small" color="primary" />
                <Typography
                  variant="caption"
                  fontWeight="medium"
                  sx={{ fontSize: '0.7rem' }}
                >
                  SKU
                </Typography>
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ ml: 2.5, fontSize: '0.7rem' }}
              >
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
                    gap: 0.5,
                    mb: 0.25,
                  }}
                >
                  <Scale fontSize="small" color="primary" />
                  <Typography
                    variant="caption"
                    fontWeight="medium"
                    sx={{ fontSize: '0.7rem' }}
                  >
                    Weight
                  </Typography>
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 2.5, fontSize: '0.7rem' }}
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
                    gap: 0.5,
                    mb: 0.25,
                  }}
                >
                  <Straighten fontSize="small" color="primary" />
                  <Typography
                    variant="caption"
                    fontWeight="medium"
                    sx={{ fontSize: '0.7rem' }}
                  >
                    Size
                  </Typography>
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 2.5, fontSize: '0.7rem' }}
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
                    gap: 0.5,
                    mb: 0.25,
                  }}
                >
                  <Build fontSize="small" color="primary" />
                  <Typography
                    variant="caption"
                    fontWeight="medium"
                    sx={{ fontSize: '0.7rem' }}
                  >
                    Model
                  </Typography>
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 2.5, fontSize: '0.7rem' }}
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
                    gap: 0.5,
                    mb: 0.25,
                  }}
                >
                  <Palette fontSize="small" color="primary" />
                  <Typography
                    variant="caption"
                    fontWeight="medium"
                    sx={{ fontSize: '0.7rem' }}
                  >
                    Color
                  </Typography>
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 2.5, fontSize: '0.7rem' }}
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
                    gap: 0.5,
                    mb: 0.25,
                  }}
                >
                  <Build fontSize="small" color="primary" />
                  <Typography
                    variant="caption"
                    fontWeight="medium"
                    sx={{ fontSize: '0.7rem' }}
                  >
                    Material
                  </Typography>
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ ml: 2.5, fontSize: '0.7rem' }}
                >
                  {inventory.item.material}
                </Typography>
              </Grid>
            )}
          </Grid>

          {/* Compact Info Row */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            {/* Order Limits */}
            {inventory.item.min_order_quantity > 1 && (
              <Chip
                label={`Min: ${inventory.item.min_order_quantity}`}
                size="small"
                color="info"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: '20px' }}
              />
            )}
            {inventory.item.max_order_quantity && (
              <Chip
                label={`Max: ${inventory.item.max_order_quantity}`}
                size="small"
                color="info"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: '20px' }}
              />
            )}

            {/* Delivery Info */}
            {inventory.item.max_delivery_distance && (
              <Chip
                label={`Max ${inventory.item.max_delivery_distance}km`}
                size="small"
                color="secondary"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: '20px' }}
              />
            )}
            {inventory.item.estimated_delivery_time && (
              <Chip
                label={`~${inventory.item.estimated_delivery_time}min`}
                size="small"
                color="secondary"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: '20px' }}
              />
            )}
          </Box>

          {/* Special Handling Chips */}
          {(inventory.item.is_fragile ||
            inventory.item.is_perishable ||
            inventory.item.requires_special_handling) && (
            <Box sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {inventory.item.is_fragile && (
                  <Chip
                    label="Fragile"
                    color="warning"
                    size="small"
                    sx={{ fontSize: '0.7rem', height: '20px' }}
                  />
                )}
                {inventory.item.is_perishable && (
                  <Chip
                    label="Perishable"
                    color="error"
                    size="small"
                    sx={{ fontSize: '0.7rem', height: '20px' }}
                  />
                )}
                {inventory.item.requires_special_handling && (
                  <Chip
                    label="Special"
                    color="info"
                    size="small"
                    sx={{ fontSize: '0.7rem', height: '20px' }}
                  />
                )}
              </Box>
            </Box>
          )}

          {/* Distance Information */}
          {(distanceLoading ||
            distanceError ||
            (estimatedDistance && estimatedDuration)) && (
            <Box sx={{ mb: 1 }}>
              {distanceLoading && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem' }}
                >
                  Calculating distance...
                </Typography>
              )}
              {distanceError && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ fontSize: '0.7rem' }}
                >
                  Error: {distanceError}
                </Typography>
              )}
              {estimatedDistance && estimatedDuration && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem' }}
                >
                  {estimatedDistance} • {estimatedDuration}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>

        {/* Action Button */}
        <CardActions sx={{ p: 1.5, pt: 0, justifyContent: 'flex-end' }}>
          {inventory.computed_available_quantity === 0 ? (
            <Button variant="outlined" disabled size="small">
              Out of Stock
            </Button>
          ) : !inventory.is_active ? (
            <Button variant="outlined" disabled size="small">
              Not Available
            </Button>
          ) : isPublicView ? (
            <Button
              variant="contained"
              color="primary"
              startIcon={<ShoppingCart />}
              onClick={() => onOrderClick(inventory)}
              size="small"
            >
              {loginButtonText}
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={<ShoppingCart />}
              onClick={() => onOrderClick(inventory)}
              size="small"
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
