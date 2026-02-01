import {
  ArrowBack as ArrowBackIcon,
  Business as BusinessIcon,
  ShoppingCart,
  Verified,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Container,
  Grid,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import NoImage from '../../assets/no-image.svg';
import { useCart } from '../../contexts/CartContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useInventoryItem } from '../../hooks/useInventoryItem';
import { useItemRatings } from '../../hooks/useItemRatings';
import type { InventoryItem } from '../../hooks/useInventoryItem';
import OrderRatingsDisplay from '../common/OrderRatingsDisplay';
import SEOHead from '../seo/SEOHead';

const formatCurrency = (amount: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export default function ItemDetailPage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useUserProfileContext();
  const { addToCart } = useCart();

  const { inventoryItem, loading, error } = useInventoryItem(id || null);
  const { ratings, loading: ratingsLoading } = useItemRatings(
    inventoryItem?.item?.id ?? null
  );

  const handleOrderClick = () => {
    if (id) navigate(`/items/${id}/place_order`);
  };

  const handleAddToCart = (item: InventoryItem) => {
    addToCart({
      inventoryItemId: item.id,
      quantity: 1,
      businessId: item.business_location.business_id,
      businessLocationId: item.business_location_id,
      itemData: {
        name: item.item.name,
        price: item.selling_price,
        currency: item.item.currency,
        imageUrl: item.item.item_images?.[0]?.image_url,
        weight: item.item.weight,
      },
    });
  };

  const isClientUser = profile?.user_type_id === 'client';

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Skeleton variant="text" width={120} height={40} sx={{ mb: 2 }} />
        <Grid container spacing={3} sx={{ width: '100%' }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Skeleton
              variant="rectangular"
              height={isMobile ? 280 : 400}
              sx={{ borderRadius: 2, mb: 2 }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Skeleton variant="text" width="80%" height={40} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="40%" height={28} sx={{ mb: 2 }} />
            <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
          </Grid>
        </Grid>
      </Container>
    );
  }

  if (error || !inventoryItem) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || t('items.notFound', 'Item not found')}
        </Alert>
        <Button
          component={RouterLink}
          to="/items"
          startIcon={<ArrowBackIcon />}
          variant="outlined"
        >
          {t('common.back', 'Back')}
        </Button>
      </Container>
    );
  }

  const item = inventoryItem.item;
  const primaryImage =
    item.item_images && item.item_images.length > 0
      ? item.item_images[0].image_url
      : null;
  const business = inventoryItem.business_location?.business;
  const location = inventoryItem.business_location;
  const canOrder =
    inventoryItem.computed_available_quantity > 0 && inventoryItem.is_active;

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <SEOHead
        title={item.name}
        description={item.description || undefined}
        keywords={`${item.name}, ${item.brand?.name || ''}, ${item.item_sub_category?.name || ''}`}
      />

      {/* Back link */}
      <Box sx={{ mb: 2 }}>
        <Button
          component={RouterLink}
          to="/items"
          startIcon={<ArrowBackIcon />}
          variant="outlined"
          size={isMobile ? 'small' : 'medium'}
        >
          {t('common.back', 'Back')}
        </Button>
      </Box>

      {/* Main content: image + details */}
      <Grid container spacing={3} sx={{ width: '100%' }}>
        {/* Image */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card
            sx={{
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            {primaryImage ? (
              <CardMedia
                component="img"
                height={isMobile ? 280 : 400}
                image={primaryImage}
                alt={item.name}
                sx={{ objectFit: 'cover' }}
              />
            ) : (
              <Box
                sx={{
                  height: isMobile ? 280 : 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'grey.200',
                }}
              >
                <img
                  src={NoImage}
                  alt=""
                  style={{ width: 120, height: 120, opacity: 0.6 }}
                />
              </Box>
            )}
          </Card>
        </Grid>

        {/* Details */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={2}>
            <Typography
              variant="h4"
              component="h1"
              sx={{ fontSize: { xs: '1.5rem', md: '1.75rem' } }}
            >
              {item.name}
            </Typography>

            {item.brand && (
              <Typography variant="body2" color="text.secondary">
                {item.brand.name}
                {item.item_sub_category?.item_category?.name && (
                  <> · {item.item_sub_category.item_category.name}</>
                )}
                {item.item_sub_category?.name && (
                  <> · {item.item_sub_category.name}</>
                )}
              </Typography>
            )}

            <Typography variant="h5" color="primary.main" fontWeight={600}>
              {formatCurrency(inventoryItem.selling_price, item.currency)}
            </Typography>

            {location && business && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <BusinessIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {business.name}
                  {business.is_verified && (
                    <Verified
                      fontSize="small"
                      color="primary"
                      sx={{ ml: 0.5, verticalAlign: 'middle' }}
                    />
                  )}
                  {location.name && ` · ${location.name}`}
                </Typography>
              </Box>
            )}

            {/* Specs chips */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {item.min_order_quantity > 0 && (
                <Chip
                  label={`Min: ${item.min_order_quantity}`}
                  size="small"
                  variant="outlined"
                />
              )}
              {item.max_order_quantity > 0 && (
                <Chip
                  label={`Max: ${item.max_order_quantity}`}
                  size="small"
                  variant="outlined"
                />
              )}
              {item.max_delivery_distance > 0 && (
                <Chip
                  label={`Max ${item.max_delivery_distance} km`}
                  size="small"
                  variant="outlined"
                />
              )}
              {item.estimated_delivery_time > 0 && (
                <Chip
                  label={`~${item.estimated_delivery_time} min`}
                  size="small"
                  variant="outlined"
                />
              )}
              {item.is_fragile && (
                <Chip label={t('items.fragile', 'Fragile')} size="small" color="warning" />
              )}
              {item.is_perishable && (
                <Chip label={t('items.perishable', 'Perishable')} size="small" color="error" />
              )}
              {item.requires_special_handling && (
                <Chip label={t('items.specialHandling', 'Special')} size="small" color="info" />
              )}
            </Box>

            {/* CTAs */}
            <Stack direction="column" spacing={1} sx={{ pt: 1 }}>
              {!canOrder ? (
                <Button variant="outlined" disabled size="medium">
                  {inventoryItem.computed_available_quantity === 0
                    ? t('items.outOfStock', 'Out of Stock')
                    : t('items.notAvailable', 'Not Available')}
                </Button>
              ) : (
                <>
                  {isClientUser && (
                    <Button
                      variant="outlined"
                      startIcon={<ShoppingCart />}
                      onClick={() => handleAddToCart(inventoryItem)}
                      size="medium"
                      fullWidth
                    >
                      {t('cart.addToCart', 'Add to Cart')}
                    </Button>
                  )}
                  <Button
                    variant="contained"
                    startIcon={<ShoppingCart />}
                    onClick={handleOrderClick}
                    size="medium"
                    fullWidth
                  >
                    {t('common.orderNow', 'Order Now')}
                  </Button>
                </>
              )}
            </Stack>
          </Stack>
        </Grid>
      </Grid>

      {/* Description and specs - full width */}
      {(item.description || item.weight || item.dimensions) && (
        <Card sx={{ mt: 3, border: '1px solid', borderColor: 'divider' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('items.details', 'Details')}
            </Typography>
            {item.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {item.description}
              </Typography>
            )}
            <Stack direction="row" spacing={2} flexWrap="wrap">
              {item.weight > 0 && (
                <Typography variant="body2">
                  {t('items.weight', 'Weight')}: {item.weight} {item.weight_unit}
                </Typography>
              )}
              {item.dimensions && (
                <Typography variant="body2">
                  {t('items.dimensions', 'Dimensions')}: {item.dimensions}
                </Typography>
              )}
              {item.sku && (
                <Typography variant="body2" color="text.secondary">
                  SKU: {item.sku}
                </Typography>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Reviews */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          {t('items.reviews', 'Reviews')}
        </Typography>
        {ratingsLoading ? (
          <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
        ) : ratings.length > 0 ? (
          <OrderRatingsDisplay
            ratings={ratings}
            userType="client"
            title={t('items.reviews', 'Reviews')}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            {t('items.noReviews', 'No reviews yet')}
          </Typography>
        )}
      </Box>
    </Container>
  );
}
