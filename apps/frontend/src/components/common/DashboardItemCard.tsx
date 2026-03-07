import {
  Build,
  Business,
  Category,
  Palette,
  Scale,
  ShoppingCart,
  Straighten,
  Verified,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import {
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    CardMedia,
    Chip,
    Dialog,
    DialogContent,
    IconButton,
    Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { InventoryItem } from '../../hooks/useInventoryItems';

interface DashboardItemCardProps {
  item: InventoryItem;
  formatCurrency: (amount: number, currency?: string) => string;
  onOrderClick: (item: InventoryItem) => void;
  onAddToCart?: (item: InventoryItem) => void;
  estimatedDistance?: string | null;
  estimatedDuration?: string | null;
  distanceLoading?: boolean;
  distanceError?: string | null;
  isPublicView?: boolean;
  loginButtonText?: string;
  orderButtonText?: string;
  addToCartButtonText?: string;
  buyNowButtonText?: string;
  canOrder?: boolean;
  showCartButtons?: boolean;
  viewsCount?: number;
}

const DashboardItemCard: React.FC<DashboardItemCardProps> = ({
  item: inventory,
  formatCurrency,
  onOrderClick,
  onAddToCart,
  estimatedDistance,
  estimatedDuration,
  distanceLoading,
  distanceError,
  isPublicView = false,
  loginButtonText = 'Login to Order',
  orderButtonText = 'Order Now',
  addToCartButtonText = 'Add to Cart',
  buyNowButtonText = 'Buy Now',
  canOrder = true,
  showCartButtons = false,
  viewsCount,
}) => {
  const navigate = useNavigate();
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);
  const { t } = useTranslation();

  const hasDealPrices =
    inventory.hasActiveDeal &&
    typeof inventory.original_price === 'number' &&
    typeof inventory.discounted_price === 'number' &&
    inventory.original_price > 0;

  const discountPercent = hasDealPrices
    ? Math.round(
        ((inventory.original_price! - inventory.discounted_price!) /
          inventory.original_price!) *
          100
      )
    : null;

  const getPrimaryImage = (item: InventoryItem) => {
    if (item.item.item_images && item.item.item_images.length > 0) {
      return item.item.item_images[0].image_url;
    }
    return null;
  };

  const primaryImage = getPrimaryImage(inventory);

  const isUnavailable = inventory.computed_available_quantity <= 0;

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        border: '1px solid',
        borderColor: hasDealPrices ? 'secondary.main' : 'divider',
        borderWidth: hasDealPrices ? 2 : 1,
        boxShadow: hasDealPrices ? '0 8px 20px rgba(156, 39, 176, 0.25)' : 'none',
        ...(isUnavailable && {
          opacity: 0.88,
          bgcolor: 'action.hover',
        }),
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: hasDealPrices
            ? '0 14px 28px rgba(156, 39, 176, 0.35)'
            : '0 12px 24px rgba(0,0,0,0.12)',
          borderColor: hasDealPrices ? 'secondary.dark' : 'primary.main',
        },
      }}
    >
      {/* Image Section - Top (clickable to view) */}
      <Box
        onClick={() => primaryImage && setImageLightboxOpen(true)}
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
          cursor: primaryImage ? 'pointer' : 'default',
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
              pointerEvents: 'none',
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
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {hasDealPrices ? (
            <>
              <Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textDecoration: 'line-through' }}
                >
                  {formatCurrency(
                    inventory.original_price!,
                    inventory.item.currency
                  )}
                </Typography>
                <Typography variant="h6" color="primary" fontWeight="bold">
                  {formatCurrency(
                    inventory.discounted_price!,
                    inventory.item.currency
                  )}
                </Typography>
              </Box>
              {discountPercent && discountPercent > 0 && (
                <Chip
                  label={`-${discountPercent}%`}
                  color="secondary"
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
              )}
            </>
          ) : (
            <Typography variant="h6" color="primary" fontWeight="bold">
              {formatCurrency(inventory.selling_price, inventory.item.currency)}
            </Typography>
          )}
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
            {hasDealPrices && inventory.deal_end_at && (
              <Typography
                variant="caption"
                color="error.main"
                sx={{ fontWeight: 600 }}
              >
                {t(
                  'items.dealEndsOn',
                  'Ends on {{date}}',
                  {
                    date: new Date(
                      inventory.deal_end_at
                    ).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }),
                  }
                )}
              </Typography>
            )}
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

            {/* Tags */}
            {inventory.item.tags && inventory.item.tags.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {inventory.item.tags.slice(0, 3).map((tag) => (
                  <Chip
                    key={tag.id}
                    label={tag.name}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.65rem', height: 20 }}
                  />
                ))}
                {inventory.item.tags.length > 3 && (
                  <Chip
                    label={`+${inventory.item.tags.length - 3}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.65rem', height: 20 }}
                  />
                )}
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

            {/* Dimensions */}
            {inventory.item.dimensions && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Straighten fontSize="small" color="primary" />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem' }}
                >
                  {inventory.item.dimensions}
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

            {/* Views */}
            {typeof viewsCount === 'number' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <VisibilityIcon fontSize="small" color="primary" />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem' }}
                >
                  {t(
                    'items.itemCard.views',
                    '{{count}} views',
                    { count: viewsCount }
                  )}
                </Typography>
              </Box>
            )}

            {/* Rating */}
            {inventory.avg_rating != null &&
              inventory.avg_rating > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ fontSize: '0.7rem' }}
                  >
                    {inventory.avg_rating.toFixed(1)} ★
                    {typeof inventory.rating_count === 'number' &&
                      inventory.rating_count > 0 &&
                      ` (${inventory.rating_count})`}
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

        {/* Action Buttons */}
        <CardActions
          sx={{
            p: 1.5,
            pt: 0,
            flexDirection: 'column',
            alignItems: 'stretch',
            gap: 0.5,
          }}
        >
          <Button
            variant="text"
            size="small"
            startIcon={<VisibilityIcon />}
            onClick={() => navigate(`/items/${inventory.id}`)}
            sx={{ alignSelf: 'center' }}
          >
            View details
          </Button>
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
            null
          ) : showCartButtons && onAddToCart ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                width: '100%',
              }}
            >
              <Button
                variant="outlined"
                startIcon={<ShoppingCart />}
                onClick={() => onAddToCart(inventory)}
                size="small"
                fullWidth
                sx={{
                  minHeight: '36px',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {addToCartButtonText}
              </Button>
              <Button
                variant="contained"
                onClick={() => onOrderClick(inventory)}
                size="small"
                fullWidth
                sx={{
                  minHeight: '36px',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {buyNowButtonText}
              </Button>
            </Box>
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

      {/* Image lightbox */}
      <Dialog
        open={imageLightboxOpen}
        onClose={() => setImageLightboxOpen(false)}
        maxWidth={false}
        PaperProps={{
          sx: {
            maxHeight: '90vh',
            maxWidth: '90vw',
            bgcolor: 'transparent',
            boxShadow: 'none',
          },
        }}
        slotProps={{
          backdrop: {
            sx: { bgcolor: 'rgba(0,0,0,0.85)' },
          },
        }}
        onClick={() => setImageLightboxOpen(false)}
      >
        <IconButton
          aria-label="close"
          onClick={() => setImageLightboxOpen(false)}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'white',
            bgcolor: 'rgba(0,0,0,0.5)',
            zIndex: 1,
            '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
          }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent
          onClick={(e) => e.stopPropagation()}
          sx={{
            p: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {primaryImage && (
            <Box
              component="img"
              src={primaryImage}
              alt={inventory.item.name}
              sx={{
                maxWidth: '100%',
                maxHeight: '90vh',
                objectFit: 'contain',
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default DashboardItemCard;
