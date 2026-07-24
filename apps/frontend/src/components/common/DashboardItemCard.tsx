import {
  Business,
  Category,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Scale,
  ShoppingCart,
  Store,
  Straighten,
  Verified,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  ButtonBase,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Rating,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { InventoryItem } from '../../hooks/useInventoryItems';
import {
  SITE_EVENT_INVENTORY_BUY_NOW_CLICK,
  SITE_EVENT_INVENTORY_CARD_VIEW_DETAILS_CLICK,
  SITE_EVENT_INVENTORY_ORDER_NOW_CLICK,
  SITE_EVENT_SUBJECT_INVENTORY_ITEM,
  useTrackSiteEvent,
} from '../../hooks/useTrackSiteEvent';
import {
  catalogGalleryForSelection,
  catalogSpecsForSelection,
  itemImageDisplayUrl,
} from '../../utils/orderedItemImages';
import {
  catalogUnitPriceForVariant,
  shopperVariantOptionCount,
  toCartVariantId,
} from '../../utils/catalogVariantCart';
import {
  SHOPPER_BASE_VARIANT_ID,
  shopperVariantOptions,
} from '../../utils/shopperVariantSelection';
import AnonymousBuyNowDialog from '../dialogs/AnonymousBuyNowDialog';
import { CatalogOptionChips } from './CatalogOptionChips';

/** Strip HTML and collapse whitespace for card preview text. */
function plainTextSummary(text: string | null | undefined): string {
  if (!text?.trim()) return '';
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

interface DashboardItemCardProps {
  item: InventoryItem;
  formatCurrency: (amount: number, currency?: string) => string;
  onOrderClick: (
    item: InventoryItem,
    selectionId?: string | null
  ) => void;
  onAddToCart?: (
    item: InventoryItem,
    selectionId?: string | null
  ) => void;
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
  loginButtonText,
  orderButtonText,
  addToCartButtonText,
  buyNowButtonText,
  canOrder = true,
  showCartButtons = false,
  viewsCount,
}) => {
  const navigate = useNavigate();
  const [anonBuyNowOpen, setAnonBuyNowOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const { t } = useTranslation();
  const { trackSiteEvent } = useTrackSiteEvent();
  const { getListingQuantityInCart } = useCart();
  const inCartQuantity = getListingQuantityInCart(inventory.id);
  const inCart = inCartQuantity > 0;
  const inCartLabel =
    inCartQuantity > 1
      ? t('cart.inCartCount', 'In cart ({{count}})', { count: inCartQuantity })
      : t('cart.inCart', 'In cart');
  const defaultOptionLabel = t('orders.variant.defaultOption', 'Default');

  const business = inventory.business_location.business;
  const merchantCanAcceptOrders =
    business.can_accept_orders ?? business.is_verified ?? false;
  const isOpeningSoon =
    (business.is_storefront_visible ?? true) && !merchantCanAcceptOrders;
  const merchantNotAcceptingLabel = t(
    'checkout.merchantNotAcceptingOrders',
    'This merchant is currently completing account setup and is not yet accepting orders.'
  );
  const openingSoonLabel = t('business.lifecycle.openingSoonBadge', 'Opening Soon');

  const variantOptionCount = useMemo(
    () => shopperVariantOptionCount(inventory),
    [inventory]
  );
  const hasVariantOptions = variantOptionCount > 1;

  const parentImageUrl = useMemo(() => {
    const imgs = inventory.item.item_images ?? [];
    const sorted = [...imgs].sort(
      (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
    );
    return itemImageDisplayUrl(sorted[0]);
  }, [inventory.item.item_images]);

  const optionList = useMemo(
    () =>
      shopperVariantOptions({
        itemName: inventory.item.name,
        defaultLabel: defaultOptionLabel,
        variants: inventory.item.item_variants,
        parentImageUrl,
      }),
    [
      defaultOptionLabel,
      inventory.item.item_variants,
      inventory.item.name,
      parentImageUrl,
    ]
  );

  const [selectionId, setSelectionId] = useState<string | null>(() =>
    hasVariantOptions ? SHOPPER_BASE_VARIANT_ID : null
  );

  useEffect(() => {
    setSelectionId(hasVariantOptions ? SHOPPER_BASE_VARIANT_ID : null);
    setActiveImageIndex(0);
  }, [inventory.id, hasVariantOptions]);

  const galleryImages = useMemo(
    () => catalogGalleryForSelection(inventory.item, selectionId),
    [inventory.item, selectionId]
  );

  const specs = useMemo(
    () => catalogSpecsForSelection(inventory.item, selectionId),
    [inventory.item, selectionId]
  );

  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectionId]);

  const descriptionPreview = useMemo(
    () => plainTextSummary(inventory.item.description),
    [inventory.item.description]
  );

  const pricing = useMemo(
    () => catalogUnitPriceForVariant(inventory, selectionId),
    [inventory, selectionId]
  );

  const hasDealPrices =
    pricing.hasDeal &&
    typeof pricing.strikeOriginal === 'number' &&
    pricing.strikeOriginal > pricing.unit;

  const discountPercent = hasDealPrices
    ? Math.round(
        ((pricing.strikeOriginal! - pricing.unit) / pricing.strikeOriginal!) *
          100
      )
    : null;

  const cartVariantId = toCartVariantId(selectionId);

  const displayIdx =
    galleryImages.length === 0
      ? 0
      : Math.min(activeImageIndex, galleryImages.length - 1);
  const displayImage = galleryImages[displayIdx];
  const displayImageUrl = itemImageDisplayUrl(displayImage);
  const hasMultipleImages = galleryImages.length > 1;

  const goPrevImage = () => {
    if (!hasMultipleImages) return;
    setActiveImageIndex((i) =>
      i === 0 ? galleryImages.length - 1 : i - 1
    );
  };

  const goNextImage = () => {
    if (!hasMultipleImages) return;
    setActiveImageIndex((i) =>
      i === galleryImages.length - 1 ? 0 : i + 1
    );
  };

  const ratingCount = inventory.rating_count ?? 0;
  const showAggregateRating =
    ratingCount > 0 &&
    inventory.avg_rating != null &&
    Number.isFinite(inventory.avg_rating);

  const isUnavailable = inventory.computed_available_quantity <= 0;

  const viewDetailsLabel = t('items.itemCard.viewDetails', 'View details');
  const noImageLabel = t('items.itemCard.noImage', 'No image');
  const outOfStockLabel = t('items.itemCard.outOfStock', 'Out of stock');
  const notAvailableLabel = t('items.itemCard.notAvailable', 'Not available');
  const clientsOnlyLabel = t(
    'items.itemCard.clientsOnly',
    'Available to clients only'
  );
  const calculatingDistanceLabel = t(
    'items.itemCard.calculatingDistance',
    'Calculating distance…'
  );
  const distanceErrorLabel = t('items.itemCard.distanceError', 'Error');

  const resolvedLoginButtonText = loginButtonText ?? t('auth.login', 'Sign in');
  const resolvedOrderButtonText = orderButtonText ?? t('common.orderNow', 'Order now');
  const resolvedAddToCartButtonText = addToCartButtonText ?? t('cart.addToCart', 'Add to cart');
  const resolvedBuyNowButtonText = buyNowButtonText ?? t('cart.buyNow', 'Buy now');
  const resolvedAddToCartLabel = inCart
    ? t('cart.addMore', 'Add more')
    : resolvedAddToCartButtonText;

  const checkoutPriceText = formatCurrency(
    pricing.unit,
    inventory.item.currency
  );

  const goToDetails = () => navigate(`/items/${inventory.id}`);

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
      {/* Image gallery — arrows, thumbnails when multiple; click main image for lightbox */}
      <Box
        sx={{
          width: '100%',
          height: '240px',
          flexShrink: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'grey.300',
        }}
      >
        <Tooltip
          title={t('items.itemCard.openDetails', {
            defaultValue: 'Open {{name}} details',
            name: inventory.item.name,
          })}
        >
          <Box
            onClick={() => {
              void trackSiteEvent({
                eventType: SITE_EVENT_INVENTORY_CARD_VIEW_DETAILS_CLICK,
                subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
                subjectId: inventory.id,
              });
              goToDetails();
            }}
            sx={{
              flex: hasMultipleImages ? '1 1 auto' : '1 1 100%',
              minHeight: 0,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            {displayImageUrl ? (
              <>
                {hasMultipleImages && (
                  <Chip
                    label={t(
                      'business.items.cardGalleryPhotosBadge',
                      '{{count}} photos',
                      { count: galleryImages.length }
                    )}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 1,
                      bgcolor: 'rgba(0, 0, 0, 0.65)',
                      color: 'common.white',
                      fontSize: '0.7rem',
                      height: 22,
                      '& .MuiChip-label': { px: 1 },
                    }}
                  />
                )}
                {hasMultipleImages && (
                  <>
                    <IconButton
                      size="small"
                      aria-label={t(
                        'business.items.cardGalleryPrevious',
                        'Previous photo'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        goPrevImage();
                      }}
                      sx={{
                        position: 'absolute',
                        left: 4,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 1,
                        bgcolor: 'rgba(255, 255, 255, 0.85)',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.95)' },
                        p: 0.25,
                      }}
                    >
                      <ChevronLeft fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      aria-label={t(
                        'business.items.cardGalleryNext',
                        'Next photo'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        goNextImage();
                      }}
                      sx={{
                        position: 'absolute',
                        right: 4,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 1,
                        bgcolor: 'rgba(255, 255, 255, 0.85)',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.95)' },
                        p: 0.25,
                      }}
                    >
                      <ChevronRight fontSize="small" />
                    </IconButton>
                  </>
                )}
                <CardMedia
                  component="img"
                  image={displayImageUrl}
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
              </>
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
                  {noImageLabel}
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
                pointerEvents: 'none',
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
                        pricing.strikeOriginal!,
                        inventory.item.currency
                      )}
                    </Typography>
                    <Typography variant="h6" color="primary" fontWeight="bold">
                      {formatCurrency(pricing.unit, inventory.item.currency)}
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
                  {formatCurrency(pricing.unit, inventory.item.currency)}
                </Typography>
              )}
            </Box>
          </Box>
        </Tooltip>
        {hasMultipleImages && (
          <Box
            sx={{
              flex: '0 0 auto',
              display: 'flex',
              gap: 0.5,
              px: 0.75,
              py: 0.5,
              overflowX: 'auto',
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: 'grey.50',
            }}
          >
            {galleryImages.map((img, idx) => (
              <Box
                key={img.id ?? `${img.image_url}-${idx}`}
                component="button"
                type="button"
                onClick={() => setActiveImageIndex(idx)}
                sx={{
                  flex: '0 0 auto',
                  width: 40,
                  height: 40,
                  p: 0,
                  border: 2,
                  borderColor:
                    idx === displayIdx ? 'primary.main' : 'grey.300',
                  borderRadius: 0.5,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  bgcolor: 'background.paper',
                  opacity: idx === displayIdx ? 1 : 0.75,
                  '&:hover': {
                    borderColor: 'primary.light',
                    opacity: 1,
                  },
                }}
              >
                <Box
                  component="img"
                  src={itemImageDisplayUrl(img) ?? img.image_url}
                  alt=""
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Content Section - Bottom */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1, p: 1.5, pb: 1 }}>
          {inventory.business_location.logo_url ? (
            <ButtonBase
              component="div"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                navigate(`/store/${inventory.business_location.id}`);
              }}
              aria-label={t('stores.openStoreA11y', 'Open store {{name}}', {
                name: inventory.business_location.business.name,
              })}
              sx={{ display: 'block', mb: 1, borderRadius: 1, '&:hover': { opacity: 0.8 } }}
            >
              <Box
                component="img"
                src={inventory.business_location.logo_url}
                alt={inventory.business_location.name || ''}
                sx={{
                  maxHeight: 40,
                  width: 'auto',
                  objectFit: 'contain',
                  display: 'block',
                  alignSelf: 'flex-start',
                }}
              />
            </ButtonBase>
          ) : null}
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
            <ButtonBase
              onClick={goToDetails}
              aria-label={t('items.itemCard.openDetails', {
                defaultValue: 'Open {{name}} details',
                name: inventory.item.name,
              })}
              sx={{
                width: '100%',
                display: 'block',
                textAlign: 'left',
                borderRadius: 1,
                '&:hover .rsItemTitle': { textDecoration: 'underline' },
              }}
            >
              <Typography
                className="rsItemTitle"
                variant="h6"
                sx={{
                  mb: descriptionPreview ? 0.25 : 0.5,
                  lineHeight: 1.2,
                  fontSize: '1rem',
                  fontWeight: 700,
                }}
              >
                {inventory.item.name}
              </Typography>
            </ButtonBase>
            {descriptionPreview ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mb: 0.5,
                  fontSize: '0.8125rem',
                  lineHeight: 1.45,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word',
                }}
              >
                {descriptionPreview}
              </Typography>
            ) : null}
            {showAggregateRating && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  flexWrap: 'wrap',
                  mb: 0.75,
                }}
                aria-label={t('items.itemCard.ratingAria', {
                  avg: inventory.avg_rating!.toFixed(1),
                  count: ratingCount,
                  defaultValue:
                    'Average rating {{avg}} out of 5, {{count}} ratings',
                })}
              >
                <Rating
                  value={inventory.avg_rating!}
                  readOnly
                  precision={0.1}
                  size="small"
                  sx={{ color: 'warning.main' }}
                />
                <Typography
                  component="span"
                  variant="caption"
                  fontWeight={700}
                  color="text.primary"
                >
                  {inventory.avg_rating!.toFixed(1)}
                </Typography>
                <Typography
                  component="span"
                  variant="caption"
                  color="text.secondary"
                >
                  {t('items.itemCard.ratingsCount', {
                    count: ratingCount,
                    defaultValue: '{{count}} ratings',
                  })}
                </Typography>
              </Box>
            )}
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
                gap: 0.75,
                flexWrap: 'wrap',
              }}
            >
              <Chip
                label={t('items.itemCard.availableCount', '{{count}} available', {
                  count: inventory.computed_available_quantity,
                })}
                color={
                  inventory.computed_available_quantity > 0
                    ? 'success'
                    : 'error'
                }
                size="small"
                sx={{ fontSize: '0.7rem' }}
              />
            </Box>
            {hasVariantOptions ? (
              <CatalogOptionChips
                options={optionList}
                value={selectionId}
                onChange={setSelectionId}
                disabled={isUnavailable}
              />
            ) : null}
            {specs.weightLabel || specs.dimensionsLabel ? (
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 1,
                  mt: 0.75,
                  alignItems: 'center',
                }}
              >
                {specs.weightLabel ? (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      minWidth: 0,
                    }}
                  >
                    <Scale sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: '0.7rem' }}
                      noWrap
                    >
                      {t('items.itemCard.weight', 'Weight')}: {specs.weightLabel}
                    </Typography>
                  </Box>
                ) : null}
                {specs.dimensionsLabel ? (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      minWidth: 0,
                    }}
                  >
                    <Straighten sx={{ fontSize: 14, color: 'text.secondary' }} />
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: '0.7rem' }}
                      noWrap
                    >
                      {t('items.itemCard.dimensions', 'Size')}:{' '}
                      {specs.dimensionsLabel}
                    </Typography>
                  </Box>
                ) : null}
              </Box>
            ) : null}
          </Box>

          {/* Business + store location */}
          <Box sx={{ mb: 1 }}>
            <ButtonBase
              component="div"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                navigate(`/store/${inventory.business_location.id}`);
              }}
              aria-label={t('stores.openStoreA11y', 'Open store {{name}}', {
                name: inventory.business_location.business.name,
              })}
              sx={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                borderRadius: 1,
                '&:hover': { opacity: 0.8 },
              }}
            >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mb: 0.25,
                flexWrap: 'wrap',
              }}
            >
              <Business fontSize="small" color="primary" />
              <Typography
                variant="caption"
                fontWeight="medium"
                sx={{ fontSize: '0.7rem', color: 'primary.main' }}
              >
                {inventory.business_location.business.name}
              </Typography>
              {inventory.business_location.business.is_verified && (
                <Verified fontSize="small" color="success" />
              )}
              {isOpeningSoon ? (
                <Chip
                  size="small"
                  color="info"
                  label={openingSoonLabel}
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              ) : null}
              {!inventory.business_location.name?.trim() && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem', ml: 0.5 }}
                >
                  • {inventory.business_location.address.city}
                </Typography>
              )}
            </Box>
            {inventory.business_location.name?.trim() && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  flexWrap: 'wrap',
                }}
              >
                <Store fontSize="small" color="primary" />
                <Typography
                  variant="caption"
                  fontWeight={600}
                  color="primary"
                  sx={{ fontSize: '0.7rem' }}
                >
                  {inventory.business_location.name.trim()}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.7rem' }}
                >
                  • {inventory.business_location.address.city}
                </Typography>
              </Box>
            )}
            </ButtonBase>
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

          </Box>

          {/* Compact Info Row */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            {/* Delivery Info */}
            {inventory.item.max_delivery_distance && (
              <Chip
                label={t(
                  'items.itemCard.maxDeliveryDistance',
                  'Max {{km}} km',
                  { km: inventory.item.max_delivery_distance }
                )}
                size="small"
                color="secondary"
                variant="outlined"
                sx={{ fontSize: '0.7rem', height: '20px' }}
              />
            )}
            {inventory.item.estimated_delivery_time && (
              <Chip
                label={t('items.itemCard.etaMinutes', '~{{min}} min', {
                  min: inventory.item.estimated_delivery_time,
                })}
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
                    label={t('items.itemCard.fragile', 'Fragile')}
                    color="warning"
                    size="small"
                    sx={{ fontSize: '0.7rem', height: '20px' }}
                  />
                )}
                {inventory.item.is_perishable && (
                  <Chip
                    label={t('items.itemCard.perishable', 'Perishable')}
                    color="error"
                    size="small"
                    sx={{ fontSize: '0.7rem', height: '20px' }}
                  />
                )}
                {inventory.item.requires_special_handling && (
                  <Chip
                    label={t('items.itemCard.specialHandling', 'Special')}
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
                  {calculatingDistanceLabel}
                </Typography>
              )}
              {distanceError && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ fontSize: '0.7rem' }}
                >
                  {distanceErrorLabel}: {distanceError}
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
            onClick={() => {
              void trackSiteEvent({
                eventType: SITE_EVENT_INVENTORY_CARD_VIEW_DETAILS_CLICK,
                subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
                subjectId: inventory.id,
              });
              goToDetails();
            }}
            sx={{ alignSelf: 'center' }}
          >
            {viewDetailsLabel}
          </Button>
          {inventory.computed_available_quantity === 0 ? (
            <Button
              variant="outlined"
              disabled
              size="small"
              sx={{ width: '75%' }}
            >
              {outOfStockLabel}
            </Button>
          ) : !inventory.is_active ? (
            <Button
              variant="outlined"
              disabled
              size="small"
              sx={{ width: '75%' }}
            >
              {notAvailableLabel}
            </Button>
          ) : !canOrder ? (
            <Button
              variant="outlined"
              disabled
              size="small"
              sx={{ width: '75%' }}
            >
              {clientsOnlyLabel}
            </Button>
          ) : !merchantCanAcceptOrders ? (
            <Button variant="outlined" disabled size="small" sx={{ width: '75%' }}>
              {merchantNotAcceptingLabel}
            </Button>
          ) : isPublicView ? (
            <Button
              variant="contained"
              startIcon={<ShoppingCart />}
              onClick={() => {
                void trackSiteEvent({
                  eventType: SITE_EVENT_INVENTORY_BUY_NOW_CLICK,
                  subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
                  subjectId: inventory.id,
                });
                setAnonBuyNowOpen(true);
              }}
              size="small"
              sx={{ width: '75%', alignSelf: 'center' }}
            >
              {resolvedBuyNowButtonText}
            </Button>
          ) : showCartButtons && onAddToCart ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                width: '100%',
              }}
            >
              {inCart ? (
                <Chip
                  icon={<CheckCircle sx={{ fontSize: '16px !important' }} />}
                  label={inCartLabel}
                  size="small"
                  color="primary"
                  variant="outlined"
                  sx={{ alignSelf: 'flex-start', height: 24 }}
                />
              ) : null}
              <Button
                variant={inCart ? 'contained' : 'outlined'}
                color="primary"
                startIcon={<ShoppingCart />}
                onClick={() => onAddToCart(inventory, selectionId)}
                size="small"
                fullWidth
                aria-label={
                  inCart
                    ? t('cart.inCartA11y', 'In cart, quantity {{count}}. Add more', {
                        count: inCartQuantity,
                      })
                    : resolvedAddToCartButtonText
                }
                sx={{
                  minHeight: '36px',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {resolvedAddToCartLabel}
              </Button>
              {!merchantCanAcceptOrders ? (
                <Button variant="outlined" disabled size="small" fullWidth>
                  {merchantNotAcceptingLabel}
                </Button>
              ) : (
              <Button
                variant="contained"
                onClick={() => {
                  void trackSiteEvent({
                    eventType: SITE_EVENT_INVENTORY_BUY_NOW_CLICK,
                    subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
                    subjectId: inventory.id,
                  });
                  onOrderClick(inventory, selectionId);
                }}
                size="small"
                fullWidth
                sx={{
                  minHeight: '36px',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {resolvedBuyNowButtonText}
              </Button>
              )}
            </Box>
          ) : (
            <Button
              variant="contained"
              startIcon={<ShoppingCart />}
              onClick={() => {
                void trackSiteEvent({
                  eventType: SITE_EVENT_INVENTORY_ORDER_NOW_CLICK,
                  subjectType: SITE_EVENT_SUBJECT_INVENTORY_ITEM,
                  subjectId: inventory.id,
                });
                onOrderClick(inventory, selectionId);
              }}
              size="small"
              sx={{ width: '75%' }}
            >
              {resolvedOrderButtonText}
            </Button>
          )}
        </CardActions>
      </Box>

      <AnonymousBuyNowDialog
        open={anonBuyNowOpen}
        inventoryItemId={inventory.id}
        variantId={cartVariantId}
        item={{
          title: inventory.item.name,
          imageUrl: displayImageUrl,
          priceText: checkoutPriceText,
          quantity: 1,
        }}
        onClose={() => setAnonBuyNowOpen(false)}
        primaryCtaLabel={resolvedBuyNowButtonText}
        secondaryCtaLabel={resolvedLoginButtonText}
        openLoginDialogOnSecondaryCta
      />
    </Card>
  );
};

export default DashboardItemCard;
