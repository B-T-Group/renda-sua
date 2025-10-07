import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Image as ImageIcon,
  LocationOn as LocationOnIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface BusinessInventory {
  id: string;
  computed_available_quantity: number;
  reorder_point: number;
}

interface ItemImage {
  image_type: string;
  image_url: string;
  alt_text?: string;
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
  business_inventories?: BusinessInventory[];
}

interface BusinessItemCardViewProps {
  item: Item;
  onViewItem: (item: Item) => void;
  onEditItem: (item: Item) => void;
  onDeleteItem: (item: Item) => void;
  onRestockInventoryItem: (item: Item) => void;
}

const BusinessItemCardView: React.FC<BusinessItemCardViewProps> = ({
  item,
  onViewItem,
  onEditItem,
  onDeleteItem,
  onRestockInventoryItem,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const mainImage = item.item_images?.find((img) => img.image_type === 'main');

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

      {/* Image Section with No Image Placeholder */}
      <Box
        sx={{
          height: 200,
          position: 'relative',
          bgcolor: mainImage ? 'transparent' : 'grey.100',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {mainImage ? (
          <CardMedia
            component="img"
            height="200"
            image={mainImage.image_url}
            alt={mainImage.alt_text || item.name}
            sx={{
              objectFit: 'cover',
            }}
          />
        ) : (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'text.secondary',
              p: 2,
            }}
          >
            <ImageIcon sx={{ fontSize: 60, opacity: 0.3, mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {t('business.items.noImage', 'No Image')}
            </Typography>
          </Box>
        )}
      </Box>

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
    </Card>
  );
};

export default BusinessItemCardView;
