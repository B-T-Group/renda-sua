import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Inventory as InventoryIcon,
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
import { BusinessInventoryItem } from '../../hooks/useBusinessInventory';

interface InventoryCardsProps {
  items: BusinessInventoryItem[];
  loading: boolean;
  onUpdateInventory: (item: BusinessInventoryItem) => void;
  onEditItem: (item: BusinessInventoryItem) => void;
  onDeleteItem: (item: BusinessInventoryItem) => void;
  onRestockItem: (item: BusinessInventoryItem) => void;
}

interface InventoryFilters {
  search: string;
  stockStatus: string;
  location: string;
}

const InventoryCards: React.FC<InventoryCardsProps> = ({
  items,
  loading,
  onUpdateInventory,
  onEditItem,
  onDeleteItem,
  onRestockItem,
}) => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<InventoryFilters>({
    search: '',
    stockStatus: 'all',
    location: 'all',
  });

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  const getStockStatus = (item: BusinessInventoryItem) => {
    if (item.available_quantity <= 0) {
      return { status: 'out_of_stock', color: 'error' as const };
    } else if (item.available_quantity <= item.reorder_point) {
      return { status: 'low_stock', color: 'warning' as const };
    } else {
      return { status: 'in_stock', color: 'success' as const };
    }
  };

  const getStockStatusText = (status: string) => {
    switch (status) {
      case 'out_of_stock':
        return t('business.inventory.outOfStock');
      case 'low_stock':
        return t('business.inventory.lowStock');
      case 'in_stock':
        return t('business.inventory.inStock');
      default:
        return t('business.inventory.unknown');
    }
  };

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'out_of_stock':
        return 'error';
      case 'low_stock':
        return 'warning';
      case 'in_stock':
        return 'success';
      default:
        return 'default';
    }
  };

  // Get unique locations for filter
  const locations = useMemo(() => {
    const uniqueLocations = Array.from(
      new Set(items.map((item) => item.business_location.name))
    );
    return uniqueLocations.sort();
  }, [items]);

  // Filter items based on current filters
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const stockStatus = getStockStatus(item);

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          item.item.name.toLowerCase().includes(searchLower) ||
          (item.item.description &&
            item.item.description.toLowerCase().includes(searchLower)) ||
          (item.item.sku && item.item.sku.toLowerCase().includes(searchLower));

        if (!matchesSearch) return false;
      }

      // Stock status filter
      if (filters.stockStatus !== 'all') {
        if (stockStatus.status !== filters.stockStatus) return false;
      }

      // Location filter
      if (filters.location !== 'all') {
        if (item.business_location.name !== filters.location) return false;
      }

      return true;
    });
  }, [items, filters]);

  const handleFilterChange = (key: keyof InventoryFilters, value: string) => {
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
          {t('business.inventory.noItems')}
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
              label={t('business.inventory.filters.search')}
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
              <InputLabel>
                {t('business.inventory.filters.stockStatus')}
              </InputLabel>
              <Select
                value={filters.stockStatus}
                onChange={(e) =>
                  handleFilterChange('stockStatus', e.target.value)
                }
                label={t('business.inventory.filters.stockStatus')}
              >
                <MenuItem value="all">
                  {t('business.inventory.filters.allStatuses')}
                </MenuItem>
                <MenuItem value="in_stock">
                  {t('business.inventory.inStock')}
                </MenuItem>
                <MenuItem value="low_stock">
                  {t('business.inventory.lowStock')}
                </MenuItem>
                <MenuItem value="out_of_stock">
                  {t('business.inventory.outOfStock')}
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>
                {t('business.inventory.filters.location')}
              </InputLabel>
              <Select
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                label={t('business.inventory.filters.location')}
              >
                <MenuItem value="all">
                  {t('business.inventory.filters.allLocations')}
                </MenuItem>
                {locations.map((location) => (
                  <MenuItem key={location} value={location}>
                    {location}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary">
              {t('business.inventory.filters.showing')}: {filteredItems.length}{' '}
              / {items.length}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Inventory Cards */}
      <Grid container spacing={2}>
        {filteredItems.map((item) => {
          const stockStatus = getStockStatus(item);
          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  backgroundColor:
                    item.available_quantity <= item.reorder_point
                      ? '#fff3e0'
                      : 'inherit',
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  {/* Item Header */}
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    mb={2}
                  >
                    <Box flex={1}>
                      <Typography variant="h6" gutterBottom noWrap>
                        {item.item.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>
                        {item.item.description}
                      </Typography>
                    </Box>
                    <Chip
                      label={getStockStatusText(stockStatus.status)}
                      color={getStockStatusColor(stockStatus.status)}
                      size="small"
                    />
                  </Box>

                  {/* Location */}
                  <Box mb={2}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      <strong>{t('business.inventory.location')}:</strong>{' '}
                      {item.business_location.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.business_location.location_type}
                    </Typography>
                  </Box>

                  {/* Inventory Details */}
                  <Box mb={2}>
                    <Typography variant="h6" color="primary" fontWeight="bold">
                      {formatCurrency(item.selling_price, 'USD')}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      <strong>{t('business.inventory.quantity')}:</strong>{' '}
                      {item.quantity}
                    </Typography>

                    <Typography
                      variant="body2"
                      color={
                        item.available_quantity <= item.reorder_point
                          ? 'warning.main'
                          : 'text.secondary'
                      }
                      fontWeight={
                        item.available_quantity <= item.reorder_point
                          ? 'bold'
                          : 'normal'
                      }
                      gutterBottom
                    >
                      <strong>
                        {t('business.inventory.availableQuantity')}:
                      </strong>{' '}
                      {item.available_quantity}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      <strong>
                        {t('business.inventory.reservedQuantity')}:
                      </strong>{' '}
                      {item.reserved_quantity}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      <strong>{t('business.inventory.unitCost')}:</strong>{' '}
                      {formatCurrency(item.unit_cost, 'USD')}
                    </Typography>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      gutterBottom
                    >
                      <strong>{t('business.inventory.reorderPoint')}:</strong>{' '}
                      {item.reorder_point}
                    </Typography>
                  </Box>

                  {/* Item Properties */}
                  <Box mb={2}>
                    <Stack
                      direction="row"
                      spacing={1}
                      flexWrap="wrap"
                      useFlexGap
                    >
                      {item.item.is_fragile && (
                        <Chip
                          label={t('business.inventory.isFragile')}
                          size="small"
                          color="warning"
                        />
                      )}
                      {item.item.is_perishable && (
                        <Chip
                          label={t('business.inventory.isPerishable')}
                          size="small"
                          color="error"
                        />
                      )}
                      {item.item.requires_special_handling && (
                        <Chip
                          label={t(
                            'business.inventory.requiresSpecialHandling'
                          )}
                          size="small"
                          color="info"
                        />
                      )}
                    </Stack>
                  </Box>

                  {/* Last Restocked */}
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      display="block"
                    >
                      <strong>{t('business.inventory.lastRestocked')}:</strong>{' '}
                      {item.last_restocked_at
                        ? new Date(item.last_restocked_at).toLocaleDateString()
                        : t('business.inventory.neverRestocked')}
                    </Typography>
                  </Box>
                </CardContent>

                <CardActions sx={{ justifyContent: 'space-between', p: 2 }}>
                  <Box>
                    <Tooltip title={t('common.view')}>
                      <IconButton
                        size="small"
                        onClick={() => onUpdateInventory(item)}
                        color="primary"
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('business.inventory.updateInventory')}>
                      <IconButton
                        size="small"
                        onClick={() => onUpdateInventory(item)}
                        color="primary"
                      >
                        <InventoryIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('business.inventory.restock')}>
                      <IconButton
                        size="small"
                        onClick={() => onRestockItem(item)}
                        color="success"
                      >
                        <AddIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.edit')}>
                      <IconButton
                        size="small"
                        onClick={() => onEditItem(item)}
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete')}>
                      <IconButton
                        size="small"
                        onClick={() => onDeleteItem(item)}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  {/* Stock Level Badge */}
                  <Badge
                    badgeContent={item.available_quantity}
                    color={
                      item.available_quantity <= item.reorder_point
                        ? 'warning'
                        : 'primary'
                    }
                  >
                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                      📦
                    </Avatar>
                  </Badge>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default InventoryCards;
