import {
  ArrowBack as ArrowBackIcon,
  Business as BusinessIcon,
  Inventory2 as SpecsIcon,
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
  Divider,
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

            {/* Quick specs chips */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
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

      {/* Product information - full width */}
      <Card sx={{ mt: 3, border: '1px solid', borderColor: 'divider' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <SpecsIcon color="primary" />
            <Typography variant="h6">
              {t('items.productInformation', 'Product Information')}
            </Typography>
          </Box>

          {item.description && (
            <>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {t('items.description', 'Description')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                {item.description}
              </Typography>
            </>
          )}

          <Grid container spacing={2}>
            {item.item_sub_category?.item_category?.name && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('items.category', 'Category')}
                </Typography>
                <Typography variant="body2">{item.item_sub_category.item_category.name}</Typography>
              </Grid>
            )}
            {item.item_sub_category?.name && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('items.subcategory', 'Subcategory')}
                </Typography>
                <Typography variant="body2">{item.item_sub_category.name}</Typography>
              </Grid>
            )}
            {item.brand?.name && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('items.brand', 'Brand')}
                </Typography>
                <Typography variant="body2">{item.brand.name}</Typography>
              </Grid>
            )}
            {item.model?.trim() && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('items.model', 'Model')}
                </Typography>
                <Typography variant="body2">{item.model}</Typography>
              </Grid>
            )}
            {item.color?.trim() && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('items.color', 'Color')}
                </Typography>
                <Typography variant="body2">{item.color}</Typography>
              </Grid>
            )}
            {item.sku?.trim() && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('items.sku', 'SKU')}
                </Typography>
                <Typography variant="body2" fontFamily="monospace">{item.sku}</Typography>
              </Grid>
            )}
            {item.weight != null && item.weight > 0 && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('items.weight', 'Weight')}
                </Typography>
                <Typography variant="body2">
                  {item.weight} {item.weight_unit || 'g'}
                </Typography>
              </Grid>
            )}
            {item.dimensions?.trim() && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('items.dimensions', 'Dimensions')}
                </Typography>
                <Typography variant="body2">{item.dimensions}</Typography>
              </Grid>
            )}
            {item.min_order_quantity != null && item.min_order_quantity > 0 && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('items.minOrderQuantity', 'Min. order quantity')}
                </Typography>
                <Typography variant="body2">{item.min_order_quantity}</Typography>
              </Grid>
            )}
            {item.max_order_quantity != null && item.max_order_quantity > 0 && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('items.maxOrderQuantity', 'Max. order quantity')}
                </Typography>
                <Typography variant="body2">{item.max_order_quantity}</Typography>
              </Grid>
            )}
            {item.max_delivery_distance != null && item.max_delivery_distance > 0 && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('items.maxDeliveryDistance', 'Max. delivery distance')}
                </Typography>
                <Typography variant="body2">{item.max_delivery_distance} km</Typography>
              </Grid>
            )}
            {item.estimated_delivery_time != null && item.estimated_delivery_time > 0 && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {t('items.estimatedDeliveryTime', 'Est. delivery time')}
                </Typography>
                <Typography variant="body2">~{item.estimated_delivery_time} min</Typography>
              </Grid>
            )}
          </Grid>

          {(item.is_fragile || item.is_perishable || item.requires_special_handling) && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                {t('items.specialProperties', 'Special properties')}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {item.is_fragile && (
                  <Chip label={t('items.fragile', 'Fragile')} size="small" color="warning" />
                )}
                {item.is_perishable && (
                  <Chip label={t('items.perishable', 'Perishable')} size="small" color="error" />
                )}
                {item.requires_special_handling && (
                  <Chip label={t('items.specialHandling', 'Special handling')} size="small" color="info" />
                )}
              </Box>
            </>
          )}
        </CardContent>
      </Card>

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
