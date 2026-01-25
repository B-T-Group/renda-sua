import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Badge,
  Box,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Item } from '../../hooks/useItems';

interface ItemsCardsProps {
  items: Item[];
  loading: boolean;
  onEditItem: (item: Item) => void;
  onViewItem?: (item: Item) => void;
  onDeleteItem?: (item: Item) => void;
}

interface ItemsFilters {
  search: string;
  status: string;
  brand: string;
  category: string;
}

const ItemsCards: React.FC<ItemsCardsProps> = ({
  items,
  loading,
  onEditItem,
  onViewItem,
  onDeleteItem,
}) => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ItemsFilters>({
    search: '',
    status: 'all',
    brand: 'all',
    category: 'all',
  });

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

  // Get unique brands for filter
  const brands = useMemo(() => {
    const uniqueBrands = Array.from(
      new Set(
        items
          .map((item) => item.brand?.name)
          .filter((brand) => brand !== undefined)
      )
    );
    return uniqueBrands.sort();
  }, [items]);

  // Get unique categories for filter
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(
        items
          .map((item) => item.item_sub_category?.name)
          .filter((category) => category !== undefined)
      )
    );
    return uniqueCategories.sort();
  }, [items]);

  // Filter items based on current filters
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          item.name.toLowerCase().includes(searchLower) ||
          (item.description &&
            item.description.toLowerCase().includes(searchLower)) ||
          (item.sku && item.sku.toLowerCase().includes(searchLower)) ||
          (item.brand?.name &&
            item.brand.name.toLowerCase().includes(searchLower));

        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status !== 'all') {
        const isActive = filters.status === 'active';
        if (item.is_active !== isActive) return false;
      }

      // Brand filter
      if (filters.brand !== 'all') {
        if (item.brand?.name !== filters.brand) return false;
      }

      // Category filter
      if (filters.category !== 'all') {
        if (item.item_sub_category?.name !== filters.category) return false;
      }

      return true;
    });
  }, [items, filters]);

  const handleFilterChange = (key: keyof ItemsFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
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
    <Box>
      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label={t('business.items.filters.search')}
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              InputProps={{
                startAdornment: (
                  <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>{t('business.items.filters.status')}</InputLabel>
              <Select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                label={t('business.items.filters.status')}
              >
                <MenuItem value="all">
                  {t('business.items.filters.allStatuses')}
                </MenuItem>
                <MenuItem value="active">{t('business.items.active')}</MenuItem>
                <MenuItem value="inactive">
                  {t('business.items.inactive')}
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>{t('business.items.filters.brand')}</InputLabel>
              <Select
                value={filters.brand}
                onChange={(e) => handleFilterChange('brand', e.target.value)}
                label={t('business.items.filters.brand')}
              >
                <MenuItem value="all">
                  {t('business.items.filters.allBrands')}
                </MenuItem>
                {brands.map((brand) => (
                  <MenuItem key={brand} value={brand}>
                    {brand}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>{t('business.items.filters.category')}</InputLabel>
              <Select
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                label={t('business.items.filters.category')}
              >
                <MenuItem value="all">
                  {t('business.items.filters.allCategories')}
                </MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category} value={category}>
                    {category}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              {t('business.items.filters.showing')}: {filteredItems.length} /{' '}
              {items.length}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Items Cards */}
      <Grid container spacing={2}>
        {filteredItems.map((item) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
            <Card
              sx={{
                height: '400px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Item Image */}
              {item.item_images && item.item_images.length > 0 && (
                <CardMedia
                  component="img"
                  height="140"
                  image={
                    item.item_images.find((img) => img.image_type === 'main')
                      ?.image_url || item.item_images[0].image_url
                  }
                  alt={item.name}
                  sx={{ objectFit: 'cover' }}
                />
              )}

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
                  <Stack
                    direction="row"
                    spacing={0.5}
                    flexWrap="wrap"
                    useFlexGap
                  >
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
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                      >
                        {t('business.items.weight')}: {item.weight}{' '}
                        {item.weight_unit}
                      </Typography>
                    )}
                    {item.dimensions && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                      >
                        {t('business.items.dimensions')}: {item.dimensions}
                      </Typography>
                    )}
                    {item.color && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                      >
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
                  <Badge
                    badgeContent={item.item_images.length}
                    color="secondary"
                  >
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
    </Box>
  );
};

export default ItemsCards;
