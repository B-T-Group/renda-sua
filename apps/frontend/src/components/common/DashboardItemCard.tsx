import {
  Build,
  Business,
  Category,
  Palette,
  Scale,
  ShoppingCart,
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
  Typography,
} from '@mui/material';
import React from 'react';
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
  canOrder?: boolean; // NEW: Controls if user can place orders
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
  canOrder = true,
}) => {
  const getPrimaryImage = (item: InventoryItem) => {
    if (item.item.item_images && item.item.item_images.length > 0) {
      return item.item.item_images[0].image_url;
    }
    return null;
  };

  const primaryImage = getPrimaryImage(inventory);

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: '1px solid',
        borderColor: 'divider',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 24px rgba(0,0,0,0.12)',
          borderColor: 'primary.main',
        },
      }}
    >
      {/* Image Section - Top */}
      <Box
        sx={{
          width: '100%',
          height: '240px',
          flexShrink: 0,
          overflow: 'hidden',
          position: 'relative',
          bgcolor: 'grey.300',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {primaryImage ? (
          <CardMedia
            component="img"
            height="240"
            image={primaryImage}
            alt={inventory.item.name}
            sx={{
              objectFit: 'cover',
              width: '100%',
              height: '100%',
              transition: 'transform 0.3s ease',
              '.MuiCard-root:hover &': {
                transform: 'scale(1.05)',
              },
            }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              bgcolor: 'grey.300',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No Image
            </Typography>
          </Box>
        )}
        {/* Price badge overlay */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            bgcolor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(8px)',
            px: 2,
            py: 1,
            borderRadius: 2,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          <Typography variant="h6" color="primary" fontWeight="bold">
            {formatCurrency(inventory.selling_price, inventory.item.currency)}
          </Typography>
        </Box>
      </Box>

      {/* Content Section - Bottom */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1, p: 1.5, pb: 1 }}>
          {/* Header with Brand and Availability */}
          <Box sx={{ mb: 1 }}>
            {inventory.item.brand && (
              <Typography
                variant="caption"
                color="primary"
                fontWeight="bold"
                sx={{ mb: 0.25, fontSize: '0.7rem' }}
              >
                {inventory.item.brand.name}
              </Typography>
            )}
            <Typography
              variant="h6"
              sx={{
                mb: 0.5,
                lineHeight: 1.2,
                fontSize: '1rem',
                fontWeight: 600,
              }}
            >
              {inventory.item.name}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
              }}
            >
              <Chip
                label={`${inventory.computed_available_quantity} available`}
                color={
                  inventory.computed_available_quantity > 0
                    ? 'success'
                    : 'error'
                }
                size="small"
                sx={{ fontSize: '0.7rem' }}
              />
            </Box>
          </Box>

          {/* Business Information - Compact */}
          <Box sx={{ mb: 1 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}
            >
              <Business fontSize="small" color="primary" />
              <Typography
                variant="caption"
                fontWeight="medium"
                sx={{ fontSize: '0.7rem' }}
              >
                {inventory.business_location.business.name}
              </Typography>
              {inventory.business_location.business.is_verified && (
                <Verified fontSize="small" color="success" />
              )}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.7rem', ml: 0.5 }}
              >
                • {inventory.business_location.address.city}
              </Typography>
            </Box>
          </Box>

          {/* Key Details - Horizontal Layout */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            {/* Category */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Category fontSize="small" color="primary" />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.7rem' }}
              >
                {inventory.item.item_sub_category?.item_category?.name}
              </Typography>
            </Box>

            {/* SKU */}
            {inventory.item.sku && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Build fontSize="small" color="primary" />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem' }}
                >
                  {inventory.item.sku}
                </Typography>
              </Box>
            )}

            {/* Weight */}
            {inventory.item.weight && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Scale fontSize="small" color="primary" />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem' }}
                >
                  {inventory.item.weight}
                  {inventory.item.weight_unit}
                </Typography>
              </Box>
            )}

            {/* Model */}
            {inventory.item.model && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Build fontSize="small" color="primary" />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem' }}
                >
                  {inventory.item.model}
                </Typography>
              </Box>
            )}

            {/* Color */}
            {inventory.item.color && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Palette fontSize="small" color="primary" />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem' }}
                >
                  {inventory.item.color}
                </Typography>
              </Box>
            )}
          </Box>

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
        <CardActions sx={{ p: 1.5, pt: 0, justifyContent: 'center' }}>
          {inventory.computed_available_quantity === 0 ? (
            <Button
              variant="outlined"
              disabled
              size="small"
              sx={{ width: '75%' }}
            >
              Out of Stock
            </Button>
          ) : !inventory.is_active ? (
            <Button
              variant="outlined"
              disabled
              size="small"
              sx={{ width: '75%' }}
            >
              Not Available
            </Button>
          ) : !canOrder ? (
            <Button
              variant="outlined"
              disabled
              size="small"
              sx={{ width: '75%' }}
            >
              Available to Clients Only
            </Button>
          ) : isPublicView ? (
            <Button
              variant="contained"
              color="primary"
              startIcon={<ShoppingCart />}
              onClick={() => onOrderClick(inventory)}
              size="small"
              sx={{ width: '75%' }}
            >
              {loginButtonText}
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={<ShoppingCart />}
              onClick={() => onOrderClick(inventory)}
              size="small"
              sx={{ width: '75%' }}
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
