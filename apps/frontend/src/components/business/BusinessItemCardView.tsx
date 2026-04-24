import {
  AutoAwesome as AutoAwesomeIcon,
  ChevronLeft,
  ChevronRight,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Image as ImageIcon,
  Inventory as InventoryIcon,
  LocalOffer as DealIcon,
  LocationOn as LocationOnIcon,
  TrendingUp as   PromoteIcon,
  Star,
  StarBorder,
  Visibility as ViewIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Dialog,
  DialogContent,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSwipeImageNavigation } from '../../hooks/useSwipeImageNavigation';
import { ImageLightboxTapZones } from '../common/ImageLightboxTapZones';
import {
  itemHasActiveDeal,
  itemHasActivePromotion,
  itemHasSponsoredPromotion,
} from '../../utils/businessItemListing';

interface BusinessInventory {
  id: string;
  computed_available_quantity: number;
  reorder_point: number;
  promotion?: {
    promoted?: boolean;
    start?: string;
    end?: string;
    sponsored?: boolean;
  } | null;
  item_deals?: Array<{
    id: string;
    start_at: string;
    end_at: string;
    is_active: boolean;
  }>;
}

interface ItemImage {
  id?: string;
  image_type: string;
  image_url: string;
  alt_text?: string;
  display_order?: number;
}

/** Main image first, then others sorted by display_order (matches listing API). */
function orderedCardGalleryImages(images: ItemImage[] | undefined): ItemImage[] {
  if (!images?.length) return [];
  const byOrder = [...images].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
  );
  const main = byOrder.find((i) => i.image_type === 'main');
  if (!main) return byOrder;
  return [main, ...byOrder.filter((i) => i !== main)];
}

interface Item {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  sku: string;
  is_active: boolean;
  is_fragile?: boolean;
  is_perishable?: boolean;
  requires_special_handling?: boolean;
  brand?: {
    name: string;
  };
  item_sub_category?: {
    name: string;
    item_category?: {
      name: string;
    };
  };
  item_images?: ItemImage[];
  item_tags?: Array<{ tag: { id: string; name: string } }>;
  business_inventories?: BusinessInventory[];
  is_favorite?: boolean;
}

interface BusinessItemCardViewProps {
  item: Item;
  onViewItem: (item: Item) => void;
  onEditItem: (item: Item) => void;
  onDeleteItem: (item: Item) => void;
  onRestockInventoryItem: (item: Item) => void;
  onManageDeals?: (item: Item) => void;
  onPromoteItem?: (item: Item) => void;
  onRefineWithAi?: (item: Item) => void;
  onToggleItemActive?: (item: Item, isActive: boolean) => void | Promise<void>;
  onToggleFavorite?: (item: Item, favorited: boolean) => void | Promise<void>;
}

const BusinessItemCardView: React.FC<BusinessItemCardViewProps> = ({
  item,
  onViewItem,
  onEditItem,
  onDeleteItem,
  onRestockInventoryItem,
  onManageDeals,
  onPromoteItem,
  onRefineWithAi,
  onToggleItemActive,
  onToggleFavorite,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [togglingActive, setTogglingActive] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);

  const galleryImages = useMemo(
    () => orderedCardGalleryImages(item.item_images),
    [item.item_images]
  );
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [item.id]);

  useEffect(() => {
    if (!imageLightboxOpen || galleryImages.length <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveImageIndex((i) =>
          i === 0 ? galleryImages.length - 1 : i - 1
        );
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveImageIndex((i) =>
          i === galleryImages.length - 1 ? 0 : i + 1
        );
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [imageLightboxOpen, galleryImages.length]);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const displayIdx =
    galleryImages.length === 0
      ? 0
      : Math.min(activeImageIndex, galleryImages.length - 1);
  const displayImage = galleryImages[displayIdx];
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

  const cardLightboxSwipe = useSwipeImageNavigation(
    goNextImage,
    goPrevImage,
    imageLightboxOpen && hasMultipleImages
  );

  // Count locations where item is available
  const locationCount = item.business_inventories?.length || 0;

  // Check if item has any low stock across locations
  const hasLowStock = item.business_inventories?.some(
    (inv) =>
      inv.computed_available_quantity <= inv.reorder_point &&
      inv.computed_available_quantity > 0
  );

  // Check if item is out of stock everywhere
  const isOutOfStock =
    locationCount === 0 ||
    item.business_inventories?.every(
      (inv) => inv.computed_available_quantity === 0
    );

  // Check if item has images
  const hasImages = item.item_images && item.item_images.length > 0;

  // Check if item requires special handling
  const hasSpecialHandling =
    item.is_fragile || item.is_perishable || item.requires_special_handling;

  const hasActiveDeal = itemHasActiveDeal(item);
  const hasActivePromotion = itemHasActivePromotion(item);
  const hasSponsoredPromotion = itemHasSponsoredPromotion(item);

  const handleListingActiveChange = async (checked: boolean) => {
    if (!onToggleItemActive) return;
    setTogglingActive(true);
    try {
      await onToggleItemActive(item, checked);
    } finally {
      setTogglingActive(false);
    }
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onToggleFavorite || togglingFavorite) return;
    const next = !item.is_favorite;
    setTogglingFavorite(true);
    void Promise.resolve(onToggleFavorite(item, next)).finally(() =>
      setTogglingFavorite(false)
    );
  };

  return (
    <Card
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        transition: 'all 0.3s ease',
        border: '1px solid',
        borderColor: isOutOfStock ? 'error.light' : 'divider',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8],
          borderColor: 'primary.main',
        },
      }}
    >
      {onToggleFavorite && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 2,
          }}
        >
          <Tooltip
            title={t(
              'business.items.favoriteToggleHint',
              'Mark as favorite for quick filtering and export'
            )}
          >
            <span>
              <IconButton
                type="button"
                size="small"
                onClick={handleFavoriteClick}
                disabled={togglingFavorite}
                aria-pressed={Boolean(item.is_favorite)}
                aria-label={t('business.items.favoriteToggleAria', 'Toggle favorite')}
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.92)',
                  boxShadow: 1,
                  '&:hover': { bgcolor: 'common.white' },
                }}
              >
                {item.is_favorite ? (
                  <Star sx={{ color: 'warning.main', fontSize: 22 }} />
                ) : (
                  <StarBorder sx={{ color: 'text.secondary', fontSize: 22 }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      )}

      {/* Status Badges - Top Right Corner */}
      <Box
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          zIndex: 1,
        }}
      >
        {!item.is_active && (
          <Chip
            label={t('business.items.inactive')}
            size="small"
            color="default"
            sx={{
              bgcolor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              fontSize: '0.7rem',
              height: 24,
            }}
          />
        )}
        {isOutOfStock && (
          <Chip
            label={t('business.inventory.status.outOfStock', 'Out of Stock')}
            size="small"
            color="error"
            sx={{
              bgcolor: 'error.main',
              color: 'white',
              fontSize: '0.7rem',
              height: 24,
            }}
          />
        )}
        {hasLowStock && !isOutOfStock && (
          <Chip
            label={t('business.inventory.status.lowStock', 'Low Stock')}
            size="small"
            color="warning"
            sx={{
              bgcolor: 'warning.main',
              color: 'white',
              fontSize: '0.7rem',
              height: 24,
            }}
          />
        )}
      </Box>

      {/* Image gallery (thumbnails + click / arrows when multiple) */}
      <Box
        sx={{
          height: 200,
          position: 'relative',
          bgcolor: 'grey.100',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {displayImage ? (
          <>
            <Tooltip
              title={t(
                'business.items.cardGalleryClickEnlarge',
                'Click to view full size'
              )}
            >
              <Box
                sx={{
                  position: 'relative',
                  flex: hasMultipleImages ? '1 1 auto' : '1 1 100%',
                  minHeight: 0,
                  cursor: displayImage ? 'pointer' : 'default',
                }}
                role={displayImage ? 'button' : undefined}
                tabIndex={displayImage ? 0 : undefined}
                onClick={() => displayImage && setImageLightboxOpen(true)}
                onKeyDown={(e) => {
                  if (!displayImage) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setImageLightboxOpen(true);
                  }
                }}
              >
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
                      left: 8,
                      zIndex: 1,
                      bgcolor: 'rgba(0, 0, 0, 0.65)',
                      color: 'common.white',
                      fontSize: '0.7rem',
                      height: 22,
                      '& .MuiChip-label': { px: 1 },
                    }}
                  />
                )}
                <CardMedia
                  component="img"
                  image={displayImage.image_url}
                  alt={displayImage.alt_text || item.name}
                  sx={{
                    width: '100%',
                    height: hasMultipleImages ? '100%' : 200,
                    minHeight: hasMultipleImages ? 0 : 200,
                    objectFit: 'contain',
                    objectPosition: 'center',
                    display: 'block',
                  }}
                />
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
                        bgcolor: 'rgba(255, 255, 255, 0.85)',
                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.95)' },
                        p: 0.25,
                      }}
                    >
                      <ChevronRight fontSize="small" />
                    </IconButton>
                  </>
                )}
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
                    onClick={() => {
                      setActiveImageIndex(idx);
                      setImageLightboxOpen(true);
                    }}
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
                      src={img.image_url}
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
          </>
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
              p: 2,
              height: '100%',
            }}
          >
            <ImageIcon sx={{ fontSize: 60, opacity: 0.3, mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {t('business.items.noImage', 'No Image')}
            </Typography>
          </Box>
        )}
      </Box>

      {(hasActiveDeal || hasActivePromotion) && (
        <Stack
          direction="row"
          spacing={0.5}
          useFlexGap
          flexWrap="wrap"
          sx={{
            px: 1.5,
            py: 0.75,
            gap: 0.5,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'action.hover',
          }}
        >
          {hasActiveDeal && (
            <Chip
              size="small"
              icon={<DealIcon sx={{ '&&': { fontSize: 16 } }} />}
              label={t('business.items.badgeDeal', 'Deal')}
              color="secondary"
              variant="filled"
              sx={{ fontWeight: 600, fontSize: '0.7rem' }}
            />
          )}
          {hasActivePromotion && (
            <Chip
              size="small"
              icon={<PromoteIcon sx={{ '&&': { fontSize: 16 } }} />}
              label={
                hasSponsoredPromotion
                  ? t('business.items.badgeSponsored', 'Sponsored')
                  : t('business.items.badgePromoted', 'Promoted')
              }
              color="success"
              variant="filled"
              sx={{ fontWeight: 600, fontSize: '0.7rem' }}
            />
          )}
        </Stack>
      )}

      <CardContent
        sx={{
          flexGrow: 1,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* Item Name and Description */}
        <Box sx={{ mb: 2, flexGrow: 1 }}>
          <Typography
            variant="h6"
            gutterBottom
            noWrap
            sx={{
              fontWeight: 600,
              fontSize: '1.1rem',
            }}
          >
            {item.name}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: 40,
            }}
          >
            {item.description ||
              t('business.items.noDescription', 'No description')}
          </Typography>

          {/* Price */}
          <Typography
            variant="h6"
            color="primary"
            sx={{
              fontWeight: 700,
              fontSize: '1.25rem',
            }}
          >
            {formatCurrency(item.price, item.currency)}
          </Typography>

          {onToggleItemActive && (
            <FormControlLabel
              sx={{ mt: 1, ml: 0, mr: 0, display: 'flex', alignItems: 'center' }}
              control={
                <Switch
                  size="small"
                  checked={item.is_active}
                  disabled={togglingActive}
                  onChange={(_e, checked) => {
                    void handleListingActiveChange(checked);
                  }}
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  {t('business.items.listingActive', 'Listing active')}
                </Typography>
              }
            />
          )}
        </Box>

        {/* Item Metadata */}
        <Stack spacing={1} sx={{ mb: 2 }}>
          {/* SKU and Brand */}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip
              label={item.sku}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.75rem' }}
            />
            {item.brand && (
              <Chip
                label={item.brand.name}
                size="small"
                variant="outlined"
                color="primary"
                sx={{ fontSize: '0.75rem' }}
              />
            )}
          </Box>

          {/* Category */}
          {item.item_sub_category && (
            <Typography variant="caption" color="text.secondary">
              {item.item_sub_category.item_category?.name} ›{' '}
              {item.item_sub_category.name}
            </Typography>
          )}
          {/* Tags */}
          {item.item_tags && item.item_tags.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {item.item_tags.slice(0, 5).map((it) => (
                <Chip
                  key={it.tag.id}
                  label={it.tag.name}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              ))}
              {item.item_tags.length > 5 && (
                <Chip
                  label={`+${item.item_tags.length - 5}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem' }}
                />
              )}
            </Box>
          )}
        </Stack>

        {/* Location and Status Indicators */}
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            mb: 2,
            pb: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          {/* Locations Count */}
          <Tooltip
            title={t(
              'business.inventory.locationsWithStock',
              'Locations with stock'
            )}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LocationOnIcon
                fontSize="small"
                color={locationCount > 0 ? 'primary' : 'disabled'}
              />
              <Typography variant="body2" fontWeight="medium">
                {locationCount}
              </Typography>
            </Box>
          </Tooltip>

          {/* Images Count */}
          <Tooltip title={t('business.items.imagesCount', 'Number of images')}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ImageIcon
                fontSize="small"
                color={hasImages ? 'primary' : 'disabled'}
              />
              <Typography variant="body2" fontWeight="medium">
                {item.item_images?.length || 0}
              </Typography>
            </Box>
          </Tooltip>

          {/* Special Handling Indicator */}
          {hasSpecialHandling && (
            <Tooltip
              title={
                <>
                  {item.is_fragile && (
                    <div>{t('business.items.fragile', 'Fragile')}</div>
                  )}
                  {item.is_perishable && (
                    <div>{t('business.items.perishable', 'Perishable')}</div>
                  )}
                  {item.requires_special_handling && (
                    <div>
                      {t('business.items.specialHandling', 'Special Handling')}
                    </div>
                  )}
                </>
              }
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <WarningIcon fontSize="small" color="warning" />
              </Box>
            </Tooltip>
          )}
        </Box>

        {/* Actions */}
        <Stack direction="row" spacing={0.5} sx={{ mt: 'auto' }}>
          <Tooltip title={t('business.items.viewItem', 'View Item')}>
            <IconButton
              size="small"
              onClick={() => onViewItem(item)}
              sx={{
                color: theme.palette.info.main,
                '&:hover': {
                  bgcolor: 'info.light',
                  opacity: 0.8,
                },
              }}
            >
              <ViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('business.items.editItem', 'Edit Item')}>
            <IconButton
              size="small"
              onClick={() => onEditItem(item)}
              sx={{
                color: theme.palette.primary.main,
                '&:hover': {
                  bgcolor: 'primary.light',
                  opacity: 0.8,
                },
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {onRefineWithAi && (
            <Tooltip
              title={t(
                'business.items.refineWithAi.tooltip',
                'Refine product with AI'
              )}
            >
              <span>
                <IconButton
                  size="small"
                  onClick={() => onRefineWithAi(item)}
                  disabled={!hasImages}
                  sx={{
                    color: theme.palette.secondary.main,
                    '&:hover': {
                      bgcolor: 'secondary.light',
                      opacity: 0.8,
                    },
                  }}
                >
                  <AutoAwesomeIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {item.business_inventories?.[0] && (
            <Tooltip title={t('business.inventory.restock', 'Restock')}>
              <IconButton
                size="small"
                onClick={() => onRestockInventoryItem(item)}
                sx={{
                  color: theme.palette.warning.main,
                  '&:hover': {
                    bgcolor: 'warning.light',
                    opacity: 0.8,
                  },
                }}
              >
                <InventoryIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onManageDeals && (
            <Tooltip title={t('business.items.manageDeals', 'Manage deals')}>
              <IconButton
                size="small"
                onClick={() => onManageDeals(item)}
                sx={{
                  color: theme.palette.secondary.main,
                  '&:hover': {
                    bgcolor: 'secondary.light',
                    opacity: 0.8,
                  },
                }}
              >
                <DealIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onPromoteItem && (
            <Tooltip
              title={t('business.items.promotion.tooltip', 'Promote listing')}
            >
              <span>
                <IconButton
                  size="small"
                  onClick={() => onPromoteItem(item)}
                  disabled={!item.business_inventories?.length}
                  sx={{
                    color: theme.palette.success.main,
                    '&:hover': {
                      bgcolor: 'success.light',
                      opacity: 0.8,
                    },
                  }}
                >
                  <PromoteIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          <Tooltip title={t('business.items.deleteItem', 'Delete Item')}>
            <IconButton
              size="small"
              onClick={() => onDeleteItem(item)}
              sx={{
                color: theme.palette.error.main,
                '&:hover': {
                  bgcolor: 'error.light',
                  opacity: 0.8,
                },
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </CardContent>

      <Dialog
        open={imageLightboxOpen && Boolean(displayImage)}
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
          aria-label={t('common.close', 'Close')}
          onClick={() => setImageLightboxOpen(false)}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: 'white',
            bgcolor: 'rgba(0,0,0,0.5)',
            zIndex: 2,
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
            position: 'relative',
            gap: 1,
          }}
        >
          {displayImage && (
            <>
              {hasMultipleImages && (
                <IconButton
                  aria-label={t(
                    'business.items.cardGalleryPrevious',
                    'Previous photo'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrevImage();
                  }}
                  sx={{
                    color: 'common.white',
                    bgcolor: 'rgba(0,0,0,0.45)',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
                  }}
                >
                  <ChevronLeft />
                </IconButton>
              )}
              <ImageLightboxTapZones
                showTapZones={hasMultipleImages}
                onPrevious={goPrevImage}
                onNext={goNextImage}
                previousLabel={t(
                  'business.items.cardGalleryPrevious',
                  'Previous photo'
                )}
                nextLabel={t('business.items.cardGalleryNext', 'Next photo')}
                onTouchStart={cardLightboxSwipe.onTouchStart}
                onTouchEnd={cardLightboxSwipe.onTouchEnd}
              >
                <Box
                  component="img"
                  src={displayImage.image_url}
                  alt={displayImage.alt_text || item.name}
                  sx={{
                    maxWidth: '100%',
                    maxHeight: '90vh',
                    objectFit: 'contain',
                    display: 'block',
                    touchAction: 'pan-y',
                  }}
                />
              </ImageLightboxTapZones>
              {hasMultipleImages && (
                <IconButton
                  aria-label={t(
                    'business.items.cardGalleryNext',
                    'Next photo'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    goNextImage();
                  }}
                  sx={{
                    color: 'common.white',
                    bgcolor: 'rgba(0,0,0,0.45)',
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
                  }}
                >
                  <ChevronRight />
                </IconButton>
              )}
              {hasMultipleImages && (
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    bottom: 8,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    color: 'common.white',
                    bgcolor: 'rgba(0,0,0,0.5)',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1,
                  }}
                >
                  {t('business.items.imageLightboxCounter', '{{current}} of {{total}}', {
                    current: displayIdx + 1,
                    total: galleryImages.length,
                  })}
                </Typography>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default BusinessItemCardView;
