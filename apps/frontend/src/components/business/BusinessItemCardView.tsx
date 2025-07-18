import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Inventory as InventoryIcon,
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

interface BusinessItemCardViewProps {
  item: any;
  onEditItem: (item: any) => void;
  onDeleteItem: (item: any) => void;
  onRestockInventoryItem: (item: any) => void;
}

const BusinessItemCardView: React.FC<BusinessItemCardViewProps> = ({
  item,
  onEditItem,
  onDeleteItem,
  onRestockInventoryItem,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const getStockStatus = (quantity: number, reorderPoint: number) => {
    if (quantity === 0) {
      return { status: 'outOfStock', color: 'error' as const };
    } else if (quantity <= reorderPoint) {
      return { status: 'lowStock', color: 'warning' as const };
    } else {
      return { status: 'inStock', color: 'success' as const };
    }
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const mainImage = item.item_images?.find(
    (img: any) => img.image_type === 'main'
  );
  const itemInventory = item.business_inventories?.[0];
  const stockStatus = itemInventory
    ? getStockStatus(
        itemInventory.available_quantity,
        itemInventory.reorder_point
      )
    : null;

  return (
    <Card
      sx={{
        height: '100%',
        width: '100%',
        minHeight: 400,
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[8],
        },
      }}
    >
      {/* Image Section */}
      <CardMedia
        component="img"
        height="200"
        image={mainImage?.image_url || '/src/assets/no-image.svg'}
        alt={mainImage?.alt_text || item.name}
        sx={{
          objectFit: 'cover',
          backgroundColor: theme.palette.grey[100],
        }}
      />

      <CardContent
        sx={{
          flexGrow: 1,
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* Item Section */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom noWrap>
            {item.name}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mb: 1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.description}
          </Typography>
          <Typography variant="h6" color="primary" gutterBottom>
            {formatCurrency(item.price, item.currency)}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Chip label={item.sku} size="small" variant="outlined" />
            {item.is_active ? (
              <Chip
                label={t('business.items.active')}
                size="small"
                color="success"
              />
            ) : (
              <Chip
                label={t('business.items.inactive')}
                size="small"
                color="default"
              />
            )}
          </Stack>
        </Box>

        {/* Inventory Section */}
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="subtitle2"
            color="text.secondary"
            gutterBottom
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <InventoryIcon fontSize="small" />
            {t('business.inventory.title')}
          </Typography>
          {itemInventory ? (
            <Stack spacing={1}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">
                  {t('business.inventory.available')}:
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {itemInventory.available_quantity}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">
                  {t('business.inventory.sellingPrice')}:
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {formatCurrency(itemInventory.selling_price, item.currency)}
                </Typography>
              </Box>
              <Chip
                label={t(`business.inventory.status.${stockStatus?.status}`)}
                size="small"
                color={stockStatus?.color}
                sx={{ alignSelf: 'flex-start' }}
              />
            </Stack>
          ) : (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontStyle: 'italic' }}
            >
              {t('business.inventory.noInventory')}
            </Typography>
          )}
        </Box>

        {/* Actions */}
        <Stack direction="row" spacing={1} sx={{ mt: 'auto' }}>
          <Tooltip title={t('business.items.editItem')}>
            <IconButton
              size="small"
              onClick={() => onEditItem(item)}
              sx={{ color: theme.palette.primary.main }}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          {itemInventory && (
            <Tooltip title={t('business.inventory.restock')}>
              <IconButton
                size="small"
                onClick={() => onRestockInventoryItem(item)}
                sx={{ color: theme.palette.warning.main }}
              >
                <InventoryIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title={t('business.items.deleteItem')}>
            <IconButton
              size="small"
              onClick={() => onDeleteItem(item)}
              sx={{ color: theme.palette.error.main }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default BusinessItemCardView;
