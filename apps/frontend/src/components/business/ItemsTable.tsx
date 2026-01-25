import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Badge,
  Box,
  Card,
  CardActions,
  CardContent,
  Chip,
  Grid,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Item } from '../../hooks/useItems';

interface ItemsTableProps {
  items: Item[];
  loading: boolean;
  onEditItem: (item: Item) => void;
  onViewItem?: (item: Item) => void;
  onDeleteItem?: (item: Item) => void;
}

const ItemsTable: React.FC<ItemsTableProps> = ({
  items,
  loading,
  onEditItem,
  onViewItem,
  onDeleteItem,
}) => {
  const { t } = useTranslation();

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const getItemStatusColor = (isActive: boolean) => {
    return isActive ? 'success' : 'default';
  };

  const getItemStatusLabel = (isActive: boolean) => {
    return isActive ? t('business.items.active') : t('business.items.inactive');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <Typography variant="body1" color="text.secondary">
          {t('common.loading')}
        </Typography>
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box textAlign="center" py={4}>
        <Typography variant="body1" color="text.secondary">
          {t('business.items.noItems')}
        </Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      {items.map((item) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
          <Card
            sx={{
              height: '400px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ flexGrow: 1, overflow: 'hidden' }}>
              {/* Item Header */}
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="flex-start"
                mb={1}
              >
                <Box flex={1} sx={{ minWidth: 0 }}>
                  <Typography variant="h6" gutterBottom noWrap>
                    {item.name}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      lineHeight: 1.2,
                      mb: 1,
                    }}
                  >
                    {item.description}
                  </Typography>
                </Box>
                <Chip
                  label={getItemStatusLabel(item.is_active)}
                  color={getItemStatusColor(item.is_active)}
                  size="small"
                  sx={{ ml: 1, flexShrink: 0 }}
                />
              </Box>

              {/* Item Details */}
              <Box mb={1}>
                <Typography variant="h6" color="primary" fontWeight="bold">
                  {formatCurrency(item.price, item.currency)}
                </Typography>

                {item.brand && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 0.5 }}
                    noWrap
                  >
                    {t('business.items.brand')}: {item.brand.name}
                  </Typography>
                )}

                {item.sku && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 0.5 }}
                    noWrap
                  >
                    {t('business.items.sku')}: {item.sku}
                  </Typography>
                )}

                {item.item_sub_category && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 0.5 }}
                    noWrap
                  >
                    {t('business.items.category')}:{' '}
                    {item.item_sub_category.item_category.name} →{' '}
                    {item.item_sub_category.name}
                  </Typography>
                )}
              </Box>

              {/* Item Properties */}
              <Box mb={1}>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {item.is_fragile && (
                    <Chip
                      label={t('business.items.fragile')}
                      size="small"
                      color="warning"
                    />
                  )}
                  {item.is_perishable && (
                    <Chip
                      label={t('business.items.perishable')}
                      size="small"
                      color="error"
                    />
                  )}
                  {item.requires_special_handling && (
                    <Chip
                      label={t('business.items.specialHandling')}
                      size="small"
                      color="info"
                    />
                  )}
                </Stack>
              </Box>

              {/* Item Specifications */}
              <Box sx={{ mt: 'auto' }}>
                <Stack spacing={0.5}>
                  {item.weight && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {t('business.items.weight')}: {item.weight}{' '}
                      {item.weight_unit}
                    </Typography>
                  )}
                  {item.dimensions && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {t('business.items.dimensions')}: {item.dimensions}
                    </Typography>
                  )}
                  {item.color && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {t('business.items.color')}: {item.color}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </CardContent>

            <CardActions sx={{ justifyContent: 'space-between', p: 2 }}>
              <Box>
                {onViewItem && (
                  <Tooltip title={t('business.items.viewItem')}>
                    <IconButton
                      size="small"
                      onClick={() => onViewItem(item)}
                      color="primary"
                    >
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={t('business.items.editItem')}>
                  <IconButton
                    size="small"
                    onClick={() => onEditItem(item)}
                    color="primary"
                  >
                    <EditIcon />
                  </IconButton>
                </Tooltip>
                {onDeleteItem && (
                  <Tooltip title={t('business.items.deleteItem')}>
                    <IconButton
                      size="small"
                      onClick={() => onDeleteItem(item)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>

              {/* Item Images Badge */}
              {item.item_images && item.item_images.length > 0 && (
                <Badge badgeContent={item.item_images.length} color="secondary">
                  <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                    📷
                  </Avatar>
                </Badge>
              )}
            </CardActions>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default ItemsTable;
