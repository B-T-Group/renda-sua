import {
  ArrowBack as ArrowBackIcon,
  Business as BusinessIcon,
  Close as CloseIcon,
  Inventory2 as SpecsIcon,
  ShoppingCart,
  Verified,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  ButtonBase,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Container,
  Dialog,
  DialogContent,
  Divider,
  Grid,
  IconButton,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useAuth0 } from '@auth0/auth0-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import NoImage from '../../assets/no-image.svg';
import { useCart } from '../../contexts/CartContext';
import { useUserProfileContext } from '../../contexts/UserProfileContext';
import { useInventoryItem } from '../../hooks/useInventoryItem';
import type { InventoryItem } from '../../hooks/useInventoryItem';
import { useItemRatings } from '../../hooks/useItemRatings';
import { useSimilarItems } from '../../hooks/useSimilarItems';
import { useTrackItemView } from '../../hooks/useTrackItemView';
import OrderRatingsDisplay from '../common/OrderRatingsDisplay';
import AnonymousBuyNowDialog from '../dialogs/AnonymousBuyNowDialog';
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
  const { isAuthenticated } = useAuth0();
  const { profile } = useUserProfileContext();
  const { addToCart } = useCart();
  const [anonBuyNowOpen, setAnonBuyNowOpen] = React.useState(false);
  const [imageLightboxOpen, setImageLightboxOpen] = React.useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = React.useState(0);

  const { inventoryItem, loading, error } = useInventoryItem(id || null);
  const { items: similarItems, loading: similarLoading } = useSimilarItems(
    id || null
  );
  const { ratings, loading: ratingsLoading } = useItemRatings(
    inventoryItem?.item?.id ?? null
  );

  const { trackOnMount, trackView } = useTrackItemView(id || null);

  React.useEffect(() => {
    if (id) {
      trackOnMount();
    }
  }, [id, trackOnMount]);

  React.useEffect(() => {
    if (!inventoryItem?.id) return;
    setSelectedImageIndex(0);
    setImageLightboxOpen(false);
  }, [inventoryItem?.id]);

  const handleOrderClick = () => {
    if (id) {
      trackView(id);
      if (!isAuthenticated) {
        setAnonBuyNowOpen(true);
        return;
      }
      navigate(`/items/${id}/place_order`);
    }
  };

  const handleAddToCart = (item: InventoryItem) => {
    trackView(item.id);
    const hasDeal =
      item.hasActiveDeal &&
      typeof item.original_price === 'number' &&
      typeof item.discounted_price === 'number' &&
      item.original_price > 0;

    const unitPrice = hasDeal ? item.discounted_price! : item.selling_price;

    addToCart({
      inventoryItemId: item.id,
      quantity: 1,
      businessId: item.business_location.business_id,
      businessLocationId: item.business_location_id,
      itemData: {
        name: item.item.name,
        price: unitPrice,
        currency: item.item.currency,
        imageUrl: item.item.item_images?.[0]?.image_url,
        weight: item.item.weight,
        maxOrderQuantity: item.item.max_order_quantity || undefined,
        minOrderQuantity: item.item.min_order_quantity || undefined,
        originalPrice: hasDeal ? item.original_price! : undefined,
        discountedPrice: hasDeal ? item.discounted_price! : undefined,
        hasActiveDeal: hasDeal,
        dealEndAt: hasDeal ? item.deal_end_at : undefined,
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
  const images = item.item_images ?? [];
  const primaryImage = images.length > 0 ? images[0].image_url : null;
  const selectedImageUrl =
    images[selectedImageIndex]?.image_url ?? primaryImage ?? null;
  const business = inventoryItem.business_location?.business;
  const location = inventoryItem.business_location;
  const canOrder =
    inventoryItem.computed_available_quantity > 0 && inventoryItem.is_active;
  const hasDeal =
    inventoryItem.hasActiveDeal &&
    typeof inventoryItem.original_price === 'number' &&
    typeof inventoryItem.discounted_price === 'number' &&
    inventoryItem.original_price > 0;
  const checkoutUnitPrice = hasDeal
    ? inventoryItem.discounted_price!
    : inventoryItem.selling_price;
  const checkoutPriceText = formatCurrency(checkoutUnitPrice, item.currency);

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
            {selectedImageUrl ? (
              <CardMedia
                component="img"
                height={isMobile ? 280 : 400}
                image={selectedImageUrl}
                alt={item.name}
                sx={{
                  objectFit: 'cover',
                  cursor: 'pointer',
                }}
                onClick={() => setImageLightboxOpen(true)}
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

          {images.length > 1 && (
            <Stack
              direction="row"
              spacing={1}
              sx={{
                mt: 1.5,
                flexWrap: 'wrap',
                justifyContent: { xs: 'center', md: 'flex-start' },
                rowGap: 1,
              }}
            >
              {images.map((img, idx) => {
                const isSelected = idx === selectedImageIndex;
                return (
                  <ButtonBase
                    key={img.id ?? `${img.image_url}-${idx}`}
                    onClick={() => setSelectedImageIndex(idx)}
                    sx={{
                      borderRadius: 1,
                      overflow: 'hidden',
                      border: '2px solid',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      width: 64,
                      height: 64,
                      flexShrink: 0,
                    }}
                    aria-label={t(
                      'items.imageThumbnail',
                      'View image {{index}}',
                      { index: idx + 1 }
                    )}
                  >
                    <Box
                      component="img"
                      src={img.image_url}
                      alt={img.alt_text || item.name}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  </ButtonBase>
                );
              })}
            </Stack>
          )}
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

            {typeof inventoryItem.viewsCount === 'number' && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <VisibilityIcon fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {t(
                    'items.itemCard.views',
                    '{{count}} views',
                    { count: inventoryItem.viewsCount }
                  )}
                </Typography>
              </Box>
            )}

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
              {item.tags && item.tags.length > 0 && item.tags.map((tag) => (
                <Chip key={tag.id} label={tag.name} size="small" variant="outlined" />
              ))}
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

      {/* Similar items */}
      {similarItems.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            {t('items.similarItems', 'Similar Items')}
          </Typography>
          {similarLoading ? (
            <Grid container spacing={2}>
              {[1, 2, 3].map((i) => (
                <Grid size={{ xs: 6, sm: 4 }} key={i}>
                  <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 1 }} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Grid container spacing={2}>
              {similarItems.slice(0, 6).map((sim) => (
                <Grid size={{ xs: 6, sm: 4 }} key={sim.id}>
                  <Card
                    component={RouterLink}
                    to={`/items/${sim.id}`}
                    sx={{
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'block',
                      height: '100%',
                      '&:hover': { boxShadow: theme.shadows[4] },
                    }}
                  >
                    <CardMedia
                      component="img"
                      height="120"
                      image={
                        sim.item?.item_images?.[0]?.image_url || NoImage
                      }
                      alt={sim.item?.name}
                      sx={{ objectFit: 'cover' }}
                    />
                    <CardContent sx={{ py: 1 }}>
                      <Typography variant="subtitle2" noWrap>
                        {sim.item?.name}
                      </Typography>
                      <Typography variant="body2" color="primary" fontWeight={600}>
                        {formatCurrency(
                          sim.hasActiveDeal && typeof sim.discounted_price === 'number'
                            ? sim.discounted_price
                            : sim.selling_price,
                          sim.item?.currency
                        )}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
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

      <AnonymousBuyNowDialog
        open={anonBuyNowOpen}
        inventoryItemId={inventoryItem.id}
        item={{
          title: item.name,
          imageUrl: primaryImage,
          priceText: checkoutPriceText,
          quantity: 1,
        }}
        onClose={() => setAnonBuyNowOpen(false)}
      />

      <Dialog
        open={imageLightboxOpen}
        onClose={() => setImageLightboxOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <IconButton
          aria-label={t('common.close', 'Close')}
          onClick={() => setImageLightboxOpen(false)}
          sx={{ position: 'absolute', right: 8, top: 8, zIndex: 1 }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent sx={{ p: 0 }}>
          {selectedImageUrl ? (
            <Box
              component="img"
              src={selectedImageUrl}
              alt={item.name}
              sx={{
                width: '100%',
                height: 'auto',
                maxHeight: '80vh',
                objectFit: 'contain',
                display: 'block',
                bgcolor: 'common.black',
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
